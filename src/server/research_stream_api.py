import asyncio
import json
import uuid
from datetime import datetime
from typing import Dict, Any, Optional, AsyncGenerator, List, cast
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
from src.server.repositories.session_repository import (
    SessionRepository,
    get_session_repository,
)

# 添加LangChain消息类型导入
from langchain_core.messages import BaseMessage, ToolMessage, AIMessageChunk

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
    INTERRUPT = "interrupt"  # 🔥 添加interrupt事件类型
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
    thread_id: Optional[str] = None
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
    session_id: Optional[int]  # 🔥 添加session_id字段
    frontend_uuid: str
    frontend_context_uuid: str
    visitor_id: str
    user_id: Optional[str]
    config_used: Dict[str, Any]
    model_info: Dict[str, str]
    estimated_duration: int
    start_time: str
    execution_type: str = "continue"  # 🔥 添加execution_type字段：continue/feedback/monitor
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
class InterruptEvent:
    interrupt_id: str
    message: str
    options: List[Dict[str, str]]  # [{"text": "开始研究", "value": "accepted"}]
    thread_id: str
    execution_id: str
    node_name: str  # 触发interrupt的节点名称
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

    def _calculate_tokens_and_cost(
        self, content: str, is_input: bool = False
    ) -> Dict[str, Any]:
        """计算token消耗和成本"""
        # 简单的token估算（实际应该使用tokenizer）
        token_count = len(content.split()) * 1.3  # 粗略估算

        if is_input:
            self._token_counter["input"] += token_count
        else:
            self._token_counter["output"] += token_count

        # 成本计算（基于Claude 3.5 Sonnet定价）
        input_cost = (
            self._token_counter["input"] * 0.003 / 1000
        )  # $0.003 per 1K input tokens
        output_cost = (
            self._token_counter["output"] * 0.015 / 1000
        )  # $0.015 per 1K output tokens
        total_cost = input_cost + output_cost

        self._cost_calculator["total"] = total_cost

        return {
            "input_tokens": int(self._token_counter["input"]),
            "output_tokens": int(self._token_counter["output"]),
            "total_cost": round(total_cost, 4),
        }

    def _extract_urls_and_images(self, content: str) -> Dict[str, List[str]]:
        """从内容中提取URL和图片链接"""
        url_pattern = r'https?://[^\s<>"{}|\\^`[\]]+[^\s<>"{}|\\^`[\].,;:]'
        img_pattern = (
            r'!\[.*?\]\((https?://[^\s)]+)\)|<img[^>]+src=["\']([^"\']+)["\'][^>]*>'
        )

        urls = re.findall(url_pattern, content)
        img_matches = re.findall(img_pattern, content)
        images = [match[0] or match[1] for match in img_matches if match[0] or match[1]]

        return {"urls": list(set(urls)), "images": list(set(images))}

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
            "reporter": "conclusion",
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

                results.append(
                    {
                        "title": title,
                        "content": content[:500],  # 限制长度
                        "url": extracted["urls"][0] if extracted["urls"] else "",
                        "images": extracted["images"],
                        "snippet": content[:200],
                    }
                )

        return results

    def _get_remaining_nodes(
        self, current_node: str, completed_nodes: List[str]
    ) -> List[str]:
        """获取剩余节点列表"""
        all_nodes = [
            "coordinator",
            "background_investigator",
            "planner",
            "researcher",
            "reporter",
        ]
        remaining = []

        current_index = (
            all_nodes.index(current_node) if current_node in all_nodes else 0
        )
        for node in all_nodes[current_index + 1 :]:
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
            "reporter": "正在生成最终报告...",
        }
        return descriptions.get(node_name, f"正在执行{node_name}...")

    async def _process_langgraph_stream(
        self,
        graph,
        initial_state: Dict[str, Any],
        thread_id: str,
        execution_id: str,
        request: ResearchStreamRequest,
        execution_type: str = "continue",
    ) -> AsyncGenerator[Dict[str, str], None]:
        """处理LangGraph流式执行"""

        # 获取session信息用于数据库保存
        session = await self.session_repo.get_session_by_thread_id(thread_id)
        if not session:
            raise ValueError(f"Session not found for thread_id: {thread_id}")

        start_time = datetime.utcnow()
        current_node = ""
        completed_nodes = []

        try:
            # 发送开始事件
            metadata_event = MetadataEvent(
                execution_id=execution_id,
                thread_id=thread_id,
                session_id=session.id,
                frontend_uuid=request.frontend_uuid,
                frontend_context_uuid=request.frontend_context_uuid,
                visitor_id=request.visitor_id,
                user_id=request.user_id,
                config_used=request.config,
                model_info={
                    "model_name": (
                        request.config.get("model_config", {}).get(
                            "model_name", "claude-3-5-sonnet-20241022"
                        )
                    ),
                    "provider": (
                        request.config.get("model_config", {}).get(
                            "provider", "anthropic"
                        )
                    ),
                    "version": "20241022",
                },
                estimated_duration=120,
                start_time=start_time.isoformat() + "Z",
                execution_type=execution_type,
                timestamp=self._get_current_timestamp(),
            )

            yield {
                "event": SSEEventType.METADATA.value,
                "data": safe_json_dumps(asdict(metadata_event)),
            }

            # 执行LangGraph工作流
            config = {"configurable": {"thread_id": thread_id}}

            # 🔥 使用messages和updates混合模式来捕获interrupt事件（参考app.py实现）
            async for agent, _, event_data in graph.astream(
                initial_state,
                config,
                stream_mode=["messages", "updates"],
                subgraphs=True,
            ):
                current_timestamp = self._get_current_timestamp()

                # 🔥 处理LangGraph事件 - 完全参考app.py的正确实现
                if isinstance(event_data, dict):
                    if "__interrupt__" in event_data:
                        # 处理interrupt事件（完全参考app.py实现）
                        interrupt_data = event_data["__interrupt__"][0]
                        interrupt_value = interrupt_data.value

                        logger.info(f"🔄 收到interrupt事件: {interrupt_value}")

                        # 检查是否是reask类型的interrupt
                        if (
                            isinstance(interrupt_value, tuple)
                            and len(interrupt_value) == 2
                            and interrupt_value[0] == "reask"
                        ):
                            # 处理reask interrupt
                            original_input = interrupt_value[1]
                            reask_event = {
                                "thread_id": thread_id,
                                "id": interrupt_data.ns[0],
                                "role": "assistant",
                                "content": "正在恢复原始输入状态...",
                                "finish_reason": "reask",
                                "original_input": original_input,
                            }
                            yield {
                                "event": "reask",
                                "data": safe_json_dumps(reask_event),
                            }
                        else:
                            # 处理标准interrupt
                            # 检查 interrupt_value 是否包含 options
                            if (
                                isinstance(interrupt_value, dict)
                                and "options" in interrupt_value
                            ):
                                message_content = interrupt_value.get(
                                    "message", "Please Review the Plan."
                                )
                                options = interrupt_value.get("options", [])
                            else:
                                # 兼容旧格式
                                message_content = str(interrupt_value)
                                options = [
                                    {"text": "开始研究", "value": "accepted"},
                                    {"text": "编辑计划", "value": "edit_plan"},
                                    {"text": "立即生成报告", "value": "skip_research"},
                                    {"text": "重新提问", "value": "reask"},
                                ]

                            interrupt_event = {
                                "thread_id": thread_id,
                                "id": interrupt_data.ns[0],
                                "role": "assistant",
                                "content": message_content,
                                "finish_reason": "interrupt",
                                "options": options,
                            }

                            yield {
                                "event": SSEEventType.INTERRUPT.value,
                                "data": safe_json_dumps(interrupt_event),
                            }

                        # interrupt后不发送complete事件，等待用户反馈
                        logger.info(f"🔄 Interrupt发送完成，等待用户反馈")
                        return
                    else:
                        # 处理updates事件
                        for node_name, node_output in event_data.items():
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
                                        timestamp=current_timestamp,
                                    )

                                    yield {
                                        "event": SSEEventType.NODE_COMPLETE.value,
                                        "data": safe_json_dumps(
                                            asdict(node_complete_event)
                                        ),
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
                                    timestamp=current_timestamp,
                                )

                                yield {
                                    "event": SSEEventType.NODE_START.value,
                                    "data": safe_json_dumps(asdict(node_start_event)),
                                }

                            # 处理节点输出
                            if isinstance(node_output, dict):
                                # 处理消息
                                if "messages" in node_output:
                                    messages = node_output["messages"]
                                    if isinstance(messages, list) and messages:
                                        last_message = messages[-1]
                                        content = getattr(
                                            last_message, "content", str(last_message)
                                        )

                                        if content:
                                            # 🔥 保存消息到数据库
                                            try:
                                                await self.session_repo.save_message(
                                                    session_id=session.id,
                                                    execution_id=execution_id,
                                                    role="assistant",
                                                    content=content,
                                                    content_type="text",
                                                    frontend_context_uuid=request.frontend_context_uuid,
                                                    source_agent=node_name,
                                                )
                                            except Exception as e:
                                                logger.error(f"保存消息失败: {e}")

                                            # 计算token和成本
                                            token_info = (
                                                self._calculate_tokens_and_cost(
                                                    content, is_input=False
                                                )
                                            )

                                            # 提取URL和图片
                                            extracted = self._extract_urls_and_images(
                                                content
                                            )

                                            # 发送消息块事件
                                            chunk_event = MessageChunkEvent(
                                                chunk_id=str(uuid.uuid4()),
                                                content=content,
                                                chunk_type=self._determine_chunk_type(
                                                    current_node, content
                                                ),
                                                agent_name=node_name,
                                                sequence=len(messages),
                                                is_final=False,
                                                metadata={
                                                    "urls": extracted["urls"],
                                                    "images": extracted["images"],
                                                    "token_info": token_info,
                                                    "node": current_node,
                                                },
                                                thread_id=thread_id,
                                                execution_id=execution_id,
                                                timestamp=current_timestamp,
                                            )

                                            yield {
                                                "event": (
                                                    SSEEventType.MESSAGE_CHUNK.value
                                                ),
                                                "data": safe_json_dumps(
                                                    asdict(chunk_event)
                                                ),
                                            }

                                # 处理计划生成
                                if "current_plan" in node_output:
                                    plan_data = node_output["current_plan"]

                                    # 🔥 保存plan作为artifact到数据库
                                    try:
                                        # 处理Plan对象的序列化
                                        if isinstance(plan_data, str):
                                            plan_content = plan_data
                                        elif hasattr(plan_data, "dict"):
                                            # Pydantic模型，使用.dict()方法
                                            plan_content = json.dumps(
                                                plan_data.dict(),
                                                ensure_ascii=False,
                                                indent=2,
                                            )
                                        elif hasattr(plan_data, "__dict__"):
                                            # 普通对象，使用__dict__
                                            plan_content = json.dumps(
                                                plan_data.__dict__,
                                                ensure_ascii=False,
                                                indent=2,
                                            )
                                        else:
                                            # 其他情况，使用safe_json_dumps
                                            plan_content = safe_json_dumps(plan_data)

                                        await self.session_repo.save_artifact(
                                            session_id=session.id,
                                            execution_id=execution_id,
                                            artifact_type="research_plan",
                                            title="研究计划",
                                            content=plan_content,
                                            description="由AI生成的研究计划",
                                            content_format="json",
                                            source_agent=node_name,
                                            generation_context={
                                                "node": current_node,
                                                "timestamp": current_timestamp,
                                            },
                                        )
                                    except Exception as e:
                                        logger.error(f"保存plan artifact失败: {e}")
                                        logger.error(
                                            f"Plan data type: {type(plan_data)}"
                                        )
                                        logger.error(
                                            f"Plan data content: {str(plan_data)[:200]}..."
                                        )

                                    plan_event = PlanEvent(
                                        plan_data=(
                                            plan_data
                                            if isinstance(plan_data, dict)
                                            else {"plan": str(plan_data)}
                                        ),
                                        plan_iterations=node_output.get(
                                            "plan_iterations", 0
                                        ),
                                        thread_id=thread_id,
                                        execution_id=execution_id,
                                        timestamp=current_timestamp,
                                    )

                                    yield {
                                        "event": SSEEventType.PLAN_GENERATED.value,
                                        "data": safe_json_dumps(asdict(plan_event)),
                                    }

                                # 处理背景调查结果
                                if "background_investigation_results" in node_output:
                                    search_content = node_output[
                                        "background_investigation_results"
                                    ]

                                    # 🔥 保存搜索结果到数据库
                                    try:
                                        await self.session_repo.save_message(
                                            session_id=session.id,
                                            execution_id=execution_id,
                                            role="assistant",
                                            content=search_content,
                                            content_type="search_results",
                                            frontend_context_uuid=request.frontend_context_uuid,
                                            source_agent=node_name,
                                        )
                                    except Exception as e:
                                        logger.error(f"保存搜索结果失败: {e}")

                                    extracted = self._extract_urls_and_images(
                                        search_content
                                    )

                                    # 解析搜索结果
                                    search_results = self._parse_search_results(
                                        search_content
                                    )

                                    search_event = SearchResultsEvent(
                                        query=node_output.get("research_topic", ""),
                                        results=search_results,
                                        source="tavily",
                                        thread_id=thread_id,
                                        execution_id=execution_id,
                                        timestamp=current_timestamp,
                                    )

                                    yield {
                                        "event": SSEEventType.SEARCH_RESULTS.value,
                                        "data": safe_json_dumps(asdict(search_event)),
                                    }

                                # 处理最终报告
                                if "final_report" in node_output:
                                    report_content = node_output["final_report"]

                                    # 🔥 保存最终报告到数据库
                                    try:
                                        await self.session_repo.save_artifact(
                                            session_id=session.id,
                                            execution_id=execution_id,
                                            artifact_type="summary",
                                            title="研究报告",
                                            content=report_content,
                                            description="最终研究报告",
                                            content_format="markdown",
                                            source_agent=node_name,
                                            generation_context={
                                                "node": current_node,
                                                "research_topic": node_output.get(
                                                    "research_topic", ""
                                                ),
                                            },
                                        )
                                    except Exception as e:
                                        logger.error(f"保存最终报告失败: {e}")

                                    # 创建报告artifact
                                    artifact_event = ArtifactEvent(
                                        artifact_id=str(uuid.uuid4()),
                                        type="summary",
                                        title="研究报告",
                                        content=report_content,
                                        format="markdown",
                                        metadata={
                                            "node": current_node,
                                            "research_topic": node_output.get(
                                                "research_topic", ""
                                            ),
                                        },
                                        thread_id=thread_id,
                                        execution_id=execution_id,
                                        timestamp=current_timestamp,
                                    )

                                    yield {
                                        "event": SSEEventType.ARTIFACT.value,
                                        "data": safe_json_dumps(asdict(artifact_event)),
                                    }

                            # 发送进度更新
                            remaining_nodes = self._get_remaining_nodes(
                                current_node, completed_nodes
                            )
                            progress_event = ProgressEvent(
                                current_node=current_node,
                                completed_nodes=completed_nodes.copy(),
                                remaining_nodes=remaining_nodes,
                                current_step_description=self._get_node_description(
                                    current_node
                                ),
                                thread_id=thread_id,
                                execution_id=execution_id,
                                timestamp=current_timestamp,
                            )

                            yield {
                                "event": SSEEventType.PROGRESS.value,
                                "data": safe_json_dumps(asdict(progress_event)),
                            }

                # 🔥 处理messages流 - 完全参考app.py实现
                try:
                    # 安全地处理可能的单元素或双元素情况
                    if isinstance(event_data, tuple) and len(event_data) >= 2:
                        message_chunk, message_metadata = cast(
                            tuple[BaseMessage, dict[str, any]], event_data
                        )
                    elif isinstance(event_data, tuple) and len(event_data) == 1:
                        message_chunk = event_data[0]
                        message_metadata = {}
                    else:
                        # 如果不是预期的格式，跳过处理
                        continue

                    # 确保message_chunk是BaseMessage类型
                    if not isinstance(message_chunk, BaseMessage):
                        continue

                    event_stream_message: dict[str, any] = {
                        "thread_id": thread_id,
                        "agent": agent[0].split(":")[0] if agent else "unknown",
                        "id": message_chunk.id,
                        "role": "assistant",
                        "content": message_chunk.content,
                    }

                    if message_chunk.additional_kwargs.get("reasoning_content"):
                        event_stream_message["reasoning_content"] = (
                            message_chunk.additional_kwargs["reasoning_content"]
                        )
                    if message_chunk.response_metadata.get("finish_reason"):
                        event_stream_message["finish_reason"] = (
                            message_chunk.response_metadata.get("finish_reason")
                        )

                    if isinstance(message_chunk, ToolMessage):
                        # Tool Message - Return the result of the tool call
                        event_stream_message["tool_call_id"] = (
                            message_chunk.tool_call_id
                        )
                        yield {
                            "event": "tool_call_result",
                            "data": safe_json_dumps(event_stream_message),
                        }
                    elif isinstance(message_chunk, AIMessageChunk):
                        # AI Message - Raw message tokens
                        if message_chunk.tool_calls:
                            # AI Message - Tool Call
                            event_stream_message["tool_calls"] = (
                                message_chunk.tool_calls
                            )
                            event_stream_message["tool_call_chunks"] = (
                                message_chunk.tool_call_chunks
                            )
                            yield {
                                "event": "tool_calls",
                                "data": safe_json_dumps(event_stream_message),
                            }
                        elif message_chunk.tool_call_chunks:
                            # AI Message - Tool Call Chunks
                            event_stream_message["tool_call_chunks"] = (
                                message_chunk.tool_call_chunks
                            )
                            yield {
                                "event": "tool_call_chunks",
                                "data": safe_json_dumps(event_stream_message),
                            }
                        else:
                            # AI Message - Raw message tokens
                            yield {
                                "event": SSEEventType.MESSAGE_CHUNK.value,
                                "data": safe_json_dumps(event_stream_message),
                            }
                except Exception as message_error:
                    logger.warning(
                        f"⚠️ Messages流处理错误: {message_error}, event_data类型: {type(event_data)}"
                    )
                    # 不中断流，继续处理其他事件
                    continue

            # 🔥 检查LangGraph是否真正完成
            try:
                config = {"configurable": {"thread_id": thread_id}}
                current_state = await graph.aget_state(config)

                # 🔥 修复interrupt状态检测逻辑
                has_interrupt = False
                if (
                    current_state
                    and hasattr(current_state, "tasks")
                    and current_state.tasks
                ):
                    # 检查是否有pending的interrupt任务
                    for task in current_state.tasks:
                        if hasattr(task, "interrupts") and task.interrupts:
                            has_interrupt = True
                            break

                # 更准确的完成状态判断
                is_truly_complete = (
                    current_state
                    and not has_interrupt  # 没有pending的interrupt
                    and (
                        not current_state.next or len(current_state.next) == 0
                    )  # 没有下一个节点
                )

                logger.info(
                    f"🔍 LangGraph状态检查 - 是否有interrupt: {has_interrupt}, 是否真正完成: {is_truly_complete}, next节点: {current_state.next if current_state else 'None'}"
                )

                if is_truly_complete:
                    # 只有在真正完成时才发送complete事件
                    end_time = datetime.utcnow()
                    duration_ms = int((end_time - start_time).total_seconds() * 1000)
                    final_token_info = self._calculate_tokens_and_cost(
                        "", is_input=False
                    )

                    complete_event = CompleteEvent(
                        execution_id=execution_id,
                        thread_id=thread_id,
                        total_duration_ms=duration_ms,
                        tokens_consumed=final_token_info,
                        total_cost=0.0,
                        artifacts_generated=[],
                        final_status="completed",
                        completion_time=self._get_current_timestamp(),
                        summary={"nodes_completed": completed_nodes},
                        timestamp=self._get_current_timestamp(),
                    )

                    yield {
                        "event": SSEEventType.COMPLETE.value,
                        "data": safe_json_dumps(asdict(complete_event)),
                    }
                else:
                    # 工作流未完成（可能在interrupt等待用户反馈）
                    logger.info(
                        f"🔄 LangGraph工作流未完成，等待后续操作 - interrupt: {has_interrupt}"
                    )

            except Exception as state_error:
                logger.warning(f"⚠️ 无法获取LangGraph状态: {state_error}")
                # 如果无法获取状态，保守地不发送complete事件

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
                timestamp=self._get_current_timestamp(),
            )

            yield {
                "event": SSEEventType.ERROR.value,
                "data": safe_json_dumps(asdict(error_event)),
            }

    async def create_research_stream(
        self,
        request: ResearchStreamRequest,
        existing_session_id: Optional[int] = None,
        existing_thread_id: Optional[str] = None,
    ) -> AsyncGenerator[Dict[str, str], None]:
        """创建新的研究流"""
        try:
            # 解析配置 - 支持新旧格式
            # 如果有research_config字段，使用它；否则从扁平化的config中提取
            if "research_config" in request.config:
                research_config = request.config["research_config"]
            else:
                # 从扁平化的config中提取research相关配置
                research_config = {
                    "auto_accepted_plan": request.config.get(
                        "auto_accepted_plan", False
                    ),
                    "enable_background_investigation": request.config.get(
                        "enableBackgroundInvestigation", True
                    ),
                    "report_style": request.config.get("reportStyle", "academic"),
                    "enable_deep_thinking": request.config.get(
                        "enableDeepThinking", False
                    ),
                    "max_plan_iterations": request.config.get("maxPlanIterations", 3),
                    "max_step_num": request.config.get("maxStepNum", 5),
                    "max_search_results": request.config.get("maxSearchResults", 5),
                }

            model_config = request.config.get("model_config", {})
            output_config = request.config.get(
                "output_config",
                {
                    "language": "zh-CN",
                    "output_format": request.config.get("outputFormat", "markdown"),
                },
            )

            # 🔥 根据是否有现有session决定创建或复用
            if existing_session_id and existing_thread_id:
                # 使用现有session，避免重复创建
                thread_id = existing_thread_id
                # 通过thread_id获取session信息
                session_data = await self.session_repo.get_session_by_thread_id(
                    existing_thread_id
                )
                if not session_data:
                    raise HTTPException(status_code=404, detail="指定的session不存在")
                url_param = session_data.url_param
                logger.info(
                    f"Using existing session: {existing_session_id}, thread_id: {thread_id}"
                )
            else:
                # 创建新session（原有逻辑）
                thread_id = str(uuid.uuid4())
                session_data, url_param = await self.session_repo.create_session(
                    thread_id=thread_id,
                    frontend_uuid=request.frontend_uuid,
                    visitor_id=request.visitor_id,
                    user_id=request.user_id,
                    initial_question=request.message,
                    research_config=research_config,
                    model_config=model_config,
                    output_config=output_config,
                )
                logger.info(
                    f"Created new session: {session_data.id}, thread_id: {thread_id}"
                )

            # 创建执行记录
            execution_record = await self.session_repo.create_execution_record(
                session_id=session_data.id,
                frontend_context_uuid=request.frontend_context_uuid,
                action_type=ActionType.CREATE,
                user_message=request.message,
            )
            execution_id = execution_record.execution_id

            # 🔥 移除重复的navigation事件发送
            # research_create_api已经发送了包含session_id的navigation事件
            # 这里不再重复发送，避免双重navigation事件问题

            # 准备LangGraph初始状态
            initial_state = {
                "messages": [{"role": "user", "content": request.message}],
                "research_topic": request.message,
                "locale": output_config.get("language", "zh-CN"),
                "auto_accepted_plan": research_config.get(
                    "auto_accepted_plan", False
                ),  # 用户可配置，默认需要确认
                "enable_background_investigation": research_config.get(
                    "enable_background_investigation", True
                ),
                "plan_iterations": 0,
            }

            # 获取LangGraph实例
            graph = await self._get_graph()

            # 处理LangGraph流式执行 - 直接执行，无需预创建checkpoint
            async for event in self._process_langgraph_stream(
                graph, initial_state, thread_id, execution_id, request, execution_type="create"
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
                timestamp=self._get_current_timestamp(),
            )

            yield {
                "event": SSEEventType.ERROR.value,
                "data": safe_json_dumps(asdict(error_event)),
            }

    async def continue_research_stream(
        self, request: ResearchStreamRequest
    ) -> AsyncGenerator[Dict[str, str], None]:
        """继续现有的研究流 - 获取历史数据和当前状态"""
        try:
            # 🔥 优先使用thread_id，如果没有则通过url_param获取
            thread_id = request.thread_id

            if not thread_id and request.url_param:
                # 通过url_param获取thread_id
                session = await self.session_repo.get_session_by_url_param(
                    request.url_param
                )
                if not session:
                    raise HTTPException(status_code=404, detail="会话不存在")
                thread_id = session.thread_id

            if not thread_id:
                raise HTTPException(
                    status_code=400, detail="必须提供thread_id或url_param"
                )

            logger.info(f"🔍 Attempting to connect to thread_id: {thread_id}")

            # 🔥 检查是否有interrupt_feedback，优先处理
            interrupt_feedback = None
            if request.context and "interrupt_feedback" in request.context:
                interrupt_feedback = request.context["interrupt_feedback"]
                logger.info(f"📋 Processing interrupt feedback: {interrupt_feedback}")

                # 构建resume消息
                resume_msg = f"[{interrupt_feedback.upper()}]"
                if request.message and request.message.strip():
                    resume_msg += f" {request.message}"

                # 生成执行ID - 🔥 修复：使用标准UUID格式
                execution_id = str(uuid.uuid4())

                # 准备Command输入来恢复执行
                from langgraph.types import Command

                inputs = Command(resume=resume_msg)

                # 获取LangGraph实例
                graph = await self._get_graph()

                # 使用_process_langgraph_stream处理流式执行
                async for event in self._process_langgraph_stream(
                    graph, inputs, thread_id, execution_id, request, execution_type="feedback"
                ):
                    yield event
                return

            # 🔥 场景判断
            if request.message and request.message.strip():
                # 场景1：有新消息，需要继续执行
                logger.info(f"📝 Continuing thread {thread_id} with new message")

                # 生成执行ID - 🔥 修复：使用标准UUID格式
                execution_id = str(uuid.uuid4())

                # 准备输入状态
                inputs = {"messages": [{"role": "user", "content": request.message}]}

                # 获取LangGraph实例
                graph = await self._get_graph()

                # 使用_process_langgraph_stream处理流式执行
                async for event in self._process_langgraph_stream(
                    graph, inputs, thread_id, execution_id, request, execution_type="continue"
                ):
                    yield event
            else:
                # 场景2：监控模式 - 获取历史数据和当前状态
                logger.info(f"🔄 Entering monitoring mode for thread {thread_id}")

                # 生成监听会话ID - 🔥 修复：使用标准UUID格式
                monitoring_id = str(uuid.uuid4())

                # 发送metadata事件表示开始连接
                metadata_event = MetadataEvent(
                    execution_id=monitoring_id,
                    thread_id=thread_id,
                    session_id=None,
                    frontend_uuid=request.frontend_uuid,
                    frontend_context_uuid=request.frontend_context_uuid,
                    visitor_id=request.visitor_id,
                    user_id=request.user_id,
                    config_used=request.config,
                    model_info={
                        "model_name": "monitoring",
                        "provider": "database",
                        "version": "2.0",
                    },
                    estimated_duration=0,
                    start_time=self._get_current_timestamp(),
                    execution_type="monitor",
                    timestamp=self._get_current_timestamp(),
                )

                yield {
                    "event": SSEEventType.METADATA.value,
                    "data": safe_json_dumps(asdict(metadata_event)),
                }

                # 🔥 获取历史数据
                session = await self.session_repo.get_session_by_thread_id(thread_id)
                if not session:
                    logger.error(f"❌ Session not found for thread_id: {thread_id}")

                    error_event = ErrorEvent(
                        error_code="SESSION_NOT_FOUND",
                        error_message=f"未找到thread_id对应的会话: {thread_id}",
                        error_details={"thread_id": thread_id},
                        thread_id=thread_id,
                        execution_id=monitoring_id,
                        retry_after=None,
                        suggestions=["检查thread_id是否正确", "确认会话是否存在"],
                        timestamp=self._get_current_timestamp(),
                    )

                    yield {
                        "event": SSEEventType.ERROR.value,
                        "data": safe_json_dumps(asdict(error_event)),
                    }
                    return

                logger.info(
                    f"Using existing session: {session.id}, thread_id: {thread_id}"
                )

                # 🔥 获取LangGraph状态来判断任务是否还在运行
                try:
                    graph = await self._get_graph()
                    config = {"configurable": {"thread_id": thread_id}}

                    # 获取当前状态
                    current_state = await graph.aget_state(config)
                    is_running = (
                        current_state
                        and current_state.next
                        and len(current_state.next) > 0
                    )

                    logger.info(
                        f"🔍 Task status - Running: {is_running}, Next nodes: {current_state.next if current_state else 'None'}"
                    )

                except Exception as state_error:
                    logger.warning(f"⚠️ Could not get LangGraph state: {state_error}")
                    is_running = False

                # 获取历史消息
                messages = await self.session_repo.get_messages_by_session_id(
                    session.id
                )

                # 发送历史消息作为事件流
                for idx, msg in enumerate(messages):
                    chunk_event = MessageChunkEvent(
                        chunk_id=f"history_{idx}",
                        content=msg.content,
                        chunk_type="history",
                        agent_name=msg.source_agent or "assistant",
                        sequence=idx,
                        is_final=True,
                        metadata={
                            "role": msg.role,
                            "content_type": msg.content_type,
                            "created_at": (
                                msg.created_at.isoformat()
                                if hasattr(msg.created_at, "isoformat")
                                else str(msg.created_at)
                            ),
                            "is_historical": True,
                            "task_running": is_running,
                        },
                        thread_id=thread_id,
                        execution_id=monitoring_id,
                        timestamp=self._get_current_timestamp(),
                    )

                    yield {
                        "event": SSEEventType.MESSAGE_CHUNK.value,
                        "data": safe_json_dumps(asdict(chunk_event)),
                    }

                # 🔥 如果任务还在运行，通知前端可能有新的更新
                if is_running:
                    # 发送进度事件表示任务仍在进行
                    progress_event = ProgressEvent(
                        current_node=(
                            current_state.next[0] if current_state.next else "unknown"
                        ),
                        completed_nodes=[],
                        remaining_nodes=(
                            current_state.next if current_state.next else []
                        ),
                        current_step_description="任务正在后台运行中...",
                        thread_id=thread_id,
                        execution_id=monitoring_id,
                        timestamp=self._get_current_timestamp(),
                    )

                    yield {
                        "event": SSEEventType.PROGRESS.value,
                        "data": safe_json_dumps(asdict(progress_event)),
                    }

                # 发送完成事件
                complete_event = CompleteEvent(
                    execution_id=monitoring_id,
                    thread_id=thread_id,
                    total_duration_ms=0,
                    tokens_consumed={"input": 0, "output": 0},
                    total_cost=0.0,
                    artifacts_generated=[],
                    final_status=(
                        "monitoring_complete" if not is_running else "task_running"
                    ),
                    completion_time=self._get_current_timestamp(),
                    summary={
                        "type": "monitoring",
                        "messages_count": len(messages),
                        "task_status": "running" if is_running else "completed",
                    },
                    timestamp=self._get_current_timestamp(),
                )

                yield {
                    "event": SSEEventType.COMPLETE.value,
                    "data": safe_json_dumps(asdict(complete_event)),
                }

        except Exception as e:
            logger.error(f"Continue research stream failed: {e}")
            error_event = ErrorEvent(
                error_code="CONTINUE_STREAM_ERROR",
                error_message=str(e),
                error_details={"error_type": type(e).__name__},
                thread_id=request.thread_id or "",
                execution_id="",
                retry_after=30,
                suggestions=["检查thread_id", "确认会话存在", "稍后重试"],
                timestamp=self._get_current_timestamp(),
            )

            yield {
                "event": SSEEventType.ERROR.value,
                "data": safe_json_dumps(asdict(error_event)),
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
    session_repo: SessionRepository = Depends(get_session_repository_dependency),
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
        },
    )


