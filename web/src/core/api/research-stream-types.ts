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
  url_param?: string;
  
  // 前端ID体系
  frontend_uuid: string;         // 会话级UUID（create时生成，后续保持不变）
  frontend_context_uuid: string;  // 交互级UUID（每次操作都生成新的）
  visitor_id: string;            // 访客ID
  user_id?: string;              // 用户ID
  
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
  | 'node_start'
  | 'node_complete'
  | 'plan_generated'
  | 'search_results'
  | 'agent_output'
  | 'message_chunk'
  | 'artifact'
  | 'progress'
  | 'complete'
  | 'error';

// 导航信息（仅create操作返回）
export interface NavigationEvent {
  url_param: string;
  thread_id: string;
  workspace_url: string;
  frontend_uuid: string;
  frontend_context_uuid: string;
  timestamp: string;
}

// 执行元数据
export interface MetadataEvent {
  execution_id: string;
  thread_id: string;
  frontend_uuid: string;
  frontend_context_uuid: string;
  visitor_id: string;
  user_id?: string;
  config_used: object;
  model_info: {
    [key: string]: string;
  };
  estimated_duration: number;
  start_time: string;
  timestamp: string;
}

// 节点事件（开始/完成）
export interface NodeEvent {
  node_name: string;
  node_type: 'start' | 'complete';
  thread_id: string;
  execution_id: string;
  input_data?: object;
  output_data?: object;
  duration_ms?: number;
  timestamp: string;
}

// 计划生成事件
export interface PlanEvent {
  plan_data: object;
  plan_iterations: number;
  thread_id: string;
  execution_id: string;
  timestamp: string;
}

// 搜索结果事件
export interface SearchResultsEvent {
  query: string;
  results: Array<{
    url?: string;
    title?: string;
    content?: string;
    images?: string[];
    [key: string]: any;
  }>;
  source: string;
  thread_id: string;
  execution_id: string;
  timestamp: string;
}

// 代理输出事件
export interface AgentOutputEvent {
  agent_name: string;
  agent_type: string;
  content: string;
  metadata: object;
  thread_id: string;
  execution_id: string;
  timestamp: string;
}

// 进度更新
export interface ProgressEvent {
  current_node: string;
  completed_nodes: string[];
  remaining_nodes: string[];
  current_step_description: string;
  thread_id: string;
  execution_id: string;
  timestamp: string;
}

// 消息内容流
export interface MessageChunkEvent {
  chunk_id: string;
  content: string;
  chunk_type: 'planning' | 'research' | 'analysis' | 'conclusion';
  agent_name: string;
  sequence: number;
  is_final: boolean;
  metadata: object;
  thread_id: string;
  execution_id: string;
  timestamp: string;
}

// 生成的artifacts
export interface ArtifactEvent {
  artifact_id: string;
  type: 'research_plan' | 'data_table' | 'chart' | 'summary' | 'code' | 'document';
  title: string;
  content: string;
  format: 'markdown' | 'html' | 'json' | 'csv' | 'code';
  metadata: object;
  thread_id: string;
  execution_id: string;
  timestamp: string;
}

// 执行完成
export interface CompleteEvent {
  execution_id: string;
  thread_id: string;
  total_duration_ms: number;
  tokens_consumed: {
    [key: string]: number;
  };
  total_cost: number;
  artifacts_generated: string[];
  final_status: string;
  completion_time: string;
  summary: object;
  timestamp: string;
}

// 错误信息
export interface ErrorEvent {
  error_code: string;
  error_message: string;
  error_details: object;
  thread_id: string;
  execution_id: string;
  retry_after?: number;
  suggestions: string[];
  timestamp: string;
}

// SSE事件联合类型
export type SSEEventData = 
  | NavigationEvent
  | MetadataEvent
  | NodeEvent
  | PlanEvent
  | SearchResultsEvent
  | AgentOutputEvent
  | MessageChunkEvent
  | ArtifactEvent
  | ProgressEvent
  | CompleteEvent
  | ErrorEvent;

export interface SSEEvent {
  type: SSEEventType;
  data: SSEEventData;
}

// ========== 工作区状态接口类型 ==========

export interface WorkspaceState {
  // 基础信息
  thread_id: string;
  url_param: string;
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
      frontend_context_uuid: string;
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