# YADRA - Yet Another Deep Research Agent

<div align="center">

![Python Version](https://img.shields.io/badge/python-3.12+-blue.svg)
![LangGraph](https://img.shields.io/badge/powered%20by-LangGraph-orange.svg)
![Next.js](https://img.shields.io/badge/frontend-Next.js%2015-black.svg)
![TypeScript](https://img.shields.io/badge/typescript-5.0+-3178c6.svg)

一个基于 LangGraph 的智能深度研究代理，支持多步骤推理、实时流式响应和现代化 Web 界面。

[🚀 快速开始](#快速开始) • [📖 功能特性](#功能特性) • [🛠️ 安装](#安装) • [📝 使用方法](#使用方法) • [🔧 配置](#配置)

</div>

## 📖 项目简介

YADRA（Yet Another Deep Research Agent）是一个现代化的AI研究代理，采用前后端分离架构，为用户提供直观的深度信息研究和分析体验。它结合了大语言模型的强大能力和结构化的工作流引擎，能够自动化执行复杂的研究任务，并通过实时流式响应提供流畅的用户体验。

### ✨ 核心特性

- 🧠 **智能工作流**: 基于 LangGraph 的多步骤推理和自适应计划执行
- 🌊 **实时流式响应**: SSE (Server-Sent Events) 技术提供实时数据更新
- 🌐 **现代化 Web UI**: 基于 Next.js 15 的响应式前端界面
- 🏗️ **统一数据架构**: Phase 2 数据库架构，支持会话管理和历史记录
- 🗣️ **多语言支持**: 同时支持中文和英文交互
- 🔄 **人机交互模式**: 支持用户反馈和计划确认的 HITL (Human-in-the-Loop) 功能
- 🌐 **背景调查**: 自动进行网络搜索以增强上下文理解
- 🔌 **MCP 集成**: 支持 Model Context Protocol 扩展工具能力
- 📊 **多格式输出**: 支持文本、图表、播客等多种输出格式
- 🐳 **容器化部署**: 完整的 Docker 支持

## 🛠️ 技术栈

### 后端
- **核心框架**: LangGraph, LangChain
- **Web 框架**: FastAPI, Uvicorn
- **包管理**: uv (推荐)
- **数据库**: PostgreSQL (Supabase)
- **数据处理**: Pandas, NumPy
- **网络爬虫**: httpx, readabilipy
- **搜索引擎**: Tavily, DuckDuckGo, Brave Search, arXiv等

### 前端
- **框架**: Next.js 15 (App Router)
- **语言**: TypeScript 5.0+
- **包管理**: pnpm
- **UI组件**: Tailwind CSS, Radix UI
- **状态管理**: Zustand (Unified Store)
- **实时通信**: Server-Sent Events (SSE)

### 数据库架构
- **Phase 2 数据库结构**: 5表架构，支持会话映射和消息历史
- **表结构**: `session_mapping`, `research_sessions`, `message_history`, `plans`, `artifact_storage`
- **特性**: 统一会话管理、消息类型扩展、计划序列化支持

## 🚀 快速开始

### 环境要求

- Python 3.12 或更高版本
- Node.js 18+ 和 pnpm
- uv 包管理器（推荐）
- PostgreSQL 数据库（推荐使用 Supabase）

### 1. 克隆项目

```bash
git clone https://github.com/lc708/YADRA-YetAnotherDeepResearchAgent.git
cd YADRA-YetAnotherDeepResearchAgent
```

### 2. 设置环境

#### 📦 使用 bootstrap.sh 本地开发脚本（推荐）

**重要说明：bootstrap.sh 是本地开发环境脚本，不用于生产部署！**

```bash
# 🚀 本地开发模式（推荐）- 启用热重载和实时调试
./bootstrap.sh --dev    # 或 -d, dev, development

# 📋 本地生产模式预览
./bootstrap.sh

# 🪟 Windows 用户
bootstrap.bat --dev
```

**本地开发模式特性**：
- 🔥 **后端热重载**: `--reload` 模式，代码变更自动重启
- ⚡ **前端快速刷新**: Next.js 开发模式，支持 HMR
- 🐛 **调试模式**: 启用详细日志和错误追踪
- 🔄 **实时 SSE**: 开发环境下的实时数据流
- 📍 **服务地址**: 前端 http://localhost:3000，后端 http://localhost:8000

**⚠️ 生产环境部署说明**：
- 生产环境请查看 [docs/deployment-guide.md](docs/deployment-guide.md)
- 前端部署到 Vercel，后端使用 `deploy.sh` 脚本部署到云服务器

### 3. 配置文件设置

#### 环境变量配置

项目根目录的 `.env` 文件配置：
```bash
# 数据库配置
DATABASE_URL=
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=

# API 配置
NEXT_PUBLIC_API_URL="http://localhost:8000/api"
DEBUG=True
APP_ENV=development

# 搜索配置
SEARCH_API=tavily
TAVILY_API_KEY={已配置}

# 代理配置
AGENT_RECURSION_LIMIT=30
```

#### 后端模型配置

```bash
# 复制配置文件模板
cp conf.yaml.example conf.yaml

# 编辑配置文件，添加你的 LLM API 密钥
nano conf.yaml
```

示例 `conf.yaml` 配置：
```yaml
BASIC_MODEL:
  base_url: https://api.openai.com/v1
  model: "gpt-4o"
  api_key: "your-openai-api-key"

REASONING_MODEL:
  base_url: https://api.anthropic.com
  model: "claude-3-5-sonnet-20241022"
  api_key: "your-anthropic-api-key"
```

### 4. 数据库初始化

Phase 2 数据库架构会在首次启动时自动初始化：

```bash
# 检查数据库连接（可选）
python scripts/setup_postgres.py

# 设置会话映射架构（可选，自动执行）
python scripts/setup_session_mapping_schema.py
```

### 5. 运行应用

#### 全栈应用（推荐使用方式）

```bash
# 开发模式 - 同时启动后端和前端
./bootstrap.sh --dev

# 应用访问地址
# 🌐 前端 Web UI: http://localhost:3001
# 🔌 后端 API: http://localhost:8000
# 📚 API 文档: http://localhost:8000/docs
# 🔄 实时 WebSocket: ws://localhost:8000/ws
```

#### 单独启动服务

```bash
# 仅启动后端
python server.py --reload --debug

# 仅启动前端（新终端）
cd web && pnpm dev
```

## 📝 使用方法

### Web UI 使用（推荐）

1. 访问 `http://localhost:3000`
2. 在输入框中输入你的研究问题
3. 配置研究参数（可选）：
   - 最大计划迭代次数
   - 最大执行步骤数
   - 自动接受计划
   - 报告风格选择
4. 点击发送，观察实时流式响应
5. 查看生成的工件、播客和研究结果

### 命令行使用

```bash
python main.py [选项] [查询内容]

选项:
  --interactive              启动交互式模式
  --debug                     启用调试日志
  --max_plan_iterations N     最大计划迭代次数（默认: 1）
  --max_step_num N           最大步骤数（默认: 3）
  --no-background-investigation  禁用背景调查
```

### API 使用

主要 API 端点：

```bash
# 创建研究会话
POST /research/create
{
  "query": "研究问题",
  "research_config": {
    "max_plan_iterations": 2,
    "max_step_num": 5,
    "auto_accepted_plan": false
  }
}

# 获取会话状态
GET /research/status/{session_id}

# SSE 流式响应
GET /research/stream/{session_id}

# 健康检查
GET /health
```

### 新架构特性

#### 统一数据流架构
- **实时页面**: 完全使用 SSE 流式数据，无数据库查询延迟
- **历史页面**: 完全使用数据库数据，确保数据持久性
- **数据一致性**: 后端确保 SSE 事件与数据库完全同步

#### 会话管理
- **智能 URL 参数**: 自动生成可读的会话标识符
- **会话恢复**: 支持页面刷新后的会话状态恢复
- **多会话切换**: 支持同时管理多个研究会话

#### 人机交互功能
- **计划确认**: 用户可审核和修改 AI 生成的研究计划
- **步骤干预**: 在关键步骤支持用户反馈和调整
- **配置灵活性**: 支持自动接受计划或手动确认模式

## 🔧 高级配置

### 研究配置参数

```typescript
interface ResearchConfig {
  max_plan_iterations: number;    // 最大计划迭代次数 (1-5)
  max_step_num: number;          // 最大执行步骤数 (3-10)
  auto_accepted_plan: boolean;   // 是否自动接受计划
  report_style: "academic" | "popular_science" | "news" | "social_media";
  max_search_results: number;    // 最大搜索结果数
}
```

### MCP 服务器配置

在前端设置页面或通过 API 配置 MCP 服务器：

```json
{
  "name": "filesystem",
  "command": "uvx",
  "args": ["mcp-server-filesystem", "/path/to/allowed/files"],
  "env": {}
}
```

### 数据库模式

Phase 2 架构包含以下核心表：

```sql
-- 会话映射表
CREATE TABLE session_mapping (
    thread_id TEXT PRIMARY KEY,
    session_id TEXT NOT NULL UNIQUE,
    url_param TEXT NOT NULL UNIQUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 研究会话表
CREATE TABLE research_sessions (
    session_id TEXT PRIMARY KEY,
    query TEXT NOT NULL,
    status TEXT DEFAULT 'created',
    research_config JSONB,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 消息历史表
CREATE TABLE message_history (
    id SERIAL PRIMARY KEY,
    session_id TEXT REFERENCES research_sessions(session_id),
    content TEXT NOT NULL,
    content_type TEXT CHECK (content_type IN (
        'text', 'markdown', 'html', 'search_results', 
        'plan', 'artifact', 'error', 'system', 'json'
    )),
    timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

## 🐳 部署

### 🏠 本地开发环境（推荐用于开发）

**使用 bootstrap.sh 本地开发脚本**：

```bash
# 本地开发模式（同时启动前后端）
./bootstrap.sh --dev

# 本地生产模式预览
./bootstrap.sh
```

### ⚡ 快速本地测试（Docker）

如需本地Docker测试，可使用开发版docker-compose：

```bash
# 构建并启动所有服务（本地开发用）
docker-compose up -d

# 查看服务状态
docker-compose ps

# 查看日志
docker-compose logs -f yadra-backend
docker-compose logs -f yadra-frontend

# 停止服务
docker-compose down
```

### 🚀 生产环境部署

**⚠️ 重要：生产环境采用前后端分离部署**

#### 前端部署（Vercel）
1. 将项目推送到GitHub
2. 在Vercel导入仓库，设置Root Directory为 `web`
3. 配置环境变量：`NEXT_PUBLIC_API_URL`等

#### 后端部署（云服务器 + Docker）
```bash
# 生产环境后端部署脚本
./deploy.sh
```

**详细部署指南**：请查看 [docs/deployment-guide.md](docs/deployment-guide.md)

### 🔧 生产环境配置示例

生产环境Docker配置（docker-compose.prod.yml）：
```yaml
# 仅后端服务（前端部署到Vercel）
services:
  backend:
    build: .
    environment:
      - APP_ENV=production
      - DEBUG=False
    ports:
      - "8000:8000"
  nginx:
    image: nginx:alpine
    ports:
      - "80:80"
```

## 🧪 开发指南

### 前端开发

```bash
cd web

# 安装依赖
pnpm install

# 开发模式
pnpm dev

# 构建生产版本
pnpm build

# 启动生产服务器
pnpm start

# 类型检查
pnpm type-check

# Lint 检查
pnpm lint
```

### 后端开发

```bash
# 安装开发依赖
uv sync --extra dev

# 运行测试
pytest tests/

# 代码格式化
ruff format src/
ruff check src/ --fix

# 启动开发服务器
python server.py --reload --debug
```

### 调试工具

项目提供了多个调试脚本：

```bash
# 查询数据库结构
python scripts/query_database_structure.py

# 查询外键关系
python scripts/query_foreign_keys.py

# 检查用户数据
python scripts/check_users.py
```

## 📁 项目结构

```
YADRA-YetAnotherDeepResearchAgent/
├── src/                          # 后端源代码
│   ├── server/                   # FastAPI 服务器
│   │   ├── repositories/         # 数据访问层
│   │   ├── research_create_api.py # 研究创建 API
│   │   └── research_stream_api.py # SSE 流式 API
│   ├── graph/                    # LangGraph 工作流
│   ├── agents/                   # AI 代理实现
│   └── utils/                    # 工具函数
├── web/                          # 前端源代码
│   ├── src/
│   │   ├── app/
│   │   │   ├── workspace/        # 主工作空间页面
│   │   │   └── settings/         # 设置页面
│   │   ├── components/           # 可复用组件
│   │   │   ├── yadra/           # YADRA 特定组件
│   │   │   └── ui/              # 基础 UI 组件
│   │   ├── core/                # 核心功能
│   │   │   ├── api/             # API 客户端
│   │   │   ├── sse/             # SSE 处理
│   │   │   └── store/           # Zustand 状态管理
│   │   └── lib/                 # 工具库
├── scripts/                      # 数据库和工具脚本
├── docs/                        # 项目文档
├── examples/                    # 研究示例
├── main.py                      # 命令行入口
├── server.py                    # Web 服务入口
├── bootstrap.sh                 # 🏠 本地开发环境启动脚本
├── bootstrap.bat                # 🪟 Windows本地开发脚本
├── deploy.sh                    # 🚀 生产环境后端部署脚本  
├── docker-compose.yml           # 🛠️ 本地开发Docker配置
├── docker-compose.prod.yml      # 🏭 生产环境Docker配置
├── production.env.template      # 📋 生产环境变量模板
└── docs/deployment-guide.md     # 📖 完整部署指南
```

### 🔧 关键文件说明

| 文件 | 用途 | 使用场景 |
|-----|------|---------|
| `bootstrap.sh` | 本地开发环境启动脚本 | 开发、调试、本地测试 |
| `deploy.sh` | 生产环境后端部署脚本 | 云服务器生产部署 |
| `docker-compose.yml` | 本地开发Docker配置 | 本地Docker测试 |  
| `docker-compose.prod.yml` | 生产环境Docker配置 | 生产环境部署 |
| `production.env.template` | 生产环境变量模板 | 生产环境配置 |

## 🔄 更新日志

### Phase 2 架构升级 (最新)
- ✅ **统一数据架构**: 实时页面使用 SSE，历史页面使用数据库
- ✅ **会话管理优化**: 新的 session_mapping 表和 URL 参数生成
- ✅ **消息类型扩展**: 支持 9 种消息类型的存储和处理
- ✅ **前端架构重构**: workspace 根页面替代动态路由
- ✅ **组件迁移完成**: PodcastPanel 等核心组件迁移到新架构
- ✅ **配置传递链路**: 从前端设置到后端 LangGraph 的完整配置传递

### 技术债务清理
- 🗑️ **废弃路由清理**: 移除 `/workspace/[traceId]` 动态路由
- 🗑️ **脚本目录整理**: 清理临时测试和调试脚本
- 🔧 **依赖优化**: 更新到最新的 Next.js 15 和相关依赖

## 🤝 贡献

我们欢迎所有形式的贡献！请查看以下指南：

### 开发流程

1. Fork 项目到你的 GitHub 账户
2. 创建特性分支 (`git checkout -b feature/amazing-feature`)
3. 遵循代码规范进行开发
4. 运行测试确保功能正常 (`pytest tests/`)
5. 提交更改 (`git commit -m 'Add amazing feature'`)
6. 推送到分支 (`git push origin feature/amazing-feature`)
7. 创建 Pull Request

### 代码规范

- **后端**: 使用 `ruff` 进行代码格式化和 lint 检查
- **前端**: 使用 `prettier` 和 `eslint`