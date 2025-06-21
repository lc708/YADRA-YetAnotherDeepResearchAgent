#!/usr/bin/env python3
"""
HITL请求构建和发送流程详细分析
回答用户关于请求构建和API端点的问题
"""

from datetime import datetime

def analyze_request_construction():
    """
    分析HITL请求的构建过程
    """
    print("🔍 HITL请求构建和发送流程分析")
    print("=" * 60)
    
    print("📋 1. 请求触发源头:")
    print("   文件: web/src/app/workspace/page.tsx")
    print("   函数: handlePlanApprove, handlePlanModify, handlePlanSkipToReport")
    print("   行号: 330-410")
    
    print("\n🏗️ 2. 请求构建过程:")
    print("   Step 1: 获取session_id")
    print("   ```javascript")
    print("   const sessionState = useUnifiedStore.getState().sessionState;")
    print("   const sessionId = sessionState?.sessionMetadata?.session_id;")
    print("   ```")
    
    print("\n   Step 2: 构建ResearchRequest对象")
    print("   ```javascript")
    print("   await sendAskMessage({")
    print("     question: '', // 或用户输入的修改内容")
    print("     askType: 'followup',")
    print("     config: {")
    print("       autoAcceptedPlan: true/false,")
    print("       enableBackgroundInvestigation: false,")
    print("       reportStyle: 'academic',")
    print("       enableDeepThinking: false,")
    print("       maxPlanIterations: 3,")
    print("       maxStepNum: 10,")
    print("       maxSearchResults: 10")
    print("     },")
    print("     context: {")
    print("       sessionId: sessionId,")
    print("       threadId: currentThreadId,")
    print("       urlParam: urlParam")
    print("     },")
    print("     interrupt_feedback: 'accepted' // 或 'edit_plan', 'goto_reporter'")
    print("   });")
    print("   ```")
    
    return True

def analyze_request_sending():
    """
    分析请求发送过程
    """
    print("\n🚀 3. 请求发送过程:")
    print("   文件: web/src/core/store/unified-store.ts")
    print("   函数: sendAskMessage (第921行)")
    
    print("\n   Step 1: 参数转换")
    print("   ```javascript")
    print("   const requestData = {")
    print("     question: request.question,")
    print("     ask_type: request.askType, // 'followup'")
    print("     frontend_uuid: frontendUuid,")
    print("     visitor_id: visitorId,")
    print("     user_id: undefined,")
    print("     config: {")
    print("       auto_accepted_plan: request.config.autoAcceptedPlan,")
    print("       enable_background_investigation: request.config.enableBackgroundInvestigation,")
    print("       report_style: request.config.reportStyle,")
    print("       // ... 其他配置")
    print("     },")
    print("     // followup场景的上下文信息")
    print("     session_id: request.context.sessionId,")
    print("     thread_id: request.context.threadId,")
    print("     url_param: request.context.urlParam,")
    print("     // interrupt_feedback")
    print("     interrupt_feedback: request.interrupt_feedback")
    print("   };")
    print("   ```")
    
    print("\n   Step 2: API端点解析")
    print("   ```javascript")
    print("   const sseStream = fetchStream(")
    print("     resolveServiceURL('research/ask?stream=true'),")
    print("     {")
    print("       method: 'POST',")
    print("       headers: { 'Content-Type': 'application/json' },")
    print("       body: JSON.stringify(requestData)")
    print("     }")
    print("   );")
    print("   ```")
    
    return True

def analyze_api_endpoint():
    """
    分析API端点
    """
    print("\n🎯 4. API端点分析:")
    print("   函数: resolveServiceURL('research/ask?stream=true')")
    print("   文件: web/src/core/api/resolve-service-url.ts")
    
    print("\n   解析逻辑:")
    print("   ```javascript")
    print("   export function resolveServiceURL(path: string) {")
    print("     let BASE_URL = env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8000/api/';")
    print("     if (!BASE_URL.endsWith('/')) {")
    print("       BASE_URL += '/';")
    print("     }")
    print("     return new URL(path, BASE_URL).toString();")
    print("   }")
    print("   ```")
    
    print("\n   📍 实际请求端点:")
    print("   URL: http://localhost:8000/api/research/ask?stream=true")
    print("   Method: POST")
    print("   Content-Type: application/json")
    
    print("\n   📦 请求体结构 (followup场景):")
    print("   {")
    print("     'question': '',")
    print("     'ask_type': 'followup',")
    print("     'frontend_uuid': '生成的UUID',")
    print("     'visitor_id': '访客ID',")
    print("     'user_id': null,")
    print("     'config': { ... },")
    print("     'session_id': 数字ID,")
    print("     'thread_id': 'UUID字符串',")
    print("     'url_param': 'URL参数字符串',")
    print("     'interrupt_feedback': 'accepted'")
    print("   }")
    
    return True

