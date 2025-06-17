#!/usr/bin/env python3
"""
Session Repository for YADRA
会话映射系统的数据访问层
"""

import asyncio
from datetime import datetime, timedelta
from typing import Optional, Dict, Any, List, Tuple
from dataclasses import dataclass
from enum import Enum
import psycopg
from psycopg.rows import dict_row
import json
import logging

from src.utils.url_param_generator import generate_url_param

logger = logging.getLogger(__name__)


class SessionStatus(Enum):
    """会话状态枚举"""
    ACTIVE = "active"
    COMPLETED = "completed"
    ERROR = "error"
    PAUSED = "paused"


class ActionType(Enum):
    """操作类型枚举"""
    CREATE = "create"
    CONTINUE = "continue"
    FEEDBACK = "feedback"
    MODIFY = "modify"


class ExecutionStatus(Enum):
    """执行状态枚举"""
    RUNNING = "running"
    COMPLETED = "completed"
    ERROR = "error"
    CANCELLED = "cancelled"


@dataclass
class SessionMapping:
    """会话映射数据类"""
    id: Optional[int] = None
    thread_id: Optional[str] = None
    url_param: Optional[str] = None
    backend_uuid: Optional[str] = None
    frontend_uuid: Optional[str] = None
    visitor_id: Optional[str] = None
    user_id: Optional[str] = None
    initial_question: Optional[str] = None
    session_title: Optional[str] = None
    status: SessionStatus = SessionStatus.ACTIVE
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None
    last_activity_at: Optional[datetime] = None
    expires_at: Optional[datetime] = None


@dataclass
class SessionConfig:
    """会话配置数据类"""
    id: Optional[int] = None
    session_id: Optional[int] = None
    config_version: int = 1
    research_config: Optional[Dict[str, Any]] = None
    model_config: Optional[Dict[str, Any]] = None
    output_config: Optional[Dict[str, Any]] = None
    user_preferences: Optional[Dict[str, Any]] = None
    created_at: Optional[datetime] = None
    is_active: bool = True


@dataclass
class ExecutionRecord:
    """执行记录数据类"""
    id: Optional[int] = None
    session_id: Optional[int] = None
    execution_id: Optional[str] = None
    frontend_context_uuid: Optional[str] = None
    action_type: ActionType = ActionType.CREATE
    user_message: Optional[str] = None
    request_timestamp: Optional[datetime] = None
    model_used: Optional[str] = None
    provider: Optional[str] = None
    start_time: Optional[datetime] = None
    end_time: Optional[datetime] = None
    duration_ms: Optional[int] = None
    input_tokens: int = 0
    output_tokens: int = 0
    total_cost: float = 0.0
    status: ExecutionStatus = ExecutionStatus.RUNNING
    error_message: Optional[str] = None
    artifacts_generated: Optional[List[str]] = None
    steps_completed: Optional[List[str]] = None
    created_at: Optional[datetime] = None


