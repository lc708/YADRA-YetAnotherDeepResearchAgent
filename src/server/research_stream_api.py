import asyncio
import json
import uuid
from datetime import datetime
from typing import Dict, Any, Optional, AsyncGenerator, List
from enum import Enum
from dataclasses import dataclass, asdict
import logging
import re

from fastapi import APIRouter, HTTPException, Depends
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field

# 添加LangGraph相关导入
from src.graph.async_builder import create_graph
from src.graph.types import State
from src.utils.url_param_generator import generate_url_param
from src.server.repositories.session_repository import SessionRepository, get_session_repository

logger = logging.getLogger(__name__)

# 自定义JSON编码器
class CustomJSONEncoder(json.JSONEncoder):
    def default(self, obj):
        if isinstance(obj, uuid.UUID):
            return str(obj)
        if isinstance(obj, datetime):
            return obj.isoformat()
        return super().default(obj)

def safe_json_dumps(obj):
    """安全的JSON序列化"""
    return json.dumps(obj, cls=CustomJSONEncoder, ensure_ascii=False)

# 创建路由器
router = APIRouter(prefix="/api/research", tags=["research"])

# SSE事件类型定义
class SSEEventType(Enum):
    NAVIGATION = "navigation"
    METADATA = "metadata"
    NODE_START = "node_start"
    NODE_COMPLETE = "node_complete"
    PLAN_GENERATED = "plan_generated"
    SEARCH_RESULTS = "search_results"
    AGENT_OUTPUT = "agent_output"
    MESSAGE_CHUNK = "message_chunk"
    ARTIFACT = "artifact"
    PROGRESS = "progress"
    COMPLETE = "complete"
    ERROR = "error"

# 请求模型
class ActionType(Enum):
    CREATE = "create"
    CONTINUE = "continue"
    FEEDBACK = "feedback"
    MODIFY = "modify"

class ResearchStreamRequest(BaseModel):
    action: ActionType
    message: str
    url_param: Optional[str] = None
    frontend_uuid: str
    frontend_context_uuid: str
    visitor_id: str
    user_id: Optional[str] = None
    config: Dict[str, Any]
    context: Optional[Dict[str, Any]] = None

# SSE事件数据模型
@dataclass
class NavigationEvent:
    url_param: str
    thread_id: str
    workspace_url: str
    frontend_uuid: str
    frontend_context_uuid: str
    timestamp: str

@dataclass
class MetadataEvent:
    execution_id: str
    thread_id: str
    frontend_uuid: str
    frontend_context_uuid: str
    visitor_id: str
    user_id: Optional[str]
    config_used: Dict[str, Any]
    model_info: Dict[str, str]
    estimated_duration: int
    start_time: str
    timestamp: str

@dataclass
class NodeEvent:
    node_name: str
    node_type: str  # "start" or "complete"
    thread_id: str
    execution_id: str
    input_data: Optional[Dict[str, Any]]
    output_data: Optional[Dict[str, Any]]
    duration_ms: Optional[int]
    timestamp: str

@dataclass
class PlanEvent:
    plan_data: Dict[str, Any]
    plan_iterations: int
    thread_id: str
    execution_id: str
    timestamp: str

@dataclass
class SearchResultsEvent:
    query: str
    results: List[Dict[str, Any]]  # 包含url, title, content, images等
    source: str  # "tavily", "web_search"等
    thread_id: str
    execution_id: str
    timestamp: str

@dataclass
class AgentOutputEvent:
    agent_name: str
    agent_type: str
    content: str
    metadata: Dict[str, Any]
    thread_id: str
    execution_id: str
    timestamp: str

@dataclass
class MessageChunkEvent:
    chunk_id: str
    content: str
    chunk_type: str  # "planning", "research", "analysis", "conclusion"
    agent_name: str
    sequence: int
    is_final: bool
    metadata: Dict[str, Any]
    thread_id: str
    execution_id: str
    timestamp: str

@dataclass
class ArtifactEvent:
    artifact_id: str
    type: str  # "research_plan", "data_table", "chart", "summary", "code", "document"
    title: str
    content: str
    format: str  # "markdown", "html", "json", "csv", "code"
    metadata: Dict[str, Any]
    thread_id: str
    execution_id: str
    timestamp: str

