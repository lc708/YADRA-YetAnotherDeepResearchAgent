#!/usr/bin/env python3

import asyncio
import os
import json
from langgraph.checkpoint.postgres.aio import AsyncPostgresSaver

async def check_checkpoint_schema():
    """查询checkpoint相关表结构和数据"""
    db_uri = os.getenv('DATABASE_URL')
    if not db_uri:
        print("❌ DATABASE_URL not found")
        return
        
    print("🔍 检查checkpoint表结构...")
    
    async with AsyncPostgresSaver.from_conn_string(db_uri) as checkpointer:
        conn = checkpointer.conn
        
        # 1. 查询所有checkpoint相关表
        tables = await conn.fetch("""
            SELECT table_name 
            FROM information_schema.tables 
            WHERE table_name LIKE '%checkpoint%' 
            ORDER BY table_name
        """)
        
        print(f"\n📊 找到 {len(tables)} 个checkpoint相关表:")
        for table in tables:
            print(f"  - {table['table_name']}")
        
        # 2. 查询每个表的结构
        for table in tables:
            table_name = table['table_name']
            print(f"\n=== {table_name} 表结构 ===")
            
            columns = await conn.fetch(f"""
                SELECT column_name, data_type, is_nullable, column_default
                FROM information_schema.columns 
                WHERE table_name = '{table_name}'
                ORDER BY ordinal_position
            """)
            
            for col in columns:
                nullable = "NULL" if col['is_nullable'] == 'YES' else "NOT NULL"
                default = f" DEFAULT {col['column_default']}" if col['column_default'] else ""
                print(f"  {col['column_name']}: {col['data_type']} {nullable}{default}")
        
        # 3. 查询最近的checkpoint数据示例
        print(f"\n=== 最近的checkpoint数据示例 ===")
        
        recent_checkpoints = await conn.fetch("""
            SELECT thread_id, checkpoint_id, type, checkpoint
            FROM checkpoints 
            ORDER BY checkpoint_id DESC 
            LIMIT 3
        """)
        
        for i, cp in enumerate(recent_checkpoints, 1):
            print(f"\n--- Checkpoint {i} ---")
            print(f"Thread ID: {cp['thread_id']}")
            print(f"Checkpoint ID: {cp['checkpoint_id']}")
            print(f"Type: {cp['type']}")
            
            # 解析checkpoint数据
            try:
                checkpoint_data = json.loads(cp['checkpoint']) if isinstance(cp['checkpoint'], str) else cp['checkpoint']
                
                # 提取关键信息
                if 'channel_values' in checkpoint_data:
                    channel_values = checkpoint_data['channel_values']
                    print(f"Channel Values Keys: {list(channel_values.keys())}")
                    
                    # 如果有messages，显示最后几条
                    if 'messages' in channel_values:
                        messages = channel_values['messages']
                        print(f"Messages Count: {len(messages)}")
                        if messages:
                            last_msg = messages[-1]
                            print(f"Last Message: {last_msg.get('type', 'unknown')} - {str(last_msg.get('content', ''))[:100]}...")
                    
                    # 显示其他重要字段
                    important_fields = ['research_topic', 'current_plan', 'final_report', 'plan_iterations']
                    for field in important_fields:
                        if field in channel_values:
                            value = channel_values[field]
                            if isinstance(value, str) and len(value) > 100:
                                print(f"{field}: {value[:100]}...")
                            else:
                                print(f"{field}: {value}")
                
            except Exception as e:
                print(f"解析checkpoint数据失败: {e}")
                print(f"原始数据类型: {type(cp['checkpoint'])}")

if __name__ == "__main__":
    asyncio.run(check_checkpoint_schema()) 