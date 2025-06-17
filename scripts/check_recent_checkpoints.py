#!/usr/bin/env python3
import asyncio
import os
import sys
from dotenv import load_dotenv
from datetime import datetime, timedelta

# 添加项目根目录到路径
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from src.server.repositories.session_repository import get_session_repository

async def check_recent_checkpoints():
    load_dotenv()
    db_url = os.getenv('DATABASE_URL')
    
    if not db_url:
        print("❌ 数据库URL未配置")
        return
        
    repo = get_session_repository(db_url)
    
    try:
        async with await repo.get_connection() as conn:
            cursor = conn.cursor()
            
            # 查看最近1小时的checkpoint记录
            print('🔍 查看最近1小时的checkpoint记录...')
            await cursor.execute("""
                SELECT 
                    thread_id, 
                    checkpoint_id, 
                    (checkpoint->>'ts')::timestamp as timestamp,
                    metadata->>'step' as step,
                    metadata->>'source' as source
                FROM checkpoints 
                WHERE (checkpoint->>'ts')::timestamp > NOW() - INTERVAL '1 hour'
                ORDER BY (checkpoint->>'ts')::timestamp DESC
                LIMIT 10
            """)
            recent_checkpoints = await cursor.fetchall()
            
            if recent_checkpoints:
                print(f'📊 找到 {len(recent_checkpoints)} 条最近记录:')
                for record in recent_checkpoints:
                    print(f'  Thread: {record["thread_id"][:20]}... | Step: {record["step"]} | Source: {record["source"]} | Time: {record["timestamp"]}')
            else:
                print('❌ 最近1小时内没有checkpoint记录')
            
            # 查看最近的thread_id
            print('\n🔍 最近10个thread_id:')
            await cursor.execute("""
                SELECT DISTINCT thread_id, MIN((checkpoint->>'ts')::timestamp) as first_seen
                FROM checkpoints 
                GROUP BY thread_id
                ORDER BY first_seen DESC
                LIMIT 10
            """)
            recent_threads = await cursor.fetchall()
            
            for thread in recent_threads:
                print(f'  {thread["thread_id"]} | 首次出现: {thread["first_seen"]}')
            
            # 查看session_mapping表中最近的记录
            print('\n🔍 session_mapping表最近记录:')
            await cursor.execute("""
                SELECT thread_id, url_param, initial_question, created_at
                FROM session_mapping 
                ORDER BY created_at DESC
                LIMIT 5
            """)
            recent_sessions = await cursor.fetchall()
            
            for session in recent_sessions:
                print(f'  Thread: {session["thread_id"]} | URL: {session["url_param"]} | 问题: {session["initial_question"][:30]}... | 时间: {session["created_at"]}')
                
    except Exception as e:
        print(f'❌ 查询失败: {e}')
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    asyncio.run(check_recent_checkpoints()) 