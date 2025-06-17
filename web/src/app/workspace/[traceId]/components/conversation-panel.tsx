// Copyright (c) 2025 YADRA

"use client";

import { LoadingOutlined } from "@ant-design/icons";
import { motion } from "framer-motion";
import { MessageSquare } from "lucide-react";
import { useCallback, useMemo, useRef, useEffect } from "react";

import { 
  MessageBubble, 
  ResearchCard, 
  PlanCard, 
  PodcastCard 
} from "~/app/chat/components/message-list-view";
import {
  Card,
  CardContent,
} from "~/components/ui/card";
import { LoadingAnimation } from "~/components/yadra/loading-animation";
import { Markdown } from "~/components/yadra/markdown";
import {
  ScrollContainer,
  type ScrollContainerRef,
} from "~/components/yadra/scroll-container";
import type { Message, Option, Resource } from "~/core/messages";
import {
  useMessageIds,
  useMessage,
  useCurrentThread,
  useUnifiedStore,
  useWorkspaceState,
} from "~/core/store/unified-store";
import { cn } from "~/lib/utils";

// 复用MessageListView的子组件

interface ConversationPanelProps {
  traceId: string;
  className?: string;
  onFeedback?: (feedback: { option: Option }) => void;
  onSendMessage?: (
    message: string,
    options?: { interruptFeedback?: string; resources?: Resource[] },
  ) => void;
}

export function ConversationPanel({
  traceId,
  className,
  onFeedback,
  onSendMessage,
}: ConversationPanelProps) {
  const scrollContainerRef = useRef<ScrollContainerRef>(null);
  const messageIds = useMessageIds();
  const threadData = useCurrentThread();
  const interruptMessage = threadData?.ui.lastInterruptMessageId 
    ? useMessage(threadData.ui.lastInterruptMessageId) 
    : null;
  const waitingForFeedbackMessageId = threadData?.ui.waitingForFeedbackMessageId || null;
  const responding = useUnifiedStore((state) => state.responding);
  const openResearchId = threadData?.metadata.openResearchId;
  const noOngoingResearch = !threadData?.metadata.ongoingResearchId;
  const ongoingResearchIsOpen = threadData?.metadata.ongoingResearchId === openResearchId;

  // Workspace状态管理
  const workspaceState = useWorkspaceState();
  const setWorkspaceState = useUnifiedStore((state) => state.setWorkspaceState);
  const conversationVisible = workspaceState.conversationVisible;

  // 实现消息发送处理函数
  const handleSendMessage = useCallback(
    async (
      message: string,
      options?: { interruptFeedback?: string; resources?: Resource[] }
    ) => {
      try {
        if (onSendMessage) {
          onSendMessage(message, options);
        } else {
          // TODO: 实现 sendMessage
          console.warn("sendMessage not implemented yet");
        }
      } catch (error) {
        console.error("Failed to send message:", error);
      }
    },
    [onSendMessage]
  );

  // 实现反馈处理函数
  const handleFeedback = useCallback(
    (feedback: { option: Option }) => {
      // 将反馈状态保存到workspace store
      setWorkspaceState({ feedback });
      
      if (onFeedback) {
        onFeedback(feedback);
      }
    },
    [onFeedback, setWorkspaceState]
  );

  // 初始化workspace集成
  useEffect(() => {
    const store = useUnifiedStore.getState();
    store.setCurrentThread(traceId);
    store.setWorkspaceState({ currentTraceId: traceId });

    return () => {
      // 清理时不重置traceId，保持状态
    };
  }, [traceId]);

  const handleToggleResearch = useCallback(() => {
    // Fix the issue where auto-scrolling to the bottom
    // occasionally fails when toggling research.
    const timer = setTimeout(() => {
      if (scrollContainerRef.current) {
        scrollContainerRef.current.scrollToBottom();
      }
    }, 500);
    return () => {
      clearTimeout(timer);
    };
  }, []);

  // 如果面板被隐藏，显示最小化状态
  if (!conversationVisible) {
    return (
      <div className={cn("flex h-full w-full items-center justify-center", className)}>
        <Card className="w-full max-w-sm">
          <CardContent className="flex flex-col items-center gap-4 p-6">
            <MessageSquare className="h-12 w-12 text-muted-foreground" />
            <div className="text-center">
              <h3 className="font-semibold">对话面板已隐藏</h3>
              <p className="text-sm text-muted-foreground">
                点击右上角按钮展开对话历史
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className={cn("flex h-full w-full flex-col", className)}>
      {/* 面板标题栏 */}
      <div className="flex items-center justify-between border-b bg-background/50 px-4 py-3 backdrop-blur-sm">
        <div className="flex items-center gap-2">
          <MessageSquare className="h-5 w-5" />
          <h3 className="font-semibold">实时对话</h3>
          <span className="text-xs text-muted-foreground">
            ({messageIds.length} 条消息)
          </span>
        </div>
        <div className="flex items-center gap-2">
          {responding && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <LoadingOutlined className="animate-spin" />
              <span>AI正在回复...</span>
            </div>
          )}
          {/* 调试信息 */}
          {process.env.NODE_ENV === 'development' && (
            <div className="text-xs text-muted-foreground">
              Debug: {interruptMessage ? '有中断消息' : '无中断消息'} | 
              等待反馈: {waitingForFeedbackMessageId ? '是' : '否'}
            </div>
          )}
        </div>
      </div>

      {/* 消息列表 */}
      <div className="flex-1 overflow-hidden">
        <ScrollContainer
          className="flex h-full w-full flex-col overflow-hidden"
          scrollShadowColor="var(--app-background)"
          autoScrollToBottom
          ref={scrollContainerRef}
        >
          <ul className="flex flex-col">
            {messageIds.length === 0 ? (
              <div className="flex h-full items-center justify-center p-8">
                <div className="text-center">
                  <MessageSquare className="mx-auto h-12 w-12 text-muted-foreground" />
                  <h3 className="mt-4 font-semibold">暂无对话消息</h3>
                  <p className="text-sm text-muted-foreground">
                    开始研究后，对话消息将在这里显示
                  </p>
                </div>
              </div>
            ) : (
              messageIds.map((messageId) => (
                <ConversationMessageItem
                  key={messageId}
                  messageId={messageId}
                  waitForFeedback={waitingForFeedbackMessageId === messageId}
                  interruptMessage={interruptMessage}
                  onFeedback={handleFeedback}
                  onSendMessage={handleSendMessage}
                  onToggleResearch={handleToggleResearch}
                />
              ))
            )}
            <div className="flex h-8 w-full shrink-0"></div>
          </ul>
          {responding && (noOngoingResearch || !ongoingResearchIsOpen) && (
            <LoadingAnimation className="ml-4" />
          )}
        </ScrollContainer>
      </div>
    </div>
  );
}

