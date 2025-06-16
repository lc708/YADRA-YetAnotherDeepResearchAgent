#!/usr/bin/env python3
"""
Supabase Client Manager
管理 Supabase 客户端实例和认证功能
"""

import os
import logging
from typing import Optional, Dict, Any
from supabase import create_client, Client
from gotrue.types import Session, User
from gotrue.errors import AuthApiError
from fastapi import HTTPException
from dotenv import load_dotenv

logger = logging.getLogger(__name__)
load_dotenv()

# Supabase 配置
SUPABASE_URL = os.getenv("NEXT_PUBLIC_SUPABASE_URL")
SUPABASE_ANON_KEY = os.getenv("NEXT_PUBLIC_SUPABASE_ANON_KEY")
SUPABASE_SERVICE_KEY = os.getenv("SUPABASE_SERVICE_KEY")  # 可选，用于服务端操作

if not SUPABASE_URL or not SUPABASE_ANON_KEY:
    logger.error("Supabase configuration missing. Please set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY")
    raise ValueError("Supabase configuration is incomplete")

# 创建 Supabase 客户端实例
supabase: Client = create_client(SUPABASE_URL, SUPABASE_ANON_KEY)

# 如果有 service key，创建服务端客户端（具有更高权限）
supabase_admin: Optional[Client] = None
if SUPABASE_SERVICE_KEY:
    supabase_admin = create_client(SUPABASE_URL, SUPABASE_SERVICE_KEY)
    logger.info("Supabase admin client initialized")

def get_supabase_client() -> Client:
    """获取 Supabase 客户端实例"""
    return supabase

def get_supabase_admin() -> Optional[Client]:
    """获取 Supabase 管理员客户端（如果可用）"""
    return supabase_admin 