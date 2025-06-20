#!/usr/bin/env python3
"""
测试数据保存修复效果
"""

import asyncio
import aiohttp
import json
import time
from datetime import datetime
import sys
import os
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from src.server.repositories.session_repository import get_session_repository
from dotenv import load_dotenv

load_dotenv()

async def test_create_and_check_data():
    """测试创建研究任务并检查数据保存"""
    print("🧪 测试数据保存修复效果")
    print("=" * 50)
    
    # 1. 创建研究任务
    print("\n1️⃣ 创建研究任务...")
    create_url = "http://localhost:8000/api/research/ask"
    create_data = {
        "question": "测试数据保存功能：人工智能的发展历程",
        "ask_type": "initial",
        "frontend_uuid": "test-uuid-12345",
        "visitor_id": "test-visitor-67890",
        "config": {
            "research_config": {
                "report_style": "academic",
                "enable_background_investigation": True
            },
            "model_config": {
                "model_name": "claude-3-5-sonnet",
                "provider": "anthropic"
            },
            "output_config": {
                "output_format": "markdown"
            }
        }
    }
    
    try:
        async with aiohttp.ClientSession() as session:
            async with session.post(create_url, json=create_data) as response:
                if response.status == 200:
                    result = await response.json()
                    url_param = result["url_param"]
                    print(f"   ✅ 研究任务创建成功: {url_param}")
                else:
                    print(f"   ❌ 创建失败: {response.status}")
                    return False
    except Exception as e:
        print(f"   ❌ 请求失败: {e}")
        return False
    
    # 2. 等待后台任务处理
    print("\n2️⃣ 等待后台任务处理（30秒）...")
    await asyncio.sleep(30)
    
    # 3. 检查workspace数据
    print("\n3️⃣ 检查workspace数据...")
    workspace_url = f"http://localhost:8000/api/research/workspace/{url_param}"
    
    try:
        async with aiohttp.ClientSession() as session:
            async with session.get(workspace_url) as response:
                if response.status == 200:
                    data = await response.json()
                    
                    print(f"   Thread ID: {data.get('thread_id')}")
                    print(f"   Status: {data.get('status')}")
                    
                    messages = data.get('messages', [])
                    artifacts = data.get('artifacts', [])
                    
                    print(f"   消息数量: {len(messages)}")
                    print(f"   Artifacts数量: {len(artifacts)}")
                    
                    if messages:
                        print("\n   📝 消息列表:")
                        for i, msg in enumerate(messages[:3]):  # 只显示前3条
                            role = msg.get('role', 'unknown')
                            content_preview = msg.get('content', '')[:100] + "..." if len(msg.get('content', '')) > 100 else msg.get('content', '')
                            source = msg.get('metadata', {}).get('source_agent', 'unknown')
                            print(f"     {i+1}. [{role}] {source}: {content_preview}")
                    
                    if artifacts:
                        print("\n   🎨 Artifacts列表:")
                        for i, art in enumerate(artifacts):
                            art_type = art.get('type', 'unknown')
                            title = art.get('title', 'untitled')
                            content_preview = art.get('content', '')[:100] + "..." if len(art.get('content', '')) > 100 else art.get('content', '')
                            print(f"     {i+1}. [{art_type}] {title}: {content_preview}")
                    
                    # 判断修复是否成功
                    if messages or artifacts:
                        print(f"\n   ✅ 数据保存修复成功！找到 {len(messages)} 条消息和 {len(artifacts)} 个artifacts")
                        return True
                    else:
                        print(f"\n   ❌ 数据保存仍有问题：没有找到消息或artifacts")
                        return False
                        
                else:
                    print(f"   ❌ 获取workspace数据失败: {response.status}")
                    return False
                    
    except Exception as e:
        print(f"   ❌ 请求失败: {e}")
        return False

