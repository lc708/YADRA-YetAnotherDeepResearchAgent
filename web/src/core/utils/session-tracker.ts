// Copyright (c) 2025 YADRA

/**
 * 会话追踪工具
 * 
 * 管理frontend_uuid的生命周期，使用sessionStorage存储
 * 页面会话级别，关闭标签页后清除
 */

import { generateUUID, isValidUUID } from './id-generator';

const SESSION_UUID_KEY = 'yadra_session_uuid';
const SESSION_CREATED_AT_KEY = 'yadra_session_created_at';

/**
 * 获取当前会话UUID
 * 如果sessionStorage中不存在，返回null
 */
export function getCurrentSessionUuid(): string | null {
  if (typeof window === 'undefined') {
    return null;
  }

  try {
    const sessionUuid = sessionStorage.getItem(SESSION_UUID_KEY);
    
    if (sessionUuid && isValidUUID(sessionUuid)) {
      return sessionUuid;
    }
    
    return null;
  } catch (error) {
    console.warn('Failed to get current session UUID:', error);
    return null;
  }
}

/**
 * 设置当前会话UUID
 * 用于首次提问时保存frontend_uuid
 */
export function setCurrentSessionUuid(sessionUuid: string): void {
  if (typeof window === 'undefined') {
    return;
  }

  if (!isValidUUID(sessionUuid)) {
    console.warn('Invalid session UUID provided:', sessionUuid);
    return;
  }

  try {
    sessionStorage.setItem(SESSION_UUID_KEY, sessionUuid);
    sessionStorage.setItem(SESSION_CREATED_AT_KEY, new Date().toISOString());
  } catch (error) {
    console.warn('Failed to set session UUID:', error);
  }
}

/**
 * 清除当前会话UUID
 * 用于结束会话或开始新会话
 */
export function clearCurrentSessionUuid(): void {
  if (typeof window === 'undefined') {
    return;
  }

  try {
    sessionStorage.removeItem(SESSION_UUID_KEY);
    sessionStorage.removeItem(SESSION_CREATED_AT_KEY);
  } catch (error) {
    console.warn('Failed to clear session UUID:', error);
  }
}

/**
 * 检查是否存在活跃的会话
 */
export function hasActiveSession(): boolean {
  return getCurrentSessionUuid() !== null;
}

/**
 * 获取会话创建时间
 */
export function getSessionCreatedAt(): Date | null {
  if (typeof window === 'undefined') {
    return null;
  }

  try {
    const createdAtStr = sessionStorage.getItem(SESSION_CREATED_AT_KEY);
    
    if (createdAtStr) {
      return new Date(createdAtStr);
    }
    
    return null;
  } catch (error) {
    console.warn('Failed to get session created time:', error);
    return null;
  }
}

/**
 * 获取会话持续时间（毫秒）
 */
export function getSessionDuration(): number | null {
  const createdAt = getSessionCreatedAt();
  
  if (!createdAt) {
    return null;
  }
  
  return Date.now() - createdAt.getTime();
}

/**
 * 创建新会话
 * 清除旧会话并创建新的session UUID
 */
export function createNewSession(): string {
  clearCurrentSessionUuid();
  
  const newSessionUuid = generateUUID();
  setCurrentSessionUuid(newSessionUuid);
  
  return newSessionUuid;
} 