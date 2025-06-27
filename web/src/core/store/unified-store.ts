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
import type { ChatEvent } from "~/core/api";
import type { Artifact } from "~/lib/supa";
import { nanoid } from "nanoid";
import React from "react";
// 🔥 state-adapter已废弃，artifact转换逻辑待重新设计

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

// 🚀 添加业务状态类型定义
export interface BusinessPlan {
  id: string;
  title: string;
  objective: string;
  steps: BusinessPlanStep[];
  status: "pending" | "approved" | "rejected" | "completed" | "error";
  estimatedDuration?: number;
  complexity: "simple" | "moderate" | "complex" | "expert";
  confidence: number; // 0-1
  createdAt: Date;
  updatedAt?: Date;
  metadata?: {
    sources?: number;
    tools?: string[];
    keywords?: string[];
    locale?: string;
  };
}

export interface BusinessPlanStep {
  id: string;
  title: string;
  description: string;
  estimatedTime?: number;
  dependencies?: string[];
  priority: "low" | "medium" | "high" | "critical";
  status?: "pending" | "completed" | "error" | "loading";
}

export interface ToolCallResult {
  id: string;
  toolName: string;
  args: any;
  result: string;
  timestamp: string;
  messageId: string;
  status: "completed" | "error" | "pending";
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
  
  // 🚀 新增：三段式消息处理函数 - 基于DEERFLOW参考案例
  appendMessage: (threadId: string, message: Message) => void;
  existsMessage: (threadId: string, messageId: string) => boolean;
  getMessage: (threadId: string, messageId: string) => Message | undefined;
  findMessageByToolCallId: (threadId: string, toolCallId: string) => Message | undefined;
  
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
  
  // 🚀 新增：业务状态派生方法
  getCurrentPlan: (threadId: string) => BusinessPlan | null;
  getToolCallResults: (threadId: string, toolName?: string) => ToolCallResult[];
  getResearchProgress: (threadId: string) => { 
    stage: string; 
    progress: number; 
    currentActivity: string | null;
  };
  getFinalReport: (threadId: string) => Message | null;
  getResearchActivities: (threadId: string) => Message[];
};

