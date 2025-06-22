#!/usr/bin/env python3
"""
测试ASK API的HITL修复
验证session_id是否正确传递，解决422错误问题
"""

import asyncio
import json
import aiohttp
import uuid
from datetime import datetime


async def test_ask_hitl_fix():
    """测试ASK API的HITL修复"""

    print("🚀 开始测试ASK API的HITL修复...")

    # 测试数据
    frontend_uuid = str(uuid.uuid4())
    visitor_id = str(uuid.uuid4())

    # 第一步：发送initial请求
    print("\n📝 第一步：发送initial请求...")

    initial_request = {
        "question": "什么是人工智能？请制定研究计划。",
        "ask_type": "initial",
        "frontend_uuid": frontend_uuid,
        "visitor_id": visitor_id,
        "config": {
            "auto_accepted_plan": False,  # 确保会触发interrupt
            "enable_background_investigation": True,
            "report_style": "academic",
            "enable_deep_thinking": False,
            "max_plan_iterations": 3,
            "max_step_num": 5,
            "max_search_results": 5,
        },
    }

    # 发送initial请求并收集信息
    session_info = None
    interrupt_info = None

    async with aiohttp.ClientSession() as session:
        async with session.post(
            "http://localhost:8000/api/research/ask?stream=true",
            json=initial_request,
            headers={"Content-Type": "application/json"},
        ) as response:
            print(f"Initial请求状态码: {response.status}")

            if response.status != 200:
                print(f"❌ Initial请求失败: {response.status}")
                text = await response.text()
                print(f"错误信息: {text}")
                return

            # 处理SSE流
            async for line in response.content:
                line = line.decode("utf-8").strip()
                if not line:
                    continue

                if line.startswith("event: "):
                    event_type = line[7:]
                elif line.startswith("data: "):
                    try:
                        data = json.loads(line[6:])
                        print(f"收到事件: {event_type} - {list(data.keys())}")

                        # 收集navigation事件信息
                        if event_type == "navigation":
                            session_info = {
                                "session_id": data.get("session_id"),
                                "thread_id": data.get("thread_id"),
                                "url_param": data.get("url_param"),
                            }
                            print(f"✅ 收集到session信息: {session_info}")

                        # 收集interrupt事件信息
                        elif event_type == "interrupt":
                            interrupt_info = data
                            print(f"✅ 收集到interrupt信息: {data.get('id', 'N/A')}")
                            break  # 收到interrupt后退出循环

                    except json.JSONDecodeError as e:
                        print(f"JSON解析错误: {e}")
                        continue

    if not session_info:
        print("❌ 未收到navigation事件，无法继续测试")
        return

    if not session_info.get("session_id"):
        print("❌ navigation事件中没有session_id，修复未生效")
        return

    print(f"✅ navigation事件包含session_id: {session_info['session_id']}")

    if not interrupt_info:
        print("⚠️ 未收到interrupt事件，可能是auto_accepted_plan=True")
        return

    # 第二步：发送followup请求（模拟用户点击"开始研究"）
    print("\n📝 第二步：发送followup请求（模拟用户点击'开始研究'）...")

    followup_request = {
        "question": "",
        "ask_type": "followup",
        "frontend_uuid": frontend_uuid,
        "visitor_id": visitor_id,
        "session_id": session_info["session_id"],  # 🔥 关键：传递session_id
        "thread_id": session_info["thread_id"],  # 🔥 关键：传递thread_id
        "url_param": session_info["url_param"],  # 🔥 关键：传递url_param
        "interrupt_feedback": "accepted",  # 🔥 关键：传递interrupt_feedback
        "config": {
            "auto_accepted_plan": True,
            "enable_background_investigation": True,
            "report_style": "academic",
            "enable_deep_thinking": False,
            "max_plan_iterations": 3,
            "max_step_num": 5,
            "max_search_results": 5,
        },
    }

    async with aiohttp.ClientSession() as session:
        async with session.post(
            "http://localhost:8000/api/research/ask?stream=true",
            json=followup_request,
            headers={"Content-Type": "application/json"},
        ) as response:
            print(f"Followup请求状态码: {response.status}")

            if response.status == 422:
                print("❌ 仍然出现422错误，修复未完全生效")
                text = await response.text()
                print(f"错误详情: {text}")
                return
            elif response.status != 200:
                print(f"❌ Followup请求失败: {response.status}")
                text = await response.text()
                print(f"错误信息: {text}")
                return

            print("✅ Followup请求成功，开始接收SSE流...")

            # 处理SSE流（只接收前几个事件）
            event_count = 0
            async for line in response.content:
                line = line.decode("utf-8").strip()
                if not line:
                    continue

                if line.startswith("event: "):
                    event_type = line[7:]
                elif line.startswith("data: "):
                    try:
                        data = json.loads(line[6:])
                        print(f"收到followup事件: {event_type} - {list(data.keys())}")
                        event_count += 1

                        # 接收几个事件后退出
                        if event_count >= 5:
                            break

                    except json.JSONDecodeError:
                        continue

    print("\n🎉 测试完成！")
    print("✅ session_id修复生效")
    print("✅ followup请求不再出现422错误")
    print("✅ HITL用户反馈功能已修复")


if __name__ == "__main__":
    asyncio.run(test_ask_hitl_fix())
