// Copyright (c) 2025 YADRA

/**
 * 统一研究流式接口类型定义
 * 
 * 定义POST /api/research/stream接口的完整类型系统
 */

import type { Resource } from '../messages';

// ========== 请求类型定义 ==========

export type ResearchAction = 'create' | 'continue' | 'feedback' | 'modify';

export interface ResearchConfig {
  // 研究配置（基于项目实际设置）
  enableBackgroundInvestigation: boolean;
  reportStyle: 'academic' | 'popular_science' | 'news' | 'social_media';
  enableDeepThinking: boolean;
  maxPlanIterations: number;
  maxStepNum: number;
  maxSearchResults: number;
  
  // 模型配置（暂时保留，实际使用项目现有的模型配置）
  modelName?: string;
  temperature?: number;
  maxTokens?: number;
  topP?: number;
  
  // 输出配置
  outputFormat?: 'markdown' | 'html' | 'plain';
  includeCitations?: boolean;
  includeArtifacts?: boolean;
  
  // 用户偏好
  userPreferences?: {
    writingStyle?: string;
    expertiseLevel?: 'beginner' | 'intermediate' | 'expert';
    preferredSources?: string[];
  };
}

export interface ResearchContext {
  previousArtifacts?: string[];
  relatedContext?: string;
  userFeedbackHistory?: string[];
}

export interface ResearchStreamRequest {
  // 操作类型
  action: ResearchAction;
  
  // 消息内容
  message: string;
  
  // 会话标识（create时为空，其他操作时必填）
  urlParam?: string;
  
  // 前端ID体系
  frontendUuid: string;         // 会话级UUID（create时生成，后续保持不变）
  frontendContextUuid: string;  // 交互级UUID（每次操作都生成新的）
  visitorId: string;            // 访客ID
  userId?: string;              // 用户ID
  
  // 完整配置信息
  config: ResearchConfig;
  
  // 上下文信息（继续对话时使用）
  context?: ResearchContext;
  
  // 资源信息
  resources?: Resource[];
}

// ========== 响应类型定义 ==========

export type SSEEventType = 
  | 'navigation'
  | 'metadata' 
  | 'progress'
  | 'message_chunk'
  | 'artifact'
  | 'complete'
  | 'error';

// 导航信息（仅create操作返回）
export interface NavigationEvent {
  urlParam: string;
  threadId: string;
  workspaceUrl: string;
}

// 执行元数据
export interface MetadataEvent {
  executionId: string;
  configUsed: ResearchConfig;
  modelInfo: {
    modelName: string;
    provider: string;
    version: string;
  };
  estimatedDuration: number;
  startTime: string;
}

// 进度更新
export interface ProgressEvent {
  currentStep: string;
  progressPercentage: number;
  statusMessage: string;
  stepsCompleted: string[];
  stepsRemaining: string[];
}

// 消息内容流
export interface MessageChunkEvent {
  chunkId: string;
  content: string;
  chunkType: 'planning' | 'research' | 'analysis' | 'conclusion';
  metadata: {
    source: string;
    confidence?: number;
  };
}

// 生成的artifacts
export interface ArtifactEvent {
  artifactId: string;
  type: 'research_plan' | 'data_table' | 'chart' | 'summary' | 'code' | 'document';
  title: string;
  content: string;
  metadata: {
    createdAt: string;
    sourceAgent: string;
  };
}

// 执行完成
export interface CompleteEvent {
  executionId: string;
  totalDuration: number;
  tokensConsumed: {
    inputTokens: number;
    outputTokens: number;
    totalCost: number;
  };
  artifactsGenerated: string[];
  finalStatus: 'success' | 'partial' | 'failed';
  completionTime: string;
}

// 错误信息
export interface ErrorEvent {
  errorCode: string;
  errorMessage: string;
  retryAfter?: number;
  suggestions?: string[];
}

// SSE事件联合类型
export type SSEEventData = 
  | NavigationEvent
  | MetadataEvent
  | ProgressEvent
  | MessageChunkEvent
  | ArtifactEvent
  | CompleteEvent
  | ErrorEvent;

export interface SSEEvent {
  type: SSEEventType;
  data: SSEEventData;
}

// ========== 工作区状态接口类型 ==========

export interface WorkspaceState {
  // 基础信息
  threadId: string;
  urlParam: string;
  status: 'active' | 'completed' | 'error' | 'paused';
  
  // 会话元数据
  sessionMetadata: {
    createdAt: string;
    lastUpdated: string;
    totalInteractions: number;
    executionHistory: ExecutionSummary[];
  };
  
  // 消息历史
  messages: {
    id: string;
    content: string;
    role: 'user' | 'assistant';
    timestamp: string;
    metadata: {
      frontendContextUuid: string;
      interactionType: string;
      modelUsed: string;
    };
  }[];
  
  // 生成的artifacts
  artifacts: {
    id: string;
    type: string;
    title: string;
    content: string;
    createdAt: string;
    metadata: object;
  }[];
  
  // 配置信息
  config: {
    currentConfig: ResearchConfig;
    configHistory: ResearchConfig[];
  };
  
  // 执行统计
  executionStats: {
    totalTokensUsed: number;
    totalCost: number;
    averageResponseTime: number;
    modelUsageBreakdown: object;
  };
  
  // 权限信息
  permissions: {
    canModify: boolean;
    canShare: boolean;
    canExport: boolean;
    canDelete: boolean;
  };
}

export interface ExecutionSummary {
  executionId: string;
  action: ResearchAction;
  startTime: string;
  duration: number;
  status: 'completed' | 'failed' | 'cancelled';
  tokensUsed: number;
} 