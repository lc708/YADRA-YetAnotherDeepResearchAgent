#!/usr/bin/env python3
import asyncio
import psycopg
import os
from dotenv import load_dotenv


async def get_latest_session():
    load_dotenv()
    conn = psycopg.connect(os.getenv("DATABASE_URL"))
    cursor = conn.cursor()
    await cursor.execute(
        """
        SELECT sm.thread_id, sm.url_param, er.status, er.error_message
        FROM session_mapping sm
        LEFT JOIN execution_record er ON sm.id = er.session_id
        ORDER BY sm.created_at DESC
        LIMIT 3
    """
    )
    results = await cursor.fetchall()
    for row in results:
        print(f"Thread: {row[0]} | URL: {row[1]} | Status: {row[2]}")
        if row[3]:
            print(f"Error: {row[3][:200]}...")
        print()
    cursor.close()
    conn.close()


if __name__ == "__main__":
    asyncio.run(get_latest_session())