// 创建 Store
export const useUnifiedStore = create<UnifiedStore>()(
  subscribeWithSelector(
    immer((set, get) => ({
      // 初始状态
      threads: new Map() as Map<string, ThreadState>,
      currentThreadId: null as string | null,
      currentUrlParam: null as string | null,
      urlParamToThreadId: new Map() as Map<string, string>,
      sessionState: null as UnifiedStore['sessionState'],
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
            // 🔥 使用不可变更新：创建新的消息数组和thread对象
            const newMessages = [...thread.messages, message];
            const newThread = { ...thread, messages: newMessages };
            
            // 🔥 创建新的threads Map
            const newThreads = new Map(state.threads);
            newThreads.set(threadId, newThread);
            
            return { ...state, threads: newThreads };
          }
        });
      },
      
                   updateMessage: (threadId: string, messageId: string, update: Partial<Message>) => {
        set((state) => {
          const thread = state.threads.get(threadId);
          if (thread) {
            const messageIndex = thread.messages.findIndex(m => m.id === messageId);
            if (messageIndex !== -1 && thread.messages[messageIndex]) {
              // 🔥 使用不可变更新：创建新的消息对象和新的消息数组
              const updatedMessage = { ...thread.messages[messageIndex], ...update };
              const newMessages = [...thread.messages];
              newMessages[messageIndex] = updatedMessage;
              
              // 🔥 创建新的thread对象
              const newThread = { ...thread, messages: newMessages };
              
              // 🔥 创建新的threads Map
              const newThreads = new Map(state.threads);
              newThreads.set(threadId, newThread);
              
              return { ...state, threads: newThreads };
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
            // 🔥 使用不可变更新：保持一致性
            const newMetadata = { ...thread.metadata, ongoingResearchId: researchId };
            const newThread = { ...thread, metadata: newMetadata };
            const newThreads = new Map(state.threads);
            newThreads.set(threadId, newThread);
            return { ...state, threads: newThreads };
          }
        });
      },
      
      openResearch: (threadId: string, researchId: string | null) => {
        set((state) => {
          const thread = state.threads.get(threadId);
          if (thread) {
            // 🔥 使用不可变更新：保持一致性
            const newMetadata = { ...thread.metadata, openResearchId: researchId };
            const newThread = { ...thread, metadata: newMetadata };
            const newThreads = new Map(state.threads);
            newThreads.set(threadId, newThread);
            return { ...state, threads: newThreads };
          }
        });
      },
      
      addResearch: (threadId: string, researchId: string, planMessageId: string) => {
        set((state) => {
          const thread = state.threads.get(threadId);
          if (!thread) return;
          
          // 🔥 使用不可变更新：创建新的数组和Map
          const newResearchIds = [...thread.metadata.researchIds, researchId];
          const newPlanMessageIds = new Map(thread.metadata.planMessageIds);
          newPlanMessageIds.set(researchId, planMessageId);
          
          // 🔥 创建新的metadata和thread对象
          const newMetadata = {
            ...thread.metadata,
            researchIds: newResearchIds,
            planMessageIds: newPlanMessageIds,
            ongoingResearchId: researchId
          };
          
          const newThread = { ...thread, metadata: newMetadata };
          
          // 🔥 创建新的threads Map
          const newThreads = new Map(state.threads);
          newThreads.set(threadId, newThread);
          
          return { ...state, threads: newThreads };
        });
      },
      
      setResearchReport: (threadId: string, researchId: string, reportMessageId: string) => {
        set((state) => {
          const thread = state.threads.get(threadId);
          if (thread) {
            // 🔥 使用不可变更新：创建新的Map
            const newReportMessageIds = new Map(thread.metadata.reportMessageIds);
            newReportMessageIds.set(researchId, reportMessageId);
            
            // 🔥 创建新的metadata和thread对象
            const newMetadata = {
              ...thread.metadata,
              reportMessageIds: newReportMessageIds
            };
            
            const newThread = { ...thread, metadata: newMetadata };
            
            // 🔥 创建新的threads Map
            const newThreads = new Map(state.threads);
            newThreads.set(threadId, newThread);
            
            return { ...state, threads: newThreads };
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
            // 🔥 使用不可变更新：保持一致性
            const newUi = { ...thread.ui, lastInterruptMessageId: messageId };
            const newThread = { ...thread, ui: newUi };
            const newThreads = new Map(state.threads);
            newThreads.set(threadId, newThread);
            return { ...state, threads: newThreads };
          }
        });
      },
      
      setWaitingForFeedback: (threadId: string, messageId: string | null) => {
        set((state) => {
          const thread = state.threads.get(threadId);
          if (thread) {
            // 🔥 使用不可变更新：保持一致性
            const newUi = { ...thread.ui, waitingForFeedbackMessageId: messageId };
            const newThread = { ...thread, ui: newUi };
            const newThreads = new Map(state.threads);
            newThreads.set(threadId, newThread);
            return { ...state, threads: newThreads };
          }
        });
      },
      
      // 🔥 添加interrupt事件管理方法
      setCurrentInterrupt: (threadId: string, interruptData: ThreadState['ui']['currentInterrupt']) => {
        set((state) => {
          const thread = state.threads.get(threadId);
          if (thread) {
            // 🔥 使用不可变更新：保持一致性
            const newUi = { ...thread.ui, currentInterrupt: interruptData };
            const newThread = { ...thread, ui: newUi };
            const newThreads = new Map(state.threads);
            newThreads.set(threadId, newThread);
            return { ...state, threads: newThreads };
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
            // 🔥 使用不可变更新：保持一致性
            const newUi = { ...thread.ui, currentInterrupt: null };
            const newThread = { ...thread, ui: newUi };
            const newThreads = new Map(state.threads);
            newThreads.set(threadId, newThread);
            return { ...state, threads: newThreads };
          }
        });
      },
      
      // 工作区操作
      setWorkspaceState: (update: Partial<UnifiedStore['workspace']>) => {
        set((state) => {
          // 🔥 使用不可变更新：创建新的workspace对象
          return {
            ...state,
            workspace: { ...state.workspace, ...update }
          };
        });
      },
      
      // 派生数据
      getArtifacts: (threadId: string): Artifact[] => {
        // 🔥 暂时返回空数组，artifact转换逻辑待重新设计
        return [];
      },
      
      getMessageById: (threadId: string, messageId: string) => {
        const thread = get().threads.get(threadId);
        return thread?.messages.find((m) => m.id === messageId);
      },
      
      // 🚀 新增：业务状态派生方法
      getCurrentPlan: (threadId: string): BusinessPlan | null => {
        const thread = get().threads.get(threadId);
        if (!thread) return null;
        
        // 🔥 修复：直接从LangGraph原生消息中获取Plan数据
        const projectmanagerMessages = thread.messages.filter(msg =>
          msg.langGraphMetadata?.agent === 'projectmanager' && msg.content
        );
        
        if (projectmanagerMessages.length === 0) return null;
        
        const latestPlanMessage = projectmanagerMessages[projectmanagerMessages.length - 1];
        if (!latestPlanMessage?.content) return null;
        
        // 🔥 新增：跳过正在流式传输的消息，避免解析不完整的JSON
        if (latestPlanMessage.isStreaming) {
          return null; // 流式消息还未完成，跳过解析
        }
        
        try {
          // 🔥 修复：从流式内容中提取JSON部分
          let jsonContent = latestPlanMessage.content.trim();
          
          // 🔥 查找JSON的开始和结束位置
          const jsonStart = jsonContent.indexOf('{');
          if (jsonStart === -1) {
            console.warn('❌ No JSON object found in message.content');
            return null;
          }
          
          // 🔥 从JSON开始位置截取内容
          jsonContent = jsonContent.substring(jsonStart);
          
          // 🔥 查找JSON的结束位置（最后一个完整的}）
          let braceCount = 0;
          let jsonEnd = -1;
          
          for (let i = 0; i < jsonContent.length; i++) {
            if (jsonContent[i] === '{') {
              braceCount++;
            } else if (jsonContent[i] === '}') {
              braceCount--;
              if (braceCount === 0) {
                jsonEnd = i + 1;
                break;
              }
            }
          }
          
          if (jsonEnd === -1) {
            // 🔥 修复：对于非流式消息，如果JSON不完整，只输出调试信息而不是警告
            console.debug('❌ No complete JSON object found in message.content (message completed but JSON incomplete)');
            return null;
          }
          
          // 🔥 提取完整的JSON字符串
          const jsonString = jsonContent.substring(0, jsonEnd);
          
          // 🔥 解析JSON
          const backendPlan = JSON.parse(jsonString);
          
          if (!backendPlan || !backendPlan.title || !backendPlan.steps) {
            console.warn('❌ Invalid plan structure in extracted JSON:', backendPlan);
            return null;
          }
          
          // 🔥 转换为标准的BusinessPlan对象
          const steps: BusinessPlanStep[] = (backendPlan.steps || []).map((step: any, index: number) => ({
            id: `step-${index + 1}`,
            title: step.title || `步骤 ${index + 1}`,
            description: step.description || '无描述',
            priority: step.execution_res ? 'high' as const : 'medium' as const,
            status: step.execution_res ? 'completed' as const : 'pending' as const,
            estimatedTime: 15 // 默认估算时间
          }));
          
          // 🔥 使用LangGraph原生数据构建BusinessPlan
          const planId = `plan-${latestPlanMessage.id}`;
          const planTitle = backendPlan.title || '研究计划';
          const planObjective = backendPlan.thought || '研究目标';
          
          return {
            id: planId,
            title: planTitle,
            objective: planObjective,
            steps: steps,
            status: 'pending' as const,
            estimatedDuration: steps.length * 15, // 基于步骤数估算总时长
            complexity: steps.length <= 2 ? 'simple' as const : 
                       steps.length <= 4 ? 'moderate' as const : 'complex' as const,
            confidence: backendPlan.has_enough_context ? 0.9 : 0.7,
            createdAt: new Date(latestPlanMessage.langGraphMetadata?.timestamp || Date.now()),
            metadata: {
              sources: 0,
              tools: ['tavily_search'],
              keywords: [],
              locale: backendPlan.locale || 'zh-CN'
            }
          };
          
        } catch (error) {
          console.warn('❌ Failed to parse plan JSON from message.content:', error, latestPlanMessage.content);
          return null;
        }
      },
      
      getToolCallResults: (threadId: string, toolName?: string): ToolCallResult[] => {
        const thread = get().threads.get(threadId);
        if (!thread) return [];
        
        const results: ToolCallResult[] = [];
        
        // 遍历所有消息，查找工具调用结果
        for (const message of thread.messages) {
          if (message.toolCalls && message.toolCalls.length > 0) {
            for (const toolCall of message.toolCalls) {
              // 如果指定了toolName，则过滤
              if (toolName && toolCall.name !== toolName) continue;
              
              // 只返回有结果的工具调用
              if (toolCall.result) {
                results.push({
                  id: toolCall.id,
                  toolName: toolCall.name,
                  args: toolCall.args,
                  result: toolCall.result,
                  timestamp: message.langGraphMetadata?.timestamp || new Date().toISOString(),
                  messageId: message.id,
                  status: 'completed'
                });
              }
            }
          }
        }
        
        // 按时间戳排序
        return results.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
      },
      
      getResearchProgress: (threadId: string) => {
        const thread = get().threads.get(threadId);
        if (!thread) return { stage: 'idle', progress: 0, currentActivity: null };
        
        // 🔥 修复：使用LangGraph原生字段分析研究阶段
        const hasPlanning = thread.messages.some(m => m.langGraphMetadata?.agent === 'projectmanager');
        const hasResearch = thread.messages.some(m => m.langGraphMetadata?.agent === 'researcher');
        const hasCoding = thread.messages.some(m => m.langGraphMetadata?.agent === 'coder');
        const hasReport = thread.messages.some(m => m.langGraphMetadata?.agent === 'reporter');
        
        let stage = 'idle';
        let progress = 0;
        let currentActivity: string | null = null;
        
        if (hasReport) {
          stage = 'reporting';
          progress = 90;
          currentActivity = '生成研究报告';
        } else if (hasCoding) {
          stage = 'analysis';
          progress = 70;
          currentActivity = '数据分析处理';
        } else if (hasResearch) {
          stage = 'research';
          progress = 50;
          currentActivity = '深度研究调查';
        } else if (hasPlanning) {
          stage = 'planning';
          progress = 20;
          currentActivity = '制定研究计划';
        }
        
        // 检查是否有正在流式传输的消息
        const streamingMessage = thread.messages.find(m => m.isStreaming);
        if (streamingMessage) {
          currentActivity = `正在执行: ${streamingMessage.langGraphMetadata?.agent || '研究任务'}`;
        }
        
        return { stage, progress, currentActivity };
      },
      
      getFinalReport: (threadId: string): Message | null => {
        const thread = get().threads.get(threadId);
        if (!thread) return null;
        
        // 🔥 修复：使用LangGraph原生字段查找reporter生成的最终报告
        // 🔥 关键修复：只返回已完成流式传输且内容完整的报告
        const reportMessages = thread.messages.filter(m => 
          m.langGraphMetadata?.agent === 'reporter' && 
          !m.isStreaming &&  // 确保流式传输已完成
          m.content && m.content.trim().length > 100  // 确保内容完整
        );
        if (reportMessages.length === 0) return null;
        
        // 返回最新的完整报告消息
        return reportMessages[reportMessages.length - 1] || null;
      },
      
      getResearchActivities: (threadId: string): Message[] => {
        const thread = get().threads.get(threadId);
        if (!thread) return [];
        
        // 🔥 修复：使用LangGraph原生字段返回所有研究相关的消息
        return thread.messages.filter(m => 
          m.role === 'assistant' && 
          m.langGraphMetadata?.agent && 
          ['researcher', 'coder', 'projectmanager', 'reporter'].includes(m.langGraphMetadata.agent)
        );
      },
      
      // 🚀 新增：三段式消息处理函数 - 基于DEERFLOW参考案例
      appendMessage: (threadId: string, message: Message) => {
        set((state) => {
          const thread = state.threads.get(threadId);
          if (thread) {
            const newMessages = [...thread.messages, message];
            const newThread = { ...thread, messages: newMessages };
            const newThreads = new Map(state.threads);
            newThreads.set(threadId, newThread);
            return { ...state, threads: newThreads };
          }
        });
      },
      
      existsMessage: (threadId: string, messageId: string) => {
        const thread = get().threads.get(threadId);
        return thread?.messages.some(m => m.id === messageId) || false;
      },
      
      getMessage: (threadId: string, messageId: string) => {
        const thread = get().threads.get(threadId);
        return thread?.messages.find(m => m.id === messageId);
      },
      
      findMessageByToolCallId: (threadId: string, toolCallId: string) => {
        const thread = get().threads.get(threadId);
        return thread?.messages.find(m => m.toolCalls?.some(tc => tc.id === toolCallId) || false);
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
  // 🔥 优化：使用选择性订阅，只订阅特定thread的消息
  return useUnifiedStore(
    useShallow((state) => {
      // 解析实际的thread_id
      let actualThreadId = threadIdOrUrlParam;
      
      if (threadIdOrUrlParam) {
        // 首先尝试作为thread_id直接使用
        if (!state.threads.has(threadIdOrUrlParam)) {
          // 然后尝试作为URL参数映射
          const mappedThreadId = state.urlParamToThreadId.get(threadIdOrUrlParam);
          if (mappedThreadId && state.threads.has(mappedThreadId)) {
            actualThreadId = mappedThreadId;
          }
        }
             } else {
         actualThreadId = state.currentThreadId || undefined;
       }
      
      if (!actualThreadId) return [];
      const thread = state.threads.get(actualThreadId);
      return thread?.messages || [];
    })
  );
};

export const useThreadArtifacts = (threadIdOrUrlParam?: string) => {
  // 🔥 修复无限循环：将逻辑移到store层的selector中，避免Map对象依赖
  return useUnifiedStore((state) => {
    // 在selector内部解析thread_id，避免Map对象作为依赖项
    let actualThreadId = threadIdOrUrlParam;
    
    if (threadIdOrUrlParam) {
      // 首先尝试作为thread_id直接使用
      if (!state.threads.has(threadIdOrUrlParam)) {
        // 然后尝试作为URL参数映射
        const mappedThreadId = state.urlParamToThreadId.get(threadIdOrUrlParam);
        if (mappedThreadId && state.threads.has(mappedThreadId)) {
          actualThreadId = mappedThreadId;
        }
      }
    } else {
      actualThreadId = state.currentThreadId || undefined;
    }
    
    if (!actualThreadId) return [];
    return state.getArtifacts(actualThreadId);
  });
};

export const useWorkspaceState = () => {
  return useUnifiedStore((state) => state.workspace);
};

// 兼容旧 API 的 wrapper
export const useMessageIds = (threadIdOrUrlParam?: string) => {
  // 🔥 修复无限循环：将逻辑移到store层的selector中，避免Map对象依赖
  return useUnifiedStore(
    useShallow((state) => {
      // 在selector内部解析thread_id，避免Map对象作为依赖项
      let actualThreadId = threadIdOrUrlParam;
      
      if (threadIdOrUrlParam) {
        // 首先尝试作为thread_id直接使用
        if (!state.threads.has(threadIdOrUrlParam)) {
          // 然后尝试作为URL参数映射
          const mappedThreadId = state.urlParamToThreadId.get(threadIdOrUrlParam);
          if (mappedThreadId && state.threads.has(mappedThreadId)) {
            actualThreadId = mappedThreadId;
          }
        }
      } else {
        actualThreadId = state.currentThreadId || undefined;
      }
      
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
  return useUnifiedStore((state) => ({
    setConversationVisible: (visible: boolean) =>
      state.setWorkspaceState({ conversationVisible: visible }),
    setArtifactsVisible: (visible: boolean) =>
      state.setWorkspaceState({ artifactsVisible: visible }),
    setHistoryVisible: (visible: boolean) =>
      state.setWorkspaceState({ historyVisible: visible }),
    setPodcastVisible: (visible: boolean) =>
      state.setWorkspaceState({ podcastVisible: visible }),
    setDebugVisible: (visible: boolean) =>
      state.setWorkspaceState({ debugVisible: visible }),
    setFeedback: (feedback: { option: { text: string; value: string } } | null) =>
      state.setWorkspaceState({ feedback }),
    clearFeedback: () => state.setWorkspaceState({ feedback: null }),
  }));
};

// 🚀 新增：业务状态Hook接口
export const useCurrentPlan = (threadIdOrUrlParam?: string) => {
  // 🔥 修复无限循环：使用useShallow确保引用稳定性
  return useUnifiedStore(
    useShallow((state) => {
      // 在selector内部解析thread_id，避免Map对象作为依赖项
      let actualThreadId = threadIdOrUrlParam;
      
      if (threadIdOrUrlParam) {
        // 首先尝试作为thread_id直接使用
        if (!state.threads.has(threadIdOrUrlParam)) {
          // 然后尝试作为URL参数映射
          const mappedThreadId = state.urlParamToThreadId.get(threadIdOrUrlParam);
          if (mappedThreadId && state.threads.has(mappedThreadId)) {
            actualThreadId = mappedThreadId;
          }
        }
      } else {
        actualThreadId = state.currentThreadId || undefined;
      }
      
      if (!actualThreadId) return null;
      
      // 🔥 直接在selector中查找消息，避免调用getCurrentPlan方法
      const thread = state.threads.get(actualThreadId);
      if (!thread) return null;
      
      // 查找最新的projectmanager消息
      const projectmanagerMessages = thread.messages.filter(msg =>
        msg.langGraphMetadata?.agent === 'projectmanager' && msg.content
      );
      
      if (projectmanagerMessages.length === 0) return null;
      
      const latestPlanMessage = projectmanagerMessages[projectmanagerMessages.length - 1];
      if (!latestPlanMessage) return null;
      
      // 🔥 返回稳定的标识信息，让组件自行决定是否需要解析
      return {
        messageId: latestPlanMessage.id,
        content: latestPlanMessage.content,
        isStreaming: latestPlanMessage.isStreaming || false,
        timestamp: latestPlanMessage.langGraphMetadata?.timestamp
      };
    })
  );
};

export const useToolCallResults = (threadIdOrUrlParam?: string, toolName?: string) => {
  // 🔥 修复无限循环：将逻辑移到store层的selector中，避免Map对象依赖
  return useUnifiedStore((state) => {
    // 在selector内部解析thread_id，避免Map对象作为依赖项
    let actualThreadId = threadIdOrUrlParam;
    
    if (threadIdOrUrlParam) {
      // 首先尝试作为thread_id直接使用
      if (!state.threads.has(threadIdOrUrlParam)) {
        // 然后尝试作为URL参数映射
        const mappedThreadId = state.urlParamToThreadId.get(threadIdOrUrlParam);
        if (mappedThreadId && state.threads.has(mappedThreadId)) {
          actualThreadId = mappedThreadId;
        }
      }
    } else {
      actualThreadId = state.currentThreadId || undefined;
    }
    
    if (!actualThreadId) return [];
    return state.getToolCallResults(actualThreadId, toolName);
  });
};

export const useResearchProgress = (threadIdOrUrlParam?: string) => {
  // 🔥 修复无限循环：将逻辑移到store层的selector中，避免Map对象依赖
  return useUnifiedStore((state) => {
    // 在selector内部解析thread_id，避免Map对象作为依赖项
    let actualThreadId = threadIdOrUrlParam;
    
    if (threadIdOrUrlParam) {
      // 首先尝试作为thread_id直接使用
      if (!state.threads.has(threadIdOrUrlParam)) {
        // 然后尝试作为URL参数映射
        const mappedThreadId = state.urlParamToThreadId.get(threadIdOrUrlParam);
        if (mappedThreadId && state.threads.has(mappedThreadId)) {
          actualThreadId = mappedThreadId;
        }
      }
    } else {
      actualThreadId = state.currentThreadId || undefined;
    }
    
    if (!actualThreadId) return { stage: 'idle', progress: 0, currentActivity: null };
    return state.getResearchProgress(actualThreadId);
  });
};

export const useFinalReport = (threadIdOrUrlParam?: string) => {
  // 🔥 修复无限循环：将逻辑移到store层的selector中，避免Map对象依赖
  return useUnifiedStore((state) => {
    // 在selector内部解析thread_id，避免Map对象作为依赖项
    let actualThreadId = threadIdOrUrlParam;
    
    if (threadIdOrUrlParam) {
      // 首先尝试作为thread_id直接使用
      if (!state.threads.has(threadIdOrUrlParam)) {
        // 然后尝试作为URL参数映射
        const mappedThreadId = state.urlParamToThreadId.get(threadIdOrUrlParam);
        if (mappedThreadId && state.threads.has(mappedThreadId)) {
          actualThreadId = mappedThreadId;
        }
      }
    } else {
      actualThreadId = state.currentThreadId || undefined;
    }
    
    if (!actualThreadId) return null;
    return state.getFinalReport(actualThreadId);
  });
};

export const useResearchActivities = (threadIdOrUrlParam?: string) => {
  // 🔥 修复无限循环：将逻辑移到store层的selector中，避免Map对象依赖
  return useUnifiedStore((state) => {
    // 在selector内部解析thread_id，避免Map对象作为依赖项
    let actualThreadId = threadIdOrUrlParam;
    
    if (threadIdOrUrlParam) {
      // 首先尝试作为thread_id直接使用
      if (!state.threads.has(threadIdOrUrlParam)) {
        // 然后尝试作为URL参数映射
        const mappedThreadId = state.urlParamToThreadId.get(threadIdOrUrlParam);
        if (mappedThreadId && state.threads.has(mappedThreadId)) {
          actualThreadId = mappedThreadId;
        }
      }
    } else {
      actualThreadId = state.currentThreadId || undefined;
    }
    
    if (!actualThreadId) return [];
    return state.getResearchActivities(actualThreadId);
  });
};

// 🚀 新增：当前interrupt状态Hook
export const useCurrentInterrupt = (threadIdOrUrlParam?: string) => {
  // 🔥 修复无限循环：将逻辑移到store层的selector中，避免Map对象依赖
  return useUnifiedStore((state) => {
    // 在selector内部解析thread_id，避免Map对象作为依赖项
    let actualThreadId = threadIdOrUrlParam;
    
    if (threadIdOrUrlParam) {
      // 首先尝试作为thread_id直接使用
      if (!state.threads.has(threadIdOrUrlParam)) {
        // 然后尝试作为URL参数映射
        const mappedThreadId = state.urlParamToThreadId.get(threadIdOrUrlParam);
        if (mappedThreadId && state.threads.has(mappedThreadId)) {
          actualThreadId = mappedThreadId;
        }
      }
    } else {
      actualThreadId = state.currentThreadId || undefined;
    }
    
    if (!actualThreadId) return null;
    return state.getCurrentInterrupt(actualThreadId);
  });
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
    
    // 🔥 获取认证信息
    const { supabase } = await import('~/lib/supa');
    const { data: { session } } = await supabase.auth.getSession();
    
    // 🔥 准备请求头（包含认证）
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    
    if (session?.access_token) {
      headers['Authorization'] = `Bearer ${session.access_token}`;
    }
    
    // 🔥 发起SSE流请求
    const sseStream = fetchStream(
      resolveServiceURL('research/ask?stream=true'),
      {
        method: 'POST',
        headers,
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
               
               // 🔥 修复：为每次请求创建必要的消息
               if (currentThreadId) {
                 // 对于initial请求，创建用户消息
                 if (request.askType === 'initial') {
                   const userMessage: Message = {
                     id: nanoid(),
                     content: request.question,
                     contentChunks: [request.question],
                     role: "user",
                     threadId: currentThreadId,
                     isStreaming: false,
                   };
                   state.addMessage(currentThreadId, userMessage);
                 }
                 
                 // 🔥 对于followup请求，如果有interrupt_feedback，也创建用户消息记录
                 if (request.askType === 'followup' && request.interrupt_feedback) {
                   const feedbackMessage: Message = {
                     id: nanoid(),
                     content: `[${request.interrupt_feedback}]${request.question ? ' ' + request.question : ''}`,
                     contentChunks: [`[${request.interrupt_feedback}]${request.question ? ' ' + request.question : ''}`],
                     role: "user",
                     threadId: currentThreadId,
                     isStreaming: false,
                     interruptFeedback: request.interrupt_feedback,
                   };
                   state.addMessage(currentThreadId, feedbackMessage);
                 }
                
                 // 🚀 方案A：移除单一助手消息创建 - 改为基于eventData.id的动态消息创建
                // 不再预先创建助手消息，而是在收到LangGraph事件时动态创建
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
            
                  // 🚀 方案A：基于DEERFLOW的三段式处理逻辑
          case 'message_chunk':
         case 'tool_calls':
         case 'tool_call_chunks':
         case 'tool_call_result':
          case 'interrupt':
         case 'reask':
          case 'complete':
         case 'error':
           // 🚀 关键：使用后端提供的eventData.id而不是单一assistantMessage.id
            if (currentThreadId && eventData.id) {
             const messageId = eventData.id;
             let message: Message | undefined;
             
             // 步骤1：消息初始化判断 - 基于DEERFLOW参考案例
             if (event.event === "tool_call_result") {
               // 工具调用结果需要查找对应的工具调用消息
               message = state.findMessageByToolCallId(currentThreadId, eventData.tool_call_id);
             } else if (!state.existsMessage(currentThreadId, messageId)) {
               // 步骤2：创建新消息容器（appendMessage的职责）
               message = {
                 id: messageId,
                 threadId: currentThreadId,
                 agent: eventData.agent,  // 🚀 关键：使用动态agent字段
                 role: eventData.role || "assistant",
                 content: "",
                 contentChunks: [],
                 isStreaming: true,
                 langGraphMetadata: {
                   agent: eventData.agent,
                   timestamp: eventData.timestamp || new Date().toISOString(),
                   execution_id: eventData.execution_id,
                 }
               };
               state.appendMessage(currentThreadId, message);  // 调用appendMessage
             }
             
             // 获取消息（新创建的或已存在的）
             message = message || state.getMessage(currentThreadId, messageId);
             
             if (message) {
               // 步骤3：数据合并（mergeMessage的职责）
               const mergedMessage = mergeMessage(message, {
                 event: event.event,
                 data: eventData
               } as ChatEvent);
               
               // 步骤4：状态同步（updateMessage的职责）
               state.updateMessage(currentThreadId, messageId, mergedMessage);
               
               // 🔥 特殊处理：interrupt事件时设置currentInterrupt状态
               if (event.event === 'interrupt') {
                 const interruptData = {
                   interruptId: eventData.id || nanoid(),
                   message: eventData.content || "Please Review the Plan.",
                   options: eventData.options || [],
                   threadId: currentThreadId,
                   executionId: eventData.execution_id || "",
                   nodeName: eventData.node_name || "",
                   timestamp: new Date().toISOString(),
                   messageId: messageId  // 使用动态messageId
                 };
                 state.setCurrentInterrupt(currentThreadId, interruptData);
               }
               
               // 特殊处理：complete事件时停止流式状态和清除interrupt
               if (event.event === 'complete') {
                 state.updateMessage(currentThreadId, messageId, {
                   isStreaming: false,
                 });
                 state.clearCurrentInterrupt(currentThreadId);
                 state.setResponding(false);
               }
               
               // 特殊处理：error事件时清除interrupt
               if (event.event === 'error') {
                 state.clearCurrentInterrupt(currentThreadId);
                 state.setResponding(false);
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