class SessionRepository:
    """会话映射系统的数据访问层"""
    
    def __init__(self, db_url: str):
        """
        初始化Repository
        
        Args:
            db_url: 数据库连接字符串
        """
        self.db_url = db_url
    
    async def get_connection(self) -> psycopg.AsyncConnection:
        """获取异步数据库连接"""
        return await psycopg.AsyncConnection.connect(
            self.db_url, 
            row_factory=dict_row
        )
    
    async def create_session(
        self,
        thread_id: str,
        frontend_uuid: str,
        visitor_id: str,
        initial_question: str,
        user_id: Optional[str] = None,
        research_config: Optional[Dict[str, Any]] = None,
        model_config: Optional[Dict[str, Any]] = None,
        output_config: Optional[Dict[str, Any]] = None,
        user_preferences: Optional[Dict[str, Any]] = None
    ) -> Tuple[SessionMapping, str]:
        """
        创建新会话
        
        Args:
            thread_id: 线程ID
            frontend_uuid: 前端UUID
            visitor_id: 访客ID
            initial_question: 初始问题
            user_id: 用户ID（可选）
            research_config: 研究配置
            model_config: 模型配置
            output_config: 输出配置
            user_preferences: 用户偏好
            
        Returns:
            (SessionMapping, url_param) 元组
        """
        async with await self.get_connection() as conn:
            async with conn.transaction():
                # 生成URL参数
                url_param = generate_url_param(initial_question)
                
                # 确保URL参数唯一性
                attempt = 0
                while attempt < 5:  # 最多尝试5次
                    cursor = conn.cursor()
                    await cursor.execute(
                        "SELECT COUNT(*) FROM session_mapping WHERE url_param = %s",
                        (url_param,)
                    )
                    count = (await cursor.fetchone())['count']
                    
                    if count == 0:
                        break
                    
                    # 如果重复，重新生成
                    url_param = generate_url_param(initial_question)
                    attempt += 1
                
                if attempt >= 5:
                    raise ValueError("无法生成唯一的URL参数")
                
                # 生成会话标题（取问题前50个字符）
                session_title = initial_question[:50] + "..." if len(initial_question) > 50 else initial_question
                
                # 插入会话映射
                cursor = conn.cursor()
                await cursor.execute("""
                    INSERT INTO session_mapping (
                        thread_id, url_param, frontend_uuid, visitor_id, user_id,
                        initial_question, session_title, status
                    ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
                    RETURNING *
                """, (
                    thread_id, url_param, frontend_uuid, visitor_id, user_id,
                    initial_question, session_title, SessionStatus.ACTIVE.value
                ))
                
                session_row = await cursor.fetchone()
                session = SessionMapping(**session_row)
                
                # 插入会话配置
                await cursor.execute("""
                    INSERT INTO session_config (
                        session_id, research_config, model_config, 
                        output_config, user_preferences
                    ) VALUES (%s, %s, %s, %s, %s)
                """, (
                    session.id,
                    json.dumps(research_config or {}),
                    json.dumps(model_config or {}),
                    json.dumps(output_config or {}),
                    json.dumps(user_preferences or {})
                ))
                
                logger.info(f"创建会话成功: {session.id}, URL参数: {url_param}")
                return session, url_param
    
    async def get_session_by_url_param(self, url_param: str) -> Optional[SessionMapping]:
        """
        通过URL参数获取会话
        
        Args:
            url_param: URL参数
            
        Returns:
            会话映射对象或None
        """
        async with await self.get_connection() as conn:
            cursor = conn.cursor()
            await cursor.execute(
                "SELECT * FROM session_mapping WHERE url_param = %s",
                (url_param,)
            )
            
            row = await cursor.fetchone()
            if row:
                return SessionMapping(**row)
            return None
    
    async def get_session_by_thread_id(self, thread_id: str) -> Optional[SessionMapping]:
        """
        通过线程ID获取会话
        
        Args:
            thread_id: 线程ID
            
        Returns:
            会话映射对象或None
        """
        async with await self.get_connection() as conn:
            cursor = conn.cursor()
            await cursor.execute(
                "SELECT * FROM session_mapping WHERE thread_id = %s",
                (thread_id,)
            )
            
            row = await cursor.fetchone()
            if row:
                return SessionMapping(**row)
            return None
    
    async def get_session_by_frontend_uuid(self, frontend_uuid: str) -> Optional[SessionMapping]:
        """
        通过前端UUID获取会话
        
        Args:
            frontend_uuid: 前端UUID
            
        Returns:
            会话映射对象或None
        """
        async with await self.get_connection() as conn:
            cursor = conn.cursor()
            await cursor.execute(
                "SELECT * FROM session_mapping WHERE frontend_uuid = %s",
                (frontend_uuid,)
            )
            
            row = await cursor.fetchone()
            if row:
                return SessionMapping(**row)
            return None
    
    async def update_session_activity(self, session_id: int) -> bool:
        """
        更新会话活动时间
        
        Args:
            session_id: 会话ID
            
        Returns:
            是否更新成功
        """
        async with await self.get_connection() as conn:
            cursor = conn.cursor()
            await cursor.execute("""
                UPDATE session_mapping 
                SET last_activity_at = NOW()
                WHERE id = %s
            """, (session_id,))
            
            return cursor.rowcount > 0
    
    async def get_session_config(self, session_id: int) -> Optional[SessionConfig]:
        """
        获取会话配置
        
        Args:
            session_id: 会话ID
            
        Returns:
            会话配置对象或None
        """
        async with await self.get_connection() as conn:
            cursor = conn.cursor()
            await cursor.execute("""
                SELECT * FROM session_config 
                WHERE session_id = %s AND is_active = TRUE
                ORDER BY created_at DESC
                LIMIT 1
            """, (session_id,))
            
            row = await cursor.fetchone()
            if row:
                # 解析JSON字段
                config = SessionConfig(**row)
                # 如果已经是dict则直接使用，否则解析JSON
                config.research_config = row['research_config'] if isinstance(row['research_config'], dict) else (json.loads(row['research_config']) if row['research_config'] else {})
                config.model_config = row['model_config'] if isinstance(row['model_config'], dict) else (json.loads(row['model_config']) if row['model_config'] else {})
                config.output_config = row['output_config'] if isinstance(row['output_config'], dict) else (json.loads(row['output_config']) if row['output_config'] else {})
                config.user_preferences = row['user_preferences'] if isinstance(row['user_preferences'], dict) else (json.loads(row['user_preferences']) if row['user_preferences'] else {})
                return config
            return None
    
    async def create_execution_record(
        self,
        session_id: int,
        frontend_context_uuid: str,
        action_type: ActionType,
        user_message: str,
        model_used: Optional[str] = None,
        provider: Optional[str] = None
    ) -> ExecutionRecord:
        """
        创建执行记录
        
        Args:
            session_id: 会话ID
            frontend_context_uuid: 前端上下文UUID
            action_type: 操作类型
            user_message: 用户消息
            model_used: 使用的模型
            provider: 提供商
            
        Returns:
            执行记录对象
        """
        async with await self.get_connection() as conn:
            cursor = conn.cursor()
            await cursor.execute("""
                INSERT INTO execution_record (
                    session_id, frontend_context_uuid, action_type, 
                    user_message, model_used, provider, status
                ) VALUES (%s, %s, %s, %s, %s, %s, %s)
                RETURNING *
            """, (
                session_id, frontend_context_uuid, action_type.value,
                user_message, model_used, provider, ExecutionStatus.RUNNING.value
            ))
            
            row = await cursor.fetchone()
            return ExecutionRecord(**row)
    
    async def update_execution_record(
        self,
        execution_id: str,
        status: ExecutionStatus,
        end_time: Optional[datetime] = None,
        duration_ms: Optional[int] = None,
        input_tokens: Optional[int] = None,
        output_tokens: Optional[int] = None,
        total_cost: Optional[float] = None,
        error_message: Optional[str] = None,
        artifacts_generated: Optional[List[str]] = None,
        steps_completed: Optional[List[str]] = None
    ) -> bool:
        """
        更新执行记录
        
        Args:
            execution_id: 执行ID
            status: 执行状态
            end_time: 结束时间
            duration_ms: 持续时间（毫秒）
            input_tokens: 输入token数
            output_tokens: 输出token数
            total_cost: 总成本
            error_message: 错误消息
            artifacts_generated: 生成的artifacts
            steps_completed: 完成的步骤
            
        Returns:
            是否更新成功
        """
        async with await self.get_connection() as conn:
            cursor = conn.cursor()
            
            # 构建更新字段
            update_fields = ["status = %s"]
            update_values = [status.value]
            
            if end_time is not None:
                update_fields.append("end_time = %s")
                update_values.append(end_time)
            
            if duration_ms is not None:
                update_fields.append("duration_ms = %s")
                update_values.append(duration_ms)
            
            if input_tokens is not None:
                update_fields.append("input_tokens = %s")
                update_values.append(input_tokens)
            
            if output_tokens is not None:
                update_fields.append("output_tokens = %s")
                update_values.append(output_tokens)
            
            if total_cost is not None:
                update_fields.append("total_cost = %s")
                update_values.append(total_cost)
            
            if error_message is not None:
                update_fields.append("error_message = %s")
                update_values.append(error_message)
            
            if artifacts_generated is not None:
                update_fields.append("artifacts_generated = %s")
                update_values.append(artifacts_generated)
            
            if steps_completed is not None:
                update_fields.append("steps_completed = %s")
                update_values.append(steps_completed)
            
            update_values.append(execution_id)
            
            await cursor.execute(f"""
                UPDATE execution_record 
                SET {', '.join(update_fields)}
                WHERE execution_id = %s
            """, update_values)
            
            return cursor.rowcount > 0
    
    async def get_session_overview(self, url_param: str) -> Optional[Dict[str, Any]]:
        """
        获取会话概览信息
        
        Args:
            url_param: URL参数
            
        Returns:
            会话概览信息或None
        """
        async with await self.get_connection() as conn:
            cursor = conn.cursor()
            await cursor.execute(
                "SELECT * FROM session_overview WHERE url_param = %s",
                (url_param,)
            )
            
            row = await cursor.fetchone()
            if row:
                return dict(row)
            return None
    
    async def get_user_sessions(
        self, 
        user_id: str, 
        limit: int = 50, 
        offset: int = 0
    ) -> List[Dict[str, Any]]:
        """
        获取用户的会话列表
        
        Args:
            user_id: 用户ID
            limit: 限制数量
            offset: 偏移量
            
        Returns:
            会话列表
        """
        async with await self.get_connection() as conn:
            cursor = conn.cursor()
            await cursor.execute("""
                SELECT * FROM session_overview 
                WHERE user_id = %s 
                ORDER BY created_at DESC 
                LIMIT %s OFFSET %s
            """, (user_id, limit, offset))
            
            rows = await cursor.fetchall()
            return [dict(row) for row in rows]
    
    async def cleanup_expired_sessions(self) -> int:
        """
        清理过期会话
        
        Returns:
            清理的会话数量
        """
        async with await self.get_connection() as conn:
            cursor = conn.cursor()
            await cursor.execute("""
                UPDATE session_mapping 
                SET status = %s 
                WHERE expires_at < NOW() AND status = %s
            """, (SessionStatus.ERROR.value, SessionStatus.ACTIVE.value))
            
            return cursor.rowcount


# 全局Repository实例
_session_repository: Optional[SessionRepository] = None


def get_session_repository(db_url: str) -> SessionRepository:
    """
    获取SessionRepository实例
    
    Args:
        db_url: 数据库连接字符串
        
    Returns:
        SessionRepository实例
    """
    global _session_repository
    if _session_repository is None:
        _session_repository = SessionRepository(db_url)
    return _session_repository 