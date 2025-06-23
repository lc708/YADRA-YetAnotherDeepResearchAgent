import json
import uuid
from datetime import datetime
from typing import Dict, Any, Optional, AsyncGenerator, List, cast
from enum import Enum
import logging

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


# LangGraph原生消息类型 - 不再使用自定义dataclass
# 所有事件都使用字典格式，完全对齐app.py的实现模式


class ResearchStreamService:
    """真实的研究流式服务"""

    def __init__(self, session_repo: SessionRepository):
        self.session_repo = session_repo
        self._graph = None

    async def _get_graph(self):
        """获取或创建LangGraph实例"""
        if self._graph is None:
            self._graph = await create_graph()
        return self._graph

    def _get_current_timestamp(self) -> str:
        """获取当前时间戳"""
        return datetime.utcnow().isoformat() + "Z"

    def _make_research_event(self, event_type: str, data: dict[str, any]):
        """构造研究事件 - 完全参考app.py的_make_event实现"""
        if data.get("content") == "":
            data.pop("content")
        return {
            "event": event_type,
            "data": safe_json_dumps(data)
        }

    def _create_message_chunk_event(self, message: AIMessageChunk, agent: str, thread_id: str, execution_id: str):
        """基于LangGraph原生AIMessageChunk创建消息事件"""
        return self._make_research_event("message_chunk", {
            "thread_id": thread_id,
            "agent": agent.split(":")[0],  # 提取节点名
            "id": message.id,
            "role": "assistant", 
            "content": message.content,
            "finish_reason": message.response_metadata.get("finish_reason"),
            "tool_calls": message.tool_calls,
            "metadata": {
                "additional_kwargs": message.additional_kwargs,
                "response_metadata": message.response_metadata,
            },
            "execution_id": execution_id,
            "timestamp": self._get_current_timestamp(),
        })

    def _create_tool_calls_event(self, message: AIMessageChunk, agent: str, thread_id: str, execution_id: str):
        """创建工具调用事件"""
        return self._make_research_event("tool_calls", {
            "thread_id": thread_id,
            "agent": agent.split(":")[0],
            "id": message.id,
            "role": "assistant",
            "content": message.content,
            "tool_calls": message.tool_calls,
            "tool_call_chunks": getattr(message, "tool_call_chunks", []),
            "execution_id": execution_id,
            "timestamp": self._get_current_timestamp(),
        })

    def _create_tool_message_event(self, message: ToolMessage, agent: str, thread_id: str, execution_id: str):
        """创建工具结果事件"""
        return self._make_research_event("tool_call_result", {
            "thread_id": thread_id,
            "agent": agent.split(":")[0],
            "id": message.id,
            "role": "assistant",
            "content": message.content,
            "tool_call_id": message.tool_call_id,
            "execution_id": execution_id,
            "timestamp": self._get_current_timestamp(),
        })

    async def _process_langgraph_stream(
        self,
        graph,
        initial_state: Dict[str, Any],
        thread_id: str,
        execution_id: str,
        request: ResearchStreamRequest,
        execution_type: str = "continue",
    ) -> AsyncGenerator[Dict[str, str], None]:
        """处理LangGraph流式执行 - 极简化实现，完全参考app.py"""

        # 获取session信息用于数据库保存
        session = await self.session_repo.get_session_by_thread_id(thread_id)
        if not session:
            raise ValueError(f"Session not found for thread_id: {thread_id}")

        start_time = datetime.utcnow()

        try:
            # 发送开始事件
            yield self._make_research_event("metadata", {
                "execution_id": execution_id,
                "thread_id": thread_id,
                "session_id": session.id,
                "frontend_uuid": request.frontend_uuid,
                "frontend_context_uuid": request.frontend_context_uuid,
                "visitor_id": request.visitor_id,
                "user_id": request.user_id,
                "config_used": request.config,
                "model_info": {
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
                "estimated_duration": 120,
                "start_time": start_time.isoformat() + "Z",
                "execution_type": execution_type,
                "timestamp": self._get_current_timestamp(),
            })

            # 执行LangGraph工作流 - 完全参考app.py实现
            config = {"configurable": {"thread_id": thread_id}}

            async for agent, _, event_data in graph.astream(
                initial_state,
                config,
                stream_mode=["messages", "updates"],
                subgraphs=True,
            ):
                # 处理LangGraph原生消息事件
                if not isinstance(event_data, dict):
                    message_chunk, message_metadata = cast(tuple[BaseMessage, dict], event_data)
                    
                    # 使用LangGraph原生类型判断
                    if isinstance(message_chunk, ToolMessage):
                        yield self._create_tool_message_event(message_chunk, agent, thread_id, execution_id)
                    elif isinstance(message_chunk, AIMessageChunk):
                        if message_chunk.tool_calls:
                            yield self._create_tool_calls_event(message_chunk, agent, thread_id, execution_id)
                        else:
                            yield self._create_message_chunk_event(message_chunk, agent, thread_id, execution_id)
                    continue
                
                # 处理updates事件（interrupt等）
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
                            yield self._make_research_event("reask", {
                                "thread_id": thread_id,
                                "id": interrupt_data.ns[0],
                                "role": "assistant",
                                "content": "正在恢复原始输入状态...",
                                "finish_reason": "reask",
                                "original_input": original_input,
                            })
                        else:
                            # 处理标准interrupt
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

                            yield self._make_research_event("interrupt", {
                                "thread_id": thread_id,
                                "id": interrupt_data.ns[0],
                                "role": "assistant",
                                "content": message_content,
                                "finish_reason": "interrupt",
                                "options": options,
                            })

                        # interrupt后不发送complete事件，等待用户反馈
                        logger.info(f"🔄 Interrupt发送完成，等待用户反馈")
                        return

            # 检查是否真正完成
            try:
                current_state = await graph.aget_state(config)
                duration_ms = int((datetime.utcnow() - start_time).total_seconds() * 1000)

                # 发送完成事件
                yield self._make_research_event("complete", {
                    "execution_id": execution_id,
                    "thread_id": thread_id,
                    "total_duration_ms": duration_ms,
                    "tokens_consumed": {"input": 0, "output": 0},
                    "total_cost": 0.0,
                    "artifacts_generated": [],
                    "final_status": "completed",
                    "completion_time": self._get_current_timestamp(),
                    "summary": {"nodes_completed": []},
                    "timestamp": self._get_current_timestamp(),
                })

            except Exception as state_error:
                logger.warning(f"⚠️ 无法获取LangGraph状态: {state_error}")

        except Exception as e:
            logger.error(f"LangGraph执行错误: {e}")
            yield self._make_research_event("error", {
                "error_code": "LANGGRAPH_EXECUTION_ERROR",
                "error_message": str(e),
                "error_details": {"traceback": str(e)},
                "thread_id": thread_id,
                "execution_id": execution_id,
                "retry_after": None,
                "suggestions": ["检查配置", "重试请求"],
                "timestamp": self._get_current_timestamp(),
            })

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
                graph,
                initial_state,
                thread_id,
                execution_id,
                request,
                execution_type="create",
            ):
                yield event

        except Exception as e:
            logger.error(f"创建研究流失败: {e}")
            yield self._make_research_event("error", {
                "error_code": "CREATE_STREAM_ERROR",
                "error_message": str(e),
                "error_details": {"error_type": type(e).__name__},
                "thread_id": "",
                "execution_id": "",
                "retry_after": 30,
                "suggestions": ["检查请求参数", "稍后重试"],
                "timestamp": self._get_current_timestamp(),
            })

    async def continue_research_stream(
        self, request: ResearchStreamRequest
    ) -> AsyncGenerator[Dict[str, str], None]:
        """继续现有的研究流 - 极简化实现"""
        try:
            # 获取thread_id
            thread_id = request.thread_id
            if not thread_id and request.url_param:
                session = await self.session_repo.get_session_by_url_param(request.url_param)
                if not session:
                    raise HTTPException(status_code=404, detail="会话不存在")
                thread_id = session.thread_id

            if not thread_id:
                raise HTTPException(status_code=400, detail="必须提供thread_id或url_param")

            logger.info(f"🔍 Continue research stream for thread_id: {thread_id}")

            # 创建执行记录
            session = await self.session_repo.get_session_by_thread_id(thread_id)
            if not session:
                raise HTTPException(status_code=404, detail="会话不存在")

            execution_record = await self.session_repo.create_execution_record(
                session_id=session.id,
                frontend_context_uuid=request.frontend_context_uuid,
                action_type=ActionType.CONTINUE,
                user_message=request.message,
            )
            execution_id = execution_record.execution_id

            # 获取LangGraph实例
            graph = await self._get_graph()
            
            # 构造continue状态
            initial_state = {
                "messages": [{"role": "user", "content": request.message}],
                "research_topic": request.message,
            }

            # 处理LangGraph流式执行
            async for event in self._process_langgraph_stream(
                graph,
                initial_state,
                thread_id,
                execution_id,
                request,
                execution_type="continue",
            ):
                yield event

        except Exception as e:
            logger.error(f"Continue research stream failed: {e}")
            yield self._make_research_event("error", {
                "error_code": "CONTINUE_STREAM_ERROR",
                "error_message": str(e),
                "error_details": {"error_type": type(e).__name__},
                "thread_id": request.thread_id or "",
                "execution_id": "",
                "retry_after": 30,
                "suggestions": ["检查thread_id", "确认会话存在", "稍后重试"],
                "timestamp": self._get_current_timestamp(),
            })


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
