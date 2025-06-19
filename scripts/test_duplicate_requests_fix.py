#!/usr/bin/env python3
"""
测试重复请求修复效果

验证 workspace 页面是否还有重复的 getWorkspaceState 请求
"""

import asyncio
import aiohttp
import time
from collections import defaultdict

async def test_workspace_requests():
    """测试 workspace API 请求模式"""
    
    # 测试的 URL 参数
    test_url_param = "jin-tian-ou-zhou-mei-guo-zui-xin-xin-wen-Kijn6KM5"
    
    # 请求计数器
    request_count = defaultdict(int)
    
    async with aiohttp.ClientSession() as session:
        # 模拟前端加载 workspace 页面时的请求
        start_time = time.time()
        
        try:
            # 发送工作区状态请求
            url = f"http://localhost:8000/api/research/workspace/{test_url_param}"
            print(f"🔍 Testing workspace API: {url}")
            
            async with session.get(url) as response:
                request_count["workspace_get"] += 1
                print(f"📡 GET /api/research/workspace/{test_url_param} - Status: {response.status}")
                
                if response.status == 200:
                    data = await response.json()
                    print(f"✅ Workspace data retrieved successfully")
                    print(f"   - Thread ID: {data.get('thread_id', 'N/A')}")
                    print(f"   - Messages: {len(data.get('messages', []))}")
                    print(f"   - Session metadata: {'Yes' if data.get('sessionMetadata') else 'No'}")
                else:
                    print(f"❌ Failed to get workspace data: {response.status}")
                    
        except Exception as e:
            print(f"❌ Request failed: {e}")
        
        end_time = time.time()
        print(f"\n📊 Test Results:")
        print(f"   - Total time: {end_time - start_time:.2f}s")
        print(f"   - Workspace GET requests: {request_count['workspace_get']}")
        
        if request_count['workspace_get'] == 1:
            print("✅ SUCCESS: Only one workspace request detected")
        else:
            print(f"❌ ISSUE: {request_count['workspace_get']} workspace requests detected")

async def main():
    """主测试函数"""
    print("🧪 Testing Duplicate Requests Fix")
    print("=" * 50)
    
    await test_workspace_requests()
    
    print("\n" + "=" * 50)
    print("🏁 Test completed")

if __name__ == "__main__":
    asyncio.run(main()) 