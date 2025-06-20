// Copyright (c) 2025 YADRA

/**
 * 访客追踪工具
 * 
 * 管理设备级别的访客ID，使用localStorage持久化存储
 * 除非用户清除浏览器数据，否则永久保存
 */

import { generateUUID, isValidUUID } from './id-generator';

const VISITOR_ID_KEY = 'yadra_visitor_id';

/**
 * 获取或创建访客ID
 * 如果localStorage中不存在有效的visitor_id，则创建新的
 */
export function getVisitorId(): string {
  if (typeof window === 'undefined') {
    // SSR环境下返回临时ID
    return generateUUID();
  }

  try {
    const existingId = localStorage.getItem(VISITOR_ID_KEY);
    
    if (existingId && isValidUUID(existingId)) {
      return existingId;
    }
    
    // 创建新的访客ID
    const newVisitorId = generateUUID();
    localStorage.setItem(VISITOR_ID_KEY, newVisitorId);
    
    return newVisitorId;
  } catch (error) {
    console.warn('Failed to access localStorage for visitor ID:', error);
    // 如果localStorage不可用，返回临时ID
    return generateUUID();
  }
}

/**
 * 重置访客ID（用于测试或特殊场景）
 */
export function resetVisitorId(): string {
  if (typeof window === 'undefined') {
    return generateUUID();
  }

  try {
    const newVisitorId = generateUUID();
    localStorage.setItem(VISITOR_ID_KEY, newVisitorId);
    return newVisitorId;
  } catch (error) {
    console.warn('Failed to reset visitor ID:', error);
    return generateUUID();
  }
}

/**
 * 检查是否为首次访问（没有访客ID）
 */
export function isFirstTimeVisitor(): boolean {
  if (typeof window === 'undefined') {
    return true;
  }

  try {
    const existingId = localStorage.getItem(VISITOR_ID_KEY);
    return !existingId || !isValidUUID(existingId);
  } catch (error) {
    return true;
  }
}

/**
 * 获取访客ID创建时间（如果可用）
 */
export function getVisitorIdCreatedAt(): Date | null {
  if (typeof window === 'undefined') {
    return null;
  }

  try {
    const createdAtKey = `${VISITOR_ID_KEY}_created_at`;
    const createdAtStr = localStorage.getItem(createdAtKey);
    
    if (createdAtStr) {
      return new Date(createdAtStr);
    }
    
    // 如果没有创建时间记录，但有访客ID，记录当前时间
    const existingId = localStorage.getItem(VISITOR_ID_KEY);
    if (existingId && isValidUUID(existingId)) {
      const now = new Date();
      localStorage.setItem(createdAtKey, now.toISOString());
      return now;
    }
    
    return null;
  } catch (error) {
    console.warn('Failed to get visitor ID created time:', error);
    return null;
  }
} 