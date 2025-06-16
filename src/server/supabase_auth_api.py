#!/usr/bin/env python3
"""
Supabase Authentication API
使用 Supabase 内置认证系统的 API 实现
"""

import logging
from typing import Optional, Dict, Any, List
from datetime import datetime
from fastapi import HTTPException, Request, Depends, Header
from pydantic import BaseModel, Field
from gotrue.errors import AuthApiError
import psycopg
from psycopg.rows import dict_row

from .supabase_client import get_supabase_client, get_supabase_admin

logger = logging.getLogger(__name__)

# 请求/响应模型
class UserSignUpRequest(BaseModel):
    email: str = Field(..., description="用户邮箱")
    password: str = Field(..., min_length=6, description="用户密码")
    display_name: Optional[str] = Field(None, description="显示名称")
    enable_deep_thinking: bool = Field(default=False, description="是否启用推理模式")

class UserSignInRequest(BaseModel):
    email: str
    password: str

class UserUpdateRequest(BaseModel):
    display_name: Optional[str] = Field(None, description="显示名称")
    enable_deep_thinking: Optional[bool] = Field(None, description="是否启用推理模式")

class UserResponse(BaseModel):
    id: str
    email: str
    display_name: Optional[str]
    enable_deep_thinking: bool
    email_confirmed_at: Optional[str]
    created_at: str
    updated_at: str
    last_sign_in_at: Optional[str]

class AuthResponse(BaseModel):
    user: UserResponse
    session: Dict[str, Any]

class TaskResponse(BaseModel):
    id: str
    user_id: str
    thread_id: str
    task_name: str
    status: str
    checkpoint_count: int
    created_at: str
    updated_at: str
    metadata: Dict[str, Any]

# 认证辅助函数
async def get_current_user(authorization: str = Header(None)) -> Dict[str, Any]:
    """从 Authorization header 获取当前用户"""
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Authentication required")
    
    access_token = authorization.split(" ")[1]
    
    try:
        # 使用 Supabase 验证 token 并获取用户
        supabase = get_supabase_client()
        response = supabase.auth.get_user(access_token)
        
        if not response or not response.user:
            raise HTTPException(status_code=401, detail="Invalid authentication token")
        
        return {
            "user_id": response.user.id,
            "email": response.user.email,
            "user": response.user
        }
    except Exception as e:
        logger.error(f"Authentication error: {e}")
        raise HTTPException(status_code=401, detail="Authentication failed")

# 用户管理函数
async def sign_up_user(user_data: UserSignUpRequest) -> AuthResponse:
    """使用 Supabase Auth 注册新用户"""
    supabase = get_supabase_client()
    
    try:
        # 注册用户
        auth_response = supabase.auth.sign_up({
            "email": user_data.email,
            "password": user_data.password,
            "options": {
                "data": {
                    "display_name": user_data.display_name,
                    "enable_deep_thinking": user_data.enable_deep_thinking
                }
            }
        })
        
        if not auth_response.user:
            raise HTTPException(status_code=400, detail="Registration failed")
        
        # 创建用户扩展信息
        if auth_response.user.id:
            await create_user_profile(
                auth_response.user.id,
                auth_response.user.email,
                user_data.display_name,
                user_data.enable_deep_thinking
            )
        
        return AuthResponse(
            user=UserResponse(
                id=auth_response.user.id,
                email=auth_response.user.email,
                display_name=user_data.display_name,
                enable_deep_thinking=user_data.enable_deep_thinking,
                email_confirmed_at=auth_response.user.email_confirmed_at.isoformat() if auth_response.user.email_confirmed_at else None,
                created_at=auth_response.user.created_at.isoformat() if hasattr(auth_response.user.created_at, 'isoformat') else str(auth_response.user.created_at),
                updated_at=(auth_response.user.updated_at or auth_response.user.created_at).isoformat() if hasattr(auth_response.user.updated_at or auth_response.user.created_at, 'isoformat') else str(auth_response.user.updated_at or auth_response.user.created_at),
                last_sign_in_at=auth_response.user.last_sign_in_at.isoformat() if auth_response.user.last_sign_in_at and hasattr(auth_response.user.last_sign_in_at, 'isoformat') else str(auth_response.user.last_sign_in_at) if auth_response.user.last_sign_in_at else None
            ),
            session={
                "access_token": auth_response.session.access_token if auth_response.session else None,
                "refresh_token": auth_response.session.refresh_token if auth_response.session else None,
                "expires_in": auth_response.session.expires_in if auth_response.session else None,
                "token_type": "bearer"
            }
        )
        
    except AuthApiError as e:
        if "User already registered" in str(e):
            raise HTTPException(status_code=409, detail="User already exists")
        logger.error(f"Sign up error: {e}")
        raise HTTPException(status_code=400, detail=str(e))

