# YADRA整体设计风格规范

## 🎨 总体设计理念

YADRA平台采用**现代简约、专业高效**的设计理念，以**干净的灰白色系**为主体，创造出专注于内容、注重可读性的研究环境。

### 核心设计原则

1. **📖 内容至上**：界面设计服务于内容展示，避免视觉干扰
2. **🔍 清晰可读**：高对比度文字，确保长时间阅读舒适
3. **⚡ 高效交互**：直观的操作逻辑，最少的点击步骤
4. **🎯 专业感**：简洁现代的外观，适合专业研究场景
5. **📱 响应友好**：统一的视觉层次，良好的多设备适配

---

## 🎨 配色系统

### 主配色规范

| 用途 | 颜色值 | CSS变量 | 应用场景 |
|-----|--------|---------|----------|
| **页面背景** | `#f9fafb` | `--app-background` | 全局页面背景 |
| **卡片背景** | `#ffffff` | `--background` | 卡片、面板、弹窗 |
| **主要文字** | `#111827` | `--foreground` | 标题、重要内容 |
| **辅助文字** | `#6b7280` | `--muted-foreground` | 描述、次要信息 |
| **浅色文字** | `#9ca3af` | `--gray-400` | 占位符、禁用状态 |

### 功能色彩

| 功能 | 颜色值 | 应用场景 |
|-----|--------|----------|
| **品牌蓝** | `#3b82f6` | 按钮、链接、选中状态 |
| **成功绿** | `#10b981` | 成功提示、完成状态 |
| **警告橙** | `#f59e0b` | 警告信息、等待状态 |
| **错误红** | `#ef4444` | 错误提示、删除操作 |
| **紫色强调** | `#8b5cf6` | 特殊功能、推理模式 |

### 边框和分割

| 用途 | 颜色值 | 应用场景 |
|-----|--------|----------|
| **主边框** | `#e5e7eb` | 卡片边框、输入框边框 |
| **浅边框** | `#f3f4f6` | 内部分割线 |
| **深边框** | `#d1d5db` | 强调边框 |

---

## 📐 布局规范

### 间距系统

```css
/* 基础间距单位 */
--spacing-1: 4px   /* 微间距 */
--spacing-2: 8px   /* 小间距 */
--spacing-3: 12px  /* 常规间距 */
--spacing-4: 16px  /* 标准间距 */
--spacing-6: 24px  /* 大间距 */
--spacing-8: 32px  /* 特大间距 */
```

### 圆角规范

```css
/* 圆角规范 */
--radius-sm: 4px   /* 小元素 */
--radius-md: 6px   /* 按钮、徽章 */
--radius-lg: 8px   /* 卡片、面板 */
--radius-xl: 12px  /* 大型容器 */
```

### 阴影系统

```css
/* 阴影层次 */
--shadow-sm: 0 1px 2px 0 rgb(0 0 0 / 0.05)           /* 微阴影 */
--shadow: 0 1px 3px 0 rgb(0 0 0 / 0.1)              /* 基础阴影 */
--shadow-md: 0 4px 6px -1px rgb(0 0 0 / 0.1)        /* 中等阴影 */
--shadow-lg: 0 10px 15px -3px rgb(0 0 0 / 0.1)      /* 大阴影 */
--shadow-xl: 0 20px 25px -5px rgb(0 0 0 / 0.1)      /* 特大阴影 */
```

---

## 🔤 字体规范

### 字体系统

```css
/* 主字体栈 */
font-family: 
  var(--font-geist-sans), 
  ui-sans-serif, 
  system-ui, 
  sans-serif,
  "Apple Color Emoji", 
  "Segoe UI Emoji", 
  "Segoe UI Symbol", 
  "Noto Color Emoji";
```

### 字体大小层次

| 级别 | 尺寸 | line-height | 用途 |
|-----|------|-------------|------|
| `text-xs` | 12px | 16px | 辅助信息、标签 |
| `text-sm` | 14px | 20px | 正文、描述 |
| `text-base` | 16px | 24px | 主要内容 |
| `text-lg` | 18px | 28px | 小标题 |
| `text-xl` | 20px | 28px | 中标题 |
| `text-2xl` | 24px | 32px | 大标题 |
| `text-4xl` | 36px | 40px | 主页标题 |

### 字重规范

- **Light (300)**: 装饰性文字
- **Normal (400)**: 正文内容
- **Medium (500)**: 重要信息
- **Semibold (600)**: 小标题
- **Bold (700)**: 主标题

---

## 🧩 组件设计规范

### 按钮系统

#### 主要按钮 (Primary)
```css
background: #3b82f6
color: #ffffff
border: 1px solid #3b82f6
hover:background: #2563eb
```

#### 次要按钮 (Secondary)
```css
background: #f3f4f6
color: #374151
border: 1px solid #e5e7eb
hover:background: #e5e7eb
```

#### 轮廓按钮 (Outline)
```css
background: transparent
color: #374151
border: 1px solid #e5e7eb
hover:background: #f9fafb
```

#### 幽灵按钮 (Ghost)
```css
background: transparent
color: #6b7280
border: none
hover:background: #f3f4f6
```

### 输入框规范

```css
/* 基础输入框 */
background: #ffffff
border: 1px solid #e5e7eb
color: #111827
placeholder-color: #6b7280
focus:border-color: #3b82f6
focus:ring: 2px #3b82f6/20
```

### 卡片设计

```css
/* 标准卡片 */
background: #ffffff
border: 1px solid #e5e7eb
border-radius: 8px
padding: 16px
box-shadow: 0 1px 3px 0 rgb(0 0 0 / 0.1)
```

