#!/usr/bin/env python3
"""
动态验证LangGraph执行时的实时数据保存能力

测试流程：
1. 启动一个新的研究任务
2. 实时监控数据库变化
3. 验证artifact保存逻辑
4. 分析数据一致性
"""

import asyncio
import aiohttp
import json
import time
import uuid
from datetime import datetime
from typing import Dict, List, Any
import psycopg
from psycopg.rows import dict_row
from dotenv import load_dotenv
import os

class RealtimeDataMonitor:
    def __init__(self, db_url: str):
        self.db_url = db_url
        self.monitoring = False
        self.initial_counts = {}
        
    async def get_table_counts(self) -> Dict[str, int]:
        """获取各表的记录数量"""
        async with await psycopg.AsyncConnection.connect(self.db_url, row_factory=dict_row) as conn:
            cursor = conn.cursor()
            
            counts = {}
            
            # 统计各表数量
            tables = [
                'session_mapping',
                'execution_record', 
                'message_history',
                'artifact_storage',
                'checkpoints'
            ]
            
            for table in tables:
                await cursor.execute(f"SELECT COUNT(*) as count FROM {table}")
                result = await cursor.fetchone()
                counts[table] = result['count']
            
            return counts
    
    async def get_latest_session_data(self) -> Dict[str, Any]:
        """获取最新session的详细数据"""
        async with await psycopg.AsyncConnection.connect(self.db_url, row_factory=dict_row) as conn:
            cursor = conn.cursor()
            
            # 获取最新session
            await cursor.execute("""
                SELECT id, thread_id, url_param, initial_question, status, created_at
                FROM session_mapping 
                ORDER BY created_at DESC 
                LIMIT 1
            """)
            session = await cursor.fetchone()
            
            if not session:
                return {}
            
            session_id = session['id']
            thread_id = session['thread_id']
            
            # 获取该session的详细数据
            data = {
                'session': dict(session),
                'messages': [],
                'artifacts': [],
                'executions': [],
                'checkpoints': []
            }
            
            # 消息数据
            await cursor.execute("""
                SELECT role, content_type, source_agent, timestamp,
                       LENGTH(content) as content_length
                FROM message_history 
                WHERE session_id = %s 
                ORDER BY timestamp DESC 
                LIMIT 5
            """, (session_id,))
            data['messages'] = await cursor.fetchall()
            
            # Artifact数据
            await cursor.execute("""
                SELECT type, title, source_agent, created_at,
                       LENGTH(content) as content_length
                FROM artifact_storage 
                WHERE session_id = %s 
                ORDER BY created_at DESC 
                LIMIT 5
            """, (session_id,))
            data['artifacts'] = await cursor.fetchall()
            
            # 执行记录
            await cursor.execute("""
                SELECT execution_id, action_type, status, start_time, end_time
                FROM execution_record 
                WHERE session_id = %s 
                ORDER BY created_at DESC 
                LIMIT 3
            """, (session_id,))
            data['executions'] = await cursor.fetchall()
            
            # Checkpoints
            await cursor.execute("""
                SELECT checkpoint_id, type, metadata
                FROM checkpoints 
                WHERE thread_id = %s 
                ORDER BY checkpoint_id DESC 
                LIMIT 3
            """, (thread_id,))
            data['checkpoints'] = await cursor.fetchall()
            
            return data
    
    async def start_monitoring(self, duration_seconds: int = 60):
        """开始监控数据变化"""
        print(f"🔍 开始监控数据变化，持续{duration_seconds}秒...")
        
        # 记录初始状态
        self.initial_counts = await self.get_table_counts()
        print("📊 初始数据量:")
        for table, count in self.initial_counts.items():
            print(f"  - {table}: {count}")
        
        self.monitoring = True
        start_time = time.time()
        
        while self.monitoring and (time.time() - start_time) < duration_seconds:
            await asyncio.sleep(2)  # 每2秒检查一次
            
            current_counts = await self.get_table_counts()
            changes = {}
            
            for table, count in current_counts.items():
                initial = self.initial_counts.get(table, 0)
                if count != initial:
                    changes[table] = count - initial
            
            if changes:
                print(f"\n⚡ [{datetime.now().strftime('%H:%M:%S')}] 数据变化:")
                for table, change in changes.items():
                    print(f"  - {table}: +{change}")
                
                # 如果有新数据，显示详情
                if any(change > 0 for change in changes.values()):
                    latest_data = await self.get_latest_session_data()
                    self.print_latest_data(latest_data)
        
        print("\n✅ 监控结束")
        return await self.get_final_analysis()
    
    def print_latest_data(self, data: Dict[str, Any]):
        """打印最新数据详情"""
        if not data:
            return
            
        session = data.get('session', {})
        print(f"📋 最新Session: {session.get('thread_id', 'N/A')[:8]}...")
        print(f"   问题: {session.get('initial_question', 'N/A')[:50]}...")
        print(f"   状态: {session.get('status', 'N/A')}")
        
        # 消息详情
        messages = data.get('messages', [])
        if messages:
            print(f"📨 最新消息 ({len(messages)}条):")
            for msg in messages[:2]:  # 只显示前2条
                print(f"   - [{msg['role']}] {msg['content_type']} | {msg['source_agent']} | {msg['content_length']}字符")
        
        # Artifact详情
        artifacts = data.get('artifacts', [])
        if artifacts:
            print(f"🎯 最新Artifacts ({len(artifacts)}个):")
            for art in artifacts[:2]:  # 只显示前2个
                print(f"   - {art['type']} | {art['title']} | {art['source_agent']} | {art['content_length']}字符")
        
        # 执行状态
        executions = data.get('executions', [])
        if executions:
            latest_exec = executions[0]
            print(f"⚡ 执行状态: {latest_exec['status']} | {latest_exec['action_type']}")
    
    async def get_final_analysis(self) -> Dict[str, Any]:
        """获取最终分析结果"""
        final_counts = await self.get_table_counts()
        latest_data = await self.get_latest_session_data()
        
        analysis = {
            'initial_counts': self.initial_counts,
            'final_counts': final_counts,
            'changes': {},
            'latest_data': latest_data,
            'artifact_analysis': {}
        }
        
        # 计算变化
        for table, final_count in final_counts.items():
            initial = self.initial_counts.get(table, 0)
            analysis['changes'][table] = final_count - initial
        
        # Artifact分析
        artifacts = latest_data.get('artifacts', [])
        if artifacts:
            artifact_types = {}
            for art in artifacts:
                art_type = art['type']
                if art_type not in artifact_types:
                    artifact_types[art_type] = 0
                artifact_types[art_type] += 1
            
            analysis['artifact_analysis'] = {
                'total_artifacts': len(artifacts),
                'types': artifact_types,
                'has_research_plan': any(art['type'] == 'research_plan' for art in artifacts),
                'has_summary': any(art['type'] == 'summary' for art in artifacts)
            }
        
        return analysis
    
    def stop_monitoring(self):
        """停止监控"""
        self.monitoring = False

