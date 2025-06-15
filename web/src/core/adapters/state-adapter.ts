// Copyright (c) 2025 YADRA

import { nanoid } from "nanoid";

import type { Message } from "~/core/messages";
import type { Artifact, ArtifactType } from "~/lib/supa";

/**
 * 状态适配器 - 将Message状态转换为Artifact格式
 * 
 * 设计原则:
 * 1. 不可变转换 - 不修改原始Message对象
 * 2. 智能分类 - 根据agent类型自动判断artifact类型
 * 3. 内容优化 - 生成有意义的summary和node_name
 * 4. 实时同步 - 支持增量更新和状态同步
 */

// 默认用户ID (未来可以从session或auth获取)
const DEFAULT_USER_ID = "workspace-user";

/**
 * Agent类型到Artifact类型的映射
 */
const AGENT_TO_ARTIFACT_TYPE: Record<string, ArtifactType> = {
  // 过程类型 - 表示研究和处理过程
  coordinator: "process",
  planner: "process", 
  researcher: "process",
  coder: "process",
  
  // 结果类型 - 表示最终输出
  reporter: "result",
  podcast: "result",
};

/**
 * Agent类型到Node名称的映射
 */
const AGENT_TO_NODE_NAME: Record<string, string> = {
  coordinator: "研究协调",
  planner: "研究规划",
  researcher: "信息研究", 
  coder: "代码分析",
  reporter: "研究报告",
  podcast: "播客生成",
};

/**
 * 生成artifact的唯一ID
 */
function generateArtifactId(message: Message): string {
  // 使用message ID作为artifact ID，确保一对一映射
  return `artifact-${message.id}`;
}

/**
 * 根据消息内容生成摘要
 */
function generateSummary(message: Message): string | undefined {
  if (!message.content || message.content.trim() === "") {
    return undefined;
  }

  const content = message.content.trim();
  
  // 如果内容较短，直接使用
  if (content.length <= 100) {
    return content;
  }
  
  // 提取前100个字符作为摘要
  const summary = content.substring(0, 100).trim();
  
  // 如果摘要以句子结束，保持完整
  const lastPeriod = summary.lastIndexOf('。');
  const lastQuestion = summary.lastIndexOf('？');
  const lastExclamation = summary.lastIndexOf('！');
  
  const lastSentenceEnd = Math.max(lastPeriod, lastQuestion, lastExclamation);
  
  if (lastSentenceEnd > 50) {
    return summary.substring(0, lastSentenceEnd + 1);
  }
  
  return summary + "...";
}

/**
 * 生成节点名称
 */
function generateNodeName(message: Message): string {
  // 优先使用agent映射的名称
  if (message.agent && AGENT_TO_NODE_NAME[message.agent]) {
    return AGENT_TO_NODE_NAME[message.agent]!;
  }
  
  // 用户消息处理 - 根据source区分指令和查询
  if (message.role === "user") {
    if (message.source === "button") {
      return "用户指令";
    } else if (message.source === "input") {
      return "用户查询";
    }
    // 兼容旧数据，默认为查询
    return "用户查询";
  }
  
  // 工具消息处理
  if (message.role === "tool") {
    return "工具调用";
  }
  
  // 默认名称
  return "AI响应";
}

/**
 * 判断Message是否应该转换为Artifact
 */
function shouldConvertToArtifact(message: Message): boolean {
  // 跳过正在流式传输的消息
  if (message.isStreaming) {
    return false;
  }
  
  // 跳过空内容的消息
  if (!message.content || message.content.trim() === "") {
    return false;
  }
  
  // 跳过工具调用消息（通常是临时状态）
  if (message.role === "tool") {
    return false;
  }
  
  return true;
}

/**
 * 根据消息内容和agent类型判断MIME类型
 */
function determineMimeType(message: Message): string {
  const content = message.content?.toLowerCase() || "";
  const agent = message.agent;
  
  // 根据agent类型判断
  if (agent === "reporter") {
    return "text/markdown+report";
  }
  
  if (agent === "podcast") {
    return "audio/mpeg+podcast";
  }
  
  if (agent === "coder") {
    // 检查是否包含代码
    if (content.includes("```") || content.includes("function") || content.includes("class")) {
      return "text/plain+code";
    }
    return "text/markdown+analysis";
  }
  
  // 根据内容特征判断
  if (content.includes("# ") && content.includes("## ")) {
    // 包含标题结构，可能是报告
    if (content.includes("研究") || content.includes("分析") || content.includes("报告")) {
      return "text/markdown+report";
    }
    if (content.includes("摘要") || content.includes("总结")) {
      return "text/markdown+summary";
    }
    return "text/markdown+analysis";
  }
  
  // 默认markdown
  return "text/markdown";
}

/**
 * 生成artifact的元数据
 */
