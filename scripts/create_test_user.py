#!/usr/bin/env python3
"""
创建测试用户（用于开发环境）
需要 SUPABASE_SERVICE_KEY 来绕过邮箱验证
"""

import os
import asyncio
from supabase import create_client, Client
from dotenv import load_dotenv

load_dotenv()

SUPABASE_URL = os.getenv("NEXT_PUBLIC_SUPABASE_URL")
SUPABASE_SERVICE_KEY = os.getenv("SUPABASE_SERVICE_KEY")

if not SUPABASE_SERVICE_KEY:
    print("❌ 需要 SUPABASE_SERVICE_KEY 才能创建已验证的用户")
    print("💡 提示：")
    print("   1. 在 Supabase Dashboard 中获取 Service Role Key")
    print("   2. 将其添加到 .env 文件：SUPABASE_SERVICE_KEY=your-service-key")
    print("\n⚠️  注意：Service Role Key 拥有完全权限，仅用于服务端！")
    exit(1)

# 使用 service key 创建管理员客户端
supabase_admin: Client = create_client(SUPABASE_URL, SUPABASE_SERVICE_KEY)

async def create_test_user():
    """创建测试用户"""
    test_users = [
        {
            "email": "dev@yadra.test",
            "password": "Dev123456!",
            "display_name": "Dev User",
            "enable_deep_thinking": True
        },
        {
            "email": "test@yadra.test", 
            "password": "Test123456!",
            "display_name": "Test User",
            "enable_deep_thinking": False
        }
    ]
    
    print("🚀 创建测试用户...")
    
    for user_data in test_users:
        print(f"\n📧 创建用户: {user_data['email']}")
        
        try:
            # 使用管理员 API 创建用户（自动验证邮箱）
            response = supabase_admin.auth.admin.create_user({
                "email": user_data["email"],
                "password": user_data["password"],
                "email_confirm": True,  # 自动确认邮箱
                "user_metadata": {
                    "display_name": user_data["display_name"],
                    "enable_deep_thinking": user_data["enable_deep_thinking"]
                }
            })
            
            if response.user:
                print(f"✅ 用户创建成功！")
                print(f"   ID: {response.user.id}")
                print(f"   邮箱: {response.user.email}")
                print(f"   邮箱已验证: {response.user.email_confirmed_at is not None}")
                
                # 测试登录
                print(f"\n🔐 测试登录...")
                anon_client = create_client(SUPABASE_URL, os.getenv("NEXT_PUBLIC_SUPABASE_ANON_KEY"))
                login_response = anon_client.auth.sign_in_with_password({
                    "email": user_data["email"],
                    "password": user_data["password"]
                })
                
                if login_response.session:
                    print(f"✅ 登录成功！")
                    print(f"   Token: {login_response.session.access_token[:30]}...")
                else:
                    print(f"❌ 登录失败")
                    
        except Exception as e:
            if "already been registered" in str(e):
                print(f"⚠️  用户已存在")
                
                # 尝试更新现有用户的密码
                try:
                    # 先获取用户
                    users = supabase_admin.auth.admin.list_users()
                    existing_user = None
                    for u in users:
                        if u.email == user_data["email"]:
                            existing_user = u
                            break
                    
                    if existing_user:
                        # 更新密码
                        supabase_admin.auth.admin.update_user_by_id(
                            existing_user.id,
                            {
                                "password": user_data["password"],
                                "email_confirm": True
                            }
                        )
                        print(f"✅ 已更新现有用户的密码")
                except Exception as update_error:
                    print(f"❌ 更新失败: {update_error}")
            else:
                print(f"❌ 错误: {e}")

    print("\n" + "="*50)
    print("📝 测试账号信息：")
    for user in test_users:
        print(f"\n邮箱: {user['email']}")
        print(f"密码: {user['password']}")

if __name__ == "__main__":
    asyncio.run(create_test_user()) 