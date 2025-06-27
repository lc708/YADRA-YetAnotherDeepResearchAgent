// Copyright (c) 2025 YADRA

/**
 * MessageContainer - 智能消息容器组件
 * 
 * 🔄 替换目标：
 * - ~/components/yadra/message-bubble（旧版本）
 * - ~/app/chat/components/message-bubble（废弃版本）
 * 
 * 📍 使用位置：
 * - conversation-panel.tsx - 主要消息显示
 * - message-history.tsx - 历史消息显示
 * 
 * 🎯 功能特性：
 * - 支持用户和AI消息
 * - 流式内容渲染
 * - 状态指示和操作按钮
 * - 响应式设计和动画
 * - Markdown内容渲染
 */

"use client";

import React, { useState, useCallback, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "~/lib/utils";
import { Button } from "~/components/ui/button";
import StatusBadge, { type StatusType } from "./status-badge";
import LoadingAnimation from "./loading-animation";
import MarkdownRenderer from "./markdown-renderer";
import { User, Bot, ChevronDown, ChevronUp } from "lucide-react";

// Agent类型到中文显示名称的映射
const getAgentDisplayName = (agent?: string): string => {
  if (!agent) return "YADRA";
  
  const agentMapping: Record<string, string> = {
    "generalmanager": "YADRA CEO",
    "projectmanager": "项目经理", 
    "researcher": "高级分析师",
    "coder": "开发工程师",
    "reporter": "资深编辑"
  };
  
  return agentMapping[agent] || `【Agent：${agent}】`;
};

export interface Message {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  timestamp: Date;
  status?: StatusType;
  isStreaming?: boolean;
  toolCalls?: Array<{
    id: string;
    name: string;
    args: Record<string, unknown>;
  }>;
  metadata?: {
    model?: string;
    tokens?: number;
    reasoning?: string;
    artifacts?: string[];
  };
}

interface MessageContainerProps {
  message: Message;
  showAvatar?: boolean;
  showTimestamp?: boolean;
  showActions?: boolean;
  showStatus?: boolean;
  isLatest?: boolean;
  onCopy?: (content: string) => void;
  onRegenerate?: (messageId: string) => void;
  onEdit?: (messageId: string, newContent: string) => void;
  className?: string;
}

// 头像组件
const MessageAvatar: React.FC<{ role: Message["role"] }> = ({ role }) => {
  const avatarConfig = {
    user: {
      fallback: "U",
      bgColor: "bg-blue-500",
      icon: "👤"
    },
    assistant: {
      fallback: "AI",
      bgColor: "bg-gradient-to-br from-purple-500 to-pink-500",
      icon: "🤖"
    },
    system: {
      fallback: "SYS",
      bgColor: "bg-muted-foreground",
      icon: "⚙️"
    }
  };

  const config = avatarConfig[role];

  return (
    <div className={cn(
      "h-8 w-8 shrink-0 rounded-full flex items-center justify-center text-white text-xs font-medium",
      config.bgColor
    )}>
      {config.fallback}
    </div>
  );
};

// 消息操作按钮
const MessageActions: React.FC<{
  message: Message;
  onCopy?: (content: string) => void;
  onRegenerate?: (messageId: string) => void;
  onEdit?: (messageId: string, newContent: string) => void;
}> = ({ message, onCopy, onRegenerate, onEdit }) => {
  const [showActions, setShowActions] = useState(false);
  const [copied, setCopied] = useState(false);

  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(message.content);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
      onCopy?.(message.content);
    } catch (err) {
      console.error('Failed to copy message:', err);
    }
  }, [message.content, onCopy]);

  return (
    <div 
      className="relative"
      onMouseEnter={() => setShowActions(true)}
      onMouseLeave={() => setShowActions(false)}
    >
      <AnimatePresence>
        {showActions && (
          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 10 }}
            className="absolute top-0 right-0 flex items-center gap-1 bg-background/90 backdrop-blur-sm border rounded-lg p-1 shadow-lg z-10"
          >
            <Button
              variant="ghost"
              size="sm"
              onClick={handleCopy}
              className="h-7 w-7 p-0"
              title="复制消息"
            >
              <AnimatePresence mode="wait">
                {copied ? (
                  <motion.span
                    key="check"
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    exit={{ scale: 0 }}
                    className="text-green-600 text-xs"
                  >
                    ✓
                  </motion.span>
                ) : (
                  <motion.span
                    key="copy"
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    exit={{ scale: 0 }}
                    className="text-xs"
                  >
                    📋
                  </motion.span>
                )}
              </AnimatePresence>
            </Button>

            {message.role === "assistant" && onRegenerate && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => onRegenerate(message.id)}
                className="h-7 w-7 p-0"
                title="重新生成"
              >
                <span className="text-xs">🔄</span>
              </Button>
            )}

            {message.role === "user" && onEdit && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => onEdit(message.id, message.content)}
                className="h-7 w-7 p-0"
                title="编辑消息"
              >
                <span className="text-xs">✏️</span>
              </Button>
            )}


          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

