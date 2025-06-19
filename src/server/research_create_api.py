#!/usr/bin/env python3
"""
Research Create API for YADRA
实现两步分离架构的第一步：快速创建研究会话并返回URL参数
"""

import asyncio
import os
import uuid
from datetime import datetime
from typing import Dict, Any, Optional
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
from src.utils.url_param_generator import generate_url_param

logger = logging.getLogger(__name__)

# 创建路由器
router = APIRouter(prefix="/api/research", tags=["research"])

# 请求模型
class CreateResearchRequest(BaseModel):
    question: str = Field(..., min_length=1, max_length=2000, description="用户研究问题")
    frontend_uuid: str = Field(..., description="前端生成的UUID")
    visitor_id: str = Field(..., description="访客ID")
    user_id: Optional[str] = Field(None, description="用户ID（可选）")
    config: Optional[Dict[str, Any]] = Field(default_factory=dict, description="配置参数")

# 响应模型
class CreateResearchResponse(BaseModel):
    url_param: str = Field(..., description="生成的URL参数")
    frontend_uuid: str = Field(..., description="前端UUID")
    session_id: int = Field(..., description="会话ID") 
    workspace_url: str = Field(..., description="工作区URL")
    estimated_duration: int = Field(default=120, description="预估完成时间（秒）")
    created_at: str = Field(..., description="创建时间")

