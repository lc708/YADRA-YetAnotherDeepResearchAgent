# YADRA 数据库架构文档

## 📋 概述

YADRA 使用 PostgreSQL (Supabase) 作为主数据库，采用 5 表核心架构设计，支持会话管理、执行追踪、消息历史、工件存储和 LangGraph checkpoint 机制。

## 🏗️ 核心架构

### Phase 2 五表架构
```
session_mapping (核心映射表)
    ├── session_config (配置管理)
    ├── execution_record (执行追踪)
    ├── message_history (消息历史)
    └── artifact_storage (工件存储)
```

### LangGraph 支持
```
checkpoints (检查点数据)
checkpoint_writes (检查点写入)
checkpoint_blobs (二进制数据)
```

## 📊 数据库结构

### Schema 分布
- **public**: 应用核心表 (15 张表)
- **auth**: Supabase 认证表 (16 张表)
- **realtime**: 实时消息表 (8 张表)
- **storage**: 文件存储表 (5 张表)

## 🗂️ 核心表详细结构

### 1. session_mapping (会话映射表)
**作用**: 核心映射表，管理 thread_id 到 url_param 的映射关系

```sql
CREATE TABLE session_mapping (
    id SERIAL PRIMARY KEY,
    thread_id TEXT NOT NULL UNIQUE,
    url_param TEXT NOT NULL UNIQUE,
    backend_uuid UUID DEFAULT gen_random_uuid(),
    frontend_uuid UUID NOT NULL,
    visitor_id UUID NOT NULL,
    user_id UUID NULL,
    initial_question TEXT NOT NULL,
    session_title TEXT NULL,
    status VARCHAR(20) DEFAULT 'active',
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    last_activity_at TIMESTAMPTZ DEFAULT now(),
    expires_at TIMESTAMPTZ DEFAULT (now() + INTERVAL '30 days')
);
```

**索引**:
- `idx_session_mapping_thread_id` (UNIQUE)
- `idx_session_mapping_url_param` (UNIQUE)
- `idx_session_mapping_frontend_uuid`
- `idx_session_mapping_user_id`
- `idx_session_mapping_visitor_id`
- `idx_session_mapping_status`
- `idx_session_mapping_last_activity`
- `idx_session_mapping_created_at`

### 2. session_config (会话配置表)
**作用**: 存储每个会话的配置信息

```sql
CREATE TABLE session_config (
    id SERIAL PRIMARY KEY,
    session_id INTEGER NOT NULL REFERENCES session_mapping(id),
    config_version INTEGER DEFAULT 1,
    research_config JSONB DEFAULT '{
        "report_style": "academic",
        "enable_web_search": true,
        "max_research_depth": 3,
        "enable_deep_thinking": false,
        "enable_background_investigation": true
    }',
    model_config JSONB DEFAULT '{
        "provider": "anthropic",
        "model_name": "claude-3-5-sonnet",
        "temperature": 0.7,
        "top_p": 0.9,
        "max_tokens": 4000
    }',
    output_config JSONB DEFAULT '{
        "language": "zhCN",
        "output_format": "markdown",
        "include_artifacts": true,
        "include_citations": true
    }',
    user_preferences JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT now(),
    is_active BOOLEAN DEFAULT true
);
```

**索引**:
- `idx_session_config_session_id`
- `idx_session_config_active` (WHERE is_active = true)

### 3. execution_record (执行记录表)
**作用**: 追踪每次 API 调用的执行情况

```sql
CREATE TABLE execution_record (
    id SERIAL PRIMARY KEY,
    session_id INTEGER NOT NULL REFERENCES session_mapping(id),
    execution_id UUID DEFAULT gen_random_uuid(),
    frontend_context_uuid UUID NOT NULL,
    action_type VARCHAR(20) NOT NULL,
    user_message TEXT NOT NULL,
    request_timestamp TIMESTAMPTZ DEFAULT now(),
    model_used TEXT NULL,
    provider TEXT NULL,
    start_time TIMESTAMPTZ DEFAULT now(),
    end_time TIMESTAMPTZ NULL,
    duration_ms INTEGER NULL,
    input_tokens INTEGER DEFAULT 0,
    output_tokens INTEGER DEFAULT 0,
    total_cost NUMERIC DEFAULT 0.0,
    status VARCHAR(20) DEFAULT 'running',
    error_message TEXT NULL,
    artifacts_generated TEXT[] DEFAULT '{}',
    steps_completed TEXT[] DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT now()
);
```

**索引**:
- `idx_execution_record_session_id`
- `idx_execution_record_frontend_context_uuid`
- `idx_execution_record_action_type`
- `idx_execution_record_status`
- `idx_execution_record_created_at`

### 4. message_history (消息历史表)
**作用**: 存储所有消息记录

