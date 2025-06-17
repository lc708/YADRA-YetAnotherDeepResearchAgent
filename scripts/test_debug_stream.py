#!/usr/bin/env python3
"""
Debug Stream Response
调试流式响应问题
"""

import asyncio
import json
import aiohttp


async def test_debug_stream():
    """调试流式响应"""

    url = "http://localhost:8000/api/chat/stream"

    # 更简单的请求
    request_data = {
        "messages": [{"role": "user", "content": "Just say hello"}],
        "auto_accepted_plan": True,
        "enable_deep_thinking": False,
        "max_plan_iterations": 1,
        "max_step_num": 1,
    }

    print(f"🐛 Debug stream request: {json.dumps(request_data, indent=2)}")

    try:
        async with aiohttp.ClientSession() as session:
            async with session.post(url, json=request_data) as response:
                print(f"Status: {response.status}")
                print(f"Headers: {dict(response.headers)}")

                if response.status != 200:
                    body = await response.text()
                    print(f"Error body: {body}")
                    return

                # 尝试逐行读取
                print("🔄 Reading stream line by line...")
                line_count = 0
                try:
                    async for line in response.content:
                        line_count += 1
                        decoded_line = line.decode("utf-8").strip()
                        if decoded_line:
                            print(f"Line {line_count}: {decoded_line}")

                        # 限制行数，避免无限循环
                        if line_count > 100:
                            print("⚠️ Reached 100 lines, stopping...")
                            break

                except Exception as e:
                    print(f"❌ Stream reading error: {e}")
                    print(f"Total lines read: {line_count}")

    except Exception as e:
        print(f"❌ Request error: {e}")


if __name__ == "__main__":
    asyncio.run(test_debug_stream())
