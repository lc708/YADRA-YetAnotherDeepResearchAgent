#!/usr/bin/env python3
"""
测试前端字段名修复后的API调用
"""

import requests
import json
import time


def test_research_stream_api():
    """测试研究流式API"""
    url = "http://localhost:8000/api/research/stream"

    # 构建测试请求（使用正确的字段名）
    payload = {
        "action": "create",
        "message": "人工智能在医疗领域的应用",
        "frontend_uuid": "test-frontend-uuid-123",
        "frontend_context_uuid": "test-context-uuid-456",
        "visitor_id": "test-visitor-789",
        "user_id": None,
        "config": {
            "enableBackgroundInvestigation": True,
            "reportStyle": "academic",
            "enableDeepThinking": False,
            "maxPlanIterations": 3,
            "maxStepNum": 10,
            "maxSearchResults": 5,
            "outputFormat": "markdown",
            "includeCitations": True,
            "includeArtifacts": True,
            "userPreferences": {
                "writingStyle": "academic",
                "expertiseLevel": "intermediate",
            },
        },
    }

    headers = {"Content-Type": "application/json", "Accept": "text/event-stream"}

    print("🧪 测试研究流式API...")
    print(f"📤 发送请求到: {url}")
    print(f"📦 请求数据: {json.dumps(payload, indent=2, ensure_ascii=False)}")

    try:
        response = requests.post(url, json=payload, headers=headers, stream=True)
        print(f"📥 响应状态码: {response.status_code}")

        if response.status_code == 200:
            print("✅ API调用成功！")
            print("📊 开始接收SSE事件...")

            event_count = 0
            for line in response.iter_lines(decode_unicode=True):
                if line:
                    print(f"📨 事件 {event_count + 1}: {line}")
                    event_count += 1

                    # 只显示前几个事件，避免输出过多
                    if event_count >= 5:
                        print("⏹️ 已接收前5个事件，停止测试")
                        break

        elif response.status_code == 422:
            print("❌ 请求数据格式错误 (422)")
            try:
                error_detail = response.json()
                print(
                    f"🔍 错误详情: {json.dumps(error_detail, indent=2, ensure_ascii=False)}"
                )
            except:
                print(f"🔍 错误详情: {response.text}")

        else:
            print(f"❌ API调用失败，状态码: {response.status_code}")
            print(f"🔍 响应内容: {response.text}")

    except requests.exceptions.ConnectionError:
        print("❌ 无法连接到服务器，请确保开发服务器正在运行")
    except Exception as e:
        print(f"❌ 测试过程中发生错误: {e}")


def test_workspace_api():
    """测试工作区API"""
    # 这里使用一个已知的URL参数进行测试
    test_url_param = "ren-gong-zhi-neng-yi-liao-ling-yu-nei-xi-UFuniWta"
    url = f"http://localhost:8000/api/research/workspace/{test_url_param}"

    print(f"\n🧪 测试工作区API...")
    print(f"📤 发送请求到: {url}")

    try:
        response = requests.get(url)
        print(f"📥 响应状态码: {response.status_code}")

        if response.status_code == 200:
            print("✅ 工作区API调用成功！")
            data = response.json()
            print(f"📊 返回数据字段: {list(data.keys())}")

            # 检查字段名是否正确
            if "thread_id" in data:
                print(f"✅ thread_id字段存在: {data['thread_id']}")
            else:
                print("❌ thread_id字段不存在")

            if "url_param" in data:
                print(f"✅ url_param字段存在: {data['url_param']}")
            else:
                print("❌ url_param字段不存在")

        else:
            print(f"❌ 工作区API调用失败，状态码: {response.status_code}")
            print(f"🔍 响应内容: {response.text}")

    except requests.exceptions.ConnectionError:
        print("❌ 无法连接到服务器，请确保开发服务器正在运行")
    except Exception as e:
        print(f"❌ 测试过程中发生错误: {e}")


if __name__ == "__main__":
    print("🚀 开始测试前端字段名修复...")

    # 等待服务器启动
    print("⏳ 等待服务器启动...")
    time.sleep(5)

    # 测试研究流式API
    test_research_stream_api()

    # 测试工作区API
    test_workspace_api()

    print("\n🎯 测试完成！")
