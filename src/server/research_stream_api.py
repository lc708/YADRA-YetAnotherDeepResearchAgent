import json
import uuid
from datetime import datetime
from typing import Dict, Any, Optional, AsyncGenerator, List, cast
from enum import Enum
import logging

from fastapi import APIRouter, HTTPException, Depends
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field

# Import LangGraph related modules
from src.graph.async_builder import create_graph
from src.graph.types import State
from src.utils.url_param_generator import generate_url_param
from src.server.repositories.session_repository import (
    SessionRepository,
    get_session_repository,
)
from src.server.supabase_auth_api import get_current_user

# Import LangChain message types
from langchain_core.messages import BaseMessage, ToolMessage, AIMessageChunk

logger = logging.getLogger(__name__)


# Custom JSON encoder
class CustomJSONEncoder(json.JSONEncoder):
    def default(self, obj):
        if isinstance(obj, uuid.UUID):
            return str(obj)
        if isinstance(obj, datetime):
            return obj.isoformat()
        return super().default(obj)


def safe_json_dumps(obj):
    """Safe JSON serialization"""
    return json.dumps(obj, cls=CustomJSONEncoder, ensure_ascii=False)


# Create router
router = APIRouter(prefix="/api/research", tags=["research"])


# Request model
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


# LangGraph native message types - no longer using custom dataclass
# All events use dictionary format, fully aligned with app.py implementation


