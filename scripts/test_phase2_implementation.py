#!/usr/bin/env python3
"""
Phase 2 功能测试脚本
测试会话映射系统的完整功能
"""

import asyncio
import json
import os
import uuid
from dotenv import load_dotenv

from src.server.repositories.session_repository import (
    get_session_repository,
    ActionType,
    ExecutionStatus,
)
from src.utils.url_param_generator import generate_url_param


async def test_session_repository():
    """测试SessionRepository功能"""
    print("🧪 测试SessionRepository功能...")

    load_dotenv()
    db_url = os.getenv("DATABASE_URL")
    if not db_url:
        print("❌ 数据库配置错误")
        return False

    repo = get_session_repository(db_url)

    try:
        # 测试创建会话
        print("📝 测试创建会话...")
        test_thread_id = f"test-thread-{uuid.uuid4()}"
        session, url_param = await repo.create_session(
            thread_id=test_thread_id,
            frontend_uuid="550e8400-e29b-41d4-a716-446655440000",
            visitor_id="550e8400-e29b-41d4-a716-446655440001",
            initial_question="测试问题：如何学习人工智能？",
            research_config={
                "enable_background_investigation": True,
                "report_style": "academic",
                "enable_deep_thinking": False,
            },
            model_config={"model_name": "claude-3-5-sonnet", "provider": "anthropic"},
            output_config={"language": "zhCN", "output_format": "markdown"},
        )

        print(f"✅ 会话创建成功: {session.id}, URL参数: {url_param}")

        # 测试通过URL参数查询会话
        print("🔍 测试通过URL参数查询会话...")
        found_session = await repo.get_session_by_url_param(url_param)
        if found_session and found_session.id == session.id:
            print("✅ 通过URL参数查询成功")
        else:
            print("❌ 通过URL参数查询失败")
            return False

        # 测试通过thread_id查询会话
        print("🔍 测试通过thread_id查询会话...")
        found_session = await repo.get_session_by_thread_id(test_thread_id)
        if found_session and found_session.id == session.id:
            print("✅ 通过thread_id查询成功")
        else:
            print("❌ 通过thread_id查询失败")
            return False

        # 测试创建执行记录
        print("📊 测试创建执行记录...")
        execution_record = await repo.create_execution_record(
            session_id=session.id,
            frontend_context_uuid="550e8400-e29b-41d4-a716-446655440002",
            action_type=ActionType.CREATE,
            user_message="测试消息",
            model_used="claude-3-5-sonnet",
            provider="anthropic",
        )

        print(f"✅ 执行记录创建成功: {execution_record.execution_id}")

        # 测试更新执行记录
        print("📈 测试更新执行记录...")
        success = await repo.update_execution_record(
            execution_id=execution_record.execution_id,
            status=ExecutionStatus.COMPLETED,
            input_tokens=1250,
            output_tokens=3420,
            total_cost=0.0234,
            artifacts_generated=["artifact-1", "artifact-2"],
        )

        if success:
            print("✅ 执行记录更新成功")
        else:
            print("❌ 执行记录更新失败")
            return False

        # 测试获取会话配置
        print("⚙️ 测试获取会话配置...")
        config = await repo.get_session_config(session.id)
        if config and config.research_config:
            print("✅ 会话配置获取成功")
            print(f"   研究配置: {config.research_config}")
        else:
            print("❌ 会话配置获取失败")
            return False

        print("🎉 SessionRepository所有测试通过！")
        return True

    except Exception as e:
        print(f"❌ 测试失败: {e}")
        return False


def test_url_param_generator():
    """测试URL参数生成器"""
    print("🧪 测试URL参数生成器...")

    test_cases = [
        "如何学习人工智能？",
        "What is the best way to learn Python programming?",
        "量子计算对密码学的影响分析",
        "Bitcoin price analysis and market trends",
        "南京传统小笼包的制作工艺研究",
    ]

    for question in test_cases:
        url_param = generate_url_param(question)
        print(f"问题: {question}")
        print(f"URL参数: {url_param}")
        print(f"长度: {len(url_param)}")

        # 验证URL参数格式
        if (
            len(url_param) <= 50
            and "-" in url_param
            and len(url_param.split("-")[-1]) == 8
        ):
            print("✅ 格式验证通过")
        else:
            print("❌ 格式验证失败")
            return False
        print("-" * 50)

    print("🎉 URL参数生成器所有测试通过！")
    return True


async def main():
    """主测试函数"""
    print("🚀 Phase 2 功能测试开始...")
    print("=" * 60)

    # 测试URL参数生成器
    if not test_url_param_generator():
        print("❌ URL参数生成器测试失败")
        return

    print()
    print("=" * 60)

    # 测试SessionRepository
    if not await test_session_repository():
        print("❌ SessionRepository测试失败")
        return

    print()
    print("=" * 60)
    print("🎉 Phase 2 所有功能测试通过！")
    print("✅ 数据库结构升级完成")
    print("✅ URL参数生成算法工作正常")
    print("✅ 会话映射系统功能完整")
    print("✅ 数据访问层运行稳定")


if __name__ == "__main__":
    asyncio.run(main())
