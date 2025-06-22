#!/usr/bin/env python3
"""
深入分析session_id丢失问题的调试脚本
"""

import asyncio
import json
import aiohttp
from datetime import datetime


async def test_session_id_flow():
    """
    测试session_id在整个流程中的传递
    """
    print("🔍 深入分析session_id丢失问题")
    print("=" * 60)

    # 测试数据
    test_payload = {
        "question": "测试session_id传递",
        "ask_type": "initial",
        "frontend_uuid": "test-uuid-12345",
        "visitor_id": "test-visitor-12345",
        "user_id": None,
        "config": {
            "autoAcceptedPlan": False,
            "enableBackgroundInvestigation": False,
            "reportStyle": "academic",
            "enableDeepThinking": False,
            "maxPlanIterations": 3,
            "maxStepNum": 10,
            "maxSearchResults": 10,
        },
    }

    print("🚀 发送初始研究请求...")
    print(f"Payload: {json.dumps(test_payload, indent=2)}")

    try:
        async with aiohttp.ClientSession() as session:
            url = "http://localhost:8000/api/research/ask?stream=true"

            async with session.post(url, json=test_payload) as response:
                if response.status != 200:
                    print(f"❌ HTTP错误: {response.status}")
                    text = await response.text()
                    print(f"错误内容: {text}")
                    return False

                print("✅ 开始接收SSE事件...")
                event_count = 0
                navigation_event = None
                metadata_event = None

                async for line in response.content:
                    line = line.decode("utf-8").strip()
                    if not line:
                        continue

                    if line.startswith("event: "):
                        current_event_type = line[7:]
                    elif line.startswith("data: "):
                        try:
                            event_data = json.loads(line[6:])
                            event_count += 1

                            print(f"\n📦 事件 #{event_count}: {current_event_type}")
                            print(f"数据: {json.dumps(event_data, indent=2)}")

                            # 特别关注navigation和metadata事件
                            if current_event_type == "navigation":
                                navigation_event = event_data
                                print(
                                    f"🔥 Navigation事件中的session_id: {event_data.get('session_id')}"
                                )
                                print(
                                    f"🔥 session_id类型: {type(event_data.get('session_id'))}"
                                )

                            elif current_event_type == "metadata":
                                metadata_event = event_data
                                print(
                                    f"🔥 Metadata事件内容: {json.dumps(event_data, indent=2)}"
                                )

                            # 限制事件数量，避免无限循环
                            if event_count >= 10:
                                print("🛑 达到事件数量限制，停止接收")
                                break

                        except json.JSONDecodeError as e:
                            print(f"⚠️ JSON解析错误: {e}")
                            print(f"原始数据: {line}")

                # 分析结果
                print("\n" + "=" * 60)
                print("📊 分析结果:")

                if navigation_event:
                    session_id = navigation_event.get("session_id")
                    print(f"✅ Navigation事件包含session_id: {session_id}")
                    print(f"✅ session_id类型: {type(session_id)}")
                    print(f"✅ session_id值有效: {session_id is not None}")
                else:
                    print("❌ 未收到navigation事件")

                if metadata_event:
                    print(f"✅ 收到metadata事件")
                else:
                    print("⚠️ 未收到metadata事件")

                return True

    except Exception as e:
        print(f"❌ 测试失败: {e}")
        import traceback

        traceback.print_exc()
        return False


async def analyze_frontend_logic():
    """
    分析前端逻辑中可能的问题
    """
    print("\n🎯 前端逻辑分析:")
    print("=" * 40)

    print("1. Navigation事件处理逻辑:")
    print("   - 检查eventData.session_id是否存在")
    print("   - 设置到sessionState.sessionMetadata.session_id")

    print("\n2. Metadata事件处理逻辑:")
    print("   - 合并sessionMetadata，保留现有session_id")
    print("   - 新数据覆盖同名字段")

    print("\n3. handlePlanApprove获取session_id:")
    print("   - sessionState?.sessionMetadata?.session_id")

    print("\n🔍 可能的问题点:")
    print("   1. Navigation事件中session_id为null/undefined")
    print("   2. 事件处理顺序问题")
    print("   3. sessionState初始化问题")
    print("   4. 数据类型不匹配")


def main():
    """
    主函数
    """
    print(f"⏰ 调试开始时间: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")

    # 运行异步测试
    try:
        result = asyncio.run(test_session_id_flow())
        if result:
            print("\n✅ session_id流程测试完成")
        else:
            print("\n❌ session_id流程测试失败")

        # 分析前端逻辑
        asyncio.run(analyze_frontend_logic())

    except KeyboardInterrupt:
        print("\n🛑 用户中断测试")
    except Exception as e:
        print(f"\n❌ 测试异常: {e}")


if __name__ == "__main__":
    main()
