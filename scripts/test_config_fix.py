#!/usr/bin/env python3
"""
测试配置传递修复
验证前端配置是否正确传递到后端，解决重复字段和配置丢失问题
"""

import asyncio
import json
import aiohttp
import uuid


async def test_config_fix():
    """测试配置传递修复"""

    print("🚀 开始测试配置传递修复...")

    # 测试数据 - 使用非默认值来验证配置传递
    frontend_uuid = str(uuid.uuid4())
    visitor_id = str(uuid.uuid4())

    test_config = {
        "autoAcceptedPlan": True,  # 非默认值
        "enableBackgroundInvestigation": False,  # 非默认值
        "reportStyle": "popular_science",  # 非默认值
        "enableDeepThinking": True,  # 非默认值
        "maxPlanIterations": 5,  # 非默认值
        "maxStepNum": 8,  # 非默认值
        "maxSearchResults": 10,  # 非默认值
    }

    initial_request = {
        "question": "测试配置传递的问题",
        "ask_type": "initial",
        "frontend_uuid": frontend_uuid,
        "visitor_id": visitor_id,
        "config": test_config,
    }

    print(f"📤 发送的配置: {json.dumps(test_config, indent=2)}")

    async with aiohttp.ClientSession() as session:
        async with session.post(
            "http://localhost:8000/api/research/ask?stream=true",
            json=initial_request,
            headers={"Content-Type": "application/json"},
        ) as response:
            print(f"请求状态码: {response.status}")

            if response.status != 200:
                print(f"❌ 请求失败: {response.status}")
                text = await response.text()
                print(f"错误信息: {text}")
                return

            # 分析SSE流中的配置信息
            received_metadata = None

            async for line in response.content:
                line = line.decode("utf-8").strip()
                if not line:
                    continue

                if line.startswith("event: "):
                    event_type = line[7:]
                elif line.startswith("data: "):
                    try:
                        data = json.loads(line[6:])

                        if event_type == "metadata":
                            received_metadata = data
                            print(f"📥 收到metadata事件")
                            break

                    except json.JSONDecodeError:
                        continue

    if not received_metadata:
        print("❌ 未收到metadata事件")
        return

    # 验证配置传递
    config_used = received_metadata.get("config_used", {})
    research_config = config_used.get("research_config", {})

    print("\n🔍 配置传递验证:")

    # 验证每个配置字段
    test_cases = [
        ("auto_accepted_plan", True, research_config.get("auto_accepted_plan")),
        (
            "enable_background_investigation",
            False,
            research_config.get("enable_background_investigation"),
        ),
        ("report_style", "popular_science", research_config.get("report_style")),
        ("enable_deep_thinking", True, research_config.get("enable_deep_thinking")),
        ("max_plan_iterations", 5, research_config.get("max_plan_iterations")),
        ("max_step_num", 8, research_config.get("max_step_num")),
        ("max_search_results", 10, research_config.get("max_search_results")),
    ]

    all_passed = True

    for field_name, expected, actual in test_cases:
        if actual == expected:
            print(f"✅ {field_name}: {actual} (正确)")
        else:
            print(f"❌ {field_name}: 期望 {expected}, 实际 {actual} (错误)")
            all_passed = False

    # 检查是否有重复字段
    print(f"\n🔍 检查重复字段:")
    flat_config = config_used

    duplicate_checks = [
        ("auto_accepted_plan", "autoAcceptedPlan"),
        ("enable_background_investigation", "enableBackgroundInvestigation"),
        ("report_style", "reportStyle"),
        ("enable_deep_thinking", "enableDeepThinking"),
        ("max_plan_iterations", "maxPlanIterations"),
        ("max_step_num", "maxStepNum"),
        ("max_search_results", "maxSearchResults"),
    ]

    for snake_case, camel_case in duplicate_checks:
        has_snake = snake_case in flat_config
        has_camel = camel_case in flat_config

        if has_snake and has_camel:
            print(f"❌ 发现重复字段: {snake_case} 和 {camel_case}")
            all_passed = False
        elif has_snake:
            print(f"✅ 只有 {snake_case} (正确)")
        elif has_camel:
            print(f"⚠️ 只有 {camel_case} (可能的遗留)")
        else:
            print(f"❓ 两个字段都不存在: {snake_case}, {camel_case}")

    print(f"\n📊 测试结果:")
    if all_passed:
        print("🎉 所有测试通过！配置传递修复成功")
        print("✅ 用户配置正确传递到后端")
        print("✅ 没有重复字段")
        print("✅ 配置解析逻辑正确")
    else:
        print("❌ 测试失败，仍有配置传递问题")

    # 打印完整的metadata用于调试
    print(f"\n🔧 完整metadata (调试用):")
    print(json.dumps(received_metadata, indent=2, ensure_ascii=False))


if __name__ == "__main__":
    asyncio.run(test_config_fix())
