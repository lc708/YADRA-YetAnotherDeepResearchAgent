"use client";

import { ArrowLeft, MessageSquare, FileText, Settings, Maximize2, Minimize2, History, Headphones } from "lucide-react";
import Link from "next/link";
import { useParams, useSearchParams } from "next/navigation";
import { useEffect, useState, useCallback, useRef } from "react";
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
import { getWorkspaceState } from "~/core/api/research-stream";
import { parseJSON } from "~/core/utils";
import { toast } from "sonner";

// 导入组件
import { ConversationPanel } from "./components/conversation-panel";
import { HeroInput } from "~/components/yadra/hero-input";
//import { DebugPanel } from "./components/debug-panel";
//import { UserGuide } from "./components/user-guide";
import { MessageHistory } from "./components/message-history";
import { PodcastPanel } from "./components/podcast-panel";

export default function WorkspacePage() {
  const params = useParams();
  const urlParam = params.traceId as string; // 注意：这里是url_param，不是thread_id
  const [initialized, setInitialized] = useState(false);
  const [loading, setLoading] = useState(true);
  const [dataLoading, setDataLoading] = useState(false); // 数据加载状态（不阻塞界面）
  const [error, setError] = useState<string | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

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

  // 两步分离架构 - Step 2: 初始化工作区并连接SSE
  useEffect(() => {
    if (!urlParam || initialized) return;

    const initializeWorkspaceWithSSE = async () => {
      setLoading(true);
      setError(null);

      try {
        console.log(`[WorkspacePage] Initializing workspace with two-step architecture: ${urlParam}`);
        
        // 设置当前URL参数
        setCurrentUrlParam(urlParam);
        
        // 🚀 快速显示界面 - 先设置loading为false，让用户看到基础界面
        setLoading(false);
        
        // 开始后台数据加载
        setDataLoading(true);
        
        // 首先尝试获取现有工作区状态（检查是否为新任务或历史任务）
        try {
          const workspaceData = await getWorkspaceState(urlParam);
          console.log('[WorkspacePage] Existing workspace data found:', workspaceData);
          
          // 设置会话状态
          setSessionState({
            sessionMetadata: workspaceData.sessionMetadata,
            executionHistory: workspaceData.executionHistory || [],
            currentConfig: workspaceData.config?.currentConfig || null,
            permissions: workspaceData.permissions || null,
          });
          
          // 设置URL参数到thread_id的映射
          setUrlParamMapping(urlParam, workspaceData.thread_id);
          setCurrentThreadId(workspaceData.thread_id);
          
          // 恢复消息历史
          if (workspaceData.messages && workspaceData.messages.length > 0) {
            console.log(`[WorkspacePage] Restoring ${workspaceData.messages.length} messages`);
            
            const { nanoid } = await import("nanoid");
            const store = useUnifiedStore.getState();
            
            // 转换并添加消息到store
            for (const msg of workspaceData.messages) {
              const message = {
                id: msg.id || nanoid(),
                content: msg.content || '',
                contentChunks: [msg.content || ''],
                role: (msg.role === 'user' ? 'user' : 'assistant') as 'user' | 'assistant',
                threadId: workspaceData.thread_id,
                isStreaming: false,
                agent: msg.agent || undefined,
                resources: msg.resources || [],
              };
              
              store.addMessage(workspaceData.thread_id, message);
            }
            
            console.log(`[WorkspacePage] Successfully restored ${workspaceData.messages.length} messages`);
          }
          
          // 恢复配置
          if (workspaceData.config?.currentConfig) {
            const config = workspaceData.config.currentConfig;
            if (config.enableBackgroundInvestigation !== undefined) {
              setEnableBackgroundInvestigation(config.enableBackgroundInvestigation);
            }
            if (config.reportStyle) {
              setReportStyle(config.reportStyle);
            }
          }
          
          console.log('[WorkspacePage] Workspace initialized from existing data');
          
          // 🔥 关键修复：根据执行状态判断是否需要启动SSE连接
          const hasMessages = workspaceData.messages && workspaceData.messages.length > 0;
          const executionHistory = workspaceData.sessionMetadata?.execution_history || [];
          const latestExecution = executionHistory[0]; // 最新的执行记录
          const isStillRunning = latestExecution?.status === 'running';
          
          console.log('[WorkspacePage] Execution status check:', {
            hasMessages,
            latestExecutionStatus: latestExecution?.status,
            isStillRunning,
            executionCount: executionHistory.length
          });
          
          if (hasMessages && !isStillRunning) {
            // 有消息数据且任务已完成，初始化完成
            setInitialized(true);
            setDataLoading(false);
            console.log('[WorkspacePage] Workspace initialization completed with existing data');
            return;
          } else {
            // 需要启动SSE连接的情况：
            // 1. 任务仍在运行 (isStillRunning = true)
            // 2. 没有消息且没有运行中的任务
            if (isStillRunning) {
              console.log('[WorkspacePage] Task is still running, starting SSE connection to get live data...');
            } else {
              console.log('[WorkspacePage] No messages and no running task, starting SSE connection...');
            }
            
            // 🔥 关键修复：实际启动SSE连接
            await startSSEConnection();
          }
          
        } catch (workspaceError) {
          console.log('[WorkspacePage] No existing workspace data, this might be a new task');
          
          // 如果没有现有数据，这可能是刚创建的任务，需要连接SSE获取实时数据
          console.log('[WorkspacePage] Starting SSE connection for new task...');
          
          // 对于新任务，也使用相同的SSE连接逻辑
          await startSSEConnection();
        }
        
        // 🔥 提取SSE连接逻辑为独立函数
        async function startSSEConnection() {
          
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
            isErrorEvent
          } = await import("~/core/api/research-stream");
          const { generateInitialQuestionIDs, getVisitorId } = await import("~/core/utils");
          const { nanoid } = await import("nanoid");
          
          // 生成前端ID（用于SSE连接）
          const ids = generateInitialQuestionIDs();
          const visitorId = getVisitorId();
          
                     // 构建SSE请求 - 注意：如果后台任务已完成，我们需要检查实际状态
           const { useSettingsStore } = await import("~/core/store");
           const settings = useSettingsStore.getState().general;
           
           // 首先检查现有任务的状态
           console.log('[WorkspacePage] Checking if background task is still running...');
           
           const request = {
             action: 'continue' as const,
             url_param: urlParam,
             message: '获取当前进度', // 请求获取当前进度和状态
             frontend_uuid: ids.frontend_uuid,
             frontend_context_uuid: ids.frontend_context_uuid,
             visitor_id: visitorId,
             config: {
               enableBackgroundInvestigation: settings.enableBackgroundInvestigation,
               reportStyle: settings.reportStyle,
               enableDeepThinking: settings.enableDeepThinking,
               maxPlanIterations: settings.maxPlanIterations,
               maxStepNum: settings.maxStepNum,
               maxSearchResults: settings.maxSearchResults,
               outputFormat: 'markdown' as const,
               includeCitations: true,
               includeArtifacts: true,
             },
           };
          
          console.log('[WorkspacePage] Connecting to SSE stream...');
          
          // 连接SSE流
          const stream = createResearchStream(request);
          const store = useUnifiedStore.getState();
          let currentThreadId: string | null = null;
          
          // 处理SSE事件
          for await (const event of stream) {
            console.log('[WorkspacePage] SSE event received:', event.type, event.data);
            
            switch (event.type) {
              case 'navigation':
                if (isNavigationEvent(event)) {
                  const { thread_id } = event.data;
                  console.log('[WorkspacePage] Navigation event - thread_id:', thread_id);
                  
                  // 设置映射关系
                  setUrlParamMapping(urlParam, thread_id);
                  setCurrentThreadId(thread_id);
                  currentThreadId = thread_id;
                }
                break;
                
              case 'metadata':
                if (isMetadataEvent(event)) {
                  console.log('[WorkspacePage] Metadata received:', event.data);
                  
                  // 设置会话元数据
                  setSessionState({
                    sessionMetadata: {
                      execution_id: event.data.execution_id,
                      thread_id: event.data.thread_id,
                      frontend_uuid: event.data.frontend_uuid,
                      estimated_duration: event.data.estimated_duration,
                      start_time: event.data.start_time,
                    },
                    executionHistory: [],
                    currentConfig: event.data.config_used,
                    permissions: { canModify: true, canShare: true },
                  });
                }
                break;
                
              case 'plan_generated':
                if (currentThreadId && isPlanGeneratedEvent(event)) {
                  console.log('[WorkspacePage] Plan generated:', event.data);
                  
                  const planContent = JSON.stringify(event.data.plan_data, null, 2);
                  const planMessage = {
                    id: nanoid(),
                    content: planContent,
                    contentChunks: [planContent],
                    role: "assistant" as const,
                    threadId: currentThreadId,
                    isStreaming: false,
                    agent: "planner" as const,
                    resources: [],
                  };
                  store.addMessage(currentThreadId, planMessage);
                }
                break;
                
              case 'agent_output':
                if (currentThreadId && isAgentOutputEvent(event)) {
                  console.log('[WorkspacePage] Agent output:', event.data);
                  
                  const validAgents = ["coordinator", "planner", "researcher", "coder", "reporter", "podcast"] as const;
                  const agentName = validAgents.includes(event.data.agent_name as any) 
                    ? event.data.agent_name as typeof validAgents[number]
                    : "researcher";
                  
                  const agentMessage = {
                    id: nanoid(),
                    content: event.data.content,
                    contentChunks: [event.data.content],
                    role: "assistant" as const,
                    threadId: currentThreadId,
                    isStreaming: false,
                    agent: agentName,
                    resources: [],
                  };
                  store.addMessage(currentThreadId, agentMessage);
                }
                break;
                
              case 'artifact':
                if (currentThreadId && isArtifactEvent(event)) {
                  console.log('[WorkspacePage] Artifact generated:', event.data);
                  
                  const artifactMessage = {
                    id: nanoid(),
                    content: event.data.content,
                    contentChunks: [event.data.content],
                    role: "assistant" as const,
                    threadId: currentThreadId,
                    isStreaming: false,
                    agent: "reporter" as const,
                    resources: [],
                  };
                  store.addMessage(currentThreadId, artifactMessage);
                }
                break;
                
              case 'complete':
                if (isCompleteEvent(event)) {
                  console.log('[WorkspacePage] Research completed:', event.data);
                  
                  // 🎯 任务完成，停止数据加载指示器
                  setDataLoading(false);
                  setInitialized(true);
                  
                  // 可以在这里处理完成后的逻辑，比如显示完成通知
                  console.log('[WorkspacePage] Task completed successfully, SSE stream will end');
                  return; // 结束SSE处理循环
                }
                break;
                
              case 'error':
                if (isErrorEvent(event)) {
                  console.error('[WorkspacePage] SSE error:', event.data);
                  setError(`研究过程出错: ${event.data.error_message}`);
                  setDataLoading(false);
                  setInitialized(true);
                  return; // 结束SSE处理循环
                } else {
                  console.error('[WorkspacePage] Unknown SSE error:', event);
                  setError('研究过程出现未知错误');
                  setDataLoading(false);
                  setInitialized(true);
                  return; // 结束SSE处理循环
                }
                break;
                
              default:
                console.log('[WorkspacePage] Unhandled SSE event:', event.type);
                break;
            }
          }
          
          console.log('[WorkspacePage] SSE stream completed');
        } // 🔥 结束startSSEConnection函数
        
        setInitialized(true);
        setDataLoading(false); // 数据加载完成
        console.log('[WorkspacePage] Workspace initialization completed');
        
      } catch (error) {
        console.error('[WorkspacePage] Failed to initialize workspace:', error);
        setError(error instanceof Error ? error.message : 'Failed to load workspace');
        setLoading(false); // 确保错误时也不显示loading
        setDataLoading(false); // 停止数据加载指示器
      }
    };

    initializeWorkspaceWithSSE();
  }, [urlParam, initialized]);

  // 实现消息发送处理函数（使用新架构）
  const handleSendMessage = useCallback(
    async (
      message: string,
      options?: {
        interruptFeedback?: string;
        resources?: Array<Resource>;
      },
    ) => {
      console.log("[WorkspacePage] Sending message with new API:", message);
      
      const abortController = new AbortController();
      abortControllerRef.current = abortController;
      
      try {
        await sendMessageWithNewAPI(
          message,
          {
            interruptFeedback: options?.interruptFeedback ?? feedback?.option.value,
            resources: options?.resources,
          },
          {
            abortSignal: abortController.signal,
          },
        );
        
        console.log("[WorkspacePage] Message sent successfully");
      } catch (error) {
        console.error("Failed to send message:", error);
        throw error;
      }
    },
    [feedback],
  );

  // 实现反馈处理函数
  const handleFeedback = useCallback(
    (feedback: { option: Option }) => {
      setFeedback(feedback);
    },
    [setFeedback],
  );

  // 清理函数
  useEffect(() => {
    return () => {
      if (abortControllerRef.current && !abortControllerRef.current.signal.aborted) {
        abortControllerRef.current.abort(new DOMException('Component unmounted', 'AbortError'));
      }
    };
  }, []);

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
    <div className="flex h-screen flex-col bg-gradient-to-br from-slate-900 via-slate-800 to-black">
      {/* 顶部导航栏 - 固定高度 */}
      <div className="flex-shrink-0 flex items-center justify-between border-b border-white/20 bg-black/20 px-4 py-3 backdrop-blur-sm">
        <div className="flex items-center gap-4 min-w-0 flex-1">
          <Button variant="ghost" size="sm" asChild className="flex-shrink-0">
            <Link href="/">
              <ArrowLeft className="mr-2 h-4 w-4" />
              <span className="hidden sm:inline">返回首页</span>
              <span className="sm:hidden">返回</span>
            </Link>
          </Button>
          
          <div className="h-6 w-px bg-white/20 flex-shrink-0" />
          
          <div className="min-w-0 flex-1 max-w-md">
            <div className="flex items-center gap-2">
              <h1 className="text-lg font-semibold text-white">研究工作区</h1>
              {dataLoading && (
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-400"></div>
              )}
            </div>
            <p className="text-xs text-gray-400 truncate" title={urlParam || `会话: ${urlParam}`}>
              {urlParam ? `查询: ${urlParam.length > 30 ? urlParam.substring(0, 30) + '...' : urlParam}` : `会话: ${urlParam.slice(0, 8)}...`}
              {dataLoading && (
                <span className="ml-2 text-blue-400">正在加载数据...</span>
              )}
            </p>
          </div>
        </div>

        {/* 面板控制按钮 */}
        <div className="flex items-center gap-1 flex-shrink-0">
          <Button
            variant={conversationVisible ? "default" : "outline"}
            size="sm"
            onClick={toggleConversationPanel}
            className="gap-1"
          >
            <MessageSquare className="h-4 w-4" />
            <span className="hidden lg:inline">对话</span>
            {conversationVisible ? <Minimize2 className="h-3 w-3 hidden sm:inline" /> : <Maximize2 className="h-3 w-3 hidden sm:inline" />}
          </Button>
          
          <Button
            variant={artifactVisible ? "default" : "outline"}
            size="sm"
            onClick={toggleArtifactsPanel}
            className="gap-1"
          >
            <FileText className="h-4 w-4" />
            <span className="hidden lg:inline">工件</span>
            {artifactVisible ? <Minimize2 className="h-3 w-3 hidden sm:inline" /> : <Maximize2 className="h-3 w-3 hidden sm:inline" />}
          </Button>
          
          <Button
            variant={historyVisible ? "default" : "outline"}
            size="sm"
            onClick={toggleHistoryPanel}
            className="gap-1"
          >
            <History className="h-4 w-4" />
            <span className="hidden lg:inline">历史</span>
            {historyVisible ? <Minimize2 className="h-3 w-3 hidden sm:inline" /> : <Maximize2 className="h-3 w-3 hidden sm:inline" />}
          </Button>
          
          <Button
            variant={podcastVisible ? "default" : "outline"}
            size="sm"
            onClick={togglePodcastPanel}
            className="gap-1"
          >
            <Headphones className="h-4 w-4" />
            <span className="hidden lg:inline">播客</span>
            {podcastVisible ? <Minimize2 className="h-3 w-3 hidden sm:inline" /> : <Maximize2 className="h-3 w-3 hidden sm:inline" />}
          </Button>
        </div>
      </div>

      {/* 主要内容区域 - 自适应高度，确保不会超出屏幕 */}
      <div className="flex flex-1 overflow-hidden min-h-0">
        {/* 计算可见面板数量和宽度 */}
        {(() => {
          const visiblePanels = [conversationVisible, artifactVisible, historyVisible, podcastVisible].filter(Boolean).length;
          const panelWidth = visiblePanels === 1 ? "w-full" : visiblePanels === 2 ? "w-1/2" : visiblePanels === 3 ? "w-1/3" : "w-1/4";
          
          return (
            <>
              {/* 对话面板 */}
              {conversationVisible && (
                <div className={cn("flex flex-col border-r border-gray-200 dark:border-gray-700 min-h-0", panelWidth)}>
                  <ConversationPanel traceId={urlParam} onSendMessage={handleSendMessage} />
                </div>
              )}

              {/* 工件面板 */}
              {artifactVisible && (
                <div className={cn("flex flex-col min-h-0", panelWidth, {
                  "border-r border-gray-200 dark:border-gray-700": historyVisible || podcastVisible
                })}>
                  <div className="flex-shrink-0 border-b border-gray-200 px-4 py-3 dark:border-gray-700">
                    <div className="flex items-center justify-between">
                      <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                        研究工件
                      </h2>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => toggleArtifactsPanel()}
                        className="h-8 w-8 p-0"
                      >
                        <Minimize2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                  <div className="flex-1 overflow-hidden min-h-0">
                    <ArtifactFeed traceId={urlParam} />
                  </div>
                </div>
              )}

              {/* 历史面板 */}
              {historyVisible && (
                <div className={cn("flex flex-col min-h-0", panelWidth, {
                  "border-r border-gray-200 dark:border-gray-700": podcastVisible
                })}>
                  <div className="flex-shrink-0 border-b border-gray-200 px-4 py-3 dark:border-gray-700">
                    <div className="flex items-center justify-between">
                      <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                        消息历史
                      </h2>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => toggleHistoryPanel()}
                        className="h-8 w-8 p-0"
                      >
                        <Minimize2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                  <div className="flex-1 overflow-hidden min-h-0">
                    <MessageHistory traceId={urlParam} />
                  </div>
                </div>
              )}

              {/* 播客面板 */}
              {podcastVisible && (
                <div className={cn("flex flex-col min-h-0", panelWidth)}>
                  <PodcastPanel traceId={urlParam} />
                </div>
              )}
            </>
          );
        })()}

        {/* 当所有面板都隐藏时显示空状态 */}
        {!conversationVisible && !artifactVisible && !historyVisible && !podcastVisible && (
          <div className="flex flex-1 items-center justify-center">
            <div className="text-center">
              <FileText className="mx-auto h-12 w-12 text-gray-400" />
              <h3 className="mt-4 text-lg font-medium text-gray-900 dark:text-gray-100">
                开始您的研究
              </h3>
              <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
                使用下方输入框开始您的深度研究之旅
              </p>
            </div>
          </div>
        )}
      </div>

      {/* 底部输入区域 - 固定高度，不会被遮挡 */}
      {/* 
        🔧 高度优化说明：
        
        问题：UserGuide和DebugPanel在输入框上方增加了额外高度，可能导致输入框超出屏幕
        
        解决方案：
        1. 减少space-y-4到space-y-2，紧凑布局
        2. UserGuide设为默认折叠状态
        3. DebugPanel仅开发模式显示，生产环境不影响
        4. 考虑将这些辅助组件移到侧边或其他位置
        
        未来考虑：
        - 将UserGuide移到对话面板内部
        - 实现可折叠的底部区域
        - 根据屏幕高度动态调整
      */}
      <div className="flex-shrink-0 border-t border-white/20 bg-black/20 backdrop-blur-sm">
        <div className="mx-auto max-w-4xl">

          {/* 输入框区域 - 主要交互区域 */}
          <div className="px-4 pb-4">
            <HeroInput 
              traceId={urlParam}
              placeholder={hasMessages ? "继续研究对话..." : "开始您的研究之旅..."}
              onSendMessage={handleSendMessage}
              context="workspace"
              className="w-full"
            />
          </div>
        </div>
      </div>
    </div>
  );
}
