#!/usr/bin/env python3
"""
Research Ask API - 统一的研究询问接口
支持initial（新建研究）和followup（追问）两种场景
"""

import asyncio
import os
import uuid
from datetime import datetime
from typing import Dict, Any, Optional, Literal
import logging
from dataclasses import dataclass
import json

from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel, Field
from dotenv import load_dotenv

from src.server.repositories.session_repository import (
    SessionRepository, 
    get_session_repository,
    ActionType,
    ExecutionStatus
)
from src.utils.logger import get_logger

logger = get_logger("research_ask_api")

# 创建路由器
router = APIRouter(prefix="/api/research", tags=["research"])

# 请求和响应模型
class ResearchAskRequest(BaseModel):
    question: str = Field(..., min_length=1, max_length=2000, description="用户研究问题")
    ask_type: Literal['initial', 'followup'] = Field(..., description="询问类型：initial=新建研究，followup=追问")
    frontend_uuid: str = Field(..., description="前端生成的UUID")
    visitor_id: str = Field(..., description="访客ID")
    user_id: Optional[str] = Field(None, description="用户ID（可选）")
    config: Optional[Dict[str, Any]] = Field(default_factory=dict, description="配置参数")
    
    # followup场景的必要信息
    session_id: Optional[int] = Field(None, description="followup时必须提供的会话ID")
    thread_id: Optional[str] = Field(None, description="followup时必须提供的线程ID")
    url_param: Optional[str] = Field(None, description="followup时必须提供的URL参数")

class ResearchAskResponse(BaseModel):
    ask_type: str = Field(..., description="询问类型")
    url_param: str = Field(..., description="URL参数")
    frontend_uuid: str = Field(..., description="前端UUID")
    session_id: int = Field(..., description="会话ID")
    thread_id: str = Field(..., description="线程ID")
    workspace_url: str = Field(..., description="工作区URL")
    estimated_duration: int = Field(default=120, description="预估完成时间（秒）")
    created_at: str = Field(..., description="创建时间")

