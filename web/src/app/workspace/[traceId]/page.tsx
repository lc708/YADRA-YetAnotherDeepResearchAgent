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
  setCurrentThreadId, 
  sendMessage, 
  useMessageIds, 
  useStore,
  useWorkspaceActions,
  useConversationPanelVisible,
  useArtifactsPanelVisible,
  useHistoryPanelVisible,
  usePodcastPanelVisible,
  useWorkspaceFeedback,
} from "~/core/store";
import {
  // 新架构导入
  setCurrentUrlParam,
  setUrlParamMapping,
  setSessionState,
  useCurrentUrlParam,
  useSessionState,
  sendMessageWithNewAPI,
} from "~/core/store/unified-store";
import { getWorkspaceState } from "~/core/api/research-stream";
import { parseJSON } from "~/core/utils";
import { toast } from "sonner";

// 导入组件
import { ConversationPanel } from "./components/conversation-panel";
import { HeroInput } from "~/components/yadra/hero-input";
import { DebugPanel } from "./components/debug-panel";
import { UserGuide } from "./components/user-guide";
import { MessageHistory } from "./components/message-history";
import { PodcastPanel } from "./components/podcast-panel";

export default function WorkspacePage() {
  const params = useParams();
  const urlParam = params.traceId as string; // 注意：这里是url_param，不是thread_id
  const [initialized, setInitialized] = useState(false);
  const [loading, setLoading] = useState(true);
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

  // 初始化工作区状态
  useEffect(() => {
    if (!urlParam || initialized) return;

    const initializeWorkspace = async () => {
      setLoading(true);
      setError(null);

      try {
        console.log(`[WorkspacePage] Initializing workspace with url_param: ${urlParam}`);
        
        // 设置当前URL参数
        setCurrentUrlParam(urlParam);
        
        // 获取工作区状态
        const workspaceData = await getWorkspaceState(urlParam);
        console.log('[WorkspacePage] Workspace data loaded:', workspaceData);
        
        // 设置会话状态
        setSessionState({
          sessionMetadata: workspaceData.sessionMetadata,
          executionHistory: workspaceData.executionHistory || [],
          currentConfig: workspaceData.config?.currentConfig || null,
          permissions: workspaceData.permissions || null,
        });
        
        // 设置URL参数到thread_id的映射
        setUrlParamMapping(urlParam, workspaceData.threadId);
        
        // 设置当前thread_id
        setCurrentThreadId(workspaceData.threadId);
        
        // 恢复消息历史
        if (workspaceData.messages && workspaceData.messages.length > 0) {
          console.log(`[WorkspacePage] Restoring ${workspaceData.messages.length} messages`);
          // TODO: 将messages转换为Message格式并添加到store
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
        
        setInitialized(true);
        console.log('[WorkspacePage] Workspace initialized successfully');
        
      } catch (error) {
        console.error('[WorkspacePage] Failed to initialize workspace:', error);
        setError(error instanceof Error ? error.message : 'Failed to load workspace');
      } finally {
        setLoading(false);
      }
    };

    initializeWorkspace();
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

  // 如果正在加载，显示加载状态
  if (loading) {
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
            <h1 className="text-lg font-semibold text-white">研究工作区</h1>
            <p className="text-xs text-gray-400 truncate" title={urlParam || `会话: ${urlParam}`}>
              {urlParam ? `查询: ${urlParam.length > 30 ? urlParam.substring(0, 30) + '...' : urlParam}` : `会话: ${urlParam.slice(0, 8)}...`}
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
          {/* 辅助组件区域 - 紧凑布局 */}
          <div className="px-4 py-2 space-y-2">
            {/* 用户指南 - 紧凑显示 */}
            <UserGuide />
            
            {/* 调试面板 - 仅在开发模式显示 */}
            <DebugPanel />
          </div>
          
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
