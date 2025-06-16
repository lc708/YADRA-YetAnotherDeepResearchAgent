#!/usr/bin/env python3
"""
Fix conversation_meta Schema
添加缺失的字段到conversation_meta表
"""

import os
import psycopg
from dotenv import load_dotenv

def fix_conversation_meta_schema():
    load_dotenv()
    database_url = os.getenv('DATABASE_URL')
    
    if not database_url:
        print("❌ DATABASE_URL not found")
        return False
    
    try:
        conn = psycopg.connect(database_url)
        cursor = conn.cursor()
        
        print("🔧 Fixing conversation_meta schema...")
        
        # 添加缺失的字段
        cursor.execute("""
            ALTER TABLE conversation_meta 
            ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();
        """)
        
        cursor.execute("""
            ALTER TABLE conversation_meta 
            ADD COLUMN IF NOT EXISTS total_reasoning_time_ms INTEGER DEFAULT 0;
        """)
        
        # 添加索引优化查询性能
        cursor.execute("""
            CREATE INDEX IF NOT EXISTS idx_conversation_meta_updated_at 
            ON conversation_meta(updated_at);
        """)
        
        conn.commit()
        print("✅ Schema updated successfully!")
        
        # 验证字段添加
        cursor.execute("""
            SELECT column_name, data_type, column_default
            FROM information_schema.columns 
            WHERE table_name = 'conversation_meta' 
            ORDER BY ordinal_position;
        """)
        
        columns = cursor.fetchall()
        print("📋 Updated conversation_meta schema:")
        for col in columns:
            print(f"   - {col[0]}: {col[1]} (default: {col[2]})")
        
        cursor.close()
        conn.close()
        return True
        
    except Exception as e:
        print(f"❌ Error: {e}")
        return False

if __name__ == "__main__":
    success = fix_conversation_meta_schema()
    exit(0 if success else 1)