async def trigger_research_task() -> str:
    """触发一个新的研究任务"""
    print("🚀 触发新的研究任务...")
    
    # 🔥 修复：使用真正的UUID格式
    frontend_uuid = str(uuid.uuid4())
    frontend_context_uuid = str(uuid.uuid4())
    visitor_id = str(uuid.uuid4())  # 🔥 修复：visitor_id也需要UUID格式
    
    research_request = {
        "action": "create",
        "message": "AI技术对现代机器人学科的影响",
        "frontend_uuid": frontend_uuid,
        "frontend_context_uuid": frontend_context_uuid,
        "visitor_id": visitor_id,  # 🔥 使用UUID格式的visitor_id
        "config": {
            "enableBackgroundInvestigation": True,
            "reportStyle": "academic",
            "maxPlanIterations": 1,
            "maxStepNum": 2,
            "maxSearchResults": 3,
            "auto_accepted_plan": True  # 自动接受计划，加快测试
        }
    }
    
    print(f"📋 请求参数:")
    print(f"   - frontend_uuid: {frontend_uuid}")
    print(f"   - frontend_context_uuid: {frontend_context_uuid}")
    print(f"   - visitor_id: {visitor_id}")  # 🔥 显示UUID格式的visitor_id
    print(f"   - message: {research_request['message']}")
    
    try:
        async with aiohttp.ClientSession() as session:
            async with session.post(
                "http://localhost:8000/api/research/stream",
                json=research_request,
                headers={"Content-Type": "application/json"}
            ) as response:
                print(f"📡 API响应状态: {response.status}")
                
                if response.status != 200:
                    error_text = await response.text()
                    raise Exception(f"API请求失败: {response.status} - {error_text}")
                
                print("✅ 研究任务已启动，开始SSE流处理...")
                
                # 读取前几个SSE事件来确认任务启动
                event_count = 0
                url_param = ""
                current_event_type = ""
                
                async for line in response.content:
                    if line:
                        line_str = line.decode().strip()
                        
                        if line_str.startswith("event: "):
                            current_event_type = line_str[7:]  # 去掉 "event: " 前缀
                            print(f"📋 事件类型: {current_event_type}")
                            
                        elif line_str.startswith("data: "):
                            try:
                                event_data = json.loads(line_str[6:])
                                print(f"📡 SSE事件: {current_event_type}")
                                
                                # 🔥 处理错误事件
                                if current_event_type == "error":
                                    error_msg = event_data.get("error_message", "未知错误")
                                    error_code = event_data.get("error_code", "UNKNOWN")
                                    print(f"❌ 错误事件: {error_code} - {error_msg}")
                                    return ""  # 错误时返回空字符串
                                
                                # 如果收到navigation事件，提取url_param
                                if current_event_type == "navigation":
                                    url_param = event_data.get("url_param", "")
                                    print(f"🔗 获取到URL参数: {url_param}")
                                
                                # 显示其他重要事件的详情
                                if current_event_type in ["metadata", "plan_generated", "artifact"]:
                                    if current_event_type == "metadata":
                                        print(f"   - thread_id: {event_data.get('thread_id', 'N/A')}")
                                        print(f"   - execution_id: {event_data.get('execution_id', 'N/A')}")
                                    elif current_event_type == "artifact":
                                        print(f"   - artifact_type: {event_data.get('type', 'N/A')}")
                                        print(f"   - artifact_title: {event_data.get('title', 'N/A')}")
                                
                                event_count += 1
                                if event_count >= 8:  # 收到更多事件后停止，确保能看到artifact
                                    break
                                    
                            except json.JSONDecodeError as e:
                                print(f"⚠️  JSON解析错误: {e}")
                                print(f"   原始内容: {line_str}")
                                continue
                        elif line_str:
                            print(f"📄 其他内容: {line_str[:100]}...")
                
                return url_param
                
    except aiohttp.ClientConnectorError:
        print("❌ 无法连接到服务器，请确保开发服务器正在运行")
        print("💡 运行命令: ./bootstrap.sh --dev")
        return ""
    except Exception as e:
        print(f"❌ 触发研究任务失败: {e}")
        import traceback
        traceback.print_exc()
        return ""

