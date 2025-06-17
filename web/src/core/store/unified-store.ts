// Copyright (c) 2025 YADRA
/**
 * 统一的状态管理 Store
 * 
 * 设计原则：
 * 1. 单一数据源 - 所有状态集中管理
 * 2. 直接访问 - 组件直接获取数据，无需多层转换
 * 3. 类型安全 - 完整的 TypeScript 类型支持
 * 4. 性能优化 - 使用 zustand 的选择器避免不必要的重渲染
 */

import { create } from "zustand";
import { immer } from "zustand/middleware/immer";
import { enableMapSet } from "immer";
import { subscribeWithSelector } from "zustand/middleware";
import { shallow } from "zustand/shallow";
import { useShallow } from "zustand/react/shallow";
import type { Message, Resource } from "~/core/messages";
import type { Artifact } from "~/lib/supa";
import { nanoid } from "nanoid";
import React, { useCallback } from "react";
import { messageToArtifact } from "~/core/adapters/state-adapter";

// Enable Immer MapSet plugin
enableMapSet();

// 线程状态
interface ThreadState {
  id: string;
  messages: Message[];
  metadata: {
    researchIds: string[];
    ongoingResearchId: string | null;
    openResearchId: string | null;
    planMessageIds: Map<string, string>; // researchId -> planMessageId
    reportMessageIds: Map<string, string>; // researchId -> reportMessageId
    activityMessageIds: Map<string, string[]>; // researchId -> activityMessageIds[]
  };
  ui: {
    lastInterruptMessageId: string | null;
    waitingForFeedbackMessageId: string | null;
  };
}

// Store 状态
interface UnifiedStoreState {
  // 线程管理
  threads: Map<string, ThreadState>;
  currentThreadId: string | null;
  
  // 全局 UI 状态
  responding: boolean;
  
  // 工作区状态
  workspace: {
    currentTraceId: string | null;
    conversationVisible: boolean;
    debugVisible: boolean;
    feedback: { option: { text: string; value: string } } | null;
    artifactsVisible: boolean;
    historyVisible: boolean;
    podcastVisible: boolean;
  };
}

// Store 操作
interface UnifiedStoreActions {
  // 线程管理
  createThread: (threadId: string) => ThreadState;
  getThread: (threadId: string) => ThreadState | null;
  setCurrentThread: (threadId: string | null) => void;
  clearThread: (threadId: string) => void;
  
  // 消息操作
  addMessage: (threadId: string, message: Message) => void;
  updateMessage: (threadId: string, messageId: string, update: Partial<Message>) => void;
  
  // 研究操作
  setOngoingResearch: (threadId: string, researchId: string | null) => void;
  openResearch: (threadId: string, researchId: string | null) => void;
  addResearch: (threadId: string, researchId: string, planMessageId: string) => void;
  setResearchReport: (threadId: string, researchId: string, reportMessageId: string) => void;
  
  // UI 操作
  setResponding: (responding: boolean) => void;
  setInterruptMessage: (threadId: string, messageId: string | null) => void;
  setWaitingForFeedback: (threadId: string, messageId: string | null) => void;
  
  // 工作区操作
  setWorkspaceState: (update: Partial<UnifiedStoreState['workspace']>) => void;
  
  // 派生数据
  getArtifacts: (threadId: string) => Artifact[];
  getMessageById: (threadId: string, messageId: string) => Message | undefined;
}

