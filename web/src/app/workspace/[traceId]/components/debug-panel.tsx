// Copyright (c) 2025 YADRA

"use client";

import { AlertTriangle, Info, CheckCircle, XCircle } from "lucide-react";
import { useMemo } from "react";

import { Badge } from "~/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import { 
  useStore, 
  useMessageIds, 
  useLastInterruptMessage, 
  useLastFeedbackMessageId 
} from "~/core/store";
import { useWorkspaceFeedback } from "~/core/store/workspace-store";
import { cn } from "~/lib/utils";

interface DebugPanelProps {
  className?: string;
}

export function DebugPanel({ className }: DebugPanelProps) {
  const messageIds = useMessageIds();
  const interruptMessage = useLastInterruptMessage();
  const waitingForFeedbackMessageId = useLastFeedbackMessageId();
  const feedback = useWorkspaceFeedback();
  const responding = useStore((state) => state.responding);
  
  const diagnostics = useMemo(() => {
    const issues = [];
    const info = [];
    
    // 检查消息数量
    if (messageIds.length === 0) {
      issues.push("没有消息记录，可能是初始化问题");
    } else if (messageIds.length > 10) {
      info.push(`消息较多 (${messageIds.length}条)，可能影响性能`);
    }
    
    // 检查重复消息
    const messageContents = messageIds.map(id => {
      const msg = useStore.getState().messages.get(id);
      return msg?.content?.substring(0, 100);
    });
    const duplicates = messageContents.filter((content, index) => 
      messageContents.indexOf(content) !== index
    );
    if (duplicates.length > 0) {
      issues.push(`检测到 ${duplicates.length} 条重复消息`);
    }
    
    // 检查中断消息状态
    if (interruptMessage) {
      if (!interruptMessage.options?.length) {
        issues.push("中断消息存在但没有选项");
      } else {
        info.push(`中断消息正常，有 ${interruptMessage.options.length} 个选项`);
      }
    }
    
    // 检查反馈状态
    if (waitingForFeedbackMessageId && !feedback) {
      issues.push("系统等待反馈但用户未提供反馈");
    }
    
    if (feedback && !waitingForFeedbackMessageId) {
      info.push("用户已提供反馈，等待发送");
    }
    
    // 检查响应状态
    if (responding) {
      info.push("AI正在响应中");
    }
    
    return { issues, info };
  }, [messageIds, interruptMessage, waitingForFeedbackMessageId, feedback, responding]);
  
  if (process.env.NODE_ENV !== 'development') {
    return null;
  }
  
  return (
    <Card className={cn("border-dashed", className)}>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-sm">
          <Info className="h-4 w-4" />
          系统诊断 (开发模式)
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {/* 基本状态 */}
        <div className="grid grid-cols-2 gap-2 text-xs">
          <div className="flex justify-between">
            <span>消息数量:</span>
            <Badge variant="outline">{messageIds.length}</Badge>
          </div>
          <div className="flex justify-between">
            <span>响应状态:</span>
            <Badge variant={responding ? "default" : "secondary"}>
              {responding ? "响应中" : "空闲"}
            </Badge>
          </div>
          <div className="flex justify-between">
            <span>中断消息:</span>
            <Badge variant={interruptMessage ? "default" : "secondary"}>
              {interruptMessage ? "存在" : "无"}
            </Badge>
          </div>
          <div className="flex justify-between">
            <span>用户反馈:</span>
            <Badge variant={feedback ? "default" : "secondary"}>
              {feedback ? feedback.option.text : "无"}
            </Badge>
          </div>
        </div>
        
        {/* 问题列表 */}
        {diagnostics.issues.length > 0 && (
          <div className="space-y-1">
            <div className="flex items-center gap-1 text-xs font-medium text-red-600">
              <XCircle className="h-3 w-3" />
              发现问题:
            </div>
            {diagnostics.issues.map((issue, index) => (
              <div key={index} className="text-xs text-red-600 pl-4">
                • {issue}
              </div>
            ))}
          </div>
        )}
        
        {/* 信息列表 */}
        {diagnostics.info.length > 0 && (
          <div className="space-y-1">
            <div className="flex items-center gap-1 text-xs font-medium text-blue-600">
              <CheckCircle className="h-3 w-3" />
              状态信息:
            </div>
            {diagnostics.info.map((info, index) => (
              <div key={index} className="text-xs text-blue-600 pl-4">
                • {info}
              </div>
            ))}
          </div>
        )}
        
        {diagnostics.issues.length === 0 && diagnostics.info.length === 0 && (
          <div className="flex items-center gap-2 text-xs text-green-600">
            <CheckCircle className="h-3 w-3" />
            系统状态正常
          </div>
        )}
      </CardContent>
    </Card>
  );
} 