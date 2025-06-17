#!/usr/bin/env python3
"""
Test Fixed Authentication System
测试修复后的认证系统和Supabase集成
"""

import asyncio
from dotenv import load_dotenv


async def test_fixed_auth():
    """测试修复后的认证系统"""

    load_dotenv()

    print("🔧 Testing fixed authentication system...")

    try:
        # 测试修复后的conversation_meta字段
        print("\n1. 测试修复后的conversation_meta字段...")

        from src.server.auth_api import (
            get_user_by_email,
            update_user_preferences,
            UserPreferencesRequest,
            get_user_conversation_stats,
        )

        test_email = "test@yadra.ai"

        # 测试字段恢复
        user = await get_user_by_email(test_email)
        if user:
            print(f"✅ 用户查询成功:")
            print(f"   - ID: {user.id}")
            print(f"   - Email: {user.email}")
            print(f"   - 推理模式: {user.enable_deep_thinking}")
            print(f"   - 推理会话数: {user.reasoning_sessions_count}")  # 恢复的字段
            print(f"   - 推理总时间: {user.total_reasoning_time_ms}ms")  # 恢复的字段

        # 测试字段更新（包括updated_at）
        print("\n2. 测试字段更新...")
        preferences = UserPreferencesRequest(enable_deep_thinking=True)
        updated_user = await update_user_preferences(test_email, preferences)
        print(f"✅ 偏好更新成功: {updated_user.enable_deep_thinking}")

        # 测试统计查询
        print("\n3. 测试统计查询...")
        stats = await get_user_conversation_stats(test_email)
        print(f"✅ 统计查询成功:")
        print(f"   - 总对话数: {stats.total_conversations}")
        print(f"   - 推理对话数: {stats.reasoning_conversations}")
        print(f"   - 推理总时间: {stats.total_reasoning_time_ms}ms")  # 恢复的字段

        print("\n🎉 认证系统修复测试通过!")
        return True

    except Exception as e:
        print(f"❌ 测试失败: {e}")
        import traceback

        traceback.print_exc()
        return False


if __name__ == "__main__":
    success = asyncio.run(test_fixed_auth())
    exit(0 if success else 1)
