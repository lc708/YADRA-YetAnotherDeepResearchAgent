# YADRA - Yet Another Deep Research Agent

<div align="center">

![Python Version](https://img.shields.io/badge/python-3.12+-blue.svg)
![LangGraph](https://img.shields.io/badge/powered%20by-LangGraph-orange.svg)

一个基于 LangGraph 的智能深度研究代理，支持多步骤推理、背景调查和多语言交互。

[🚀 快速开始](#快速开始) • [📖 功能特性](#功能特性) • [🛠️ 安装](#安装) • [📝 使用方法](#使用方法) • [🔧 配置](#配置)

</div>

## 📖 项目简介

YADRA（Yet Another Deep Research Agent）是一个现代化的AI研究代理，旨在帮助用户进行深度信息研究和分析。它结合了大语言模型的强大能力和结构化的工作流引擎，能够自动化执行复杂的研究任务。

### ✨ 核心特性

- 🧠 **智能工作流**: 基于 LangGraph 的多步骤推理和计划执行
- 🌐 **背景调查**: 自动进行网络搜索以增强上下文理解
- 🗣️ **多语言支持**: 同时支持中文和英文交互
- 🔄 **交互式模式**: 提供友好的命令行界面和内置问题模板
- 🌐 **Web API**: FastAPI 驱动的 RESTful API 服务
- 🔌 **MCP 集成**: 支持 MCP 扩展工具能力
- 📊 **多格式输出**: 支持文本、图表等多种输出格式
- 🐳 **容器化部署**: 完整的 Docker 支持

## 🛠️ 技术栈

- **核心框架**: LangGraph, LangChain
- **Web 框架**: FastAPI, Uvicorn
- **包管理**: uv (推荐) 或 pip
- **数据处理**: Pandas, NumPy
- **网络爬虫**: httpx, readabilipy
- **搜索引擎**: DuckDuckGo, Brave Search, arXiv, Tavily等
- **部署**: Docker, Docker Compose

## 🚀 快速开始

### 环境要求

- Python 3.12 或更高版本
- uv 包管理器（推荐）或 pip

### 1. 克隆项目

```bash
git clone https://github.com/your-username/YADRA-YetAnotherDeepResearchAgent.git
cd YADRA-YetAnotherDeepResearchAgent
```

### 2. 设置环境

#### 使用 uv（推荐）

```bash
# 运行初始化脚本
./bootstrap.sh  # macOS/Linux
# 或
bootstrap.bat   # Windows
```

#### 使用传统方法

```bash
python -m venv .venv
source .venv/bin/activate  # macOS/Linux
# 或
.venv\Scripts\activate     # Windows

pip install -e .
```

### 3. 配置

```bash
# 复制配置文件模板
cp conf.yaml.example conf.yaml

# 编辑配置文件，添加你的 API 密钥
nano conf.yaml
```

### 4. 运行

#### 命令行模式

```bash
# 交互式模式（推荐新手）
python main.py --interactive

# 直接提问
python main.py "人工智能的最新发展趋势是什么？"

# 启用调试模式
python main.py --debug --interactive
```

#### Web 服务模式

```bash
# 启动 API 服务器
python server.py

# 或使用自定义配置
python server.py --host 0.0.0.0 --port 8080 --reload
```

## 📝 使用方法

### 命令行参数

```bash
python main.py [选项] [查询内容]

选项:
  --interactive              启动交互式模式
  --debug                     启用调试日志
  --max_plan_iterations N     最大计划迭代次数（默认: 1）
  --max_step_num N           最大步骤数（默认: 3）
  --no-background-investigation  禁用背景调查
```

### Web API 使用

启动服务器后，访问 `http://localhost:8000/docs` 查看 API 文档。

主要端点：
- `POST /ask` - 提交研究问题
- `GET /status` - 查看服务状态
- `GET /health` - 健康检查

### 内置问题模板

项目包含了多个预设的研究问题，涵盖：

**中文问题**:
- 人工智能在医疗保健领域的应用因素
- 量子计算对密码学的影响
- 可再生能源技术的最新发展
- 气候变化对全球农业的影响
- 等等...

**英文问题**:
- AI adoption factors in healthcare
- Quantum computing impact on cryptography
- Latest renewable energy developments
- Climate change effects on agriculture
- 等等...

## 🔧 配置

### 基础配置

编辑 `conf.yaml` 文件：

```yaml
BASIC_MODEL:
  base_url: https://your-api-endpoint.com
  model: "your-model-name"
  api_key: "your-api-key"
```

### 高级配置

- **MCP 集成**: 在 `src/workflow.py` 中配置 MCP 服务器
- **工具扩展**: 在 `src/tools/` 目录下添加自定义工具
- **提示词模板**: 在 `src/prompts/` 目录下自定义提示词

## 🐳 Docker 部署

### 使用 Docker Compose

```bash
# 构建并启动服务
docker-compose up -d

# 查看日志
docker-compose logs -f

# 停止服务
docker-compose down
```

### 使用 Dockerfile

```bash
# 构建镜像
docker build -t yadra .

# 运行容器
docker run -p 8000:8000 -v ./conf.yaml:/app/conf.yaml yadra
```

## 🧪 开发

### 安装开发依赖

```bash
uv sync --extra dev
```

### 运行测试

```bash
# 运行所有测试
pytest

# 运行特定测试文件
pytest tests/test_workflow.py

# 生成覆盖率报告
pytest --cov=src --cov-report=html
```

### 代码格式化

```bash
# 格式化代码
black src/ tests/

# 运行 pre-commit 检查
pre-commit run --all-files
```

## 📁 项目结构

```
YADRA-YetAnotherDeepResearchAgent/
├── src/                    # 核心源代码
│   ├── agents/            # AI 代理实现
│   ├── config/            # 配置和问题模板
│   ├── crawler/           # 网络爬虫模块
│   ├── graph/             # LangGraph 工作流定义
│   ├── llms/              # 大语言模型接口
│   ├── prompts/           # 提示词模板
│   ├── rag/               # 检索增强生成
│   ├── server/            # Web 服务器实现
│   ├── tools/             # 工具集合
│   └── utils/             # 工具函数
├── docs/                  # 文档
├── tests/                 # 测试用例
├── examples/              # 示例代码
├── web/                   # 前端资源
├── main.py                # 命令行入口
├── server.py              # Web 服务入口
├── conf.yaml.example      # 配置模板
└── pyproject.toml         # 项目配置
```

## 🤝 贡献

我们欢迎所有形式的贡献！请查看 [贡献指南](CONTRIBUTING.md) 了解详情。

### 开发流程

1. Fork 项目
2. 创建特性分支 (`git checkout -b feature/amazing-feature`)
3. 提交更改 (`git commit -m 'Add amazing feature'`)
4. 推送到分支 (`git push origin feature/amazing-feature`)
5. 创建 Pull Request

## 🙏 致谢

- [LangChain](https://github.com/langchain-ai/langchain) - 为 LLM 应用提供强大框架
- [LangGraph](https://github.com/langchain-ai/langgraph) - 多代理工作流引擎
- [FastAPI](https://github.com/tiangolo/fastapi) - 现代化 Web 框架
- 所有贡献者和开源社区

## 📞 支持

- 🐛 [报告问题](https://github.com/your-username/YADRA/issues)
- 💬 [讨论区](https://github.com/your-username/YADRA/discussions)
- 📧 邮件支持: support@yadra.ai

---

<div align="center">
Made with ❤️ by the YADRA Team
</div> 