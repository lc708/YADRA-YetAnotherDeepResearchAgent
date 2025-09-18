# YADRA - Yet Another Deep Research Agent

<div align="center">

![Python Version](https://img.shields.io/badge/python-3.12+-blue.svg)
![LangGraph](https://img.shields.io/badge/powered%20by-LangGraph-orange.svg)
![Next.js](https://img.shields.io/badge/frontend-Next.js%2015-black.svg)
![TypeScript](https://img.shields.io/badge/typescript-5.0+-3178c6.svg)
![License](https://img.shields.io/badge/license-MIT-green.svg)
![PRs Welcome](https://img.shields.io/badge/PRs-welcome-brightgreen.svg)

An intelligent deep research agent powered by LangGraph with multi-step reasoning, real-time streaming responses, and modern web interface.

[🚀 Quick Start](#quick-start) • [✨ Features](#features) • [🛠️ Installation](#installation) • [📖 Documentation](#documentation) • [🤝 Contributing](#contributing)

[中文文档](README_zh.md)

</div>

## ✨ Features

- 🧠 **Smart Workflows**: Multi-step reasoning and adaptive plan execution with LangGraph
- 🌊 **Real-time Streaming**: Live updates with Server-Sent Events (SSE)
- 🌐 **Modern Web UI**: Responsive frontend built with Next.js 15
- 🔄 **Human-in-the-Loop**: Interactive plan confirmation and feedback
- 🌐 **Multi-language**: Support for both English and Chinese
- 🔌 **MCP Integration**: Model Context Protocol for extended capabilities
- 📊 **Multiple Formats**: Text, charts, podcasts, and more
- 🐳 **Docker Ready**: Full containerization support

## 🛠️ Tech Stack

### Backend
- **Core**: LangGraph, LangChain, FastAPI
- **Package Manager**: uv (recommended)
- **Database**: PostgreSQL (Supabase)
- **Search**: Tavily, DuckDuckGo, Brave Search, arXiv

### Frontend
- **Framework**: Next.js 15 (App Router)
- **Language**: TypeScript 5.0+
- **Package Manager**: pnpm
- **UI**: Tailwind CSS, Radix UI
- **State**: Zustand

## 🚀 Quick Start

### Prerequisites

- Python 3.12+
- Node.js 18+ and pnpm
- uv package manager (recommended)
- PostgreSQL database (Supabase recommended)

### 1. Clone Repository

```bash
git clone https://github.com/lc708/YADRA-YetAnotherDeepResearchAgent.git
cd YADRA-YetAnotherDeepResearchAgent
```

### 2. Development Setup

**Using bootstrap script (Recommended)**

```bash
# Development mode with hot reload
./bootstrap.sh --dev

# Windows users
bootstrap.bat --dev
```

This will start:
- 🌐 Frontend: http://localhost:3000
- 🔌 Backend API: http://localhost:8000
- 📚 API Docs: http://localhost:8000/docs

### 3. Configuration

#### Environment Variables

Create `.env` file in project root:

```bash
# Database
DATABASE_URL=your_postgresql_url
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_key

# API
NEXT_PUBLIC_API_URL="http://localhost:8000/api"
DEBUG=True
APP_ENV=development

# Search
SEARCH_API=tavily
TAVILY_API_KEY=your_tavily_key
```

#### LLM Configuration

```bash
# Copy config template
cp conf.yaml.example conf.yaml

# Edit with your API keys
nano conf.yaml
```

Example `conf.yaml`:
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

## 📖 Usage

### Web Interface (Recommended)

1. Visit `http://localhost:3000`
2. Enter your research question
3. Configure research parameters (optional)
4. Send and watch real-time streaming responses
5. View generated artifacts, podcasts, and results

### API Usage

```bash
# Create research session
POST /research/create
{
  "query": "Your research question",
  "research_config": {
    "max_plan_iterations": 2,
    "max_step_num": 5,
    "auto_accepted_plan": false
  }
}

# Get session status
GET /research/status/{session_id}

# SSE streaming
GET /research/stream/{session_id}
```

### Command Line

```bash
python main.py [options] [query]

Options:
  --interactive              Interactive mode
  --debug                    Enable debug logging
  --max_plan_iterations N    Max plan iterations (default: 1)
  --max_step_num N          Max steps (default: 3)
```

## 🐳 Deployment

### Development

```bash
# Local development (recommended)
./bootstrap.sh --dev

# Docker development
docker-compose up -d
```

### Production

**Frontend**: Deploy to Vercel  
**Backend**: Use `./deploy.sh` script for cloud deployment

For detailed deployment instructions, please refer to the configuration examples above and the deployment scripts in the repository.

## 🏗️ Architecture

```
YADRA/
├── src/              # Backend source
│   ├── server/       # FastAPI server
│   ├── graph/        # LangGraph workflows
│   ├── agents/       # AI agents
│   └── tools/        # Tools and utilities
├── web/              # Frontend source
│   ├── src/app/      # Next.js pages
│   ├── components/   # React components
│   └── core/         # Core functionality
└── scripts/          # Database and utility scripts
```

## 🤝 Contributing

We welcome contributions! Please see our [Contributing Guide](CONTRIBUTING.md) for details.

### Quick Contribution Steps

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Make your changes
4. Run tests (`pytest tests/`)
5. Commit your changes (`git commit -m 'Add amazing feature'`)
6. Push to the branch (`git push origin feature/amazing-feature`)
7. Open a Pull Request

### Development

```bash
# Backend
ruff format src/
ruff check src/ --fix
pytest tests/

# Frontend
cd web
pnpm lint
pnpm format
pnpm test
```

## 📄 License

This project is licensed under the [MIT License](LICENSE).

## 🔒 Security

Please see our [Security Policy](SECURITY.md) for reporting vulnerabilities.

## 📞 Support

- 🐛 **Bug Reports**: [GitHub Issues](../../issues)
- 💡 **Feature Requests**: [GitHub Issues](../../issues)
- 💬 **Discussions**: [GitHub Discussions](../../discussions)

## 🏗️ Built On

YADRA stands on the shoulders of giants. We're grateful to these amazing open-source projects:

### 🧠 Core AI & Workflow
- **[LangGraph](https://langchain-ai.github.io/langgraph/)** - Multi-agent workflow orchestration
- **[LangChain](https://langchain.com/)** - LLM application framework
- **[LiteLLM](https://litellm.ai/)** - Unified LLM API interface

### 🌐 Frontend & UI
- **[Next.js 15](https://nextjs.org/)** - React framework with App Router
- **[TipTap](https://tiptap.dev/)** - Headless rich text editor
- **[Novel](https://novel.sh/)** - Notion-style WYSIWYG editor
- **[Radix UI](https://radix-ui.com/)** - Unstyled, accessible UI primitives
- **[Tailwind CSS](https://tailwindcss.com/)** - Utility-first CSS framework
- **[Framer Motion](https://framer.com/motion/)** - Animation library
- **[Zustand](https://zustand.docs.pmnd.rs/)** - State management

### 🔧 Backend & Infrastructure
- **[FastAPI](https://fastapi.tiangolo.com/)** - Modern Python web framework
- **[Supabase](https://supabase.com/)** - Open-source Firebase alternative
- **[PostgreSQL](https://postgresql.org/)** - Advanced relational database
- **[uv](https://docs.astral.sh/uv/)** - Fast Python package manager

### 🔍 Search & Data
- **[Tavily](https://tavily.com/)** - AI-powered web search API
- **[DuckDuckGo Search](https://github.com/deedy5/duckduckgo_search)** - Privacy-focused search
- **[arXiv](https://arxiv.org/)** - Academic paper search
- **[Jina AI](https://jina.ai/)** - Web content extraction

## 💡 Inspiration

YADRA draws inspiration from these pioneering research projects:

- **[DeerFlow](https://github.com/deepflowai/deerflow)** - Prompt templates and workflow patterns
- **[local-deep-researcher](https://github.com/localagi/local-deep-researcher)** - Local AI research methodologies  
- **[OpenDeepResearch](https://github.com/opendeepresearch/opendeepresearch)** - Open-source research frameworks

*Special thanks to these projects for their prompt templates and research methodologies that helped shape YADRA's approach.*

## 🙏 Acknowledgments

- Thanks to all [contributors](../../contributors) who make YADRA better
- Inspired by the open-source AI research community
- Built with love for researchers, by researchers

---

<div align="center">

Made with ❤️ by the YADRA community

[⭐ Star us on GitHub](../../stargazers) • [🐛 Report Issues](../../issues) • [💡 Request Features](../../issues/new/choose)

</div>