```sql
CREATE TABLE message_history (
    id SERIAL PRIMARY KEY,
    session_id INTEGER NOT NULL REFERENCES session_mapping(id),
    execution_id INTEGER NULL REFERENCES execution_record(id),
    message_id UUID DEFAULT gen_random_uuid(),
    role VARCHAR(20) NOT NULL,
    content TEXT NOT NULL,
    content_type VARCHAR(20) DEFAULT 'text',
    frontend_context_uuid UUID NULL,
    chunk_sequence INTEGER NULL,
    source_agent TEXT NULL,
    confidence_score NUMERIC NULL,
    timestamp TIMESTAMPTZ DEFAULT now(),
    created_at TIMESTAMPTZ DEFAULT now()
);
```

**约束**:
```sql
-- 角色约束
CONSTRAINT message_history_role_check 
CHECK (role IN ('user', 'assistant', 'system'))

-- 内容类型约束
CONSTRAINT message_history_content_type_check 
CHECK (content_type IN (
    'text', 'markdown', 'html', 'search_results', 
    'plan', 'artifact', 'error', 'system', 'json'
))
```

**索引**:
- `idx_message_history_session_id`
- `idx_message_history_execution_id`
- `idx_message_history_role`
- `idx_message_history_timestamp`

### 5. artifact_storage (工件存储表)
**作用**: 存储生成的工件 (计划、报告、搜索结果等)

```sql
CREATE TABLE artifact_storage (
    id SERIAL PRIMARY KEY,
    session_id INTEGER NOT NULL REFERENCES session_mapping(id),
    execution_id INTEGER NULL REFERENCES execution_record(id),
    artifact_id UUID DEFAULT gen_random_uuid(),
    type VARCHAR(50) NOT NULL,
    title TEXT NOT NULL,
    description TEXT NULL,
    content TEXT NOT NULL,
    content_format VARCHAR(20) DEFAULT 'markdown',
    file_size INTEGER DEFAULT 0,
    source_agent TEXT NULL,
    generation_context JSONB DEFAULT '{}',
    dependencies TEXT[] DEFAULT '{}',
    version INTEGER DEFAULT 1,
    parent_artifact_id UUID NULL,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);
```

**索引**:
- `idx_artifact_storage_session_id`
- `idx_artifact_storage_execution_id`
- `idx_artifact_storage_artifact_id`
- `idx_artifact_storage_type`
- `idx_artifact_storage_created_at`

## 🔍 LangGraph 支持表

### checkpoints (检查点表)
**作用**: 存储 LangGraph 执行状态

```sql
CREATE TABLE checkpoints (
    thread_id TEXT NOT NULL,
    checkpoint_ns TEXT NOT NULL DEFAULT '',
    checkpoint_id TEXT NOT NULL,
    parent_checkpoint_id TEXT NULL,
    type TEXT NULL,
    checkpoint JSONB NOT NULL,
    metadata JSONB DEFAULT '{}',
    PRIMARY KEY (thread_id, checkpoint_ns, checkpoint_id)
);
```

### checkpoint_writes (检查点写入表)
**作用**: 记录 LangGraph 的写入操作

```sql
CREATE TABLE checkpoint_writes (
    thread_id TEXT NOT NULL,
    checkpoint_ns TEXT NOT NULL DEFAULT '',
    checkpoint_id TEXT NOT NULL,
    task_id TEXT NOT NULL,
    idx INTEGER NOT NULL,
    channel TEXT NOT NULL,
    type TEXT NULL,
    blob BYTEA NOT NULL,
    task_path TEXT DEFAULT '',
    PRIMARY KEY (thread_id, checkpoint_ns, checkpoint_id, task_id, idx)
);
```

### checkpoint_blobs (检查点二进制数据表)
**作用**: 存储大型二进制数据

```sql
CREATE TABLE checkpoint_blobs (
    thread_id TEXT NOT NULL,
    checkpoint_ns TEXT NOT NULL DEFAULT '',
    channel TEXT NOT NULL,
    version TEXT NOT NULL,
    type TEXT NOT NULL,
    blob BYTEA NULL,
    PRIMARY KEY (thread_id, checkpoint_ns, channel, version)
);
```

## 🔗 外键关系

```
session_mapping (1) ←→ (N) session_config
session_mapping (1) ←→ (N) execution_record
session_mapping (1) ←→ (N) message_history
session_mapping (1) ←→ (N) artifact_storage
execution_record (1) ←→ (N) message_history
execution_record (1) ←→ (N) artifact_storage
```

## 📈 视图和统计

### session_overview (会话概览视图)
```sql
CREATE VIEW session_overview AS
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
GROUP BY sm.id, up.display_name;
```

### artifact_stats (工件统计视图)
```sql
CREATE VIEW artifact_stats AS
SELECT 
    sm.user_id,
    sm.frontend_uuid as trace_id,
    COUNT(*) as total_artifacts,
    COUNT(*) FILTER (WHERE ars.type = 'process') as process_count,
    COUNT(*) FILTER (WHERE ars.type = 'result') as result_count,
    MIN(ars.created_at) as first_artifact,
    MAX(ars.created_at) as last_artifact
FROM artifact_storage ars
JOIN session_mapping sm ON ars.session_id = sm.id
GROUP BY sm.user_id, sm.frontend_uuid;
```

