// Copyright (c) 2025 YADRA

// 🔥 优化深拷贝实现，避免JSON序列化的性能问题
export function deepClone<T>(value: T): T {
  if (value === null || typeof value !== 'object') {
    return value;
  }
  
  if (value instanceof Date) {
    return new Date(value.getTime()) as T;
  }
  
  if (Array.isArray(value)) {
    return value.map(item => deepClone(item)) as T;
  }
  
  if (typeof value === 'object') {
    const cloned = {} as T;
    for (const key in value) {
      if (value.hasOwnProperty(key)) {
        (cloned as any)[key] = deepClone((value as any)[key]);
      }
    }
    return cloned;
  }
  
  return value;
}

// 🔥 为消息对象提供特殊优化的浅拷贝+关键字段深拷贝
export function cloneMessage<T extends Record<string, any>>(message: T): T {
  const cloned = { ...message } as any;
  
  // 只对数组字段进行深拷贝，其他字段保持浅拷贝
  if (cloned.contentChunks && Array.isArray(cloned.contentChunks)) {
    cloned.contentChunks = [...cloned.contentChunks];
  }
  if (cloned.reasoningContentChunks && Array.isArray(cloned.reasoningContentChunks)) {
    cloned.reasoningContentChunks = [...cloned.reasoningContentChunks];
  }
  if (cloned.toolCalls && Array.isArray(cloned.toolCalls)) {
    cloned.toolCalls = cloned.toolCalls.map((tc: any) => ({
      ...tc,
      argsChunks: tc.argsChunks && Array.isArray(tc.argsChunks) ? [...tc.argsChunks] : []
    }));
  }
  if (cloned.toolCallChunks && Array.isArray(cloned.toolCallChunks)) {
    cloned.toolCallChunks = [...cloned.toolCallChunks];
  }
  if (cloned.options && Array.isArray(cloned.options)) {
    cloned.options = [...cloned.options];
  }
  if (cloned.langGraphMetadata && typeof cloned.langGraphMetadata === 'object') {
    cloned.langGraphMetadata = { ...cloned.langGraphMetadata };
  }
  
  return cloned as T;
}
