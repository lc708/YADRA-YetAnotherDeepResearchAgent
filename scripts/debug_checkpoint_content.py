#!/usr/bin/env python3
"""
调试特定thread的checkpoint内容
"""

import os
import psycopg
from dotenv import load_dotenv
import json
from datetime import datetime

def debug_checkpoint_content():
    load_dotenv()
    database_url = os.getenv("DATABASE_URL")

    if not database_url:
        print("❌ DATABASE_URL not found")
        return False

    try:
        conn = psycopg.connect(database_url)
        cursor = conn.cursor()

        # 目标thread_id - 检查最新的
        target_thread = "thread_"  # 先查找最新的thread
        
        print(f"🔍 调试thread: {target_thread}")
        print("=" * 60)

        # 1. 查看checkpoint记录
        cursor.execute("""
            SELECT checkpoint_id, type, metadata, 
                   jsonb_pretty(checkpoint) as checkpoint_content
            FROM checkpoints 
            WHERE thread_id = %s 
            ORDER BY checkpoint_id DESC
            LIMIT 5;
        """, (target_thread,))
        
        checkpoints = cursor.fetchall()
        print(f"\n📊 找到 {len(checkpoints)} 个checkpoint:")
        
        for i, (checkpoint_id, type_val, metadata, content) in enumerate(checkpoints):
            print(f"\n🔍 Checkpoint {i+1}: {checkpoint_id}")
            print(f"   Type: {type_val}")
            print(f"   Metadata: {metadata}")
            
            # 解析checkpoint内容
            try:
                checkpoint_data = json.loads(content)
                
                # 检查messages
                if 'channel_values' in checkpoint_data:
                    channel_values = checkpoint_data['channel_values']
                    if 'messages' in channel_values:
                        messages = channel_values['messages']
                        print(f"   Messages count: {len(messages)}")
                        
                        for j, msg in enumerate(messages):
                            if isinstance(msg, dict):
                                msg_type = msg.get('type', 'unknown')
                                content_preview = str(msg.get('content', ''))[:100]
                                print(f"     Message {j+1}: {msg_type} - {content_preview}...")
                    
                    # 检查plan相关数据
                    plan_fields = ['current_plan', 'plan', 'research_plan']
                    for field in plan_fields:
                        if field in channel_values:
                            plan_data = channel_values[field]
                            print(f"   {field}: {type(plan_data)} - {str(plan_data)[:200]}...")
                    
                    # 检查其他重要字段
                    important_fields = ['question', 'research_topic', 'final_report', 'background_investigation_results']
                    for field in important_fields:
                        if field in channel_values:
                            value = channel_values[field]
                            print(f"   {field}: {type(value)} - {str(value)[:100]}...")
                            
            except Exception as e:
                print(f"   ❌ 解析checkpoint内容失败: {e}")

        # 2. 查看checkpoint_writes
        print(f"\n📝 Checkpoint writes:")
        cursor.execute("""
            SELECT checkpoint_id, task_id, channel, type
            FROM checkpoint_writes 
            WHERE thread_id = %s 
            ORDER BY checkpoint_id DESC, idx
            LIMIT 10;
        """, (target_thread,))
        
        writes = cursor.fetchall()
        for checkpoint_id, task_id, channel, type_val in writes:
            print(f"   {checkpoint_id} | {task_id} | {channel} | {type_val}")

        # 3. 查看session_mapping和execution_record
        print(f"\n🔗 Session mapping:")
        cursor.execute("""
            SELECT sm.id as session_id, sm.url_param, sm.status, sm.initial_question,
                   er.execution_id, er.status as exec_status, er.error_message
            FROM session_mapping sm
            LEFT JOIN execution_record er ON sm.id = er.session_id
            WHERE sm.thread_id = %s
            ORDER BY er.created_at DESC;
        """, (target_thread,))
        
        session_data = cursor.fetchall()
        for session_id, url_param, status, question, exec_id, exec_status, error_msg in session_data:
            print(f"   Session {session_id}: {url_param} | {status}")
            print(f"   Question: {question[:100]}...")
            if exec_id:
                print(f"   Execution {exec_id}: {exec_status}")
                if error_msg:
                    print(f"   Error: {error_msg[:200]}...")

        # 4. 查看message_history
        print(f"\n💬 Message history:")
        cursor.execute("""
            SELECT mh.role, mh.content, mh.source_agent, mh.timestamp
            FROM message_history mh
            JOIN session_mapping sm ON mh.session_id = sm.id
            WHERE sm.thread_id = %s
            ORDER BY mh.timestamp DESC
            LIMIT 10;
        """, (target_thread,))
        
        messages = cursor.fetchall()
        if messages:
            for role, content, agent, timestamp in messages:
                print(f"   {timestamp} | {role} | {agent} | {content[:100]}...")
        else:
            print("   ❌ 未找到message_history记录")

        # 5. 查看artifact_storage
        print(f"\n🎨 Artifacts:")
        cursor.execute("""
            SELECT ast.type, ast.title, ast.content, ast.created_at
            FROM artifact_storage ast
            JOIN session_mapping sm ON ast.session_id = sm.id
            WHERE sm.thread_id = %s
            ORDER BY ast.created_at DESC
            LIMIT 5;
        """, (target_thread,))
        
        artifacts = cursor.fetchall()
        if artifacts:
            for art_type, title, content, created_at in artifacts:
                print(f"   {created_at} | {art_type} | {title} | {content[:100]}...")
        else:
            print("   ❌ 未找到artifact记录")

        cursor.close()
        conn.close()
        print("\n✅ 调试完成")
        return True

    except Exception as e:
        print(f"❌ 调试失败: {e}")
        return False


if __name__ == "__main__":
    success = debug_checkpoint_content()
    exit(0 if success else 1) 