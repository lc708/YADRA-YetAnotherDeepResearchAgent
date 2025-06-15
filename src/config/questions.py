# Copyright (c) 2025 YADRA

"""
Built-in questions configuration for YADRA.

📋 管理策略更新：
- 示例问题已迁移到前端专用配置 (web/src/config/questions.ts)
- 命令行用户为专业用户，不需要示例问题引导
- 此文件保留用于未来可能的扩展需求

🔄 历史记录：
- 原本用于命令行交互模式的示例问题选择
- 已简化命令行体验，移除示例问题选择步骤
"""

# 注意：示例问题已迁移到前端配置
# 如果未来需要在后端使用示例问题，可以通过API从前端获取
# 或者重新在此处定义

# 保留空的配置以避免导入错误
BUILT_IN_QUESTIONS = []
BUILT_IN_QUESTIONS_ZH_CN = []
