#!/usr/bin/env python3
"""
创建开发环境的测试用户
"""

import asyncio
import httpx
import json

# API 基础 URL
BASE_URL = "http://localhost:8000/api"

# 固定的测试用户
TEST_USERS = [
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
    },
    {
        "email": "admin@yadra.test",
        "password": "Admin123456!",
        "display_name": "Admin User",
        "enable_deep_thinking": True
    }
]

async def create_test_users():
    """创建测试用户"""
    async with httpx.AsyncClient() as client:
        print("🚀 创建测试用户...")
        print("=" * 50)
        
        for user_data in TEST_USERS:
            print(f"\n📧 创建用户: {user_data['email']}")
            
            try:
                # 注册用户
                response = await client.post(
                    f"{BASE_URL}/auth/register",
                    json=user_data
                )
                
                if response.status_code == 200:
                    result = response.json()
                    print(f"✅ 注册成功！")
                    print(f"   用户 ID: {result['user']['id']}")
                    print(f"   显示名称: {result['user']['display_name']}")
                    print(f"   推理模式: {result['user']['enable_deep_thinking']}")
                    
                    # 测试登录
                    print(f"\n🔐 测试登录...")
                    login_response = await client.post(
                        f"{BASE_URL}/auth/login",
                        json={
                            "email": user_data["email"],
                            "password": user_data["password"]
                        }
                    )
                    
                    if login_response.status_code == 200:
                        login_result = login_response.json()
                        print(f"✅ 登录成功！")
                        print(f"   Token: {login_result['session']['access_token'][:30]}...")
                        
                        # 测试获取用户信息
                        headers = {"Authorization": f"Bearer {login_result['session']['access_token']}"}
                        me_response = await client.get(f"{BASE_URL}/auth/me", headers=headers)
                        
                        if me_response.status_code == 200:
                            print(f"✅ 获取用户信息成功！")
                    else:
                        print(f"❌ 登录失败: {login_response.status_code}")
                        print(f"   {login_response.text}")
                        
                elif response.status_code == 409:
                    print(f"⚠️  用户已存在")
                    
                    # 测试登录现有用户
                    print(f"🔐 尝试登录现有用户...")
                    login_response = await client.post(
                        f"{BASE_URL}/auth/login",
                        json={
                            "email": user_data["email"],
                            "password": user_data["password"]
                        }
                    )
                    
                    if login_response.status_code == 200:
                        print(f"✅ 登录成功！")
                    else:
                        print(f"❌ 登录失败，密码可能不匹配")
                        
                else:
                    print(f"❌ 注册失败: {response.status_code}")
                    print(f"   {response.text}")
                    
            except Exception as e:
                print(f"❌ 错误: {type(e).__name__}: {e}")
                import traceback
                traceback.print_exc()
        
        print("\n" + "=" * 50)
        print("📝 开发环境测试账号：")
        print("\n以下账号可用于开发和测试：")
        for user in TEST_USERS:
            print(f"\n邮箱: {user['email']}")
            print(f"密码: {user['password']}")
            print(f"用途: {user['display_name']}")

async def test_api_with_auth():
    """测试需要认证的 API"""
    async with httpx.AsyncClient() as client:
        print("\n\n🧪 测试认证后的 API 调用...")
        print("=" * 50)
        
        # 使用第一个测试用户登录
        test_user = TEST_USERS[0]
        
        # 登录
        login_response = await client.post(
            f"{BASE_URL}/auth/login",
            json={
                "email": test_user["email"],
                "password": test_user["password"]
            }
        )
        
        if login_response.status_code == 200:
            login_result = login_response.json()
            token = login_result['session']['access_token']
            headers = {"Authorization": f"Bearer {token}"}
            
            print(f"✅ 使用 {test_user['email']} 登录成功")
            
            # 创建任务
            print(f"\n📝 创建任务...")
            task_response = await client.post(
                f"{BASE_URL}/tasks/test-thread-001",
                headers=headers,
                params={"task_name": "测试研究任务"}
            )
            
            if task_response.status_code == 200:
                task = task_response.json()
                print(f"✅ 任务创建成功！")
                print(f"   任务 ID: {task['id']}")
                print(f"   线程 ID: {task['thread_id']}")
                
            # 获取任务列表
            print(f"\n📋 获取任务列表...")
            tasks_response = await client.get(f"{BASE_URL}/tasks", headers=headers)
            
            if tasks_response.status_code == 200:
                tasks = tasks_response.json()
                print(f"✅ 获取任务列表成功！共 {len(tasks)} 个任务")
                
            # 测试 chat 端点
            print(f"\n💬 测试 Chat API（带认证）...")
            chat_data = {
                "messages": [{"role": "user", "content": "你好，这是一个测试消息"}],
                "thread_id": "test-thread-001",
                "resources": [],
                "max_plan_iterations": 3,
                "max_step_num": 5,
                "max_search_results": 5,
                "auto_accepted_plan": True,
                "interrupt_feedback": "",
                "mcp_settings": {},
                "enable_background_investigation": False,
                "report_style": "ACADEMIC",
                "enable_deep_thinking": test_user["enable_deep_thinking"]
            }
            
            # 注意：这是 SSE 端点，这里只测试连接
            chat_response = await client.post(
                f"{BASE_URL}/chat/stream",
                json=chat_data,
                headers=headers,
                timeout=5.0
            )
            
            if chat_response.status_code == 200:
                print(f"✅ Chat API 连接成功（已认证用户）")
            else:
                print(f"❌ Chat API 连接失败: {chat_response.status_code}")

if __name__ == "__main__":
    print("🚀 YADRA 开发环境用户创建工具")
    print("请确保后端服务正在运行 (./bootstrap.sh --dev)")
    
    # 创建测试用户
    asyncio.run(create_test_users())
    
    # 测试 API
    asyncio.run(test_api_with_auth()) 