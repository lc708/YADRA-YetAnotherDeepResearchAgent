#!/usr/bin/env python3
"""
测试workspace页面的interrupt集成功能
验证PlanCard在ArtifactsPanel中的显示和交互
"""

import asyncio
import json
import aiohttp
import time
from datetime import datetime

async def test_workspace_interrupt_integration():
    """测试完整的workspace interrupt集成流程"""
    
    print("🚀 开始测试workspace页面interrupt集成功能")
    print("=" * 60)
    
    # 测试配置
    base_url = "http://localhost:8000"
    test_question = "请分析量子计算对现代密码学的影响"
    
    try:
        # 步骤1：发起初始研究请求
        print("\n📋 步骤1：发起初始研究请求")
        initial_data = {
            "question": test_question,
            "ask_type": "initial",
            "frontend_uuid": f"test-{int(time.time())}",
            "visitor_id": "test-visitor",
            "config": {
                "auto_accepted_plan": False,  # 🔥 关键：设置为False触发interrupt
                "enable_background_investigation": False,
                "report_style": "academic",
                "enable_deep_thinking": False,
                "max_plan_iterations": 3,
                "max_step_num": 10,
                "max_search_results": 10
            }
        }
        
        print(f"请求数据: {json.dumps(initial_data, indent=2, ensure_ascii=False)}")
        
        # 发起SSE请求
        async with aiohttp.ClientSession() as session:
            async with session.post(
                f"{base_url}/api/research/ask?stream=true",
                json=initial_data,
                headers={"Content-Type": "application/json"}
            ) as response:
                
                if response.status != 200:
                    print(f"❌ 初始请求失败: {response.status}")
                    text = await response.text()
                    print(f"错误响应: {text}")
                    return
                
                navigation_data = None
                interrupt_data = None
                event_count = 0
                
                # 处理SSE流
                async for line in response.content:
                    line = line.decode('utf-8').strip()
                    if not line:
                        continue
                    
                    if line.startswith('event: '):
                        event_type = line[7:]
                        continue
                    
                    if line.startswith('data: '):
                        try:
                            data = json.loads(line[6:])
                            event_count += 1
                            
                            print(f"📨 事件 {event_count}: {event_type}")
                            print(f"   数据: {json.dumps(data, indent=2, ensure_ascii=False)}")
                            
                            # 保存navigation数据
                            if event_type == 'navigation':
                                navigation_data = data
                                print(f"✅ 获取到导航数据: {data['workspace_url']}")
                            
                            # 保存interrupt数据
                            elif event_type == 'interrupt':
                                interrupt_data = data
                                print(f"🔔 获取到interrupt数据!")
                                print(f"   Thread ID: {data.get('thread_id')}")
                                print(f"   Message: {data.get('content', data.get('message'))}")
                                print(f"   Options: {data.get('options')}")
                                
                                # 找到interrupt后停止
                                break
                                
                        except json.JSONDecodeError as e:
                            print(f"⚠️  JSON解析失败: {e}")
                            continue
                
                print(f"\n📊 总共接收到 {event_count} 个事件")
                
                # 验证结果
                if not navigation_data:
                    print("❌ 未收到navigation事件")
                    return
                
                if not interrupt_data:
                    print("❌ 未收到interrupt事件")
                    return
                
                # 步骤2：测试interrupt feedback
                print(f"\n📋 步骤2：测试interrupt feedback")
                
                # 模拟用户选择"accepted"
                feedback_data = {
                    "question": "",
                    "ask_type": "followup",
                    "frontend_uuid": initial_data["frontend_uuid"],
                    "visitor_id": initial_data["visitor_id"],
                    "thread_id": navigation_data["thread_id"],
                    "url_param": navigation_data["url_param"],
                    "interrupt_feedback": "accepted",  # 🔥 关键字段
                    "config": {
                        "auto_accepted_plan": True,
                        "enable_background_investigation": False,
                        "report_style": "academic",
                        "enable_deep_thinking": False,
                        "max_plan_iterations": 3,
                        "max_step_num": 10,
                        "max_search_results": 10
                    }
                }
                
                print(f"Feedback请求数据: {json.dumps(feedback_data, indent=2, ensure_ascii=False)}")
                
                # 发起feedback请求
                async with session.post(
                    f"{base_url}/api/research/ask?stream=true",
                    json=feedback_data,
                    headers={"Content-Type": "application/json"}
                ) as feedback_response:
                    
                    if feedback_response.status != 200:
                        print(f"❌ Feedback请求失败: {feedback_response.status}")
                        text = await feedback_response.text()
                        print(f"错误响应: {text}")
                        return
                    
                    feedback_event_count = 0
                    
                    # 处理feedback SSE流（只看前几个事件）
                    async for line in feedback_response.content:
                        line = line.decode('utf-8').strip()
                        if not line:
                            continue
                        
                        if line.startswith('event: '):
                            event_type = line[7:]
                            continue
                        
                        if line.startswith('data: '):
                            try:
                                data = json.loads(line[6:])
                                feedback_event_count += 1
                                
                                print(f"📨 Feedback事件 {feedback_event_count}: {event_type}")
                                print(f"   数据: {json.dumps(data, indent=2, ensure_ascii=False)}")
                                
                                # 看到几个事件后停止
                                if feedback_event_count >= 5:
                                    break
                                    
                            except json.JSONDecodeError as e:
                                print(f"⚠️  JSON解析失败: {e}")
                                continue
                    
                    print(f"\n📊 Feedback总共接收到 {feedback_event_count} 个事件")
        
        # 步骤3：总结测试结果
        print(f"\n🎉 测试完成总结")
        print("=" * 60)
        print(f"✅ 初始请求成功，收到 {event_count} 个事件")
        print(f"✅ Navigation事件正常: {navigation_data['workspace_url']}")
        print(f"✅ Interrupt事件正常: thread_id={interrupt_data.get('thread_id')}")
        print(f"✅ Feedback请求成功，收到 {feedback_event_count} 个事件")
        print(f"\n🔗 前端测试URL: http://localhost:3000{navigation_data['workspace_url']}")
        print(f"🧪 Thread ID: {navigation_data['thread_id']}")
        print(f"🔗 URL参数: {navigation_data['url_param']}")
        
        # 验证前端集成点
        print(f"\n🎯 前端集成验证点:")
        print(f"1. 访问 {navigation_data['workspace_url']} 应该显示workspace页面")
        print(f"2. ArtifactsPanel应该显示PlanCard（基于interrupt数据）")
        print(f"3. PlanCard的回调函数应该能正确处理用户选择")
        print(f"4. 用户选择后应该发起新的ASK API请求（带interrupt_feedback）")
        
    except Exception as e:
        print(f"❌ 测试失败: {e}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    asyncio.run(test_workspace_interrupt_integration()) 