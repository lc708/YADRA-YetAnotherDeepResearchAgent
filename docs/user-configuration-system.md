# YADRA 用户配置系统文档

## 📋 概述

YADRA 采用双层配置架构，既支持即时快速配置调整，又提供持久化的用户偏好设置。所有配置通过统一的 settings-store 管理，确保数据一致性和类型安全。

## 🎯 配置入口分布

### Hero Input 组件 - 即时配置

位置：`web/src/components/yadra/hero-input.tsx`

#### 1. 报告风格 (ReportStyle)
- **功能**：选择研究报告的写作风格
- **选项**：
  - 学术报告 (academic) - 严谨客观，逻辑缜密，适合研究分析
  - 科普解读 (popular_science) - 通俗易懂，深入浅出，适合大众传播
  - 新闻资讯 (news) - 事实为准，简洁明了，适合快速阅读
  - 社交媒体 (social_media) - 生动有趣，观点鲜明，适合分享传播
- **交互方式**：点击风格按钮 → 打开 `ReportStyleDialog` 对话框选择
- **存储**：`setReportStyle()` → settings-store → localStorage
- **实现文件**：`web/src/components/yadra/report-style-dialog.tsx`

#### 2. 推理模式 (Deep Thinking)
- **功能**：启用AI深度思考和推理能力
- **选项**：开启/关闭
- **效果**：
  - 开启：使用推理模型进行深度思考，生成更深思熟虑的研究计划
  - 关闭：使用基础模型快速处理，提高响应速度
- **交互方式**：切换按钮 (Brain/User 图标)
- **存储**：`setEnableDeepThinking()` → settings-store
- **模型切换**：reasoning model ↔ basic model

#### 3. 调研模式 (Background Investigation)
- **功能**：在制定计划前进行快速背景搜索
- **选项**：开启/关闭
- **适用场景**：时事热点、最新动态研究
- **交互方式**：切换按钮 (Detective 图标)
- **存储**：`setEnableBackgroundInvestigation()` → settings-store

### Settings 页面 - 全局配置

位置：`web/src/app/settings/tabs/general-tab.tsx`

#### 1. 计划自动接受 (Auto Accept Plan)
- **功能**：控制是否自动接受AI生成的研究计划
- **选项**：
  - `false` (默认) - 等待用户确认计划后再执行
  - `true` - 自动接受计划并直接生成报告
- **交互方式**：开关组件
- **存储**：`setAutoAcceptedPlan()` → settings-store
- **影响**：直接传递给LangGraph执行引擎

#### 2. 数值配置
- **maxPlanIterations** (最大计划迭代次数)
  - 默认值：1
  - 范围：≥1
  - 说明：设为1表示单步规划，≥2启用重新规划
  
- **maxStepNum** (最大研究步骤数)
  - 默认值：3
  - 范围：≥1
  - 说明：每个研究计划的最大步骤数
  
- **maxSearchResults** (最大搜索结果数)
  - 默认值：3
  - 范围：≥1
  - 说明：每个搜索步骤返回的最大结果数

## 🏗️ 技术架构

### 配置存储层
```typescript
// web/src/core/store/settings-store.ts
export type SettingsState = {
  general: {
    autoAcceptedPlan: boolean;
    enableDeepThinking: boolean;
    enableBackgroundInvestigation: boolean;
    maxPlanIterations: number;
    maxStepNum: number;
    maxSearchResults: number;
    reportStyle: "academic" | "popular_science" | "news" | "social_media";
  };
  mcp: {
    servers: MCPServerMetadata[];
  };
};
```

### 配置传递流程
```
用户操作 → settings-store (Zustand) → localStorage持久化 → buildResearchConfig → 后端API → LangGraph
```

#### 详细传递链路
1. **前端配置收集**：
   ```typescript
   // web/src/core/api/research-stream.ts
   export function buildResearchConfig(settings: {
     autoAcceptedPlan?: boolean;
     enableBackgroundInvestigation?: boolean;
     reportStyle?: 'academic' | 'popular_science' | 'news' | 'social_media';
     enableDeepThinking?: boolean;
     maxPlanIterations?: number;
     maxStepNum?: number;
     maxSearchResults?: number;
   })
   ```

2. **后端配置解析**：
   ```python
   # src/server/research_create_api.py
   research_config = {**default_research_config, **request.config.get('research', {})}
   ```

3. **LangGraph配置应用**：
   ```python
   # src/server/research_stream_api.py
   "auto_accepted_plan": research_config.get("auto_accepted_plan", False)
   ```

### 配置优先级
1. **即时配置** (Hero Input) - 最高优先级，覆盖全局设置
2. **全局配置** (Settings) - 默认值和用户偏好
3. **系统默认值** - 兜底配置

## 🔧 配置API

### 设置函数
```typescript
// 报告风格
setReportStyle(value: "academic" | "popular_science" | "news" | "social_media")

// 推理模式
setEnableDeepThinking(value: boolean)

// 调研模式  
setEnableBackgroundInvestigation(value: boolean)

// 自动接受计划
setAutoAcceptedPlan(value: boolean)
```

