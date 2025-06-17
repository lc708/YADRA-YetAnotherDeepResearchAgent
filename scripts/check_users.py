#!/usr/bin/env python3
import asyncio
import os
import sys
from dotenv import load_dotenv

# 添加项目根目录到路径
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from src.server.repositories.session_repository import get_session_repository

async def check_users():
    load_dotenv()
    db_url = os.getenv('DATABASE_URL')
    
    if not db_url:
        print("❌ 数据库URL未配置")
        return
        
    repo = get_session_repository(db_url)
    
    # 查询现有用户 - 使用Supabase的auth.users表
    query = 'SELECT id, email FROM auth.users LIMIT 5'
    try:
        async with await repo.get_connection() as conn:
            cursor = conn.cursor()
            await cursor.execute(query)
            result = await cursor.fetchall()
            
            if result:
                print('📋 现有用户:')
                for row in result:
                    print(f'  ID: {row["id"]}, Email: {row["email"]}')
                return result[0]["id"]  # 返回第一个用户ID
            else:
                print('❌ 数据库中没有用户')
                return None
    except Exception as e:
        print(f'❌ 查询失败: {e}')
        return None

if __name__ == "__main__":
    asyncio.run(check_users()) 