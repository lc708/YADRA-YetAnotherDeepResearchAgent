// Copyright (c) 2025 YADRA

/**
 * 统一研究流式API客户端
 * 
 * 实现POST /api/research/stream接口的客户端调用
 */

import { env } from "~/env";
import { fetchStream } from "../sse";
import { resolveServiceURL } from "./resolve-service-url";
import type { 
  ResearchStreamRequest, 
  SSEEvent, 
  SSEEventType,
  NavigationEvent,
  MetadataEvent,
  ProgressEvent,
  MessageChunkEvent,
  ArtifactEvent,
  CompleteEvent,
  ErrorEvent,
} from "./research-stream-types";

/**
 * 创建研究流式连接
 * @param request 研究请求参数
 * @returns AsyncIterable<SSEEvent> SSE事件流
 */
export async function* createResearchStream(
  request: ResearchStreamRequest
): AsyncIterable<SSEEvent> {
  const url = resolveServiceURL("/api/research/stream");
  
  try {
    const stream = fetchStream(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(request),
    });

    for await (const event of stream) {
      // 解析SSE事件
      const parsedEvent = parseSSEEvent(event);
      if (parsedEvent) {
        yield parsedEvent;
      }
    }
  } catch (error) {
    console.error("Research stream error:", error);
    
    // 发送错误事件
    yield {
      type: 'error',
      data: {
        errorCode: 'STREAM_ERROR',
        errorMessage: error instanceof Error ? error.message : 'Unknown stream error',
        suggestions: ['请检查网络连接', '重试请求'],
      } as ErrorEvent,
    };
  }
}

/**
 * 解析SSE事件数据
 */
function parseSSEEvent(rawEvent: { event: string; data: string }): SSEEvent | null {
  try {
    const eventType = rawEvent.event as SSEEventType;
    const eventData = JSON.parse(rawEvent.data);
    
    return {
      type: eventType,
      data: eventData,
    };
  } catch (error) {
    console.warn("Failed to parse SSE event:", error, rawEvent);
    return null;
  }
}

/**
 * 类型守卫函数 - 检查事件类型
 */
export function isNavigationEvent(event: SSEEvent): event is SSEEvent & { data: NavigationEvent } {
  return event.type === 'navigation';
}

export function isMetadataEvent(event: SSEEvent): event is SSEEvent & { data: MetadataEvent } {
  return event.type === 'metadata';
}

export function isProgressEvent(event: SSEEvent): event is SSEEvent & { data: ProgressEvent } {
  return event.type === 'progress';
}

export function isMessageChunkEvent(event: SSEEvent): event is SSEEvent & { data: MessageChunkEvent } {
  return event.type === 'message_chunk';
}

export function isArtifactEvent(event: SSEEvent): event is SSEEvent & { data: ArtifactEvent } {
  return event.type === 'artifact';
}

export function isCompleteEvent(event: SSEEvent): event is SSEEvent & { data: CompleteEvent } {
  return event.type === 'complete';
}

export function isErrorEvent(event: SSEEvent): event is SSEEvent & { data: ErrorEvent } {
  return event.type === 'error';
}

/**
 * 获取工作区状态
 * @param urlParam URL参数
 */
export async function getWorkspaceState(urlParam: string) {
  const url = resolveServiceURL(`/api/workspace/${urlParam}`);
  
  try {
    const response = await fetch(url, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
      },
    });
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    
    return await response.json();
  } catch (error) {
    console.error("Failed to get workspace state:", error);
    throw error;
  }
}

/**
 * 构建研究配置对象
 * 基于项目现有的设置系统
 */
export function buildResearchConfig(settings: {
  enableBackgroundInvestigation?: boolean;
  reportStyle?: 'academic' | 'popular_science' | 'news' | 'social_media';
  enableDeepThinking?: boolean;
  maxPlanIterations?: number;
  maxStepNum?: number;
  maxSearchResults?: number;
  [key: string]: any;
}) {
  return {
    enableBackgroundInvestigation: settings.enableBackgroundInvestigation ?? true,
    reportStyle: settings.reportStyle ?? 'academic',
    enableDeepThinking: settings.enableDeepThinking ?? false,
    maxPlanIterations: settings.maxPlanIterations ?? 1,
    maxStepNum: settings.maxStepNum ?? 3,
    maxSearchResults: settings.maxSearchResults ?? 3,
    
    // 输出配置
    outputFormat: 'markdown' as const,
    includeCitations: true,
    includeArtifacts: true,
    
    // 用户偏好（可扩展）
    userPreferences: {
      writingStyle: 'professional',
      expertiseLevel: 'intermediate' as const,
      preferredSources: [],
    },
  };
} 