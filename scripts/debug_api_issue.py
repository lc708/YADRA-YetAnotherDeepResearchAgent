#!/usr/bin/env python3
"""
调试API超时问题
"""

import asyncio
import json
import os
from datetime import datetime
from dotenv import load_dotenv

async def test_database_connection():
    """测试数据库连接"""
    print("🔍 测试数据库连接...")
    
    try:
        load_dotenv()
        db_url = os.getenv("DATABASE_URL")
        if not db_url:
            print("❌ DATABASE_URL环境变量未设置")
            return False
        
        print(f"📍 数据库URL: {db_url[:50]}...")
        
        # 导入SessionRepository
        from src.server.repositories.session_repository import get_session_repository
        
        repo = get_session_repository(db_url)
        print("✅ SessionRepository创建成功")
        
        # 测试数据库连接
        conn = await repo.get_connection()
        print("✅ 数据库连接成功")
        
        # 测试基本查询
        cursor = conn.cursor()
        await cursor.execute("SELECT 1")
        result = await cursor.fetchone()
        print(f"✅ 基本查询成功: {result}")
        
        return True
        
    except Exception as e:
        print(f"❌ 数据库连接失败: {e}")
        return False

async def test_langgraph_creation():
    """测试LangGraph创建"""
    print("\n🔍 测试LangGraph创建...")
    
    try:
        from src.graph.async_builder import create_graph
        
        print("⏳ 正在创建LangGraph实例...")
        graph = await create_graph()
        print("✅ LangGraph创建成功")
        
        return True
        
    except Exception as e:
        print(f"❌ LangGraph创建失败: {e}")
        return False

async def test_research_stream_service():
    """测试ResearchStreamService"""
    print("\n🔍 测试ResearchStreamService...")
    
    try:
        load_dotenv()
        db_url = os.getenv("DATABASE_URL")
        
        from src.server.repositories.session_repository import get_session_repository
        from src.server.research_stream_api import ResearchStreamService, ResearchStreamRequest, ActionType
        
        repo = get_session_repository(db_url)
        service = ResearchStreamService(repo)
        print("✅ ResearchStreamService创建成功")
        
        # 创建测试请求（使用真正的UUID）
        import uuid
        test_request = ResearchStreamRequest(
            action=ActionType.CREATE,
            message="测试消息",
            frontend_uuid=str(uuid.uuid4()),
            frontend_context_uuid=str(uuid.uuid4()),
            visitor_id=str(uuid.uuid4()),
            user_id=None,
            config={
                "enableBackgroundInvestigation": True,
                "reportStyle": "academic",
                "enableDeepThinking": False,
                "maxPlanIterations": 1,
                "maxStepNum": 3,
                "maxSearchResults": 3
            }
        )
        
        print("⏳ 正在测试create_research_stream...")
        
        # 设置超时
        async def test_with_timeout():
            count = 0
            async for event in service.create_research_stream(test_request):
                count += 1
                print(f"📨 接收到事件 {count}: {event['event']}")
                
                # 只测试前3个事件
                if count >= 3:
                    break
            
            return count
        
        # 设置5秒超时
        try:
            event_count = await asyncio.wait_for(test_with_timeout(), timeout=15.0)
            print(f"✅ 成功接收到 {event_count} 个事件")
            return True
        except asyncio.TimeoutError:
            print("❌ 测试超时，可能在某个步骤卡住了")
            return False
        
    except Exception as e:
        print(f"❌ ResearchStreamService测试失败: {e}")
        import traceback
        traceback.print_exc()
        return False

async def main():
    """主测试函数"""
    print("🚀 开始API问题调试...")
    print("=" * 60)
    
    # 测试数据库连接
    db_ok = await test_database_connection()
    
    # 测试LangGraph
    if db_ok:
        graph_ok = await test_langgraph_creation()
    else:
        graph_ok = False
    
    # 测试完整服务
    if db_ok and graph_ok:
        service_ok = await test_research_stream_service()
    else:
        service_ok = False
    
    print("\n" + "=" * 60)
    print("🎯 测试结果总结:")
    print(f"  - 数据库连接: {'✅' if db_ok else '❌'}")
    print(f"  - LangGraph创建: {'✅' if graph_ok else '❌'}")
    print(f"  - 研究流服务: {'✅' if service_ok else '❌'}")
    
    if not service_ok:
        print("\n💡 建议:")
        if not db_ok:
            print("  - 检查数据库连接配置")
        if not graph_ok:
            print("  - 检查LangGraph配置和依赖")
        if db_ok and graph_ok:
            print("  - 检查ResearchStreamService的具体实现")

if __name__ == "__main__":
    asyncio.run(main()) 