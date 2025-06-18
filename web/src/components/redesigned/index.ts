// Copyright (c) 2025 YADRA

/**
 * Redesigned Components Index
 * 重新设计的组件库统一导出
 * 
 * 🎯 这是新组件库的入口文件
 * 📅 创建时间: 2025年1月
 * 🔄 替换计划: 逐步替换现有组件
 */

// 🗣️ 对话相关组件 (基础设施)
export {
  ScrollContainer,
  LoadingAnimation,
  StatusBadge,
  MarkdownRenderer,
  MessageContainer
} from "../conversation";

// 🔬 研究相关组件 (研究功能)
export {
  ResearchCard,
  PlanCard,
  ArtifactCard
} from "../research";

// 🎵 媒体相关组件 (媒体功能)
export {
  PodcastPlayer
} from "../media";

// 💬 反馈相关组件 (反馈功能)
export {
  FeedbackSystem
} from "../feedback";

// 📋 类型导出
export type {
  // 对话类型
  StatusType,
  LoadingType,
  
  // 研究类型
  ResearchData,
  ResearchActivity,
  ResearchPlan,
  PlanStep,
  Artifact,
  ArtifactType,
  
  // 媒体类型
  PodcastData,
  TranscriptSegment,
  
  // 反馈类型
  FeedbackData,
  FeedbackType,
  
  // 通用类型
  UIState,
  InteractionEvent
} from "./types";

/**
 * 组件替换映射表
 * 用于迁移时的参考
 */
export const COMPONENT_REPLACEMENT_MAP = {
  // 基础设施组件
  "~/components/yadra/scroll-container": "ScrollContainer",
  "~/components/yadra/loading-animation": "LoadingAnimation", 
  "~/components/yadra/typing-animation": "LoadingAnimation",
  "~/components/yadra/status-badge": "StatusBadge",
  "~/components/yadra/markdown-renderer": "MarkdownRenderer",
  "~/components/yadra/message-bubble": "MessageContainer",
  "~/app/chat/components/message-bubble": "MessageContainer",
  
  // 研究功能组件
  "~/components/yadra/research-card": "ResearchCard",
  "~/app/chat/components/research-block": "ResearchCard",
  "~/components/yadra/plan-card": "PlanCard",
  "~/app/chat/components/plan-card": "PlanCard",
  "~/components/yadra/artifact-card": "ArtifactCard",
  "~/components/yadra/artifact-viewer": "ArtifactCard",
  
  // 媒体功能组件
  "~/components/yadra/podcast-card": "PodcastPlayer",
  "~/components/yadra/podcast-player": "PodcastPlayer",
  
  // 反馈功能组件
  "~/components/yadra/feedback-system": "FeedbackSystem",
  "~/app/workspace/[traceId]/components/feedback-system": "FeedbackSystem"
} as const; 