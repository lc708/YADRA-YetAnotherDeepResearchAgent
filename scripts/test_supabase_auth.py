#!/usr/bin/env python3
"""
测试 Supabase 认证系统
验证认证 API 是否正确使用了 Supabase Auth
"""

import asyncio
import httpx
import json
from datetime import datetime

# API 基础 URL
BASE_URL = "http://localhost:8000/api"

async def test_auth_flow():
    """测试完整的认证流程"""
    async with httpx.AsyncClient() as client:
        # 测试用户信息
        timestamp = int(datetime.now().timestamp())
        test_email = f"test.user+{timestamp}@gmail.com"  # 使用更真实的邮箱格式
        test_password = "Test123456!"
        
        print("🔐 测试 Supabase 认证系统")
        print("=" * 50)
        
        # 1. 注册新用户
        print("\n1️⃣ 注册新用户...")
        register_data = {
            "email": test_email,
            "password": test_password,
            "display_name": "Test User",
            "enable_deep_thinking": True
        }
        
        try:
            response = await client.post(f"{BASE_URL}/auth/register", json=register_data)
            
            if response.status_code == 200:
                auth_data = response.json()
                print(f"✅ 注册成功！")
                print(f"   用户 ID: {auth_data['user']['id']}")
                print(f"   邮箱: {auth_data['user']['email']}")
                print(f"   显示名称: {auth_data['user']['display_name']}")
                print(f"   推理模式: {auth_data['user']['enable_deep_thinking']}")
                
                # 检查是否返回了 session
                if auth_data.get('session', {}).get('access_token'):
                    print(f"   ✅ 获得访问令牌")
                else:
                    print(f"   ⚠️  需要邮箱验证才能获得访问令牌")
                    
            elif response.status_code == 409:
                print("⚠️  用户已存在")
            else:
                print(f"❌ 注册失败: {response.status_code}")
                print(f"   错误: {response.text}")
                
        except Exception as e:
            print(f"❌ 注册请求失败: {e}")
            
        # 2. 用户登录
        print("\n2️⃣ 用户登录...")
        login_data = {
            "email": test_email,
            "password": test_password
        }
        
        try:
            response = await client.post(f"{BASE_URL}/auth/login", json=login_data)
            
            if response.status_code == 200:
                auth_data = response.json()
                access_token = auth_data['session']['access_token']
                
                print(f"✅ 登录成功！")
                print(f"   访问令牌: {access_token[:20]}...")
                print(f"   令牌类型: {auth_data['session']['token_type']}")
                
                # 3. 获取用户信息
                print("\n3️⃣ 获取用户信息...")
                headers = {"Authorization": f"Bearer {access_token}"}
                
                response = await client.get(f"{BASE_URL}/auth/me", headers=headers)
                if response.status_code == 200:
                    user_info = response.json()
                    print(f"✅ 获取用户信息成功！")
                    print(f"   用户 ID: {user_info['id']}")
                    print(f"   邮箱: {user_info['email']}")
                    print(f"   邮箱已验证: {user_info.get('email_confirmed_at') is not None}")
                    
                # 4. 更新用户信息
                print("\n4️⃣ 更新用户信息...")
                update_data = {
                    "display_name": "Updated Test User",
                    "enable_deep_thinking": False
                }
                
                response = await client.put(f"{BASE_URL}/auth/me", json=update_data, headers=headers)
                if response.status_code == 200:
                    updated_user = response.json()
                    print(f"✅ 更新用户信息成功！")
                    print(f"   新显示名称: {updated_user['display_name']}")
                    print(f"   推理模式: {updated_user['enable_deep_thinking']}")
                    
                # 5. 创建任务
                print("\n5️⃣ 创建任务...")
                thread_id = "test-thread-123"
                
                response = await client.post(
                    f"{BASE_URL}/tasks/{thread_id}",
                    headers=headers,
                    params={"task_name": "Test Research Task"}
                )
                
                if response.status_code == 200:
                    task = response.json()
                    print(f"✅ 创建任务成功！")
                    print(f"   任务 ID: {task['id']}")
                    print(f"   线程 ID: {task['thread_id']}")
                    print(f"   任务名称: {task['task_name']}")
                    
                # 6. 获取任务列表
                print("\n6️⃣ 获取任务列表...")
                response = await client.get(f"{BASE_URL}/tasks", headers=headers)
                
                if response.status_code == 200:
                    tasks = response.json()
                    print(f"✅ 获取任务列表成功！")
                    print(f"   任务数量: {len(tasks)}")
                    for task in tasks:
                        print(f"   - {task['task_name']} ({task['status']})")
                        
                # 7. 测试 chat 端点（带认证）
                print("\n7️⃣ 测试 chat 端点（带认证）...")
                chat_data = {
                    "messages": [{"role": "user", "content": "Hello, test message"}],
                    "thread_id": thread_id,
                    "resources": [],
                    "max_plan_iterations": 3,
                    "max_step_num": 5,
                    "max_search_results": 5,
                    "auto_accepted_plan": True,
                    "interrupt_feedback": "",
                    "mcp_settings": {},
                    "enable_background_investigation": False,
                    "report_style": "ACADEMIC",
                    "enable_deep_thinking": False
                }
                
                # 注意：这是一个 SSE 端点，这里只测试是否能成功连接
                response = await client.post(
                    f"{BASE_URL}/chat/stream",
                    json=chat_data,
                    headers=headers,
                    follow_redirects=True
                )
                
                if response.status_code == 200:
                    print(f"✅ Chat 端点连接成功（已认证）")
                else:
                    print(f"❌ Chat 端点连接失败: {response.status_code}")
                    
                # 8. 登出
                print("\n8️⃣ 用户登出...")
                response = await client.post(f"{BASE_URL}/auth/logout", headers=headers)
                
                if response.status_code == 200:
                    print(f"✅ 登出成功！")
                    
            else:
                print(f"❌ 登录失败: {response.status_code}")
                print(f"   错误: {response.text}")
                
        except Exception as e:
            print(f"❌ 请求失败: {e}")
            
        print("\n" + "=" * 50)
        print("🎉 Supabase 认证测试完成！")

