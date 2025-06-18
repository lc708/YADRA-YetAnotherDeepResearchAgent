// Copyright (c) 2025 YADRA

/**
 * Redesigned Components Types
 * 重新设计组件的统一类型定义
 */

// 基础组件类型
export type { StatusType } from "../conversation/status-badge";
export type { LoadingType } from "../conversation/loading-animation";
export type { ResearchData, ResearchAction as ResearchActivity } from "../research";
export type { ResearchPlan, PlanStep } from "../research/plan-card";
export type { Artifact, ArtifactType } from "../research/artifact-card";
export type { PodcastData, TranscriptSegment } from "../media/podcast-player";
export type { FeedbackData, FeedbackType } from "../feedback/feedback-system";

// 通用UI状态
export interface UIState {
  isLoading: boolean;
  isExpanded: boolean;
  isVisible: boolean;
  variant: "default" | "compact" | "detailed";
}

// 交互事件
export interface InteractionEvent {
  type: "click" | "hover" | "focus" | "scroll";
  target: string;
  timestamp: Date;
  metadata?: Record<string, any>;
} 