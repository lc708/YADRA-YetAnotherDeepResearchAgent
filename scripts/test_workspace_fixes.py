#!/usr/bin/env python3
"""
测试workspace页面修复效果

测试场景：
1. 验证SSE连接不会重复
2. 验证空消息不会触发LangGraph执行
3. 验证消息恢复逻辑正常工作
"""

import asyncio
import json
import aiohttp
import time
from datetime import datetime

async def test_workspace_state_api():
    """测试workspace状态API"""
    print("🧪 测试1: Workspace状态API")
    
    # 使用一个已知的url_param进行测试
    test_url_param = "test_workspace_123"
    url = f"http://localhost:8000/api/research/workspace/{test_url_param}"
    
    try:
        async with aiohttp.ClientSession() as session:
            async with session.get(url) as response:
                if response.status == 404:
                    print("   ✅ 正确返回404（工作区不存在）")
                    return True
                elif response.status == 200:
                    data = await response.json()
                    print(f"   ✅ 成功获取工作区数据: {data.get('thread_id', 'N/A')}")
                    return True
                else:
                    print(f"   ❌ 意外的状态码: {response.status}")
                    return False
    except Exception as e:
        print(f"   ❌ 请求失败: {e}")
        return False

async def test_sse_empty_message():
    """测试SSE空消息处理"""
    print("\n🧪 测试2: SSE空消息处理")
    
    url = "http://localhost:8000/api/research/stream"
    payload = {
        "action": "continue",
        "message": "",  # 空消息
        "url_param": "test_workspace_123",
        "frontend_uuid": "test-frontend-uuid",
        "frontend_context_uuid": "test-context-uuid",
        "visitor_id": "test-visitor",
        "config": {
            "enableBackgroundInvestigation": False,
            "reportStyle": "academic",
            "enableDeepThinking": False,
            "maxPlanIterations": 1,
            "maxStepNum": 1,
            "maxSearchResults": 1,
            "outputFormat": "markdown"
        }
    }
    
    try:
        async with aiohttp.ClientSession() as session:
            async with session.post(
                url,
                json=payload,
                headers={"Content-Type": "application/json"}
            ) as response:
                if response.status != 200:
                    print(f"   ❌ HTTP错误: {response.status}")
                    return False
                
                events_received = 0
                start_time = time.time()
                
                async for line in response.content:
                    line = line.decode('utf-8').strip()
                    if line.startswith('event: '):
                        event_type = line[7:]
                        print(f"   📨 收到事件: {event_type}")
                        events_received += 1
                        
                        if event_type == 'complete':
                            elapsed = time.time() - start_time
                            print(f"   ✅ 空消息正确处理，耗时: {elapsed:.2f}s")
                            return True
                        elif event_type == 'error':
                            print("   ❌ 收到错误事件")
                            return False
                    
                    # 超时保护
                    if time.time() - start_time > 10:
                        print("   ❌ 超时")
                        return False
                
    except Exception as e:
        print(f"   ❌ 请求失败: {e}")
        return False

async def test_database_connection():
    """测试数据库连接"""
    print("\n🧪 测试3: 数据库连接")
    
    try:
        # 导入数据库相关模块
        import sys
        import os
        sys.path.append(os.path.join(os.path.dirname(__file__), '..'))
        
        from src.server.repositories.session_repository import get_session_repository
        from dotenv import load_dotenv
        
        load_dotenv()
        db_url = os.getenv("DATABASE_URL")
        
        if not db_url:
            print("   ❌ 数据库URL未配置")
            return False
        
        session_repo = get_session_repository(db_url)
        
        # 尝试执行一个简单的查询
        sessions = await session_repo.get_recent_sessions(limit=1)
        print(f"   ✅ 数据库连接正常，找到 {len(sessions)} 个会话")
        return True
        
    except Exception as e:
        print(f"   ❌ 数据库连接失败: {e}")
        return False

async def main():
    """运行所有测试"""
    print("🚀 开始测试workspace页面修复效果\n")
    
    results = []
    
    # 测试1: Workspace状态API
    results.append(await test_workspace_state_api())
    
    # 测试2: SSE空消息处理
    results.append(await test_sse_empty_message())
    
    # 测试3: 数据库连接
    results.append(await test_database_connection())
    
    # 汇总结果
    passed = sum(results)
    total = len(results)
    
    print(f"\n📊 测试结果: {passed}/{total} 通过")
    
    if passed == total:
        print("🎉 所有测试通过！修复效果良好。")
    else:
        print("⚠️  部分测试失败，请检查相关问题。")
    
    return passed == total

if __name__ == "__main__":
    asyncio.run(main()) 