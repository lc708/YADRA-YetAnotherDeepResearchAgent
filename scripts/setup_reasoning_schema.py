#!/usr/bin/env python3
"""
Reasoning Content Storage Schema Setup
"""

import os
import psycopg
from dotenv import load_dotenv

def setup_reasoning_schema():
    load_dotenv()
    database_url = os.getenv('DATABASE_URL')
    
    if not database_url:
        print("❌ DATABASE_URL not found")
        return False
    
    try:
        conn = psycopg.connect(database_url)
        cursor = conn.cursor()
        
        print("🔧 Creating reasoning schema...")
        
        # 推理会话表
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS reasoning_sessions (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                thread_id VARCHAR NOT NULL,
                checkpoint_id VARCHAR,
                reasoning_content TEXT,
                thinking_steps JSONB DEFAULT '[]',
                model_used VARCHAR DEFAULT 'deepseek-reasoner',
                start_time TIMESTAMPTZ DEFAULT NOW(),
                duration_ms INTEGER,
                created_at TIMESTAMPTZ DEFAULT NOW()
            );
        """)
        
        # 对话元数据表
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS conversation_meta (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                thread_id VARCHAR NOT NULL UNIQUE,
                title VARCHAR,
                used_reasoning BOOLEAN DEFAULT false,
                reasoning_sessions_count INTEGER DEFAULT 0,
                created_at TIMESTAMPTZ DEFAULT NOW()
            );
        """)
        
        # Artifact存储表
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS conversation_artifacts (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                thread_id VARCHAR NOT NULL,
                artifact_type VARCHAR NOT NULL,
                content JSONB NOT NULL,
                reasoning_trace JSONB,
                created_at TIMESTAMPTZ DEFAULT NOW()
            );
        """)
        
        # 索引
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_reasoning_sessions_thread_id ON reasoning_sessions(thread_id);")
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_artifacts_thread_id ON conversation_artifacts(thread_id);")
        
        conn.commit()
        print("✅ Schema created successfully!")
        
        # 验证表创建
        cursor.execute("""
            SELECT table_name FROM information_schema.tables 
            WHERE table_schema = 'public' 
            AND table_name IN ('reasoning_sessions', 'conversation_meta', 'conversation_artifacts')
            ORDER BY table_name;
        """)
        
        tables = cursor.fetchall()
        print(f"📊 Created tables: {[t[0] for t in tables]}")
        
        cursor.close()
        conn.close()
        return True
        
    except Exception as e:
        print(f"❌ Error: {e}")
        return False

if __name__ == "__main__":
    success = setup_reasoning_schema()
    exit(0 if success else 1)