async def check_supabase_tables():
    """检查 Supabase 相关的数据库表"""
    print("\n📊 检查数据库表结构...")
    
    import psycopg
    import os
    from dotenv import load_dotenv
    
    load_dotenv()
    database_url = os.getenv('DATABASE_URL')
    
    if not database_url:
        print("❌ 未找到 DATABASE_URL")
        return
        
    try:
        conn = psycopg.connect(database_url)
        cursor = conn.cursor()
        
        # 检查 auth.users 表
        cursor.execute("""
            SELECT column_name, data_type 
            FROM information_schema.columns 
            WHERE table_schema = 'auth' AND table_name = 'users'
            ORDER BY ordinal_position
            LIMIT 5
        """)
        
        print("\n✅ auth.users 表存在")
        print("   主要字段:")
        for col in cursor.fetchall():
            print(f"   - {col[0]}: {col[1]}")
            
        # 检查 user_profiles 表
        cursor.execute("""
            SELECT EXISTS (
                SELECT FROM information_schema.tables 
                WHERE table_schema = 'public' 
                AND table_name = 'user_profiles'
            )
        """)
        
        if cursor.fetchone()[0]:
            print("\n✅ user_profiles 表存在")
        else:
            print("\n⚠️  user_profiles 表不存在（将在首次运行时创建）")
            
        # 检查 user_tasks 表
        cursor.execute("""
            SELECT EXISTS (
                SELECT FROM information_schema.tables 
                WHERE table_schema = 'public' 
                AND table_name = 'user_tasks'
            )
        """)
        
        if cursor.fetchone()[0]:
            print("✅ user_tasks 表存在")
        else:
            print("⚠️  user_tasks 表不存在（将在首次运行时创建）")
            
        cursor.close()
        conn.close()
        
    except Exception as e:
        print(f"❌ 数据库连接失败: {e}")

if __name__ == "__main__":
    print("🚀 开始测试 Supabase 认证系统...")
    print("请确保后端服务正在运行 (./bootstrap.sh --dev)")
    
    # 先检查数据库
    asyncio.run(check_supabase_tables())
    
    # 然后测试认证流程
    asyncio.run(test_auth_flow()) 