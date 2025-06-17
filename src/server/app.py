# Copyright (c) 2025 YADRA


import base64
import json
import logging
import os
from typing import Annotated, List, cast, Optional
from uuid import uuid4
import sys

from fastapi import FastAPI, HTTPException, Query, Depends, Header
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import Response, StreamingResponse
from langchain_core.messages import AIMessageChunk, ToolMessage, BaseMessage
from langgraph.types import Command

from src.config.report_style import ReportStyle
from src.config.tools import SELECTED_RAG_PROVIDER
from src.graph.async_builder import create_graph, cleanup_async_resources
from src.podcast.graph.builder import build_graph as build_podcast_graph
from src.ppt.graph.builder import build_graph as build_ppt_graph
from src.prose.graph.builder import build_graph as build_prose_graph
from src.prompt_enhancer.graph.builder import build_graph as build_prompt_enhancer_graph
from src.rag.builder import build_retriever
from src.rag.retriever import Resource
from src.server.chat_request import (
    ChatRequest,
    EnhancePromptRequest,
    GeneratePodcastRequest,
    GeneratePPTRequest,
    GenerateProseRequest,
    TTSRequest,
)
from src.server.mcp_request import MCPServerMetadataRequest, MCPServerMetadataResponse
from src.server.mcp_utils import load_mcp_tools
from src.server.rag_request import (
    RAGConfigResponse,
    RAGResourceRequest,
    RAGResourcesResponse,
)
from src.server.config_request import ConfigResponse
from src.llms.llm import get_configured_llm_models
from src.tools import VolcengineTTS

# Old auth_api imports removed - now using supabase_auth_api

# Import Supabase authentication functions
from src.server.supabase_auth_api import (
    UserSignUpRequest,
    UserSignInRequest,
    UserUpdateRequest,
    UserResponse,
    AuthResponse,
    TaskResponse,
    sign_up_user,
    sign_in_user,
    sign_out_user,
    get_user_info,
    get_current_user,
    get_current_user_email,
    get_user_tasks,
    create_or_update_task,
    setup_user_tables,
    update_user_profile,
)

# 添加日志导入
from src.utils.logger import setup_logging, app_logger

logger = logging.getLogger(__name__)

INTERNAL_SERVER_ERROR_DETAIL = "Internal Server Error"

app = FastAPI(
    title="YADRA API",
    description="API for YADRA",
    version="0.1.0",
)

# Add CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Allows all origins
    allow_credentials=True,
    allow_methods=["*"],  # Allows all methods
    allow_headers=["*"],  # Allows all headers
)

# Cache the graph instance
_graph_instance = None


async def get_graph_instance():
    """Get or create the graph instance."""
    global _graph_instance
    if _graph_instance is None:
        _graph_instance = await create_graph()
    return _graph_instance


# Import and include checkpoint router
# TODO: Fix circular import issue
# from src.server.checkpoint_api import router as checkpoint_router
# app.include_router(checkpoint_router)


@app.post("/api/chat/stream")
async def chat_stream(
    request: ChatRequest, authorization: Optional[str] = Header(None)
):
    # 尝试获取当前用户，但不强制要求
    current_user = None
    if authorization:
        try:
            current_user = await get_current_user(authorization)
        except:
            # 如果认证失败，仍然允许匿名访问
            pass

    # 后端生成 thread_id
    thread_id = request.thread_id
    if thread_id == "__default__" or not thread_id:
        thread_id = str(uuid4())

    # 如果有用户登录，创建或更新任务记录
    if current_user:
        await create_or_update_task(current_user["user_id"], thread_id)

    # Get graph instance
    graph_instance = await get_graph_instance()

    async def stream_response():
        """Stream response."""
        # 首先发送 thread_id 事件
        yield _make_event("thread_created", {"thread_id": thread_id})

        # Stream the workflow
        async for event in _astream_workflow_generator(
            graph_instance,
            request.model_dump()["messages"],
            thread_id,
            request.resources,
            request.max_plan_iterations,
            request.max_step_num,
            request.max_search_results,
            request.auto_accepted_plan,
            request.interrupt_feedback,
            request.mcp_settings,
            request.enable_background_investigation,
            request.report_style,
            request.enable_deep_thinking,
            user_id=current_user["user_id"] if current_user else None,
        ):
            yield event

    return StreamingResponse(
        stream_response(),
        media_type="text/event-stream",
    )


