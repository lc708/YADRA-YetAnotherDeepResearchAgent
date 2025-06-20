#!/usr/bin/env python3
"""
测试改造后的ask接口的stream模式
"""

import asyncio
import json
import httpx
import uuid
from datetime import datetime

async def test_ask_stream():
    """测试ask接口的stream模式"""
    
    base_url = "http://localhost:8000"
    
    # 构建测试请求
    request_data = {
        "question": "人工智能的发展历史如何？",
        "ask_type": "initial",
        "frontend_uuid": str(uuid.uuid4()),
        "visitor_id": str(uuid.uuid4()),
        "user_id": None,
        "config": {
            "auto_accepted_plan": False,
            "enableBackgroundInvestigation": True,
            "reportStyle": "academic",
            "enableDeepThinking": False,
            "maxPlanIterations": 3,
            "maxStepNum": 5,
            "maxSearchResults": 5,
            "outputFormat": "markdown"
        }
    }
    
    print(f"🚀 Testing ask API with stream=true")
    print(f"Request: {json.dumps(request_data, indent=2, ensure_ascii=False)}")
    print(f"URL: {base_url}/api/research/ask?stream=true")
    print("=" * 60)
    
    try:
        async with httpx.AsyncClient(timeout=300.0) as client:
            # 测试stream=true模式
            async with client.stream(
                "POST",
                f"{base_url}/api/research/ask?stream=true",
                json=request_data,
                headers={"Accept": "text/event-stream"}
            ) as response:
                
                print(f"Response status: {response.status_code}")
                print(f"Response headers: {dict(response.headers)}")
                print("=" * 60)
                
                if response.status_code != 200:
                    content = await response.aread()
                    print(f"Error response: {content.decode()}")
                    return
                
                # 处理SSE流
                event_count = 0
                buffer = ""
                
                async for chunk in response.aiter_text():
                    buffer += chunk
                    
                    # 按\n\n分割SSE事件
                    while "\n\n" in buffer:
                        event_data, buffer = buffer.split("\n\n", 1)
                        
                        if event_data.strip():
                            event_count += 1
                            lines = event_data.strip().split("\n")
                            
                            event_type = "data"
                            event_content = ""
                            
                            for line in lines:
                                if line.startswith("event: "):
                                    event_type = line[7:]
                                elif line.startswith("data: "):
                                    event_content = line[6:]
                            
                            print(f"📨 Event #{event_count} [{event_type}]:")
                            
                            # 尝试解析JSON数据
                            try:
                                if event_content:
                                    parsed_data = json.loads(event_content)
                                    print(f"   {json.dumps(parsed_data, indent=2, ensure_ascii=False)}")
                                    
                                    # 特殊处理navigation事件
                                    if event_type == "navigation":
                                        print(f"   🔗 Workspace URL: {parsed_data.get('workspace_url', 'N/A')}")
                                        print(f"   🆔 URL Param: {parsed_data.get('url_param', 'N/A')}")
                                        print(f"   🧵 Thread ID: {parsed_data.get('thread_id', 'N/A')}")
                                    
                                    # 特殊处理完成事件
                                    elif event_type == "complete":
                                        print(f"   ✅ Research completed!")
                                        break
                                        
                                    # 特殊处理错误事件
                                    elif event_type == "error":
                                        print(f"   ❌ Error: {parsed_data.get('error_message', 'Unknown error')}")
                                        break
                                        
                                else:
                                    print(f"   (empty data)")
                                    
                            except json.JSONDecodeError:
                                print(f"   Raw: {event_content}")
                            
                            print("-" * 40)
                            
                            # 限制输出数量
                            if event_count >= 20:
                                print("   ... (limiting output)")
                                break
                
                print(f"🏁 Stream ended. Total events: {event_count}")
    
    except Exception as e:
        print(f"❌ Test failed: {e}")
        import traceback
        traceback.print_exc()

async def test_ask_traditional():
    """测试ask接口的传统模式（stream=false）"""
    
    base_url = "http://localhost:8000"
    
    request_data = {
        "question": "什么是机器学习？",
        "ask_type": "initial",
        "frontend_uuid": str(uuid.uuid4()),
        "visitor_id": str(uuid.uuid4()),
        "user_id": None,
        "config": {
            "auto_accepted_plan": False,
            "reportStyle": "academic"
        }
    }
    
    print(f"🚀 Testing ask API with stream=false (traditional mode)")
    print(f"Request: {json.dumps(request_data, indent=2, ensure_ascii=False)}")
    print("=" * 60)
    
    try:
        async with httpx.AsyncClient(timeout=30.0) as client:
            response = await client.post(
                f"{base_url}/api/research/ask?stream=false",
                json=request_data
            )
            
            print(f"Response status: {response.status_code}")
            print(f"Response: {json.dumps(response.json(), indent=2, ensure_ascii=False)}")
    
    except Exception as e:
        print(f"❌ Traditional test failed: {e}")

async def main():
    """主测试函数"""
    print("🧪 Testing Ask API Stream Integration")
    print("=" * 60)
    
    # 测试传统模式
    await test_ask_traditional()
    print("\n" + "=" * 60 + "\n")
    
    # 测试流式模式
    await test_ask_stream()

if __name__ == "__main__":
    asyncio.run(main()) 