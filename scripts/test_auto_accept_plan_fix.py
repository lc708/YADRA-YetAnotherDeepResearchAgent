#!/usr/bin/env python3
"""
测试auto_accepted_plan修复效果
"""

import asyncio
import aiohttp
import json
from datetime import datetime


async def test_auto_accept_plan_fix():
    """测试auto_accepted_plan配置是否生效"""
    
    base_url = "http://localhost:8000/api/research"
    
    # 测试配置1：auto_accepted_plan = False（应该等待用户确认）
    test_config_false = {
        "action": "create",
        "message": "测试auto_accepted_plan=False的效果",
        "frontend_uuid": "test-uuid-1",
        "frontend_context_uuid": "test-context-1", 
        "visitor_id": "test-visitor-1",
        "config": {
            "enableBackgroundInvestigation": True,
            "reportStyle": "academic",
            "enableDeepThinking": False,
            "maxPlanIterations": 2,
            "maxStepNum": 3,
            "maxSearchResults": 3,
            "outputFormat": "markdown",
            "auto_accepted_plan": False,  # 🔥 明确设置为False
        }
    }
    
    # 测试配置2：auto_accepted_plan = True（应该自动执行）
    test_config_true = {
        "action": "create", 
        "message": "测试auto_accepted_plan=True的效果",
        "frontend_uuid": "test-uuid-2",
        "frontend_context_uuid": "test-context-2",
        "visitor_id": "test-visitor-2", 
        "config": {
            "enableBackgroundInvestigation": True,
            "reportStyle": "academic",
            "enableDeepThinking": False,
            "maxPlanIterations": 2,
            "maxStepNum": 3,
            "maxSearchResults": 3,
            "outputFormat": "markdown",
            "auto_accepted_plan": True,  # 🔥 明确设置为True
        }
    }
    
    async with aiohttp.ClientSession() as session:
        print("🧪 测试auto_accepted_plan修复效果")
        print("=" * 60)
        
        # 测试1：auto_accepted_plan = False
        print("\n1️⃣ 测试 auto_accepted_plan = False (应该等待用户确认)")
        print("-" * 40)
        
        async with session.post(f"{base_url}/stream", json=test_config_false) as response:
            if response.status == 200:
                plan_generated = False
                final_report_generated = False
                event_count = 0
                
                async for line in response.content:
                    line_str = line.decode('utf-8').strip()
                    if line_str.startswith('data: '):
                        try:
                            data = json.loads(line_str[6:])
                            event_count += 1
                            
                            if event_count <= 5:  # 只显示前5个事件
                                print(f"   事件 {event_count}: {data.get('event', 'unknown')}")
                            
                            # 检查是否生成了计划
                            if data.get('event') == 'plan_generated':
                                plan_generated = True
                                print(f"   ✅ 计划已生成")
                            
                            # 检查是否直接生成了最终报告
                            if data.get('event') == 'artifact' and 'summary' in str(data):
                                final_report_generated = True
                                print(f"   ⚠️  直接生成了最终报告（不应该发生）")
                                break
                                
                            # 如果完成了，停止
                            if data.get('event') == 'complete':
                                print(f"   ✅ 流程完成，总共 {event_count} 个事件")
                                break
                                
                        except json.JSONDecodeError:
                            continue
                
                # 分析结果
                if plan_generated and not final_report_generated:
                    print(f"   ✅ 测试通过：生成了计划但等待用户确认")
                elif plan_generated and final_report_generated:
                    print(f"   ❌ 测试失败：生成计划后直接生成了报告")
                else:
                    print(f"   ⚠️  测试不确定：plan_generated={plan_generated}, final_report_generated={final_report_generated}")
            else:
                print(f"   ❌ 请求失败: {response.status}")
        
        await asyncio.sleep(2)  # 等待一下
        
        # 测试2：auto_accepted_plan = True  
        print("\n2️⃣ 测试 auto_accepted_plan = True (应该自动执行)")
        print("-" * 40)
        
        async with session.post(f"{base_url}/stream", json=test_config_true) as response:
            if response.status == 200:
                plan_generated = False
                final_report_generated = False
                event_count = 0
                
                async for line in response.content:
                    line_str = line.decode('utf-8').strip()
                    if line_str.startswith('data: '):
                        try:
                            data = json.loads(line_str[6:])
                            event_count += 1
                            
                            if event_count <= 5:  # 只显示前5个事件
                                print(f"   事件 {event_count}: {data.get('event', 'unknown')}")
                            
                            # 检查是否生成了计划
                            if data.get('event') == 'plan_generated':
                                plan_generated = True
                                print(f"   ✅ 计划已生成")
                            
                            # 检查是否生成了最终报告
                            if data.get('event') == 'artifact' and 'summary' in str(data):
                                final_report_generated = True
                                print(f"   ✅ 自动生成了最终报告")
                                break
                                
                            # 如果完成了，停止
                            if data.get('event') == 'complete':
                                print(f"   ✅ 流程完成，总共 {event_count} 个事件")
                                break
                                
                        except json.JSONDecodeError:
                            continue
                
                # 分析结果
                if plan_generated and final_report_generated:
                    print(f"   ✅ 测试通过：自动接受计划并生成了报告")
                elif plan_generated and not final_report_generated:
                    print(f"   ❌ 测试失败：生成了计划但没有自动执行")
                else:
                    print(f"   ⚠️  测试不确定：plan_generated={plan_generated}, final_report_generated={final_report_generated}")
            else:
                print(f"   ❌ 请求失败: {response.status}")
        
        print("\n" + "=" * 60)
        print("🏁 测试完成")


if __name__ == "__main__":
    asyncio.run(test_auto_accept_plan_fix()) 