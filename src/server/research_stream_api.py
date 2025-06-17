#!/usr/bin/env python3
"""
Research Stream API for YADRA
统一的研究流式接口
"""

import asyncio
import json
import uuid
from datetime import datetime
from typing import Dict, Any, Optional, AsyncGenerator, List
from enum import Enum
from dataclasses import dataclass, asdict
import logging

from fastapi import APIRouter, HTTPException, Depends
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field
from sse_starlette.sse import EventSourceResponse

from src.server.repositories.session_repository import (
    get_session_repository, 
    SessionRepository, 
    ActionType, 
    ExecutionStatus,
    SessionStatus
)

logger = logging.getLogger(__name__)

# 创建路由器
router = APIRouter(prefix="/api/research", tags=["research"])


class ResearchAction(str, Enum):
    """研究操作类型"""
    CREATE = "create"
    CONTINUE = "continue"
    FEEDBACK = "feedback"
    MODIFY = "modify"


class SSEEventType(str, Enum):
    """SSE事件类型"""
    NAVIGATION = "navigation"
    METADATA = "metadata"
    PROGRESS = "progress"
    MESSAGE_CHUNK = "message_chunk"
    ARTIFACT = "artifact"
    COMPLETE = "complete"
    ERROR = "error"


# 请求模型
class ResearchConfig(BaseModel):
    """研究配置"""
    enable_background_investigation: bool = True
    report_style: str = Field(default="academic", pattern="^(academic|popular_science|news|social_media)$")
    enable_deep_thinking: bool = False
    max_research_depth: int = Field(default=3, ge=1, le=10)
    enable_web_search: bool = True


class ModelConfig(BaseModel):
    """模型配置"""
    model_name: str = "claude-3-5-sonnet"
    temperature: float = Field(default=0.7, ge=0.0, le=2.0)
    max_tokens: int = Field(default=4000, ge=100, le=8000)
    top_p: float = Field(default=0.9, ge=0.0, le=1.0)
    provider: str = "anthropic"


class OutputConfig(BaseModel):
    """输出配置"""
    language: str = Field(default="zhCN", pattern="^(zhCN|enUS)$")
    output_format: str = Field(default="markdown", pattern="^(markdown|html|plain)$")
    include_citations: bool = True
    include_artifacts: bool = True


class UserPreferences(BaseModel):
    """用户偏好"""
    writing_style: str = "professional"
    expertise_level: str = Field(default="intermediate", pattern="^(beginner|intermediate|expert)$")
    preferred_sources: List[str] = []


class ContextInfo(BaseModel):
    """上下文信息"""
    previous_artifacts: List[str] = []
    related_context: str = ""
    user_feedback_history: List[str] = []


class ResearchStreamRequest(BaseModel):
    """研究流式请求"""
    action: ResearchAction
    message: str = Field(..., min_length=1, max_length=5000)
    url_param: Optional[str] = None  # create时为空，其他操作时必填
    
    # 前端ID体系
    frontend_uuid: str = Field(..., pattern=r'^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$')
    frontend_context_uuid: str = Field(..., pattern=r'^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$')
    visitor_id: str = Field(..., pattern=r'^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$')
    user_id: Optional[str] = None
    
    # 配置信息
    config: Dict[str, Any] = Field(default_factory=dict)
    
    # 上下文信息（继续对话时使用）
    context: Optional[ContextInfo] = None


# 响应模型
@dataclass
class NavigationEvent:
    """导航事件"""
    url_param: str
    thread_id: str
    workspace_url: str


@dataclass
class MetadataEvent:
    """元数据事件"""
    execution_id: str
    config_used: Dict[str, Any]
    model_info: Dict[str, Any]
    estimated_duration: int
    start_time: str


@dataclass
class ProgressEvent:
    """进度事件"""
    current_step: str
    progress_percentage: int
    status_message: str
    steps_completed: List[str]
    steps_remaining: List[str]


@dataclass
class MessageChunkEvent:
    """消息块事件"""
    chunk_id: str
    content: str
    chunk_type: str
    metadata: Dict[str, Any]


@dataclass
class ArtifactEvent:
    """Artifact事件"""
    artifact_id: str
    type: str
    title: str
    content: str
    metadata: Dict[str, Any]


@dataclass
class CompleteEvent:
    """完成事件"""
    execution_id: str
    total_duration: int
    tokens_consumed: Dict[str, Any]
    artifacts_generated: List[str]
    final_status: str
    completion_time: str


