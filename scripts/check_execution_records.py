#!/usr/bin/env python3
"""检查最近的session和对应的execution_record数据"""

import asyncio
import os
from dotenv import load_dotenv
from src.server.repositories.session_repository import get_session_repository


async def check_recent_data():
    load_dotenv()
    db_url = os.getenv("DATABASE_URL")
    if not db_url:
        print("❌ DATABASE_URL not found")
        return

    repo = get_session_repository(db_url)

    print("🔍 检查最近的session和execution_record数据...\n")

    try:
        # 获取最近的session
        async with await repo.get_connection() as conn:
            cursor = conn.cursor()
            await cursor.execute(
                """
                SELECT url_param, thread_id, created_at, status, id
                FROM session_mapping 
                ORDER BY created_at DESC 
                LIMIT 5
            """
            )
            sessions = await cursor.fetchall()

            print("📊 最近的5个session:")
            for s in sessions:
                print(f'  - ID: {s["id"]}, URL: {s["url_param"][:30]}...')
                print(f'    Thread: {s["thread_id"][:30]}...')
                print(f'    Status: {s["status"]}, Created: {s["created_at"]}')

                # 检查对应的execution_record
                await cursor.execute(
                    """
                    SELECT COUNT(*), MAX(created_at), status
                    FROM execution_record 
                    WHERE session_id = %s
                """,
                    (s["id"],),
                )
                exec_data = await cursor.fetchone()
                print(
                    f"    → Executions: {exec_data[0]}, Last: {exec_data[1]}, Status: {exec_data[2]}"
                )

                # 如果有执行记录，显示详情
                if exec_data[0] > 0:
                    await cursor.execute(
                        """
                        SELECT execution_id, action_type, status, created_at
                        FROM execution_record 
                        WHERE session_id = %s
                        ORDER BY created_at DESC
                        LIMIT 3
                    """,
                        (s["id"],),
                    )
                    exec_details = await cursor.fetchall()
                    for exec in exec_details:
                        print(
                            f'      • Exec: {exec["execution_id"][:20]}..., Action: {exec["action_type"]}, Status: {exec["status"]}, Created: {exec["created_at"]}'
                        )

                print()

    except Exception as e:
        print(f"❌ 错误: {e}")


if __name__ == "__main__":
    asyncio.run(check_recent_data())
