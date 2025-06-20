// Copyright (c) 2025 YADRA

/**
 * 统一ID生成工具
 * 
 * 提供前端多维度ID生成功能，支持：
 * - frontend_uuid: 会话级UUID（整个问答流程保持不变）
 * - frontend_context_uuid: 交互级UUID（每次用户提交时生成新的）
 * - visitor_id: 访客ID（设备级别，持久化）
 */

export interface FrontendIDs {
  frontend_uuid: string;         // 初始提问时生成的会话唯一标识
  frontend_context_uuid: string; // 每次用户提交时生成的交互标识
  visitor_id: string;           // 访客标识（设备级别，持久化）
  user_id?: string;             // 已登录用户ID
}

/**
 * 生成标准UUID v4
 * 格式：xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx (36位，包含连字符)
 */
export function generateUUID(): string {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  
  // Fallback for environments without crypto.randomUUID
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

/**
 * 首次提问时生成所有必要的ID
 * frontend_uuid和frontend_context_uuid同时生成
 */
export function generateInitialQuestionIDs(): Pick<FrontendIDs, 'frontend_uuid' | 'frontend_context_uuid'> {
  return {
    frontend_uuid: generateUUID(),
    frontend_context_uuid: generateUUID(),
  };
}

/**
 * 后续交互时生成新的context_uuid，保持session_uuid不变
 * @param sessionUuid 现有的会话UUID
 */
export function generateInteractionIDs(sessionUuid: string): Pick<FrontendIDs, 'frontend_uuid' | 'frontend_context_uuid'> {
  return {
    frontend_uuid: sessionUuid, // 保持不变
    frontend_context_uuid: generateUUID(), // 生成新的
  };
}

/**
 * 生成单个context UUID（用于追问、反馈等场景）
 */
export function generateContextUuid(): string {
  return generateUUID();
}

/**
 * 验证UUID格式是否正确
 */
export function isValidUUID(uuid: string): boolean {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  return uuidRegex.test(uuid);
} 