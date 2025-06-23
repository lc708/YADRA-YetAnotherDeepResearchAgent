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

// 🚀 扩展性接口定义 - ASK API研究请求
export interface ResearchRequest {
  question: string;
  askType: 'initial' | 'followup';
  config: AskAPIConfig;
  context?: {
    sessionId?: number;
    threadId?: string;
    urlParam?: string;
  };
  interrupt_feedback?: string; // 🔥 添加interrupt_feedback支持
}

// 🚀 ASK API配置接口 - 支持所有用户可配置选项
export interface AskAPIConfig {
  // 基础配置
  autoAcceptedPlan: boolean;
  enableBackgroundInvestigation: boolean;
  reportStyle: "academic" | "popular_science" | "news" | "social_media";
  enableDeepThinking: boolean;
  
  // 研究参数
  maxPlanIterations: number;
  maxStepNum: number;
  maxSearchResults: number;
  
  // 扩展配置 - 为未来迭代预留
  [key: string]: any;
}

// 🚀 废弃：AskAPIEventHandler已删除 - Store层不再处理业务事件
// 组件层应直接处理LangGraph原生事件，在组件末端做业务识别

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
    currentInterrupt: {
      interruptId: string;
      message: string;
      options: Array<{text: string; value: string}>;
      threadId: string;
      executionId: string;
      nodeName: string;
      timestamp: string;
      messageId: string; // 关联的消息ID
    } | null;
  };
}

// Store 类型 - 使用 zustand 推断类型而不是预定义接口
type UnifiedStore = {
  // 线程管理 - 新架构
  threads: Map<string, ThreadState>;
  currentThreadId: string | null;
  currentUrlParam: string | null;  // 新增：当前URL参数
  urlParamToThreadId: Map<string, string>; // 新增：URL参数到thread_id的映射
  
  // 会话状态 - 新架构
  sessionState: {
    sessionMetadata: any | null;
    executionHistory: any[];
    currentConfig: any | null;
    permissions: any | null;
  } | null;
  
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
  
  // 线程管理 - 新架构方法
  createThread: (threadId: string) => ThreadState;
  getThread: (threadId: string) => ThreadState | null;
  setCurrentThread: (threadId: string | null) => void;
  clearThread: (threadId: string) => void;
  
  // URL参数映射 - 新增方法
  setUrlParamMapping: (urlParam: string, threadId: string) => void;
  getThreadIdByUrlParam: (urlParam: string) => string | null;
  setCurrentUrlParam: (urlParam: string | null) => void;
  
  // 会话状态管理 - 新增方法
  setSessionState: (state: UnifiedStore['sessionState']) => void;
  
  // 消息操作
  addMessage: (threadId: string, message: Message) => void;
  updateMessage: (threadId: string, messageId: string, update: Partial<Message>) => void;
  
  // 🔥 废弃：mergeMessageChunk已删除 - 使用LangGraph原生事件和mergeMessage替代
  
  // 研究操作
  setOngoingResearch: (threadId: string, researchId: string | null) => void;
  openResearch: (threadId: string, researchId: string | null) => void;
  addResearch: (threadId: string, researchId: string, planMessageId: string) => void;
  setResearchReport: (threadId: string, researchId: string, reportMessageId: string) => void;
  
  // UI 操作
  setResponding: (responding: boolean) => void;
  setInterruptMessage: (threadId: string, messageId: string | null) => void;
  setWaitingForFeedback: (threadId: string, messageId: string | null) => void;
  
  // 🔥 添加interrupt事件管理方法
  setCurrentInterrupt: (threadId: string, interruptData: ThreadState['ui']['currentInterrupt']) => void;
  getCurrentInterrupt: (threadId: string) => ThreadState['ui']['currentInterrupt'];
  clearCurrentInterrupt: (threadId: string) => void;
  
  // 工作区操作
  setWorkspaceState: (update: Partial<UnifiedStore['workspace']>) => void;
  
  // 派生数据
  getArtifacts: (threadId: string) => Artifact[];
  getMessageById: (threadId: string, messageId: string) => Message | undefined;
};

