#!/usr/bin/env python3
"""
Frontend-Backend Integration Test
前后端集成联调测试
"""

import json
import asyncio
import aiohttp
import time


async def test_chat_stream_integration():
    """测试聊天流式API集成"""

    print("🚀 Starting Frontend-Backend Integration Test...")

    # 测试数据 - 使用正确的ChatRequest格式
    test_message = {
        "messages": [
            {
                "role": "user",
                "content": (
                    "Hello, can you test reasoning mode with a simple math question: what is 15 + 27?"
                ),
            }
        ],
        "enable_deep_thinking": True,  # 启用推理模式
        "auto_accepted_plan": True,  # 自动接受计划，避免中断
    }

    url = "http://localhost:8000/api/chat/stream"

    try:
        async with aiohttp.ClientSession() as session:
            print(f"📡 Sending POST request to: {url}")
            print(f"📋 Payload: {json.dumps(test_message, indent=2)}")

            # 开始计时
            start_time = time.time()

            async with session.post(
                url, json=test_message, headers={"Content-Type": "application/json"}
            ) as response:

                print(f"📊 Response status: {response.status}")
                print(f"📊 Response headers: {dict(response.headers)}")

                if response.status != 200:
                    text = await response.text()
                    print(f"❌ Error response: {text}")
                    return False

                # 读取流式响应
                buffer = ""
                message_count = 0
                reasoning_found = False

                async for chunk in response.content.iter_chunked(1024):
                    chunk_text = chunk.decode("utf-8")
                    buffer += chunk_text

                    # 处理SSE格式的数据
                    while "\n\n" in buffer:
                        event_block, buffer = buffer.split("\n\n", 1)
                        lines = event_block.strip().split("\n")

                        event_type = None
                        data_content = None

                        # 解析SSE格式
                        for line in lines:
                            if line.startswith("event: "):
                                event_type = line[7:]  # 移除 'event: ' 前缀
                            elif line.startswith("data: "):
                                data_content = line[6:]  # 移除 'data: ' 前缀

                        # 处理消息数据
                        if event_type == "message_chunk" and data_content:
                            try:
                                data = json.loads(data_content)
                                message_count += 1

                                agent = data.get("agent", "unknown")
                                content = data.get("content", "")

                                print(
                                    f"📨 Message {message_count} from {agent}: {content[:50]}{'...' if len(content) > 50 else ''}"
                                )

                                # 检查推理内容
                                if "reasoning_content" in data:
                                    reasoning_found = True
                                    reasoning_content = data["reasoning_content"]
                                    print(
                                        f"🧠 Reasoning content found: {reasoning_content[:100]}..."
                                    )

                            except json.JSONDecodeError as e:
                                print(f"⚠️  JSON decode error: {e}")
                                print(f"Raw data: {data_content}")

                        elif event_type == "done":
                            print("🏁 Stream completed")

                # 结束计时
                end_time = time.time()
                duration = end_time - start_time

                print(f"\n🎉 Integration test completed!")
                print(f"⏱️  Duration: {duration:.2f} seconds")
                print(f"📊 Total messages: {message_count}")
                print(
                    f"🧠 Reasoning content found: {'✅' if reasoning_found else '❌'}"
                )

                return reasoning_found and message_count > 0

    except Exception as e:
        print(f"❌ Integration test failed: {e}")
        import traceback

        traceback.print_exc()
        return False


async def test_config_api():
    """测试配置API"""

    url = "http://localhost:8000/api/config"

    try:
        async with aiohttp.ClientSession() as session:
            async with session.get(url) as response:
                if response.status == 200:
                    config = await response.json()
                    print(f"✅ Config API works: {config}")

                    # 检查推理模型配置
                    reasoning_models = config.get("models", {}).get("reasoning", [])
                    if "deepseek-reasoner" in reasoning_models:
                        print(f"✅ Reasoning model configured: {reasoning_models}")
                        return True
                    else:
                        print(f"❌ Reasoning model not found in config")
                        return False
                else:
                    print(f"❌ Config API failed: {response.status}")
                    return False

    except Exception as e:
        print(f"❌ Config API test failed: {e}")
        return False


async def main():
    """主测试函数"""

    print("🔄 Frontend-Backend Integration Testing\n")

    # 测试1: 配置API
    print("🧪 Test 1: Config API")
    config_ok = await test_config_api()
    print()

    # 测试2: 聊天流式API (推理模式)
    print("🧪 Test 2: Chat Stream API (Reasoning Mode)")
    chat_ok = await test_chat_stream_integration()
    print()

    # 总结
    print("📋 Integration Test Summary:")
    print(f"  Config API: {'✅ PASS' if config_ok else '❌ FAIL'}")
    print(f"  Chat Stream API: {'✅ PASS' if chat_ok else '❌ FAIL'}")

    if config_ok and chat_ok:
        print("\n🎉 ALL TESTS PASSED - Frontend-Backend integration is working!")
        return True
    else:
        print("\n❌ SOME TESTS FAILED - Need to fix integration issues")
        return False


if __name__ == "__main__":
    success = asyncio.run(main())
    exit(0 if success else 1)
