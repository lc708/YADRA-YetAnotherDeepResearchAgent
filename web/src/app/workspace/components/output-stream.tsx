// Copyright (c) 2025 YADRA

"use client";

/**
 * 输出流面板 - 实时显示系统从任务开始到结束的所有输出
 * 
 * 功能特性：
 * - 🔄 实时SSE数据流展示
 * - 🔍 实时搜索和过滤
 * - 📊 按角色、Agent、来源分类
 * - 📤 导出完整输出流
 * - ⚡ 流式消息状态显示
 * 
 * 与"消息历史"的区别：
 * - 历史页面：完全基于数据库查询，用于回顾
 * - 输出流：完全基于SSE实时数据，用于监控当前任务
 */

import { useState, useMemo, useCallback, useRef, useEffect } from "react";
import { toast } from "sonner";
import { Search, Download, Activity, User, Bot, Settings, Zap, FileText, AlertCircle } from "lucide-react";

import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Badge } from "~/components/ui/badge";
import { ScrollArea } from "~/components/ui/scroll-area";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "~/components/ui/select";
import { Markdown } from "~/components/yadra/markdown";
import { cn } from "~/lib/utils";

import type { Message } from "~/core/messages";
import { 
  useUnifiedStore, 
  useCurrentThread, 
  useThreadMessages, 
  useCurrentUrlParam 
} from "~/core/store";

interface OutputStreamProps {
  className?: string;
}

type FilterType = "all" | "user" | "assistant" | "tool";
type SourceFilter = "all" | "input" | "button" | "system";

