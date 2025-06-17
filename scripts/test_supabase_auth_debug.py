#!/usr/bin/env python3
"""
调试 Supabase 认证系统
"""

import os
import asyncio
from datetime import datetime
from supabase import create_client, Client
from dotenv import load_dotenv

load_dotenv()

# 直接使用 Supabase 客户端测试
SUPABASE_URL = os.getenv("NEXT_PUBLIC_SUPABASE_URL")
SUPABASE_ANON_KEY = os.getenv("NEXT_PUBLIC_SUPABASE_ANON_KEY")

if not SUPABASE_URL or not SUPABASE_ANON_KEY:
    print("❌ 缺少 Supabase 配置")
    exit(1)

print(f"🔧 Supabase URL: {SUPABASE_URL}")
print(f"🔑 Anon Key: {SUPABASE_ANON_KEY[:20]}...")

# 创建 Supabase 客户端
supabase: Client = create_client(SUPABASE_URL, SUPABASE_ANON_KEY)


async def test_direct_supabase():
    """直接测试 Supabase Auth"""

    # 测试邮箱
    timestamp = int(datetime.now().timestamp())
    test_emails = [
        f"test{timestamp}@test.com",
        f"test.user+{timestamp}@gmail.com",
        f"testuser{timestamp}@example.com",
        f"user{timestamp}@demo.com",
    ]

    test_password = "TestPassword123!"

    print("\n🧪 测试不同的邮箱格式...")

    for email in test_emails:
        print(f"\n📧 尝试邮箱: {email}")

        try:
            # 尝试注册
            response = supabase.auth.sign_up(
                {
                    "email": email,
                    "password": test_password,
                    "options": {"data": {"display_name": "Test User"}},
                }
            )

            if response.user:
                print(f"✅ 注册成功！")
                print(f"   用户 ID: {response.user.id}")
                print(f"   邮箱: {response.user.email}")
                print(f"   需要邮箱验证: {response.user.email_confirmed_at is None}")

                # 如果没有 session，说明需要邮箱验证
                if not response.session:
                    print("   ⚠️  需要邮箱验证才能获得 session")
                else:
                    print("   ✅ 获得 session（可能是测试模式）")

                # 尝试登录
                print(f"\n🔐 尝试登录...")
                login_response = supabase.auth.sign_in_with_password(
                    {"email": email, "password": test_password}
                )

                if login_response.session:
                    print("✅ 登录成功！")
                    print(
                        f"   Access Token: {login_response.session.access_token[:20]}..."
                    )
                else:
                    print("❌ 登录失败：可能需要邮箱验证")

                break  # 成功就停止测试

            else:
                print(f"❌ 注册失败：没有返回用户对象")

        except Exception as e:
            print(f"❌ 错误: {type(e).__name__}: {str(e)}")

            # 如果是用户已存在，尝试登录
            if "User already registered" in str(e):
                print("   用户已存在，尝试登录...")
                try:
                    login_response = supabase.auth.sign_in_with_password(
                        {"email": email, "password": test_password}
                    )
                    if login_response.session:
                        print("   ✅ 登录成功！")
                        break
                except Exception as login_error:
                    print(f"   ❌ 登录也失败: {login_error}")


async def check_supabase_settings():
    """检查 Supabase 项目设置"""
    print("\n📋 Supabase 项目信息：")

    # 从 URL 提取项目信息
    import re

    match = re.match(r"https://([a-zA-Z0-9]+)\.supabase\.co", SUPABASE_URL)
    if match:
        project_ref = match.group(1)
        print(f"   项目引用: {project_ref}")
        print(f"   Dashboard: https://supabase.com/dashboard/project/{project_ref}")
        print(
            f"   认证设置: https://supabase.com/dashboard/project/{project_ref}/auth/users"
        )

        print("\n💡 建议检查：")
        print("   1. Auth > Providers > Email 是否启用")
        print("   2. Auth > Email Templates 邮件模板设置")
        print("   3. Auth > URL Configuration 中的 Site URL")
        print("   4. 是否启用了邮箱验证（可以临时禁用用于测试）")


if __name__ == "__main__":
    print("🚀 开始调试 Supabase 认证...")

    # 先检查设置
    asyncio.run(check_supabase_settings())

    # 然后测试认证
    asyncio.run(test_direct_supabase())
