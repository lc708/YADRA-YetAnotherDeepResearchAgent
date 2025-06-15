"use client";

import { ArrowLeft, MessageSquare, FileText, Settings, Maximize2, Minimize2 } from "lucide-react";
import Link from "next/link";
import { useParams, useSearchParams } from "next/navigation";
import { useEffect, useState, useCallback, useRef } from "react";

import { Button } from "~/components/ui/button";
import { ArtifactFeed } from "~/components/yadra/artifact-feed";
import type { Resource, Option } from "~/core/messages";
import { setEnableBackgroundInvestigation, setReportStyle } from "~/core/store";
import { sendMessage } from "~/core/store/store";
import { 
  useWorkspaceActions, 
  useConversationPanelVisible,
  useArtifactsPanelVisible,
  useWorkspaceFeedback
} from "~/core/store/workspace-store";

// 导入新组件
import { ConversationPanel } from "./components/conversation-panel";
import { DebugPanel } from "./components/debug-panel";
import { EnhancedInput } from "./components/enhanced-input";
import { UserGuide } from "./components/user-guide";

export default function WorkspacePage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const traceId = params.traceId as string;
  const [initialized, setInitialized] = useState(false);
  const [query, setQuery] = useState<string | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

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

  // 实现消息发送处理函数（类似旧版本chat的实现）
  const handleSendMessage = useCallback(
    async (
      message: string,
      options?: {
        interruptFeedback?: string;
        resources?: Array<Resource>;
      },
    ) => {
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
      } catch (error) {
        console.error("Failed to send message:", error);
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
    if (!initialized && searchParams) {
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

        // 添加防重复提交机制
        const sendInitialMessage = async () => {
          if (abortControllerRef.current) {
            abortControllerRef.current.abort();
          }
          
          const abortController = new AbortController();
          abortControllerRef.current = abortController;
          
          try {
            await sendMessage(q, { resources }, { abortSignal: abortController.signal });
            setInitialized(true);
          } catch (error) {
            if (error instanceof Error && error.name !== 'AbortError') {
              console.error("Failed to send initial message:", error);
            }
          }
        };

        void sendInitialMessage();
      }
    }
  }, [searchParams, initialized, traceId]);

  // 清理函数
  useEffect(() => {
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
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
          <div className="flex w-1/2 flex-col border-r border-white/20 bg-black/10 backdrop-blur-sm">
            <ConversationPanel 
              traceId={traceId}
              className="flex-1"
              onSendMessage={handleSendMessage}
              onFeedback={handleFeedback}
            />
          </div>
        )}

        {/* 右侧工件面板 */}
        {artifactVisible && (
          <div className={`flex flex-col bg-black/5 backdrop-blur-sm ${
            conversationVisible ? "w-1/2" : "w-full"
          }`}>
            <div className="flex items-center justify-between border-b border-white/20 bg-background/50 px-4 py-3 backdrop-blur-sm">
              <div className="flex items-center gap-2">
                <FileText className="h-5 w-5" />
                <h3 className="font-semibold">研究工件</h3>
              </div>
            </div>
            
            <div className="flex-1 overflow-hidden">
              <ArtifactFeed traceId={traceId} />
            </div>
          </div>
        )}

        {/* 当两个面板都隐藏时的占位内容 */}
        {!conversationVisible && !artifactVisible && (
          <div className="flex flex-1 items-center justify-center">
            <div className="text-center space-y-4">
              <div className="mx-auto h-16 w-16 rounded-full bg-white/10 flex items-center justify-center">
                <Settings className="h-8 w-8 text-white/60" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-white">选择面板显示</h3>
                <p className="text-sm text-gray-400">
                  点击顶部按钮显示对话或工件面板
                </p>
              </div>
              <div className="flex gap-2 justify-center">
                <Button
                  variant="outline"
                  onClick={toggleConversationPanel}
                  className="gap-2"
                >
                  <MessageSquare className="h-4 w-4" />
                  显示对话
                </Button>
                <Button
                  variant="outline"
                  onClick={toggleArtifactsPanel}
                  className="gap-2"
                >
                  <FileText className="h-4 w-4" />
                  显示工件
                </Button>
              </div>
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
            placeholder="继续研究对话..."
            onSendMessage={handleSendMessage}
          />
        </div>
      </div>
    </div>
  );
}