export function OutputStream({ className }: OutputStreamProps) {
  // 🔥 使用新的数据架构 - 从 unified-store 获取数据
  const currentUrlParam = useCurrentUrlParam();
  const threadData = useCurrentThread();
  const messages = useThreadMessages();
  const responding = useUnifiedStore((state) => state.responding);
  
  const [searchQuery, setSearchQuery] = useState("");
  const [roleFilter, setRoleFilter] = useState<FilterType>("all");
  const [sourceFilter, setSourceFilter] = useState<SourceFilter>("all");
  const [agentFilter, setAgentFilter] = useState<string>("all");
  const [eventTypeFilter, setEventTypeFilter] = useState<string>("all");
  const [autoScroll, setAutoScroll] = useState(true);
  
  const scrollAreaRef = useRef<HTMLDivElement>(null);

  // 🔥 修复滚动逻辑：使用消息长度而非消息数组避免重复触发
  const messagesLength = messages?.length || 0;
  
  useEffect(() => {
    if (autoScroll && scrollAreaRef.current && messagesLength > 0) {
      const scrollContainer = scrollAreaRef.current.querySelector('[data-radix-scroll-area-viewport]');
      if (scrollContainer) {
        // 🔥 使用requestAnimationFrame确保DOM更新后再滚动
        requestAnimationFrame(() => {
          scrollContainer.scrollTop = scrollContainer.scrollHeight;
        });
      }
    }
  }, [messagesLength, autoScroll]);

  const allMessages = useMemo(() => {
    if (!messages || messages.length === 0) {
      return [];
    }
    
    return [...messages].sort((a, b) => {
      // 🔥 修复时间排序：使用真实时间戳而非字符串比较
      const timeA = a.metadata?.timestamp || a.originalInput?.timestamp;
      const timeB = b.metadata?.timestamp || b.originalInput?.timestamp;
      
      // 🔥 尝试解析为Date对象进行真实时间比较
      let dateA: Date | null = null;
      let dateB: Date | null = null;
      
      if (timeA) {
        try {
          dateA = new Date(timeA);
          if (isNaN(dateA.getTime())) dateA = null;
        } catch {
          dateA = null;
        }
      }
      
      if (timeB) {
        try {
          dateB = new Date(timeB);
          if (isNaN(dateB.getTime())) dateB = null;
        } catch {
          dateB = null;
        }
      }
      
      // 🔥 如果都有有效时间戳，按时间排序
      if (dateA && dateB) {
        return dateA.getTime() - dateB.getTime();
      }
      
      // 🔥 如果只有一个有时间戳，有时间戳的排在前面
      if (dateA && !dateB) return -1;
      if (!dateA && dateB) return 1;
      
      // 🔥 如果都没有时间戳，按ID字符串排序（fallback）
      const idA = a.id || '';
      const idB = b.id || '';
      return idA.localeCompare(idB);
    });
  }, [messages]);

  const availableOptions = useMemo(() => {
    const roles = new Set<string>();
    const agents = new Set<string>();
    const sources = new Set<string>();
    const eventTypes = new Set<string>();
    
    allMessages.forEach(msg => {
      roles.add(msg.role);
      if (msg.agent) agents.add(msg.agent);
      if (msg.source) sources.add(msg.source);
      
      // 基于现有字段推断事件类型
      if (msg.toolCalls && msg.toolCalls.length > 0) {
        eventTypes.add('tool_calls');
      }
      if (msg.finishReason === 'interrupt') {
        eventTypes.add('interrupt');
      }
      if (msg.finishReason === 'reask') {
        eventTypes.add('reask');
      }
      if (msg.isStreaming) {
        eventTypes.add('streaming');
      }
      if (msg.reasoningContent) {
        eventTypes.add('reasoning');
      }
      if (msg.resources && msg.resources.length > 0) {
        eventTypes.add('resource');
      }
      
      // 默认消息类型
      eventTypes.add('message');
    });
    
    return {
      roles: Array.from(roles),
      agents: Array.from(agents),
      sources: Array.from(sources),
      eventTypes: Array.from(eventTypes),
    };
  }, [allMessages]);

  const filteredMessages = useMemo(() => {
    return allMessages.filter(message => {
      if (searchQuery && !message.content.toLowerCase().includes(searchQuery.toLowerCase())) {
        return false;
      }
      
      if (roleFilter !== "all" && message.role !== roleFilter) {
        return false;
      }
      
      if (sourceFilter !== "all" && message.source !== sourceFilter) {
        return false;
      }
      
      if (agentFilter !== "all" && message.agent !== agentFilter) {
        return false;
      }
      
      if (eventTypeFilter !== "all") {
        switch (eventTypeFilter) {
          case 'tool_calls':
            return message.toolCalls && message.toolCalls.length > 0;
          case 'interrupt':
            return message.finishReason === 'interrupt';
          case 'reask':
            return message.finishReason === 'reask';
          case 'streaming':
            return message.isStreaming;
          case 'reasoning':
            return !!message.reasoningContent;
          case 'resource':
            return message.resources && message.resources.length > 0;
          case 'message':
            return true; // 所有消息都是message类型
          default:
            return true;
        }
      }
      
      return true;
    });
  }, [allMessages, searchQuery, roleFilter, sourceFilter, agentFilter, eventTypeFilter]);

  const handleExport = useCallback(() => {
    try {
      const exportData = {
        urlParam: currentUrlParam,
        threadId: threadData?.id,
        exportTime: new Date().toISOString(),
        totalOutputs: filteredMessages.length,
        threadInfo: {
          threadId: threadData?.id,
          isActive: responding,
          messageCount: allMessages.length,
        },
        outputStream: filteredMessages.map(msg => ({
          id: msg.id,
          role: msg.role,
          agent: msg.agent,
          source: msg.source,
          content: msg.content,
          isStreaming: msg.isStreaming,
          eventType: getEventType(msg),
          timestamp: msg.originalInput?.timestamp || new Date().toISOString(),
        }))
      };
      
      const blob = new Blob([JSON.stringify(exportData, null, 2)], { 
        type: "application/json" 
      });
      const url = URL.createObjectURL(blob);
      
      const link = document.createElement("a");
      link.href = url;
      link.download = `output-stream-${currentUrlParam || 'unknown'}-${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
      URL.revokeObjectURL(url);
      toast.success(`已导出 ${filteredMessages.length} 条输出流`);
    } catch (error) {
      console.error("Failed to export output stream:", error);
      toast.error("导出失败");
    }
  }, [currentUrlParam, filteredMessages, threadData, responding, allMessages.length]);

  const getEventType = useCallback((message: Message): string => {
    // 🔥 优先基于 metadata 信息识别真实的 SSE 事件类型
    if (message.metadata?.nodeEvent) {
      return message.metadata.nodeType === 'start' ? 'node_start' : 'node_complete';
    }
    if (message.metadata?.planEvent) return 'plan_generated';
    if (message.metadata?.searchEvent) return 'search_results';
    if (message.metadata?.agentEvent) return 'agent_output';
    if (message.metadata?.progressEvent) return 'progress';
    if (message.metadata?.artifactEvent) return 'artifact';
    if (message.metadata?.completeEvent) return 'complete';
    if (message.metadata?.errorEvent) return 'error';
    if (message.metadata?.chunkType) return 'message_chunk';
    if (message.metadata?.interruptEvent) return 'interrupt';
    if (message.metadata?.userInput) return 'user_input';
    if (message.metadata?.userFeedback) return 'user_feedback';
    
    // 🔥 Fallback 到原有的推断逻辑
    if (message.toolCalls && message.toolCalls.length > 0) return 'tool_calls';
    if (message.finishReason === 'interrupt') return 'interrupt';
    if (message.finishReason === 'reask') return 'reask';
    if (message.isStreaming) return 'streaming';
    if (message.reasoningContent) return 'reasoning';
    if (message.resources && message.resources.length > 0) return 'resource';
    
    return 'message';
  }, []);

  const getEventIcon = useCallback((message: Message) => {
    const eventType = getEventType(message);
    
    switch (eventType) {
      case 'node_start':
      case 'node_complete':
        return <Settings className="h-4 w-4 text-blue-500" />;
      case 'plan_generated':
        return <FileText className="h-4 w-4 text-green-500" />;
      case 'search_results':
        return <Search className="h-4 w-4 text-yellow-500" />;
      case 'agent_output':
        return <Bot className="h-4 w-4 text-purple-500" />;
      case 'progress':
        return <Activity className="h-4 w-4 text-orange-500" />;
      case 'artifact':
        return <FileText className="h-4 w-4 text-purple-500" />;
      case 'complete':
        return <Badge className="h-4 w-4 text-green-600" />;
      case 'error':
        return <AlertCircle className="h-4 w-4 text-red-500" />;
      case 'message_chunk':
        return <Zap className="h-4 w-4 animate-pulse text-blue-500" />;
      case 'interrupt':
        return <AlertCircle className="h-4 w-4 text-orange-500 animate-pulse" />;
      case 'user_input':
        return <User className="h-4 w-4 text-blue-600" />;
      case 'user_feedback':
        return <User className="h-4 w-4 text-green-600" />;
      case 'tool_calls':
        return <Settings className="h-4 w-4 text-blue-500" />;
      case 'reask':
        return <Search className="h-4 w-4 text-yellow-500" />;
      case 'streaming':
        return <Zap className="h-4 w-4 animate-pulse text-blue-500" />;
      case 'reasoning':
        return <FileText className="h-4 w-4 text-purple-500" />;
      case 'resource':
        return <FileText className="h-4 w-4 text-green-500" />;
      default:
        return getMessageIcon(message);
    }
  }, [getEventType]);

  const getMessageIcon = (message: Message) => {
    if (message.role === "user") {
      return message.source === "button" ? <Settings className="h-4 w-4" /> : <User className="h-4 w-4" />;
    }
    if (message.role === "tool") {
      return <Settings className="h-4 w-4" />;
    }
    if (message.isStreaming) {
      return <Zap className="h-4 w-4 animate-pulse text-blue-500" />;
    }
    return <Bot className="h-4 w-4" />;
  };

  const getEventBadge = useCallback((message: Message) => {
    const eventType = getEventType(message);
    const badges = [];
    
    if (message.role === "user") {
      badges.push(
        <Badge key="role" variant={message.source === "button" ? "secondary" : "default"}>
          {message.source === "button" ? "指令" : "查询"}
        </Badge>
      );
    } else if (message.agent) {
      badges.push(
        <Badge key="agent" variant="outline">
          {message.agent}
        </Badge>
      );
    } else {
      badges.push(
        <Badge key="role" variant="secondary">
          {message.role}
        </Badge>
      );
    }
    
    if (eventType !== 'message') {
      const eventTypeLabels: Record<string, string> = {
        node_start: '节点开始',
        node_complete: '节点完成',
        plan_generated: '计划生成',
        search_results: '搜索结果',
        agent_output: '代理输出',
        progress: '进度更新',
        message_chunk: '消息流',
        artifact: '工件生成',
        complete: '任务完成',
        error: '错误',
        interrupt: '等待决策',
        user_input: '用户输入',
        user_feedback: '用户反馈',
        tool_calls: '工具调用',
        reask: '重问',
        streaming: '流式',
        reasoning: '推理',
        resource: '资源',
      };
      
      badges.push(
        <Badge key="event" variant="outline" className="text-xs">
          {eventTypeLabels[eventType] || eventType}
        </Badge>
      );
    }
    
    if (message.isStreaming) {
      badges.push(
        <Badge key="streaming" variant="default" className="animate-pulse bg-blue-500 text-xs">
          实时输出
        </Badge>
      );
    }
    
    return (
      <div className="flex items-center gap-1 flex-wrap">
        {badges}
      </div>
    );
  }, [getEventType]);

  return (
    <div className={cn("flex flex-col h-full", className)}>
      <div className="flex flex-col gap-4 p-4 border-b">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Activity className="h-5 w-5" />
            <h3 className="font-semibold">实时输出流</h3>
            {responding && (
              <div className="flex items-center gap-1">
                <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                <span className="text-xs text-green-600">实时接收中</span>
              </div>
            )}
          </div>
          
          <div className="flex items-center gap-2">
            <label className="flex items-center gap-1 text-xs">
              <input
                type="checkbox"
                checked={autoScroll}
                onChange={(e) => setAutoScroll(e.target.checked)}
                className="w-3 h-3"
              />
              自动滚动
            </label>
          </div>
        </div>
        
        <div className="flex items-center gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="搜索实时输出内容..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>
          <Button onClick={handleExport} variant="outline" size="sm">
            <Download className="mr-2 h-4 w-4" />
            导出
          </Button>
        </div>
        
        <div className="flex items-center gap-2 flex-wrap">
          <Select value={roleFilter} onValueChange={(value: FilterType) => setRoleFilter(value)}>
            <SelectTrigger className="w-32">
              <SelectValue placeholder="角色" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">所有角色</SelectItem>
              <SelectItem value="user">用户</SelectItem>
              <SelectItem value="assistant">助手</SelectItem>
              <SelectItem value="tool">工具</SelectItem>
            </SelectContent>
          </Select>
          
          <Select value={sourceFilter} onValueChange={(value: SourceFilter) => setSourceFilter(value)}>
            <SelectTrigger className="w-32">
              <SelectValue placeholder="来源" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">所有来源</SelectItem>
              <SelectItem value="input">输入框</SelectItem>
              <SelectItem value="button">按钮</SelectItem>
              <SelectItem value="system">系统</SelectItem>
            </SelectContent>
          </Select>
          
          {availableOptions.agents.length > 0 && (
            <Select value={agentFilter} onValueChange={setAgentFilter}>
              <SelectTrigger className="w-32">
                <SelectValue placeholder="Agent" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">所有Agent</SelectItem>
                {availableOptions.agents.map(agent => (
                  <SelectItem key={agent} value={agent}>{agent}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
          
          {availableOptions.eventTypes.length > 0 && (
            <Select value={eventTypeFilter} onValueChange={setEventTypeFilter}>
              <SelectTrigger className="w-32">
                <SelectValue placeholder="事件类型" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">所有事件</SelectItem>
                {availableOptions.eventTypes.map(eventType => (
                  <SelectItem key={eventType} value={eventType}>
                    {eventType === 'message' ? '普通消息' : 
                     eventType === 'tool_calls' ? '工具调用' :
                     eventType === 'interrupt' ? '中断事件' :
                     eventType === 'reask' ? '重问事件' :
                     eventType === 'streaming' ? '流式消息' :
                     eventType === 'reasoning' ? '推理过程' :
                     eventType === 'resource' ? '资源加载' :
                     eventType}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
          
          <div className="text-sm text-muted-foreground">
            共 {filteredMessages.length} 条输出 / {allMessages.length} 总计
          </div>
        </div>
      </div>

      <ScrollArea className="flex-1 h-0" ref={scrollAreaRef}>
        <div className="p-4 space-y-4">
          {filteredMessages.length === 0 ? (
            <div className="text-center text-muted-foreground py-8">
              <Activity className="mx-auto h-12 w-12 mb-4 opacity-50" />
              <p>没有找到匹配的输出流</p>
              {responding && (
                <p className="text-xs mt-2 text-blue-500">正在等待新的输出...</p>
              )}
            </div>
          ) : (
            filteredMessages.map((message, index) => (
              <Card key={message.id} className={cn(
                "relative transition-all duration-200",
                message.isStreaming && "ring-2 ring-blue-500/50 bg-blue-50/20 dark:bg-blue-950/20"
              )}>
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      {getEventIcon(message)}
                      <CardTitle className="text-sm">
                        {message.role === "user" 
                          ? (message.source === "button" ? "用户指令" : "用户查询")
                          : message.agent || message.role
                        }
                      </CardTitle>
                      {getEventBadge(message)}
                    </div>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <span>#{index + 1}</span>
                      {message.originalInput?.timestamp && (
                        <span>{new Date(message.originalInput.timestamp).toLocaleTimeString()}</span>
                      )}
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="prose prose-sm max-w-none">
                    <Markdown>{message.content}</Markdown>
                  </div>
                  
                  {/* 显示消息的额外信息 */}
                  {(message.toolCalls && message.toolCalls.length > 0) && (
                    <div className="mt-2 text-xs text-muted-foreground space-y-1">
                      <div>工具调用: {message.toolCalls.length}个</div>
                    </div>
                  )}
                  {message.finishReason && message.finishReason !== 'stop' && (
                    <div className="mt-2 text-xs text-muted-foreground">
                      结束原因: {message.finishReason}
                    </div>
                  )}
                  
                  {message.originalInput?.timestamp && (
                    <div className="mt-2 text-xs text-muted-foreground">
                      {new Date(message.originalInput.timestamp).toLocaleString()}
                    </div>
                  )}
                </CardContent>
              </Card>
            ))
          )}
        </div>
      </ScrollArea>
    </div>
  );
} 