// Copyright (c) 2025 YADRA

/**
 * Langgraph 适配器实现 - ResearchCard核心适配层
 * 
 * 🎯 将后端SSE事件动态转换为前端组件数据结构
 * 🔄 解决硬编码问题，支持动态适配
 * 
 * 🔄 服务于替换目标：
 * - ~/components/yadra/research-card（旧版本）
 * - ~/app/chat/components/research-block（废弃版本）
 * 
 * 🎯 核心功能特性：
 * - 节点类型映射：后端节点（generalmanager、researcher等）→ 前端类别（coordination、execution等）
 * - 内容智能分析：根据描述文本自动推断动作类型
 * - SSE事件适配：将后端事件转换为前端可用的数据结构
 * - 输出类型识别：自动检测和分类各种输出物类型
 * - 配置驱动：支持自定义映射规则和扩展
 * - 国际化支持：提供中英文显示名称映射
 */

import type {
  NodeCategory,
  NodeStatus,
  ActionCategory,
  OutputCategory,
  DynamicNodeInfo,
  DynamicActionInfo,
  DynamicOutput,
  NodeCategorizer,
  ContentAnalyzer,
  SSEEventAdapter,
  AdaptationConfig,
  DefaultAdapters
} from "./adaptive-research-types";

// ===== 默认节点分类器 =====

export class DefaultNodeCategorizer implements NodeCategorizer {
  private readonly nodeMapping: Record<string, {
    category: NodeCategory;
    displayName: string;
    description: string;
    icon: string;
  }> = {
    // 协调类
    "generalmanager": {
      category: "coordination" as NodeCategory,
      displayName: "任务协调",
      description: "协调研究任务，分析用户需求",
      icon: "MessageSquareQuote"
    },
    
    // 调研类
    "background_investigator": {
      category: "investigation" as NodeCategory,
      displayName: "背景调研", 
      description: "进行背景信息搜集和初步调研",
      icon: "Search"
    },
    
    // 规划类
    "projectmanager": {
      category: "planning" as NodeCategory,
      displayName: "研究规划",
      description: "制定详细的研究计划和执行步骤",
      icon: "Brain"
    },
    
    // 执行类
    "researcher": {
      category: "execution" as NodeCategory,
      displayName: "深度研究",
      description: "执行深度研究，收集和分析信息",
      icon: "Microscope"
    },
    
    "coder": {
      category: "execution" as NodeCategory,
      displayName: "数据处理",
      description: "处理数据分析和代码执行任务",
      icon: "Code"
    },
    
    // 报告类
    "reporter": {
      category: "reporting" as NodeCategory,
      displayName: "报告生成",
      description: "生成最终研究报告",
      icon: "FileText"
    },
    
    // 交互类
    "human_feedback": {
      category: "interaction" as NodeCategory,
      displayName: "人工反馈",
      description: "等待用户反馈和确认",
      icon: "UserCheck"
    },
    
    "reask": {
      category: "interaction" as NodeCategory,
      displayName: "重新询问",
      description: "重新询问用户需求",
      icon: "MessageCircle"
    }
  };

  categorize(nodeName: string): NodeCategory {
    return this.nodeMapping[nodeName]?.category || "unknown";
  }

  getDisplayName(nodeName: string): string {
    return this.nodeMapping[nodeName]?.displayName || nodeName;
  }

  getDescription(nodeName: string): string {
    return this.nodeMapping[nodeName]?.description || `执行${nodeName}任务`;
  }

  getIcon(nodeName: string): string {
    return this.nodeMapping[nodeName]?.icon || "Circle";
  }
}

// ===== 默认内容分析器 =====

export class DefaultContentAnalyzer implements ContentAnalyzer {
  private readonly actionPatterns = [
    // 搜索相关
    { pattern: /搜索|search|查找|检索/i, category: "searching" as ActionCategory, title: "搜索信息" },
    { pattern: /tavily|google|bing/i, category: "searching" as ActionCategory, title: "网络搜索" },
    
    // 分析相关
    { pattern: /分析|analysis|analyze|研究|study/i, category: "analyzing" as ActionCategory, title: "分析处理" },
    { pattern: /评估|evaluate|assessment/i, category: "analyzing" as ActionCategory, title: "评估分析" },
    
    // 生成相关
    { pattern: /生成|generate|创建|create|写作|writing/i, category: "generating" as ActionCategory, title: "内容生成" },
    { pattern: /报告|report|总结|summary/i, category: "generating" as ActionCategory, title: "报告生成" },
    
    // 处理相关
    { pattern: /处理|process|执行|execute/i, category: "processing" as ActionCategory, title: "数据处理" },
    { pattern: /代码|code|python|javascript/i, category: "processing" as ActionCategory, title: "代码执行" },
    
    // 验证相关
    { pattern: /验证|validate|检查|check|确认|confirm/i, category: "validating" as ActionCategory, title: "验证检查" },
    
    // 通信相关
    { pattern: /反馈|feedback|询问|ask|回复|reply/i, category: "communicating" as ActionCategory, title: "交互通信" }
  ];

