# YADRA Frontend

YADRA (Yet Another Deep Research Agent) 的前端应用，基于 Next.js 14 构建。

## 环境变量配置

创建 `.env.local` 文件并配置以下环境变量：

```bash
# 静态网站模式（设置为 false 以启用完整功能）
NEXT_PUBLIC_STATIC_WEBSITE_ONLY=false

# Supabase 配置（工件管理必需）
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key-here
```

### 获取 Supabase 凭据

1. 前往 Supabase 项目仪表板
2. 进入 Settings > API
3. 复制 Project URL 和 anon/public key
4. 替换上述占位符值

## 开发

```bash
# 安装依赖
pnpm install

# 启动开发服务器
pnpm dev

# 构建生产版本
pnpm build

# 代码检查
pnpm lint
```

## 功能特性

- **HeroInput**: 主页大输入框，支持3秒快速响应
- **ArtifactFeed**: 研究工件流，全程可追溯
- **响应式设计**: 支持 ≥360px 宽度的移动设备
- **中文本地化**: 完整的中文界面支持
- **实时更新**: 基于 Supabase Realtime 的工件实时同步

## 设计原则

1. **First-Query Under 3s** - 首次查询3秒内响应
2. **全程可追溯** - 过程与结果分层展示
3. **私有数据优先** - 突出私有数据来源
4. **渐进暴露复杂度** - 默认极简界面
5. **部署无锁** - 全部依赖开源软件
6. **响应式及ARIA** - 支持移动端访问
7. **重新设计品牌视觉** - 全新视觉设计

## 技术栈

- Next.js 14 (App Router)
- TypeScript
- Tailwind CSS
- Supabase (数据库 + 实时订阅)
- TipTap (富文本编辑器)
- Zustand (状态管理)
- React Window (虚拟滚动)
