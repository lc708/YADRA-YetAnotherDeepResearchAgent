#!/usr/bin/env python3
"""
验证数据库保存逻辑是否成功
检查message_history和artifact_storage表的数据
"""

import asyncio
import os
from datetime import datetime, timedelta
from dotenv import load_dotenv
import psycopg
from psycopg.rows import dict_row

async def verify_data_saving():
    """验证数据库保存情况"""
    load_dotenv()
    
    db_url = os.getenv("DATABASE_URL")
    if not db_url:
        print("❌ DATABASE_URL not found")
        return
    
    try:
        async with await psycopg.AsyncConnection.connect(db_url, row_factory=dict_row) as conn:
            cursor = conn.cursor()
            
            print("🔍 检查最近的数据保存情况...")
            
            # 检查最近的session
            await cursor.execute("""
                SELECT thread_id, url_param, initial_question, status, created_at
                FROM session_mapping 
                ORDER BY created_at DESC 
                LIMIT 5
            """)
            sessions = await cursor.fetchall()
            
            if not sessions:
                print("❌ 没有找到任何session记录")
                return
            
            print(f"\n📋 最近的{len(sessions)}个session:")
            for session in sessions:
                print(f"  - {session['thread_id'][:8]}... | {session['url_param'][:20]}... | {session['status']} | {session['created_at']}")
            
            # 选择最新的session进行详细检查
            latest_session = sessions[0]
            thread_id = latest_session['thread_id']
            
            print(f"\n🔍 详细检查session: {thread_id}")
            
            # 获取session_id
            await cursor.execute("SELECT id FROM session_mapping WHERE thread_id = %s", (thread_id,))
            session_result = await cursor.fetchone()
            if not session_result:
                print("❌ 无法找到session ID")
                return
            
            session_id = session_result['id']
            
            # 检查message_history表
            await cursor.execute("""
                SELECT COUNT(*) as count, MAX(timestamp) as latest_message
                FROM message_history 
                WHERE session_id = %s
            """, (session_id,))
            message_stats = await cursor.fetchone()
            
            print(f"📨 Message History:")
            print(f"  - 消息数量: {message_stats['count']}")
            print(f"  - 最新消息时间: {message_stats['latest_message']}")
            
            if message_stats['count'] > 0:
                # 显示最近的消息
                await cursor.execute("""
                    SELECT role, content_type, source_agent, timestamp, 
                           LEFT(content, 100) as content_preview
                    FROM message_history 
                    WHERE session_id = %s 
                    ORDER BY timestamp DESC 
                    LIMIT 3
                """, (session_id,))
                recent_messages = await cursor.fetchall()
                
                print("  最近的消息:")
                for msg in recent_messages:
                    print(f"    - {msg['role']} | {msg['content_type']} | {msg['source_agent']} | {msg['content_preview'][:50]}...")
            
            # 检查artifact_storage表
            await cursor.execute("""
                SELECT COUNT(*) as count, MAX(created_at) as latest_artifact
                FROM artifact_storage 
                WHERE session_id = %s
            """, (session_id,))
            artifact_stats = await cursor.fetchone()
            
            print(f"\n🎯 Artifact Storage:")
            print(f"  - Artifact数量: {artifact_stats['count']}")
            print(f"  - 最新artifact时间: {artifact_stats['latest_artifact']}")
            
            if artifact_stats['count'] > 0:
                # 显示最近的artifacts
                await cursor.execute("""
                    SELECT type, title, source_agent, created_at,
                           LENGTH(content) as content_length
                    FROM artifact_storage 
                    WHERE session_id = %s 
                    ORDER BY created_at DESC 
                    LIMIT 3
                """, (session_id,))
                recent_artifacts = await cursor.fetchall()
                
                print("  最近的artifacts:")
                for artifact in recent_artifacts:
                    print(f"    - {artifact['type']} | {artifact['title']} | {artifact['source_agent']} | {artifact['content_length']}字符")
            
            # 检查execution_record表
            await cursor.execute("""
                SELECT COUNT(*) as count, 
                       SUM(CASE WHEN status = 'running' THEN 1 ELSE 0 END) as running_count,
                       SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as completed_count,
                       SUM(CASE WHEN status = 'error' THEN 1 ELSE 0 END) as error_count
                FROM execution_record 
                WHERE session_id = %s
            """, (session_id,))
            exec_stats = await cursor.fetchone()
            
            print(f"\n⚡ Execution Records:")
            print(f"  - 总执行次数: {exec_stats['count']}")
            print(f"  - 运行中: {exec_stats['running_count']}")
            print(f"  - 已完成: {exec_stats['completed_count']}")
            print(f"  - 错误: {exec_stats['error_count']}")
            
            # 检查checkpoints表（LangGraph的数据）
            await cursor.execute("""
                SELECT COUNT(*) as count, MAX(checkpoint_ns) as latest_checkpoint
                FROM checkpoints 
                WHERE thread_id = %s
            """, (thread_id,))
            checkpoint_stats = await cursor.fetchone()
            
            print(f"\n🏁 LangGraph Checkpoints:")
            print(f"  - Checkpoint数量: {checkpoint_stats['count']}")
            print(f"  - 最新checkpoint: {checkpoint_stats['latest_checkpoint']}")
            
            # 总结
            print(f"\n📊 数据一致性检查:")
            has_messages = message_stats['count'] > 0
            has_artifacts = artifact_stats['count'] > 0
            has_checkpoints = checkpoint_stats['count'] > 0
            
            print(f"  - LangGraph数据 (checkpoints): {'✅' if has_checkpoints else '❌'}")
            print(f"  - 消息数据 (message_history): {'✅' if has_messages else '❌'}")
            print(f"  - Artifact数据 (artifact_storage): {'✅' if has_artifacts else '❌'}")
            
            if has_checkpoints and not (has_messages or has_artifacts):
                print("⚠️  发现问题：LangGraph有数据，但自定义表为空！")
                print("   这说明save_message/save_artifact保存失败")
            elif has_checkpoints and (has_messages or has_artifacts):
                print("✅ 数据保存正常，两个系统都有数据")
            else:
                print("❓ 没有找到任何执行数据")
                
    except Exception as e:
        print(f"❌ 验证失败: {e}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    asyncio.run(verify_data_saving()) 