  private readonly outputPatterns = [
    // URL识别
    { pattern: /https?:\/\/[^\s]+/g, type: "url" as OutputCategory },
    
    // 图片识别
    { pattern: /\.(jpg|jpeg|png|gif|webp|svg)/i, type: "image" as OutputCategory },
    
    // 代码识别
    { pattern: /```[\s\S]*?```/g, type: "code" as OutputCategory },
    
    // 数据识别
    { pattern: /\{[\s\S]*?\}|\[[\s\S]*?\]/g, type: "data" as OutputCategory }
  ];

  extractActions(content: string, nodeName: string): DynamicActionInfo[] {
    const actions: DynamicActionInfo[] = [];
    const actionType = this.inferActionType(content, nodeName);
    
    // 基于内容长度和类型创建动作
    if (content.length > 50) {
      actions.push({
        id: `action_${Date.now()}`,
        type: actionType,
        title: this.getActionTitle(actionType, nodeName),
        description: content.substring(0, 100) + (content.length > 100 ? "..." : ""),
        status: "completed",
        outputs: this.extractOutputs(content),
        startTime: new Date(),
        endTime: new Date(),
        metadata: { nodeName, contentLength: content.length }
      });
    }
    
    return actions;
  }

  extractOutputs(content: string): DynamicOutput[] {
    const outputs: DynamicOutput[] = [];
    
    // 提取URLs
    const urls = content.match(/https?:\/\/[^\s]+/g) || [];
    urls.forEach((url, index) => {
      outputs.push({
        id: `url_${index}_${Date.now()}`,
        type: "url",
        title: this.extractDomainFromUrl(url),
        content: url,
        format: "link",
        createdAt: new Date(),
        metadata: { originalUrl: url }
      });
    });
    
    // 提取代码块
    const codeBlocks = content.match(/```[\s\S]*?```/g) || [];
    codeBlocks.forEach((code, index) => {
      const language = code.match(/```(\w+)/)?.[1] || "text";
      outputs.push({
        id: `code_${index}_${Date.now()}`,
        type: "code",
        title: `${language.toUpperCase()} 代码`,
        content: code.replace(/```\w*\n?|```$/g, ""),
        format: language,
        size: code.length,
        createdAt: new Date(),
        metadata: { language }
      });
    });
    
    // 如果没有特殊输出，但内容较长，创建文本输出
    if (outputs.length === 0 && content.length > 200) {
      outputs.push({
        id: `text_${Date.now()}`,
        type: "text",
        title: "分析结果",
        content: content,
        format: "markdown",
        size: content.length,
        createdAt: new Date(),
        metadata: { type: "analysis_result" }
      });
    }
    
    return outputs;
  }

  inferActionType(content: string, nodeName: string): ActionCategory {
    // 首先基于节点名称推断
    const nodeBasedType = this.getActionTypeByNode(nodeName);
    if (nodeBasedType !== "unknown") {
      return nodeBasedType;
    }
    
    // 然后基于内容模式匹配
    for (const pattern of this.actionPatterns) {
      if (pattern.pattern.test(content)) {
        return pattern.category;
      }
    }
    
    return "unknown";
  }

  private getActionTypeByNode(nodeName: string): ActionCategory {
    const mapping: Record<string, ActionCategory> = {
      "background_investigator": "searching",
      "projectmanager": "generating", 
      "researcher": "analyzing",
      "coder": "processing",
      "reporter": "generating",
      "human_feedback": "communicating",
      "reask": "communicating"
    };
    
    return mapping[nodeName] || "unknown";
  }

  private getActionTitle(actionType: ActionCategory, nodeName: string): string {
    const titles: Record<ActionCategory, string> = {
      "searching": "搜索信息",
      "analyzing": "分析数据", 
      "generating": "生成内容",
      "processing": "处理任务",
      "validating": "验证结果",
      "communicating": "交互通信",
      "unknown": "执行任务"
    };
    
    return titles[actionType];
  }

  private extractDomainFromUrl(url: string): string {
    try {
      const domain = new URL(url).hostname;
      return domain.replace(/^www\./, "");
    } catch {
      return "链接";
    }
  }
}

// ===== 默认SSE事件适配器 =====

export class DefaultSSEEventAdapter implements SSEEventAdapter {
  constructor(
    private categorizer: NodeCategorizer,
    private analyzer: ContentAnalyzer
  ) {}

  handleNodeStart(event: any): Partial<DynamicNodeInfo> {
    const nodeName = event.node_name || event.nodeName;
    return {
      id: `${nodeName}_${event.execution_id || Date.now()}`,
      name: nodeName,
      category: this.categorizer.categorize(nodeName),
      displayName: this.categorizer.getDisplayName(nodeName),
      description: this.categorizer.getDescription(nodeName),
      icon: this.categorizer.getIcon(nodeName),
      status: "running",
      startTime: new Date(event.timestamp || Date.now()),
      progress: 0,
      metadata: {
        executionId: event.execution_id,
        threadId: event.thread_id
      }
    };
  }

  handleNodeComplete(event: any): Partial<DynamicNodeInfo> {
    return {
      status: "completed",
      endTime: new Date(event.timestamp || Date.now()),
      progress: 100,
      duration: event.duration_ms
    };
  }

  handleMessageChunk(event: any): DynamicActionInfo[] {
    const content = event.content || "";
    const agentName = event.agent_name || "unknown";
    
    return this.analyzer.extractActions(content, agentName);
  }

  handleSearchResults(event: any): DynamicOutput[] {
    const results = event.results || [];
    const outputs: DynamicOutput[] = [];
    
    results.forEach((result: any, index: number) => {
      outputs.push({
        id: `search_${index}_${Date.now()}`,
        type: "url",
        title: result.title || "搜索结果",
        content: result.url || result.content,
        format: "search_result",
        createdAt: new Date(),
        metadata: {
          source: event.source,
          query: event.query,
          snippet: result.content?.substring(0, 200)
        }
      });
    });
    
    return outputs;
  }

  handleArtifact(event: any): DynamicOutput {
    return {
      id: event.artifact_id || `artifact_${Date.now()}`,
      type: this.mapArtifactType(event.type),
      title: event.title || "生成内容",
      content: event.content,
      format: event.format || "text",
      size: event.content?.length || 0,
      createdAt: new Date(event.timestamp || Date.now()),
      metadata: {
        artifactType: event.type,
        executionId: event.execution_id,
        threadId: event.thread_id
      }
    };
  }

  handleProgress(event: any): { progress: number; currentNode: string } {
    const completed = event.completed_nodes?.length || 0;
    const remaining = event.remaining_nodes?.length || 0;
    const total = completed + remaining + 1; // +1 for current node
    
    return {
      progress: Math.round((completed / total) * 100),
      currentNode: event.current_node
    };
  }

  private mapArtifactType(artifactType: string): OutputCategory {
    const mapping: Record<string, OutputCategory> = {
      "research_plan": "data",
      "data_table": "data", 
      "chart": "image",
      "summary": "text",
      "code": "code",
      "document": "file"
    };
    
    return mapping[artifactType] || "artifact";
  }
}

// ===== 默认配置 =====

export const defaultAdaptationConfig: AdaptationConfig = {
  nodeMapping: {
    "generalmanager": {
      category: "coordination",
      displayName: "任务协调",
      description: "协调研究任务，分析用户需求",
      icon: "MessageSquareQuote"
    },
    "background_investigator": {
      category: "investigation",
      displayName: "背景调研",
      description: "进行背景信息搜集和初步调研", 
      icon: "Search"
    },
    "projectmanager": {
      category: "planning",
      displayName: "研究规划",
      description: "制定详细的研究计划和执行步骤",
      icon: "Brain"
    },
    "researcher": {
      category: "execution", 
      displayName: "深度研究",
      description: "执行深度研究，收集和分析信息",
      icon: "Microscope"
    },
    "coder": {
      category: "execution",
      displayName: "数据处理", 
      description: "处理数据分析和代码执行任务",
      icon: "Code"
    },
    "reporter": {
      category: "reporting",
      displayName: "报告生成",
      description: "生成最终研究报告",
      icon: "FileText"
    },
    "human_feedback": {
      category: "interaction",
      displayName: "人工反馈",
      description: "等待用户反馈和确认", 
      icon: "UserCheck"
    },
    "reask": {
      category: "interaction",
      displayName: "重新询问",
      description: "重新询问用户需求",
      icon: "MessageCircle"
    }
  },
  
  actionRules: [
    { pattern: /搜索|search/i, category: "searching", title: "搜索信息" },
    { pattern: /分析|analysis/i, category: "analyzing", title: "分析处理" },
    { pattern: /生成|generate/i, category: "generating", title: "内容生成" },
    { pattern: /处理|process/i, category: "processing", title: "数据处理" },
    { pattern: /验证|validate/i, category: "validating", title: "验证检查" },
    { pattern: /反馈|feedback/i, category: "communicating", title: "交互通信" }
  ],
  
  outputRules: [
    { 
      pattern: /https?:\/\/[^\s]+/g, 
      type: "url",
      extractor: (content: string) => content.match(/https?:\/\/[^\s]+/g) || []
    },
    {
      pattern: /```[\s\S]*?```/g,
      type: "code", 
      extractor: (content: string) => content.match(/```[\s\S]*?```/g) || []
    }
  ],
  
  display: {
    showProgress: true,
    showTimestamps: true,
    expandByDefault: true,
    maxOutputsPerAction: 5
  }
};

// ===== 默认适配器集合 =====

export const createDefaultAdapters = (): DefaultAdapters => {
  const categorizer = new DefaultNodeCategorizer();
  const analyzer = new DefaultContentAnalyzer();
  const sseAdapter = new DefaultSSEEventAdapter(categorizer, analyzer);
  
  return {
    categorizer,
    analyzer,
    sseAdapter,
    config: defaultAdaptationConfig
  };
}; 