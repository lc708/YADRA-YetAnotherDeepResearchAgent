// Copyright (c) 2025 YADRA

export * from "./settings-store";

// Export everything from unified-store
export {
  useUnifiedStore,
  useCurrentThread,
  useThreadMessages,
  useThreadArtifacts,
  useWorkspaceState,
  useMessageIds,
  useMessage,
  setCurrentThreadId,
  addMessage,
  updateMessage,
  setResponding,
  // Add workspace UI hooks
  useConversationPanelVisible,
  useArtifactsPanelVisible,
  useHistoryPanelVisible,
  usePodcastPanelVisible,
  useWorkspaceFeedback,
  useWorkspaceActions,
} from "./unified-store";

// TODO: These need to be migrated to unified-store
// For now, create temporary implementations
import { nanoid } from "nanoid";

import type { Message } from "../messages";
import { mergeMessage } from "../messages/merge-message";
import { chatStream, buildChatStreamParams } from "../api/chat";

import { useUnifiedStore } from "./unified-store";

// Legacy store compatibility - create a selector-based hook
export const useStore = <T>(selector?: (state: ReturnType<typeof createLegacyState>) => T): T extends undefined ? ReturnType<typeof createLegacyState> : T => {
  const currentThreadId = useUnifiedStore((state) => state.currentThreadId);
  const thread = useUnifiedStore((state) => 
    currentThreadId ? state.threads.get(currentThreadId) : null
  );
  const responding = useUnifiedStore((state) => state.responding);
  
  const legacyState = {
    responding,
    messageIds: thread?.messages.map(m => m.id) || [],
    messages: new Map(thread?.messages.map(m => [m.id, m]) || []),
    researchIds: thread?.metadata.researchIds || [],
    researchPlanIds: thread?.metadata.planMessageIds || new Map(),
    researchReportIds: thread?.metadata.reportMessageIds || new Map(),
    researchActivityIds: thread?.metadata.activityMessageIds || new Map(),
    ongoingResearchId: thread?.metadata.ongoingResearchId || null,
    openResearchId: thread?.metadata.openResearchId || null,
  };
  
  if (selector) {
    return selector(legacyState) as any;
  }
  
  return legacyState as any;
};

// Helper function to create the legacy state type
function createLegacyState() {
  return {
    responding: false as boolean,
    messageIds: [] as string[],
    messages: new Map() as Map<string, Message>,
    researchIds: [] as string[],
    researchPlanIds: new Map() as Map<string, string>,
    researchReportIds: new Map() as Map<string, string>,
    researchActivityIds: new Map() as Map<string, string[]>,
    ongoingResearchId: null as string | null,
    openResearchId: null as string | null,
  };
}

// Add methods to the store for compatibility
(useStore as any).getState = () => {
  const state = useUnifiedStore.getState();
  const currentThreadId = state.currentThreadId;
  const thread = currentThreadId ? state.threads.get(currentThreadId) : null;
  
  return {
    responding: state.responding,
    messageIds: thread?.messages.map(m => m.id) || [],
    messages: new Map(thread?.messages.map(m => [m.id, m]) || []),
    researchIds: thread?.metadata.researchIds || [],
    researchPlanIds: thread?.metadata.planMessageIds || new Map(),
    researchReportIds: thread?.metadata.reportMessageIds || new Map(),
    researchActivityIds: thread?.metadata.activityMessageIds || new Map(),
    ongoingResearchId: thread?.metadata.ongoingResearchId || null,
    openResearchId: thread?.metadata.openResearchId || null,
  };
};

(useStore as any).setState = (updater: any) => {
  const state = useUnifiedStore.getState();
  const currentThreadId = state.currentThreadId;
  
  if (!currentThreadId) return;
  
  // Handle partial updates to messages
  if (typeof updater === 'object' && updater.messages) {
    const thread = state.threads.get(currentThreadId);
    if (thread && updater.messages instanceof Map) {
      // Update messages in the unified store
      updater.messages.forEach((message: Message, messageId: string) => {
        const existingIndex = thread.messages.findIndex(m => m.id === messageId);
        if (existingIndex !== -1) {
          state.updateMessage(currentThreadId, messageId, message);
        }
      });
    }
  }
};

export const useMessages = () => {
  const currentThreadId = useUnifiedStore((state) => state.currentThreadId);
  const thread = useUnifiedStore((state) => 
    currentThreadId ? state.threads.get(currentThreadId) : null
  );
  
  const messages = new Map<string, Message>();
  thread?.messages.forEach(msg => {
    messages.set(msg.id, msg);
  });
  
  return messages;
};

export const useLastInterruptMessage = () => {
  const currentThreadId = useUnifiedStore((state) => state.currentThreadId);
  const thread = useUnifiedStore((state) => 
    currentThreadId ? state.threads.get(currentThreadId) : null
  );
  
  if (thread?.ui.lastInterruptMessageId) {
    return thread.messages.find(m => m.id === thread.ui.lastInterruptMessageId);
  }
  
  return null;
};

