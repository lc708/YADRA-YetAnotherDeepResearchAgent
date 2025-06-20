#!/usr/bin/env python3
import asyncio
import os
import sys
from dotenv import load_dotenv

# 添加项目根目录到路径
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from src.server.repositories.session_repository import get_session_repository


async def check_checkpoints():
    load_dotenv()
    db_url = os.getenv("DATABASE_URL")

    if not db_url:
        print("❌ 数据库URL未配置")
        return

    repo = get_session_repository(db_url)

    # 查询checkpoint表
    queries = [
        "SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' AND table_name LIKE '%checkpoint%'",
        "SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' AND table_name LIKE '%langgraph%'",
        "SELECT table_name FROM information_schema.tables WHERE table_schema = 'public'",
    ]

    try:
        async with await repo.get_connection() as conn:
            cursor = conn.cursor()

            print("🔍 查找checkpoint相关表...")
            await cursor.execute(queries[0])
            checkpoint_tables = await cursor.fetchall()
            print(f'Checkpoint表: {[row["table_name"] for row in checkpoint_tables]}')

            print("\n🔍 查找langgraph相关表...")
            await cursor.execute(queries[1])
            langgraph_tables = await cursor.fetchall()
            print(f'LangGraph表: {[row["table_name"] for row in langgraph_tables]}')

            print("\n📋 所有表:")
            await cursor.execute(queries[2])
            all_tables = await cursor.fetchall()
            table_names = [row["table_name"] for row in all_tables]
            for table in sorted(table_names):
                print(f"  - {table}")

            # 如果有checkpoint表，查看内容
            if checkpoint_tables:
                print("\n📊 Checkpoint表内容:")
                for table_row in checkpoint_tables:
                    table_name = table_row["table_name"]
                    await cursor.execute(f"SELECT COUNT(*) as count FROM {table_name}")
                    count_result = await cursor.fetchone()
                    print(f'  {table_name}: {count_result["count"]} 条记录')

                    if count_result["count"] > 0:
                        await cursor.execute(f"SELECT * FROM {table_name} LIMIT 3")
                        sample_records = await cursor.fetchall()
                        print(f"    样本记录: {len(sample_records)} 条")
                        for i, record in enumerate(sample_records):
                            print(f"    记录 {i+1}: {dict(record)}")

    except Exception as e:
        print(f"❌ 查询失败: {e}")
        import traceback

        traceback.print_exc()


if __name__ == "__main__":
    asyncio.run(check_checkpoints())