def analyze_backend_handling():
    """
    分析后端处理
    """
    print("\n🔧 5. 后端处理:")
    print("   文件: src/server/research_create_api.py")
    print("   端点: @router.post('/ask')")
    print("   函数: ask_research (第777行)")
    
    print("\n   处理流程:")
    print("   1. 接收ResearchAskRequest")
    print("   2. 根据ask_type='followup'调用_handle_stream_ask")
    print("   3. _prepare_followup_session验证session_id/thread_id/url_param")
    print("   4. 调用research_stream_api.continue_research_stream")
    print("   5. 发送SSE事件流")
    
    print("\n   关键验证逻辑:")
    print("   ```python")
    print("   # 验证followup必需参数")
    print("   if not all([request.session_id, request.thread_id, request.url_param]):")
    print("       raise HTTPException(status_code=400, detail='...')")
    print("   ")
    print("   # 验证session_id是否匹配")
    print("   if session_overview['session_id'] != request.session_id:")
    print("       raise HTTPException(status_code=400, detail='session_id不匹配')")
    print("   ```")
    
    return True

def analyze_potential_issues():
    """
    分析潜在问题
    """
    print("\n⚠️ 6. 潜在问题分析:")
    print("   问题1: session_id类型不匹配")
    print("   - 前端: sessionState?.sessionMetadata?.session_id")
    print("   - 可能是string或number类型")
    print("   - 后端期望: int类型")
    
    print("\n   问题2: sessionState未正确初始化")
    print("   - navigation事件可能没有正确设置session_id")
    print("   - metadata事件可能覆盖了session_id")
    
    print("\n   问题3: 事件处理顺序")
    print("   - 如果metadata事件在navigation事件之后处理")
    print("   - 可能覆盖了sessionMetadata中的session_id")
    
    print("\n   问题4: 数据库查询失败")
    print("   - session_id存在但数据库中找不到对应记录")
    print("   - thread_id或url_param不匹配")
    
    return True

def suggest_debugging_steps():
    """
    建议调试步骤
    """
    print("\n🔍 7. 调试建议:")
    print("   Step 1: 检查sessionState内容")
    print("   ```javascript")
    print("   console.log('Current sessionState:', useUnifiedStore.getState().sessionState);")
    print("   ```")
    
    print("\n   Step 2: 检查请求数据")
    print("   在sendAskMessage中添加详细日志:")
    print("   ```javascript")
    print("   console.log('Request data:', requestData);")
    print("   ```")
    
    print("\n   Step 3: 检查后端接收")
    print("   在research_create_api.py中添加日志:")
    print("   ```python")
    print("   logger.info(f'Received followup request: {request.dict()}');")
    print("   ```")
    
    print("\n   Step 4: 检查数据库状态")
    print("   ```python")
    print("   session_overview = await self.session_repo.get_session_overview(request.url_param)")
    print("   logger.info(f'Session overview: {session_overview}');")
    print("   ```")
    
    return True

def main():
    """
    主函数
    """
    print(f"⏰ 分析开始时间: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    
    try:
        # 请求构建分析
        if analyze_request_construction():
            print("\n✅ 请求构建分析完成")
        
        # 请求发送分析
        if analyze_request_sending():
            print("✅ 请求发送分析完成")
        
        # API端点分析
        if analyze_api_endpoint():
            print("✅ API端点分析完成")
        
        # 后端处理分析
        if analyze_backend_handling():
            print("✅ 后端处理分析完成")
        
        # 潜在问题分析
        if analyze_potential_issues():
            print("✅ 潜在问题分析完成")
        
        # 调试建议
        if suggest_debugging_steps():
            print("✅ 调试建议制定完成")
        
        print("\n🎉 HITL请求流程分析完成！")
        print("\n📋 总结:")
        print("  📍 API端点: http://localhost:8000/api/research/ask?stream=true")
        print("  📦 请求方法: POST (JSON)")
        print("  🔑 关键参数: session_id, thread_id, url_param, interrupt_feedback")
        print("  🎯 后端处理: research_create_api.py -> research_stream_api.py")
        print("  ⚠️ 关键问题: session_id的获取和验证")
        
    except Exception as e:
        print(f"❌ 分析失败: {e}")
        return False
    
    return True

if __name__ == "__main__":
    main() 