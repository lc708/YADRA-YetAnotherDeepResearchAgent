#!/usr/bin/env python3
"""
查询Supabase数据库的完整结构
包括所有表、索引、约束等
"""

import os
import psycopg
from dotenv import load_dotenv


def query_database_structure():
    load_dotenv()
    database_url = os.getenv("DATABASE_URL")

    if not database_url:
        print("❌ DATABASE_URL not found")
        return False

    try:
        conn = psycopg.connect(database_url)
        cursor = conn.cursor()

        print("🔍 查询数据库完整结构...\n")

        # 1. 查询所有表
        print("📊 所有表结构:")
        cursor.execute("""
            SELECT 
                schemaname as schema_name,
                tablename as table_name,
                tableowner as owner
            FROM pg_tables 
            WHERE schemaname IN ('public', 'auth', 'storage', 'realtime')
            ORDER BY schemaname, tablename;
        """)
        
        tables = cursor.fetchall()
        current_schema = None
        for schema, table, owner in tables:
            if schema != current_schema:
                print(f"\n📁 Schema: {schema}")
                current_schema = schema
            print(f"   └── {table} (owner: {owner})")

        # 2. 查询checkpoint相关表
        print("\n\n🔄 Checkpoint相关表:")
        cursor.execute("""
            SELECT table_name 
            FROM information_schema.tables 
            WHERE table_schema = 'public' 
            AND table_name LIKE '%checkpoint%'
            ORDER BY table_name;
        """)
        
        checkpoint_tables = cursor.fetchall()
        if checkpoint_tables:
            for table in checkpoint_tables:
                print(f"   └── {table[0]}")
        else:
            print("   └── 未找到checkpoint相关表")

        # 3. 查询public schema中的详细表结构
        print("\n\n📋 Public Schema 表详细结构:")
        cursor.execute("""
            SELECT table_name 
            FROM information_schema.tables 
            WHERE table_schema = 'public' 
            ORDER BY table_name;
        """)
        
        public_tables = cursor.fetchall()
        for table in public_tables:
            table_name = table[0]
            print(f"\n🗂️  {table_name}:")
            
            # 查询列信息
            cursor.execute("""
                SELECT 
                    column_name,
                    data_type,
                    is_nullable,
                    column_default,
                    character_maximum_length
                FROM information_schema.columns 
                WHERE table_schema = 'public' 
                AND table_name = %s
                ORDER BY ordinal_position;
            """, (table_name,))
            
            columns = cursor.fetchall()
            for col_name, data_type, nullable, default, max_length in columns:
                nullable_str = "NULL" if nullable == "YES" else "NOT NULL"
                default_str = f" DEFAULT {default}" if default else ""
                length_str = f"({max_length})" if max_length else ""
                print(f"   - {col_name}: {data_type}{length_str} {nullable_str}{default_str}")

        # 4. 查询索引
        print("\n\n📇 索引信息:")
        cursor.execute("""
            SELECT 
                schemaname,
                tablename,
                indexname,
                indexdef
            FROM pg_indexes 
            WHERE schemaname = 'public'
            ORDER BY tablename, indexname;
        """)
        
        indexes = cursor.fetchall()
        current_table = None
        for schema, table, index_name, index_def in indexes:
            if table != current_table:
                print(f"\n🗂️  {table}:")
                current_table = table
            print(f"   └── {index_name}")
            print(f"       {index_def}")

        # 5. 查询外键约束
        print("\n\n🔗 外键约束:")
        cursor.execute("""
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
        """)
        
        foreign_keys = cursor.fetchall()
        for table, column, foreign_table, foreign_column, constraint_name in foreign_keys:
            print(f"   {table}.{column} -> {foreign_table}.{foreign_column} ({constraint_name})")

        cursor.close()
        conn.close()
        print("\n✅ 查询完成")
        return True

    except Exception as e:
        print(f"❌ 查询失败: {e}")
        return False


if __name__ == "__main__":
    success = query_database_structure()
    exit(0 if success else 1) 