class ResearchStreamService:
    """Real research streaming service"""

    def __init__(self, session_repo: SessionRepository):
        self.session_repo = session_repo
        self._graph = None

    async def _get_graph(self):
        """Get or create LangGraph instance"""
        if self._graph is None:
            self._graph = await create_graph()
        return self._graph

    def _get_current_timestamp(self) -> str:
        """Get current timestamp"""
        return datetime.utcnow().isoformat() + "Z"

    def _make_research_event(self, event_type: str, data: dict[str, any]):
        """Construct research event - fully aligned with app.py's _make_event implementation"""
        if data.get("content") == "":
            data.pop("content")
        return {"event": event_type, "data": safe_json_dumps(data)}

    def _create_message_chunk_event(
        self, message: AIMessageChunk, agent: str, thread_id: str, execution_id: str
    ):
        """Create message event based on LangGraph native AIMessageChunk"""
        data = {
            "thread_id": thread_id,
            "agent": agent[0].split(":")[0],  # Extract node name
            "id": message.id,
            "role": "assistant",
            "content": message.content,
            "execution_id": execution_id,
            "timestamp": self._get_current_timestamp(),
        }

        # Fully aligned with app.py: add reasoning_content handling
        if message.additional_kwargs.get("reasoning_content"):
            data["reasoning_content"] = message.additional_kwargs["reasoning_content"]

        # Fully aligned with app.py: add finish_reason handling
        if message.response_metadata.get("finish_reason"):
            data["finish_reason"] = message.response_metadata.get("finish_reason")

        # Fully aligned with app.py: add metadata handling
        data["metadata"] = {
            "additional_kwargs": message.additional_kwargs,
            "response_metadata": message.response_metadata,
        }

        return self._make_research_event("message_chunk", data)

    def _create_tool_calls_event(
        self, message: AIMessageChunk, agent: str, thread_id: str, execution_id: str
    ):
        """Create tool call event"""
        data = {
            "thread_id": thread_id,
            "agent": agent[0].split(":")[0],
            "id": message.id,
            "role": "assistant",
            "content": message.content,
            "tool_calls": message.tool_calls,
            "tool_call_chunks": getattr(message, "tool_call_chunks", []),
            "execution_id": execution_id,
            "timestamp": self._get_current_timestamp(),
        }

        # Fully aligned with app.py: add reasoning_content handling
        if message.additional_kwargs.get("reasoning_content"):
            data["reasoning_content"] = message.additional_kwargs["reasoning_content"]

        # 🔥 完全对齐app.py：添加finish_reason处理
        if message.response_metadata.get("finish_reason"):
            data["finish_reason"] = message.response_metadata.get("finish_reason")

        return self._make_research_event("tool_calls", data)

    def _create_tool_call_chunks_event(
        self, message: AIMessageChunk, agent: str, thread_id: str, execution_id: str
    ):
        """Create tool call chunks event - new: fully aligned with app.py"""
        data = {
            "thread_id": thread_id,
            "agent": agent[0].split(":")[0],
            "id": message.id,
            "role": "assistant",
            "content": message.content,
            "tool_call_chunks": getattr(message, "tool_call_chunks", []),
            "execution_id": execution_id,
            "timestamp": self._get_current_timestamp(),
        }

        # 🔥 完全对齐app.py：添加reasoning_content处理
        if message.additional_kwargs.get("reasoning_content"):
            data["reasoning_content"] = message.additional_kwargs["reasoning_content"]

        # Fully aligned with app.py: add finish_reason handling
        if message.response_metadata.get("finish_reason"):
            data["finish_reason"] = message.response_metadata.get("finish_reason")

        return self._make_research_event("tool_call_chunks", data)

    def _create_tool_message_event(
        self, message: ToolMessage, agent: str, thread_id: str, execution_id: str
    ):
        """Create tool result event"""
        data = {
            "thread_id": thread_id,
            "agent": agent[0].split(":")[0],
            "id": message.id,
            "role": "assistant",
            "content": message.content,
            "tool_call_id": message.tool_call_id,
            "execution_id": execution_id,
            "timestamp": self._get_current_timestamp(),
        }

        # Fully aligned with app.py: add finish_reason handling (although ToolMessage usually doesn't have response_metadata, keep consistency)
        if hasattr(message, "response_metadata") and message.response_metadata.get(
            "finish_reason"
        ):
            data["finish_reason"] = message.response_metadata.get("finish_reason")

        return self._make_research_event("tool_call_result", data)

    async def _process_langgraph_stream(
        self,
        graph,
        initial_state: Dict[str, Any],
        thread_id: str,
        execution_id: str,
        request: ResearchStreamRequest,
        execution_type: str = "continue",
    ) -> AsyncGenerator[Dict[str, str], None]:
        """Process LangGraph streaming execution - simplified implementation, fully aligned with app.py"""

        # Get session information for database saving
        session = await self.session_repo.get_session_by_thread_id(thread_id)
        if not session:
            raise ValueError(f"Session not found for thread_id: {thread_id}")

        start_time = datetime.utcnow()

        try:
            # Send start event
            yield self._make_research_event(
                "metadata",
                {
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
                                "model_name", "claude-haiku-4-5"
                            )
                        ),
                        "provider": (
                            request.config.get("model_config", {}).get(
                                "provider", "anthropic"
                            )
                        ),
                        "version": "4.5",
                    },
                    "estimated_duration": 120,
                    "start_time": start_time.isoformat() + "Z",
                    "execution_type": execution_type,
                    "timestamp": self._get_current_timestamp(),
                },
            )

            # Execute LangGraph workflow - fully aligned with app.py implementation
            # Parse configuration parameters - consistent with app.py
            if "research_config" in request.config:
                research_config = request.config["research_config"]
            else:
                # Extract research-related configuration from flattened config
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
            mcp_settings = request.config.get("mcp_settings", {})

            # Build complete config - consistent with app.py structure
            config = {
                "configurable": {
                    "thread_id": thread_id,
                    "resources": [],  # TODO: get resources from session
                    "max_plan_iterations": research_config.get(
                        "max_plan_iterations", 3
                    ),
                    "max_step_num": research_config.get("max_step_num", 5),
                    "max_search_results": research_config.get("max_search_results", 5),
                    "mcp_settings": mcp_settings,
                    "report_style": research_config.get("report_style", "academic"),
                    "enable_deep_thinking": research_config.get(
                        "enable_deep_thinking", False
                    ),
                }
            }

            async for agent, _, event_data in graph.astream(
                initial_state,
                config,
                stream_mode=["messages", "updates"],
                subgraphs=True,
            ):
                # Process LangGraph native message events - fully aligned with app.py logic
                if not isinstance(event_data, dict):
                    message_chunk, message_metadata = cast(
                        tuple[BaseMessage, dict], event_data
                    )

                    # Fully aligned with app.py: use LangGraph native type judgment
                    if isinstance(message_chunk, ToolMessage):
                        # Tool Message - Return the result of the tool call
                        yield self._create_tool_message_event(
                            message_chunk, agent, thread_id, execution_id
                        )
                    elif isinstance(message_chunk, AIMessageChunk):
                        # AI Message - Raw message tokens
                        if message_chunk.tool_calls:
                            # AI Message - Tool Call
                            yield self._create_tool_calls_event(
                                message_chunk, agent, thread_id, execution_id
                            )
                        elif message_chunk.tool_call_chunks:
                            # AI Message - Tool Call Chunks
                            yield self._create_tool_call_chunks_event(
                                message_chunk, agent, thread_id, execution_id
                            )
                        else:
                            # AI Message - Raw message tokens
                            yield self._create_message_chunk_event(
                                message_chunk, agent, thread_id, execution_id
                            )
                    continue

                # Process updates events (interrupt, etc.)
                if isinstance(event_data, dict):
                    if "__interrupt__" in event_data:
                        # Process interrupt events (fully aligned with app.py implementation)
                        interrupt_data = event_data["__interrupt__"][0]
                        interrupt_value = interrupt_data.value

                        logger.info(f"Received interrupt event: {interrupt_value}")

                        # Check if it is a reask type of interrupt
                        if (
                            isinstance(interrupt_value, tuple)
                            and len(interrupt_value) == 2
                            and interrupt_value[0] == "reask"
                        ):
                            # Process reask interrupt
                            original_input = interrupt_value[1]
                            yield self._make_research_event(
                                "reask",
                                {
                                    "thread_id": thread_id,
                                    "id": interrupt_data.ns[0],
                                    "role": "assistant",
                                    "content": "正在恢复原始输入状态...",
                                    "finish_reason": "reask",
                                    "original_input": original_input,
                                },
                            )
                        else:
                            # Process standard interrupt
                            if (
                                isinstance(interrupt_value, dict)
                                and "options" in interrupt_value
                            ):
                                message_content = interrupt_value.get(
                                    "message", "Please Review the Plan."
                                )
                                options = interrupt_value.get("options", [])
                            else:
                                # Compatible with old format
                                message_content = str(interrupt_value)
                                options = [
                                    {"text": "开始研究", "value": "accepted"},
                                    {"text": "编辑计划", "value": "edit_plan"},
                                    {"text": "立即生成报告", "value": "skip_research"},
                                    {"text": "重新提问", "value": "reask"},
                                ]

                            yield self._make_research_event(
                                "interrupt",
                                {
                                    "thread_id": thread_id,
                                    "id": interrupt_data.ns[0],
                                    "role": "assistant",
                                    "content": message_content,
                                    "finish_reason": "interrupt",
                                    "options": options,
                                },
                            )

                        # After interrupt, do not send complete event, wait for user feedback
                        logger.info(f"Interrupt sent, waiting for user feedback")
                        return

            # Check if it is truly completed
            try:
                current_state = await graph.aget_state(config)
                duration_ms = int(
                    (datetime.utcnow() - start_time).total_seconds() * 1000
                )

                # Send complete event
                yield self._make_research_event(
                    "complete",
                    {
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
                    },
                )

            except Exception as state_error:
                logger.warning(f"⚠️ Unable to get LangGraph state: {state_error}")

        except Exception as e:
            logger.error(f"LangGraph execution error: {e}")
            yield self._make_research_event(
                "error",
                {
                    "error_code": "LANGGRAPH_EXECUTION_ERROR",
                    "error_message": str(e),
                    "error_details": {"traceback": str(e)},
                    "thread_id": thread_id,
                    "execution_id": execution_id,
                    "retry_after": None,
                    "suggestions": ["Check configuration", "Retry request"],
                    "timestamp": self._get_current_timestamp(),
                },
            )

    async def create_research_stream(
        self,
        request: ResearchStreamRequest,
        existing_session_id: Optional[int] = None,
        existing_thread_id: Optional[str] = None,
    ) -> AsyncGenerator[Dict[str, str], None]:
        """Create new research stream"""
        try:
            # Parse configuration - support new and old formats
            # If there is a research_config field, use it; otherwise, extract from flattened config
            if "research_config" in request.config:
                research_config = request.config["research_config"]
            else:
                # Extract research-related configuration from flattened config
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

            # Based on whether there is an existing session, decide to create or reuse
            if existing_session_id and existing_thread_id:
                # Use existing session, avoid duplicate creation
                thread_id = existing_thread_id
                # Get session information by thread_id
                session_data = await self.session_repo.get_session_by_thread_id(
                    existing_thread_id
                )
                if not session_data:
                    raise HTTPException(status_code=404, detail="Session does not exist")
                url_param = session_data.url_param
                logger.info(
                    f"Using existing session: {existing_session_id}, thread_id: {thread_id}"
                )
            else:
                # Create new session (original logic)
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

            # Create execution record
            execution_record = await self.session_repo.create_execution_record(
                session_id=session_data.id,
                frontend_context_uuid=request.frontend_context_uuid,
                action_type=ActionType.CREATE,
                user_message=request.message,
            )
            execution_id = execution_record.execution_id

            # Remove duplicate navigation event sending
            # research_create_api has already sent the navigation event containing session_id
            # Here we do not send it again to avoid duplicate navigation events

            # Prepare LangGraph initial state
            initial_state = {
                "messages": [{"role": "user", "content": request.message}],
                "research_topic": request.message,
                "locale": output_config.get("language", "zh-CN"),
                "auto_accepted_plan": research_config.get(
                    "auto_accepted_plan", False
                ),  # User configurable, default to confirm
                "enable_background_investigation": research_config.get(
                    "enable_background_investigation", True
                ),
                "plan_iterations": 0,
            }

            # Get LangGraph instance
            graph = await self._get_graph()

            # Process LangGraph streaming execution - directly execute, no need to pre-create checkpoint
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
            logger.error(f"Create research stream failed: {e}")
            yield self._make_research_event(
                "error",
                {
                    "error_code": "CREATE_STREAM_ERROR",
                    "error_message": str(e),
                    "error_details": {"error_type": type(e).__name__},
                    "thread_id": "",
                    "execution_id": "",
                    "retry_after": 30,
                    "suggestions": ["Check request parameters", "Retry later"],
                    "timestamp": self._get_current_timestamp(),
                },
            )

    async def continue_research_stream(
        self, request: ResearchStreamRequest
    ) -> AsyncGenerator[Dict[str, str], None]:
        """Continue existing research stream - simplified implementation"""
        try:
            # Get thread_id
            thread_id = request.thread_id
            if not thread_id and request.url_param:
                session = await self.session_repo.get_session_by_url_param(
                    request.url_param
                )
                if not session:
                    raise HTTPException(status_code=404, detail="Session does not exist")
                thread_id = session.thread_id

            if not thread_id:
                raise HTTPException(
                    status_code=400, detail="Must provide thread_id or url_param"
                )

            logger.info(f"🔍 Continue research stream for thread_id: {thread_id}")

            # Create execution record
            session = await self.session_repo.get_session_by_thread_id(thread_id)
            if not session:
                raise HTTPException(status_code=404, detail="Session does not exist")

            execution_record = await self.session_repo.create_execution_record(
                session_id=session.id,
                frontend_context_uuid=request.frontend_context_uuid,
                action_type=ActionType.CONTINUE,
                user_message=request.message,
            )
            execution_id = execution_record.execution_id

            # Critical fix: get saved config, not use empty config in request
            session_config = await self.session_repo.get_session_config(session.id)
            if session_config and session_config.research_config:
                # Use config saved in database
                logger.info(
                    f"📋 Using saved config from database: {session_config.research_config}"
                )
                # Merge saved config to request config
                request.config["research_config"] = session_config.research_config
                request.config["model_config"] = session_config.model_config or {}
                request.config["output_config"] = session_config.output_config or {}
                # Also set flattened config (compatible with old format)
                if session_config.research_config:
                    request.config.update(
                        {
                            "auto_accepted_plan": session_config.research_config.get(
                                "auto_accepted_plan", False
                            ),
                            "enableBackgroundInvestigation": (
                                session_config.research_config.get(
                                    "enable_background_investigation", True
                                )
                            ),
                            "reportStyle": session_config.research_config.get(
                                "report_style", "academic"
                            ),
                            "enableDeepThinking": session_config.research_config.get(
                                "enable_deep_thinking", False
                            ),
                            "maxPlanIterations": session_config.research_config.get(
                                "max_plan_iterations", 3
                            ),
                            "maxStepNum": session_config.research_config.get(
                                "max_step_num", 5
                            ),
                            "maxSearchResults": session_config.research_config.get(
                                "max_search_results", 5
                            ),
                        }
                    )
            else:
                logger.warning(
                    f"⚠️ No saved config found for session {session.id}, using defaults"
                )

            # Get LangGraph instance
            graph = await self._get_graph()

            # Critical fix: add interrupt_feedback processing logic (fully aligned with app.py)
            # Get interrupt_feedback
            interrupt_feedback = None
            if request.context and "interrupt_feedback" in request.context:
                interrupt_feedback = request.context["interrupt_feedback"]

            # Construct continue state
            initial_state = {
                "messages": [{"role": "user", "content": request.message}],
                "research_topic": request.message,
                "auto_accepted_plan": False,  # continue scenario default to confirm
            }

            # Critical fix: if there is interrupt_feedback, use Command(resume=...) instead of normal state
            if interrupt_feedback:
                resume_msg = f"[{interrupt_feedback}]"
                if request.message:
                    resume_msg += f" {request.message}"
                from langgraph.types import Command

                initial_state = Command(resume=resume_msg)
                logger.info(
                    f"🔄 Resume with interrupt_feedback: {interrupt_feedback}, resume_msg: {resume_msg}"
                )

            # Process LangGraph streaming execution
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
            yield self._make_research_event(
                "error",
                {
                    "error_code": "CONTINUE_STREAM_ERROR",
                    "error_message": str(e),
                    "error_details": {"error_type": type(e).__name__},
                    "thread_id": request.thread_id or "",
                    "execution_id": "",
                    "retry_after": 30,
                    "suggestions": ["Check thread_id", "Confirm session exists", "Retry later"],
                    "timestamp": self._get_current_timestamp(),
                },
            )


