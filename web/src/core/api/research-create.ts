/**
 * Research Create API Client
 * 两步分离架构的第一步：快速创建研究会话
 */

import { generateInitialQuestionIDs, getVisitorId } from "~/core/utils";
import { resolveServiceURL } from "./resolve-service-url";

// 请求类型
export interface CreateResearchRequest {
  question: string;
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
}

// 响应类型
export interface CreateResearchResponse {
  url_param: string;
  frontend_uuid: string;
  session_id: number;
  workspace_url: string;
  estimated_duration: number;
  created_at: string;
}

/**
 * 创建研究任务
 * @param question 用户问题
 * @param config 配置参数
 * @returns Promise<CreateResearchResponse>
 */
export async function createResearchSession(
  question: string,
  config?: CreateResearchRequest['config']
): Promise<CreateResearchResponse> {
  // 生成前端UUID和访客ID
  const frontendUuid = generateInitialQuestionIDs().frontend_context_uuid;
  const visitorId = getVisitorId();
  
  // 构建请求数据
  const requestData: CreateResearchRequest = {
    question,
    frontend_uuid: frontendUuid,
    visitor_id: visitorId,
    config: config || {}
  };

  console.log('[CreateResearchAPI] Creating research session:', {
    question: question.substring(0, 50) + '...',
    frontend_uuid: frontendUuid,
    visitor_id: visitorId
  });

  try {
    const response = await fetch(resolveServiceURL('research/create'), {
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

    const data: CreateResearchResponse = await response.json();
    
    console.log('[CreateResearchAPI] Research session created successfully:', {
      url_param: data.url_param,
      workspace_url: data.workspace_url,
      estimated_duration: data.estimated_duration
    });

    return data;
    
  } catch (error) {
    console.error('[CreateResearchAPI] Failed to create research session:', error);
    
    if (error instanceof Error) {
      throw error;
    } else {
      throw new Error('Failed to create research session: Unknown error');
    }
  }
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