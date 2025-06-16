// Copyright (c) 2025 YADRA

"use client";

import { LoadingOutlined } from "@ant-design/icons";
import { Send, Paperclip, StopCircle, Lightbulb } from "lucide-react";
import { useState, useRef, useCallback, useEffect, useMemo } from "react";
import { useShallow } from "zustand/react/shallow";

import { Button } from "~/components/ui/button";
import { Textarea } from "~/components/ui/textarea";
import { Tooltip } from "~/components/yadra/tooltip";
import { Detective } from "~/components/yadra/icons/detective";
import { ReportStyleDialog } from "~/components/yadra/report-style-dialog";
import type { Resource } from "~/core/messages";
import { sendMessage, useStore } from "~/core/store";
import {
  setEnableDeepThinking,
  setEnableBackgroundInvestigation,
  useSettingsStore,
} from "~/core/store";
import { getConfig } from "~/core/api/config";
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
  
  // 设置状态
  const enableDeepThinking = useSettingsStore(
    (state) => state.general.enableDeepThinking,
  );
  const backgroundInvestigation = useSettingsStore(
    (state) => state.general.enableBackgroundInvestigation,
  );
  const { basicModel, reasoningModel } = useMemo(() => {
    try {
      const config = getConfig();
      return {
        basicModel: config.models.basic?.[0] || null,
        reasoningModel: config.models.reasoning?.[0] || null,
      };
    } catch {
      return {
        basicModel: null,
        reasoningModel: null,
      };
    }
  }, []);

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

      {/* 设置按钮区域 */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          {reasoningModel && (
            <Tooltip
              delayDuration={300}
              className="max-w-xs border border-white/20 bg-black/90 backdrop-blur-sm text-white shadow-xl"
              title={
                <div className="p-2">
                  <p className="mb-2 font-medium text-blue-300">
                    {enableDeepThinking ? "推理模式" : "常规模式"}
                  </p>
                  <p className="text-xs text-gray-300 leading-relaxed">
                    {enableDeepThinking 
                      ? "AI将进行深度思考和推理，生成更加深思熟虑的研究计划"
                      : "AI将以常规模式处理您的问题，快速生成研究计划"
                    }
                  </p>
                  <div className="mt-2 pt-2 border-t border-white/10">
                    <p className="text-xs text-gray-400">
                      使用模型：{enableDeepThinking ? reasoningModel : basicModel}
                    </p>
                  </div>
                </div>
              }
            >
              <button
                type="button"
                onClick={() => setEnableDeepThinking(!enableDeepThinking)}
                className={cn(
                  "group relative overflow-hidden rounded-lg border h-9 px-3 text-xs font-medium transition-all duration-300",
                  "backdrop-blur-sm flex items-center gap-1.5",
                  enableDeepThinking
                    ? "border-blue-400/50 bg-blue-500/20 text-blue-300 shadow-[0_0_20px_rgba(59,130,246,0.3)]"
                    : "border-gray-200/20 bg-gray-50/5 text-gray-600 hover:border-gray-300/30 hover:bg-gray-100/10 hover:text-gray-800"
                )}
              >
                {/* 背景光效 */}
                {enableDeepThinking && (
                  <div className="absolute inset-0 bg-gradient-to-r from-blue-500/10 via-purple-500/10 to-blue-500/10 opacity-50"></div>
                )}
                
                {/* 图标和文字 */}
                <div className="relative z-10 flex items-center gap-1.5">
                  <Lightbulb 
                    className={cn(
                      "h-5 w-5 transition-all duration-300",
                      enableDeepThinking 
                        ? "text-blue-300 drop-shadow-[0_0_6px_rgba(59,130,246,0.8)]" 
                        : "text-gray-500 group-hover:text-gray-700"
                    )} 
                  />
                  <span>推理模式</span>
                </div>
                
                {/* hover 光效 */}
                <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/5 to-transparent opacity-0 transition-opacity duration-300 group-hover:opacity-100"></div>
              </button>
            </Tooltip>
          )}

          <Tooltip
            delayDuration={300}
            className="max-w-xs border border-white/20 bg-black/90 backdrop-blur-sm text-white shadow-xl"
            title={
              <div className="p-2">
                <p className="mb-2 font-medium text-green-300">调研模式</p>
                <p className="text-xs text-gray-300 leading-relaxed">
                  {backgroundInvestigation ? "已启用" : "已关闭"} - 
                  在制定计划前进行快速搜索，适用于时事热点和最新动态研究
                </p>
              </div>
            }
          >
            <button
              type="button"
              onClick={() => setEnableBackgroundInvestigation(!backgroundInvestigation)}
              className={cn(
                "group relative overflow-hidden rounded-lg border h-9 px-3 text-xs font-medium transition-all duration-300",
                "backdrop-blur-sm flex items-center gap-1.5",
                backgroundInvestigation
                  ? "border-green-400/50 bg-green-500/20 text-green-300 shadow-[0_0_20px_rgba(34,197,94,0.3)]"
                  : "border-gray-200/20 bg-gray-50/5 text-gray-600 hover:border-gray-300/30 hover:bg-gray-100/10 hover:text-gray-800"
              )}
            >
              {/* 背景光效 */}
              {backgroundInvestigation && (
                <div className="absolute inset-0 bg-gradient-to-r from-green-500/10 via-emerald-500/10 to-green-500/10 opacity-50"></div>
              )}
              
              {/* 图标和文字 */}
              <div className="relative z-10 flex items-center gap-1.5">
                <Detective 
                  className={cn(
                    "h-5 w-5 transition-all duration-300",
                    backgroundInvestigation 
                      ? "text-green-300 drop-shadow-[0_0_6px_rgba(34,197,94,0.8)]" 
                      : "text-gray-500 group-hover:text-gray-700"
                  )} 
                />
                <span>调研模式</span>
              </div>
              
              {/* hover 光效 */}
              <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/5 to-transparent opacity-0 transition-opacity duration-300 group-hover:opacity-100"></div>
            </button>
          </Tooltip>
        </div>

        <div className="flex items-center gap-2">
          <ReportStyleDialog />
        </div>
      </div>

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
          <span>AI正在深度思考和分析...</span>
          {enableDeepThinking && reasoningModel && (
            <span className="text-blue-500 font-medium">（推理模式已启用）</span>
          )}
        </div>
      )}

      {/* 功能提示 */}
      {!hasMessages && (
        <div className="text-xs text-muted-foreground space-y-1">
          <div className="flex items-center gap-1">
            <span>💡</span>
            <span>输入您的研究问题，AI将为您进行深度分析和专业调研</span>
          </div>
          {reasoningModel && (
            <div className="flex items-center gap-1 text-blue-500">
              <span>🧠</span>
              <span>推理模式可用 - 点击上方按钮开启深度思维分析</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
} 