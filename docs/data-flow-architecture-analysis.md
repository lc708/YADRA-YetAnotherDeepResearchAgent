# YADRA 数据流架构分析

**分析时间**: 2025年1月
**问题严重性**: 🔥 严重 - 数据流架构不一致导致前端显示空白

## 🎯 核心问题总结

### 用户发现的现象
- ✅ `artifact_storage`表：8条记录
- ❌ `artifacts`表：空的  
- ❌ 前端workspace页面显示空白

### 根本原因
**数据表架构不统一**：后端使用自定义表，前端期望Supabase标准表

## 📊 数据表架构对比

### 1. artifact_storage表（后端实际使用）
```sql
CREATE TABLE artifact_storage (
    id SERIAL PRIMARY KEY,
    session_id INTEGER NOT NULL REFERENCES session_mapping(id),
    execution_id INTEGER REFERENCES execution_record(id),
    artifact_id UUID NOT NULL DEFAULT gen_random_uuid(),
    type VARCHAR(50) NOT NULL CHECK (type IN ('research_plan', 'data_table', 'chart', 'summary', 'code', 'document')),
    title TEXT NOT NULL,
    description TEXT,
    content TEXT NOT NULL,
    content_format VARCHAR(20) DEFAULT 'markdown',
    file_size INTEGER DEFAULT 0,
    source_agent TEXT,
    generation_context JSONB DEFAULT '{}',
    dependencies TEXT[] DEFAULT '{}',
    version INTEGER DEFAULT 1,
    parent_artifact_id UUID,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

### 2. artifacts表（Supabase标准，前端期望）
```sql
CREATE TABLE public.artifacts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    trace_id UUID NOT NULL,
    node_name TEXT NOT NULL,
    type artifact_type NOT NULL, -- 'process' or 'result'
    mime TEXT NOT NULL,
    summary TEXT,
    payload_url TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    user_id UUID NOT NULL REFERENCES auth.users(id)
);
```

## 🔄 数据流分析

### SSE实时数据流（正常）
| 数据类型 | 来源 | 传输方式 | 目标 | 状态 |
|---------|------|----------|------|------|
| navigation | 后端生成 | SSE事件 | 前端实时显示 | ✅ 正常 |
| metadata | 后端生成 | SSE事件 | 前端实时显示 | ✅ 正常 |
| message_chunk | LangGraph输出 | SSE事件 | 前端实时显示 | ✅ 正常 |
| artifact | LangGraph输出 | SSE事件 | 前端实时显示 | ⚠️ 部分正常 |

### 数据库写入流（部分正常）
| 数据类型 | 来源 | 存储位置 | 写入方法 | 状态 |
|---------|------|----------|----------|------|
| 消息 | LangGraph输出 | message_history表 | save_message() | ✅ 正常 |
| Artifacts | LangGraph输出 | artifact_storage表 | save_artifact() | ✅ 正常 |
| Artifacts | LangGraph输出 | artifacts表 | 无 | ❌ 缺失 |
| 执行记录 | 后端生成 | execution_record表 | create_execution_record() | ✅ 正常 |

### 数据库读取流（断裂）
| 数据类型 | API端点 | 查询表 | 前端使用 | 状态 |
|---------|---------|---------|----------|------|
| 消息历史 | /workspace/{url_param} | message_history | ✅ 使用 | ✅ 正常 |
| Artifacts | /workspace/{url_param} | artifact_storage | ❌ 忽略 | 🔥 **断裂** |
| 会话信息 | /workspace/{url_param} | session_mapping | ✅ 使用 | ✅ 正常 |

## 🎯 字段级别分析

### Artifact字段映射问题

| artifact_storage字段 | artifacts字段 | 前端期望 | 映射状态 |
|-------------------|--------------|----------|----------|
| artifact_id | id | UUID | ✅ 可映射 |
| type | type | 枚举类型 | ⚠️ 类型不匹配 |
| title | - | 显示名称 | ❌ 缺失映射 |
| content | - | 内容 | ❌ 缺失映射 |
| content_format | mime | MIME类型 | ⚠️ 格式不匹配 |
| source_agent | node_name | 节点名称 | ⚠️ 语义不匹配 |
| created_at | created_at | 时间戳 | ✅ 可映射 |
| session_id | trace_id | 追踪ID | ⚠️ 需要转换 |
| - | summary | 摘要 | ❌ 缺失 |
| - | payload_url | 内容URL | ❌ 缺失 |
| - | user_id | 用户ID | ❌ 缺失 |

## 🔥 关键问题详解

### 1. 前端数据获取错误
**问题**：ArtifactFeed组件完全忽略workspace API返回的artifacts数据

**当前逻辑**：
```typescript
// ArtifactFeed组件 - 错误的数据源
const allArtifacts = useThreadArtifacts(traceId);

