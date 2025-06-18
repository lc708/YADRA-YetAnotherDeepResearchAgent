#!/usr/bin/env python3
"""
测试HTTP API端点
"""
import asyncio
import aiohttp
import json
import uuid
from typing import Dict, Any

async def test_research_stream_api():
    """测试研究流HTTP API"""
    
    # API端点
    base_url = "http://localhost:8000"
    stream_endpoint = f"{base_url}/api/research/stream"
    workspace_endpoint = f"{base_url}/api/research/workspace"
    
    # 测试数据
    test_request = {
        "action": "create",
        "message": "如何利用AI提高工作效率？",
        "frontend_uuid": str(uuid.uuid4()),
        "frontend_context_uuid": str(uuid.uuid4()),
        "visitor_id": str(uuid.uuid4()),
        "user_id": "f0fdc14b-28bc-4ef4-9776-b9838d5425f7",  # 使用现有用户ID
        "config": {
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
    }
    
    print("🧪 开始测试HTTP API端点")
    
    try:
        async with aiohttp.ClientSession() as session:
            print(f"🔗 测试端点: {stream_endpoint}")
            
            # 发送POST请求
            async with session.post(
                stream_endpoint,
                json=test_request,
                headers={"Content-Type": "application/json"}
            ) as response:
                print(f"📊 响应状态: {response.status}")
                print(f"📋 响应头: {dict(response.headers)}")
                
                if response.status == 200:
                    print("✅ API端点可访问")
                    
                    # 读取SSE流
                    event_count = 0
                    url_param = None
                    
                    async for line in response.content:
                        line_str = line.decode('utf-8').strip()
                        
                        if line_str.startswith('event:'):
                            event_type = line_str[6:].strip()
                            print(f"📨 事件类型: {event_type}")
                            
                        elif line_str.startswith('data:'):
                            data_str = line_str[5:].strip()
                            try:
                                data = json.loads(data_str)
                                
                                # 提取navigation事件中的url_param
                                if event_type == 'navigation' and 'url_param' in data:
                                    url_param = data['url_param']
                                    print(f"🔗 获得URL参数: {url_param}")
                                
                                print(f"📊 事件数据: {json.dumps(data, ensure_ascii=False)[:100]}...")
                                
                            except json.JSONDecodeError:
                                print(f"⚠️  JSON解析失败: {data_str[:50]}...")
                            
                            event_count += 1
                            
                            # 限制事件数量避免无限循环
                            if event_count > 20:
                                print("⚠️  达到事件数量限制，停止测试")
                                break
                    
                    print(f"📊 总共接收到 {event_count} 个事件")
                    
                    # 如果获得了url_param，测试workspace API
                    if url_param:
                        print(f"\n🔧 测试Workspace API: {url_param}")
                        workspace_url = f"{workspace_endpoint}/{url_param}"
                        
                        async with session.get(workspace_url) as ws_response:
                            print(f"📊 Workspace响应状态: {ws_response.status}")
                            
                            if ws_response.status == 200:
                                ws_data = await ws_response.json()
                                print(f"✅ Workspace API正常")
                                print(f"📋 数据字段: {list(ws_data.keys())}")
                                print(f"📊 消息数量: {len(ws_data.get('messages', []))}")
                                print(f"🎯 执行统计: {ws_data.get('execution_stats', {})}")
                            else:
                                error_text = await ws_response.text()
                                print(f"❌ Workspace API失败: {error_text}")
                    
                else:
                    error_text = await response.text()
                    print(f"❌ API请求失败: {error_text}")
                    
    except aiohttp.ClientConnectorError:
        print("❌ 无法连接到服务器，请确保服务器正在运行")
        print("💡 运行命令: ./bootstrap.sh --dev")
        
    except Exception as e:
        print(f"❌ 测试失败: {e}")
        import traceback
        traceback.print_exc()

async def test_api_health():
    """测试API健康状态"""
    base_url = "http://localhost:8000"
    
    try:
        async with aiohttp.ClientSession() as session:
            # 测试基础端点
            async with session.get(f"{base_url}/docs") as response:
                if response.status == 200:
                    print("✅ 服务器运行正常")
                    return True
                else:
                    print(f"⚠️  服务器状态异常: {response.status}")
                    return False
                    
    except aiohttp.ClientConnectorError:
        print("❌ 服务器未运行")
        return False

if __name__ == "__main__":
    print("🚀 开始HTTP API测试")
    
    # 首先检查服务器健康状态
    health_ok = asyncio.run(test_api_health())
    
    if health_ok:
        # 测试研究流API
        asyncio.run(test_research_stream_api())
    else:
        print("💡 请先启动开发服务器: ./bootstrap.sh --dev")
    
    print("🏁 测试完成") 