@dataclass
class ErrorEvent:
    """错误事件"""
    error_code: str
    error_message: str
    retry_after: Optional[int] = None
    suggestions: List[str] = None


class ResearchStreamService:
    """研究流式服务"""
    
    def __init__(self, session_repo: SessionRepository):
        self.session_repo = session_repo
    
    async def process_create_action(
        self, 
        request: ResearchStreamRequest
    ) -> AsyncGenerator[Dict[str, Any], None]:
        """
        处理创建操作
        
        Args:
            request: 请求对象
            
        Yields:
            SSE事件
        """
        try:
            # 生成thread_id
            thread_id = str(uuid.uuid4())
            
            # 解析配置
            research_config = request.config.get("research_config", {})
            model_config = request.config.get("model_config", {})
            output_config = request.config.get("output_config", {})
            user_preferences = request.config.get("user_preferences", {})
            
            # 创建会话
            session, url_param = await self.session_repo.create_session(
                thread_id=thread_id,
                frontend_uuid=request.frontend_uuid,
                visitor_id=request.visitor_id,
                initial_question=request.message,
                user_id=request.user_id,
                research_config=research_config,
                model_config=model_config,
                output_config=output_config,
                user_preferences=user_preferences
            )
            
            # 发送导航事件
            navigation_event = NavigationEvent(
                url_param=url_param,
                thread_id=thread_id,
                workspace_url=f"/workspace/{url_param}"
            )
            yield {
                "event": SSEEventType.NAVIGATION.value,
                "data": json.dumps(asdict(navigation_event))
            }
            
            # 创建执行记录
            execution_record = await self.session_repo.create_execution_record(
                session_id=session.id,
                frontend_context_uuid=request.frontend_context_uuid,
                action_type=ActionType.CREATE,
                user_message=request.message,
                model_used=model_config.get("model_name", "claude-3-5-sonnet"),
                provider=model_config.get("provider", "anthropic")
            )
            
            # 发送元数据事件
            metadata_event = MetadataEvent(
                execution_id=execution_record.execution_id,
                config_used={
                    "research_config": research_config,
                    "model_config": model_config,
                    "output_config": output_config
                },
                model_info={
                    "model_name": model_config.get("model_name", "claude-3-5-sonnet"),
                    "provider": model_config.get("provider", "anthropic"),
                    "version": "latest"
                },
                estimated_duration=120,
                start_time=datetime.now().isoformat()
            )
            yield {
                "event": SSEEventType.METADATA.value,
                "data": json.dumps(asdict(metadata_event))
            }
            
            # 模拟研究过程
            async for event in self._simulate_research_process(execution_record.execution_id):
                yield event
                
        except Exception as e:
            logger.error(f"创建操作失败: {e}")
            error_event = ErrorEvent(
                error_code="CREATE_FAILED",
                error_message=str(e),
                suggestions=["请检查输入参数", "稍后重试"]
            )
            yield {
                "event": SSEEventType.ERROR.value,
                "data": json.dumps(asdict(error_event))
            }
    
    async def process_continue_action(
        self, 
        request: ResearchStreamRequest
    ) -> AsyncGenerator[Dict[str, Any], None]:
        """
        处理继续操作
        
        Args:
            request: 请求对象
            
        Yields:
            SSE事件
        """
        try:
            # 获取会话
            session = await self.session_repo.get_session_by_url_param(request.url_param)
            if not session:
                raise HTTPException(status_code=404, detail="会话不存在")
            
            # 更新活动时间
            await self.session_repo.update_session_activity(session.id)
            
            # 创建执行记录
            execution_record = await self.session_repo.create_execution_record(
                session_id=session.id,
                frontend_context_uuid=request.frontend_context_uuid,
                action_type=ActionType.CONTINUE,
                user_message=request.message
            )
            
            # 发送元数据事件
            metadata_event = MetadataEvent(
                execution_id=execution_record.execution_id,
                config_used=request.config,
                model_info={
                    "model_name": "claude-3-5-sonnet",
                    "provider": "anthropic",
                    "version": "latest"
                },
                estimated_duration=90,
                start_time=datetime.now().isoformat()
            )
            yield {
                "event": SSEEventType.METADATA.value,
                "data": json.dumps(asdict(metadata_event))
            }
            
            # 模拟继续研究过程
            async for event in self._simulate_continue_process(execution_record.execution_id):
                yield event
                
        except Exception as e:
            logger.error(f"继续操作失败: {e}")
            error_event = ErrorEvent(
                error_code="CONTINUE_FAILED",
                error_message=str(e),
                suggestions=["请检查会话状态", "稍后重试"]
            )
            yield {
                "event": SSEEventType.ERROR.value,
                "data": json.dumps(asdict(error_event))
            }
    
    async def _simulate_research_process(
        self, 
        execution_id: str
    ) -> AsyncGenerator[Dict[str, Any], None]:
        """
        模拟研究过程（后续会替换为真实的研究逻辑）
        
        Args:
            execution_id: 执行ID
            
        Yields:
            SSE事件
        """
        steps = [
            ("research_planning", "正在制定研究计划...", 15),
            ("information_gathering", "正在收集相关信息...", 35),
            ("analysis", "正在分析数据...", 60),
            ("synthesis", "正在综合结论...", 85),
            ("report_generation", "正在生成报告...", 100)
        ]
        
        for i, (step, message, progress) in enumerate(steps):
            # 发送进度事件
            progress_event = ProgressEvent(
                current_step=step,
                progress_percentage=progress,
                status_message=message,
                steps_completed=[s[0] for s in steps[:i]],
                steps_remaining=[s[0] for s in steps[i+1:]]
            )
            yield {
                "event": SSEEventType.PROGRESS.value,
                "data": json.dumps(asdict(progress_event))
            }
            
            # 模拟处理时间
            await asyncio.sleep(1)
            
            # 发送消息块
            chunk_event = MessageChunkEvent(
                chunk_id=f"chunk_{i}",
                content=f"正在执行步骤: {message}",
                chunk_type=step,
                metadata={
                    "source": "research_agent",
                    "confidence": 0.9
                }
            )
            yield {
                "event": SSEEventType.MESSAGE_CHUNK.value,
                "data": json.dumps(asdict(chunk_event))
            }
        
        # 发送artifact事件
        artifact_event = ArtifactEvent(
            artifact_id=str(uuid.uuid4()),
            type="research_plan",
            title="研究计划",
            content="这是一个示例研究计划...",
            metadata={
                "created_at": datetime.now().isoformat(),
                "source_agent": "planner"
            }
        )
        yield {
            "event": SSEEventType.ARTIFACT.value,
            "data": json.dumps(asdict(artifact_event))
        }
        
        # 发送完成事件
        complete_event = CompleteEvent(
            execution_id=execution_id,
            total_duration=5000,
            tokens_consumed={
                "input_tokens": 1250,
                "output_tokens": 3420,
                "total_cost": 0.0234
            },
            artifacts_generated=[artifact_event.artifact_id],
            final_status="success",
            completion_time=datetime.now().isoformat()
        )
        yield {
            "event": SSEEventType.COMPLETE.value,
            "data": json.dumps(asdict(complete_event))
        }
    
    async def _simulate_continue_process(
        self, 
        execution_id: str
    ) -> AsyncGenerator[Dict[str, Any], None]:
        """
        模拟继续研究过程
        
        Args:
            execution_id: 执行ID
            
        Yields:
            SSE事件
        """
        # 发送进度事件
        progress_event = ProgressEvent(
            current_step="continue_analysis",
            progress_percentage=50,
            status_message="正在继续分析...",
            steps_completed=["context_loading"],
            steps_remaining=["analysis", "response_generation"]
        )
        yield {
            "event": SSEEventType.PROGRESS.value,
            "data": json.dumps(asdict(progress_event))
        }
        
        await asyncio.sleep(2)
        
        # 发送消息块
        chunk_event = MessageChunkEvent(
            chunk_id="continue_chunk_1",
            content="基于之前的分析，我将继续深入探讨...",
            chunk_type="continue",
            metadata={
                "source": "research_agent",
                "confidence": 0.95
            }
        )
        yield {
            "event": SSEEventType.MESSAGE_CHUNK.value,
            "data": json.dumps(asdict(chunk_event))
        }
        
        # 发送完成事件
        complete_event = CompleteEvent(
            execution_id=execution_id,
            total_duration=2000,
            tokens_consumed={
                "input_tokens": 800,
                "output_tokens": 1200,
                "total_cost": 0.0156
            },
            artifacts_generated=[],
            final_status="success",
            completion_time=datetime.now().isoformat()
        )
        yield {
            "event": SSEEventType.COMPLETE.value,
            "data": json.dumps(asdict(complete_event))
        }


