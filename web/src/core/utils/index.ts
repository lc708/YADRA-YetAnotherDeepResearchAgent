// Copyright (c) 2025 YADRA

export * from "./time";
export * from "./json";
export * from "./deep-clone";

// 新增ID生成和追踪工具
export {
  generateUUID,
  generateInitialQuestionIDs,
  generateInteractionIDs,
  generateContextUuid,
  isValidUUID,
  type FrontendIDs,
} from "./id-generator";

export {
  getVisitorId,
  resetVisitorId,
  isFirstTimeVisitor,
  getVisitorIdCreatedAt,
} from "./visitor-tracker";

export {
  getCurrentSessionUuid,
  setCurrentSessionUuid,
  clearCurrentSessionUuid,
  hasActiveSession,
  getSessionCreatedAt,
  getSessionDuration,
  createNewSession,
} from "./session-tracker";