// 消息项组件，复用MessageListView的逻辑
function ConversationMessageItem({
  className,
  messageId,
  waitForFeedback,
  interruptMessage,
  onFeedback,
  onSendMessage,
  onToggleResearch,
}: {
  className?: string;
  messageId: string;
  waitForFeedback?: boolean;
  onFeedback?: (feedback: { option: Option }) => void;
  interruptMessage?: Message | null;
  onSendMessage?: (
    message: string,
    options?: { interruptFeedback?: string; resources?: Resource[] },
  ) => void;
  onToggleResearch?: () => void;
}) {
  const message = useMessage(messageId);
  const threadData = useCurrentThread();
  const researchIds = threadData?.metadata.researchIds || [];
  const startOfResearch = useMemo(() => {
    return researchIds.includes(messageId);
  }, [researchIds, messageId]);

  if (!message) return null;

  if (
    message.role === "user" ||
    message.agent === "coordinator" ||
    message.agent === "planner" ||
    message.agent === "podcast" ||
    startOfResearch
  ) {
    let content: React.ReactNode;
    
    if (message.agent === "planner") {
      content = (
        <div className="w-full px-4">
          <PlanCard
            message={message}
            waitForFeedback={waitForFeedback}
            interruptMessage={interruptMessage}
            onFeedback={onFeedback}
            onSendMessage={onSendMessage}
          />
        </div>
      );
    } else if (message.agent === "podcast") {
      content = (
        <div className="w-full px-4">
          <PodcastCard message={message} />
        </div>
      );
    } else if (startOfResearch) {
      content = (
        <div className="w-full px-4">
          <ResearchCard
            researchId={message.id}
            onToggleResearch={onToggleResearch}
          />
        </div>
      );
    } else {
      content = message.content ? (
        <div
          className={cn(
            "flex w-full px-4",
            message.role === "user" && "justify-end",
            className,
          )}
        >
          <MessageBubble message={message}>
            <div className="flex w-full flex-col text-wrap break-words">
              <Markdown
                className={cn(
                  message.role === "user" &&
                    "prose-invert not-dark:text-secondary dark:text-inherit",
                )}
              >
                {message?.content}
              </Markdown>
            </div>
          </MessageBubble>
        </div>
      ) : null;
    }

    if (content) {
      return (
        <motion.li
          className="mt-10"
          key={messageId}
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          style={{ transition: "all 0.2s ease-out" }}
          transition={{
            duration: 0.2,
            ease: "easeOut",
          }}
        >
          {content}
        </motion.li>
      );
    }
  }

  return null;
} 