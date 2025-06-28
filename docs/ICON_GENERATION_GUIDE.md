# 🎨 YADRA 图标资源生成指南

## 📋 快速生成方案

### 🔥 **一键生成所有图标（推荐）**
**工具**: [RealFaviconGenerator](https://realfavicongenerator.net/)
1. 上传你的logo图片（最小260x260px）
2. 系统自动生成所有尺寸的favicon、app图标、社交媒体图片
3. 下载zip包，解压到`web/public/`目录

### 🎯 **社交媒体图片制作**
**工具**: [Canva](https://www.canva.com/)
- **模板搜索**: "og image", "twitter header", "social media banner"
- **尺寸设置**: 
  - Facebook/OG: 1200x630px
  - Twitter: 1200x600px
- **设计要素**: YADRA Logo + "智能深度研究AI助手" + 功能亮点

## 🎨 设计素材推荐

### **Logo设计灵感**
```
设计理念：
- 主色调：蓝色渐变 (#3b82f6 → #1d4ed8)
- 元素：Y字母 + 搜索/研究图标
- 风格：现代简洁、专业可信
```

### **免费资源库**
1. **图标**: [Heroicons](https://heroicons.com/) - 搜索"magnifying-glass", "academic-cap"
2. **字体**: [Google Fonts](https://fonts.google.com/) - Inter, Source Sans Pro
3. **配色**: [Coolors](https://coolors.co/) - 生成协调配色方案

## 📁 文件存放位置

所有图标文件应放在 `web/public/` 目录下：

```
web/public/
├── favicon.ico           # 网站图标 (16x16, 32x32, 48x48)
├── apple-touch-icon.png  # iOS图标 (180x180)
├── icon-192.png         # PWA图标 (192x192)
├── icon-512.png         # PWA图标 (512x512)
├── og-image.png         # 社交分享图 (1200x630)
├── twitter-image.png    # Twitter卡片图 (1200x600)
├── screenshot-wide.png  # PWA桌面截图 (1280x720)
└── screenshot-narrow.png # PWA移动截图 (750x1334)
```

## 🛠️ 具体操作步骤

### **第一步：准备基础Logo**
1. 访问 [Canva](https://www.canva.com/create/logos/)
2. 搜索"tech logo", "AI logo"模板
3. 制作512x512px的方形logo
4. 导出为PNG格式

### **第二步：生成Favicon**
1. 访问 [RealFaviconGenerator](https://realfavicongenerator.net/)
2. 上传第一步的logo
3. 按照提示配置各平台设置
4. 下载生成的图标包

### **第三步：制作社交媒体图片**
1. 访问 [Canva](https://www.canva.com/)
2. 选择"Facebook封面"模板 (1200x630)
3. 添加元素：
   - YADRA Logo
   - 标题：YADRA - 智能深度研究AI助手
   - 副标题：3分钟生成专业研究报告、小红书爆款文案
   - 背景：简洁的渐变或纯色
4. 导出为PNG格式

### **第四步：制作PWA截图**
1. 启动YADRA应用 (`./bootstrap.sh --dev`)
2. 使用浏览器开发者工具截图：
   - 桌面版：设置窗口为1280x720
   - 移动版：切换到手机视图，截图750x1334
3. 保存为PNG格式

## ⚡ 临时方案（立即可用）

如果需要快速上线，我已经为你准备了基础的SVG图标：

```svg
<!-- 临时Logo (web/public/favicon.svg) -->
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">
  <defs>
    <linearGradient id="grad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" style="stop-color:#3b82f6;stop-opacity:1" />
      <stop offset="100%" style="stop-color:#1d4ed8;stop-opacity:1" />
    </linearGradient>
  </defs>
  <rect width="100" height="100" rx="20" fill="url(#grad)"/>
  <text x="50" y="65" font-family="Arial, sans-serif" font-size="50" font-weight="bold" text-anchor="middle" fill="white">Y</text>
</svg>
```

使用这个SVG，你可以在任何在线转换工具中生成所需的PNG图标。

## 🎯 品牌一致性建议

### **颜色规范**
- 主色：`#3b82f6` (Blue 500)
- 辅色：`#1d4ed8` (Blue 700)  
- 文字：`#1e293b` (Slate 800)
- 背景：`#f8fafc` (Slate 50)

### **字体规范**
- 标题：Inter Bold
- 正文：Inter Regular
- 代码：JetBrains Mono

### **设计原则**
- 简洁专业：避免过多装饰元素
- 科技感：使用蓝色调和现代字体
- 可读性：确保在小尺寸下仍清晰可见
- 一致性：所有图标保持统一的设计风格

---

💡 **提示**: 如果需要帮助制作具体的图标，你可以向我提供详细需求，我将给出更具体的设计建议。 