## 🛠️ 常用查询

### 1. 获取会话详情
```sql
-- 根据 url_param 获取会话信息
SELECT sm.*, sc.research_config, sc.model_config 
FROM session_mapping sm
LEFT JOIN session_config sc ON sm.id = sc.session_id AND sc.is_active = true
WHERE sm.url_param = $1;
```

### 2. 获取执行记录
```sql
-- 获取会话的所有执行记录
SELECT * FROM execution_record 
WHERE session_id = $1 
ORDER BY created_at DESC;
```

### 3. 获取消息历史
```sql
-- 获取会话的消息历史
SELECT * FROM message_history 
WHERE session_id = $1 
ORDER BY timestamp ASC;
```

### 4. 获取工件列表
```sql
-- 获取会话的所有工件
SELECT * FROM artifact_storage 
WHERE session_id = $1 
ORDER BY created_at DESC;
```

### 5. 获取 LangGraph 检查点
```sql
-- 获取线程的最新检查点
SELECT * FROM checkpoints 
WHERE thread_id = $1 
ORDER BY checkpoint_id DESC 
LIMIT 1;
```

## 🔧 数据库管理脚本

### 查询数据库结构
```python
# scripts/query_database_structure.py
uv run python scripts/query_database_structure.py
```

### 检查约束
```python
# scripts/check_message_history_constraints.py
uv run python scripts/check_message_history_constraints.py
```

### 修复约束
```python
# scripts/fix_message_history_constraints.py
uv run python scripts/fix_message_history_constraints.py
```

## 📊 性能优化

### 索引策略
1. **主键索引**: 所有表都有主键索引
2. **外键索引**: 所有外键字段都有索引
3. **查询索引**: 基于常用查询模式的复合索引
4. **时间索引**: 所有时间字段都有索引用于时间范围查询

### 查询优化
1. **分页查询**: 使用 LIMIT 和 OFFSET
2. **条件索引**: 在 WHERE 子句中使用索引字段
3. **连接优化**: 使用适当的 JOIN 类型
4. **聚合优化**: 在 GROUP BY 中使用索引字段

## 🔐 安全和权限

### Row Level Security (RLS)
```sql
-- 示例: 用户只能访问自己的数据
ALTER TABLE session_mapping ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can only access their own sessions" 
ON session_mapping FOR ALL 
USING (user_id = auth.uid());
```

### 数据访问控制
- **用户隔离**: 通过 user_id 字段实现数据隔离
- **会话隔离**: 通过 session_id 字段实现会话数据隔离
- **时间限制**: 通过 expires_at 字段实现数据过期

## 📝 数据迁移

### 版本控制
- 使用 `config_version` 字段跟踪配置版本
- 使用 `version` 字段跟踪工件版本

### 迁移脚本示例
```python
def migrate_v1_to_v2():
    """迁移配置格式从 v1 到 v2"""
    # 更新配置结构
    # 添加新字段
    # 数据格式转换
```

## 🚨 故障排除

### 常见问题

#### 1. 约束违反错误
```sql
-- 检查约束定义
SELECT conname, pg_get_constraintdef(oid) 
FROM pg_constraint 
WHERE conrelid = 'table_name'::regclass;
```

#### 2. 外键约束错误
```sql
-- 检查外键关系
SELECT 
    tc.constraint_name,
    tc.table_name,
    kcu.column_name,
    ccu.table_name AS foreign_table_name,
    ccu.column_name AS foreign_column_name
FROM information_schema.table_constraints AS tc
JOIN information_schema.key_column_usage AS kcu
    ON tc.constraint_name = kcu.constraint_name
JOIN information_schema.constraint_column_usage AS ccu
    ON ccu.constraint_name = tc.constraint_name
WHERE tc.constraint_type = 'FOREIGN KEY';
```

#### 3. 性能问题
```sql
-- 检查慢查询
SELECT query, mean_exec_time, calls 
FROM pg_stat_statements 
ORDER BY mean_exec_time DESC;

-- 检查索引使用情况
SELECT schemaname, tablename, indexname, idx_scan 
FROM pg_stat_user_indexes 
ORDER BY idx_scan DESC;
```

## 📚 相关文档

- [用户配置系统文档](./user-configuration-system.md)
- [API接口文档](./api-documentation.md)
- [前端架构设计](./frontend-architecture.md)
- [后端服务架构](./backend-architecture.md)

---

## 🔄 更新日志

### 2025年6月18日
- ✅ 创建完整的5表架构文档
- ✅ 添加 LangGraph 支持表结构
- ✅ 完善约束和索引信息
- ✅ 添加常用查询示例
- ✅ 添加性能优化建议

---

*最后更新：2025年6月18日* 