// useThreadArtifacts - 只从messages转换
const getArtifacts = (threadId: string): Artifact[] => {
  const thread = get().threads.get(threadId);
  // 只从messages转换，忽略了真实的artifacts数据
  for (const message of thread.messages) {
    const artifact = messageToArtifact(message, threadId);
  }
}
```

**正确逻辑应该是**：
```typescript
// 应该从workspace API获取artifacts数据
const workspaceData = await getWorkspaceState(urlParam);
const artifacts = workspaceData.artifacts; // 这些数据被忽略了！
```

### 2. 数据表选择混乱
**问题**：项目中存在两套artifact表，用途不明确

**当前状态**：
- 后端写入：`artifact_storage`表 ✅
- 后端读取：`artifact_storage`表 ✅  
- 前端期望：`artifacts`表 ❌
- 前端实际：从messages转换 ❌

### 3. 类型定义不一致
**问题**：多个文件定义了不同的Artifact接口

**定义位置**：
1. `web/src/lib/supa.ts` - Supabase标准格式
2. `web/src/core/api/research-stream-types.ts` - API格式
3. `web/src/components/research/artifact-card.tsx` - 组件格式

## 📋 已知问题清单

### 🔥 紧急问题
1. **前端artifacts显示空白** - ArtifactFeed忽略workspace API数据
2. **数据表不同步** - artifact_storage vs artifacts表
3. **类型定义冲突** - 多个Artifact接口不兼容

### ⚠️ 设计问题  
4. **SSE vs API数据流混乱** - 实时数据和历史数据来源不一致
5. **字段映射缺失** - artifact_storage字段无法映射到前端期望格式
6. **数据转换逻辑错误** - messageToArtifact转换逻辑不可靠

### 🛠️ 架构问题
7. **数据源选择不明确** - 何时用SSE，何时用API，何时用数据库
8. **前端状态管理混乱** - unified-store与workspace API数据不同步
9. **后端表设计冗余** - 两套artifact表功能重叠

## 🎯 解决方案建议

### 方案1：统一使用artifact_storage表（推荐）
1. **废弃artifacts表**，全部使用artifact_storage
2. **修改前端类型定义**，适配artifact_storage格式
3. **修复ArtifactFeed**，使用workspace API数据

### 方案2：同步两套表
1. **保持两套表**，添加同步机制
2. **后端写入artifact_storage时同时写入artifacts**
3. **前端继续使用artifacts表**

### 方案3：重新设计数据流
1. **明确数据流职责**：SSE负责实时，API负责历史
2. **统一数据格式**，消除类型冲突
3. **重构前端状态管理**

## 📝 下一步行动

1. **立即修复**：ArtifactFeed使用workspace API数据
2. **数据表决策**：选择artifact_storage还是artifacts作为主表
3. **类型统一**：合并所有Artifact接口定义
4. **架构重构**：明确SSE、API、数据库的职责边界

---

**重要提醒**：在解决这些问题之前，不要进行更多的测试。需要先明确数据架构，然后逐步修复。 