### 获取配置
```typescript
// 获取当前设置
const settings = useSettingsStore.getState().general;

// 响应式订阅
const reportStyle = useSettingsStore((state) => state.general.reportStyle);
```

### 配置构建
```typescript
// 构建研究配置对象
const researchConfig = buildResearchConfig({
  autoAcceptedPlan: settings.autoAcceptedPlan,
  enableBackgroundInvestigation: settings.enableBackgroundInvestigation,
  reportStyle: settings.reportStyle,
  enableDeepThinking: settings.enableDeepThinking,
  maxPlanIterations: settings.maxPlanIterations,
  maxStepNum: settings.maxStepNum,
  maxSearchResults: settings.maxSearchResults,
});
```

## 🚀 扩展方向

### 短期规划 (即将实现)

#### 1. 更多即时配置选项
- **模型选择**：在Hero Input中直接切换AI模型
- **语言设置**：支持中文/英文输出切换
- **输出格式偏好**：Markdown/HTML/PDF等格式选择
- **搜索深度调整**：动态调整搜索的深度和广度

#### 2. 高级搜索配置
- **搜索源选择**：指定搜索引擎和数据源
- **时间范围限制**：限制搜索结果的时间范围
- **地理位置过滤**：基于地理位置的搜索结果过滤

### 中期规划 (功能增强)

#### 1. 配置预设系统
- **预设保存**：保存常用配置组合为预设
- **快速切换**：一键切换不同的配置预设
- **预设分享**：导出/导入配置预设文件
- **场景模板**：针对不同研究场景的预设模板

#### 2. 智能配置推荐
- **基于历史**：根据用户历史使用习惯推荐配置
- **基于内容**：根据研究问题类型自动推荐最佳配置
- **A/B测试**：对比不同配置的效果，优化推荐算法

### 长期规划 (高级功能)

#### 1. 个性化配置
- **用户画像**：基于使用行为构建用户画像
- **自适应调整**：系统自动调整配置以提升用户体验
- **学习偏好**：机器学习用户偏好，持续优化默认设置

#### 2. 高级模型配置
- **模型参数调整**：temperature, top_p, max_tokens等参数
- **自定义Prompt模板**：用户自定义系统提示词
- **工具选择配置**：选择和配置可用的AI工具
- **多模型协作**：配置多个模型的协作方式

#### 3. 企业级配置
- **团队配置共享**：团队内共享配置模板
- **权限管理**：不同用户角色的配置权限控制
- **审计日志**：配置变更的审计和追踪
- **合规设置**：符合企业合规要求的配置选项

## 📝 最佳实践

### 开发者指南

#### 1. 添加新配置选项
1. **定义类型**：在 `SettingsState` 中添加新字段
2. **创建setter**：实现对应的设置函数
3. **UI组件**：在Hero Input或Settings页面添加控制组件
4. **配置传递**：更新 `buildResearchConfig` 函数
5. **后端处理**：在后端API中处理新配置
6. **测试验证**：编写测试确保配置正确传递

#### 2. 配置验证
```typescript
// 配置验证示例
const validateConfig = (config: Partial<SettingsState['general']>) => {
  if (config.maxPlanIterations && config.maxPlanIterations < 1) {
    throw new Error('maxPlanIterations must be >= 1');
  }
  // 其他验证逻辑...
};
```

#### 3. 配置迁移
```typescript
// 版本升级时的配置迁移
const migrateConfig = (oldConfig: any, version: string) => {
  switch (version) {
    case 'v1.0':
      // 迁移逻辑
      break;
    default:
      return oldConfig;
  }
};
```

### 用户指南

#### 1. 推荐配置组合

**学术研究**：
- 报告风格：学术报告
- 推理模式：开启
- 调研模式：开启
- 自动接受计划：关闭 (需要仔细审核计划)

**快速资讯**：
- 报告风格：新闻资讯
- 推理模式：关闭
- 调研模式：开启
- 自动接受计划：开启 (快速获得结果)

**科普写作**：
- 报告风格：科普解读
- 推理模式：开启
- 调研模式：开启
- 自动接受计划：关闭 (需要调整计划)

#### 2. 性能优化建议
- **快速模式**：关闭推理模式，减少搜索结果数量
- **深度模式**：开启推理模式，增加计划迭代次数
- **平衡模式**：使用默认配置，适合大多数场景

## 🔍 故障排除

### 常见问题

#### 1. 配置不生效
- **检查存储**：确认配置已保存到localStorage
- **清除缓存**：清除浏览器缓存重新加载
- **检查传递**：使用开发者工具检查API请求中的配置

#### 2. 配置重置
- **备份配置**：定期导出配置作为备份
- **版本冲突**：检查是否因为版本升级导致配置格式变化
- **存储限制**：检查localStorage是否达到存储限制

#### 3. 性能问题
- **配置优化**：调整数值配置以平衡性能和质量
- **模型选择**：根据需求选择合适的模型配置
- **缓存清理**：定期清理无用的配置缓存

---

## 📚 相关文档

- [API接口文档](./api-documentation.md)
- [前端架构设计](./frontend-architecture.md)
- [后端服务架构](./backend-architecture.md)
- [数据库设计文档](./database-schema.md)

---

*最后更新：2025年1月* 