# Dependency injection
async def get_session_repository_dependency() -> SessionRepository:
    """Get SessionRepository dependency"""
    import os
    from dotenv import load_dotenv

    load_dotenv()
    db_url = os.getenv("DATABASE_URL")
    if not db_url:
        raise HTTPException(status_code=500, detail="Database configuration error")

    return get_session_repository(db_url)


# API Endpoint
@router.post("/stream")
async def research_stream(
    request: ResearchStreamRequest,
    current_user: dict = Depends(get_current_user),  # 👈 Add forced authentication
    session_repo: SessionRepository = Depends(get_session_repository_dependency),
):
    """Uniform research streaming interface"""
    # 👈 Inject user ID to request
    request.user_id = current_user["user_id"]

    service = ResearchStreamService(session_repo)

    if request.action == ActionType.CREATE:
        event_generator = service.create_research_stream(request)
    else:
        event_generator = service.continue_research_stream(request)

    async def stream_events():
        async for event in event_generator:
            # SSE format
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
    """Get workspace status interface"""
    try:
        # Get session information by url_param
        session = await session_repo.get_session_by_url_param(url_param)
        if not session:
            raise HTTPException(status_code=404, detail="Session does not exist")

        # Get message history
        messages_data = await session_repo.get_messages_by_session_id(session.id)

        # Get execution records
        executions_data = await session_repo.get_execution_records_by_session_id(
            session.id
        )

        # Get artifacts
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
            logger.error(f"Get artifacts failed: {e}")

        # Get config
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
        logger.error(f"Get workspace data failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))