@dataclass
class ProgressEvent:
    current_node: str
    completed_nodes: List[str]
    remaining_nodes: List[str]
    current_step_description: str
    thread_id: str
    execution_id: str
    timestamp: str

@dataclass
class CompleteEvent:
    execution_id: str
    thread_id: str
    total_duration_ms: int
    tokens_consumed: Dict[str, int]
    total_cost: float
    artifacts_generated: List[str]
    final_status: str
    completion_time: str
    summary: Dict[str, Any]
    timestamp: str

@dataclass
class ErrorEvent:
    error_code: str
    error_message: str
    error_details: Dict[str, Any]
    thread_id: str
    execution_id: str
    retry_after: Optional[int]
    suggestions: List[str]
    timestamp: str

class ResearchStreamService:
    """真实的研究流式服务"""
    
    def __init__(self, session_repo: SessionRepository):
        self.session_repo = session_repo
        self._graph = None
        self._token_counter = {"input": 0, "output": 0}
        self._cost_calculator = {"total": 0.0}
    
    async def _get_graph(self):
        """获取或创建LangGraph实例"""
        if self._graph is None:
            self._graph = await create_graph()
        return self._graph
    
    def _calculate_tokens_and_cost(self, content: str, is_input: bool = False) -> Dict[str, Any]:
        """计算token消耗和成本"""
        # 简单的token估算（实际应该使用tokenizer）
        token_count = len(content.split()) * 1.3  # 粗略估算
        
        if is_input:
            self._token_counter["input"] += token_count
        else:
            self._token_counter["output"] += token_count
        
        # 成本计算（基于Claude 3.5 Sonnet定价）
        input_cost = self._token_counter["input"] * 0.003 / 1000  # $0.003 per 1K input tokens
        output_cost = self._token_counter["output"] * 0.015 / 1000  # $0.015 per 1K output tokens
        total_cost = input_cost + output_cost
        
        self._cost_calculator["total"] = total_cost
        
        return {
            "input_tokens": int(self._token_counter["input"]),
            "output_tokens": int(self._token_counter["output"]),
            "total_cost": round(total_cost, 4)
        }
    
    def _extract_urls_and_images(self, content: str) -> Dict[str, List[str]]:
        """从内容中提取URL和图片链接"""
        url_pattern = r'https?://[^\s<>"{}|\\^`[\]]+[^\s<>"{}|\\^`[\].,;:]'
        img_pattern = r'!\[.*?\]\((https?://[^\s)]+)\)|<img[^>]+src=["\']([^"\']+)["\'][^>]*>'
        
        urls = re.findall(url_pattern, content)
        img_matches = re.findall(img_pattern, content)
        images = [match[0] or match[1] for match in img_matches if match[0] or match[1]]
        
        return {
            "urls": list(set(urls)),
            "images": list(set(images))
        }
    
    def _get_current_timestamp(self) -> str:
        """获取当前时间戳"""
        return datetime.utcnow().isoformat() + "Z"
    
    def _determine_chunk_type(self, node_name: str, content: str) -> str:
        """根据节点名称和内容确定块类型"""
        node_type_map = {
            "coordinator": "planning",
            "planner": "planning", 
            "background_investigator": "research",
            "researcher": "research",
            "coder": "analysis",
            "reporter": "conclusion"
        }
        return node_type_map.get(node_name, "research")
    
    def _parse_search_results(self, search_content: str) -> List[Dict[str, Any]]:
        """解析搜索结果内容"""
        results = []
        # 简单的解析逻辑，实际应该更复杂
        sections = search_content.split("## ")
        for section in sections[1:]:  # 跳过第一个空段
            lines = section.strip().split("\n", 1)
            if len(lines) >= 2:
                title = lines[0].strip()
                content = lines[1].strip()
                
                # 提取URL和图片
                extracted = self._extract_urls_and_images(content)
                
                results.append({
                    "title": title,
                    "content": content[:500],  # 限制长度
                    "url": extracted["urls"][0] if extracted["urls"] else "",
                    "images": extracted["images"],
                    "snippet": content[:200]
                })
        
        return results
    
    def _get_remaining_nodes(self, current_node: str, completed_nodes: List[str]) -> List[str]:
        """获取剩余节点列表"""
        all_nodes = ["coordinator", "background_investigator", "planner", "researcher", "reporter"]
        remaining = []
        
        current_index = all_nodes.index(current_node) if current_node in all_nodes else 0
        for node in all_nodes[current_index + 1:]:
            if node not in completed_nodes:
                remaining.append(node)
        
        return remaining
    
    def _get_node_description(self, node_name: str) -> str:
        """获取节点描述"""
        descriptions = {
            "coordinator": "正在协调研究任务...",
            "background_investigator": "正在进行背景调研...",
            "planner": "正在制定研究计划...",
            "researcher": "正在执行深度研究...",
            "coder": "正在处理数据分析...",
            "reporter": "正在生成最终报告..."
        }
        return descriptions.get(node_name, f"正在执行{node_name}...")
    
    async def _process_langgraph_stream(
        self, 
        graph, 
        initial_state: Dict[str, Any], 
        thread_id: str,
        execution_id: str,
        request: ResearchStreamRequest
    ) -> AsyncGenerator[Dict[str, str], None]:
        """处理LangGraph流式执行"""
        
        start_time = datetime.utcnow()
        completed_nodes = []
        current_node = "coordinator"
        
        try:
            # 发送metadata事件
            metadata_event = MetadataEvent(
                execution_id=execution_id,
                thread_id=thread_id,
                frontend_uuid=request.frontend_uuid,
                frontend_context_uuid=request.frontend_context_uuid,
                visitor_id=request.visitor_id,
                user_id=request.user_id,
                config_used=request.config,
                model_info={
                    "model_name": request.config.get("model_config", {}).get("model_name", "claude-3-5-sonnet-20241022"),
                    "provider": request.config.get("model_config", {}).get("provider", "anthropic"),
                    "version": "20241022"
                },
                estimated_duration=120,
                start_time=start_time.isoformat() + "Z",
                timestamp=self._get_current_timestamp()
            )
            
            yield {
                "event": SSEEventType.METADATA.value,
                "data": safe_json_dumps(asdict(metadata_event))
            }
            
            # 执行LangGraph工作流
            config = {"configurable": {"thread_id": thread_id}}
            
            # 使用updates stream mode来获取更详细的执行信息
            async for event in graph.astream(initial_state, config, stream_mode="updates"):
                current_timestamp = self._get_current_timestamp()
                
                # 处理LangGraph updates事件
                # event格式: {node_name: {state_updates}}
                if isinstance(event, dict):
                    for node_name, node_output in event.items():
                        if node_name == "__start__":
                            continue
                            
                        # 发送节点开始事件
                        if node_name != current_node:
                            # 如果之前有节点在执行，发送完成事件
                            if current_node and current_node != "coordinator":
                                completed_nodes.append(current_node)
                                node_complete_event = NodeEvent(
                                    node_name=current_node,
                                    node_type="complete",
                                    thread_id=thread_id,
                                    execution_id=execution_id,
                                    input_data=None,
                                    output_data=None,
                                    duration_ms=None,
                                    timestamp=current_timestamp
                                )
                                
                                yield {
                                    "event": SSEEventType.NODE_COMPLETE.value,
                                    "data": safe_json_dumps(asdict(node_complete_event))
                                }
                            
                            # 发送新节点开始事件
                            current_node = node_name
                            node_start_event = NodeEvent(
                                node_name=current_node,
                                node_type="start",
                                thread_id=thread_id,
                                execution_id=execution_id,
                                input_data=None,
                                output_data=None,
                                duration_ms=None,
                                timestamp=current_timestamp
                            )
                            
                            yield {
                                "event": SSEEventType.NODE_START.value,
                                "data": safe_json_dumps(asdict(node_start_event))
                            }
                        
                        # 处理节点输出
                        if isinstance(node_output, dict):
                            # 处理消息
                            if "messages" in node_output:
                                messages = node_output["messages"]
                                if isinstance(messages, list) and messages:
                                    last_message = messages[-1]
                                    content = getattr(last_message, 'content', str(last_message))
                                    
                                    if content:
                                        # 计算token和成本
                                        token_info = self._calculate_tokens_and_cost(content, is_input=False)
                                        
                                        # 提取URL和图片
                                        extracted = self._extract_urls_and_images(content)
                                        
                                        # 发送消息块事件
                                        chunk_event = MessageChunkEvent(
                                            chunk_id=str(uuid.uuid4()),
                                            content=content,
                                            chunk_type=self._determine_chunk_type(current_node, content),
                                            agent_name=node_name,
                                            sequence=len(messages),
                                            is_final=False,
                                            metadata={
                                                "urls": extracted["urls"],
                                                "images": extracted["images"],
                                                "token_info": token_info,
                                                "node": current_node
                                            },
                                            thread_id=thread_id,
                                            execution_id=execution_id,
                                            timestamp=current_timestamp
                                        )
                                        
                                        yield {
                                            "event": SSEEventType.MESSAGE_CHUNK.value,
                                            "data": safe_json_dumps(asdict(chunk_event))
                                        }
                            
                            # 处理计划生成
                            if "current_plan" in node_output:
                                plan_data = node_output["current_plan"]
                                plan_event = PlanEvent(
                                    plan_data=plan_data if isinstance(plan_data, dict) else {"plan": str(plan_data)},
                                    plan_iterations=node_output.get("plan_iterations", 0),
                                    thread_id=thread_id,
                                    execution_id=execution_id,
                                    timestamp=current_timestamp
                                )
                                
                                yield {
                                    "event": SSEEventType.PLAN_GENERATED.value,
                                    "data": safe_json_dumps(asdict(plan_event))
                                }
                            
                            # 处理背景调查结果
                            if "background_investigation_results" in node_output:
                                search_content = node_output["background_investigation_results"]
                                extracted = self._extract_urls_and_images(search_content)
                                
                                # 解析搜索结果
                                search_results = self._parse_search_results(search_content)
                                
                                search_event = SearchResultsEvent(
                                    query=node_output.get("research_topic", ""),
                                    results=search_results,
                                    source="tavily",
                                    thread_id=thread_id,
                                    execution_id=execution_id,
                                    timestamp=current_timestamp
                                )
                                
                                yield {
                                    "event": SSEEventType.SEARCH_RESULTS.value,
                                    "data": safe_json_dumps(asdict(search_event))
                                }
                            
                            # 处理最终报告
                            if "final_report" in node_output:
                                report_content = node_output["final_report"]
                                
                                # 创建报告artifact
                                artifact_event = ArtifactEvent(
                                    artifact_id=str(uuid.uuid4()),
                                    type="summary",
                                    title="研究报告",
                                    content=report_content,
                                    format="markdown",
                                    metadata={
                                        "node": current_node,
                                        "research_topic": node_output.get("research_topic", "")
                                    },
                                    thread_id=thread_id,
                                    execution_id=execution_id,
                                    timestamp=current_timestamp
                                )
                                
                                yield {
                                    "event": SSEEventType.ARTIFACT.value,
                                    "data": safe_json_dumps(asdict(artifact_event))
                                }
                        
                        # 发送进度更新
                        remaining_nodes = self._get_remaining_nodes(current_node, completed_nodes)
                        progress_event = ProgressEvent(
                            current_node=current_node,
                            completed_nodes=completed_nodes.copy(),
                            remaining_nodes=remaining_nodes,
                            current_step_description=self._get_node_description(current_node),
                            thread_id=thread_id,
                            execution_id=execution_id,
                            timestamp=current_timestamp
                        )
                        
                        yield {
                            "event": SSEEventType.PROGRESS.value,
                            "data": safe_json_dumps(asdict(progress_event))
                        }
            
            # 工作流完成
            end_time = datetime.utcnow()
            duration_ms = int((end_time - start_time).total_seconds() * 1000)
            final_token_info = self._calculate_tokens_and_cost("", is_input=False)
            
            complete_event = CompleteEvent(
                execution_id=execution_id,
                thread_id=thread_id,
                total_duration_ms=duration_ms,
                tokens_consumed=final_token_info,
                total_cost=final_token_info["total_cost"],
                artifacts_generated=[],  # TODO: 实际的artifacts
                final_status="success",
                completion_time=end_time.isoformat() + "Z",
                summary={
                    "nodes_executed": completed_nodes + [current_node],
                    "total_messages": len(event.get("messages", [])),
                    "research_topic": initial_state.get("research_topic", "")
                },
                timestamp=self._get_current_timestamp()
            )
            
            yield {
                "event": SSEEventType.COMPLETE.value,
                "data": safe_json_dumps(asdict(complete_event))
            }
            
        except Exception as e:
            logger.error(f"LangGraph执行错误: {e}")
            error_event = ErrorEvent(
                error_code="LANGGRAPH_EXECUTION_ERROR",
                error_message=str(e),
                error_details={"traceback": str(e)},
                thread_id=thread_id,
                execution_id=execution_id,
                retry_after=None,
                suggestions=["检查配置", "重试请求"],
                timestamp=self._get_current_timestamp()
            )
            
            yield {
                "event": SSEEventType.ERROR.value,
                "data": safe_json_dumps(asdict(error_event))
            } 

    async def create_research_stream(self, request: ResearchStreamRequest) -> AsyncGenerator[Dict[str, str], None]:
        """创建新的研究流"""
        try:
            # 生成thread_id
            thread_id = str(uuid.uuid4())
            
            # 解析配置
            research_config = request.config.get("research_config", {})
            model_config = request.config.get("model_config", {})
            output_config = request.config.get("output_config", {})
            
            # 创建会话记录
            session_data, url_param = await self.session_repo.create_session(
                thread_id=thread_id,
                frontend_uuid=request.frontend_uuid,
                visitor_id=request.visitor_id,
                user_id=request.user_id,
                initial_question=request.message,
                research_config=research_config,
                model_config=model_config,
                output_config=output_config
            )
            
            # 创建执行记录
            execution_record = await self.session_repo.create_execution_record(
                session_id=session_data.id,
                frontend_context_uuid=request.frontend_context_uuid,
                action_type=ActionType.CREATE,
                user_message=request.message
            )
            execution_id = execution_record.execution_id
            
            # 发送navigation事件
            navigation_event = NavigationEvent(
                url_param=url_param,
                thread_id=thread_id,
                workspace_url=f"/workspace/{url_param}",
                frontend_uuid=request.frontend_uuid,
                frontend_context_uuid=request.frontend_context_uuid,
                timestamp=self._get_current_timestamp()
            )
            
            yield {
                "event": SSEEventType.NAVIGATION.value,
                "data": safe_json_dumps(asdict(navigation_event))
            }
            
            # 准备LangGraph初始状态
            initial_state = {
                "messages": [{"role": "user", "content": request.message}],
                "research_topic": request.message,
                "locale": output_config.get("language", "zh-CN"),
                "auto_accepted_plan": True,  # 自动接受计划
                "enable_background_investigation": research_config.get("enable_background_investigation", True),
                "plan_iterations": 0
            }
            
            # 获取LangGraph实例
            graph = await self._get_graph()
            
            # 处理LangGraph流式执行
            async for event in self._process_langgraph_stream(
                graph, initial_state, thread_id, execution_id, request
            ):
                yield event
                
        except Exception as e:
            logger.error(f"创建研究流失败: {e}")
            error_event = ErrorEvent(
                error_code="CREATE_STREAM_ERROR",
                error_message=str(e),
                error_details={"error_type": type(e).__name__},
                thread_id="",
                execution_id="",
                retry_after=30,
                suggestions=["检查请求参数", "稍后重试"],
                timestamp=self._get_current_timestamp()
            )
            
            yield {
                "event": SSEEventType.ERROR.value,
                "data": safe_json_dumps(asdict(error_event))
            }
    
    async def continue_research_stream(self, request: ResearchStreamRequest) -> AsyncGenerator[Dict[str, str], None]:
        """继续现有的研究流"""
        try:
            # 获取现有会话
            session = await self.session_repo.get_session_by_url_param(request.url_param)
            if not session:
                raise HTTPException(status_code=404, detail="会话不存在")
            
            thread_id = session.thread_id
            
            # 创建执行记录
            execution_record = await self.session_repo.create_execution_record(
                session_id=session.id,
                frontend_context_uuid=request.frontend_context_uuid,
                action_type=request.action,
                user_message=request.message
            )
            execution_id = execution_record.execution_id
            
            # 获取现有消息历史
            messages = await self.session_repo.get_messages_by_session_id(session.id)
            
            # 准备继续状态
            continue_state = {
                "messages": [
                    {"role": msg.role, "content": msg.content, "name": msg.source_agent}
                    for msg in messages
                ] + [{"role": "user", "content": request.message}],
                "research_topic": session.initial_question,
                "locale": "zh-CN",
                "auto_accepted_plan": True,
                "enable_background_investigation": True,
                "plan_iterations": 0
            }
            
            # 获取LangGraph实例
            graph = await self._get_graph()
            
            # 处理LangGraph流式执行
            async for event in self._process_langgraph_stream(
                graph, continue_state, thread_id, execution_id, request
            ):
                yield event
                
        except Exception as e:
            logger.error(f"继续研究流失败: {e}")
            error_event = ErrorEvent(
                error_code="CONTINUE_STREAM_ERROR",
                error_message=str(e),
                error_details={"error_type": type(e).__name__},
                thread_id=request.url_param or "",
                execution_id="",
                retry_after=30,
                suggestions=["检查会话状态", "稍后重试"],
                timestamp=self._get_current_timestamp()
            )
            
            yield {
                "event": SSEEventType.ERROR.value,
                "data": safe_json_dumps(asdict(error_event))
            } 

