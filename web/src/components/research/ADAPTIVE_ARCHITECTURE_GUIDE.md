# 🎯 自适应研究组件架构指南

## 📋 概述

这是YADRA项目中新设计的**通用化Langgraph适配系统**，解决了前端组件与后端节点硬编码耦合的问题。

### 🚨 解决的核心问题

1. **硬编码不匹配** - 前端定义了理想化节点类型，但后端实际节点结构不同
2. **随机性适配不足** - Agent执行有随机性，节点执行顺序可能变化  
3. **维护成本高** - 前后端需要同步维护节点类型定义
4. **扩展性差** - 后端Langgraph流程迭代时，前端需要大量修改

## 🏗️ 架构设计

### 核心设计原则

```typescript
// ❌ 旧设计：硬编码节点类型
export type LanggraphNodeType = 
  | "planner" | "searcher" | "crawler" 
  | "analyzer" | "writer" | "reviewer" | "synthesizer";

// ✅ 新设计：功能分类 + 动态适配
export type NodeCategory = 
  | "coordination"    // 协调类：coordinator
  | "investigation"   // 调研类：background_investigator  
  | "planning"        // 规划类：planner
  | "execution"       // 执行类：researcher, coder
  | "reporting"       // 报告类：reporter
  | "interaction"     // 交互类：human_feedback, reask
  | "unknown";        // 未知类型，兜底处理
```

### 适配器架构

```
┌─────────────────────────────────────────┐
│           SSE 事件流                     │
│  (后端Langgraph实际执行事件)              │
└─────────────┬───────────────────────────┘
              │
              ▼
┌─────────────────────────────────────────┐
│        SSE事件适配器                     │
│  • handleNodeStart()                   │
│  • handleNodeComplete()                │
│  • handleMessageChunk()                │
│  • handleSearchResults()               │
└─────────────┬───────────────────────────┘
              │
              ▼
┌─────────────────────────────────────────┐
│        节点分类器                        │
│  • categorize(nodeName)                │
│  • getDisplayName(nodeName)            │
│  • getDescription(nodeName)            │
└─────────────┬───────────────────────────┘
              │
              ▼
┌─────────────────────────────────────────┐
│        内容分析器                        │
│  • extractActions(content, nodeName)   │
│  • extractOutputs(content)             │
│  • inferActionType(content)            │
└─────────────┬───────────────────────────┘
              │
              ▼
┌─────────────────────────────────────────┐
│      动态组件数据结构                     │
│  • DynamicNodeInfo                     │
│  • DynamicActionInfo                   │
│  • DynamicOutput                       │
└─────────────────────────────────────────┘
```

## 🔧 使用方法

### 1. 基本使用

```typescript
import { AdaptiveResearchCard } from "~/components/research";

// 基本使用 - 使用默认适配器
<AdaptiveResearchCard
  data={researchData}
  onSSEEvent={handleSSEEvent}
/>
```

### 2. 自定义适配器

```typescript
import { 
  AdaptiveResearchCard,
  createDefaultAdapters,
  DefaultNodeCategorizer 
} from "~/components/research";

// 扩展默认节点分类器
class CustomNodeCategorizer extends DefaultNodeCategorizer {
  categorize(nodeName: string): NodeCategory {
    // 添加项目特定的节点映射
    if (nodeName === "custom_analyzer") {
      return "execution";
    }
    return super.categorize(nodeName);
  }
  
  getDisplayName(nodeName: string): string {
    if (nodeName === "custom_analyzer") {
      return "自定义分析器";
    }
    return super.getDisplayName(nodeName);
  }
}

// 使用自定义适配器
const customAdapters = {
  ...createDefaultAdapters(),
  categorizer: new CustomNodeCategorizer()
};

<AdaptiveResearchCard
  data={researchData}
  adapters={customAdapters}
  config={{
    showProgress: true,
    expandByDefault: true,
    maxOutputsPerAction: 10
  }}
/>
```

### 3. SSE事件处理

```typescript
import { 
  DefaultSSEEventAdapter,
  createDefaultAdapters 
} from "~/components/research";

const handleSSEEvent = (event: any) => {
  const adapters = createDefaultAdapters();
  
  switch (event.event) {
    case "node_start":
      const nodeInfo = adapters.sseAdapter.handleNodeStart(event.data);
      // 更新组件状态
      break;
      
    case "message_chunk":
      const actions = adapters.sseAdapter.handleMessageChunk(event.data);
      // 处理新的动作
      break;
      
    case "search_results":
      const outputs = adapters.sseAdapter.handleSearchResults(event.data);
      // 处理搜索输出
      break;
  }
};
```