---

## 🎭 交互状态规范

### 悬停效果 (Hover)

- **按钮**: 颜色加深10%，添加轻微阴影
- **卡片**: 边框颜色变深，阴影增强
- **链接**: 下划线出现，颜色变深

### 激活状态 (Active)

- **按钮**: 轻微缩放 `scale(0.98)`
- **输入框**: 蓝色边框 + 蓝色光晕
- **选中项**: 蓝色背景 + 白色文字

### 禁用状态 (Disabled)

- **透明度**: `opacity: 0.5`
- **光标**: `cursor: not-allowed`
- **颜色**: 统一使用灰色调

### 加载状态 (Loading)

- **旋转动画**: `animate-spin`
- **脉冲效果**: `animate-pulse`
- **进度指示**: 蓝色进度条

---

## 📱 响应式设计

### 断点系统

```css
/* 屏幕断点 */
sm: 640px   /* 小屏设备 */
md: 768px   /* 中屏设备 */
lg: 1024px  /* 大屏设备 */
xl: 1280px  /* 超大屏设备 */
2xl: 1536px /* 2K屏设备 */
```

### 适配原则

1. **移动优先**: 从小屏开始设计，向上扩展
2. **关键内容**: 确保核心功能在所有设备上可用
3. **触摸友好**: 按钮最小44px，合适的间距
4. **文字可读**: 移动端最小16px字体

---

## 🔧 技术实现规范

### CSS变量使用

所有颜色必须使用CSS变量，不允许硬编码：

```css
/* ✅ 正确 */
color: var(--foreground)
background: var(--background)

/* ❌ 错误 */
color: #111827
background: #ffffff
```

### Tailwind类命名

优先使用语义化的类名：

```css
/* ✅ 推荐 */
text-gray-900        /* 主要文字 */
text-gray-600        /* 次要文字 */
bg-white            /* 白色背景 */
border-gray-200     /* 浅灰边框 */

/* ❌ 避免 */
text-slate-800
bg-zinc-50
```

### 组件封装原则

1. **单一职责**: 每个组件只负责一个功能
2. **可复用性**: 通过props控制样式变化
3. **一致性**: 相同功能的组件使用相同的设计模式
4. **可维护性**: 样式集中管理，便于修改

---

## 📚 最佳实践

### 1. 设计一致性

- **统一间距**: 使用标准间距系统
- **统一圆角**: 相同类型组件使用相同圆角
- **统一颜色**: 相同功能使用相同配色
- **统一字体**: 相同层级使用相同字体规格

### 2. 可访问性

- **对比度**: 文字与背景对比度不低于4.5:1
- **焦点指示**: 键盘导航时显示清晰焦点
- **语义化**: 使用正确的HTML语义标签
- **alt文本**: 图片提供描述性替代文本

### 3. 性能优化

- **渐进增强**: 基础功能优先，增强功能后加载
- **懒加载**: 非首屏内容延迟加载
- **图片优化**: 使用WebP格式，适当压缩
- **CSS精简**: 移除未使用的样式

### 4. 维护性

- **模块化**: 组件独立，避免全局样式污染
- **文档化**: 重要组件提供使用说明
- **版本控制**: 样式变更记录在案
- **测试覆盖**: 关键组件提供视觉回归测试

---

## 🎯 具体应用指南

### 首页设计

- **背景**: 灰白渐变 `from-gray-50 via-white to-gray-50`
- **主标题**: `text-4xl font-bold text-gray-900`
- **副标题**: `text-xl text-gray-600`
- **按钮**: 蓝色主按钮配白色轮廓按钮

### 工作区设计

- **侧边栏**: 白色背景，256px宽度
- **主内容**: 灰白背景，白色面板
- **输入框**: 白色背景，灰色边框，蓝色焦点

### 输出流设计

- **卡片样式**: 白色背景，浅灰边框
- **状态徽章**: 角色颜色区分，事件类型标识
- **实时指示**: 蓝色脉冲动画

### 对话界面

- **消息气泡**: 用户消息右对齐，AI消息左对齐
- **头像设计**: 圆形背景，图标居中
- **时间戳**: 小号灰色文字

---

## 🚀 未来拓展

### 深色模式支持

预留深色模式变量：

```css
.dark {
  --app-background: #0f172a;
  --background: #1e293b;
  --foreground: #f1f5f9;
  /* ... 其他深色变量 */
}
```

### 主题定制

支持用户自定义主题色：

```css
.theme-blue {
  --primary: #3b82f6;
}
.theme-green {
  --primary: #10b981;
}
```

### 无障碍增强

- **高对比度模式**
- **大字体模式**
- **键盘导航优化**
- **屏幕阅读器支持**

---

## 📖 参考资源

### 设计参考

- [Tailwind CSS](https://tailwindcss.com/) - 原子化CSS框架
- [Radix UI](https://www.radix-ui.com/) - 无样式组件库
- [Lucide Icons](https://lucide.dev/) - 图标系统
- [Inter Font](https://rsms.me/inter/) - 现代字体设计

### 工具推荐

- [Figma](https://figma.com) - 设计原型工具
- [Coolors](https://coolors.co) - 配色方案生成
- [WebAIM](https://webaim.org/resources/contrastchecker/) - 对比度检查
- [Can I Use](https://caniuse.com) - 浏览器兼容性查询

---

**最后更新**: 2025年1月 | **版本**: v1.0.0 | **维护者**: YADRA团队 