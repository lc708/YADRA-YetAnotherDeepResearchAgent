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

// 🚀 ASK API事件处理器类型
export type AskAPIEventHandler = {
  onNavigation?: (data: any) => void | Promise<void>;
  onMetadata?: (data: any) => void | Promise<void>;
  onNodeStart?: (data: any) => void | Promise<void>;
  onNodeComplete?: (data: any) => void | Promise<void>;
  onPlanGenerated?: (data: any) => void | Promise<void>;
  onSearchResults?: (data: any) => void | Promise<void>;
  onAgentOutput?: (data: any) => void | Promise<void>;
  onMessageChunk?: (data: any) => void | Promise<void>;
  onArtifact?: (data: any) => void | Promise<void>;
  onProgress?: (data: any) => void | Promise<void>;
  onInterrupt?: (data: any) => void | Promise<void>;
  onComplete?: (data: any) => void | Promise<void>;
  onError?: (data: any) => void | Promise<void>;
};

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
  
  // 🔥 新增：消息块合并方法
  mergeMessageChunk: (threadId: string, chunkData: {
    execution_id: string;
    agent_name: string;
    chunk_type: string;
    chunk_id: string;
    content: string;
    sequence: number;
    is_final: boolean;
    metadata: any;
    timestamp: string;
  }) => void;
  
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
      
             // 🔥 新增：消息块合并方法 - 实现事件数据合并逻辑
       mergeMessageChunk: (threadId: string, chunkData: {
         execution_id: string;
         agent_name: string;
         chunk_type: string;
         chunk_id: string;
         content: string;
         sequence: number;
         is_final: boolean;
         metadata: any;
         timestamp: string;
       }) => {
         set((state) => {
           const thread = state.threads.get(threadId);
           if (!thread) return;
           
           // 🔥 生成分组键：execution_id + agent_name + chunk_type
           const messageId = `${chunkData.execution_id}-${chunkData.agent_name}-${chunkData.chunk_type}`;
           
           // 查找现有消息
           let existingMessage = thread.messages.find(m => m.id === messageId);
           
           if (existingMessage) {
             // 🔥 合并到现有消息 - 类似merge-message.ts的事件合并逻辑
             
             // 1. 合并content chunks
             existingMessage.contentChunks.push(chunkData.content);
             
             // 2. 更新chunks数组并排序
             const allChunks = existingMessage.metadata?.chunks || [];
             allChunks.push({
               chunk_id: chunkData.chunk_id,
               content: chunkData.content,
               sequence: chunkData.sequence,
               timestamp: chunkData.timestamp,
               metadata: chunkData.metadata,
             });
             allChunks.sort((a: any, b: any) => a.sequence - b.sequence);
             
             // 3. 重新生成完整content
             existingMessage.content = allChunks.map((chunk: any) => chunk.content).join('');
             
             // 4. 🔥 合并事件数据 - URLs, Images, Token info
             const mergedUrls = new Set<string>();
             const mergedImages = new Set<string>();
             let totalTokens = { input: 0, output: 0 };
             let totalCost = 0;
             
             allChunks.forEach((chunk: any) => {
               const meta = chunk.metadata || {};
               // 合并URLs
               if (meta.urls && Array.isArray(meta.urls)) {
                 meta.urls.forEach((url: string) => mergedUrls.add(url));
               }
               // 合并Images  
               if (meta.images && Array.isArray(meta.images)) {
                 meta.images.forEach((img: string) => mergedImages.add(img));
               }
               // 累积Token信息
               if (meta.token_info) {
                 totalTokens.input += meta.token_info.input_tokens || 0;
                 totalTokens.output += meta.token_info.output_tokens || 0;
                 totalCost += meta.token_info.total_cost || 0;
               }
             });
             
             // 5. 🔥 更新Message.resources基于合并后的URLs
             existingMessage.resources = Array.from(mergedUrls).map(url => ({
               uri: url,
               title: url, // 简化处理，实际可能需要从chunk中提取title
             }));
             
             // 6. 更新metadata
             existingMessage.isStreaming = !chunkData.is_final;
             existingMessage.metadata = {
               ...existingMessage.metadata,
               messageChunkGroup: true,
               executionId: chunkData.execution_id,
               chunkType: chunkData.chunk_type,
               chunks: allChunks,
               lastChunkTimestamp: chunkData.timestamp,
               totalChunks: allChunks.length,
               // 🔥 合并后的聚合数据
               mergedData: {
                 urls: Array.from(mergedUrls),
                 images: Array.from(mergedImages),
                 tokenInfo: {
                   input_tokens: totalTokens.input,
                   output_tokens: totalTokens.output,
                   total_cost: totalCost,
                 },
               },
             };
             
           } else {
             // 🔥 创建新消息
             const validAgents = ["coordinator", "planner", "researcher", "coder", "reporter", "podcast"] as const;
             const agentName = validAgents.includes(chunkData.agent_name as any) 
               ? chunkData.agent_name as typeof validAgents[number]
               : "researcher";
             
             // 🔥 初始化事件数据
             const initialUrls = chunkData.metadata?.urls || [];
             const initialImages = chunkData.metadata?.images || [];
             const initialTokenInfo = chunkData.metadata?.token_info || {};
             
             const newMessage: Message = {
               id: messageId,
               content: chunkData.content,
               contentChunks: [chunkData.content],
               role: "assistant" as const,
               threadId: threadId,
               isStreaming: !chunkData.is_final,
               agent: agentName,
               // 🔥 基于URLs生成resources
               resources: initialUrls.map((url: string) => ({
                 uri: url,
                 title: url,
               })),
               metadata: {
                 messageChunkGroup: true,
                 executionId: chunkData.execution_id,
                 chunkType: chunkData.chunk_type,
                 chunks: [{
                   chunk_id: chunkData.chunk_id,
                   content: chunkData.content,
                   sequence: chunkData.sequence,
                   timestamp: chunkData.timestamp,
                   metadata: chunkData.metadata,
                 }],
                 lastChunkTimestamp: chunkData.timestamp,
                 totalChunks: 1,
                 // 🔥 初始化聚合数据
                 mergedData: {
                   urls: initialUrls,
                   images: initialImages,
                   tokenInfo: {
                     input_tokens: initialTokenInfo.input_tokens || 0,
                     output_tokens: initialTokenInfo.output_tokens || 0,
                     total_cost: initialTokenInfo.total_cost || 0,
                   },
                 },
               },
               originalInput: {
                 text: '',
                 locale: 'zh-CN',
                 settings: {},
                 resources: [],
                 timestamp: chunkData.timestamp,
               },
             };
             
             thread.messages.push(newMessage);
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

// 🚀 新架构：使用ASK API发送研究请求
export const sendAskMessage = async (
  request: ResearchRequest,
  eventHandler?: AskAPIEventHandler,
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
    
    // 🔥 处理SSE事件流
    for await (const event of sseStream) {
      // 检查是否被中止
      if (config?.abortSignal?.aborted) {
        console.log("[sendAskMessage] Request aborted");
        break;
      }
      
      console.log("[sendAskMessage] SSE Event:", event.event, event.data);
      
      try {
        const eventData = JSON.parse(event.data);
        
        // 🚀 统一事件处理逻辑
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
              
              // 调用事件处理器
              if (eventHandler?.onNavigation) {
                await eventHandler.onNavigation(eventData);
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
            
            if (eventHandler?.onMetadata) {
              await eventHandler.onMetadata(eventData);
            }
            break;
            
          case 'node_start':
            console.log('Node started:', eventData);
            if (eventHandler?.onNodeStart) {
              await eventHandler.onNodeStart(eventData);
            }
            break;
            
          case 'node_complete':
            console.log('Node completed:', eventData);
            if (eventHandler?.onNodeComplete) {
              await eventHandler.onNodeComplete(eventData);
            }
            break;
            
          case 'plan_generated':
            // 🔥 处理计划生成事件
            console.log('Plan generated:', eventData);
            if (currentThreadId && 'plan_data' in eventData && eventData.plan_data) {
              const planContent = typeof eventData.plan_data === 'string' 
                ? eventData.plan_data 
                : JSON.stringify(eventData.plan_data, null, 2);
                
              const planMessage: Message = {
                id: nanoid(),
                content: planContent,
                contentChunks: [planContent],
                role: "assistant",
                threadId: currentThreadId,
                isStreaming: false,
                agent: "planner",
              };
              state.addMessage(currentThreadId, planMessage);
            }
            
            if (eventHandler?.onPlanGenerated) {
              await eventHandler.onPlanGenerated(eventData);
            }
            break;
            
          case 'search_results':
            // 🔥 处理搜索结果事件
            console.log('Search results:', eventData);
            if (eventHandler?.onSearchResults) {
              await eventHandler.onSearchResults(eventData);
            }
            break;
            
          case 'agent_output':
            // 🔥 处理智能体输出事件
            console.log('Agent output:', eventData);
            if (currentThreadId && 'content' in eventData && 'agent_name' in eventData &&
                typeof eventData.content === 'string' && typeof eventData.agent_name === 'string') {
              
              // 确保agent_name是有效的agent类型
              const validAgents = ["coordinator", "planner", "researcher", "coder", "reporter", "podcast"] as const;
              const agentName = validAgents.includes(eventData.agent_name as any)
                ? eventData.agent_name as typeof validAgents[number]
                : "researcher";
              
              const agentMessage: Message = {
                id: nanoid(),
                content: eventData.content,
                contentChunks: [eventData.content],
                role: "assistant",
                threadId: currentThreadId,
                isStreaming: false,
                agent: agentName,
              };
              state.addMessage(currentThreadId, agentMessage);
            }
            
            if (eventHandler?.onAgentOutput) {
              await eventHandler.onAgentOutput(eventData);
            }
            break;
            
          case 'message_chunk':
            // 🔥 处理消息块事件
            if (currentThreadId && assistantMessage && 'content' in eventData) {
              const currentContent = state.getMessageById(currentThreadId, assistantMessage.id)?.content || '';
              state.updateMessage(currentThreadId, assistantMessage.id, {
                content: currentContent + eventData.content,
              });
            }
            
            if (eventHandler?.onMessageChunk) {
              await eventHandler.onMessageChunk(eventData);
            }
            break;
            
          case 'artifact':
            // 🔥 处理工件事件
            console.log('Artifact generated:', eventData);
            if (currentThreadId && 'content' in eventData && typeof eventData.content === 'string') {
              const artifactMessage: Message = {
                id: nanoid(),
                content: eventData.content,
                contentChunks: [eventData.content],
                role: "assistant",
                threadId: currentThreadId,
                isStreaming: false,
                agent: "reporter",
              };
              state.addMessage(currentThreadId, artifactMessage);
            }
            
            if (eventHandler?.onArtifact) {
              await eventHandler.onArtifact(eventData);
            }
            break;
            
          case 'progress':
            // 🔥 处理进度事件
            console.log('Progress update:', eventData);
            if (eventHandler?.onProgress) {
              await eventHandler.onProgress(eventData);
            }
            break;
            
          case 'interrupt':
            // 🔥 处理中断事件
            console.log('Interrupt event:', eventData);
            if (currentThreadId && assistantMessage) {
              // 标记需要用户交互
              state.setInterruptMessage(currentThreadId, assistantMessage.id);
              
              // 🔥 保存完整的interrupt数据 - 修正字段名匹配
              if ('id' in eventData && 'content' in eventData && 'options' in eventData) {
                const interruptData = {
                  interruptId: eventData.id as string,  // 🔥 修正：id -> interruptId
                  message: eventData.content as string,  // 🔥 修正：content -> message
                  options: eventData.options as Array<{text: string; value: string}>,
                  threadId: eventData.thread_id as string,
                  executionId: eventData.execution_id || '', // 可能不存在
                  nodeName: eventData.node_name || 'human_feedback', // 可能不存在
                  timestamp: eventData.timestamp || new Date().toISOString(), // 可能不存在
                  messageId: assistantMessage.id,
                };
                state.setCurrentInterrupt(currentThreadId, interruptData);
                console.log('🔔 Interrupt data saved to store:', interruptData);
              } else {
                console.warn('⚠️ Interrupt event missing required fields:', eventData);
              }
            }
            
            if (eventHandler?.onInterrupt) {
              await eventHandler.onInterrupt(eventData);
            }
            break;
            
          case 'complete':
            // 🔥 处理完成事件
            console.log('Execution completed:', eventData);
            if (currentThreadId && assistantMessage) {
              state.updateMessage(currentThreadId, assistantMessage.id, {
                isStreaming: false,
              });
            }
            
            if (eventHandler?.onComplete) {
              await eventHandler.onComplete(eventData);
            }
            break;
            
          case 'error':
            // 🔥 处理错误事件
            console.error('Stream error:', eventData);
            if (currentThreadId && assistantMessage && 'error_message' in eventData) {
              state.updateMessage(currentThreadId, assistantMessage.id, {
                content: `Error: ${eventData.error_message}`,
                isStreaming: false,
              });
            }
            
            if (eventHandler?.onError) {
              await eventHandler.onError(eventData);
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