async def _astream_workflow_generator(
    graph_instance,
    messages: List[dict],
    thread_id: str,
    resources: List[Resource],
    max_plan_iterations: int,
    max_step_num: int,
    max_search_results: int,
    auto_accepted_plan: bool,
    interrupt_feedback: str,
    mcp_settings: dict,
    enable_background_investigation: bool,
    report_style: ReportStyle,
    enable_deep_thinking: bool,
    user_id: Optional[str] = None,
):
    input_ = {
        "messages": messages,
        "plan_iterations": 0,
        "final_report": "",
        "current_plan": None,
        "observations": [],
        "auto_accepted_plan": auto_accepted_plan,
        "enable_background_investigation": enable_background_investigation,
        "research_topic": messages[-1]["content"] if messages else "",
    }
    if not auto_accepted_plan and interrupt_feedback:
        resume_msg = f"[{interrupt_feedback}]"
        # add the last message to the resume message
        if messages:
            resume_msg += f" {messages[-1]['content']}"
        input_ = Command(resume=resume_msg)

    # Use configurable for thread_id
    config = {
        "configurable": {
            "thread_id": thread_id,
        },
        "resources": resources,
        "max_plan_iterations": max_plan_iterations,
        "max_step_num": max_step_num,
        "max_search_results": max_search_results,
        "mcp_settings": mcp_settings,
        "report_style": report_style.value,
        "enable_deep_thinking": enable_deep_thinking,
    }

    async for agent, _, event_data in graph_instance.astream(
        input_,
        config=config,
        stream_mode=["messages", "updates"],
        subgraphs=True,
    ):
        if isinstance(event_data, dict):
            if "__interrupt__" in event_data:
                interrupt_data = event_data["__interrupt__"][0]
                interrupt_value = interrupt_data.value

                # 检查是否是reask类型的interrupt
                if (
                    isinstance(interrupt_value, tuple)
                    and len(interrupt_value) == 2
                    and interrupt_value[0] == "reask"
                ):
                    # 处理reask interrupt
                    original_input = interrupt_value[1]
                    yield _make_event(
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
                            {"text": "Edit plan", "value": "edit_plan"},
                            {"text": "Start research", "value": "accepted"},
                            {
                                "text": "Generate report now",
                                "value": "skip_research",
                            },
                            {"text": "Cancel plan", "value": "cancel"},
                        ]

                    yield _make_event(
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
            continue
        message_chunk, message_metadata = cast(
            tuple[BaseMessage, dict[str, any]], event_data
        )
        event_stream_message: dict[str, any] = {
            "thread_id": thread_id,
            "agent": agent[0].split(":")[0],
            "id": message_chunk.id,
            "role": "assistant",
            "content": message_chunk.content,
        }
        if message_chunk.additional_kwargs.get("reasoning_content"):
            event_stream_message["reasoning_content"] = message_chunk.additional_kwargs[
                "reasoning_content"
            ]
        if message_chunk.response_metadata.get("finish_reason"):
            event_stream_message["finish_reason"] = message_chunk.response_metadata.get(
                "finish_reason"
            )
        if isinstance(message_chunk, ToolMessage):
            # Tool Message - Return the result of the tool call
            event_stream_message["tool_call_id"] = message_chunk.tool_call_id
            yield _make_event("tool_call_result", event_stream_message)
        elif isinstance(message_chunk, AIMessageChunk):
            # AI Message - Raw message tokens
            if message_chunk.tool_calls:
                # AI Message - Tool Call
                event_stream_message["tool_calls"] = message_chunk.tool_calls
                event_stream_message["tool_call_chunks"] = (
                    message_chunk.tool_call_chunks
                )
                yield _make_event("tool_calls", event_stream_message)
            elif message_chunk.tool_call_chunks:
                # AI Message - Tool Call Chunks
                event_stream_message["tool_call_chunks"] = (
                    message_chunk.tool_call_chunks
                )
                yield _make_event("tool_call_chunks", event_stream_message)
            else:
                # AI Message - Raw message tokens
                yield _make_event("message_chunk", event_stream_message)

    # 添加流式响应结束标志
    yield _make_event("done", {"thread_id": thread_id, "status": "completed"})


def _make_event(event_type: str, data: dict[str, any]):
    if data.get("content") == "":
        data.pop("content")
    return f"event: {event_type}\ndata: {json.dumps(data, ensure_ascii=False)}\n\n"


@app.post("/api/tts")
async def text_to_speech(request: TTSRequest):
    """Convert text to speech using volcengine TTS API."""
    try:
        app_id = os.getenv("VOLCENGINE_TTS_APPID", "")
        if not app_id:
            raise HTTPException(
                status_code=400, detail="VOLCENGINE_TTS_APPID is not set"
            )
        access_token = os.getenv("VOLCENGINE_TTS_ACCESS_TOKEN", "")
        if not access_token:
            raise HTTPException(
                status_code=400, detail="VOLCENGINE_TTS_ACCESS_TOKEN is not set"
            )
        cluster = os.getenv("VOLCENGINE_TTS_CLUSTER", "volcano_tts")
        voice_type = os.getenv("VOLCENGINE_TTS_VOICE_TYPE", "BV700_V2_streaming")

        tts_client = VolcengineTTS(
            appid=app_id,
            access_token=access_token,
            cluster=cluster,
            voice_type=voice_type,
        )
        # Call the TTS API
        result = tts_client.text_to_speech(
            text=request.text[:1024],
            encoding=request.encoding,
            speed_ratio=request.speed_ratio,
            volume_ratio=request.volume_ratio,
            pitch_ratio=request.pitch_ratio,
            text_type=request.text_type,
            with_frontend=request.with_frontend,
            frontend_type=request.frontend_type,
        )

        if not result["success"]:
            raise HTTPException(status_code=500, detail=str(result["error"]))

        # Decode the base64 audio data
        audio_data = base64.b64decode(result["audio_data"])

        # Return the audio file
        return Response(
            content=audio_data,
            media_type=f"audio/{request.encoding}",
            headers={
                "Content-Disposition": (
                    f"attachment; filename=tts_output.{request.encoding}"
                )
            },
        )
    except Exception as e:
        logger.exception(f"Error in TTS endpoint: {str(e)}")
        raise HTTPException(status_code=500, detail=INTERNAL_SERVER_ERROR_DETAIL)


@app.post("/api/podcast/generate")
async def generate_podcast(request: GeneratePodcastRequest):
    try:
        report_content = request.content
        print(report_content)
        workflow = build_podcast_graph()
        final_state = workflow.invoke({"input": report_content})
        audio_bytes = final_state["output"]
        return Response(content=audio_bytes, media_type="audio/mp3")
    except Exception as e:
        logger.exception(f"Error occurred during podcast generation: {str(e)}")
        raise HTTPException(status_code=500, detail=INTERNAL_SERVER_ERROR_DETAIL)


@app.post("/api/ppt/generate")
async def generate_ppt(request: GeneratePPTRequest):
    try:
        report_content = request.content
        print(report_content)
        workflow = build_ppt_graph()
        final_state = workflow.invoke({"input": report_content})
        generated_file_path = final_state["generated_file_path"]
        with open(generated_file_path, "rb") as f:
            ppt_bytes = f.read()
        return Response(
            content=ppt_bytes,
            media_type="application/vnd.openxmlformats-officedocument.presentationml.presentation",
        )
    except Exception as e:
        logger.exception(f"Error occurred during ppt generation: {str(e)}")
        raise HTTPException(status_code=500, detail=INTERNAL_SERVER_ERROR_DETAIL)


@app.post("/api/prose/generate")
async def generate_prose(request: GenerateProseRequest):
    try:
        sanitized_prompt = request.prompt.replace("\r\n", "").replace("\n", "")
        logger.info(f"Generating prose for prompt: {sanitized_prompt}")
        workflow = build_prose_graph()
        events = workflow.astream(
            {
                "content": request.prompt,
                "option": request.option,
                "command": request.command,
            },
            stream_mode="messages",
            subgraphs=True,
        )
        return StreamingResponse(
            (f"data: {event[0].content}\n\n" async for _, event in events),
            media_type="text/event-stream",
        )
    except Exception as e:
        logger.exception(f"Error occurred during prose generation: {str(e)}")
        raise HTTPException(status_code=500, detail=INTERNAL_SERVER_ERROR_DETAIL)


@app.post("/api/prompt/enhance")
async def enhance_prompt(request: EnhancePromptRequest):
    try:
        sanitized_prompt = request.prompt.replace("\r\n", "").replace("\n", "")
        logger.info(f"Enhancing prompt: {sanitized_prompt}")

        # Convert string report_style to ReportStyle enum
        report_style = None
        if request.report_style:
            try:
                # Handle both uppercase and lowercase input
                style_mapping = {
                    "ACADEMIC": ReportStyle.ACADEMIC,
                    "POPULAR_SCIENCE": ReportStyle.POPULAR_SCIENCE,
                    "NEWS": ReportStyle.NEWS,
                    "SOCIAL_MEDIA": ReportStyle.SOCIAL_MEDIA,
                    "academic": ReportStyle.ACADEMIC,
                    "popular_science": ReportStyle.POPULAR_SCIENCE,
                    "news": ReportStyle.NEWS,
                    "social_media": ReportStyle.SOCIAL_MEDIA,
                }
                report_style = style_mapping.get(
                    request.report_style, ReportStyle.ACADEMIC
                )
            except Exception:
                # If invalid style, default to ACADEMIC
                report_style = ReportStyle.ACADEMIC
        else:
            report_style = ReportStyle.ACADEMIC

        workflow = build_prompt_enhancer_graph()
        final_state = workflow.invoke(
            {
                "prompt": request.prompt,
                "context": request.context,
                "report_style": report_style,
            }
        )
        return {"result": final_state["output"]}
    except Exception as e:
        logger.exception(f"Error occurred during prompt enhancement: {str(e)}")
        raise HTTPException(status_code=500, detail=INTERNAL_SERVER_ERROR_DETAIL)


@app.post("/api/mcp/server/metadata", response_model=MCPServerMetadataResponse)
async def mcp_server_metadata(request: MCPServerMetadataRequest):
    """Get information about an MCP server."""
    try:
        # Set default timeout with a longer value for this endpoint
        timeout = 300  # Default to 300 seconds for this endpoint

        # Use custom timeout from request if provided
        if request.timeout_seconds is not None:
            timeout = request.timeout_seconds

        # Load tools from the MCP server using the utility function
        tools = await load_mcp_tools(
            server_type=request.transport,
            command=request.command,
            args=request.args,
            url=request.url,
            env=request.env,
            timeout_seconds=timeout,
        )

        # Create the response with tools
        response = MCPServerMetadataResponse(
            transport=request.transport,
            command=request.command,
            args=request.args,
            url=request.url,
            env=request.env,
            tools=tools,
        )

        return response
    except Exception as e:
        if not isinstance(e, HTTPException):
            logger.exception(f"Error in MCP server metadata endpoint: {str(e)}")
            raise HTTPException(status_code=500, detail=INTERNAL_SERVER_ERROR_DETAIL)
        raise


@app.get("/api/rag/config", response_model=RAGConfigResponse)
async def rag_config():
    """Get the config of the RAG."""
    return RAGConfigResponse(provider=SELECTED_RAG_PROVIDER)


@app.get("/api/rag/resources", response_model=RAGResourcesResponse)
async def rag_resources(request: Annotated[RAGResourceRequest, Query()]):
    """Get the resources of the RAG."""
    retriever = build_retriever()
    if retriever:
        return RAGResourcesResponse(resources=retriever.list_resources(request.query))
    return RAGResourcesResponse(resources=[])


@app.get("/api/config", response_model=ConfigResponse)
async def config():
    """Get the config of the server."""
    return ConfigResponse(
        rag=RAGConfigResponse(provider=SELECTED_RAG_PROVIDER),
        models=get_configured_llm_models(),
    )


# User Authentication API Endpoints
@app.post("/api/auth/register", response_model=AuthResponse)
async def register_user(user_data: UserSignUpRequest):
    """注册新用户 - 使用 Supabase Auth"""
    return await sign_up_user(user_data)


@app.post("/api/auth/login", response_model=AuthResponse)
async def login(login_data: UserSignInRequest):
    """用户登录 - 使用 Supabase Auth"""
    return await sign_in_user(login_data)


@app.post("/api/auth/logout")
async def logout(current_user: dict = Depends(get_current_user)):
    """用户登出"""
    return await sign_out_user(current_user["user"]["access_token"])


@app.get("/api/auth/me", response_model=UserResponse)
async def get_me(current_user: dict = Depends(get_current_user)):
    """获取当前登录用户信息 - 使用 Supabase Auth"""
    return await get_user_info(current_user)


@app.put("/api/auth/me", response_model=UserResponse)
async def update_me(
    update_data: UserUpdateRequest, current_user: dict = Depends(get_current_user)
):
    """更新当前用户信息"""
    return await update_user_profile(current_user["user_id"], update_data)


# Task Management API
@app.get("/api/tasks", response_model=List[TaskResponse])
async def get_tasks(
    status: Optional[str] = Query(
        None, description="Filter by status: active, completed, paused"
    ),
    current_user: dict = Depends(get_current_user),
):
    """获取用户任务列表"""
    return await get_user_tasks(current_user["user_id"], status)


@app.post("/api/tasks/{thread_id}", response_model=TaskResponse)
async def create_task(
    thread_id: str,
    task_name: Optional[str] = None,
    current_user: dict = Depends(get_current_user),
):
    """创建或更新任务"""
    return await create_or_update_task(current_user["user_id"], thread_id, task_name)


# 在应用启动事件中初始化日志
@app.on_event("startup")
async def startup():
    """Server startup event handler."""
    # 初始化日志系统
    setup_logging(log_dir="logs", log_level="INFO")
    app_logger.info("🚀 YADRA Server starting up", 
                   version="1.0.0", 
                   python_version=sys.version)
    
    # 现有的启动逻辑
    await setup_user_tables()
    await get_graph_instance()
    app_logger.info("✅ Server startup complete")


@app.on_event("shutdown")
async def shutdown_event():
    """Shutdown event handler."""
    # Cleanup async resources
    await cleanup_async_resources()

    # Cleanup sync resources
    from src.graph.builder import cleanup_postgres_resources

    cleanup_postgres_resources()

    logger.info("Server shutdown complete")