async def sign_in_user(login_data: UserSignInRequest) -> AuthResponse:
    """使用 Supabase Auth 登录用户"""
    supabase = get_supabase_client()
    
    try:
        # 登录用户
        auth_response = supabase.auth.sign_in_with_password({
            "email": login_data.email,
            "password": login_data.password
        })
        
        if not auth_response.user or not auth_response.session:
            raise HTTPException(status_code=401, detail="Invalid credentials")
        
        # 获取用户扩展信息
        profile = await get_user_profile(auth_response.user.id)
        
        return AuthResponse(
            user=UserResponse(
                id=auth_response.user.id,
                email=auth_response.user.email,
                display_name=profile.get("display_name"),
                enable_deep_thinking=profile.get("enable_deep_thinking", False),
                email_confirmed_at=auth_response.user.email_confirmed_at.isoformat() if auth_response.user.email_confirmed_at else None,
                created_at=auth_response.user.created_at.isoformat() if hasattr(auth_response.user.created_at, 'isoformat') else str(auth_response.user.created_at),
                updated_at=(auth_response.user.updated_at or auth_response.user.created_at).isoformat() if hasattr(auth_response.user.updated_at or auth_response.user.created_at, 'isoformat') else str(auth_response.user.updated_at or auth_response.user.created_at),
                last_sign_in_at=auth_response.user.last_sign_in_at.isoformat() if auth_response.user.last_sign_in_at and hasattr(auth_response.user.last_sign_in_at, 'isoformat') else str(auth_response.user.last_sign_in_at) if auth_response.user.last_sign_in_at else None
            ),
            session={
                "access_token": auth_response.session.access_token,
                "refresh_token": auth_response.session.refresh_token,
                "expires_in": auth_response.session.expires_in,
                "token_type": "bearer"
            }
        )
        
    except AuthApiError as e:
        logger.error(f"Sign in error: {e}")
        raise HTTPException(status_code=401, detail="Invalid credentials")

async def sign_out_user(access_token: str) -> Dict[str, str]:
    """登出用户"""
    supabase = get_supabase_client()
    
    try:
        supabase.auth.sign_out()
        return {"message": "Successfully signed out"}
    except Exception as e:
        logger.error(f"Sign out error: {e}")
        raise HTTPException(status_code=400, detail="Sign out failed")

async def get_user_info(user_data: Dict[str, Any]) -> UserResponse:
    """获取用户详细信息"""
    user = user_data["user"]
    profile = await get_user_profile(user.id)
    
    return UserResponse(
        id=user.id,
        email=user.email,
        display_name=profile.get("display_name") or user.user_metadata.get("display_name"),
        enable_deep_thinking=profile.get("enable_deep_thinking", False) or user.user_metadata.get("enable_deep_thinking", False),
        email_confirmed_at=user.email_confirmed_at.isoformat() if user.email_confirmed_at else None,
        created_at=user.created_at.isoformat() if hasattr(user.created_at, 'isoformat') else str(user.created_at),
        updated_at=(user.updated_at or user.created_at).isoformat() if hasattr(user.updated_at or user.created_at, 'isoformat') else str(user.updated_at or user.created_at),
        last_sign_in_at=user.last_sign_in_at.isoformat() if user.last_sign_in_at and hasattr(user.last_sign_in_at, 'isoformat') else str(user.last_sign_in_at) if user.last_sign_in_at else None
    )

# 数据库操作函数
def get_db_connection():
    """获取数据库连接"""
    import os
    from dotenv import load_dotenv
    
    load_dotenv()
    database_url = os.getenv('DATABASE_URL')
    if not database_url:
        raise HTTPException(status_code=500, detail="Database not configured")
    
    return psycopg.connect(database_url, row_factory=dict_row)

