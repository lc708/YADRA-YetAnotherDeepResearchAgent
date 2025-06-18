#!/usr/bin/env python3
"""
调试前端流式请求，查看实际的SSE响应
"""

import requests
import json
import time

def debug_frontend_stream():
    """调试前端流式请求"""
    url = "http://localhost:8000/api/research/stream"
    
    # 构建测试请求（使用正确的字段名）
    payload = {
        "action": "create",
        "message": "人工智能在医疗领域的应用",
        "frontend_uuid": "debug-frontend-uuid-123",
        "frontend_context_uuid": "debug-context-uuid-456", 
        "visitor_id": "debug-visitor-789",
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
                "expertiseLevel": "intermediate"
            }
        }
    }
    
    headers = {
        "Content-Type": "application/json",
        "Accept": "text/event-stream"
    }
    
    print("🔍 调试前端流式请求...")
    print(f"📤 发送请求到: {url}")
    print(f"📦 请求数据: {json.dumps(payload, indent=2, ensure_ascii=False)}")
    print("\n" + "="*80)
    
    try:
        response = requests.post(url, json=payload, headers=headers, stream=True)
        print(f"📥 响应状态码: {response.status_code}")
        print(f"📋 响应头: {dict(response.headers)}")
        print("\n" + "="*80)
        
        if response.status_code == 200:
            print("✅ API调用成功！开始接收SSE事件...")
            print("\n🎯 **期望看到的第一个事件应该是 navigation 事件**")
            print("\n📊 SSE事件流:")
            print("-" * 80)
            
            event_count = 0
            buffer = ""
            
            for chunk in response.iter_content(chunk_size=1024, decode_unicode=True):
                if chunk:
                    buffer += chunk
                    
                    # 处理完整的SSE事件
                    while "\n\n" in buffer:
                        event_end = buffer.find("\n\n")
                        event_data = buffer[:event_end]
                        buffer = buffer[event_end + 2:]
                        
                        if event_data.strip():
                            event_count += 1
                            print(f"\n📨 事件 {event_count}:")
                            print(f"原始数据: {repr(event_data)}")
                            
                            # 解析SSE事件
                            lines = event_data.strip().split('\n')
                            event_type = None
                            event_data_content = None
                            
                            for line in lines:
                                if line.startswith('event: '):
                                    event_type = line[7:]
                                elif line.startswith('data: '):
                                    event_data_content = line[6:]
                            
                            print(f"事件类型: {event_type}")
                            
                            if event_data_content:
                                try:
                                    parsed_data = json.loads(event_data_content)
                                    print(f"事件数据: {json.dumps(parsed_data, indent=2, ensure_ascii=False)}")
                                    
                                    # 特别检查navigation事件
                                    if event_type == 'navigation':
                                        print("🎉 找到 navigation 事件！")
                                        workspace_url = parsed_data.get('workspace_url')
                                        url_param = parsed_data.get('url_param')
                                        print(f"   workspace_url: {workspace_url}")
                                        print(f"   url_param: {url_param}")
                                        
                                        if workspace_url:
                                            print(f"✅ 前端应该跳转到: http://localhost:3000{workspace_url}")
                                        
                                except json.JSONDecodeError as e:
                                    print(f"❌ JSON解析失败: {e}")
                                    print(f"原始数据: {event_data_content}")
                            
                            print("-" * 40)
                            
                            # 只显示前5个事件
                            if event_count >= 5:
                                print("⏹️ 已接收前5个事件，停止调试")
                                break
                        
                    # 避免无限循环
                    if event_count >= 5:
                        break
                        
        elif response.status_code == 422:
            print("❌ 请求数据格式错误 (422)")
            try:
                error_detail = response.json()
                print(f"🔍 错误详情: {json.dumps(error_detail, indent=2, ensure_ascii=False)}")
            except:
                print(f"🔍 错误详情: {response.text}")
                
        else:
            print(f"❌ API调用失败，状态码: {response.status_code}")
            print(f"🔍 响应内容: {response.text}")
            
    except requests.exceptions.ConnectionError:
        print("❌ 无法连接到服务器，请确保开发服务器正在运行")
    except Exception as e:
        print(f"❌ 调试过程中发生错误: {e}")

if __name__ == "__main__":
    print("🚀 开始调试前端流式请求...")
    
    # 等待服务器启动
    print("⏳ 等待服务器启动...")
    time.sleep(3)
    
    debug_frontend_stream()
    
    print("\n🎯 调试完成！") 