# 依赖注入
async def get_session_repository() -> SessionRepository:
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
    session_repo: SessionRepository = Depends(get_session_repository)
):
    """
    统一研究流式接口
    
    Args:
        request: 研究请求
        session_repo: 会话仓库
        
    Returns:
        SSE流响应
    """
    service = ResearchStreamService(session_repo)
    
    async def event_generator():
        """事件生成器"""
        try:
            if request.action == ResearchAction.CREATE:
                async for event in service.process_create_action(request):
                    yield f"event: {event['event']}\ndata: {event['data']}\n\n"
            
            elif request.action == ResearchAction.CONTINUE:
                if not request.url_param:
                    raise HTTPException(status_code=400, detail="继续操作需要url_param")
                async for event in service.process_continue_action(request):
                    yield f"event: {event['event']}\ndata: {event['data']}\n\n"
            
            elif request.action == ResearchAction.FEEDBACK:
                # TODO: 实现反馈处理逻辑
                error_event = ErrorEvent(
                    error_code="NOT_IMPLEMENTED",
                    error_message="反馈功能暂未实现",
                    suggestions=["请使用其他操作类型"]
                )
                yield f"event: {SSEEventType.ERROR.value}\ndata: {json.dumps(asdict(error_event))}\n\n"
            
            elif request.action == ResearchAction.MODIFY:
                # TODO: 实现修改处理逻辑
                error_event = ErrorEvent(
                    error_code="NOT_IMPLEMENTED",
                    error_message="修改功能暂未实现",
                    suggestions=["请使用其他操作类型"]
                )
                yield f"event: {SSEEventType.ERROR.value}\ndata: {json.dumps(asdict(error_event))}\n\n"
            
        except Exception as e:
            logger.error(f"流式处理错误: {e}")
            error_event = ErrorEvent(
                error_code="STREAM_ERROR",
                error_message=str(e),
                suggestions=["请检查请求参数", "稍后重试"]
            )
            yield f"event: {SSEEventType.ERROR.value}\ndata: {json.dumps(asdict(error_event))}\n\n"
    
    return EventSourceResponse(event_generator())


