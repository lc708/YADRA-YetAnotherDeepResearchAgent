// Copyright (c) 2025 YADRA

"use client";

import { LoadingOutlined } from "@ant-design/icons";
import { motion } from "framer-motion";
import { MessageSquare } from "lucide-react";
import { useCallback, useMemo, useRef, useEffect } from "react";

// 使用新的组件系统，fallback到旧组件
import { MessageContainer, type Message as NewMessage } from "~/components/conversation/message-container";
import { ScrollContainer, type ScrollContainerRef } from "~/components/conversation/scroll-container";
import { LoadingAnimation } from "~/components/conversation/loading-animation";
import { MarkdownRenderer } from "~/components/conversation/markdown-renderer";

// 使用yadra组件作为fallback
import { Markdown } from "~/components/yadra/markdown";
import {
  Card,
  CardContent,
} from "~/components/ui/card";
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
  
  // 🔥 调试：打印参数和获取的消息
  console.log('[ConversationPanel] traceId:', traceId);
  
  const messageIds = useMessageIds(traceId) || []; // 🔥 修复：传入traceId参数
  const threadData = useCurrentThread();
  
  // 🔥 调试：打印获取的消息数量和thread信息
  console.log('[ConversationPanel] messageIds:', messageIds);
  console.log('[ConversationPanel] messageIds.length:', messageIds.length);
  console.log('[ConversationPanel] currentThread:', threadData);
  
  // 🔥 获取URL参数到thread_id的映射，用于调试
  const urlParamToThreadId = useUnifiedStore((state) => state.urlParamToThreadId);
  const mappedThreadId = urlParamToThreadId.get(traceId);
  console.log('[ConversationPanel] URL param mapping:', traceId, '->', mappedThreadId);
  
  // 修复条件Hook调用 - 始终调用useMessage，然后根据条件使用结果
  const lastInterruptMessageId = threadData?.ui.lastInterruptMessageId;
  const interruptMessageResult = useMessage(lastInterruptMessageId || "");
  const interruptMessage = lastInterruptMessageId ? interruptMessageResult : null;
  
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
    // traceId实际上是URL参数，需要映射到真正的thread_id
    const realThreadId = store.getThreadIdByUrlParam(traceId);
    if (realThreadId) {
      store.setCurrentThread(realThreadId);
    }
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

  // 渲染内容 - 移除条件提前返回，改为条件渲染
  const renderContent = () => {
    if (!conversationVisible) {
      return (
        <div className={cn("flex h-full w-full items-center justify-center", className)}>
          <div className="w-full max-w-sm">
            <div className="flex flex-col items-center gap-4 p-6">
              <MessageSquare className="h-12 w-12 text-white/60" />
              <div className="text-center">
                <h3 className="font-semibold text-white">对话面板已隐藏</h3>
                <p className="text-sm text-white/60">
                  点击右上角按钮展开对话历史
                </p>
              </div>
            </div>
          </div>
        </div>
      );
    }

    return (
      <div className={cn("flex h-full w-full flex-col", className)}>
        {/* 消息列表 - 移除标题栏，直接显示消息 */}
        <div className="flex-1 overflow-hidden">
          <ScrollContainer
            ref={scrollContainerRef}
            className="h-full p-4"
            autoScrollToBottom={true}
          >
            <div className="space-y-4">
              {messageIds.length === 0 ? (
                <div className="flex items-center justify-center h-40">
                  <div className="text-center">
                    <MessageSquare className="h-8 w-8 text-white/40 mx-auto mb-2" />
                    <p className="text-white/60 text-sm">暂无对话消息</p>
                    {process.env.NODE_ENV === 'development' && (
                      <p className="text-blue-400 text-xs mt-1">
                        Debug: traceId={traceId}
                      </p>
                    )}
                  </div>
                </div>
              ) : (
                messageIds.map((messageId, index) => (
                  <ConversationMessageItem
                    key={messageId}
                    messageId={messageId}
                    className={index === messageIds.length - 1 ? "mb-4" : ""}
                    waitForFeedback={waitingForFeedbackMessageId === messageId}
                    interruptMessage={interruptMessage}
                    onFeedback={handleFeedback}
                    onSendMessage={handleSendMessage}
                    onToggleResearch={handleToggleResearch}
                  />
                ))
              )}
              
              {/* 加载状态 */}
              {responding && (
                <div className="flex items-center gap-2 p-4 text-white/60">
                  <LoadingOutlined className="animate-spin" />
                  <span className="text-sm">AI正在思考和回复...</span>
                </div>
              )}
            </div>
          </ScrollContainer>
        </div>
      </div>
    );
  };

  return renderContent();
}

// 消息项组件，使用新的组件系统
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

  // 适配Message类型到新组件的格式
  const adaptedMessage: NewMessage = {
    id: message.id,
    role: message.role as "user" | "assistant" | "system",
    content: message.content || "",
    timestamp: new Date(), // Message类型暂无timestamp字段
    isStreaming: message.isStreaming || false,
    metadata: {
      model: message.agent,
      reasoning: message.reasoningContent || undefined,
      artifacts: [] // Message类型暂无artifacts字段
    }
  };

  if (
    message.role === "user" ||
    message.agent === "coordinator" ||
    message.agent === "planner" ||
    message.agent === "podcast" ||
    startOfResearch
  ) {
    let content: React.ReactNode;
    
    // 简化版本：先只处理基本消息，特殊类型后续实现
    if (message.content) {
      if (message.agent === "planner") {
        // TODO: 实现计划显示
        content = (
          <div className="w-full px-4">
            <MessageContainer
              message={adaptedMessage}
              showAvatar={true}
              showTimestamp={true}
              showActions={false}
              className="border-l-4 border-l-blue-500 bg-blue-50/50 dark:bg-blue-950/20"
            />
          </div>
        );
      } else if (message.agent === "podcast") {
        // TODO: 实现播客显示
        content = (
          <div className="w-full px-4">
            <MessageContainer
              message={adaptedMessage}
              showAvatar={true}
              showTimestamp={true}
              showActions={false}
              className="border-l-4 border-l-purple-500 bg-purple-50/50 dark:bg-purple-950/20"
            />
          </div>
        );
      } else if (startOfResearch) {
        // TODO: 实现研究进度显示
        content = (
          <div className="w-full px-4">
            <MessageContainer
              message={adaptedMessage}
              showAvatar={true}
              showTimestamp={true}
              showActions={false}
              className="border-l-4 border-l-green-500 bg-green-50/50 dark:bg-green-950/20"
            />
          </div>
        );
      } else {
        // 基本消息显示
        content = (
          <div className="w-full px-4">
            <MessageContainer
              message={adaptedMessage}
              showAvatar={true}
              showTimestamp={true}
              showActions={true}
              onCopy={(content) => {
                navigator.clipboard.writeText(content);
              }}
              className={className}
            />
          </div>
        );
      }
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