// 创建 Store
export const useUnifiedStore = create<UnifiedStore>()(
  subscribeWithSelector(
    immer((set, get) => ({
      // 初始状态
      threads: new Map(),
      currentThreadId: null,
      currentUrlParam: null,
      urlParamToThreadId: new Map(),
      sessionState: null,
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
            currentInterrupt: null,
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
                currentInterrupt: null,
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
      
      // URL参数映射 - 新增方法
      setUrlParamMapping: (urlParam: string, threadId: string) => {
        set((state) => {
          state.urlParamToThreadId.set(urlParam, threadId);
        });
      },
      
      getThreadIdByUrlParam: (urlParam: string) => {
        return get().urlParamToThreadId.get(urlParam) || null;
      },
      
      setCurrentUrlParam: (urlParam: string | null) => {
        set((state) => {
          state.currentUrlParam = urlParam;
        });
      },
      
      // 会话状态管理 - 新增方法
      setSessionState: (sessionState: UnifiedStore['sessionState']) => {
        // 🔍 调试每次sessionState更新
        const currentState = get().sessionState;
        console.log('🔍 [setSessionState] Updating sessionState:', {
          from: currentState,
          to: sessionState,
          session_id_before: currentState?.sessionMetadata?.session_id,
          session_id_after: sessionState?.sessionMetadata?.session_id,
          timestamp: new Date().toISOString(),
          stack: new Error().stack?.split('\n').slice(1, 6) // 获取调用栈前5行
        });
        
        set((state) => {
          state.sessionState = sessionState;
        });
      },
      
      // 消息操作
      addMessage: (threadId: string, message: Message) => {
        set((state) => {
          const thread = state.threads.get(threadId);
          if (thread) {
            thread.messages.push(message);
          }
        });
      },
      
             updateMessage: (threadId: string, messageId: string, update: Partial<Message>) => {
         set((state) => {
           const thread = state.threads.get(threadId);
           if (thread) {
             const messageIndex = thread.messages.findIndex(m => m.id === messageId);
             if (messageIndex !== -1 && thread.messages[messageIndex]) {
               Object.assign(thread.messages[messageIndex], update);
             }
           }
         });
       },
      
             // 🔥 废弃：mergeMessageChunk方法已删除
      
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
      
      // 🔥 添加interrupt事件管理方法
      setCurrentInterrupt: (threadId: string, interruptData: ThreadState['ui']['currentInterrupt']) => {
        set((state) => {
          const thread = state.threads.get(threadId);
          if (thread) {
            thread.ui.currentInterrupt = interruptData;
          }
        });
      },
      
      getCurrentInterrupt: (threadId: string) => {
        return get().threads.get(threadId)?.ui.currentInterrupt || null;
      },
      
      clearCurrentInterrupt: (threadId: string) => {
        set((state) => {
          const thread = state.threads.get(threadId);
          if (thread) {
            thread.ui.currentInterrupt = null;
          }
        });
      },
      
      // 工作区操作
      setWorkspaceState: (update: Partial<UnifiedStore['workspace']>) => {
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

export const useThreadMessages = (threadIdOrUrlParam?: string) => {
  const currentThreadId = useUnifiedStore((state) => state.currentThreadId);
  const threads = useUnifiedStore((state) => state.threads);
  const urlParamToThreadId = useUnifiedStore((state) => state.urlParamToThreadId);
  
  // 解析实际的thread_id：可能是URL参数，需要映射
  const actualThreadId = React.useMemo(() => {
    if (threadIdOrUrlParam) {
      // 首先尝试作为thread_id直接使用
      if (threads.has(threadIdOrUrlParam)) {
        return threadIdOrUrlParam;
      }
      // 然后尝试作为URL参数映射
      const mappedThreadId = urlParamToThreadId.get(threadIdOrUrlParam);
      if (mappedThreadId && threads.has(mappedThreadId)) {
        return mappedThreadId;
      }
    }
    return currentThreadId;
  }, [threadIdOrUrlParam, currentThreadId, threads, urlParamToThreadId]);
  
  return React.useMemo(() => {
    if (!actualThreadId) return [];
    const thread = threads.get(actualThreadId);
    return thread?.messages || [];
  }, [actualThreadId, threads]);
};

export const useThreadArtifacts = (threadIdOrUrlParam?: string) => {
  const currentThreadId = useUnifiedStore((state) => state.currentThreadId);
  const threads = useUnifiedStore((state) => state.threads);
  const getArtifacts = useUnifiedStore((state) => state.getArtifacts);
  const urlParamToThreadId = useUnifiedStore((state) => state.urlParamToThreadId);
  
  // 解析实际的thread_id：可能是URL参数，需要映射
  const actualThreadId = React.useMemo(() => {
    if (threadIdOrUrlParam) {
      // 首先尝试作为thread_id直接使用
      if (threads.has(threadIdOrUrlParam)) {
        return threadIdOrUrlParam;
      }
      // 然后尝试作为URL参数映射
      const mappedThreadId = urlParamToThreadId.get(threadIdOrUrlParam);
      if (mappedThreadId && threads.has(mappedThreadId)) {
        return mappedThreadId;
      }
    }
    return currentThreadId;
  }, [threadIdOrUrlParam, currentThreadId, threads, urlParamToThreadId]);
  
  return React.useMemo(() => {
    if (!actualThreadId) return [];
    return getArtifacts(actualThreadId);
  }, [actualThreadId, threads, getArtifacts]);
};

export const useWorkspaceState = () => {
  return useUnifiedStore((state) => state.workspace);
};

// 兼容旧 API 的 wrapper
export const useMessageIds = (threadIdOrUrlParam?: string) => {
  // 分两步获取，避免 selector 重建
  const currentThreadId = useUnifiedStore((state) => state.currentThreadId);
  const threads = useUnifiedStore((state) => state.threads);
  const urlParamToThreadId = useUnifiedStore((state) => state.urlParamToThreadId);
  
  // 解析实际的thread_id：可能是URL参数，需要映射
  const actualThreadId = React.useMemo(() => {
    if (threadIdOrUrlParam) {
      // 首先尝试作为thread_id直接使用
      if (threads.has(threadIdOrUrlParam)) {
        return threadIdOrUrlParam;
      }
      // 然后尝试作为URL参数映射
      const mappedThreadId = urlParamToThreadId.get(threadIdOrUrlParam);
      if (mappedThreadId && threads.has(mappedThreadId)) {
        return mappedThreadId;
      }
    }
    return currentThreadId;
  }, [threadIdOrUrlParam, currentThreadId, threads, urlParamToThreadId]);
  
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

// 新架构：URL参数相关导出函数
export const setCurrentUrlParam = (urlParam: string | null) => {
  useUnifiedStore.getState().setCurrentUrlParam(urlParam);
};

export const setUrlParamMapping = (urlParam: string, threadId: string) => {
  useUnifiedStore.getState().setUrlParamMapping(urlParam, threadId);
};

export const getThreadIdByUrlParam = (urlParam: string) => {
  return useUnifiedStore.getState().getThreadIdByUrlParam(urlParam);
};

export const useCurrentUrlParam = () => {
  return useUnifiedStore((state) => state.currentUrlParam);
};

export const useSessionState = () => {
  return useUnifiedStore((state) => state.sessionState);
};

export const setSessionState = (sessionState: any) => {
  useUnifiedStore.getState().setSessionState(sessionState);
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

// 🚀 新架构：使用ASK API发送研究请求
export const sendAskMessage = async (
  request: ResearchRequest,
  config?: {
    abortSignal?: AbortSignal;
    onNavigate?: (url: string) => void | Promise<void>;
  }
): Promise<{
  urlParam: string;
  threadId: string;
  workspaceUrl: string;
}> => {
  const state = useUnifiedStore.getState();
  
  // 动态导入必要的工具函数
  const { fetchStream } = await import("~/core/sse");
  const { resolveServiceURL } = await import("~/core/api/resolve-service-url");
  const { generateInitialQuestionIDs, getVisitorId } = await import("~/core/utils");
  const { mergeMessage } = await import("~/core/messages");
  
  try {
    // 🔥 设置响应状态
    state.setResponding(true);
    
    // 🔥 生成前端UUID和访客ID
    const frontendUuid = generateInitialQuestionIDs().frontend_context_uuid;
    const visitorId = getVisitorId();
    
    // 🔥 构建ASK API请求数据
    const requestData = {
      question: request.question,
      ask_type: request.askType,
      frontend_uuid: frontendUuid,
      visitor_id: visitorId,
      user_id: undefined, // TODO: 从认证状态获取
      config: {
        // 🔥 修复：统一使用下划线命名，避免重复字段
        auto_accepted_plan: request.config.autoAcceptedPlan,
        enable_background_investigation: request.config.enableBackgroundInvestigation,
        report_style: request.config.reportStyle,
        enable_deep_thinking: request.config.enableDeepThinking,
        max_plan_iterations: request.config.maxPlanIterations,
        max_step_num: request.config.maxStepNum,
        max_search_results: request.config.maxSearchResults,
        // 🔥 保留扩展配置但排除已映射的字段
        ...Object.fromEntries(
          Object.entries(request.config).filter(([key]) => 
            !['autoAcceptedPlan', 'enableBackgroundInvestigation', 'reportStyle', 
              'enableDeepThinking', 'maxPlanIterations', 'maxStepNum', 'maxSearchResults'].includes(key)
          )
        )
      },
      // followup场景的上下文信息
      ...(request.context && {
        session_id: request.context.sessionId,
        thread_id: request.context.threadId,
        url_param: request.context.urlParam,
      }),
      // 🔥 添加interrupt_feedback支持
      ...(request.interrupt_feedback && {
        interrupt_feedback: request.interrupt_feedback,
      })
    };
    
    console.log("[sendAskMessage] Starting ASK API SSE stream:", {
      askType: request.askType,
      question: request.question.substring(0, 50) + '...',
      frontend_uuid: frontendUuid,
      config: request.config
    });
    
    // 🔥 发起SSE流请求
    const sseStream = fetchStream(
      resolveServiceURL('research/ask?stream=true'),
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestData),
      }
    );
    
    // 🔥 准备返回值变量
    let navigationResult: {
      urlParam: string;
      threadId: string;
      workspaceUrl: string;
    } | null = null;
    
    let currentThreadId: string | null = null;
    let assistantMessage: Message | null = null;
    
    // 🔥 处理SSE事件流 - 重构为LangGraph原生事件处理
    for await (const event of sseStream) {
      // 检查是否被中止
      if (config?.abortSignal?.aborted) {
        console.log("[sendAskMessage] Request aborted");
        break;
      }
      
      console.log("[sendAskMessage] SSE Event:", event.event, event.data);
      
      try {
        const eventData = JSON.parse(event.data);
        
        // 🚀 重构：LangGraph原生事件处理逻辑
        switch (event.event) {
          case 'navigation':
            // 🔥 处理导航事件 - 这是ASK API的核心事件
            if (eventData.url_param && eventData.thread_id && eventData.workspace_url) {
              navigationResult = {
                urlParam: eventData.url_param,
                threadId: eventData.thread_id,
                workspaceUrl: eventData.workspace_url
              };
              
              // 更新store状态
              state.setCurrentUrlParam(eventData.url_param);
              state.setUrlParamMapping(eventData.url_param, eventData.thread_id);
              state.setCurrentThread(eventData.thread_id);
              currentThreadId = eventData.thread_id;
              
              // 🔥 保存session_id到sessionState（如果提供）
              if (eventData.session_id) {
                const currentSessionState = state.sessionState || {
                  sessionMetadata: null,
                  executionHistory: [],
                  currentConfig: null,
                  permissions: null,
                };
                
                const newSessionState = {
                  ...currentSessionState,
                  sessionMetadata: {
                    ...currentSessionState.sessionMetadata,
                    session_id: eventData.session_id,
                    thread_id: eventData.thread_id,
                    url_param: eventData.url_param,
                  }
                };
                
                console.log('🔍 [Navigation Event] Saving session_id:', {
                  eventData_session_id: eventData.session_id,
                  eventData_thread_id: eventData.thread_id,
                  eventData_url_param: eventData.url_param,
                  currentSessionState: currentSessionState,
                  newSessionState: newSessionState
                });
                
                state.setSessionState(newSessionState);
                
                // 🔍 验证sessionState是否正确保存 - 修复：使用实时获取
                const currentStoreState = useUnifiedStore.getState();
                console.log('🔍 [Navigation Event] After setSessionState, store sessionState:', currentStoreState.sessionState);
              } else {
                console.log('⚠️ [Navigation Event] No session_id in eventData:', eventData);
              }
              
              // 创建用户消息（只在initial时创建）
              if (request.askType === 'initial' && currentThreadId) {
                const userMessage: Message = {
                  id: nanoid(),
                  content: request.question,
                  contentChunks: [request.question],
                  role: "user",
                  threadId: currentThreadId,
                  isStreaming: false,
                };
                state.addMessage(currentThreadId, userMessage);
               
               // 创建助手消息用于接收流式内容
               assistantMessage = {
                 id: nanoid(),
                 content: "",
                 contentChunks: [],
                 role: "assistant",
                 threadId: currentThreadId,
                 isStreaming: true,
                 agent: "researcher",
               };
               state.addMessage(currentThreadId, assistantMessage);
             }
             
                           // 调用导航回调
              if (config?.onNavigate) {
                await config.onNavigate(eventData.workspace_url);
              }
           }
           break;
           
         case 'metadata':
           // 🔥 处理元数据事件
           console.log('Execution metadata:', eventData);
           
           // 🔥 修复：合并保存sessionState，避免覆盖session_id等关键信息 - 使用实时获取
           const currentStoreState = useUnifiedStore.getState();
           console.log('🔍 [Metadata Event] Current store sessionState:', currentStoreState.sessionState);
           const currentSessionState = currentStoreState.sessionState || {
             sessionMetadata: null,
             executionHistory: [],
             currentConfig: null,
             permissions: null,
           };
           console.log('🔍 [Metadata Event] Using currentSessionState:', currentSessionState);
           
           // 合并sessionMetadata：保留现有字段，新字段覆盖同名字段
           const mergedSessionMetadata = {
             ...currentSessionState.sessionMetadata,  // 保留现有数据（包括session_id）
             ...eventData,  // 新数据覆盖同名字段
           };
           
           const newSessionState = {
             ...currentSessionState,  // 保留现有sessionState结构
             sessionMetadata: mergedSessionMetadata,  // 合并后的metadata
             currentConfig: request.config,  // 更新当前配置
             executionHistory: currentSessionState.executionHistory || [],  // 保留执行历史
           };
           
           console.log('🔍 [Metadata Event] Merging sessionState:', {
             currentSessionState: currentSessionState,
             eventData: eventData,
             mergedSessionMetadata: mergedSessionMetadata,
             newSessionState: newSessionState,
             session_id_before: currentSessionState.sessionMetadata?.session_id,
             session_id_after: mergedSessionMetadata.session_id,
             session_id_in_eventData: eventData.session_id  // 🔥 恢复：现在metadata事件包含session_id
           });
           
                      state.setSessionState(newSessionState);
           break;
           
         // 🚀 LangGraph原生事件处理 - 纯Store层逻辑，不调用业务事件处理器
         case 'message_chunk':
         case 'tool_calls':
         case 'tool_call_chunks':
         case 'tool_call_result':
         case 'interrupt':
         case 'reask':
         case 'complete':
         case 'error':
           // 🔥 统一使用mergeMessage处理所有LangGraph原生事件
           if (currentThreadId && assistantMessage) {
             // 获取当前消息
             let currentMessage = state.getMessageById(currentThreadId, assistantMessage.id);
             
             if (currentMessage) {
               // 使用mergeMessage合并事件
               const mergedMessage = mergeMessage(currentMessage, {
                 event: event.event,
                 data: eventData
               });
               
               // 更新消息
               state.updateMessage(currentThreadId, assistantMessage.id, mergedMessage);
               
               // 特殊处理：complete事件时停止流式状态
               if (event.event === 'complete') {
                 state.updateMessage(currentThreadId, assistantMessage.id, {
                   isStreaming: false,
                 });
               }
             }
           }
           break;
             
           default:
             console.log(`[sendAskMessage] Unknown event type: ${event.event}`, eventData);
             break;
         }
         
       } catch (parseError) {
         console.error("[sendAskMessage] Failed to parse SSE event data:", parseError);
       }
     }
     
     // 🔥 返回导航结果
     if (!navigationResult) {
       throw new Error("No navigation event received from ASK API");
     }
     
     return navigationResult;
     
   } catch (error) {
     console.error('[sendAskMessage] ASK API SSE stream failed:', error);
     throw error;
   } finally {
     state.setResponding(false);
   }
};