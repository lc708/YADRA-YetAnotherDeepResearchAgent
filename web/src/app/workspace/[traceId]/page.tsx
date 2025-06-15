"use client";

import { ArrowLeft, MessageSquare, FileText, Settings, Maximize2, Minimize2 } from "lucide-react";
import Link from "next/link";
import { useParams, useSearchParams } from "next/navigation";
import { useEffect, useState, useCallback, useRef } from "react";
import { cn } from "~/lib/utils";

import { Button } from "~/components/ui/button";
import { ArtifactFeed } from "~/components/yadra/artifact-feed";
import type { Resource, Option } from "~/core/messages";
import { setEnableBackgroundInvestigation, setReportStyle } from "~/core/store";
import { sendMessage, useMessageIds } from "~/core/store/store";
import { 
  useWorkspaceActions, 
  useConversationPanelVisible,
  useArtifactsPanelVisible,
  useWorkspaceFeedback
} from "~/core/store/workspace-store";


// 导入组件
import { ConversationPanel } from "./components/conversation-panel";
import { EnhancedInput } from "./components/enhanced-input";
import { DebugPanel } from "./components/debug-panel";
import { UserGuide } from "./components/user-guide";

export default function WorkspacePage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const traceId = params.traceId as string;
  const [initialized, setInitialized] = useState(false);
  const [query, setQuery] = useState<string | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  // 获取消息状态
  const messageIds = useMessageIds();
  const hasMessages = messageIds.length > 0;

  // Workspace状态管理
  const { 
    toggleConversationPanel, 
    toggleArtifactsPanel,
    setCurrentTraceId,
    setFeedback
  } = useWorkspaceActions();
  const conversationVisible = useConversationPanelVisible();
  const artifactVisible = useArtifactsPanelVisible();
  const feedback = useWorkspaceFeedback();
  


  // 实现消息发送处理函数（简化版本，移除重复检测）
  const handleSendMessage = useCallback(
    async (
      message: string,
      options?: {
        interruptFeedback?: string;
        resources?: Array<Resource>;
      },
    ) => {
      console.log("[WorkspacePage] Sending message:", message);
      
      const abortController = new AbortController();
      abortControllerRef.current = abortController;
      try {
        await sendMessage(
          message,
          {
            interruptFeedback:
              options?.interruptFeedback ?? feedback?.option.value,
            resources: options?.resources,
          },
          {
            abortSignal: abortController.signal,
          },
        );
        
        console.log("[WorkspacePage] Message sent successfully");
      } catch (error) {
        console.error("Failed to send message:", error);
        throw error; // 重新抛出错误，让调用方处理
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

  useEffect(() => {
    // 避免React Strict Mode的重复执行
    if (initialized || !searchParams) {
      return;
    }

    const q = searchParams.get("q");
    const investigation = searchParams.get("investigation");
    const style = searchParams.get("style");
    const resourcesParam = searchParams.get("resources");

    if (q) {
      setQuery(q);
      
      if (investigation === "true") {
        setEnableBackgroundInvestigation(true);
      }
      if (style) {
        setReportStyle(style as "academic" | "popular_science" | "news" | "social_media");
      }

      let resources: Resource[] = [];
      if (resourcesParam) {
        try {
          resources = JSON.parse(resourcesParam);
        } catch (error) {
          console.error("Failed to parse resources:", error);
        }
      }

      // 发送初始消息
      const sendInitialMessage = async () => {
        console.log("[WorkspacePage] Sending initial message:", q);
        
        // 创建AbortController
        const abortController = new AbortController();
        abortControllerRef.current = abortController;
        
        try {
          await sendMessage(q, { resources }, { abortSignal: abortController.signal });
          console.log("[WorkspacePage] Initial message sent successfully");
          setInitialized(true);
        } catch (error) {
          if (error instanceof Error && error.name !== 'AbortError') {
            console.error("Failed to send initial message:", error);
          } else if (error instanceof DOMException && error.message === 'Component unmounted') {
            // 组件卸载导致的中止是正常行为，不需要记录错误
            console.log("[WorkspacePage] Request aborted due to component unmount");
          }
          // 即使出错也设置为已初始化，避免无限重试
          setInitialized(true);
        }
      };

      void sendInitialMessage();
    } else {
      setInitialized(true);
    }
  }, [searchParams, traceId, initialized]);

  // 清理函数
  useEffect(() => {
    return () => {
      if (abortControllerRef.current && !abortControllerRef.current.signal.aborted) {
        abortControllerRef.current.abort(new DOMException('Component unmounted', 'AbortError'));
      }
    };
  }, []);

  // 设置当前traceId
  useEffect(() => {
    setCurrentTraceId(traceId);
  }, [traceId, setCurrentTraceId]);

  return (
    <div className="flex h-screen flex-col bg-gradient-to-br from-slate-900 via-slate-800 to-black">
      {/* 顶部导航栏 */}
      <div className="flex items-center justify-between border-b border-white/20 bg-black/20 px-4 py-3 backdrop-blur-sm">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="sm" asChild>
            <Link href="/">
              <ArrowLeft className="mr-2 h-4 w-4" />
              返回首页
            </Link>
          </Button>
          
          <div className="h-6 w-px bg-white/20" />
          
          <div className="min-w-0 flex-1">
            <h1 className="text-lg font-semibold text-white">研究工作区</h1>
            <p className="text-xs text-gray-400 truncate">
              {query ? `查询: ${query}` : `会话: ${traceId.slice(0, 8)}...`}
            </p>
          </div>
        </div>

        {/* 面板控制按钮 */}
        <div className="flex items-center gap-2">
          <Button
            variant={conversationVisible ? "default" : "outline"}
            size="sm"
            onClick={toggleConversationPanel}
            className="gap-2"
          >
            <MessageSquare className="h-4 w-4" />
            对话
            {conversationVisible ? <Minimize2 className="h-3 w-3" /> : <Maximize2 className="h-3 w-3" />}
          </Button>
          
          <Button
            variant={artifactVisible ? "default" : "outline"}
            size="sm"
            onClick={toggleArtifactsPanel}
            className="gap-2"
          >
            <FileText className="h-4 w-4" />
            工件
            {artifactVisible ? <Minimize2 className="h-3 w-3" /> : <Maximize2 className="h-3 w-3" />}
          </Button>
        </div>
      </div>

      {/* 主要内容区域 */}
      <div className="flex flex-1 overflow-hidden">
        {/* 左侧对话面板 */}
        {conversationVisible && (
          <div className="flex w-1/2 flex-col border-r border-gray-200 dark:border-gray-700">
            <ConversationPanel traceId={traceId} />
          </div>
        )}

        {/* 右侧工件面板 */}
        {artifactVisible && (
          <div className={cn(
            "flex flex-col",
            conversationVisible ? "w-1/2" : "w-full"
          )}>
            <div className="border-b border-gray-200 px-4 py-3 dark:border-gray-700">
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
            <div className="flex-1 overflow-hidden">
              <ArtifactFeed traceId={traceId} />
            </div>
          </div>
        )}

        {/* 当两个面板都隐藏时显示空状态 */}
        {!conversationVisible && !artifactVisible && (
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

      {/* 底部输入区域 */}
      <div className="border-t border-white/20 bg-black/20 p-4 backdrop-blur-sm">
        <div className="mx-auto max-w-4xl space-y-4">
          {/* 用户指南 */}
          <UserGuide />
          
          {/* 调试面板 - 仅在开发模式显示 */}
          <DebugPanel />
          
          <EnhancedInput 
            traceId={traceId}
            placeholder={hasMessages ? "继续研究对话..." : "开始您的研究之旅..."}
            onSendMessage={handleSendMessage}
          />
        </div>
      </div>
    </div>
  );
}