@router.get("/workspace/{url_param}")
async def get_workspace_data(
    url_param: str,
    session_repo: SessionRepository = Depends(get_session_repository_dependency),
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
        executions_data = await session_repo.get_execution_records_by_session_id(
            session.id
        )

        # 🔥 获取artifacts
        artifacts_data = []
        try:
            async with await session_repo.get_connection() as conn:
                cursor = conn.cursor()
                await cursor.execute(
                    """
                    SELECT artifact_id, type, title, description, content, 
                           content_format, source_agent, created_at
                    FROM artifact_storage 
                    WHERE session_id = %s 
                    ORDER BY created_at DESC
                """,
                    (session.id,),
                )
                artifacts_rows = await cursor.fetchall()

                artifacts_data = [
                    {
                        "id": row["artifact_id"],
                        "type": row["type"],
                        "title": row["title"],
                        "description": row["description"],
                        "content": row["content"],
                        "format": row["content_format"],
                        "source_agent": row["source_agent"],
                        "created_at": (
                            row["created_at"].isoformat() if row["created_at"] else None
                        ),
                    }
                    for row in artifacts_rows
                ]
        except Exception as e:
            logger.error(f"获取artifacts失败: {e}")

        # 获取配置
        config = await session_repo.get_session_config(session.id)

        return {
            "thread_id": session.thread_id,
            "url_param": session.url_param,
            "status": (
                session.status
                if isinstance(session.status, str)
                else session.status.value
            ),
            "session_metadata": {
                "created_at": session.created_at.isoformat(),
                "last_updated": session.updated_at.isoformat(),
                "total_interactions": len(executions_data),
                "execution_history": [
                    {
                        "execution_id": exec.get("execution_id"),
                        "action_type": exec.get("action_type"),
                        "start_time": (
                            exec.get("created_at").isoformat()
                            if exec.get("created_at")
                            else None
                        ),
                        "status": exec.get("status"),
                    }
                    for exec in executions_data
                ],
            },
            "messages": [
                {
                    "id": msg.get("message_id"),
                    "content": msg.get("content"),
                    "role": msg.get("role"),
                    "timestamp": (
                        msg.get("timestamp").isoformat()
                        if msg.get("timestamp")
                        else None
                    ),
                    "metadata": {
                        "frontend_context_uuid": msg.get("frontend_context_uuid"),
                        "source_agent": msg.get("source_agent"),
                    },
                }
                for msg in messages_data
            ],
            "artifacts": artifacts_data,
            "config": {
                "current_config": (
                    {
                        "research_config": config.research_config or {},
                        "model_config": config.model_config or {},
                        "output_config": config.output_config or {},
                        "user_preferences": config.user_preferences or {},
                    }
                    if config
                    else {}
                ),
                "config_history": [],
            },
            "execution_stats": {
                "total_tokens_used": sum(
                    (exec.get("input_tokens", 0) or 0)
                    + (exec.get("output_tokens", 0) or 0)
                    for exec in executions_data
                ),
                "total_cost": sum(
                    exec.get("total_cost", 0) or 0 for exec in executions_data
                ),
                "average_response_time": (
                    sum(exec.get("duration_ms", 0) or 0 for exec in executions_data)
                    / len(executions_data)
                    if executions_data
                    else 0
                ),
                "model_usage_breakdown": {},
            },
            "permissions": {
                "can_modify": True,
                "can_share": True,
                "can_export": True,
                "can_delete": True,
            },
        }

    except Exception as e:
        logger.error(f"获取工作区数据失败: {e}")
        raise HTTPException(status_code=500, detail=str(e))