// 消息元数据显示
const MessageMetadata: React.FC<{ message: Message }> = ({ message }) => {
  if (!message.metadata) return null;

  return (
    <div className="mt-2 flex flex-wrap gap-2 text-xs text-muted-foreground">
      {message.metadata.tokens && (
        <span className="bg-muted/50 px-2 py-1 rounded">
          Token: {message.metadata.tokens}
        </span>
      )}
      {message.metadata.artifacts && message.metadata.artifacts.length > 0 && (
        <span className="bg-muted/50 px-2 py-1 rounded">
          附件: {message.metadata.artifacts.length}
        </span>
      )}
    </div>
  );
};

export const MessageContainer: React.FC<MessageContainerProps> = ({
  message,
  showAvatar = true,
  showTimestamp = true,
  showActions = true,
  showStatus = true,
  isLatest = false,
  onCopy,
  onRegenerate,
  onEdit,
  className
}) => {
  const contentRef = useRef<HTMLDivElement>(null);
  const [isContentVisible, setIsContentVisible] = useState(false);
  const [isCollapsed, setIsCollapsed] = useState(false);

  // 检测内容是否可见（用于动画触发）
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        const entry = entries[0];
        if (entry && entry.isIntersecting) {
          setIsContentVisible(true);
        }
      },
      { threshold: 0.1 }
    );

    if (contentRef.current) {
      observer.observe(contentRef.current);
    }

    return () => observer.disconnect();
  }, []);

  const isUserMessage = message.role === "user";
  const isStreamingOrLoading = message.isStreaming || message.status === "loading" || message.status === "processing";

  // 自动折叠逻辑：当AI消息流式传输完成后自动折叠
  useEffect(() => {
    if (!isUserMessage && !isStreamingOrLoading && message.content.length > 200) {
      const timer = setTimeout(() => {
        setIsCollapsed(true);
      }, 2000); // 2秒后自动折叠
      
      return () => clearTimeout(timer);
    }
  }, [isUserMessage, isStreamingOrLoading, message.content.length]);

  // 折叠状态变化时触发滚动更新
  const handleToggleCollapse = useCallback(() => {
    setIsCollapsed(prev => !prev);
    // 延迟触发滚动，确保DOM更新完成
    setTimeout(() => {
      const scrollContainer = document.querySelector('[data-scroll-container]');
      if (scrollContainer) {
        scrollContainer.scrollTop = scrollContainer.scrollHeight;
      }
    }, 100);
  }, []);

  return (
    <motion.div
      ref={contentRef}
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay: isLatest ? 0.1 : 0 }}
      className={cn(
        "group relative flex gap-3 p-4",
        isUserMessage ? "flex-row-reverse" : "flex-row",
        className
      )}
    >
      {/* 头像 */}
      {showAvatar && (
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ delay: 0.2 }}
        >
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-white">
            {message.role === 'user' ? (
              <User className="h-4 w-4" />
            ) : (
              <Bot className="h-4 w-4" />
            )}
          </div>
        </motion.div>
      )}

      {/* 消息内容区域 */}
      <div className={cn(
        "flex-1 min-w-0",
        isUserMessage ? "text-right" : "text-left"
      )}>
        {/* 消息头部 */}
        <div className={cn(
          "flex items-center gap-2 mb-2",
          isUserMessage ? "justify-end" : "justify-start"
        )}>
          <div className={cn(
            "flex items-center gap-2",
            isUserMessage && "order-2"
          )}>
            <span className="text-sm font-medium text-foreground">
              {message.role === 'user' ? '你' : getAgentDisplayName(message.metadata?.model)}
            </span>

            {showTimestamp && (
              <span className="text-xs text-muted-foreground">
                {message.timestamp.toLocaleTimeString()}
              </span>
            )}

            {showStatus && message.status && (
              <StatusBadge 
                status={message.status} 
                size="sm"
                showPulse={isStreamingOrLoading}
              />
            )}
          </div>
        </div>

        {/* 消息内容 */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: isContentVisible ? 1 : 0 }}
          transition={{ duration: 0.5, delay: 0.3 }}
          className={cn(
            "relative",
            isUserMessage 
              ? "bg-white border border-blue-500 text-foreground rounded-2xl rounded-tr-md px-4 py-3 max-w-fit ml-auto"
              : "bg-white border border-gray-300 text-foreground rounded-2xl rounded-tl-md px-4 py-3 max-w-[90%]"
          )}
        >
          {/* 折叠按钮 - 位于AI聊天泡泡右上角 */}
          {!isUserMessage && !isStreamingOrLoading && message.content.length > 200 && (
            <Button
              variant="ghost"
              size="sm"
              onClick={handleToggleCollapse}
              className="absolute -top-2 -right-2 h-6 w-6 p-0 hover:bg-muted/80 text-muted-foreground bg-white border border-gray-300 rounded-full shadow-sm z-10"
            >
              {isCollapsed ? (
                <ChevronDown className="h-3 w-3" />
              ) : (
                <ChevronUp className="h-3 w-3" />
              )}
            </Button>
          )}
          {/* 加载状态 */}
          {isStreamingOrLoading && message.content.length === 0 ? (
            <LoadingAnimation 
              type="typing" 
              size="sm" 
              text="正在思考..."
              showText={false}
            />
          ) : (
            <div className={cn(
              "prose prose-sm max-w-none text-foreground text-sm leading-tight relative"
            )}>
              <MarkdownRenderer 
                content={message.content}
                className={cn(
                  isCollapsed && !isUserMessage && "line-clamp-2 overflow-hidden"
                )}
              />
              {/* 渐变遮罩（折叠状态下） */}
              {isCollapsed && !isUserMessage && (
                <div className="absolute bottom-0 left-0 right-0 h-6 bg-gradient-to-t from-white to-transparent pointer-events-none" />
              )}
            </div>
          )}

          {/* 流式指示器 */}
          {message.isStreaming && message.content.length > 0 && (
            <motion.span
              animate={{ opacity: [1, 0.3, 1] }}
              transition={{ duration: 1, repeat: Infinity }}
              className="inline-block w-2 h-4 bg-current ml-1 align-bottom"
            />
          )}

          {/* 操作按钮 */}
          {showActions && !isStreamingOrLoading && (
            <MessageActions
              message={message}
              onCopy={onCopy}
              onRegenerate={onRegenerate}
              onEdit={onEdit}
            />
          )}
        </motion.div>

        {/* 元数据 */}
        <MessageMetadata message={message} />
      </div>
    </motion.div>
  );
};

export default MessageContainer; 