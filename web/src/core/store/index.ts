// Copyright (c) 2025 YADRA

// Export everything from settings store
export * from "./settings-store";

// Export everything from unified store
export * from "./unified-store";

// Re-export types explicitly for clarity
export type { 
  ResearchRequest, 
  AskAPIConfig,
  BusinessPlan,
  BusinessPlanStep,
  ToolCallResult
} from "./unified-store";

// Provide aliases for backward compatibility
export {
  useUnifiedStore,
  useCurrentThread,
  useThreadMessages,
  useThreadArtifacts,
  useWorkspaceState,
  useMessageIds,
  useMessage,
  setCurrentThreadId,
  setCurrentUrlParam,
  setUrlParamMapping,
  getThreadIdByUrlParam,
  useCurrentUrlParam,
  useSessionState,
  setSessionState,
  addMessage,
  updateMessage,
  setResponding,
  openResearch,
  closeResearch,
  useConversationPanelVisible,
  useArtifactsPanelVisible,
  useHistoryPanelVisible,
  usePodcastPanelVisible,
  useWorkspaceFeedback,
  useWorkspaceActions,
  sendAskMessage,
} from "./unified-store";
