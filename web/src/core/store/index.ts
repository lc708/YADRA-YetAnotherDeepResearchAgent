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

// Legacy methods that need to be migrated to unified-store
export const useLastInterruptMessage = () => {
  const { useUnifiedStore } = require("./unified-store");
  const currentThreadId = useUnifiedStore((state: any) => state.currentThreadId);
  const thread = useUnifiedStore((state: any) => 
    currentThreadId ? state.threads.get(currentThreadId) : null
  );
  
  if (thread?.ui.lastInterruptMessageId) {
    return thread.messages.find((m: any) => m.id === thread.ui.lastInterruptMessageId);
  }
  
  return null;
};

export const useLastFeedbackMessageId = () => {
  const { useUnifiedStore } = require("./unified-store");
  const currentThreadId = useUnifiedStore((state: any) => state.currentThreadId);
  const thread = useUnifiedStore((state: any) => 
    currentThreadId ? state.threads.get(currentThreadId) : null
  );
  
  return thread?.ui.waitingForFeedbackMessageId || null;
};

export const useResearchMessage = (researchId: string) => {
  const { useUnifiedStore } = require("./unified-store");
  const currentThreadId = useUnifiedStore((state: any) => state.currentThreadId);
  const thread = useUnifiedStore((state: any) => 
    currentThreadId ? state.threads.get(currentThreadId) : null
  );
  
  const planId = thread?.metadata.planMessageIds.get(researchId);
  if (planId) {
    return thread?.messages.find((m: any) => m.id === planId);
  }
  
  return undefined;
};

// Deprecated methods - will be removed
export const useToolCalls = () => {
  console.warn("useToolCalls is deprecated and will be removed");
  return undefined;
};

export const listenToPodcast = (messageId: string) => {
  console.warn("listenToPodcast is deprecated and will be removed");

};
