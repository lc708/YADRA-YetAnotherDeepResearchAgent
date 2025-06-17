#!/usr/bin/env python3
"""
Test Authentication API
测试用户认证API功能
"""

import asyncio
import json
from dotenv import load_dotenv


async def test_auth_api():
    """测试认证API - 简化版本"""

    load_dotenv()

    print("🔧 Testing authentication API...")

    try:
        # 导入auth模块
        from src.server.auth_api import (
            UserCreateRequest,
            create_user,
            get_user_by_email,
            update_user_preferences,
            UserPreferencesRequest,
            get_user_conversation_stats,
        )

        # 测试数据
        test_email = "test@yadra.ai"

        print("👤 Testing user creation...")

        # 测试创建用户
        user_request = UserCreateRequest(
            email=test_email,
            enable_deep_thinking=True,
            user_context={"test": "data", "role": "researcher"},
        )

        try:
            user = await create_user(user_request)
            print(f"✅ User created: {user.email}")
            print(f"   ID: {user.id}")
            print(f"   Deep thinking: {user.enable_deep_thinking}")
        except Exception as e:
            if "already exists" in str(e):
                print("ℹ️  User already exists, using existing user")
            else:
                print(f"❌ User creation failed: {e}")
                return False

        print("\n🔍 Testing user retrieval...")

        # 测试获取用户
        user = await get_user_by_email(test_email)
        if user:
            print(f"✅ User retrieved: {user.email}")
            print(f"   Reasoning sessions: {user.reasoning_sessions_count}")
            print(f"   Total reasoning time: {user.total_reasoning_time_ms}ms")
        else:
            print("❌ User not found")
            return False

        print("\n⚙️  Testing preference updates...")

        # 测试更新偏好
        preferences = UserPreferencesRequest(
            enable_deep_thinking=False,
            user_context={"test": "updated", "role": "admin"},
        )

        updated_user = await update_user_preferences(test_email, preferences)
        print(f"✅ Preferences updated")
        print(f"   Deep thinking: {updated_user.enable_deep_thinking}")

        print("\n📊 Testing conversation stats...")

        # 测试获取统计信息
        stats = await get_user_conversation_stats(test_email)
        print(f"✅ Stats retrieved:")
        print(f"   Total conversations: {stats.total_conversations}")
        print(f"   Reasoning conversations: {stats.reasoning_conversations}")
        print(f"   Total reasoning time: {stats.total_reasoning_time_ms}ms")

        print("\n🎉 认证API测试成功!")
        return True

    except Exception as e:
        print(f"❌ 测试失败: {e}")
        import traceback

        traceback.print_exc()
        return False


if __name__ == "__main__":
    success = asyncio.run(test_auth_api())
    exit(0 if success else 1)
