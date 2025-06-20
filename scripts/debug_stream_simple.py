#!/usr/bin/env python3
"""
简化的流式测试，检查基本的流式功能
"""

import asyncio
import json
import httpx
import uuid


async def test_simple_stream():
    """测试简化的流式功能"""

    base_url = "http://localhost:8000"

    # 最简单的请求
    request_data = {
        "question": "什么是AI？",
        "ask_type": "initial",
        "frontend_uuid": str(uuid.uuid4()),
        "visitor_id": str(uuid.uuid4()),
        "user_id": None,
        "config": {},  # 最简配置
    }

    print(f"🚀 Testing simple stream")
    print(f"Request: {json.dumps(request_data, indent=2, ensure_ascii=False)}")

    try:
        timeout = httpx.Timeout(30.0, connect=10.0)

        async with httpx.AsyncClient(timeout=timeout) as client:
            print("📡 Sending request...")

            response = await client.post(
                f"{base_url}/api/research/ask?stream=true",
                json=request_data,
                headers={"Accept": "text/event-stream"},
            )

            print(f"Response status: {response.status_code}")
            print(f"Response headers: {dict(response.headers)}")

            if response.status_code != 200:
                content = await response.aread()
                print(f"Error response: {content.decode()}")
                return

            # 读取前几个chunk
            chunk_count = 0
            async for chunk in response.aiter_bytes():
                chunk_count += 1
                print(f"📦 Chunk #{chunk_count}: {len(chunk)} bytes")
                print(f"   Content: {chunk.decode('utf-8', errors='ignore')[:200]}...")

                if chunk_count >= 5:  # 只读取前5个chunk
                    print("   ... (limiting output)")
                    break

            print(f"✅ Successfully received {chunk_count} chunks")

    except Exception as e:
        print(f"❌ Test failed: {e}")
        import traceback

        traceback.print_exc()


if __name__ == "__main__":
    asyncio.run(test_simple_stream())