// 创建 Store
export const useUnifiedStore = create<UnifiedStoreState & UnifiedStoreActions>()(
  subscribeWithSelector(
    immer((set, get) => ({
      // 初始状态
      threads: new Map(),
      currentThreadId: null,
      responding: false,
      workspace: {
        currentTraceId: null,
        conversationVisible: true,
        debugVisible: false,
        feedback: null,
        artifactsVisible: true,
        historyVisible: false,
        podcastVisible: false,
      },
      
      // 线程管理
      createThread: (threadId: string) => {
        const thread: ThreadState = {
          id: threadId,
          messages: [],
          metadata: {
            researchIds: [],
            ongoingResearchId: null,
            openResearchId: null,
            planMessageIds: new Map(),
            reportMessageIds: new Map(),
            activityMessageIds: new Map(),
          },
          ui: {
            lastInterruptMessageId: null,
            waitingForFeedbackMessageId: null,
          },
        };
        
        set((state) => {
          state.threads.set(threadId, thread);
        });
        
        return thread;
      },
      
      getThread: (threadId: string) => {
        return get().threads.get(threadId) || null;
      },
      
      setCurrentThread: (threadId: string | null) => {
        set((state) => {
          state.currentThreadId = threadId;
          if (threadId && !state.threads.has(threadId)) {
            // 自动创建线程
            const thread: ThreadState = {
              id: threadId,
              messages: [],
              metadata: {
                researchIds: [],
                ongoingResearchId: null,
                openResearchId: null,
                planMessageIds: new Map(),
                reportMessageIds: new Map(),
                activityMessageIds: new Map(),
              },
              ui: {
                lastInterruptMessageId: null,
                waitingForFeedbackMessageId: null,
              },
            };
            state.threads.set(threadId, thread);
          }
        });
      },
      
      clearThread: (threadId: string) => {
        set((state) => {
          state.threads.delete(threadId);
          if (state.currentThreadId === threadId) {
            state.currentThreadId = null;
          }
        });
      },
      
      // 消息操作
      addMessage: (threadId: string, message: Message) => {
        set((state) => {
          const thread = state.threads.get(threadId);
          if (!thread) return;
          
          thread.messages.push(message);
          
          // 处理特殊消息类型
          if (message.agent === "planner" && !message.isStreaming) {
            // 这是一个研究计划
            const researchId = nanoid();
            thread.metadata.researchIds.push(researchId);
            thread.metadata.planMessageIds.set(researchId, message.id);
            thread.metadata.ongoingResearchId = researchId;
          } else if (message.agent === "reporter" && !message.isStreaming) {
            // 这是一个研究报告
            const researchId = thread.metadata.ongoingResearchId;
            if (researchId) {
              thread.metadata.reportMessageIds.set(researchId, message.id);
              thread.metadata.ongoingResearchId = null;
            }
          }
        });
      },
      
      updateMessage: (threadId: string, messageId: string, update: Partial<Message>) => {
        set((state) => {
          const thread = state.threads.get(threadId);
          if (!thread) return;
          
          const messageIndex = thread.messages.findIndex((m) => m.id === messageId);
          if (messageIndex !== -1 && thread.messages[messageIndex]) {
            Object.assign(thread.messages[messageIndex], update);
          }
        });
      },
      
      // 研究操作
      setOngoingResearch: (threadId: string, researchId: string | null) => {
        set((state) => {
          const thread = state.threads.get(threadId);
          if (thread) {
            thread.metadata.ongoingResearchId = researchId;
          }
        });
      },
      
      openResearch: (threadId: string, researchId: string | null) => {
        set((state) => {
          const thread = state.threads.get(threadId);
          if (thread) {
            thread.metadata.openResearchId = researchId;
          }
        });
      },
      
      addResearch: (threadId: string, researchId: string, planMessageId: string) => {
        set((state) => {
          const thread = state.threads.get(threadId);
          if (!thread) return;
          
          thread.metadata.researchIds.push(researchId);
          thread.metadata.planMessageIds.set(researchId, planMessageId);
          thread.metadata.ongoingResearchId = researchId;
        });
      },
      
      setResearchReport: (threadId: string, researchId: string, reportMessageId: string) => {
        set((state) => {
          const thread = state.threads.get(threadId);
          if (thread) {
            thread.metadata.reportMessageIds.set(researchId, reportMessageId);
          }
        });
      },
      
      // UI 操作
      setResponding: (responding: boolean) => {
        set((state) => {
          state.responding = responding;
        });
      },
      
      setInterruptMessage: (threadId: string, messageId: string | null) => {
        set((state) => {
          const thread = state.threads.get(threadId);
          if (thread) {
            thread.ui.lastInterruptMessageId = messageId;
          }
        });
      },
      
      setWaitingForFeedback: (threadId: string, messageId: string | null) => {
        set((state) => {
          const thread = state.threads.get(threadId);
          if (thread) {
            thread.ui.waitingForFeedbackMessageId = messageId;
          }
        });
      },
      
      // 工作区操作
      setWorkspaceState: (update: Partial<UnifiedStoreState['workspace']>) => {
        set((state) => {
          Object.assign(state.workspace, update);
        });
      },
      
      // 派生数据
      getArtifacts: (threadId: string): Artifact[] => {
        const thread = get().threads.get(threadId);
        if (!thread) return [];
        
        // 使用 state-adapter 的逻辑转换消息为 artifacts
        const artifacts: Artifact[] = [];
        
        // 转换所有消息
        for (const message of thread.messages) {
          const artifact = messageToArtifact(message, threadId);
          if (artifact) {
            artifacts.push(artifact);
          }
        }
        
        // 按创建时间排序
        return artifacts.sort((a, b) => 
          new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
        );
      },
      
      getMessageById: (threadId: string, messageId: string) => {
        const thread = get().threads.get(threadId);
        return thread?.messages.find((m) => m.id === messageId);
      },
    }))
  )
);

// 导出便捷 hooks
export const useCurrentThread = () => {
  const currentThreadId = useUnifiedStore((state) => state.currentThreadId);
  const thread = useUnifiedStore(
    (state) => currentThreadId ? state.threads.get(currentThreadId) : null
  );
  return thread;
};

