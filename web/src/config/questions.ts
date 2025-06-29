// Copyright (c) 2025 YADRA

/**
 * 示例问题配置 - 前端专用
 * 
 * 📋 管理策略 (已更新)：
 * - 前端独立管理：此文件是示例问题的唯一数据源
 * - 后端简化：命令行用户为专业用户，不需要示例问题引导
 * - 用途明确：专门用于Web界面的新用户引导和快速开始
 * 
 * 🎯 使用场景：
 * - 首页示例问题网格展示
 * - 新用户引导和快速开始
 * - 展示系统研究能力范围
 * 
 * 🔧 维护方式：
 * - 直接在此文件中添加/修改问题
 * - 无需与后端同步
 * - 可根据用户反馈和使用情况调整
 */

// 英文示例问题 (与 src/config/questions.py BUILT_IN_QUESTIONS 同步)
export const BUILT_IN_QUESTIONS_EN = [
  "What factors are influencing AI adoption in healthcare?",
  "How does quantum computing impact cryptography?",
  "What are the latest developments in renewable energy technology?",
  "How is climate change affecting global agriculture?",
  "What are the ethical implications of artificial intelligence?",
  "What are the current trends in cybersecurity?",
  "How is blockchain technology being used outside of cryptocurrency?",
  "What advances have been made in natural language processing?",
  "How is machine learning transforming the financial industry?",
  "What are the environmental impacts of electric vehicles?",
];

// 中文示例问题 (与 src/config/questions.py BUILT_IN_QUESTIONS_ZH_CN 同步)
export const BUILT_IN_QUESTIONS_ZH_CN = [
  "人工智能在医疗保健领域的应用有哪些因素影响?",
  "量子计算如何影响密码学?",
  "可再生能源技术的最新发展是什么?",
  "气候变化如何影响全球农业?",
  "人工智能的伦理影响是什么?",
  "网络安全的当前趋势是什么?",
  "区块链技术在加密货币之外如何应用?",
  "自然语言处理领域有哪些进展?",
  "机器学习如何改变金融行业?",
  "电动汽车对环境有什么影响?",
];

// 前端专用的扩展问题 (更适合Web界面展示的问题)
export const FRONTEND_EXTENDED_QUESTIONS = [
  "过去5年西伯利亚的人口变化趋势如何？",
  "生物技术在疾病治疗中的创新应用？",
  "5G技术对物联网发展的推动作用？",
  "新能源汽车产业链的发展现状？",
];

// 默认使用中文问题（适合中文用户）
// 结合后端同步问题和前端扩展问题
export const DEFAULT_QUESTIONS = [
  ...BUILT_IN_QUESTIONS_ZH_CN.slice(0, 4), // 取前4个后端问题
  ...FRONTEND_EXTENDED_QUESTIONS.slice(0, 2), // 取前2个前端扩展问题
];

// 问题分类（可用于未来的分类展示）
export const QUESTION_CATEGORIES = {
  TECHNOLOGY: "技术",
  ENVIRONMENT: "环境", 
  HEALTHCARE: "医疗",
  FINANCE: "金融",
  SOCIETY: "社会",
} as const;

// 带分类的问题配置（可用于未来扩展）
export const CATEGORIZED_QUESTIONS = [
  { question: "人工智能在医疗保健领域的应用有哪些因素影响?", category: QUESTION_CATEGORIES.HEALTHCARE },
  { question: "可再生能源技术的最新发展是什么?", category: QUESTION_CATEGORIES.ENVIRONMENT },
  { question: "区块链技术在加密货币之外如何应用?", category: QUESTION_CATEGORIES.FINANCE },
  { question: "量子计算如何影响密码学?", category: QUESTION_CATEGORIES.TECHNOLOGY },
  { question: "气候变化如何影响全球农业?", category: QUESTION_CATEGORIES.ENVIRONMENT },
  { question: "机器学习如何改变金融行业?", category: QUESTION_CATEGORIES.FINANCE },
];

// 工具函数：获取指定数量的随机问题
export function getRandomQuestions(count = 6): string[] {
  const shuffled = [...DEFAULT_QUESTIONS].sort(() => 0.5 - Math.random());
  return shuffled.slice(0, count);
}

// 工具函数：按分类获取问题
export function getQuestionsByCategory(category: keyof typeof QUESTION_CATEGORIES): string[] {
  return CATEGORIZED_QUESTIONS
    .filter(q => q.category === QUESTION_CATEGORIES[category])
    .map(q => q.question);
} 