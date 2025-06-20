#!/usr/bin/env python3
"""
测试ASK接口SSE格式修复
"""

import asyncio
import json
import httpx
import uuid
from datetime import datetime

async def test_ask_sse_format():
    """测试ASK接口的SSE格式是否正确"""
    
    base_url = "http://localhost:8000"
    
    # 构建测试请求
    request_data = {
        "question": "简单测试：什么是人工智能？",
        "ask_type": "initial",
        "frontend_uuid": str(uuid.uuid4()),
        "visitor_id": str(uuid.uuid4()),
        "user_id": None,
        "config": {
            "research": {
                "auto_accepted_plan": True,  # 自动批准计划，快速测试
                "enable_background_investigation": False,
                "report_style": "academic",
                "enable_deep_thinking": False,
                "max_research_depth": 1
            },
            "model": {},
            "output": {
                "language": "zh-CN",
                "output_format": "markdown"
            }
        }
    }
    
    print(f"🚀 Testing ASK API SSE format fix")
    print(f"Request: {json.dumps(request_data, indent=2, ensure_ascii=False)}")
    print(f"URL: {base_url}/api/research/ask?stream=true")
    print("=" * 60)
    
    try:
        async with httpx.AsyncClient(timeout=60.0) as client:
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
                navigation_received = False
                
                async for line in response.aiter_lines():
                    if event_count >= 10:  # 限制测试事件数量
                        print("⏹️ 已接收足够事件，停止测试")
                        break
                        
                    if line:
                        print(f"Raw line: {line}")
                        
                        if line.startswith("event: "):
                            current_event = line[7:].strip()
                            print(f"✅ Event type found: {current_event}")
                            
                        elif line.startswith("data: "):
                            data_content = line[6:].strip()
                            try:
                                parsed_data = json.loads(data_content)
                                print(f"✅ Data parsed successfully: {json.dumps(parsed_data, indent=2, ensure_ascii=False)}")
                                
                                # 检查navigation事件
                                if current_event == "navigation":
                                    navigation_received = True
                                    workspace_url = parsed_data.get('workspace_url')
                                    url_param = parsed_data.get('url_param')
                                    thread_id = parsed_data.get('thread_id')
                                    print(f"🎉 Navigation event details:")
                                    print(f"   workspace_url: {workspace_url}")
                                    print(f"   url_param: {url_param}")
                                    print(f"   thread_id: {thread_id}")
                                    
                                event_count += 1
                                    
                            except json.JSONDecodeError as e:
                                print(f"❌ JSON parse failed: {e}")
                                print(f"   Raw data: {data_content}")
                        
                        print("-" * 40)
                
                print(f"📊 测试结果:")
                print(f"   总事件数: {event_count}")
                print(f"   Navigation事件: {'✅ 收到' if navigation_received else '❌ 未收到'}")
                print(f"   SSE格式: {'✅ 正确' if event_count > 0 else '❌ 错误'}")
    
    except Exception as e:
        print(f"❌ Test failed: {e}")
        import traceback
        traceback.print_exc()

async def main():
    """主测试函数"""
    print("🧪 Testing ASK API SSE Format Fix")
    print("=" * 60)
    
    await test_ask_sse_format()

if __name__ == "__main__":
    asyncio.run(main()) 