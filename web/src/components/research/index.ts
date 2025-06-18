// Copyright (c) 2025 YADRA

/**
 * Research Components Index
 * 研究相关组件统一导出
 */

// 主要研究组件 (AdaptiveResearchCard 作为 ResearchCard 导出)
export { default as ResearchCard } from "./adaptive-research-card";
export { default as AdaptiveResearchCard } from "./adaptive-research-card";
export { default as PlanCard } from "./plan-card";
export { default as ArtifactCard } from "./artifact-card";



// 适配器导出
export {
  DefaultNodeCategorizer,
  DefaultContentAnalyzer,
  DefaultSSEEventAdapter,
  createDefaultAdapters,
  defaultAdaptationConfig
} from "./research-card-langgraph-adapter";

// 导出基础组件类型
export type { ResearchPlan, PlanStep } from "./plan-card";
export type { Artifact, ArtifactType } from "./artifact-card";
export type { AdaptiveResearchCardProps } from "./adaptive-research-card";

// 导出适配器类型系统
export type {
  // 核心分类类型
  NodeCategory,
  NodeStatus,
  ActionCategory,
  OutputCategory,
  
  // 动态数据结构
  DynamicNodeInfo,
  DynamicActionInfo,
  DynamicOutput,
  EnhancedResearchData,
  
  // 适配器接口
  NodeCategorizer,
  ContentAnalyzer,
  SSEEventAdapter,
  AdaptationConfig,
  DefaultAdapters
} from "./adaptive-research-types";

// 向后兼容的类型别名
export type {
  EnhancedResearchData as ResearchData,
  DynamicNodeInfo as NodeInfo,
  DynamicActionInfo as ActionInfo,
  DynamicActionInfo as ResearchAction,
  DynamicActionInfo as ResearchActivity,
  DynamicOutput as ResearchOutput
} from "./adaptive-research-types";

// 组件别名（向后兼容）
export { default as EnhancedResearchCard } from "./adaptive-research-card"; 