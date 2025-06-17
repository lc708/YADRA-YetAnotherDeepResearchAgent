#!/usr/bin/env python3
"""
Test Reasoning Content Streaming
测试推理内容的流式传输功能
"""

import os
import asyncio
import json
from dotenv import load_dotenv


async def test_reasoning_streaming():
    """测试推理内容流式传输 - 简化版本"""

    # 加载环境变量
    load_dotenv()

    print("🔧 Testing reasoning content streaming...")

    try:
        # 测试DeepSeek推理模型配置
        from src.llms.llm import get_llm_by_type

        print("🧠 Testing DeepSeek reasoning model...")
        reasoning_llm = get_llm_by_type("reasoning")
        print(f"✅ Reasoning LLM type: {type(reasoning_llm)}")

        # 测试简单推理调用
        test_messages = [{"role": "user", "content": "什么是vibe coding？请简要解释。"}]

        print("🔧 Testing reasoning model stream...")
        reasoning_chunks = []

        # 流式调用
        stream = reasoning_llm.stream(test_messages)
        chunk_count = 0

        for chunk in stream:
            chunk_count += 1

            # 检查推理内容
            if hasattr(chunk, "additional_kwargs"):
                reasoning_content = chunk.additional_kwargs.get("reasoning_content")
                if reasoning_content:
                    reasoning_chunks.append(reasoning_content)
                    print(
                        f"🧠 Reasoning chunk {len(reasoning_chunks)}: {reasoning_content[:50]}..."
                    )

            # 检查常规内容
            if hasattr(chunk, "content") and chunk.content:
                print(f"💬 Content chunk {chunk_count}: {chunk.content[:30]}...")

            # 限制测试数量
            if chunk_count >= 10:
                break

        print(f"\n📊 测试结果:")
        print(f"   📝 总chunk数: {chunk_count}")
        print(f"   🧠 推理chunk数: {len(reasoning_chunks)}")

        success = chunk_count > 0
        print(f"\n🎉 推理流式传输测试: {'成功' if success else '失败'}")
        return success

    except Exception as e:
        print(f"❌ 测试失败: {e}")
        import traceback

        traceback.print_exc()
        return False


if __name__ == "__main__":
    success = asyncio.run(test_reasoning_streaming())
    exit(0 if success else 1)
