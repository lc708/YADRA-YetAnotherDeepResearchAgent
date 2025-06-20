/**
 * Research Ask API Client
 * 统一的研究询问接口，支持initial和followup两种场景
 */

import { generateInitialQuestionIDs, getVisitorId } from "~/core/utils";
import { resolveServiceURL } from "./resolve-service-url";

// 请求类型
export interface ResearchAskRequest {
  question: string;
  ask_type: 'initial' | 'followup';
  frontend_uuid: string;
  visitor_id: string;
  user_id?: string;
  config?: {
    research?: {
      report_style?: "academic" | "popular_science" | "news" | "social_media";
      enable_web_search?: boolean;
      max_research_depth?: number;
      enable_deep_thinking?: boolean;
      enable_background_investigation?: boolean;
      auto_accepted_plan?: boolean;
    };
    model?: {
      provider?: string;
      model_name?: string;
      temperature?: number;
      top_p?: number;
      max_tokens?: number;
    };
    output?: {
      language?: string;
      output_format?: string;
      include_artifacts?: boolean;
      include_citations?: boolean;
    };
    preferences?: Record<string, any>;
  };
  
  // followup场景的必要信息
  session_id?: number;
  thread_id?: string;
  url_param?: string;
}

// 响应类型
export interface ResearchAskResponse {
  ask_type: string;
  url_param: string;
  frontend_uuid: string;
  session_id: number;
  thread_id: string;
  workspace_url: string;
  estimated_duration: number;
  created_at: string;
}

/**
 * 发起研究询问（支持initial和followup）
 * @param question 用户问题
 * @param askType 询问类型
 * @param config 配置参数
 * @param followupInfo followup场景的必要信息
 * @returns Promise<ResearchAskResponse>
 */
export async function askResearch(
  question: string,
  askType: 'initial' | 'followup',
  config?: ResearchAskRequest['config'],
  followupInfo?: {
    session_id: number;
    thread_id: string;
    url_param: string;
  }
): Promise<ResearchAskResponse> {
  // 生成前端UUID和访客ID
  const frontendUuid = generateInitialQuestionIDs().frontend_context_uuid;
  const visitorId = getVisitorId();
  
  // 构建请求数据
  const requestData: ResearchAskRequest = {
    question,
    ask_type: askType,
    frontend_uuid: frontendUuid,
    visitor_id: visitorId,
    config: config || {},
    
    // followup场景的必要信息
    ...(askType === 'followup' && followupInfo ? {
      session_id: followupInfo.session_id,
      thread_id: followupInfo.thread_id,
      url_param: followupInfo.url_param,
    } : {})
  };

  console.log(`[ResearchAskAPI] ${askType} research ask:`, {
    question: question.substring(0, 50) + '...',
    ask_type: askType,
    frontend_uuid: frontendUuid,
    visitor_id: visitorId,
    ...(followupInfo ? { followup_info: followupInfo } : {})
  });

  try {
    const response = await fetch(resolveServiceURL('research/ask'), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestData),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ detail: 'Unknown error' }));
      throw new Error(`API request failed: ${response.status} - ${errorData.detail || response.statusText}`);
    }

    const data: ResearchAskResponse = await response.json();
    
    console.log(`[ResearchAskAPI] ${askType} ask successful:`, {
      ask_type: data.ask_type,
      url_param: data.url_param,
      workspace_url: data.workspace_url,
      estimated_duration: data.estimated_duration
    });

    return data;
    
  } catch (error) {
    console.error(`[ResearchAskAPI] Failed to ${askType} ask:`, error);
    
    if (error instanceof Error) {
      throw error;
    } else {
      throw new Error(`Failed to ${askType} research: Unknown error`);
    }
  }
}

/**
 * 创建初始研究任务（向后兼容的函数名）
 * @param question 用户问题
 * @param config 配置参数
 * @returns Promise<ResearchAskResponse>
 */
export async function createResearchSession(
  question: string,
  config?: ResearchAskRequest['config']
): Promise<ResearchAskResponse> {
  return askResearch(question, 'initial', config);
}

/**
 * 发起followup询问
 * @param question 用户问题  
 * @param followupInfo followup必要信息
 * @param config 配置参数
 * @returns Promise<ResearchAskResponse>
 */
export async function followupResearch(
  question: string,
  followupInfo: {
    session_id: number;
    thread_id: string;
    url_param: string;
  },
  config?: ResearchAskRequest['config']
): Promise<ResearchAskResponse> {
  return askResearch(question, 'followup', config, followupInfo);
}

/**
 * 从URL参数构建工作区链接
 * @param urlParam URL参数
 * @returns 工作区URL
 */
export function buildWorkspaceUrl(urlParam: string): string {
  return `/workspace/${urlParam}`;
}

/**
 * 验证研究问题是否有效
 * @param question 用户问题
 * @returns 是否有效
 */
export function validateResearchQuestion(question: string): boolean {
  const trimmed = question.trim();
  return trimmed.length >= 1 && trimmed.length <= 2000;
} 