async def test_realtime_connection():
    """测试实时流连接逻辑"""
    print("🔄 测试实时流连接逻辑...")
    
    try:
        # 获取数据库连接
        db_url = os.getenv("DATABASE_URL")
        session_repo = get_session_repository(db_url)
        
        # 查询最近的session
        print("📊 查询最近的session...")
        
        import psycopg
        from psycopg.rows import dict_row
        
        async with await psycopg.AsyncConnection.connect(db_url) as conn:
            cursor = conn.cursor(row_factory=dict_row)
            
            # 查询最近的session
            await cursor.execute("""
                SELECT s.id, s.thread_id, s.url_param, s.created_at,
                       COUNT(m.id) as message_count,
                       COUNT(a.id) as artifact_count
                FROM session_mapping s
                LEFT JOIN message_history m ON s.id = m.session_id
                LEFT JOIN artifact_storage a ON s.id = a.session_id
                GROUP BY s.id, s.thread_id, s.url_param, s.created_at
                ORDER BY s.created_at DESC
                LIMIT 5
            """)
            sessions = await cursor.fetchall()
            
            print(f"📋 找到 {len(sessions)} 个最近的session:")
            for session in sessions:
                print(f"  - Session ID: {session['id']}")
                print(f"    Thread ID: {session['thread_id']}")
                print(f"    URL Param: {session['url_param']}")
                print(f"    Messages: {session['message_count']}")
                print(f"    Artifacts: {session['artifact_count']}")
                print(f"    Created: {session['created_at']}")
                print()
            
            if sessions:
                # 测试checkpoint查询
                test_thread_id = sessions[0]['thread_id']
                print(f"🔍 测试checkpoint查询 - Thread ID: {test_thread_id}")
                
                # 查询checkpoints表
                await cursor.execute("""
                    SELECT thread_id, checkpoint_id, created_at
                    FROM checkpoints 
                    WHERE thread_id = %s
                    ORDER BY created_at DESC
                    LIMIT 3
                """, (test_thread_id,))
                checkpoints = await cursor.fetchall()
                
                print(f"📊 找到 {len(checkpoints)} 个checkpoint:")
                for cp in checkpoints:
                    print(f"  - Checkpoint ID: {cp['checkpoint_id']}")
                    print(f"    Created: {cp['created_at']}")
                
                # 测试LangGraph状态查询
                print(f"🔄 测试LangGraph状态查询...")
                
                try:
                    from src.graph.async_builder import create_graph
                    
                    graph = await create_graph()
                    config = {"configurable": {"thread_id": test_thread_id}}
                    
                    state_snapshot = await graph.aget_state(config)
                    
                    if state_snapshot and state_snapshot.values:
                        print(f"✅ LangGraph状态查询成功")
                        print(f"   State keys: {list(state_snapshot.values.keys())}")
                        print(f"   Config: {state_snapshot.config}")
                        
                        # 检查状态内容
                        if 'messages' in state_snapshot.values:
                            messages = state_snapshot.values['messages']
                            print(f"   Messages count: {len(messages) if isinstance(messages, list) else 'N/A'}")
                        
                        if 'research_topic' in state_snapshot.values:
                            topic = state_snapshot.values['research_topic']
                            print(f"   Research topic: {topic}")
                            
                    else:
                        print(f"❌ LangGraph状态查询失败 - 没有找到状态")
                        
                except Exception as graph_error:
                    print(f"❌ LangGraph状态查询出错: {graph_error}")
                    import traceback
                    traceback.print_exc()
            
            else:
                print("❌ 没有找到任何session")
                
    except Exception as e:
        print(f"❌ 测试失败: {e}")
        import traceback
        traceback.print_exc()

async def test_checkpoint_creation():
    """测试checkpoint创建逻辑"""
    print("\n🔄 测试checkpoint创建逻辑...")
    
    try:
        from src.graph.async_builder import create_graph
        import uuid
        
        # 创建测试thread_id
        test_thread_id = f"test_checkpoint_{uuid.uuid4().hex[:8]}"
        print(f"🆔 使用测试Thread ID: {test_thread_id}")
        
        # 创建graph实例
        graph = await create_graph()
        config = {"configurable": {"thread_id": test_thread_id}}
        
        # 准备初始状态
        initial_state = {
            "messages": [{"role": "user", "content": "测试checkpoint创建"}],
            "research_topic": "测试主题",
            "locale": "zh-CN",
            "auto_accepted_plan": True,
            "enable_background_investigation": False,
            "plan_iterations": 0
        }
        
        print(f"📝 创建初始checkpoint...")
        
        # 使用aupdate_state创建初始checkpoint
        await graph.aupdate_state(config, initial_state, as_node="__start__")
        print(f"✅ 初始checkpoint创建完成")
        
        # 验证checkpoint
        state_snapshot = await graph.aget_state(config)
        if state_snapshot and state_snapshot.values:
            print(f"✅ Checkpoint验证成功")
            print(f"   State keys: {list(state_snapshot.values.keys())}")
            print(f"   Research topic: {state_snapshot.values.get('research_topic', 'N/A')}")
        else:
            print(f"❌ Checkpoint验证失败")
            
        # 查询数据库中的checkpoint
        db_url = os.getenv("DATABASE_URL")
        import psycopg
        from psycopg.rows import dict_row
        
        async with await psycopg.AsyncConnection.connect(db_url) as conn:
            cursor = conn.cursor(row_factory=dict_row)
            
            await cursor.execute("""
                SELECT COUNT(*) as count
                FROM checkpoints 
                WHERE thread_id = %s
            """, (test_thread_id,))
            result = await cursor.fetchone()
            
            print(f"📊 数据库中的checkpoint数量: {result['count']}")
            
    except Exception as e:
        print(f"❌ Checkpoint创建测试失败: {e}")
        import traceback
        traceback.print_exc()

async def main():
    success = await test_create_and_check_data()
    if success:
        print("\n🎉 测试通过！数据保存修复成功！")
    else:
        print("\n💥 测试失败！需要进一步调试")
    
    return success

if __name__ == "__main__":
    result = asyncio.run(main())
    exit(0 if result else 1)
    asyncio.run(test_realtime_connection())
    asyncio.run(test_checkpoint_creation()) 