export const useThreadMessages = (threadId?: string) => {
  const currentThreadId = useUnifiedStore((state) => state.currentThreadId);
  const threads = useUnifiedStore((state) => state.threads);
  
  const actualThreadId = threadId || currentThreadId;
  
  return React.useMemo(() => {
    if (!actualThreadId) return [];
    const thread = threads.get(actualThreadId);
    return thread?.messages || [];
  }, [actualThreadId, threads]);
};

export const useThreadArtifacts = (threadId?: string) => {
  const currentThreadId = useUnifiedStore((state) => state.currentThreadId);
  const getArtifacts = useUnifiedStore((state) => state.getArtifacts);
  
  const actualThreadId = threadId || currentThreadId;
  
  return React.useMemo(() => {
    if (!actualThreadId) return [];
    return getArtifacts(actualThreadId);
  }, [actualThreadId, getArtifacts]);
};

export const useWorkspaceState = () => {
  return useUnifiedStore((state) => state.workspace);
};

// 兼容旧 API 的 wrapper
export const useMessageIds = (threadId?: string) => {
  // 分两步获取，避免 selector 重建
  const currentThreadId = useUnifiedStore((state) => state.currentThreadId);
  const actualThreadId = threadId || currentThreadId;
  
  // 使用 useShallow 避免不必要的重渲染
  return useUnifiedStore(
    useShallow((state) => {
      if (!actualThreadId) return [];
      const thread = state.threads.get(actualThreadId);
      return thread?.messages.map((m) => m.id) || [];
    })
  );
};

export const useMessage = (messageId: string, threadId?: string) => {
  return useUnifiedStore((state) => {
    const actualThreadId = threadId || state.currentThreadId;
    if (!actualThreadId) return undefined;
    const thread = state.threads.get(actualThreadId);
    return thread?.messages.find(m => m.id === messageId);
  });
};

// 导出便捷方法
export const setCurrentThreadId = (threadId: string) => {
  useUnifiedStore.getState().setCurrentThread(threadId);
};

export const addMessage = (message: Message) => {
  const state = useUnifiedStore.getState();
  const currentThreadId = state.currentThreadId || nanoid();
  
  if (!state.currentThreadId) {
    state.setCurrentThread(currentThreadId);
  }
  
  state.addMessage(currentThreadId, message);
};

export const updateMessage = (messageId: string, update: Partial<Message>) => {
  const state = useUnifiedStore.getState();
  const currentThreadId = state.currentThreadId;
  
  if (currentThreadId) {
    state.updateMessage(currentThreadId, messageId, update);
  }
};

export const setResponding = (responding: boolean) => {
  useUnifiedStore.getState().setResponding(responding);
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

// 工作区 UI 状态便捷 hooks
export const useConversationPanelVisible = () => {
  return useUnifiedStore((state) => state.workspace.conversationVisible);
};

export const useArtifactsPanelVisible = () => {
  return useUnifiedStore((state) => state.workspace.artifactsVisible);
};

export const useHistoryPanelVisible = () => {
  return useUnifiedStore((state) => state.workspace.historyVisible);
};

export const usePodcastPanelVisible = () => {
  return useUnifiedStore((state) => state.workspace.podcastVisible);
};

export const useWorkspaceFeedback = () => {
  return useUnifiedStore((state) => state.workspace.feedback);
};

// 工作区操作便捷 hooks
export const useWorkspaceActions = () => {
  const setWorkspaceState = useUnifiedStore((state) => state.setWorkspaceState);
  
  return React.useMemo(() => ({
    setCurrentTraceId: (traceId: string | null) => {
      setWorkspaceState({ currentTraceId: traceId });
    },
    toggleConversationPanel: () => {
      const state = useUnifiedStore.getState();
      setWorkspaceState({ conversationVisible: !state.workspace.conversationVisible });
    },
    toggleArtifactsPanel: () => {
      const state = useUnifiedStore.getState();
      setWorkspaceState({ artifactsVisible: !state.workspace.artifactsVisible });
    },
    toggleHistoryPanel: () => {
      const state = useUnifiedStore.getState();
      setWorkspaceState({ historyVisible: !state.workspace.historyVisible });
    },
    togglePodcastPanel: () => {
      const state = useUnifiedStore.getState();
      setWorkspaceState({ podcastVisible: !state.workspace.podcastVisible });
    },
    setFeedback: (feedback: { option: { text: string; value: string } } | null) => {
      setWorkspaceState({ feedback });
    },
    removeFeedback: () => {
      setWorkspaceState({ feedback: null });
    },
  }), [setWorkspaceState]);
};                          