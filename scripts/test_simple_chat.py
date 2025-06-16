#!/usr/bin/env python3
"""
Simple Chat Test
简化的聊天测试，用于定位流式响应问题
"""

import json
import asyncio
import aiohttp

async def test_simple_chat():
    """测试最基本的聊天功能"""
    
    url = "http://localhost:8000/api/chat/stream"
    
    # 最简单的测试数据
    simple_request = {
        "messages": [{"role": "user", "content": "Hi"}],
        "auto_accepted_plan": True,
        "enable_deep_thinking": False,  # 先禁用推理模式
        "max_plan_iterations": 1,
        "max_step_num": 1
    }
    
    print(f"🧪 Testing simple chat: {simple_request}")
    
    try:
        async with aiohttp.ClientSession() as session:
            async with session.post(url, json=simple_request, timeout=30) as response:
                print(f"Status: {response.status}")
                print(f"Headers: {dict(response.headers)}")
                
                # 尝试读取部分响应
                try:
                    first_chunk = await response.content.read(1024)
                    print(f"First chunk: {first_chunk.decode('utf-8', errors='ignore')}")
                    
                    # 尝试读取更多
                    remaining = await response.content.read()
                    print(f"Remaining length: {len(remaining)}")
                    
                except Exception as e:
                    print(f"❌ Error reading content: {e}")
                    
    except Exception as e:
        print(f"❌ Request failed: {e}")

if __name__ == "__main__":
    asyncio.run(test_simple_chat())
