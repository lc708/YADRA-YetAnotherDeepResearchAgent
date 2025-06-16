#!/usr/bin/env python3
"""
测试登录功能
"""

import asyncio
import httpx
import json

BASE_URL = "http://localhost:8000/api"

async def test_login():
    """测试登录"""
    async with httpx.AsyncClient(timeout=30.0) as client:
        print("🔐 测试登录功能")
        print("=" * 50)
        
        # 测试账号
        test_account = {
            "email": "dev@yadra.test",
            "password": "Dev123456!"
        }
        
        print(f"\n📧 登录账号: {test_account['email']}")
        
        try:
            # 登录
            response = await client.post(
                f"{BASE_URL}/auth/login",
                json=test_account
            )
            
            if response.status_code == 200:
                result = response.json()
                print("✅ 登录成功！")
                print(f"   用户 ID: {result['user']['id']}")
                print(f"   邮箱: {result['user']['email']}")
                print(f"   显示名称: {result['user']['display_name']}")
                print(f"   推理模式: {result['user']['enable_deep_thinking']}")
                print(f"   Access Token: {result['session']['access_token'][:30]}...")
                
                # 测试获取用户信息
                headers = {"Authorization": f"Bearer {result['session']['access_token']}"}
                
                print("\n📋 获取用户信息...")
                me_response = await client.get(f"{BASE_URL}/auth/me", headers=headers)
                
                if me_response.status_code == 200:
                    user_info = me_response.json()
                    print("✅ 获取成功！")
                    print(f"   用户 ID: {user_info['id']}")
                    print(f"   邮箱: {user_info['email']}")
                    
                # 测试创建任务
                print("\n📝 创建任务...")
                task_response = await client.post(
                    f"{BASE_URL}/tasks/demo-thread-001",
                    headers=headers,
                    params={"task_name": "演示任务"}
                )
                
                if task_response.status_code == 200:
                    task = task_response.json()
                    print("✅ 任务创建成功！")
                    print(f"   任务 ID: {task['id']}")
                    print(f"   线程 ID: {task['thread_id']}")
                    
            else:
                print(f"❌ 登录失败: {response.status_code}")
                print(f"   {response.text}")
                
        except Exception as e:
            print(f"❌ 错误: {e}")

if __name__ == "__main__":
    print("🚀 YADRA 认证系统测试")
    asyncio.run(test_login()) 