@router.get("/workspace/{url_param}")
async def get_workspace_data(
    url_param: str,
    session_repo: SessionRepository = Depends(get_session_repository)
):
    """
    获取workspace数据
    
    Args:
        url_param: URL参数
        session_repo: 会话仓库
        
    Returns:
        workspace数据
    """
    try:
        # 获取会话概览
        overview = await session_repo.get_session_overview(url_param)
        if not overview:
            raise HTTPException(status_code=404, detail="会话不存在")
        
        # 获取会话信息
        session = await session_repo.get_session_by_url_param(url_param)
        if not session:
            raise HTTPException(status_code=404, detail="会话不存在")
        
        # 获取配置
        config = await session_repo.get_session_config(session.id)
        
        # 构建响应
        response = {
            "thread_id": session.thread_id,
            "url_param": session.url_param,
            "status": session.status.value,
            "session_metadata": {
                "created_at": session.created_at.isoformat() if session.created_at else None,
                "last_updated": session.updated_at.isoformat() if session.updated_at else None,
                "total_interactions": overview.get("total_executions", 0),
                "execution_history": []  # TODO: 实现执行历史
            },
            "messages": [],  # TODO: 实现消息历史
            "artifacts": [],  # TODO: 实现artifacts历史
            "config": {
                "current_config": {
                    "research_config": config.research_config if config else {},
                    "model_config": config.model_config if config else {},
                    "output_config": config.output_config if config else {},
                    "user_preferences": config.user_preferences if config else {}
                },
                "config_history": []  # TODO: 实现配置历史
            },
            "execution_stats": {
                "total_tokens_used": 0,  # TODO: 计算统计
                "total_cost": 0.0,
                "average_response_time": 0,
                "model_usage_breakdown": {}
            },
            "permissions": {
                "can_modify": True,
                "can_share": True,
                "can_export": True,
                "can_delete": True
            }
        }
        
        return response
        
    except Exception as e:
        logger.error(f"获取workspace数据失败: {e}")
        raise HTTPException(status_code=500, detail=str(e)) 