class ResearchAskService:
    """统一的研究询问服务"""
    
    def __init__(self, session_repo: SessionRepository):
        self.session_repo = session_repo

    async def ask_research(self, request: ResearchAskRequest) -> ResearchAskResponse:
        """
        统一的研究询问处理
        根据ask_type分别处理initial和followup场景
        """
        try:
            if request.ask_type == 'initial':
                return await self._handle_initial_ask(request)
            elif request.ask_type == 'followup':
                return await self._handle_followup_ask(request)
            else:
                raise HTTPException(status_code=400, detail=f"不支持的ask_type: {request.ask_type}")
                
        except HTTPException:
            raise
        except Exception as e:
            logger.error(f"研究询问失败: {e}")
            raise HTTPException(status_code=500, detail=f"研究询问失败: {str(e)}")

    async def _handle_initial_ask(self, request: ResearchAskRequest) -> ResearchAskResponse:
        """处理initial场景 - 创建新的研究会话"""
        logger.info(f"Processing initial ask: {request.question[:50]}...")
        
        # 生成新的thread_id
        thread_id = str(uuid.uuid4())
        
        # 解析配置
        research_config, model_config, output_config = self._parse_config(request.config)
        
        # 创建新会话
        session_mapping, url_param = await self.session_repo.create_session(
            thread_id=thread_id,
            frontend_uuid=request.frontend_uuid,
            visitor_id=request.visitor_id,
            user_id=request.user_id,
            initial_question=request.question,
            research_config=research_config,
            model_config=model_config,
            output_config=output_config
        )
        
        # 启动后台研究任务
        asyncio.create_task(
            self._start_background_research_task(
                thread_id=thread_id,
                session_id=session_mapping.id,
                question=request.question,
                frontend_uuid=request.frontend_uuid,
                visitor_id=request.visitor_id,
                research_config=research_config,
                model_config=model_config,
                output_config=output_config,
                existing_session_id=session_mapping.id,  # 🔥 传递现有session_id
                existing_thread_id=thread_id              # 🔥 传递现有thread_id
            )
        )
        
        # 构建响应
        response = ResearchAskResponse(
            ask_type=request.ask_type,
            url_param=url_param,
            frontend_uuid=request.frontend_uuid,
            session_id=session_mapping.id,
            thread_id=thread_id,
            workspace_url=f"/workspace/{url_param}",
            estimated_duration=self._estimate_research_duration(request.question),
            created_at=datetime.now().isoformat()
        )
        
        logger.info(f"Successfully created initial research session: {response.url_param}")
        return response

    async def _handle_followup_ask(self, request: ResearchAskRequest) -> ResearchAskResponse:
        """处理followup场景 - 在现有会话中追问"""
        logger.info(f"Processing followup ask: {request.question[:50]}...")
        
        # 验证followup必需参数
        if not all([request.session_id, request.thread_id, request.url_param]):
            raise HTTPException(
                status_code=400, 
                detail="followup场景必须提供session_id, thread_id, url_param"
            )
        
        # 验证会话是否存在 - 使用 get_session_overview 替代
        session_overview = await self.session_repo.get_session_overview(request.url_param)
        if not session_overview:
            raise HTTPException(status_code=404, detail="会话不存在")
        
        # 验证session_id是否匹配
        if session_overview['session_id'] != request.session_id:
            raise HTTPException(status_code=400, detail="session_id不匹配")
        
        if session_overview['thread_id'] != request.thread_id:
            raise HTTPException(status_code=400, detail="thread_id不匹配")
        
        # 解析配置（followup可能有新的配置）
        research_config, model_config, output_config = self._parse_config(request.config)
        
        # 启动followup研究任务（复用现有session和thread_id）
        asyncio.create_task(
            self._start_followup_research_task(
                thread_id=request.thread_id,
                session_id=request.session_id,
                question=request.question,
                frontend_uuid=request.frontend_uuid,
                visitor_id=request.visitor_id,
                research_config=research_config,
                model_config=model_config,
                output_config=output_config
            )
        )
        
        # 构建响应（复用现有会话信息）
        response = ResearchAskResponse(
            ask_type=request.ask_type,
            url_param=request.url_param,
            frontend_uuid=request.frontend_uuid,
            session_id=request.session_id,
            thread_id=request.thread_id,
            workspace_url=f"/workspace/{request.url_param}",
            estimated_duration=self._estimate_research_duration(request.question),
            created_at=datetime.now().isoformat()
        )
        
        logger.info(f"Successfully processed followup ask: {response.url_param}")
        return response

    def _parse_config(self, config: Dict[str, Any]) -> tuple:
        """解析配置参数"""
        research_config = {
            "auto_accepted_plan": config.get("research", {}).get("auto_accepted_plan", False),
            "enable_background_investigation": config.get("research", {}).get("enable_background_investigation", True),
            "report_style": config.get("research", {}).get("report_style", "academic"),
            "enable_deep_thinking": config.get("research", {}).get("enable_deep_thinking", False),
            "max_plan_iterations": config.get("research", {}).get("max_research_depth", 3),
            "max_step_num": 5,
            "max_search_results": 5,
        }
        
        model_config = config.get("model", {})
        output_config = config.get("output", {
            "language": "zh-CN",
            "output_format": "markdown"
        })
        
        return research_config, model_config, output_config

    async def _start_background_research_task(
        self,
        thread_id: str,
        session_id: int,
        question: str,
        frontend_uuid: str,
        visitor_id: str,
        research_config: Dict[str, Any],
        model_config: Dict[str, Any],
        output_config: Dict[str, Any],
        existing_session_id: int,     # 🔥 新增参数
        existing_thread_id: str       # 🔥 新增参数
    ):
        """启动后台研究任务（initial场景）"""
        try:
            logger.info(f"Starting background research task for thread_id: {thread_id}")
            
            # 创建执行记录
            execution_record = await self.session_repo.create_execution_record(
                session_id=session_id,
                frontend_context_uuid=frontend_uuid,
                action_type=ActionType.CREATE,
                user_message=question,
                model_used=model_config.get('model_name', 'claude-3-5-sonnet'),
                provider=model_config.get('provider', 'anthropic')
            )
            
            logger.info(f"Created execution record: {execution_record.execution_id}")
            
            # 🔥 使用ResearchStreamService来处理后台任务
            from src.server.research_stream_api import ResearchStreamService, ResearchStreamRequest, ActionType as StreamActionType
            
            stream_service = ResearchStreamService(self.session_repo)
            
            # 构建请求对象
            stream_request = ResearchStreamRequest(
                action=StreamActionType.CREATE,
                message=question,
                url_param=None,
                frontend_uuid=frontend_uuid,
                frontend_context_uuid=frontend_uuid,
                visitor_id=visitor_id,
                user_id=None,
                config={
                    "research_config": research_config,
                    "model_config": model_config,
                    "output_config": output_config
                }
            )
            
            # 🔥 传递现有session参数，避免重复创建
            async for event in stream_service.create_research_stream(
                stream_request,
                existing_session_id=existing_session_id,
                existing_thread_id=existing_thread_id
            ):
                logger.debug(f"Background task event: {event.get('event', 'unknown') if isinstance(event, dict) else str(event)}")
                
                if isinstance(event, dict):
                    event_type = event.get('event')
                    if event_type == 'complete':
                        await self.session_repo.update_execution_record(
                            execution_id=execution_record.execution_id,
                            status=ExecutionStatus.COMPLETED,
                            end_time=datetime.now()
                        )
                        logger.info(f"Background task completed for thread_id: {thread_id}")
                        break
                    elif event_type == 'error':
                        error_data = event.get('data', {})
                        if isinstance(error_data, str):
                            try:
                                error_data = json.loads(error_data)
                            except:
                                error_data = {"error_message": error_data}
                        
                        await self.session_repo.update_execution_record(
                            execution_id=execution_record.execution_id,
                            status=ExecutionStatus.ERROR,
                            error_message=error_data.get('error_message', 'Unknown error'),
                            end_time=datetime.now()
                        )
                        logger.error(f"Background task failed for thread_id: {thread_id}")
                        break
                
        except Exception as e:
            logger.error(f"Background research task failed for {thread_id}: {e}")
            try:
                await self.session_repo.update_execution_record(
                    execution_id=execution_record.execution_id if 'execution_record' in locals() else thread_id,
                    status=ExecutionStatus.ERROR,
                    error_message=str(e),
                    end_time=datetime.now()
                )
            except:
                pass

    async def _start_followup_research_task(
        self,
        thread_id: str,
        session_id: int,
        question: str,
        frontend_uuid: str,
        visitor_id: str,
        research_config: Dict[str, Any],
        model_config: Dict[str, Any],
        output_config: Dict[str, Any]
    ):
        """启动followup研究任务"""
        try:
            logger.info(f"Starting followup research task for thread_id: {thread_id}")
            
            # 创建执行记录
            execution_record = await self.session_repo.create_execution_record(
                session_id=session_id,
                frontend_context_uuid=frontend_uuid,
                action_type=ActionType.CONTINUE,  # 使用CONTINUE表示followup
                user_message=question,
                model_used=model_config.get('model_name', 'claude-3-5-sonnet'),
                provider=model_config.get('provider', 'anthropic')
            )
            
            logger.info(f"Created followup execution record: {execution_record.execution_id}")
            
            # 🔥 使用ResearchStreamService的continue_research_stream方法
            from src.server.research_stream_api import ResearchStreamService, ResearchStreamRequest, ActionType as StreamActionType
            
            stream_service = ResearchStreamService(self.session_repo)
            
            # 获取url_param
            session = await self.session_repo.get_session_by_thread_id(thread_id)
            if not session:
                raise ValueError(f"Session not found for thread_id: {thread_id}")
            url_param = session.url_param
            
            # 构建请求对象
            stream_request = ResearchStreamRequest(
                action=StreamActionType.CONTINUE,
                message=question,
                url_param=url_param,
                frontend_uuid=frontend_uuid,
                frontend_context_uuid=frontend_uuid,
                visitor_id=visitor_id,
                user_id=None,
                config={
                    "research_config": research_config,
                    "model_config": model_config,
                    "output_config": output_config
                }
            )
            
            # 执行followup流式处理
            async for event in stream_service.continue_research_stream(stream_request):
                logger.debug(f"Followup task event: {event.get('event', 'unknown') if isinstance(event, dict) else str(event)}")
                
                if isinstance(event, dict):
                    event_type = event.get('event')
                    if event_type == 'complete':
                        await self.session_repo.update_execution_record(
                            execution_id=execution_record.execution_id,
                            status=ExecutionStatus.COMPLETED,
                            end_time=datetime.now()
                        )
                        logger.info(f"Followup task completed for thread_id: {thread_id}")
                        break
                    elif event_type == 'error':
                        error_data = event.get('data', {})
                        if isinstance(error_data, str):
                            try:
                                error_data = json.loads(error_data)
                            except:
                                error_data = {"error_message": error_data}
                        
                        await self.session_repo.update_execution_record(
                            execution_id=execution_record.execution_id,
                            status=ExecutionStatus.ERROR,
                            error_message=error_data.get('error_message', 'Unknown error'),
                            end_time=datetime.now()
                        )
                        logger.error(f"Followup task failed for thread_id: {thread_id}")
                        break
                
        except Exception as e:
            logger.error(f"Followup research task failed for {thread_id}: {e}")
            try:
                await self.session_repo.update_execution_record(
                    execution_id=execution_record.execution_id if 'execution_record' in locals() else thread_id,
                    status=ExecutionStatus.ERROR,
                    error_message=str(e),
                    end_time=datetime.now()
                )
            except:
                pass

    def _estimate_research_duration(self, question: str) -> int:
        """根据问题复杂度估算研究时间"""
        base_duration = 60
        
        if len(question) > 100:
            base_duration += 30
        if len(question) > 200:
            base_duration += 30
            
        complex_keywords = ['分析', '比较', '研究', '评估', '调查', '深入', '全面']
        for keyword in complex_keywords:
            if keyword in question:
                base_duration += 20
                
        return min(base_duration, 300)


# 依赖注入
async def get_session_repository_dependency() -> SessionRepository:
    """获取SessionRepository依赖"""
    load_dotenv()
    db_url = os.getenv("DATABASE_URL")
    if not db_url:
        raise HTTPException(status_code=500, detail="数据库配置错误")
    
    return get_session_repository(db_url)

async def get_research_ask_service(
    session_repo: SessionRepository = Depends(get_session_repository_dependency)
) -> ResearchAskService:
    """获取研究询问服务实例"""
    return ResearchAskService(session_repo)


# API路由
@router.post("/ask", response_model=ResearchAskResponse)
async def ask_research(
    request: ResearchAskRequest,
    service: ResearchAskService = Depends(get_research_ask_service)
):
    """
    统一的研究询问接口
    支持initial（新建研究）和followup（追问）两种场景
    """
    logger.info(f"Received {request.ask_type} ask request: {request.question[:50]}...")
    
    try:
        response = await service.ask_research(request)
        logger.info(f"Successfully processed {request.ask_type} ask: {response.url_param}")
        return response
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Unexpected error in ask_research: {e}")
        raise HTTPException(
            status_code=500,
            detail="Internal server error"
        ) 