function generateMetadata(message: Message): Artifact["metadata"] {
  const content = message.content || "";
  
  return {
    word_count: content.length,
    language: "zh-CN", // 默认中文
    processing_status: "completed",
    source_message_id: message.id,
  };
}

/**
 * 将单个Message转换为Artifact
 */
export function messageToArtifact(
  message: Message, 
  traceId: string
): Artifact | null {
  if (!shouldConvertToArtifact(message)) {
    return null;
  }
  
  const artifactType: ArtifactType = message.agent 
    ? (AGENT_TO_ARTIFACT_TYPE[message.agent]!) || "process"
    : message.role === "user" ? "process" : "result";
  
  const artifact: Artifact = {
    id: generateArtifactId(message),
    trace_id: traceId,
    node_name: generateNodeName(message),
    type: artifactType,
    mime: determineMimeType(message),
    summary: generateSummary(message),
    payload_url: message.content, // 直接使用消息内容
    created_at: new Date().toISOString(),
    user_id: DEFAULT_USER_ID,
    metadata: generateMetadata(message),
  };
  
  return artifact;
}

/**
 * 批量转换Messages为Artifacts
 */
export function messagesToArtifacts(
  messages: Map<string, Message>,
  messageIds: string[],
  traceId: string
): Artifact[] {
  const artifacts: Artifact[] = [];
  
  for (const messageId of messageIds) {
    const message = messages.get(messageId);
    if (message) {
      const artifact = messageToArtifact(message, traceId);
      if (artifact) {
        artifacts.push(artifact);
      }
    }
  }
  
  // 按创建时间排序
  return artifacts.sort((a, b) => 
    new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
  );
}

/**
 * 从研究状态生成Artifacts
 */
export function researchToArtifacts(
  researchIds: string[],
  researchPlanIds: Map<string, string>,
  researchReportIds: Map<string, string>, 
  researchActivityIds: Map<string, string[]>,
  messages: Map<string, Message>,
  traceId: string
): Artifact[] {
  const artifacts: Artifact[] = [];
  
  for (const researchId of researchIds) {
    // 添加研究计划artifact
    const planId = researchPlanIds.get(researchId);
    if (planId) {
      const planMessage = messages.get(planId);
      if (planMessage) {
        const planArtifact = messageToArtifact(planMessage, traceId);
        if (planArtifact) {
          artifacts.push(planArtifact);
        }
      }
    }
    
    // 添加研究活动artifacts
    const activityIds = researchActivityIds.get(researchId) || [];
    for (const activityId of activityIds) {
      const activityMessage = messages.get(activityId);
      if (activityMessage) {
        const activityArtifact = messageToArtifact(activityMessage, traceId);
        if (activityArtifact) {
          artifacts.push(activityArtifact);
        }
      }
    }
    
    // 添加研究报告artifact
    const reportId = researchReportIds.get(researchId);
    if (reportId) {
      const reportMessage = messages.get(reportId);
      if (reportMessage) {
        const reportArtifact = messageToArtifact(reportMessage, traceId);
        if (reportArtifact) {
          artifacts.push(reportArtifact);
        }
      }
    }
  }
  
  // 按创建时间排序
  return artifacts.sort((a, b) => 
    new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
  );
}

/**
 * 工作空间状态适配器类
 * 提供统一的状态转换和管理接口
 */
export class WorkspaceStateAdapter {
  /**
   * 获取指定trace的所有artifacts
   */
  getArtifactsForTrace(
    messages: Map<string, Message>,
    messageIds: string[],
    researchIds: string[],
    researchPlanIds: Map<string, string>,
    researchReportIds: Map<string, string>,
    researchActivityIds: Map<string, string[]>,
    traceId: string
  ): Artifact[] {
    // 合并消息artifacts和研究artifacts
    const messageArtifacts = messagesToArtifacts(messages, messageIds, traceId);
    const researchArtifacts = researchToArtifacts(
      researchIds,
      researchPlanIds, 
      researchReportIds,
      researchActivityIds,
      messages,
      traceId
    );
    
    // 去重（基于ID）
    const artifactMap = new Map<string, Artifact>();
    
    [...messageArtifacts, ...researchArtifacts].forEach(artifact => {
      artifactMap.set(artifact.id, artifact);
    });
    
    return Array.from(artifactMap.values()).sort((a, b) => 
      new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
    );
  }
  
  /**
   * 检查消息是否已经有对应的artifact
   */
  hasArtifactForMessage(messageId: string, artifacts: Map<string, Artifact>): boolean {
    const artifactId = `artifact-${messageId}`;
    return artifacts.has(artifactId);
  }
  
  /**
   * 获取消息对应的artifact ID
   */
  getArtifactIdForMessage(messageId: string): string {
    return `artifact-${messageId}`;
  }
}

/**
 * 全局适配器实例
 */
export const workspaceStateAdapter = new WorkspaceStateAdapter(); 