#!/usr/bin/env python3
"""
Session Mapping Schema Setup for YADRA
Phase 2: 数据库结构升级 - 会话映射系统
"""

import os
import psycopg
from dotenv import load_dotenv


def setup_session_mapping_schema():
    load_dotenv()
    database_url = os.getenv("DATABASE_URL")

    if not database_url:
        print("❌ DATABASE_URL not found")
        return False

    try:
        conn = psycopg.connect(database_url)
        cursor = conn.cursor()

        print("🔧 创建会话映射系统...")

        # 1. 会话映射表 - 核心映射表
        print("📊 创建 session_mapping 表...")
        cursor.execute(
            """
            CREATE TABLE IF NOT EXISTS session_mapping (
                id SERIAL PRIMARY KEY,
                thread_id TEXT NOT NULL UNIQUE,
                url_param TEXT NOT NULL UNIQUE,
                backend_uuid UUID NOT NULL DEFAULT gen_random_uuid(),
                frontend_uuid UUID NOT NULL,
                visitor_id UUID NOT NULL,
                user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
                
                -- 会话基础信息
                initial_question TEXT NOT NULL,
                session_title TEXT,
                
                -- 状态和时间
                status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'completed', 'error', 'paused')),
                created_at TIMESTAMPTZ DEFAULT NOW(),
                updated_at TIMESTAMPTZ DEFAULT NOW(),
                last_activity_at TIMESTAMPTZ DEFAULT NOW(),
                expires_at TIMESTAMPTZ DEFAULT (NOW() + INTERVAL '30 days')
            );
        """
        )

        # 2. 会话配置表 - 配置版本管理
        print("⚙️ 创建 session_config 表...")
        cursor.execute(
            """
            CREATE TABLE IF NOT EXISTS session_config (
                id SERIAL PRIMARY KEY,
                session_id INTEGER NOT NULL REFERENCES session_mapping(id) ON DELETE CASCADE,
                config_version INTEGER DEFAULT 1,
                
                -- 完整配置JSON存储
                research_config JSONB NOT NULL DEFAULT '{
                    "enable_background_investigation": true,
                    "report_style": "academic",
                    "enable_deep_thinking": false,
                    "max_research_depth": 3,
                    "enable_web_search": true
                }',
                
                model_config JSONB NOT NULL DEFAULT '{
                    "model_name": "claude-3-5-sonnet",
                    "temperature": 0.7,
                    "max_tokens": 4000,
                    "top_p": 0.9,
                    "provider": "anthropic"
                }',
                
                output_config JSONB NOT NULL DEFAULT '{
                    "language": "zhCN",
                    "output_format": "markdown",
                    "include_citations": true,
                    "include_artifacts": true
                }',
                
                user_preferences JSONB DEFAULT '{}',
                
                created_at TIMESTAMPTZ DEFAULT NOW(),
                is_active BOOLEAN DEFAULT TRUE
            );
        """
        )

        # 3. 执行记录表 - 追踪所有执行
        print("📈 创建 execution_record 表...")
        cursor.execute(
            """
            CREATE TABLE IF NOT EXISTS execution_record (
                id SERIAL PRIMARY KEY,
                session_id INTEGER NOT NULL REFERENCES session_mapping(id) ON DELETE CASCADE,
                execution_id UUID NOT NULL DEFAULT gen_random_uuid(),
                frontend_context_uuid UUID NOT NULL,
                
                -- 请求信息
                action_type VARCHAR(20) NOT NULL CHECK (action_type IN ('create', 'continue', 'feedback', 'modify')),
                user_message TEXT NOT NULL,
                request_timestamp TIMESTAMPTZ DEFAULT NOW(),
                
                -- 执行信息
                model_used TEXT,
                provider TEXT,
                start_time TIMESTAMPTZ DEFAULT NOW(),
                end_time TIMESTAMPTZ,
                duration_ms INTEGER,
                
                -- 资源消耗
                input_tokens INTEGER DEFAULT 0,
                output_tokens INTEGER DEFAULT 0,
                total_cost DECIMAL(10, 6) DEFAULT 0.0,
                
                -- 执行状态
                status VARCHAR(20) DEFAULT 'running' CHECK (status IN ('running', 'completed', 'error', 'cancelled')),
                error_message TEXT,
                
                -- 结果统计
                artifacts_generated TEXT[] DEFAULT '{}',
                steps_completed TEXT[] DEFAULT '{}',
                
                created_at TIMESTAMPTZ DEFAULT NOW()
            );
        """
        )

        # 4. 消息历史表 - 完整对话流
        print("💬 创建 message_history 表...")
        cursor.execute(
            """
            CREATE TABLE IF NOT EXISTS message_history (
                id SERIAL PRIMARY KEY,
                session_id INTEGER NOT NULL REFERENCES session_mapping(id) ON DELETE CASCADE,
                execution_id INTEGER REFERENCES execution_record(id) ON DELETE SET NULL,
                
                -- 消息基础信息
                message_id UUID NOT NULL DEFAULT gen_random_uuid(),
                role VARCHAR(20) NOT NULL CHECK (role IN ('user', 'assistant', 'system')),
                content TEXT NOT NULL,
                content_type VARCHAR(20) DEFAULT 'text' CHECK (content_type IN ('text', 'markdown', 'html')),
                
                -- 元数据
                frontend_context_uuid UUID,
                chunk_sequence INTEGER,
                source_agent TEXT,
                confidence_score DECIMAL(3, 2),
                
                -- 时间信息
                timestamp TIMESTAMPTZ DEFAULT NOW(),
                created_at TIMESTAMPTZ DEFAULT NOW()
            );
        """
        )

        # 5. Artifact存储表 - 增强版artifacts
        print("🎨 创建 artifact_storage 表...")
        cursor.execute(
            """
            CREATE TABLE IF NOT EXISTS artifact_storage (
                id SERIAL PRIMARY KEY,
                session_id INTEGER NOT NULL REFERENCES session_mapping(id) ON DELETE CASCADE,
                execution_id INTEGER REFERENCES execution_record(id) ON DELETE SET NULL,
                
                -- Artifact基础信息
                artifact_id UUID NOT NULL DEFAULT gen_random_uuid(),
                type VARCHAR(50) NOT NULL CHECK (type IN ('research_plan', 'data_table', 'chart', 'summary', 'code', 'document')),
                title TEXT NOT NULL,
                description TEXT,
                
                -- 内容存储
                content TEXT NOT NULL,
                content_format VARCHAR(20) DEFAULT 'markdown' CHECK (content_format IN ('markdown', 'html', 'json', 'csv', 'code')),
                file_size INTEGER DEFAULT 0,
                
                -- 元数据
                source_agent TEXT,
                generation_context JSONB DEFAULT '{}',
                dependencies TEXT[] DEFAULT '{}',
                
                -- 版本管理
                version INTEGER DEFAULT 1,
                parent_artifact_id UUID,
                
                -- 时间信息
                created_at TIMESTAMPTZ DEFAULT NOW(),
                updated_at TIMESTAMPTZ DEFAULT NOW()
            );
        """
        )

        # 创建索引
        print("📇 创建索引...")

        # session_mapping 索引
        cursor.execute(
            """
            CREATE UNIQUE INDEX IF NOT EXISTS idx_session_mapping_url_param ON session_mapping(url_param);
            CREATE UNIQUE INDEX IF NOT EXISTS idx_session_mapping_thread_id ON session_mapping(thread_id);
            CREATE INDEX IF NOT EXISTS idx_session_mapping_frontend_uuid ON session_mapping(frontend_uuid);
            CREATE INDEX IF NOT EXISTS idx_session_mapping_visitor_id ON session_mapping(visitor_id);
            CREATE INDEX IF NOT EXISTS idx_session_mapping_user_id ON session_mapping(user_id);
            CREATE INDEX IF NOT EXISTS idx_session_mapping_status ON session_mapping(status);
            CREATE INDEX IF NOT EXISTS idx_session_mapping_created_at ON session_mapping(created_at);
            CREATE INDEX IF NOT EXISTS idx_session_mapping_last_activity ON session_mapping(last_activity_at);
        """
        )

        # session_config 索引
        cursor.execute(
            """
            CREATE INDEX IF NOT EXISTS idx_session_config_session_id ON session_config(session_id);
            CREATE INDEX IF NOT EXISTS idx_session_config_active ON session_config(session_id, is_active) WHERE is_active = TRUE;
        """
        )

        # execution_record 索引
        cursor.execute(
            """
            CREATE INDEX IF NOT EXISTS idx_execution_record_session_id ON execution_record(session_id);
            CREATE INDEX IF NOT EXISTS idx_execution_record_frontend_context_uuid ON execution_record(frontend_context_uuid);
            CREATE INDEX IF NOT EXISTS idx_execution_record_status ON execution_record(status);
            CREATE INDEX IF NOT EXISTS idx_execution_record_created_at ON execution_record(created_at);
            CREATE INDEX IF NOT EXISTS idx_execution_record_action_type ON execution_record(action_type);
        """
        )

        # message_history 索引
        cursor.execute(
            """
            CREATE INDEX IF NOT EXISTS idx_message_history_session_id ON message_history(session_id);
            CREATE INDEX IF NOT EXISTS idx_message_history_execution_id ON message_history(execution_id);
            CREATE INDEX IF NOT EXISTS idx_message_history_timestamp ON message_history(timestamp);
            CREATE INDEX IF NOT EXISTS idx_message_history_role ON message_history(role);
        """
        )

        # artifact_storage 索引
        cursor.execute(
            """
            CREATE INDEX IF NOT EXISTS idx_artifact_storage_session_id ON artifact_storage(session_id);
            CREATE INDEX IF NOT EXISTS idx_artifact_storage_execution_id ON artifact_storage(execution_id);
            CREATE INDEX IF NOT EXISTS idx_artifact_storage_type ON artifact_storage(type);
            CREATE INDEX IF NOT EXISTS idx_artifact_storage_created_at ON artifact_storage(created_at);
            CREATE INDEX IF NOT EXISTS idx_artifact_storage_artifact_id ON artifact_storage(artifact_id);
        """
        )

        # 创建触发器 - 自动更新时间戳
        print("⚡ 创建触发器...")
        cursor.execute(
            """
            CREATE OR REPLACE FUNCTION update_updated_at_column()
            RETURNS TRIGGER AS $$
            BEGIN
                NEW.updated_at = NOW();
                RETURN NEW;
            END;
            $$ LANGUAGE plpgsql;
        """
        )

        cursor.execute(
            """
            CREATE TRIGGER update_session_mapping_updated_at
                BEFORE UPDATE ON session_mapping
                FOR EACH ROW
                EXECUTE FUNCTION update_updated_at_column();
        """
        )

        cursor.execute(
            """
            CREATE TRIGGER update_artifact_storage_updated_at
                BEFORE UPDATE ON artifact_storage
                FOR EACH ROW
                EXECUTE FUNCTION update_updated_at_column();
        """
        )

        # 创建视图 - 便于查询
        print("👁️ 创建视图...")
        cursor.execute(
            """
            CREATE OR REPLACE VIEW session_overview AS
            SELECT 
                sm.id,
                sm.thread_id,
                sm.url_param,
                sm.frontend_uuid,
                sm.session_title,
                sm.status,
                sm.created_at,
                sm.last_activity_at,
                up.display_name as user_display_name,
                COUNT(DISTINCT er.id) as total_executions,
                COUNT(DISTINCT mh.id) as total_messages,
                COUNT(DISTINCT ars.id) as total_artifacts,
                MAX(er.created_at) as last_execution_at
            FROM session_mapping sm
            LEFT JOIN user_profiles up ON sm.user_id = up.user_id
            LEFT JOIN execution_record er ON sm.id = er.session_id
            LEFT JOIN message_history mh ON sm.id = mh.session_id
            LEFT JOIN artifact_storage ars ON sm.id = ars.session_id
            GROUP BY sm.id, sm.thread_id, sm.url_param, sm.frontend_uuid, sm.session_title, sm.status, sm.created_at, sm.last_activity_at, up.display_name;
        """
        )

        conn.commit()
        print("✅ 会话映射系统创建成功!")

        # 验证表创建
        cursor.execute(
            """
            SELECT table_name FROM information_schema.tables 
            WHERE table_schema = 'public' 
            AND table_name IN ('session_mapping', 'session_config', 'execution_record', 'message_history', 'artifact_storage')
            ORDER BY table_name;
        """
        )

        tables = cursor.fetchall()
        print(f"📊 创建的表: {[t[0] for t in tables]}")

        # 显示表统计
        print("\n📈 表结构统计:")
        for table_name in [
            "session_mapping",
            "session_config",
            "execution_record",
            "message_history",
            "artifact_storage",
        ]:
            cursor.execute(
                f"SELECT COUNT(*) FROM information_schema.columns WHERE table_name = '{table_name}' AND table_schema = 'public';"
            )
            column_count = cursor.fetchone()[0]
            print(f"   {table_name}: {column_count} 列")

        cursor.close()
        conn.close()
        return True

    except Exception as e:
        print(f"❌ 错误: {e}")
        return False


if __name__ == "__main__":
    success = setup_session_mapping_schema()
    exit(0 if success else 1)