async def setup_user_tables():
    """创建用户相关的扩展表"""
    conn = get_db_connection()
    try:
        cursor = conn.cursor()
        
        # 用户扩展信息表（与 auth.users 关联）
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS user_profiles (
                user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
                display_name VARCHAR(255),
                enable_deep_thinking BOOLEAN DEFAULT FALSE,
                created_at TIMESTAMPTZ DEFAULT NOW(),
                updated_at TIMESTAMPTZ DEFAULT NOW()
            );
            
            CREATE INDEX IF NOT EXISTS idx_user_profiles_user_id ON user_profiles(user_id);
        """)
        
        # 用户任务表
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS user_tasks (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
                thread_id VARCHAR(255) NOT NULL,
                task_name VARCHAR(255),
                status VARCHAR(50) DEFAULT 'active',
                checkpoint_count INTEGER DEFAULT 0,
                last_checkpoint_at TIMESTAMPTZ,
                created_at TIMESTAMPTZ DEFAULT NOW(),
                updated_at TIMESTAMPTZ DEFAULT NOW(),
                metadata JSONB DEFAULT '{}',
                UNIQUE(user_id, thread_id)
            );
            
            CREATE INDEX IF NOT EXISTS idx_user_tasks_user_id ON user_tasks(user_id);
            CREATE INDEX IF NOT EXISTS idx_user_tasks_thread_id ON user_tasks(thread_id);
            CREATE INDEX IF NOT EXISTS idx_user_tasks_status ON user_tasks(status);
        """)
        
        # 启用 RLS
        cursor.execute("""
            ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;
            ALTER TABLE user_tasks ENABLE ROW LEVEL SECURITY;
        """)
        
        # 检查并创建 RLS 策略
        # 先删除已存在的策略（如果有）
        cursor.execute("""
            DROP POLICY IF EXISTS "Users can view own profile" ON user_profiles;
            DROP POLICY IF EXISTS "Users can update own profile" ON user_profiles;
            DROP POLICY IF EXISTS "Users can insert own profile" ON user_profiles;
            DROP POLICY IF EXISTS "Users can view own tasks" ON user_tasks;
            DROP POLICY IF EXISTS "Users can insert own tasks" ON user_tasks;
            DROP POLICY IF EXISTS "Users can update own tasks" ON user_tasks;
        """)
        
        # 创建新策略
        cursor.execute("""
            -- 用户只能访问自己的数据
            CREATE POLICY "Users can view own profile" 
                ON user_profiles FOR SELECT 
                USING (auth.uid() = user_id);
                
            CREATE POLICY "Users can update own profile" 
                ON user_profiles FOR UPDATE 
                USING (auth.uid() = user_id);
                
            CREATE POLICY "Users can insert own profile" 
                ON user_profiles FOR INSERT 
                WITH CHECK (auth.uid() = user_id);
                
            CREATE POLICY "Users can view own tasks" 
                ON user_tasks FOR SELECT 
                USING (auth.uid() = user_id);
                
            CREATE POLICY "Users can insert own tasks" 
                ON user_tasks FOR INSERT 
                WITH CHECK (auth.uid() = user_id);
                
            CREATE POLICY "Users can update own tasks" 
                ON user_tasks FOR UPDATE 
                USING (auth.uid() = user_id);
        """)
        
        conn.commit()
        logger.info("✅ User tables and RLS policies setup completed")
        
    except Exception as e:
        logger.error(f"Failed to setup user tables: {e}")
        conn.rollback()
        raise
    finally:
        cursor.close()
        conn.close()

async def create_user_profile(user_id: str, email: str, display_name: Optional[str], enable_deep_thinking: bool):
    """创建用户扩展信息"""
    conn = get_db_connection()
    try:
        cursor = conn.cursor()
        cursor.execute("""
            INSERT INTO user_profiles (user_id, display_name, enable_deep_thinking)
            VALUES (%s, %s, %s)
            ON CONFLICT (user_id) DO UPDATE SET
                display_name = EXCLUDED.display_name,
                enable_deep_thinking = EXCLUDED.enable_deep_thinking,
                updated_at = NOW()
        """, (user_id, display_name, enable_deep_thinking))
        conn.commit()
    finally:
        cursor.close()
        conn.close()

async def get_user_profile(user_id: str) -> Dict[str, Any]:
    """获取用户扩展信息"""
    conn = get_db_connection()
    try:
        cursor = conn.cursor()
        cursor.execute("""
            SELECT display_name, enable_deep_thinking
            FROM user_profiles
            WHERE user_id = %s
        """, (user_id,))
        
        result = cursor.fetchone()
        if result:
            return result
        return {"display_name": None, "enable_deep_thinking": False}
        
    finally:
        cursor.close()
        conn.close()

