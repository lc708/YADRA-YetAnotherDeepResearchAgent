#!/usr/bin/env python3
"""
测试数据保存修复效果
"""

import asyncio
import aiohttp
import json
import time
from datetime import datetime

async def test_create_and_check_data():
    """测试创建研究任务并检查数据保存"""
    print("🧪 测试数据保存修复效果")
    print("=" * 50)
    
    # 1. 创建研究任务
    print("\n1️⃣ 创建研究任务...")
    create_url = "http://localhost:8000/api/research/create"
    create_data = {
        "question": "测试数据保存功能：人工智能的发展历程",
        "frontend_uuid": "test-uuid-12345",
        "visitor_id": "test-visitor-67890",
        "config": {
            "research_config": {
                "report_style": "academic",
                "enable_background_investigation": True
            },
            "model_config": {
                "model_name": "claude-3-5-sonnet",
                "provider": "anthropic"
            },
            "output_config": {
                "output_format": "markdown"
            }
        }
    }
    
    try:
        async with aiohttp.ClientSession() as session:
            async with session.post(create_url, json=create_data) as response:
                if response.status == 200:
                    result = await response.json()
                    url_param = result["url_param"]
                    print(f"   ✅ 研究任务创建成功: {url_param}")
                else:
                    print(f"   ❌ 创建失败: {response.status}")
                    return False
    except Exception as e:
        print(f"   ❌ 请求失败: {e}")
        return False
    
    # 2. 等待后台任务处理
    print("\n2️⃣ 等待后台任务处理（30秒）...")
    await asyncio.sleep(30)
    
    # 3. 检查workspace数据
    print("\n3️⃣ 检查workspace数据...")
    workspace_url = f"http://localhost:8000/api/research/workspace/{url_param}"
    
    try:
        async with aiohttp.ClientSession() as session:
            async with session.get(workspace_url) as response:
                if response.status == 200:
                    data = await response.json()
                    
                    print(f"   Thread ID: {data.get('thread_id')}")
                    print(f"   Status: {data.get('status')}")
                    
                    messages = data.get('messages', [])
                    artifacts = data.get('artifacts', [])
                    
                    print(f"   消息数量: {len(messages)}")
                    print(f"   Artifacts数量: {len(artifacts)}")
                    
                    if messages:
                        print("\n   📝 消息列表:")
                        for i, msg in enumerate(messages[:3]):  # 只显示前3条
                            role = msg.get('role', 'unknown')
                            content_preview = msg.get('content', '')[:100] + "..." if len(msg.get('content', '')) > 100 else msg.get('content', '')
                            source = msg.get('metadata', {}).get('source_agent', 'unknown')
                            print(f"     {i+1}. [{role}] {source}: {content_preview}")
                    
                    if artifacts:
                        print("\n   🎨 Artifacts列表:")
                        for i, art in enumerate(artifacts):
                            art_type = art.get('type', 'unknown')
                            title = art.get('title', 'untitled')
                            content_preview = art.get('content', '')[:100] + "..." if len(art.get('content', '')) > 100 else art.get('content', '')
                            print(f"     {i+1}. [{art_type}] {title}: {content_preview}")
                    
                    # 判断修复是否成功
                    if messages or artifacts:
                        print(f"\n   ✅ 数据保存修复成功！找到 {len(messages)} 条消息和 {len(artifacts)} 个artifacts")
                        return True
                    else:
                        print(f"\n   ❌ 数据保存仍有问题：没有找到消息或artifacts")
                        return False
                        
                else:
                    print(f"   ❌ 获取workspace数据失败: {response.status}")
                    return False
                    
    except Exception as e:
        print(f"   ❌ 请求失败: {e}")
        return False

async def main():
    success = await test_create_and_check_data()
    if success:
        print("\n🎉 测试通过！数据保存修复成功！")
    else:
        print("\n💥 测试失败！需要进一步调试")
    
    return success

if __name__ == "__main__":
    result = asyncio.run(main())
    exit(0 if result else 1) 