class ResearchCreateService:
    """研究任务创建服务"""
    
    def __init__(self, session_repo: SessionRepository):
        self.session_repo = session_repo
    
    async def create_research_session(
        self, 
        request: CreateResearchRequest
    ) -> CreateResearchResponse:
        """
        创建新的研究会话
        
        Args:
            request: 创建请求
            
        Returns:
            CreateResearchResponse: 包含url_param等信息的响应
        """
        logger.info(f"Creating research session for question: {request.question[:50]}...")
        
        try:
            # 生成thread_id（用于Langgraph）
            thread_id = f"thread_{uuid.uuid4().hex[:16]}"
            
            # 构建默认配置
            default_research_config = {
                "report_style": "academic",
                "enable_web_search": True,
                "max_research_depth": 3,
                "enable_deep_thinking": False,
                "enable_background_investigation": True
            }
            
            default_model_config = {
                "provider": "anthropic",
                "model_name": "claude-3-5-sonnet",
                "temperature": 0.7,
                "top_p": 0.9,
                "max_tokens": 4000
            }
            
            default_output_config = {
                "language": "zhCN",
                "output_format": "markdown",
                "include_artifacts": True,
                "include_citations": True
            }
            
            # 合并用户配置
            research_config = {**default_research_config, **request.config.get('research', {})}
            model_config = {**default_model_config, **request.config.get('model', {})}
            output_config = {**default_output_config, **request.config.get('output', {})}
            user_preferences = request.config.get('preferences', {})
            
            # 创建会话
            session_mapping, url_param = await self.session_repo.create_session(
                thread_id=thread_id,
                frontend_uuid=request.frontend_uuid,
                visitor_id=request.visitor_id,
                initial_question=request.question,
                user_id=request.user_id,
                research_config=research_config,
                model_config=model_config,
                output_config=output_config,
                user_preferences=user_preferences
            )
            
            logger.info(f"Created session {session_mapping.id} with url_param: {url_param}")
            
            # 启动后台研究任务（异步执行）
            asyncio.create_task(
                self._start_background_research_task(
                    thread_id=thread_id,
                    session_id=session_mapping.id,
                    question=request.question,
                    frontend_uuid=request.frontend_uuid,
                    research_config=research_config,
                    model_config=model_config,
                    output_config=output_config
                )
            )
            
            # 构建工作区URL
            workspace_url = f"/workspace/{url_param}"
            
            # 构建响应
            response = CreateResearchResponse(
                url_param=url_param,
                frontend_uuid=request.frontend_uuid,
                session_id=session_mapping.id,
                workspace_url=workspace_url,
                estimated_duration=self._estimate_research_duration(request.question),
                created_at=datetime.now().isoformat()
            )
            
            logger.info(f"Successfully created research session: {response.url_param}")
            return response
            
        except Exception as e:
            logger.error(f"Failed to create research session: {e}")
            raise HTTPException(
                status_code=500,
                detail=f"Failed to create research session: {str(e)}"
            )
    
    async def _start_background_research_task(
        self,
        thread_id: str,
        session_id: int,
        question: str,
        frontend_uuid: str,
        research_config: Dict[str, Any],
        model_config: Dict[str, Any],
        output_config: Dict[str, Any]
    ):
        """
        启动后台研究任务（在用户访问workspace页面前预先开始处理）
        """
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
            
            # 🔥 使用ResearchStreamService来处理后台任务，确保数据保存
            from src.server.research_stream_api import ResearchStreamService, ResearchStreamRequest, ActionType as StreamActionType
            
            # 创建ResearchStreamService实例
            stream_service = ResearchStreamService(self.session_repo)
            
            # 构建请求对象
            stream_request = ResearchStreamRequest(
                action=StreamActionType.CREATE,
                message=question,
                url_param=None,  # 后台任务不需要url_param
                frontend_uuid=frontend_uuid,
                frontend_context_uuid=frontend_uuid,
                visitor_id=str(uuid.uuid4()),  # 🔥 使用正确的UUID格式
                user_id=None,
                config={
                    "research_config": research_config,
                    "model_config": model_config,
                    "output_config": output_config
                }
            )
            
            # 执行流式处理，但不发送SSE事件，只保存数据
            async for event in stream_service.create_research_stream(stream_request):
                # 在后台任务中，我们只关心数据保存，不需要发送SSE事件
                logger.debug(f"Background task event: {event.get('event', 'unknown') if isinstance(event, dict) else str(event)}")
                
                # 如果是完成或错误事件，更新执行记录状态
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
            # 更新执行记录为失败状态
            try:
                await self.session_repo.update_execution_record(
                    execution_id=execution_record.execution_id if 'execution_record' in locals() else thread_id,
                    status=ExecutionStatus.ERROR,
                    error_message=str(e),
                    end_time=datetime.now()
                )
            except:
                pass  # 避免嵌套异常
    
    def _estimate_research_duration(self, question: str) -> int:
        """
        根据问题复杂度估算研究时间
        
        Args:
            question: 用户问题
            
        Returns:
            int: 预估时间（秒）
        """
        # 简单的启发式估算
        base_duration = 60  # 基础60秒
        
        # 根据问题长度调整
        if len(question) > 100:
            base_duration += 30
        if len(question) > 200:
            base_duration += 30
            
        # 根据关键词调整
        complex_keywords = ['分析', '比较', '研究', '评估', '调查', '深入', '全面']
        for keyword in complex_keywords:
            if keyword in question:
                base_duration += 20
                
        return min(base_duration, 300)  # 最多5分钟


# 依赖注入
async def get_session_repository_dependency() -> SessionRepository:
    """获取SessionRepository依赖"""
    load_dotenv()
    db_url = os.getenv("DATABASE_URL")
    if not db_url:
        raise HTTPException(status_code=500, detail="数据库配置错误")
    
    return get_session_repository(db_url)

async def get_research_create_service(
    session_repo: SessionRepository = Depends(get_session_repository_dependency)
) -> ResearchCreateService:
    """获取研究创建服务实例"""
    return ResearchCreateService(session_repo)


# API路由
@router.post("/create", response_model=CreateResearchResponse)
async def create_research(
    request: CreateResearchRequest,
    service: ResearchCreateService = Depends(get_research_create_service)
):
    """
    创建新的研究任务
    
    这是两步分离架构的第一步：
    1. 快速创建会话记录
    2. 生成url_param并返回
    3. 在后台启动Langgraph研究流程
    4. 前端可以立即跳转到workspace页面
    """
    logger.info(f"Received create research request: {request.question[:50]}...")
    
    try:
        response = await service.create_research_session(request)
        logger.info(f"Successfully created research session: {response.url_param}")
        return response
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Unexpected error in create_research: {e}")
        raise HTTPException(
            status_code=500,
            detail="Internal server error"
        ) 