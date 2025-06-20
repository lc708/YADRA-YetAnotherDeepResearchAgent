// Copyright (c) 2025 YADRA

/**
 * Enhanced Research Card Types - 通用化Langgraph适配
 * 🎯 设计原则：动态适配后端实际节点，避免硬编码维护
 */

// ===== 通用化节点系统 =====

/**
 * 通用节点类型 - 基于后端实际SSE事件动态推断
 * 不再硬编码具体节点类型，而是基于功能分类
 */
export type NodeCategory = 
  | "coordination"    // 协调类：coordinator
  | "investigation"   // 调研类：background_investigator  
  | "planning"        // 规划类：planner
  | "execution"       // 执行类：researcher, coder
  | "reporting"       // 报告类：reporter
  | "interaction"     // 交互类：human_feedback, reask
  | "unknown";        // 未知类型，兜底处理

/**
 * 动态节点信息 - 从后端SSE事件中提取
 */
export interface DynamicNodeInfo {
  id: string;                    // 节点唯一标识
  name: string;                  // 后端实际节点名称 (coordinator, planner等)
  category: NodeCategory;        // 推断的功能分类
  displayName: string;           // 前端显示名称
  description?: string;          // 节点描述
  icon?: string;                 // 图标名称
  status: NodeStatus;            // 执行状态
  startTime?: Date;             // 开始时间
  endTime?: Date;               // 结束时间
  duration?: number;            // 执行时长(ms)
  progress?: number;            // 进度百分比
  metadata?: Record<string, any>; // 扩展元数据
}

/**
 * 节点状态 - 基于SSE事件动态更新
 */
export type NodeStatus = 
  | "pending"      // 等待执行
  | "running"      // 正在执行  
  | "completed"    // 执行完成
  | "failed"       // 执行失败
  | "skipped";     // 跳过执行

/**
 * 动作类型 - 基于SSE事件内容推断
 */
export type ActionCategory =
  | "searching"     // 搜索相关
  | "analyzing"     // 分析相关
  | "generating"    // 生成相关
  | "processing"    // 处理相关
  | "validating"    // 验证相关
  | "communicating" // 通信相关
  | "unknown";      // 未知动作

/**
 * 动态动作信息
 */
export interface DynamicActionInfo {
  id: string;
  type: ActionCategory;
  title: string;
  description?: string;
  status: NodeStatus;
  outputs?: DynamicOutput[];
  startTime: Date;
  endTime?: Date;
  metadata?: Record<string, any>;
}

/**
 * 输出类型 - 基于实际内容动态识别
 */
export type OutputCategory =
  | "text"       // 文本内容
  | "url"        // URL链接
  | "image"      // 图片
  | "data"       // 结构化数据
  | "file"       // 文件
  | "code"       // 代码
  | "artifact";  // Artifact

/**
 * 动态输出信息
 */
export interface DynamicOutput {
  id: string;
  type: OutputCategory;
  title: string;
  content: any;
  format?: string;
  size?: number;
  metadata?: Record<string, any>;
  createdAt: Date;
}

// ===== 适配器系统 =====

/**
 * 节点分类器 - 将后端节点名称映射到功能分类
 */
export interface NodeCategorizer {
  categorize(nodeName: string): NodeCategory;
  getDisplayName(nodeName: string): string;
  getDescription(nodeName: string): string;
  getIcon(nodeName: string): string;
}

/**
 * 内容分析器 - 从SSE事件内容中提取动作和输出
 */
export interface ContentAnalyzer {
  extractActions(content: string, nodeName: string): DynamicActionInfo[];
  extractOutputs(content: string): DynamicOutput[];
  inferActionType(content: string, nodeName: string): ActionCategory;
}

// ===== 组件接口 =====

/**
 * 增强研究数据 - 完全基于SSE事件动态构建
 */
export interface EnhancedResearchData {
  id: string;
  title: string;
  status: NodeStatus;
  nodes: DynamicNodeInfo[];           // 动态节点列表
  currentNodeId?: string;             // 当前执行节点
  startTime: Date;
  endTime?: Date;
  totalDuration?: number;
  progress: number;                   // 整体进度
  metadata?: Record<string, any>;
}

/**
 * SSE事件适配器 - 将后端SSE事件转换为前端数据结构
 */
export interface SSEEventAdapter {
  // 节点事件处理
  handleNodeStart(event: any): Partial<DynamicNodeInfo>;
  handleNodeComplete(event: any): Partial<DynamicNodeInfo>;
  
  // 内容事件处理  
  handleMessageChunk(event: any): DynamicActionInfo[];
  handleSearchResults(event: any): DynamicOutput[];
  handleArtifact(event: any): DynamicOutput;
  
  // 进度事件处理
  handleProgress(event: any): { progress: number; currentNode: string };
}

// ===== 配置系统 =====

/**
 * 适配配置 - 可配置的节点映射和显示规则
 */
export interface AdaptationConfig {
  // 节点映射配置
  nodeMapping: Record<string, {
    category: NodeCategory;
    displayName: string;
    description: string;
    icon: string;
  }>;
  
  // 动作推断规则
  actionRules: Array<{
    pattern: RegExp;
    category: ActionCategory;
    title: string;
  }>;
  
  // 输出识别规则
  outputRules: Array<{
    pattern: RegExp;
    type: OutputCategory;
    extractor: (content: string) => any;
  }>;
  
  // 显示配置
  display: {
    showProgress: boolean;
    showTimestamps: boolean;
    expandByDefault: boolean;
    maxOutputsPerAction: number;
  };
}

// ===== 默认实现接口 =====

/**
 * 默认适配器实现
 */
export interface DefaultAdapters {
  categorizer: NodeCategorizer;
  analyzer: ContentAnalyzer;
  sseAdapter: SSEEventAdapter;
  config: AdaptationConfig;
}

// 注意：类型已经在上面使用 export 关键字直接导出
// 这里不需要重复导出，避免冲突

// 研究事件类型
export interface ResearchEvent {
  id: string;
  type: "node_started" | "node_completed" | "step_started" | "step_completed" | "action_started" | "action_completed" | "output_generated";
  timestamp: Date;
  nodeId?: string;
  stepId?: string;
  actionId?: string;
  data?: any;
}

// 研究配置
export interface ResearchConfig {
  autoExpand: boolean;
  showTimestamps: boolean;
  showProgress: boolean;
  maxVisibleOutputs: number;
  refreshInterval: number; // ms
}

// 研究统计
export interface ResearchStats {
  totalNodes: number;
  completedNodes: number;
  totalSteps: number;
  completedSteps: number;
  totalActions: number;
  completedActions: number;
  totalOutputs: number;
  duration: number; // seconds
  estimatedRemaining?: number; // seconds
}

// 实时更新数据
export interface ResearchUpdate {
  researchId: string;
  type: "progress" | "node_update" | "step_update" | "action_update" | "output_added" | "completed";
  data: any;
  timestamp: Date;
} 