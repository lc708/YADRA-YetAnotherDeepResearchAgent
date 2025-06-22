#!/usr/bin/env python3
"""
验证双重navigation事件修复效果
"""

import asyncio
import json
import aiohttp
from datetime import datetime


async def test_single_navigation_event():
    """
    测试修复后只有一个navigation事件
    """
    print("🔍 验证双重navigation事件修复")
    print("=" * 50)

    test_payload = {
        "question": "测试修复后的navigation事件",
        "ask_type": "initial",
        "frontend_uuid": "test-fix-12345",
        "visitor_id": "test-visitor-fix",
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

    print("🚀 发送测试请求...")

    try:
        async with aiohttp.ClientSession() as session:
            url = "http://localhost:8000/api/research/ask?stream=true"

            async with session.post(url, json=test_payload) as response:
                if response.status != 200:
                    print(f"❌ HTTP错误: {response.status}")
                    return False

                print("✅ 开始接收SSE事件...")

                navigation_events = []
                metadata_events = []
                event_count = 0

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

                            if current_event_type == "navigation":
                                navigation_events.append(event_data)
                                print(f"\n📍 Navigation事件 #{len(navigation_events)}:")
                                print(f"   session_id: {event_data.get('session_id')}")
                                print(f"   thread_id: {event_data.get('thread_id')}")
                                print(f"   timestamp: {event_data.get('timestamp')}")

                            elif current_event_type == "metadata":
                                metadata_events.append(event_data)
                                print(f"\n📊 Metadata事件 #{len(metadata_events)}:")
                                print(
                                    f"   execution_id: {event_data.get('execution_id')}"
                                )

                            # 收到足够事件后停止
                            if (
                                len(navigation_events) >= 1
                                and len(metadata_events) >= 1
                            ):
                                print("\n🛑 收到足够事件，停止测试")
                                break

                            if event_count >= 20:  # 安全限制
                                print("\n🛑 达到事件数量限制")
                                break

                        except json.JSONDecodeError as e:
                            print(f"⚠️ JSON解析错误: {e}")

                # 验证结果
                print("\n" + "=" * 50)
                print("📊 验证结果:")

                if len(navigation_events) == 1:
                    print("✅ 只收到1个navigation事件（修复成功）")
                    nav_event = navigation_events[0]

                    if nav_event.get("session_id"):
                        print(
                            f"✅ navigation事件包含session_id: {nav_event['session_id']}"
                        )
                    else:
                        print("❌ navigation事件缺少session_id")
                        return False

                elif len(navigation_events) == 0:
                    print("❌ 没有收到navigation事件")
                    return False
                else:
                    print(
                        f"❌ 收到{len(navigation_events)}个navigation事件（仍有重复）"
                    )
                    return False

                if len(metadata_events) >= 1:
                    print(f"✅ 收到{len(metadata_events)}个metadata事件")
                else:
                    print("⚠️ 没有收到metadata事件")

                return len(navigation_events) == 1 and navigation_events[0].get(
                    "session_id"
                )

    except Exception as e:
        print(f"❌ 测试失败: {e}")
        return False


def main():
    """
    主函数
    """
    print(f"⏰ 验证开始时间: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")

    try:
        result = asyncio.run(test_single_navigation_event())

        if result:
            print("\n🎉 验证成功！")
            print("📋 修复效果确认:")
            print("  ✅ 只有一个navigation事件")
            print("  ✅ navigation事件包含session_id")
            print("  ✅ 避免了重复发送问题")
            print("  ✅ HITL功能应该能正常工作")
        else:
            print("\n❌ 验证失败！")
            print("需要进一步检查修复实现")

    except KeyboardInterrupt:
        print("\n🛑 用户中断验证")
    except Exception as e:
        print(f"\n❌ 验证异常: {e}")


if __name__ == "__main__":
    main()
