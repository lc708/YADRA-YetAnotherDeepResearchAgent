#!/usr/bin/env python3
"""
新架构端到端流程测试
测试从首页提交到workspace加载的完整用户旅程
"""

import asyncio
import json
import os
import uuid
import aiohttp
from dotenv import load_dotenv

from src.server.repositories.session_repository import get_session_repository
from src.utils.url_param_generator import generate_url_param


async def test_new_architecture_flow():
    """测试新架构的完整流程"""
    print("🚀 测试新架构端到端流程...")
    print("=" * 60)
    
    load_dotenv()
    base_url = "http://localhost:8000"
    
    # 1. 测试URL参数生成
    print("1️⃣ 测试URL参数生成...")
    test_question = "如何使用人工智能提高工作效率？"
    url_param = generate_url_param(test_question)
    print(f"   问题: {test_question}")
    print(f"   生成的URL参数: {url_param}")
    print(f"   ✅ URL参数生成成功")
    print()
    
    # 2. 测试研究流式API - CREATE操作
    print("2️⃣ 测试研究流式API - CREATE操作...")
    
    # 准备请求数据
    frontend_uuid = str(uuid.uuid4())
    frontend_context_uuid = str(uuid.uuid4())
    visitor_id = str(uuid.uuid4())
    
    create_request = {
        "action": "create",
        "message": test_question,
        "frontend_uuid": frontend_uuid,
        "frontend_context_uuid": frontend_context_uuid,
        "visitor_id": visitor_id,
        "config": {
            "enableBackgroundInvestigation": True,
            "reportStyle": "academic",
            "enableDeepThinking": False,
            "maxPlanIterations": 1,
            "maxStepNum": 3,
            "maxSearchResults": 3,
            "outputFormat": "markdown",
            "includeCitations": True,
            "includeArtifacts": True,
            "userPreferences": {
                "writingStyle": "professional",
                "expertiseLevel": "intermediate",
                "preferredSources": []
            }
        }
    }
    
    try:
        async with aiohttp.ClientSession() as session:
            # 发送POST请求到研究流式API
            async with session.post(
                f"{base_url}/api/research/stream",
                json=create_request,
                headers={"Content-Type": "application/json"}
            ) as response:
                
                print(f"   响应状态: {response.status}")
                
                if response.status == 200:
                    print("   ✅ API响应成功，开始处理SSE流...")
                    
                    # 处理SSE流
                    navigation_data = None
                    event_count = 0
                    total_events = []
                    
                    async for line in response.content:
                        line = line.decode('utf-8').strip()
                        if not line:
                            continue
                            
                        print(f"   📝 原始行: {repr(line)}")
                        
                        if line.startswith('event:'):
                            event_type = line[6:].strip()
                            print(f"   🎯 事件类型: {event_type}")
                        elif line.startswith('data:'):
                            try:
                                event_data = json.loads(line[5:].strip())
                                event_count += 1
                                total_events.append((event_type, event_data))
                                
                                print(f"   📡 接收到事件 {event_count}: {event_type}")
                                print(f"      数据: {event_data}")
                                
                                if event_type == 'navigation':
                                    navigation_data = event_data
                                    print(f"      URL参数: {navigation_data.get('url_param')}")
                                    print(f"      Thread ID: {navigation_data.get('thread_id')}")
                                    print(f"      工作区URL: {navigation_data.get('workspace_url')}")
                                    # 不要break，继续接收后续事件
                                
                                elif event_type == 'metadata':
                                    print(f"      执行ID: {event_data.get('execution_id')}")
                                    print(f"      预计时长: {event_data.get('estimated_duration')}秒")
                                
                                elif event_type == 'progress':
                                    print(f"      当前步骤: {event_data.get('current_step')}")
                                    print(f"      进度: {event_data.get('progress_percentage')}%")
                                    print(f"      状态: {event_data.get('status_message')}")
                                
                                elif event_type == 'message_chunk':
                                    print(f"      消息块: {event_data.get('content')[:100]}...")
                                
                                elif event_type == 'artifact':
                                    print(f"      Artifact类型: {event_data.get('type')}")
                                    print(f"      标题: {event_data.get('title')}")
                                
                                elif event_type == 'complete':
                                    print(f"      执行完成，耗时: {event_data.get('total_duration')}ms")
                                    print(f"      Token消耗: {event_data.get('tokens_consumed')}")
                                    print("   🎉 工作流执行完成！")
                                    # 在complete事件后可以结束
                                    break
                                
                                elif event_type == 'error':
                                    print(f"      错误代码: {event_data.get('error_code')}")
                                    print(f"      错误信息: {event_data.get('error_message')}")
                                    print("   ❌ 工作流执行出错！")
                                    break
                                    
                            except json.JSONDecodeError as e:
                                print(f"   ⚠️ JSON解析失败: {e}")
                                print(f"   原始数据: {line}")
                    
                    print(f"   📊 总共接收到 {event_count} 个事件")
                    if navigation_data:
                        print("   ✅ Navigation事件接收成功")
                        workspace_url_param = navigation_data.get('url_param')
                        
                        # 3. 测试工作区状态获取API
                        print()
                        print("3️⃣ 测试工作区状态获取API...")
                        
                        if workspace_url_param:
                            async with session.get(
                                f"{base_url}/api/research/workspace/{workspace_url_param}"
                            ) as workspace_response:
                                
                                print(f"   响应状态: {workspace_response.status}")
                                
                                if workspace_response.status == 200:
                                    workspace_data = await workspace_response.json()
                                    print("   ✅ 工作区状态获取成功")
                                    print(f"      Thread ID: {workspace_data.get('threadId')}")
                                    print(f"      状态: {workspace_data.get('status')}")
                                    print(f"      消息数量: {len(workspace_data.get('messages', []))}")
                                    print(f"      Artifacts数量: {len(workspace_data.get('artifacts', []))}")
                                    
                                    # 4. 测试会话映射数据库查询
                                    print()
                                    print("4️⃣ 测试会话映射数据库查询...")
                                    
                                    db_url = os.getenv("DATABASE_URL")
                                    if db_url:
                                        repo = get_session_repository(db_url)
                                        
                                        # 通过URL参数查询会话
                                        session_mapping = await repo.get_session_by_url_param(workspace_url_param)
                                        if session_mapping:
                                            print("   ✅ 数据库会话映射查询成功")
                                            print(f"      会话ID: {session_mapping.id}")
                                            print(f"      Thread ID: {session_mapping.thread_id}")
                                            print(f"      URL参数: {session_mapping.url_param}")
                                            print(f"      状态: {session_mapping.status}")
                                            print(f"      创建时间: {session_mapping.created_at}")
                                        else:
                                            print("   ❌ 数据库中未找到会话映射")
                                    else:
                                        print("   ⚠️ 数据库URL未配置，跳过数据库测试")
                                
                                else:
                                    error_text = await workspace_response.text()
                                    print(f"   ❌ 工作区状态获取失败: {error_text}")
                        else:
                            print("   ❌ Navigation事件中未找到URL参数")
                    else:
                        print("   ❌ 未接收到Navigation事件")
                        
                else:
                    error_text = await response.text()
                    print(f"   ❌ API请求失败: {error_text}")
                    
    except Exception as e:
        print(f"   ❌ 请求异常: {e}")
    
    print()
    print("=" * 60)
    print("🎉 新架构端到端流程测试完成！")


if __name__ == "__main__":
    asyncio.run(test_new_architecture_flow()) 