export const useLastFeedbackMessageId = () => {
  const currentThreadId = useUnifiedStore((state) => state.currentThreadId);
  const thread = useUnifiedStore((state) => 
    currentThreadId ? state.threads.get(currentThreadId) : null
  );
  
  return thread?.ui.waitingForFeedbackMessageId || null;
};

export const useResearchMessage = (researchId: string) => {
  const currentThreadId = useUnifiedStore((state) => state.currentThreadId);
  const thread = useUnifiedStore((state) => 
    currentThreadId ? state.threads.get(currentThreadId) : null
  );
  
  const planId = thread?.metadata.planMessageIds.get(researchId);
  if (planId) {
    return thread?.messages.find(m => m.id === planId);
  }
  
  return undefined;
};

export const useToolCalls = () => {
  // TODO: Implement tool calls in unified store
  return undefined;
};

export const sendMessage = async (
  message?: string,
  options?: {
    interruptFeedback?: string;
    resources?: any[];
  },
  streamOptions?: {
    abortSignal?: AbortSignal;
  }
) => {
  // 如果没有传入消息，尝试从DOM获取
  if (!message) {
    const inputElement = document.querySelector('textarea[name="message"]') as HTMLTextAreaElement;
    if (inputElement && inputElement.value.trim()) {
      message = inputElement.value.trim();
      inputElement.value = ''; // 清空输入框
    } else {
      throw new Error('No message provided');
    }
  }
  const state = useUnifiedStore.getState();
  const currentThreadId = state.currentThreadId || nanoid();
  
  // 如果没有当前线程，创建一个
  if (!state.currentThreadId) {
    state.setCurrentThread(currentThreadId);
  }
  
  // 添加用户消息
  const userMessage: Message = {
    id: nanoid(),
    threadId: currentThreadId,
    role: "user",
    content: message,
    contentChunks: [message],
    isStreaming: false,
  };
  state.addMessage(currentThreadId, userMessage);
  
  // 设置响应状态
  state.setResponding(true);
  
  try {
    // 使用统一的配置构建函数
    const chatParams = buildChatStreamParams(currentThreadId, {
      resources: options?.resources,
      interrupt_feedback: options?.interruptFeedback,
    });
    
    // 调用 chatStream API
    const stream = chatStream(
      message,
      chatParams,
      {
        abortSignal: streamOptions?.abortSignal,
      }
    );
    
    let currentMessage: Message | null = null;
    
    // 处理流式响应
    for await (const event of stream) {
      if (streamOptions?.abortSignal?.aborted) {
        break;
      }
      
      // 处理不同类型的事件
      if (event.type === "message_chunk") {
        if (!currentMessage || currentMessage.id !== event.data.id) {
          // 新消息
          currentMessage = {
            id: event.data.id,
            threadId: currentThreadId,
            role: event.data.role,
            content: event.data.content || "",
            contentChunks: event.data.content ? [event.data.content] : [],
            agent: event.data.agent,
            reasoningContent: event.data.reasoning_content,
            reasoningContentChunks: event.data.reasoning_content ? [event.data.reasoning_content] : [],
            isStreaming: true,
          };
          state.addMessage(currentThreadId, currentMessage);
        } else {
          // 更新现有消息
          const mergedMessage = mergeMessage(currentMessage, event);
          if (mergedMessage) {
            currentMessage = mergedMessage;
            state.updateMessage(currentThreadId, currentMessage.id, currentMessage);
          }
        }
      } else if (event.type === "interrupt") {
        // 处理中断事件
        if (currentMessage) {
          const mergedMessage = mergeMessage(currentMessage, event);
          if (mergedMessage) {
            currentMessage = mergedMessage;
            state.updateMessage(currentThreadId, currentMessage.id, currentMessage);
            state.setInterruptMessage(currentThreadId, currentMessage.id);
            state.setWaitingForFeedback(currentThreadId, currentMessage.id);
          }
        }
      } else if (event.type === "tool_calls" || event.type === "tool_call_chunks" || event.type === "tool_call_result") {
        // 处理工具调用
        if (currentMessage) {
          const mergedMessage = mergeMessage(currentMessage, event);
          if (mergedMessage) {
            currentMessage = mergedMessage;
            state.updateMessage(currentThreadId, currentMessage.id, currentMessage);
          }
        }
      }
    }
  } catch (error) {
    console.error("Error in sendMessage:", error);
    throw error;
  } finally {
    state.setResponding(false);
  }
};

// Podcast functionality
export const listenToPodcast = (messageId: string) => {
  // TODO: Implement podcast functionality
  console.log("Listen to podcast for message:", messageId);
};

export const openResearch = (researchId: string | null) => {
  const state = useUnifiedStore.getState();
  const currentThreadId = state.currentThreadId;
  
  if (currentThreadId) {
    state.openResearch(currentThreadId, researchId);
  }
};

export const closeResearch = () => {
  openResearch(null);
};
