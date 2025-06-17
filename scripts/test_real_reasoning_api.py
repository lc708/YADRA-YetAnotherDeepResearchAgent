#!/usr/bin/env python3
"""
Test Real Reasoning API Call
验证推理模型是否真正调用了DeepSeek API
"""

from dotenv import load_dotenv


def test_actual_reasoning():
    """测试推理模型真正的API调用"""

    load_dotenv()

    print("🔧 Testing actual reasoning API call...")

    try:
        from src.llms.llm import get_llm_by_type

        reasoning_llm = get_llm_by_type("reasoning")
        print(f"✅ Reasoning LLM created: {type(reasoning_llm)}")
        print(f"   Model: {reasoning_llm.model_name}")
        print(f'   API Base: {getattr(reasoning_llm, "base_url", "Not set")}')

        # 尝试简单调用，验证是否真正调用API
        print(f"\n🌐 Making actual API call to DeepSeek...")
        response = reasoning_llm.invoke(
            "Hello, what is 2+2? Please show your reasoning."
        )

        print(f"✅ API调用成功!")
        print(f"   响应长度: {len(response.content)} characters")
        print(f"   响应预览: {response.content[:200]}...")

        # 检查是否有推理内容
        additional_kwargs = getattr(response, "additional_kwargs", {})
        reasoning_content = additional_kwargs.get("reasoning_content", "")

        if reasoning_content:
            print(f"✅ 发现推理内容!")
            print(f"   推理内容长度: {len(reasoning_content)} characters")
            print(f"   推理内容预览: {reasoning_content[:200]}...")
        else:
            print(f"⚠️  未发现推理内容，可能不是真正的推理模型调用")

        print(f"\n🎉 推理API调用测试完成!")
        return True

    except Exception as e:
        print(f"❌ 测试失败: {e}")
        import traceback

        traceback.print_exc()
        return False


if __name__ == "__main__":
    success = test_actual_reasoning()
    exit(0 if success else 1)
