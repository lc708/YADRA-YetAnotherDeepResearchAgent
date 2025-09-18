# YADRA - Yet Another Deep Research Agent

<div align="center">

![Python Version](https://img.shields.io/badge/python-3.12+-blue.svg)
![LangGraph](https://img.shields.io/badge/powered%20by-LangGraph-orange.svg)
![Next.js](https://img.shields.io/badge/frontend-Next.js%2015-black.svg)
![TypeScript](https://img.shields.io/badge/typescript-5.0+-3178c6.svg)
![License](https://img.shields.io/badge/license-MIT-green.svg)
![PRs Welcome](https://img.shields.io/badge/PRs-welcome-brightgreen.svg)

基于 LangGraph 的智能深度研究代理，支持多步骤推理、实时流式响应和现代化 Web 界面。

[🚀 快速开始](#快速开始) • [✨ 功能特性](#功能特性) • [🛠️ 安装](#安装) • [📖 使用方法](#使用方法) • [🤝 贡献](#贡献)

[English](README.md)

</div>

## ✨ 功能特性

- 🧠 **智能工作流**：基于 LangGraph 的多步骤推理和自适应计划执行
- 🌊 **实时流式响应**：Server-Sent Events (SSE) 技术提供实时更新
- 🌐 **现代化 Web UI**：基于 Next.js 15 的响应式前端界面
- 🔄 **人机交互模式**：支持用户反馈和计划确认的 HITL 功能
- 🌐 **多语言支持**：同时支持中文和英文交互
- 🔌 **MCP 集成**：Model Context Protocol 扩展工具能力
- 📊 **多格式输出**：支持文本、图表、播客等多种输出格式
- 🐳 **容器化部署**：完整的 Docker 支持

## 🛠️ 技术栈

### 后端
- **核心框架**：LangGraph, LangChain, FastAPI
- **包管理**：uv（推荐）
- **数据库**：PostgreSQL (Supabase)
- **搜索引擎**：Tavily, DuckDuckGo, Brave Search, arXiv

### 前端
- **框架**：Next.js 15 (App Router)
- **语言**：TypeScript 5.0+
- **包管理**：pnpm
- **UI组件**：Tailwind CSS, Radix UI
- **状态管理**：Zustand

## 🚀 快速开始

### 环境要求

- Python 3.12+
- Node.js 18+ 和 pnpm
- uv 包管理器（推荐）
- PostgreSQL 数据库（推荐使用 Supabase）

### 1. 克隆项目

```bash
git clone https://github.com/lc708/YADRA-YetAnotherDeepResearchAgent.git
cd YADRA-YetAnotherDeepResearchAgent
```

### 2. 开发环境设置

**使用 bootstrap 脚本（推荐）**

```bash
# 开发模式，支持热重载
./bootstrap.sh --dev

# Windows 用户
bootstrap.bat --dev
```

这将启动：
- 🌐 前端：http://localhost:3000
- 🔌 后端 API：http://localhost:8000
- 📚 API 文档：http://localhost:8000/docs

### 3. 配置

#### 环境变量

在项目根目录创建 `.env` 文件：

```bash
# 数据库配置
DATABASE_URL=your_postgresql_url
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_key

# API 配置
NEXT_PUBLIC_API_URL="http://localhost:8000/api"
DEBUG=True
APP_ENV=development

# 搜索配置
SEARCH_API=tavily
TAVILY_API_KEY=your_tavily_key
```

#### LLM 配置

```bash
# 复制配置模板
cp conf.yaml.example conf.yaml

# 编辑配置文件，添加你的 API 密钥
nano conf.yaml
```

示例 `conf.yaml`：
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

## 📖 使用方法

### Web 界面（推荐）

1. 访问 `http://localhost:3000`
2. 输入研究问题
3. 配置研究参数（可选）
4. 发送并观察实时流式响应
5. 查看生成的工件、播客和研究结果

### API 使用

```bash
# 创建研究会话
POST /research/create
{
  "query": "你的研究问题",
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
```

### 命令行

```bash
python main.py [选项] [查询内容]

选项:
  --interactive              交互模式
  --debug                    启用调试日志
  --max_plan_iterations N    最大计划迭代次数
  --max_step_num N          最大步骤数
```

## 🐳 部署

### 开发环境

```bash
# 本地开发（推荐）
./bootstrap.sh --dev

# Docker 开发
docker-compose up -d
```

### 生产环境

**前端**：部署到 Vercel  
**后端**：使用 `./deploy.sh` 脚本部署到云服务器

详细部署说明请参考上述配置示例和仓库中的部署脚本。

## 🏗️ 项目结构

```
YADRA/
├── src/              # 后端源代码
│   ├── server/       # FastAPI 服务器
│   ├── graph/        # LangGraph 工作流
│   ├── agents/       # AI 代理
│   └── tools/        # 工具和实用程序
├── web/              # 前端源代码
│   ├── src/app/      # Next.js 页面
│   ├── components/   # React 组件
│   └── core/         # 核心功能
└── scripts/          # 数据库和实用脚本
```

## 🤝 贡献

我们欢迎所有形式的贡献！请查看 [贡献指南](CONTRIBUTING.md) 了解详细信息。

### 快速贡献步骤

1. Fork 项目到你的 GitHub 账户
2. 创建特性分支 (`git checkout -b feature/amazing-feature`)
3. 进行更改并遵循代码规范
4. 运行测试 (`pytest tests/`)
5. 提交更改 (`git commit -m 'Add amazing feature'`)
6. 推送到分支 (`git push origin feature/amazing-feature`)
7. 创建 Pull Request

## 📄 开源协议

本项目采用 [MIT License](LICENSE) 开源协议。

## 🔒 安全

请查看我们的 [安全政策](SECURITY.md) 了解如何报告安全漏洞。

## 📞 支持

- 🐛 **Bug 报告**：[GitHub Issues](../../issues)
- 💡 **功能请求**：[GitHub Issues](../../issues)
- 💬 **讨论**：[GitHub Discussions](../../discussions)

## 🏗️ 技术基础

YADRA 站在巨人的肩膀上。我们感谢这些出色的开源项目：

### 🧠 核心 AI 与工作流
- **[LangGraph](https://langchain-ai.github.io/langgraph/)** - 多智能体工作流编排
- **[LangChain](https://langchain.com/)** - LLM 应用框架
- **[LiteLLM](https://litellm.ai/)** - 统一的 LLM API 接口

### 🌐 前端与界面
- **[Next.js 15](https://nextjs.org/)** - 基于 App Router 的 React 框架
- **[TipTap](https://tiptap.dev/)** - 无头富文本编辑器
- **[Novel](https://novel.sh/)** - Notion 风格的所见即所得编辑器
- **[Radix UI](https://radix-ui.com/)** - 无样式、可访问的 UI 原语
- **[Tailwind CSS](https://tailwindcss.com/)** - 实用优先的 CSS 框架
- **[Framer Motion](https://framer.com/motion/)** - 动画库
- **[Zustand](https://zustand.docs.pmnd.rs/)** - 状态管理

### 🔧 后端与基础设施
- **[FastAPI](https://fastapi.tiangolo.com/)** - 现代 Python Web 框架
- **[Supabase](https://supabase.com/)** - 开源的 Firebase 替代方案
- **[PostgreSQL](https://postgresql.org/)** - 先进的关系型数据库
- **[uv](https://docs.astral.sh/uv/)** - 快速的 Python 包管理器

### 🔍 搜索与数据
- **[Tavily](https://tavily.com/)** - AI 驱动的网络搜索 API
- **[DuckDuckGo Search](https://github.com/deedy5/duckduckgo_search)** - 注重隐私的搜索
- **[arXiv](https://arxiv.org/)** - 学术论文搜索
- **[Jina AI](https://jina.ai/)** - 网页内容提取

## 💡 灵感来源

YADRA 从这些开创性的研究项目中汲取灵感：

- **[DeerFlow](https://github.com/deepflowai/deerflow)** - 提示词模板和工作流模式
- **[local-deep-researcher](https://github.com/localagi/local-deep-researcher)** - 本地 AI 研究方法论
- **[OpenDeepResearch](https://github.com/opendeepresearch/opendeepresearch)** - 开源研究框架

*特别感谢这些项目的提示词模板和研究方法论，它们帮助塑造了 YADRA 的方法。*

## 🙏 致谢

- 感谢所有让 YADRA 变得更好的 [贡献者](../../contributors)
- 受开源 AI 研究社区的启发
- 由研究者为研究者用爱构建

---

<div align="center">

由 YADRA 社区用 ❤️ 制作

[⭐ 在 GitHub 上给我们星标](../../stargazers) • [🐛 报告问题](../../issues) • [💡 请求功能](../../issues/new/choose)

</div>