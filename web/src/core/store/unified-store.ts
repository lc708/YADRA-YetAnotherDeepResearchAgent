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
        set((state) => {
          state.sessionState = sessionState;
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

// 新架构：使用研究流式API发送消息
export const sendMessageWithNewAPI = async (
  message: string,
  options?: {
    interruptFeedback?: string;
    resources?: Resource[];
  },
  config?: {
    abortSignal?: AbortSignal;
  }
) => {
  const state = useUnifiedStore.getState();
  const currentUrlParam = state.currentUrlParam;
  const currentThreadId = state.currentThreadId;
  
  if (!currentUrlParam || !currentThreadId) {
    throw new Error("No current URL parameter or thread ID available");
  }
  
  // 动态导入API函数
  const { createResearchStream } = await import("~/core/api/research-stream");
  const { generateInteractionIDs, getVisitorId } = await import("~/core/utils");
  const { buildResearchConfig } = await import("~/core/api/research-stream");
  const { useSettingsStore } = await import("~/core/store/settings-store");
  
  try {
    // 生成交互ID
    const sessionUuid = currentThreadId; // 使用thread_id作为session_uuid
    const contextUuid = generateInteractionIDs(sessionUuid).frontend_context_uuid;
    
    // 构建配置
    const settings = useSettingsStore.getState().general;
    const researchConfig = buildResearchConfig({
      autoAcceptedPlan: settings.autoAcceptedPlan, // 🔥 传递用户的autoAcceptedPlan设置
      enableBackgroundInvestigation: settings.enableBackgroundInvestigation,
      reportStyle: settings.reportStyle,
      enableDeepThinking: settings.enableDeepThinking,
      maxPlanIterations: settings.maxPlanIterations,
      maxStepNum: settings.maxStepNum,
      maxSearchResults: settings.maxSearchResults,
    });
    
    // 准备请求参数
    const request = {
      action: 'continue' as const,
      message,
      urlParam: currentUrlParam,
      frontend_uuid: sessionUuid,
      frontend_context_uuid: contextUuid,
      visitor_id: getVisitorId(),
      user_id: undefined, // TODO: 从认证状态获取
      config: researchConfig,
      context: {
        previousArtifacts: [],
        relatedContext: options?.interruptFeedback || '',
        userFeedbackHistory: [],
      },
      resources: options?.resources || [],
    };
    
    // 设置响应状态
    state.setResponding(true);
    
    // 创建用户消息
    const userMessage: Message = {
      id: nanoid(),
      content: message,
      contentChunks: [message],
      role: "user",
      threadId: currentThreadId,
      isStreaming: false,
      resources: options?.resources || [],
    };
    
    // 添加用户消息到store
    state.addMessage(currentThreadId, userMessage);
    
    // 创建助手消息
    const assistantMessage: Message = {
      id: nanoid(),
      content: "",
      contentChunks: [],
      role: "assistant", 
      threadId: currentThreadId,
      isStreaming: true,
      agent: "researcher",
    };
    
    // 添加助手消息到store
    state.addMessage(currentThreadId, assistantMessage);
    
    // 创建流式连接
    const stream = createResearchStream(request);
    
    // 处理流式响应
    for await (const event of stream) {
      // 检查是否被中止
      if (config?.abortSignal?.aborted) {
        break;
      }
      
      switch (event.type) {
        case 'navigation':
          console.log('Navigation event:', event.data);
          // 处理页面导航
          if ('workspace_url' in event.data && event.data.workspace_url) {
            // 如果需要导航到新页面，这里可以处理
            // 但通常navigation事件是在初始请求时发送的
          }
          break;
          
        case 'metadata':
          console.log('Execution metadata:', event.data);
          // 更新会话元数据
          if (state.sessionState) {
            state.setSessionState({
              ...state.sessionState,
              sessionMetadata: {
                ...state.sessionState.sessionMetadata,
                ...event.data,
              },
            });
          }
          break;
          
        case 'node_start':
          console.log('Node started:', event.data);
          // 可以用于显示当前执行的节点状态
          break;
          
        case 'node_complete':
          console.log('Node completed:', event.data);
          // 可以用于更新节点执行状态
          break;
          
                 case 'plan_generated':
           console.log('Plan generated:', event.data);
           // 创建计划消息
           if ('plan_content' in event.data && typeof event.data.plan_content === 'string') {
             const planMessage: Message = {
               id: nanoid(),
               content: event.data.plan_content,
               contentChunks: [event.data.plan_content],
               role: "assistant",
               threadId: currentThreadId,
               isStreaming: false,
               agent: "planner",
             };
             state.addMessage(currentThreadId, planMessage);
           }
           break;
          
        case 'search_results':
          console.log('Search results:', event.data);
          // 可以用于显示搜索结果或创建搜索结果消息
          break;
          
                 case 'agent_output':
           console.log('Agent output:', event.data);
           // 处理智能体输出
           if ('content' in event.data && 'agent_name' in event.data && 
               typeof event.data.content === 'string' && typeof event.data.agent_name === 'string') {
             // 确保agent_name是有效的agent类型
             const validAgents = ["coordinator", "planner", "researcher", "coder", "reporter", "podcast"] as const;
             const agentName = validAgents.includes(event.data.agent_name as any) 
               ? event.data.agent_name as typeof validAgents[number]
               : "researcher";
             
             const agentMessage: Message = {
               id: nanoid(),
               content: event.data.content,
               contentChunks: [event.data.content],
               role: "assistant",
               threadId: currentThreadId,
               isStreaming: false,
               agent: agentName,
             };
             state.addMessage(currentThreadId, agentMessage);
           }
           break;
          
        case 'progress':
          console.log('Progress update:', event.data);
          // 可以用于更新进度条或状态显示
          break;
          
        case 'message_chunk':
          // 更新助手消息内容
          if ('content' in event.data) {
            const currentContent = state.getMessageById(currentThreadId, assistantMessage.id)?.content || '';
            state.updateMessage(currentThreadId, assistantMessage.id, {
              content: currentContent + event.data.content,
            });
          }
          break;
          
                 case 'artifact':
           console.log('Artifact generated:', event.data);
           // 处理artifact - 创建artifact消息
           if ('artifact_content' in event.data && typeof event.data.artifact_content === 'string') {
             const artifactMessage: Message = {
               id: nanoid(),
               content: event.data.artifact_content,
               contentChunks: [event.data.artifact_content],
               role: "assistant",
               threadId: currentThreadId,
               isStreaming: false,
               agent: "reporter",
             };
             state.addMessage(currentThreadId, artifactMessage);
           }
           break;
          
        case 'complete':
          // 标记消息完成
          state.updateMessage(currentThreadId, assistantMessage.id, {
            isStreaming: false,
          });
          console.log('Execution completed:', event.data);
          break;
          
        case 'error':
          console.error('Stream error:', event.data);
          if ('error_message' in event.data) {
            state.updateMessage(currentThreadId, assistantMessage.id, {
              content: `Error: ${event.data.error_message}`,
              isStreaming: false,
            });
          }
          break;
      }
    }
    
  } catch (error) {
    console.error('Failed to send message with new API:', error);
    throw error;
  } finally {
    state.setResponding(false);
  }
};