async def main():
    """主函数"""
    load_dotenv()
    
    db_url = os.getenv("DATABASE_URL")
    if not db_url:
        print("❌ DATABASE_URL not found")
        return
    
    print("🧪 LangGraph实时数据保存验证测试")
    print("=" * 50)
    
    # 🔥 修复：先检查服务器是否运行
    try:
        async with aiohttp.ClientSession() as session:
            async with session.get("http://localhost:8000/health") as response:
                if response.status == 404:
                    # health endpoint不存在，尝试其他endpoint
                    pass
    except aiohttp.ClientConnectorError:
        print("❌ 后端服务器未运行，请先启动:")
        print("   ./bootstrap.sh --dev")
        return
    except Exception:
        pass  # 继续执行，可能health endpoint不存在
    
    # 创建监控器
    monitor = RealtimeDataMonitor(db_url)
    
    # 🔥 修复：先触发任务，再启动监控
    print("🚀 步骤1: 触发研究任务...")
    url_param = await trigger_research_task()
    
    if not url_param:
        print("❌ 未能获取URL参数，任务可能启动失败")
        return
    
    print(f"✅ 任务启动成功，URL参数: {url_param}")
    print(f"🌐 工作区链接: http://localhost:3000/workspace/{url_param}")
    
    # 🔥 修复：缩短监控时间，避免过长等待
    print("\n🔍 步骤2: 开始监控数据变化...")
    monitor_task = asyncio.create_task(monitor.start_monitoring(60))  # 监控1分钟
    
    # 等待监控完成
    analysis = await monitor_task
    
    # 打印分析结果
    print("\n" + "=" * 50)
    print("📊 最终分析结果:")
    print("=" * 50)
    
    print("\n📈 数据变化统计:")
    for table, change in analysis['changes'].items():
        status = "✅" if change > 0 else "❌" if change == 0 else "⚠️"
        print(f"  {status} {table}: +{change}")
    
    # Artifact分析
    artifact_analysis = analysis['artifact_analysis']
    if artifact_analysis:
        print(f"\n🎯 Artifact分析:")
        print(f"  - 总数: {artifact_analysis['total_artifacts']}")
        print(f"  - 类型分布: {artifact_analysis['types']}")
        print(f"  - 有研究计划: {'✅' if artifact_analysis['has_research_plan'] else '❌'}")
        print(f"  - 有最终报告: {'✅' if artifact_analysis['has_summary'] else '❌'}")
    else:
        print("\n❌ 未检测到任何Artifact保存")
    
    # 数据一致性检查
    changes = analysis['changes']
    has_checkpoints = changes.get('checkpoints', 0) > 0
    has_messages = changes.get('message_history', 0) > 0
    has_artifacts = changes.get('artifact_storage', 0) > 0
    
    print(f"\n🔍 数据一致性检查:")
    print(f"  - LangGraph checkpoints: {'✅' if has_checkpoints else '❌'}")
    print(f"  - Message保存: {'✅' if has_messages else '❌'}")
    print(f"  - Artifact保存: {'✅' if has_artifacts else '❌'}")
    
    if has_checkpoints and not has_artifacts:
        print("\n⚠️  发现问题：LangGraph正常执行，但Artifact保存失败！")
        print("   建议检查save_artifact()方法的错误日志")
    elif has_checkpoints and has_artifacts:
        print("\n✅ 数据保存正常：LangGraph和自定义表都有数据")
    
    print(f"\n🎯 结论:")
    if has_artifacts:
        print("✅ LangGraph执行时的实时Artifact保存功能正常")
    else:
        print("❌ LangGraph执行时的实时Artifact保存功能异常")
        print("   需要检查_process_langgraph_stream中的save_artifact逻辑")

if __name__ == "__main__":
    asyncio.run(main()) 