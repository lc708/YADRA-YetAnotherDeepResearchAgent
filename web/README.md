# YADRA Frontend

YADRA (Yet Another Deep Research Agent) 的前端应用，基于 Next.js 15 构建的现代化深度研究界面。

## 🚀 快速开始

### 环境要求

- Node.js 18+ 
- pnpm 包管理器
- 运行中的 YADRA 后端服务 (localhost:8000)

### 1. 项目初始化

```bash
# 从项目根目录进入前端目录
cd web

# 安装依赖
pnpm install
```

### 2. 环境变量配置

```bash
# 复制环境变量模板
cp .env.template .env.local

# 编辑 .env.local 文件
nano .env.local
```

**必需的环境变量**：

```bash
# API 配置
NEXT_PUBLIC_API_URL=http://localhost:8000/api

# 静态网站模式（设置为 false 以启用完整功能）
NEXT_PUBLIC_STATIC_WEBSITE_ONLY=false

# Supabase 配置（工件管理必需）
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key-here

# 可选配置
GITHUB_OAUTH_TOKEN=your-github-token
AMPLITUDE_API_KEY=your-amplitude-key
```

### 3. Supabase 配置

#### 获取 Supabase 凭据

1. 前往 [Supabase 控制台](https://supabase.com/dashboard)
2. 选择或创建项目
3. 进入 Settings > API
4. 复制以下信息：
   - **Project URL** → `NEXT_PUBLIC_SUPABASE_URL`
   - **anon/public key** → `NEXT_PUBLIC_SUPABASE_ANON_KEY`

#### 数据库设置

```bash
# 从项目根目录运行数据库初始化
cd ..
psql -h your-supabase-host -U postgres -d postgres -f supabase-init.sql
```

详细的 Supabase 设置说明请查看 [../docs/20250614-supabase-setup.md](../docs/20250614-supabase-setup.md)。

### 4. 本地运行

#### 方法1: 使用根目录脚本（推荐）

```bash
# 从项目根目录运行
cd ..
./bootstrap.sh --dev
```

这将同时启动：
- 后端服务器 (localhost:8000)
- 前端开发服务器 (localhost:3001)

#### 方法2: 仅启动前端

```bash
# 确保后端服务器已运行
# 然后启动前端开发服务器
pnpm dev
```

访问 http://localhost:3001 查看应用。

## 🛠️ 开发命令

```bash
# 启动开发服务器（热重载）
pnpm dev

# 构建生产版本
pnpm build

# 启动生产服务器
pnpm start

# 代码检查和格式化
pnpm lint
pnpm lint:fix

# 类型检查
pnpm type-check
```

## 🎯 功能特性

### 核心功能

- **🎯 HeroInput**: 主页大输入框，支持AI增强提示和3秒快速响应
- **📊 ArtifactFeed**: 研究工件流，全程可追溯的实时展示
- **🔄 实时同步**: 基于 Supabase Realtime 的工件实时更新
- **📱 响应式设计**: 支持 ≥360px 宽度的移动设备
- **🌏 中文本地化**: 完整的中文界面支持
- **🎨 现代化UI**: Bolt.new 风格的深色主题设计

### 高级功能

- **✨ AI 提示增强**: 智能优化用户输入
- **📋 报告样式选择**: 学术、科普、新闻、社交媒体等多种风格
- **📎 资源引用**: 支持 @mentions 和文件上传
- **🔍 调查模式**: 自动背景调查增强研究深度
- **⚡ 渐进式加载**: 优雅的加载状态和错误处理

## 🏗️ 项目结构

```
web/
├── src/
│   ├── app/                    # Next.js App Router 页面
│   │   ├── landing/           # 落地页组件
│   │   ├── workspace/         # 工作区页面
│   │   └── chat/              # 聊天界面
│   ├── components/            # 可复用组件
│   │   ├── ui/               # 基础 UI 组件
│   │   └── yadra/            # YADRA 特定组件
│   ├── core/                  # 核心逻辑
│   │   ├── api/              # API 调用
│   │   ├── store/            # 状态管理
│   │   └── messages/         # 消息类型定义
│   └── lib/                   # 工具函数
├── public/                    # 静态资源
├── .env.template             # 环境变量模板
└── package.json              # 项目配置
```

## 🎨 设计原则

1. **⚡ First-Query Under 3s** - 首次查询3秒内响应
2. **🔍 全程可追溯** - 过程与结果分层展示  
3. **🔒 私有数据优先** - 突出私有数据来源
4. **📈 渐进暴露复杂度** - 默认极简界面，高级功能按需展示
5. **🔓 部署无锁** - 全部依赖开源软件
6. **📱 响应式及ARIA** - 支持移动端访问和无障碍
7. **🎨 重新设计品牌视觉** - 全新视觉设计语言

## 🛠️ 技术栈

### 核心框架
- **Next.js 14** (App Router) - React 全栈框架
- **TypeScript** - 类型安全的 JavaScript
- **Tailwind CSS** - 实用优先的 CSS 框架

### 状态管理与数据
- **Zustand** - 轻量级状态管理
- **Supabase** - 数据库 + 实时订阅
- **TanStack Query** - 服务器状态管理

### UI 组件与交互
- **Radix UI** - 无障碍的 UI 原语
- **TipTap** - 富文本编辑器
- **Framer Motion** - 动画库
- **React Window** - 虚拟滚动

### 开发工具
- **ESLint** - 代码检查
- **Prettier** - 代码格式化
- **Husky** - Git hooks

## 🚨 故障排除

### 常见问题

**1. 页面显示旧版本**
```bash
# 清除 Next.js 缓存
rm -rf .next
pnpm dev
```

**2. Supabase 连接失败**
- 检查 `.env.local` 中的 Supabase 配置
- 确认 Supabase 项目状态
- 查看浏览器控制台错误信息

**3. API 调用失败**
- 确认后端服务器运行在 localhost:8000
- 检查 `NEXT_PUBLIC_API_URL` 配置
- 查看网络请求状态

**4. 依赖安装问题**
```bash
# 清除依赖缓存
rm -rf node_modules pnpm-lock.yaml
pnpm install
```

### 开发模式调试

```bash
# 启用详细日志
NEXT_PUBLIC_DEBUG=true pnpm dev

# 查看构建分析
pnpm build --analyze
```

## 📚 相关文档

- [项目总体文档](../README.md)
- [Supabase 设置指南](../docs/20250614-supabase-setup.md)
- [API 文档](http://localhost:8000/docs) (需要后端运行)
- [Next.js 官方文档](https://nextjs.org/docs)
- [Tailwind CSS 文档](https://tailwindcss.com/docs)