## 🎨 实际节点映射

### 后端实际节点 → 前端分类

| 后端节点名称 | 功能分类 | 前端显示名称 | 图标 |
|-------------|---------|-------------|------|
| `coordinator` | coordination | 任务协调 | 💬 |
| `background_investigator` | investigation | 背景调研 | 🔍 |
| `planner` | planning | 研究规划 | 🧠 |
| `researcher` | execution | 深度研究 | 🔬 |
| `coder` | execution | 数据处理 | 💻 |
| `reporter` | reporting | 报告生成 | 📄 |
| `human_feedback` | interaction | 人工反馈 | 👤 |
| `reask` | interaction | 重新询问 | 💭 |

### 动态动作推断

基于SSE事件内容自动推断动作类型：

```typescript
// 内容分析规则
const actionRules = [
  { pattern: /搜索|search/i, category: "searching", title: "搜索信息" },
  { pattern: /分析|analysis/i, category: "analyzing", title: "分析处理" },
  { pattern: /生成|generate/i, category: "generating", title: "内容生成" },
  { pattern: /处理|process/i, category: "processing", title: "数据处理" },
  { pattern: /验证|validate/i, category: "validating", title: "验证检查" },
  { pattern: /反馈|feedback/i, category: "communicating", title: "交互通信" }
];
```

### 输出类型识别

自动从内容中提取和分类输出：

```typescript
// URL识别
const urls = content.match(/https?:\/\/[^\s]+/g) || [];

// 代码块识别  
const codeBlocks = content.match(/```[\s\S]*?```/g) || [];

// 数据结构识别
const dataStructures = content.match(/\{[\s\S]*?\}|\[[\s\S]*?\]/g) || [];
```

## 🔄 迁移指南

### 从旧组件迁移

```typescript
// ❌ 旧代码
import { ResearchCard } from "~/components/research";

<ResearchCard
  data={{
    nodes: [{
      type: "planner",  // 硬编码类型
      status: "running"
    }]
  }}
/>

// ✅ 新代码
import { AdaptiveResearchCard } from "~/components/research";

<AdaptiveResearchCard
  data={{
    nodes: [{
      name: "planner",           // 后端实际节点名
      category: "planning",      // 动态推断分类
      displayName: "研究规划",    // 本地化显示名
      status: "running"
    }]
  }}
/>
```

### 配置迁移

```typescript
// ❌ 旧配置
const oldConfig = {
  nodeTypes: ["planner", "searcher", "analyzer"],  // 硬编码
  actionTypes: ["search", "analyze", "write"]       // 硬编码
};

// ✅ 新配置
const newConfig = {
  nodeMapping: {
    "planner": { category: "planning", displayName: "研究规划" },
    "researcher": { category: "execution", displayName: "深度研究" }
  },
  actionRules: [
    { pattern: /search/i, category: "searching", title: "搜索" }
  ],
  display: {
    showProgress: true,
    expandByDefault: true
  }
};
```

## 🚀 优势总结

### 1. **动态适配**
- ✅ 自动适配后端新增节点
- ✅ 基于SSE事件动态构建UI
- ✅ 无需修改前端代码

### 2. **维护简化**
- ✅ 单一配置文件管理映射
- ✅ 适配器模式易于扩展
- ✅ 类型安全的接口设计

### 3. **随机性支持**
- ✅ 支持节点执行顺序变化
- ✅ 动态状态更新
- ✅ 容错处理机制

### 4. **向后兼容**
- ✅ 保留原有API接口
- ✅ 渐进式迁移支持
- ✅ 类型别名兼容

## 📝 最佳实践

1. **使用默认适配器** - 对于标准Langgraph节点
2. **扩展分类器** - 对于项目特定节点
3. **配置规则** - 对于内容识别模式
4. **监听SSE事件** - 实现实时更新
5. **类型安全** - 使用TypeScript接口

这种设计确保了前端组件能够灵活适配后端Langgraph的实际执行情况，避免了硬编码维护问题，支持Agent执行的随机性，并为未来的迭代提供了良好的扩展性。 