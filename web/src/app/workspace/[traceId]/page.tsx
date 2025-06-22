"use client";

import { ArrowLeft, MessageSquare, FileText, Settings, Maximize2, Minimize2, History, Headphones, Activity } from "lucide-react";
import Link from "next/link";
import { useParams, useSearchParams } from "next/navigation";
import { useEffect, useState, useCallback, useRef, useMemo } from "react";
import { cn } from "~/lib/utils";

import { Button } from "~/components/ui/button";
import { ArtifactFeed } from "~/components/yadra/artifact-feed";
import type { Resource, Option } from "~/core/messages";
import { 
  setEnableBackgroundInvestigation, 
  setReportStyle, 
  useMessageIds,
  useStore,
  useWorkspaceActions,
  useConversationPanelVisible,
  useArtifactsPanelVisible,
  useHistoryPanelVisible,
  usePodcastPanelVisible,
  useWorkspaceFeedback,
  useUnifiedStore,
  sendMessageWithNewAPI,
  useCurrentThread,
  useThreadMessages,
  setCurrentThreadId,
  useCurrentUrlParam,
  useSessionState,
} from "~/core/store";
import {
  // 新架构导入
  setCurrentUrlParam,
  setUrlParamMapping,
  setSessionState,
} from "~/core/store/unified-store";
import { parseJSON } from "~/core/utils";
import { toast } from "sonner";

// 导入组件
import { ConversationPanel } from "./components/conversation-panel";
import { HeroInput } from "~/components/yadra/hero-input";
//import { DebugPanel } from "./components/debug-panel";
//import { UserGuide } from "./components/user-guide";
import { OutputStream } from "./components/output-stream";
import { PodcastPanel } from "./components/podcast-panel";
import { PlanActions } from '~/core/api/human-feedback';
import { PlanCard } from '~/components/research/plan-card';
import type { ResearchPlan } from '~/components/research/plan-card';

// 布局模式枚举
enum LayoutMode {
  WELCOME = 'welcome',
  CONVERSATION = 'conversation', 
  MULTI_PANEL = 'multi_panel'
}

