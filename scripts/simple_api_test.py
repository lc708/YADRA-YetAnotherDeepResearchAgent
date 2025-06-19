#!/usr/bin/env python3
"""
简单的API测试脚本，用于诊断问题
"""

import asyncio
import aiohttp
import json
import uuid
from dotenv import load_dotenv

async def test_api():
    """测试API是否正常工作"""
    load_dotenv()
    
    print("🧪 简单API测试")
    print("=" * 30)
    
    # 使用正确的UUID格式
    frontend_uuid = str(uuid.uuid4())
    frontend_context_uuid = str(uuid.uuid4())
    visitor_id = str(uuid.uuid4())
    
    request_data = {
        "action": "create",
        "message": "为什么人每天早上睡醒后会感到饥饿？",
        "frontend_uuid": frontend_uuid,
        "frontend_context_uuid": frontend_context_uuid,
        "visitor_id": visitor_id,
        "config": {
            "auto_accepted_plan": True,
            "maxStepNum": 1
        }
    }
    
    print(f"📋 请求数据:")
    print(json.dumps(request_data, indent=2, ensure_ascii=False))
    
    try:
        async with aiohttp.ClientSession() as session:
            print(f"\n📡 发送POST请求到: http://localhost:8000/api/research/stream")
            
            async with session.post(
                "http://localhost:8000/api/research/stream",
                json=request_data,
                headers={"Content-Type": "application/json"}
            ) as response:
                print(f"📊 响应状态: {response.status}")
                print(f"📋 响应头: {dict(response.headers)}")
                
                if response.status != 200:
                    error_text = await response.text()
                    print(f"❌ 错误响应: {error_text}")
                    return
                
                print(f"\n📡 开始读取SSE流...")
                line_count = 0
                
                async for line in response.content:
                    if line:
                        line_str = line.decode().strip()
                        line_count += 1
                        
                        print(f"[{line_count:2d}] {line_str}")
                        
                        # 只读取前10行，避免无限等待
                        if line_count >= 10:
                            print("📄 已读取10行，停止...")
                            break
                
                print(f"✅ 测试完成，共读取{line_count}行")
                
    except aiohttp.ClientConnectorError:
        print("❌ 无法连接到服务器")
        print("💡 请确保服务器正在运行: ./bootstrap.sh --dev")
    except Exception as e:
        print(f"❌ 测试失败: {e}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    asyncio.run(test_api()) 