# 依赖注入
async def get_session_repository_dependency() -> SessionRepository:
    """获取SessionRepository依赖"""
    import os
    from dotenv import load_dotenv
    
    load_dotenv()
    db_url = os.getenv("DATABASE_URL")
    if not db_url:
        raise HTTPException(status_code=500, detail="数据库配置错误")
    
    return get_session_repository(db_url)

# API端点
@router.post("/stream")
async def research_stream(
    request: ResearchStreamRequest,
    session_repo: SessionRepository = Depends(get_session_repository_dependency)
):
    """统一研究流式接口"""
    service = ResearchStreamService(session_repo)
    
    if request.action == ActionType.CREATE:
        event_generator = service.create_research_stream(request)
    else:
        event_generator = service.continue_research_stream(request)
    
    async def stream_events():
        async for event in event_generator:
            # SSE格式
            yield f"event: {event['event']}\n"
            yield f"data: {event['data']}\n\n"
    
    return StreamingResponse(
        stream_events(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
        }
    )

@router.get("/workspace/{url_param}")
async def get_workspace_data(
    url_param: str,
    session_repo: SessionRepository = Depends(get_session_repository_dependency)
):
    """获取工作区状态接口"""
    try:
        # 通过url_param获取会话信息
        session = await session_repo.get_session_by_url_param(url_param)
        if not session:
            raise HTTPException(status_code=404, detail="会话不存在")
        
        # 获取消息历史
        messages_data = await session_repo.get_messages_by_session_id(session.id)
        
        # 获取执行记录
        executions_data = await session_repo.get_execution_records_by_session_id(session.id)
        
        # 获取配置
        config = await session_repo.get_session_config(session.id)
        
        return {
            "thread_id": session.thread_id,
            "url_param": session.url_param,
            "status": session.status if isinstance(session.status, str) else session.status.value,
            "session_metadata": {
                "created_at": session.created_at.isoformat(),
                "last_updated": session.updated_at.isoformat(),
                "total_interactions": len(executions_data),
                "execution_history": [
                    {
                        "execution_id": exec.get("execution_id"),
                        "action_type": exec.get("action_type"),
                        "start_time": exec.get("created_at").isoformat() if exec.get("created_at") else None,
                        "status": exec.get("status")
                    }
                    for exec in executions_data
                ]
            },
            "messages": [
                {
                    "id": msg.get("message_id"),
                    "content": msg.get("content"),
                    "role": msg.get("role"),
                    "timestamp": msg.get("timestamp").isoformat() if msg.get("timestamp") else None,
                    "metadata": {
                        "frontend_context_uuid": msg.get("frontend_context_uuid"),
                        "source_agent": msg.get("source_agent")
                    }
                }
                for msg in messages_data
            ],
            "artifacts": [],  # TODO: 实现artifacts获取
            "config": {
                "current_config": {
                    "research_config": config.research_config or {},
                    "model_config": config.model_config or {},
                    "output_config": config.output_config or {},
                    "user_preferences": config.user_preferences or {}
                } if config else {},
                "config_history": []
            },
            "execution_stats": {
                "total_tokens_used": sum((exec.get("input_tokens", 0) or 0) + (exec.get("output_tokens", 0) or 0) for exec in executions_data),
                "total_cost": sum(exec.get("total_cost", 0) or 0 for exec in executions_data),
                "average_response_time": sum(exec.get("duration_ms", 0) or 0 for exec in executions_data) / len(executions_data) if executions_data else 0,
                "model_usage_breakdown": {}
            },
            "permissions": {
                "can_modify": True,
                "can_share": True,
                "can_export": True,
                "can_delete": True
            }
        }
        
    except Exception as e:
        logger.error(f"获取工作区数据失败: {e}")
        raise HTTPException(status_code=500, detail=str(e)) 