async def update_user_profile(user_id: str, update_data: UserUpdateRequest) -> UserResponse:
    """更新用户信息"""
    conn = get_db_connection()
    try:
        cursor = conn.cursor()
        
        # 更新 user_profiles 表
        updates = []
        values = []
        
        if update_data.display_name is not None:
            updates.append("display_name = %s")
            values.append(update_data.display_name)
            
        if update_data.enable_deep_thinking is not None:
            updates.append("enable_deep_thinking = %s")
            values.append(update_data.enable_deep_thinking)
            
        if updates:
            updates.append("updated_at = NOW()")
            values.append(user_id)
            
            cursor.execute(f"""
                UPDATE user_profiles 
                SET {', '.join(updates)}
                WHERE user_id = %s
                RETURNING display_name, enable_deep_thinking
            """, values)
            
            result = cursor.fetchone()
            conn.commit()
            
            # 同时更新 Supabase auth metadata
            supabase_admin = get_supabase_admin()
            if supabase_admin:
                try:
                    supabase_admin.auth.admin.update_user_by_id(
                        user_id,
                        {"user_metadata": {
                            "display_name": update_data.display_name,
                            "enable_deep_thinking": update_data.enable_deep_thinking
                        }}
                    )
                except Exception as e:
                    logger.warning(f"Failed to update auth metadata: {e}")
        
        # 获取完整用户信息
        supabase = get_supabase_client()
        user_response = supabase.auth.admin.get_user_by_id(user_id) if get_supabase_admin() else None
        
        if user_response and user_response.user:
            user = user_response.user
            return UserResponse(
                id=user.id,
                email=user.email,
                display_name=result["display_name"] if result else None,
                enable_deep_thinking=result["enable_deep_thinking"] if result else False,
                email_confirmed_at=user.email_confirmed_at.isoformat() if user.email_confirmed_at else None,
                created_at=user.created_at.isoformat() if hasattr(user.created_at, 'isoformat') else str(user.created_at),
                updated_at=(user.updated_at or user.created_at).isoformat() if hasattr(user.updated_at or user.created_at, 'isoformat') else str(user.updated_at or user.created_at),
                last_sign_in_at=user.last_sign_in_at.isoformat() if user.last_sign_in_at and hasattr(user.last_sign_in_at, 'isoformat') else str(user.last_sign_in_at) if user.last_sign_in_at else None
            )
        else:
            raise HTTPException(status_code=404, detail="User not found")
            
    finally:
        cursor.close()
        conn.close()

# 任务管理函数
async def get_user_tasks(user_id: str, status: Optional[str] = None) -> List[TaskResponse]:
    """获取用户任务列表"""
    conn = get_db_connection()
    try:
        cursor = conn.cursor()
        
        query = """
            SELECT id, user_id, thread_id, task_name, status, 
                   checkpoint_count, created_at, updated_at, metadata
            FROM user_tasks 
            WHERE user_id = %s
        """
        params = [user_id]
        
        if status:
            query += " AND status = %s"
            params.append(status)
            
        query += " ORDER BY updated_at DESC"
        
        cursor.execute(query, params)
        tasks = cursor.fetchall()
        
        return [
            TaskResponse(
                id=str(task["id"]),
                user_id=str(task["user_id"]),
                thread_id=task["thread_id"],
                task_name=task["task_name"],
                status=task["status"],
                checkpoint_count=task["checkpoint_count"],
                created_at=task["created_at"].isoformat(),
                updated_at=task["updated_at"].isoformat(),
                metadata=task["metadata"] or {}
            )
            for task in tasks
        ]
        
    finally:
        cursor.close()
        conn.close()

async def create_or_update_task(user_id: str, thread_id: str, task_name: Optional[str] = None) -> TaskResponse:
    """创建或更新用户任务"""
    conn = get_db_connection()
    try:
        cursor = conn.cursor()
        
        cursor.execute("""
            INSERT INTO user_tasks (user_id, thread_id, task_name)
            VALUES (%s, %s, %s)
            ON CONFLICT (user_id, thread_id) 
            DO UPDATE SET 
                task_name = COALESCE(EXCLUDED.task_name, user_tasks.task_name),
                updated_at = NOW()
            RETURNING *
        """, (user_id, thread_id, task_name or f"Task {thread_id[:8]}"))
        
        result = cursor.fetchone()
        conn.commit()
        
        return TaskResponse(
            id=str(result["id"]),
            user_id=str(result["user_id"]),
            thread_id=result["thread_id"],
            task_name=result["task_name"],
            status=result["status"],
            checkpoint_count=result["checkpoint_count"],
            created_at=result["created_at"].isoformat(),
            updated_at=result["updated_at"].isoformat(),
            metadata=result["metadata"] or {}
        )
        
    finally:
        cursor.close()
        conn.close()

# 向后兼容函数
async def get_current_user_email(request: Request) -> str:
    """向后兼容：从请求中获取用户邮箱"""
    try:
        # 尝试从 Authorization header 获取
        auth_header = request.headers.get("Authorization")
        if auth_header:
            user_data = await get_current_user(auth_header)
            return user_data["email"]
    except:
        pass
    
    # 降级到旧的 header 方式
    user_email = request.headers.get("X-User-Email")
    if not user_email:
        raise HTTPException(status_code=401, detail="Authentication required")
    return user_email 