export default function WorkspacePage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const urlParam = params.traceId as string; // 注意：这里是url_param，不是thread_id
  
  // 🔥 从URL查询参数获取ask响应数据
  const threadIdFromParams = searchParams.get('thread_id');
  const sessionIdFromParams = searchParams.get('session_id');
  const frontendUuidFromParams = searchParams.get('frontend_uuid');
  const actionFromParams = searchParams.get('action') as 'create' | 'continue' | null;
  
  const [initialized, setInitialized] = useState(false);
  const [loading, setLoading] = useState(true);
  const [dataLoading, setDataLoading] = useState(false); // 数据加载状态（不阻塞界面）
  const [error, setError] = useState<string | null>(null);
  const [sseConnected, setSseConnected] = useState(false); // SSE连接状态
  const abortControllerRef = useRef<AbortController | null>(null);
  const sseConnectionRef = useRef<boolean>(false); // 🔥 使用ref来防止重复连接

  // 🔥 SSE连接函数 - 支持两种场景
  const startSSEConnection = useCallback(async (threadId: string, action: 'create' | 'continue', message: string = '') => {
    // 🔥 使用ref来检查，避免React状态更新延迟导致的重复连接
    if (sseConnectionRef.current) {
      console.log('[WorkspacePage] SSE already connected (ref check), skipping');
      return;
    }
    
    // 立即设置ref，防止重复连接
    sseConnectionRef.current = true;
    setSseConnected(true);

    try {
      console.log(`[WorkspacePage] Starting SSE connection - Action: ${action}, ThreadId: ${threadId}`);
      
      // 动态导入SSE相关模块
      const { 
        createResearchStream, 
        isNavigationEvent,
        isMetadataEvent,
        isPlanGeneratedEvent,
        isAgentOutputEvent,
        isMessageChunkEvent,
        isArtifactEvent,
        isCompleteEvent,
        isErrorEvent,
        isNodeStartEvent,
        isNodeCompleteEvent,
        isSearchResultsEvent,
        isProgressEvent
      } = await import("~/core/api/research-stream");
      const { generateInitialQuestionIDs, getVisitorId } = await import("~/core/utils");
      const { nanoid } = await import("nanoid");
      
      // 生成前端ID
      const ids = generateInitialQuestionIDs();
      const visitorId = getVisitorId();
      
      // 构建请求 - 根据场景决定参数
      const request = {
        action: action as 'create' | 'continue',
        url_param: urlParam,
        thread_id: threadId,
        message: message, // 场景1有消息内容，场景2为空
        frontend_uuid: ids.frontend_uuid,
        frontend_context_uuid: ids.frontend_context_uuid,
        visitor_id: visitorId,
        config: {
          enableBackgroundInvestigation: false,
          reportStyle: 'academic' as 'academic' | 'popular_science' | 'news' | 'social_media',
          enableDeepThinking: false,
          maxPlanIterations: 1,
          maxStepNum: 1,
          maxSearchResults: 1,
          outputFormat: 'markdown' as 'markdown',
          includeCitations: false,
          includeArtifacts: false,
          auto_accepted_plan: false, // 默认需要用户确认计划
        },
      };
      
      console.log(`[WorkspacePage] Connecting to SSE - Action: ${action}`);
      
      // 连接SSE流
      const stream = createResearchStream(request);
      const store = useUnifiedStore.getState();
      
      // 处理SSE事件
      for await (const event of stream) {
        console.log('[WorkspacePage] SSE event received:', event.type, event.data);
        
        switch (event.type) {
          case 'navigation':
            if (isNavigationEvent(event)) {
              console.log('[WorkspacePage] Navigation received:', event.data);
              // 🔥 处理导航事件 - 设置URL到thread_id的映射
              setUrlParamMapping(event.data.url_param, event.data.thread_id);
              setCurrentThreadId(event.data.thread_id);
              
              // 更新当前线程ID
              const currentThreadId = event.data.thread_id;
              threadId = currentThreadId; // 更新局部变量
              
              // 确保线程存在
              const store = useUnifiedStore.getState();
              store.setCurrentThread(currentThreadId);
            }
            break;
            
          case 'metadata':
            if (isMetadataEvent(event)) {
              console.log('[WorkspacePage] Metadata received:', event.data);
              // 更新会话元数据
              setSessionState({
                sessionMetadata: {
                  execution_id: event.data.execution_id,
                  thread_id: event.data.thread_id,
                  frontend_uuid: event.data.frontend_uuid,
                  estimated_duration: event.data.estimated_duration,
                  start_time: event.data.start_time,
                  model_info: event.data.model_info,
                },
                executionHistory: [],
                currentConfig: event.data.config_used,
                permissions: { canModify: true, canShare: true },
              });
            }
            break;
            
          case 'node_start':
            if (isNodeStartEvent(event)) {
              console.log('[WorkspacePage] Node started:', event.data.node_name);
              // 🔥 新增：处理节点开始事件
              if (threadId) {
                const store = useUnifiedStore.getState();
                                 const progressMessage = {
                   id: `node-start-${event.data.node_name}-${Date.now()}`,
                   content: `🚀 开始执行: ${event.data.node_name}`,
                   contentChunks: [`🚀 开始执行: ${event.data.node_name}`],
                   role: "assistant" as const,
                   threadId: threadId,
                   isStreaming: false,
                   agent: undefined, // system事件不属于特定agent
                   resources: [],
                  metadata: {
                    nodeEvent: true,
                    nodeType: 'start',
                    nodeName: event.data.node_name,
                    timestamp: event.data.timestamp,
                  },
                };
                store.addMessage(threadId, progressMessage);
              }
            }
            break;
            
          case 'node_complete':
            if (isNodeCompleteEvent(event)) {
              console.log('[WorkspacePage] Node completed:', event.data.node_name);
              // 🔥 新增：处理节点完成事件
              if (threadId) {
                const store = useUnifiedStore.getState();
                                 const progressMessage = {
                   id: `node-complete-${event.data.node_name}-${Date.now()}`,
                   content: `✅ 完成执行: ${event.data.node_name}${event.data.duration_ms ? ` (${event.data.duration_ms}ms)` : ''}`,
                   contentChunks: [`✅ 完成执行: ${event.data.node_name}${event.data.duration_ms ? ` (${event.data.duration_ms}ms)` : ''}`],
                   role: "assistant" as const,
                   threadId: threadId,
                   isStreaming: false,
                   agent: undefined, // system事件不属于特定agent
                   resources: [],
                  metadata: {
                    nodeEvent: true,
                    nodeType: 'complete',
                    nodeName: event.data.node_name,
                    duration: event.data.duration_ms,
                    timestamp: event.data.timestamp,
                  },
                };
                store.addMessage(threadId, progressMessage);
              }
            }
            break;
            
          case 'plan_generated':
            if (isPlanGeneratedEvent(event)) {
              console.log('[WorkspacePage] Plan generated:', event.data);
              // 🔥 新增：处理计划生成事件
              if (threadId) {
                const store = useUnifiedStore.getState();
                const planMessage = {
                  id: `plan-${event.data.execution_id}-${Date.now()}`,
                  content: `📋 研究计划已生成 (第${event.data.plan_iterations}次迭代)`,
                  contentChunks: [`📋 研究计划已生成 (第${event.data.plan_iterations}次迭代)`],
                  role: "assistant" as const,
                  threadId: threadId,
                  isStreaming: false,
                  agent: "planner" as const,
                  resources: [],
                  metadata: {
                    planEvent: true,
                    planData: event.data.plan_data,
                    planIterations: event.data.plan_iterations,
                    timestamp: event.data.timestamp,
                  },
                };
                store.addMessage(threadId, planMessage);
              }
            }
            break;
            
          case 'search_results':
            if (isSearchResultsEvent(event)) {
              console.log('[WorkspacePage] Search results:', event.data);
              // 🔥 新增：处理搜索结果事件
              if (threadId) {
                const store = useUnifiedStore.getState();
                const searchMessage = {
                  id: `search-${event.data.execution_id}-${Date.now()}`,
                  content: `🔍 搜索完成: "${event.data.query}" (${event.data.results.length} 个结果)`,
                  contentChunks: [`🔍 搜索完成: "${event.data.query}" (${event.data.results.length} 个结果)`],
                  role: "assistant" as const,
                  threadId: threadId,
                  isStreaming: false,
                  agent: "researcher" as const,
                                     resources: event.data.results.map(result => ({
                     uri: result.url || '',
                     title: result.title || '',
                   })),
                  metadata: {
                    searchEvent: true,
                    query: event.data.query,
                    source: event.data.source,
                    resultsCount: event.data.results.length,
                    timestamp: event.data.timestamp,
                  },
                };
                store.addMessage(threadId, searchMessage);
              }
            }
            break;
            
          case 'agent_output':
            if (isAgentOutputEvent(event)) {
              console.log('[WorkspacePage] Agent output:', event.data);
              // 🔥 新增：处理代理输出事件
              if (threadId) {
                const store = useUnifiedStore.getState();
                const agentMessage = {
                  id: `agent-${event.data.agent_name}-${Date.now()}`,
                  content: event.data.content,
                  contentChunks: [event.data.content],
                  role: "assistant" as const,
                  threadId: threadId,
                  isStreaming: false,
                  agent: event.data.agent_name as any,
                  resources: [],
                  metadata: {
                    agentEvent: true,
                    agentType: event.data.agent_type,
                    agentMetadata: event.data.metadata,
                    timestamp: event.data.timestamp,
                  },
                };
                store.addMessage(threadId, agentMessage);
              }
            }
            break;
            
          case 'progress':
            if (isProgressEvent(event)) {
              console.log('[WorkspacePage] Progress update:', event.data);
              // 🔥 新增：处理进度更新事件
              if (threadId) {
                const store = useUnifiedStore.getState();
                                 const progressMessage = {
                   id: `progress-${event.data.execution_id}-${Date.now()}`,
                   content: `⏳ ${event.data.current_step_description}`,
                   contentChunks: [`⏳ ${event.data.current_step_description}`],
                   role: "assistant" as const,
                   threadId: threadId,
                   isStreaming: false,
                   agent: undefined, // system事件不属于特定agent
                  resources: [],
                  metadata: {
                    progressEvent: true,
                    currentNode: event.data.current_node,
                    completedNodes: event.data.completed_nodes,
                    remainingNodes: event.data.remaining_nodes,
                    timestamp: event.data.timestamp,
                  },
                };
                store.addMessage(threadId, progressMessage);
              }
            }
            break;
            
          case 'message_chunk':
            if (threadId && isMessageChunkEvent(event)) {
              console.log('[WorkspacePage] Message chunk received:', event.data);
              
              const validAgents = ["coordinator", "planner", "researcher", "coder", "reporter", "podcast"] as const;
              const agentName = validAgents.includes(event.data.agent_name as any) 
                ? event.data.agent_name as typeof validAgents[number]
                : "researcher";
              
              const message = {
                id: event.data.chunk_id,
                content: event.data.content,
                contentChunks: [event.data.content],
                role: "assistant" as const,
                threadId: threadId,
                isStreaming: !event.data.is_final,
                agent: agentName,
                resources: [],
                metadata: {
                  chunkType: event.data.chunk_type,
                  sequence: event.data.sequence,
                  chunkMetadata: event.data.metadata,
                  timestamp: event.data.timestamp,
                },
              };
              store.addMessage(threadId, message);
            }
            break;
            
          case 'artifact':
            if (threadId && isArtifactEvent(event)) {
              console.log('[WorkspacePage] Artifact generated:', event.data);
              
              const artifactMessage = {
                id: event.data.artifact_id,
                content: event.data.content,
                contentChunks: [event.data.content],
                role: "assistant" as const,
                threadId: threadId,
                isStreaming: false,
                agent: "reporter" as const,
                resources: [],
                metadata: {
                  artifactEvent: true,
                  artifactType: event.data.type,
                  artifactTitle: event.data.title,
                  artifactFormat: event.data.format,
                  artifactMetadata: event.data.metadata,
                  timestamp: event.data.timestamp,
                },
              };
              store.addMessage(threadId, artifactMessage);
            }
            break;
            
          case 'complete':
            if (isCompleteEvent(event)) {
              console.log('[WorkspacePage] Research completed:', event.data);
              
              // 🔥 增强：处理完成事件的详细信息
              if (threadId) {
                const store = useUnifiedStore.getState();
                                 const completeMessage = {
                   id: `complete-${event.data.execution_id}`,
                   content: `🎉 研究完成！总耗时: ${event.data.total_duration_ms}ms，生成了 ${event.data.artifacts_generated.length} 个工件`,
                   contentChunks: [`🎉 研究完成！总耗时: ${event.data.total_duration_ms}ms，生成了 ${event.data.artifacts_generated.length} 个工件`],
                   role: "assistant" as const,
                   threadId: threadId,
                   isStreaming: false,
                   agent: undefined, // system事件不属于特定agent
                  resources: [],
                  metadata: {
                    completeEvent: true,
                    totalDuration: event.data.total_duration_ms,
                    tokensConsumed: event.data.tokens_consumed,
                    totalCost: event.data.total_cost,
                    artifactsGenerated: event.data.artifacts_generated,
                    finalStatus: event.data.final_status,
                    summary: event.data.summary,
                    timestamp: event.data.timestamp,
                  },
                };
                store.addMessage(threadId, completeMessage);
              }
              
              setDataLoading(false);
              setInitialized(true);
              setSseConnected(false);
              sseConnectionRef.current = false; // 🔥 重置ref
              return; // 结束SSE处理循环
            }
            break;
            
          case 'error':
            if (isErrorEvent(event)) {
              console.error('[WorkspacePage] SSE error:', event.data);
              
              // 🔥 增强：处理错误事件的详细信息
              if (threadId) {
                const store = useUnifiedStore.getState();
                                 const errorMessage = {
                   id: `error-${event.data.execution_id}-${Date.now()}`,
                   content: `❌ 错误: ${event.data.error_message}`,
                   contentChunks: [`❌ 错误: ${event.data.error_message}`],
                   role: "assistant" as const,
                   threadId: threadId,
                   isStreaming: false,
                   agent: undefined, // system事件不属于特定agent
                  resources: [],
                  metadata: {
                    errorEvent: true,
                    errorCode: event.data.error_code,
                    errorDetails: event.data.error_details,
                    suggestions: event.data.suggestions,
                    timestamp: event.data.timestamp,
                  },
                };
                store.addMessage(threadId, errorMessage);
              }
              
              setError(`研究过程出错: ${event.data.error_message}`);
              setDataLoading(false);
              setInitialized(true);
              setSseConnected(false);
              sseConnectionRef.current = false; // 🔥 重置ref
              return; // 结束SSE处理循环
            }
            break;
            
          default:
            console.log('[WorkspacePage] Unhandled SSE event:', event.type);
            break;
        }
      }
      
      console.log('[WorkspacePage] SSE stream completed');
      setSseConnected(false);
      sseConnectionRef.current = false; // 🔥 重置ref
      setDataLoading(false);
      setInitialized(true);
      
    } catch (error) {
      console.error('[WorkspacePage] SSE connection failed:', error);
      setSseConnected(false);
      sseConnectionRef.current = false; // 🔥 重置ref
      setDataLoading(false);
      setInitialized(true);
    }
  }, [sseConnected, urlParam, setSessionState, setDataLoading, setInitialized, setError]);

  // 获取当前状态
  const currentUrlParam = useCurrentUrlParam();
  const sessionState = useSessionState();
  const messageIds = useMessageIds();
  const hasMessages = messageIds.length > 0;
  
  // Workspace状态管理
  const { 
    toggleConversationPanel, 
    toggleArtifactsPanel,
    toggleHistoryPanel,
    togglePodcastPanel,
    setCurrentTraceId,
    setFeedback
  } = useWorkspaceActions();
  const conversationVisible = useConversationPanelVisible();
  const artifactVisible = useArtifactsPanelVisible();
  const historyVisible = useHistoryPanelVisible();
  const podcastVisible = usePodcastPanelVisible();
  const feedback = useWorkspaceFeedback();

  // 🚀 计算布局模式
  const layoutMode = useMemo(() => {
    if (!hasMessages) return LayoutMode.WELCOME;
    
    const visiblePanels = [conversationVisible, artifactVisible, historyVisible, podcastVisible].filter(Boolean);
    
    // 如果只有对话面板可见
    if (visiblePanels.length === 1 && conversationVisible) {
      return LayoutMode.CONVERSATION;
    }
    
    // 如果有多个面板可见
    if (visiblePanels.length > 1) {
      return LayoutMode.MULTI_PANEL;
    }
    
    // 有消息但没有可见面板，默认显示对话
    return LayoutMode.CONVERSATION;
  }, [hasMessages, conversationVisible, artifactVisible, historyVisible, podcastVisible]);

  // 🚀 计算可见面板和宽度
  const visiblePanels = useMemo(() => {
    return [
      { type: 'conversation', visible: conversationVisible },
      { type: 'artifacts', visible: artifactVisible },
      { type: 'history', visible: historyVisible },
      { type: 'podcast', visible: podcastVisible },
    ].filter(panel => panel.visible);
  }, [conversationVisible, artifactVisible, historyVisible, podcastVisible]);

  const panelWidthClass = useMemo(() => {
    const count = visiblePanels.length;
    if (count === 1) return "w-full";
    if (count === 2) return "w-1/2"; 
    if (count === 3) return "w-1/3";
    return "w-1/4";
  }, [visiblePanels.length]);

  // 🚀 重构后的工作区初始化逻辑
  useEffect(() => {
    if (!urlParam || initialized) return;

    const initializeWorkspace = async () => {
      setLoading(true);
      setError(null);

      try {
        console.log(`[WorkspacePage] Initializing workspace: ${urlParam}`);
        
        // 设置当前URL参数
        setCurrentUrlParam(urlParam);
        
        // 🚀 快速显示界面
        setLoading(false);
        setDataLoading(true);
        
        // 🔥 新架构：从URL参数获取必要信息，直接启动SSE
        if (threadIdFromParams && actionFromParams) {
          console.log(`[WorkspacePage] Found thread_id in URL params: ${threadIdFromParams}`);
          
          // 设置线程映射
          setUrlParamMapping(urlParam, threadIdFromParams);
          setCurrentThreadId(threadIdFromParams);
          
          // 确保线程存在
          const store = useUnifiedStore.getState();
          store.setCurrentThread(threadIdFromParams);
          
          // 🔥 直接启动SSE连接，无需查询数据库
          console.log(`[WorkspacePage] Starting SSE connection with action: ${actionFromParams}`);
          await startSSEConnection(threadIdFromParams, actionFromParams);
          
        } else {
          // 兼容旧链接：如果没有URL参数，尝试从store获取thread_id
          const existingThreadId = useUnifiedStore.getState().getThreadIdByUrlParam(urlParam);
          if (existingThreadId) {
            console.log(`[WorkspacePage] Found existing thread_id in store: ${existingThreadId}`);
            setCurrentThreadId(existingThreadId);
            await startSSEConnection(existingThreadId, 'continue');
          } else {
            console.log('[WorkspacePage] No thread_id found, workspace may be empty');
            setDataLoading(false);
            setInitialized(true);
          }
        }
        
      } catch (error) {
        console.error('[WorkspacePage] Failed to initialize workspace:', error);
        setError(error instanceof Error ? error.message : 'Failed to load workspace');
        setLoading(false);
        setDataLoading(false);
      }
    };

    initializeWorkspace();
  }, [urlParam, initialized]); // 🔥 移除 startSSEConnection 依赖，避免重复执行

  // 实现消息发送处理函数 - 支持workspace页面的两种场景
  const handleSendMessage = useCallback(
    async (
      message: string,
      options?: {
        interruptFeedback?: string;
        resources?: Array<Resource>;
      },
    ) => {
      console.log("[WorkspacePage] Sending message:", message);
      
      try {
        // 场景1：在workspace页面直接提交新问题
        // 使用SSE连接进行流式处理
        const sessionState = useSessionState();
        const threadId = sessionState?.sessionMetadata?.thread_id || urlParam;
        
        console.log("[WorkspacePage] Starting new research in workspace with SSE");
        setDataLoading(true);
        
        // 启动SSE连接处理新消息
        await startSSEConnection(threadId, 'create', message);
        
        console.log("[WorkspacePage] Message sent successfully");
      } catch (error) {
        console.error("Failed to send message:", error);
        setError(error instanceof Error ? error.message : 'Failed to send message');
        setDataLoading(false);
        throw error;
      }
    },
    [urlParam, startSSEConnection],
  );

  // 实现反馈处理函数
  const handleFeedback = useCallback(
    (feedback: { option: Option }) => {
      setFeedback(feedback);
    },
    [setFeedback],
  );

  // 人机反馈处理函数
  const handlePlanFeedback = useCallback(async (
    action: 'approve' | 'modify' | 'skipToReport' | 'reask',
    planId: string,
    data?: string
  ) => {
    const threadId = useUnifiedStore.getState().getThreadIdByUrlParam(urlParam);
    if (!threadId) {
      console.error('No thread ID found for plan feedback');
      return;
    }

    try {
             // 使用unified store的setResponding
       useUnifiedStore.getState().setResponding(true);
       
       switch (action) {
         case 'approve':
           await PlanActions.startResearch(threadId, planId);
           console.log('[WorkspacePage] Plan approved, starting research');
           break;
         case 'modify':
           if (data) {
             await PlanActions.editPlan(threadId, planId, data);
             console.log('[WorkspacePage] Plan modification submitted');
           }
           break;
         case 'skipToReport':
           await PlanActions.skipToReport(threadId, planId);
           console.log('[WorkspacePage] Skipping to report generation');
           break;
         case 'reask':
           await PlanActions.reask(threadId, planId);
           // 这个会跳转页面，所以不需要额外处理
           break;
       }
       
       // 重新启动SSE连接以接收反馈响应
       if (action !== 'reask') {
         setSseConnected(false);
         setTimeout(() => {
           const threadId = useUnifiedStore.getState().getThreadIdByUrlParam(urlParam);
           if (threadId) {
             startSSEConnection(threadId, 'continue');
           }
         }, 100);
       }
     } catch (error) {
       console.error(`[WorkspacePage] Plan ${action} failed:`, error);
       setError(`操作失败: ${error}`);
       useUnifiedStore.getState().setResponding(false);
     }
     }, [urlParam, startSSEConnection, setError]);

  // 清理函数
  useEffect(() => {
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, []);

  // 欢迎内容组件
  const WelcomeContent = () => (
    <div className="flex flex-1 items-center justify-center h-full">
      <div className="text-center max-w-2xl mx-auto px-4">
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-amber-900 mb-4">
            你好，我能帮你什么？
          </h1>
          <p className="text-xl text-amber-700">
            开始您的深度研究之旅
          </p>
        </div>
        
        {dataLoading && (
          <div className="mb-6">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-amber-600 mx-auto mb-2"></div>
            <p className="text-amber-600">正在准备研究环境...</p>
          </div>
        )}
      </div>
    </div>
  );

  // 🚀 全局输入框组件（用于欢迎和单对话模式）
  const GlobalInputContainer = () => (
    <div className="absolute bottom-4 left-0 right-0 z-50">
      <div className="max-w-4xl mx-auto px-4">
        <div className="backdrop-blur-sm bg-amber-200/20 rounded-lg p-4">
          <HeroInput 
            placeholder={hasMessages ? "继续研究对话..." : "开始您的研究之旅..."}
            onSendMessage={handleSendMessage}
            className="w-full"
          />
        </div>
      </div>
    </div>
  );

  // 🚀 面板内输入框组件（用于多面板模式）
  const PanelInputContainer = () => (
    <div className="absolute bottom-0 left-0 right-0 backdrop-blur-sm bg-amber-200/20 p-4 z-10">
      <HeroInput 
        placeholder="继续研究对话..."
        onSendMessage={handleSendMessage}
        className="w-full"
      />
    </div>
  );

  // 优化loading状态 - 快速显示基础界面，后台加载数据
  if (loading && !urlParam) {
    // 只有在没有urlParam时才显示loading（这种情况不应该发生）
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading workspace...</p>
        </div>
      </div>
    );
  }

  // 如果有错误，显示错误状态
  if (error) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="text-red-500 mb-4">
            <svg className="w-12 h-12 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.694-.833-2.464 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
            </svg>
          </div>
          <h2 className="text-xl font-semibold text-gray-900 mb-2">Failed to Load Workspace</h2>
          <p className="text-gray-600 mb-4">{error}</p>
          <Button onClick={() => window.location.reload()}>
            Retry
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col bg-gradient-to-br from-gray-50 via-white to-gray-50 relative">
      {/* 顶部导航栏 - 仅在有消息时显示 */}
      {hasMessages && (
        <div className="flex-shrink-0 flex items-center justify-between px-4 py-3 bg-transparent">
          <div className="flex items-center gap-2">
            <h1 className="text-lg font-semibold text-amber-900">当前研究</h1>
            {dataLoading && (
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-amber-600"></div>
            )}
          </div>

          {/* 面板控制按钮 */}
          <div className="flex items-center gap-1">
            <Button
              variant={conversationVisible ? "default" : "outline"}
              size="sm"
              onClick={toggleConversationPanel}
              className="gap-1 bg-transparent border-amber-300/30 text-amber-800 hover:bg-amber-100/20"
            >
              <MessageSquare className="h-4 w-4" />
              <span className="hidden lg:inline">对话</span>
              {conversationVisible ? <Minimize2 className="h-3 w-3 hidden sm:inline" /> : <Maximize2 className="h-3 w-3 hidden sm:inline" />}
            </Button>
            
            <Button
              variant={artifactVisible ? "default" : "outline"}
              size="sm"
              onClick={toggleArtifactsPanel}
              className="gap-1 bg-transparent border-amber-300/30 text-amber-800 hover:bg-amber-100/20"
            >
              <FileText className="h-4 w-4" />
              <span className="hidden lg:inline">工件</span>
              {artifactVisible ? <Minimize2 className="h-3 w-3 hidden sm:inline" /> : <Maximize2 className="h-3 w-3 hidden sm:inline" />}
            </Button>
            
            <Button
              variant={historyVisible ? "default" : "outline"}
              size="sm"
              onClick={toggleHistoryPanel}
              className="gap-1 bg-transparent border-amber-300/30 text-amber-800 hover:bg-amber-100/20"
            >
              <Activity className="h-4 w-4" />
              <span className="hidden lg:inline">输出流</span>
              {historyVisible ? <Minimize2 className="h-3 w-3 hidden sm:inline" /> : <Maximize2 className="h-3 w-3 hidden sm:inline" />}
            </Button>
            
            <Button
              variant={podcastVisible ? "default" : "outline"}
              size="sm"
              onClick={togglePodcastPanel}
              className="gap-1 bg-transparent border-amber-300/30 text-amber-800 hover:bg-amber-100/20"
            >
              <Headphones className="h-4 w-4" />
              <span className="hidden lg:inline">播客</span>
              {podcastVisible ? <Minimize2 className="h-3 w-3 hidden sm:inline" /> : <Maximize2 className="h-3 w-3 hidden sm:inline" />}
            </Button>
          </div>
        </div>
      )}

      {/* 主要内容区域 - 根据布局模式渲染 */}
      <div className="flex-1 overflow-hidden min-h-0 relative">
        {layoutMode === LayoutMode.WELCOME ? (
          // 🚀 欢迎模式：居中显示欢迎内容
          <WelcomeContent />
        ) : (
          // 🚀 对话和多面板模式：显示面板系统
          <div className="flex h-full">
            {/* 对话面板 */}
            {conversationVisible && (
              <div className={cn("flex flex-col h-full relative", panelWidthClass, {
                "border-r border-amber-300/30": visiblePanels.length > 1
              })}>
                <div className="flex-1 overflow-hidden">
                  <ConversationPanel traceId={urlParam} onSendMessage={handleSendMessage} />
                </div>
                {/* 在多面板模式下，输入框属于对话面板 */}
                {layoutMode === LayoutMode.MULTI_PANEL && <PanelInputContainer />}
              </div>
            )}

            {/* 工件面板 */}
            {artifactVisible && (
              <div className={cn("flex flex-col h-full", panelWidthClass, {
                "border-r border-amber-300/30": historyVisible || podcastVisible
              })}>
                <div className="flex-shrink-0 px-4 py-3 border-b border-amber-300/30">
                  <div className="flex items-center justify-between">
                    <h2 className="text-lg font-semibold text-amber-900">
                      研究工件
                    </h2>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => toggleArtifactsPanel()}
                      className="h-8 w-8 p-0 text-amber-800 hover:bg-amber-100/20"
                    >
                      <Minimize2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
                <div className="flex-1 overflow-hidden">
                  <ArtifactFeed traceId={urlParam} />
                </div>
              </div>
            )}

            {/* 输出流面板 */}
            {historyVisible && (
              <div className={cn("flex flex-col h-full", panelWidthClass, {
                "border-r border-amber-300/30": podcastVisible
              })}>
                <div className="flex-shrink-0 px-4 py-3 border-b border-amber-300/30">
                  <div className="flex items-center justify-between">
                    <h2 className="text-lg font-semibold text-amber-900">
                      实时输出流
                    </h2>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => toggleHistoryPanel()}
                      className="h-8 w-8 p-0 text-amber-800 hover:bg-amber-100/20"
                    >
                      <Minimize2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
                <div className="flex-1 overflow-hidden">
                  <OutputStream traceId={urlParam} />
                </div>
              </div>
            )}

            {/* 播客面板 */}
            {podcastVisible && (
              <div className={cn("flex flex-col h-full", panelWidthClass)}>
                <div className="flex-shrink-0 px-4 py-3 border-b border-amber-300/30">
                  <div className="flex items-center justify-between">
                    <h2 className="text-lg font-semibold text-amber-900">
                      播客内容
                    </h2>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => togglePodcastPanel()}
                      className="h-8 w-8 p-0 text-amber-800 hover:bg-amber-100/20"
                    >
                      <Minimize2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
                <div className="flex-1 overflow-hidden">
                  <PodcastPanel traceId={urlParam} />
                </div>
              </div>
            )}

            {/* 当有对话但所有面板都隐藏时显示提示 */}
            {hasMessages && visiblePanels.length === 0 && (
              <div className="flex flex-1 items-center justify-center">
                <div className="text-center">
                  <MessageSquare className="mx-auto h-12 w-12 text-amber-600" />
                  <h3 className="mt-4 text-lg font-medium text-amber-900">
                    选择要查看的面板
                  </h3>
                  <p className="mt-2 text-sm text-amber-700">
                    使用右上角的按钮开启对话、工件或其他面板
                  </p>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* 全局输入框 - 仅在欢迎和单对话模式显示 */}
      {(layoutMode === LayoutMode.WELCOME || layoutMode === LayoutMode.CONVERSATION) && (
        <GlobalInputContainer />
      )}
    </div>
  );
}
