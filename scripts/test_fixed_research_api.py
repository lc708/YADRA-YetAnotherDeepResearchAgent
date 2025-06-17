#!/usr/bin/env python3
"""
测试修复后的research stream API
"""
import asyncio
import json
import os
import sys
import uuid
from typing import Dict, Any

# 添加项目根目录到路径
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from src.server.research_stream_api import ResearchStreamService, ResearchStreamRequest, ActionType
from src.server.repositories.session_repository import get_session_repository
from dotenv import load_dotenv

async def test_research_stream():
    """测试研究流API"""
    load_dotenv()
    
    # 获取数据库连接
    db_url = os.getenv("DATABASE_URL")
    if not db_url:
        print("❌ 数据库URL未配置")
        return
    
    print("🔧 初始化服务...")
    session_repo = get_session_repository(db_url)
    service = ResearchStreamService(session_repo)
    
    # 创建测试请求
    request = ResearchStreamRequest(
        action=ActionType.CREATE,
        message="如何利用AI提高工作效率？",
        frontend_uuid=str(uuid.uuid4()),
        frontend_context_uuid=str(uuid.uuid4()),
        visitor_id=str(uuid.uuid4()),
        user_id="f0fdc14b-28bc-4ef4-9776-b9838d5425f7",  # 使用现有用户ID
        config={
            "research_config": {
                "enable_background_investigation": True,
                "report_style": "detailed",
                "max_research_depth": 3
            },
            "model_config": {
                "model_name": "claude-3-5-sonnet-20241022",
                "provider": "anthropic",
                "temperature": 0.7
            },
            "output_config": {
                "language": "zh-CN",
                "format": "markdown"
            }
        }
    )
    
    print("🚀 开始测试研究流...")
    
    event_count = 0
    events_received = []
    
    try:
        async for event in service.create_research_stream(request):
            event_count += 1
            event_type = event.get("event")
            data = json.loads(event.get("data", "{}"))
            
            print(f"📨 事件 #{event_count}: {event_type}")
            
            # 记录重要事件
            if event_type == "navigation":
                print(f"   ✅ 导航: {data.get('workspace_url')}")
                events_received.append("navigation")
            elif event_type == "metadata":
                print(f"   📋 元数据: 执行ID {data.get('execution_id')}")
                events_received.append("metadata")
            elif event_type == "node_start":
                print(f"   🔄 节点开始: {data.get('node_name')}")
                events_received.append(f"node_start:{data.get('node_name')}")
            elif event_type == "node_complete":
                print(f"   ✅ 节点完成: {data.get('node_name')}")
                events_received.append(f"node_complete:{data.get('node_name')}")
            elif event_type == "message_chunk":
                content = data.get('content', '')
                print(f"   💬 消息块: {content[:50]}...")
                events_received.append("message_chunk")
            elif event_type == "plan_generated":
                print(f"   📋 计划生成: 迭代 {data.get('plan_iterations')}")
                events_received.append("plan_generated")
            elif event_type == "search_results":
                results_count = len(data.get('results', []))
                print(f"   🔍 搜索结果: {results_count} 个结果")
                events_received.append("search_results")
            elif event_type == "artifact":
                print(f"   📄 Artifact: {data.get('type')} - {data.get('title')}")
                events_received.append("artifact")
            elif event_type == "progress":
                current = data.get('current_node')
                completed = len(data.get('completed_nodes', []))
                print(f"   📊 进度: 当前节点 {current}, 已完成 {completed} 个节点")
                events_received.append("progress")
            elif event_type == "complete":
                duration = data.get('total_duration_ms', 0)
                tokens = data.get('tokens_consumed', {})
                print(f"   🎉 完成: 耗时 {duration}ms, tokens: {tokens}")
                events_received.append("complete")
            elif event_type == "error":
                print(f"   ❌ 错误: {data.get('error_message')}")
                events_received.append("error")
            
            # 限制事件数量避免无限循环
            if event_count > 50:
                print("⚠️  达到最大事件数量限制，停止测试")
                break
                
    except Exception as e:
        print(f"❌ 测试失败: {e}")
        import traceback
        traceback.print_exc()
        return
    
    print(f"\n📊 测试总结:")
    print(f"   总事件数: {event_count}")
    print(f"   接收到的事件类型: {set(events_received)}")
    
    # 验证关键事件
    required_events = ["navigation", "metadata"]
    missing_events = [e for e in required_events if e not in events_received]
    
    if missing_events:
        print(f"❌ 缺失关键事件: {missing_events}")
    else:
        print("✅ 所有关键事件都已接收")
    
    # 检查是否有LangGraph节点执行
    node_events = [e for e in events_received if e.startswith("node_")]
    if node_events:
        print(f"✅ LangGraph节点执行正常: {node_events}")
    else:
        print("⚠️  未检测到LangGraph节点执行事件")

async def test_workspace_api():
    """测试workspace API"""
    load_dotenv()
    
    # 获取数据库连接
    db_url = os.getenv("DATABASE_URL")
    session_repo = get_session_repository(db_url)
    
    print("\n🔧 测试Workspace API...")
    
    # 查找一个现有的会话
    try:
        from src.server.research_stream_api import get_workspace_data
        
        # 这里我们需要一个真实的url_param，先跳过这个测试
        print("⚠️  跳过Workspace API测试（需要真实的url_param）")
        
    except Exception as e:
        print(f"❌ Workspace API测试失败: {e}")

if __name__ == "__main__":
    print("🧪 开始测试修复后的Research Stream API")
    asyncio.run(test_research_stream())
    asyncio.run(test_workspace_api())
    print("🏁 测试完成") 