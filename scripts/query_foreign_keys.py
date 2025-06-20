#!/usr/bin/env python3
"""
查询数据库外键约束
"""

import os
import psycopg
from dotenv import load_dotenv


def query_foreign_keys():
    load_dotenv()
    database_url = os.getenv("DATABASE_URL")

    conn = psycopg.connect(database_url)
    cursor = conn.cursor()

    print("🔗 外键约束详情:")
    cursor.execute(
        """
        SELECT
            tc.table_name,
            kcu.column_name,
            ccu.table_name AS foreign_table_name,
            ccu.column_name AS foreign_column_name,
            tc.constraint_name
        FROM information_schema.table_constraints AS tc
        JOIN information_schema.key_column_usage AS kcu
            ON tc.constraint_name = kcu.constraint_name
            AND tc.table_schema = kcu.table_schema
        JOIN information_schema.constraint_column_usage AS ccu
            ON ccu.constraint_name = tc.constraint_name
            AND ccu.table_schema = tc.table_schema
        WHERE tc.constraint_type = 'FOREIGN KEY'
        AND tc.table_schema = 'public'
        ORDER BY tc.table_name, kcu.column_name;
    """
    )

    foreign_keys = cursor.fetchall()
    if foreign_keys:
        for (
            table,
            column,
            foreign_table,
            foreign_column,
            constraint_name,
        ) in foreign_keys:
            print(
                f"   {table}.{column} -> {foreign_table}.{foreign_column} ({constraint_name})"
            )
    else:
        print("   未找到外键约束")

    cursor.close()
    conn.close()


if __name__ == "__main__":
    query_foreign_keys()
