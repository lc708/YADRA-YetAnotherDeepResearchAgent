#!/usr/bin/env python3
"""
Frontend-Backend Integration Test
前后端集成联调测试
"""

import json
import asyncio
import aiohttp
import time
import uuid


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


async def test_frontend_backend_integration():
    """测试前端到后端的完整集成流程"""

    # 🔥 使用新的研究问题
    question = "比较分析电动汽车与传统燃油车的环境影响"

    print("🚀 测试前端到后端集成...")
    print(f"📝 问题: {question}")

    url = "http://localhost:8000/api/research/ask?stream=true"
    print(f"🔗 URL: {url}")

    # 🔥 模拟HeroInput发送的请求格式
    frontend_uuid = str(uuid.uuid4())
    visitor_id = str(uuid.uuid4())

    payload = {
        "question": question,
        "ask_type": "initial",
        "frontend_uuid": frontend_uuid,
        "visitor_id": visitor_id,
        "config": {
            "auto_accepted_plan": False,  # 确保需要用户确认
            "enableBackgroundInvestigation": True,
            "reportStyle": "academic",
            "enableDeepThinking": False,
            "maxPlanIterations": 3,
            "maxStepNum": 5,
            "maxSearchResults": 5,
        },
    }

    print(f"📤 发送请求: {json.dumps(payload, indent=2, ensure_ascii=False)}")

    try:
        async with aiohttp.ClientSession() as session:
            async with session.post(
                url, json=payload, headers={"Content-Type": "application/json"}
            ) as response:
                print(f"📊 响应状态: {response.status}")

                if response.status != 200:
                    error_text = await response.text()
                    print(f"❌ 错误响应: {error_text}")
                    return

                event_count = 0
                navigation_received = False
                interrupt_received = False

                # 处理SSE流
                async for line in response.content:
                    line_text = line.decode("utf-8").strip()
                    if not line_text:
                        continue

                    if line_text.startswith("event: "):
                        event_type = line_text[7:]
                    elif line_text.startswith("data: "):
                        event_data = line_text[6:]
                        event_count += 1

                        print(f"📨 事件 #{event_count}: {event_type}")

                        try:
                            data = json.loads(event_data)

                            # 检查navigation事件
                            if event_type == "navigation":
                                navigation_received = True
                                print(
                                    f"🎯 Navigation事件: url_param={data.get('url_param')}, thread_id={data.get('thread_id')}"
                                )
                                print(f"   workspace_url={data.get('workspace_url')}")

                            # 检查interrupt事件
                            elif event_type == "interrupt":
                                interrupt_received = True
                                print(
                                    f"🔄 Interrupt事件: {data.get('message', 'No message')}"
                                )
                                print(f"   options={data.get('options', [])}")

                            # 检查complete事件
                            elif event_type == "complete":
                                print(f"✅ Complete事件")
                                break

                        except json.JSONDecodeError as e:
                            print(f"⚠️  JSON解析错误: {e}")
                            print(f"   原始数据: {event_data[:100]}...")

                    # 限制事件数量
                    if event_count >= 40:
                        print("⏹️ 达到事件数量限制，停止接收")
                        break

                # 总结测试结果
                print(f"\n📋 测试总结:")
                print(f"   总事件数: {event_count}")
                print(f"   Navigation事件: {'✅' if navigation_received else '❌'}")
                print(f"   Interrupt事件: {'✅' if interrupt_received else '❌'}")

                if navigation_received and interrupt_received:
                    print("🎉 前端到后端集成测试成功！")
                else:
                    print("⚠️  集成测试部分成功，检查缺失的事件")

    except Exception as e:
        print(f"❌ 请求失败: {e}")


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

    # 测试3: 前端到后端的完整集成流程
    print("🧪 Test 3: Frontend-Backend Integration")
    frontend_backend_ok = await test_frontend_backend_integration()
    print()

    # 总结
    print("📋 Integration Test Summary:")
    print(f"  Config API: {'✅ PASS' if config_ok else '❌ FAIL'}")
    print(f"  Chat Stream API: {'✅ PASS' if chat_ok else '❌ FAIL'}")
    print(
        f"  Frontend-Backend Integration: {'✅ PASS' if frontend_backend_ok else '❌ FAIL'}"
    )

    if config_ok and chat_ok and frontend_backend_ok:
        print("\n🎉 ALL TESTS PASSED - Frontend-Backend integration is working!")
        return True
    else:
        print("\n❌ SOME TESTS FAILED - Need to fix integration issues")
        return False


if __name__ == "__main__":
    success = asyncio.run(main())
    exit(0 if success else 1)
