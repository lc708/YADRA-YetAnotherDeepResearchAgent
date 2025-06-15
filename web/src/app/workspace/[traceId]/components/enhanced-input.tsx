// Copyright (c) 2025 YADRA

"use client";

import { LoadingOutlined } from "@ant-design/icons";
import { Send, Paperclip, StopCircle } from "lucide-react";
import { useState, useRef, useCallback, useEffect } from "react";
import { useShallow } from "zustand/react/shallow";

import { Button } from "~/components/ui/button";
import { Textarea } from "~/components/ui/textarea";
import { Tooltip } from "~/components/yadra/tooltip";
import type { Resource } from "~/core/messages";
import { sendMessage, useStore } from "~/core/store";
import { 
  useWorkspaceActions, 
  useWorkspaceFeedback 
} from "~/core/store/workspace-store";

import { cn } from "~/lib/utils";

// 导入反馈系统组件
import { FeedbackSystem } from "./feedback-system";

interface EnhancedInputProps {
  traceId: string;
  className?: string;
  placeholder?: string;
  onSendMessage?: (message: string, options?: { 
    resources?: Resource[];
    interruptFeedback?: string;
  }) => void;
}

export function EnhancedInput({
  traceId,
  className,
  placeholder = "继续对话...",
  onSendMessage,
}: EnhancedInputProps) {
  const [message, setMessage] = useState("");
  const [resources, setResources] = useState<Resource[]>([]);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  
  const { responding, messageIds } = useStore(
    useShallow((state) => ({
      responding: state.responding,
      messageIds: state.messageIds,
    }))
  );

  // 从workspace store获取反馈状态和操作
  const feedback = useWorkspaceFeedback();
  const { removeFeedback } = useWorkspaceActions();
  


  // 自动调整textarea高度
  const adjustTextareaHeight = useCallback(() => {
    const textarea = textareaRef.current;
    if (textarea) {
      textarea.style.height = "auto";
      textarea.style.height = `${Math.min(textarea.scrollHeight, 120)}px`;
    }
  }, []);

  useEffect(() => {
    adjustTextareaHeight();
  }, [message, adjustTextareaHeight]);

  const handleSendMessage = useCallback(async () => {
    if (!message.trim() || responding) return;

    const messageToSend = message.trim();
    const resourcesToSend = [...resources];
    
    // 清空输入
    setMessage("");
    setResources([]);
    
    try {
      if (onSendMessage) {
        onSendMessage(messageToSend, { 
          resources: resourcesToSend,
          interruptFeedback: feedback?.option.value 
        });
      } else {
        await sendMessage(messageToSend, { 
          resources: resourcesToSend,
          interruptFeedback: feedback?.option.value 
        });
      }
      
      // 发送成功后清除反馈
      if (feedback) {
        removeFeedback();
      }
    } catch (error) {
      console.error("Failed to send message:", error);
      // 如果发送失败，恢复输入内容
      setMessage(messageToSend);
      setResources(resourcesToSend);
    }
  }, [message, resources, responding, onSendMessage, feedback, removeFeedback]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        void handleSendMessage();
      }
    },
    [handleSendMessage]
  );

  const handleStop = useCallback(() => {
    // TODO: 实现停止功能
    console.log("Stop generation requested");
  }, []);

  const handleAttachFile = useCallback(() => {
    // TODO: 实现文件附件功能
    console.log("Attach file requested");
  }, []);

  const canSend = message.trim().length > 0 && !responding;
  const hasMessages = messageIds.length > 0;

  return (
    <div className={cn("flex w-full flex-col gap-3", className)}>
      {/* 反馈显示区域 */}
      <FeedbackSystem
        feedback={feedback}
        onRemoveFeedback={removeFeedback}
        variant="compact"
        className="self-start"
      />

      {/* 资源显示区域 */}
      {resources.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {resources.map((resource, index) => (
            <div
              key={index}
              className="flex items-center gap-2 rounded-md bg-muted px-3 py-1 text-sm"
            >
              <Paperclip className="h-3 w-3" />
              <span className="truncate max-w-32">{resource.title}</span>
              <button
                onClick={() => setResources(prev => prev.filter((_, i) => i !== index))}
                className="text-muted-foreground hover:text-foreground"
              >
                ×
              </button>
            </div>
          ))}
        </div>
      )}

      {/* 输入区域 */}
      <div className="flex items-end gap-2">
        <div className="flex-1 relative">
          <Textarea
            ref={textareaRef}
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={hasMessages ? placeholder : "开始新的研究对话..."}
            className="min-h-[44px] max-h-[120px] resize-none pr-12"
            disabled={responding}
          />
          
          {/* 附件按钮 */}
          <Tooltip title="附加文件">
            <Button
              variant="ghost"
              size="sm"
              className="absolute right-2 top-2 h-8 w-8 p-0"
              onClick={handleAttachFile}
              disabled={responding}
            >
              <Paperclip className="h-4 w-4" />
            </Button>
          </Tooltip>
        </div>

        {/* 发送/停止按钮 */}
        {responding ? (
          <Tooltip title="停止生成">
            <Button
              variant="outline"
              size="sm"
              onClick={handleStop}
              className="h-11 w-11 p-0"
            >
              <StopCircle className="h-4 w-4" />
            </Button>
          </Tooltip>
        ) : (
          <Tooltip title={canSend ? "发送消息 (Enter)" : "请输入消息"}>
            <Button
              onClick={handleSendMessage}
              disabled={!canSend}
              className="h-11 w-11 p-0"
            >
              {responding ? (
                <LoadingOutlined className="h-4 w-4 animate-spin" />
              ) : (
                <Send className="h-4 w-4" />
              )}
            </Button>
          </Tooltip>
        )}
      </div>

      {/* 状态提示 */}
      {responding && (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <LoadingOutlined className="h-3 w-3 animate-spin" />
          <span>AI正在思考和回复...</span>
        </div>
      )}

      {/* 快捷提示 */}
      {!hasMessages && (
        <div className="text-xs text-muted-foreground">
          💡 提示: 输入您的研究问题，AI将为您进行深度分析和调研
        </div>
      )}
    </div>
  );
} 