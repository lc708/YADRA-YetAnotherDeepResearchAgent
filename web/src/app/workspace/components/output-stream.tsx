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
 * - 🎯 智能自动滚动：仅在底部时自动滚动
 * 
 * 与"消息历史"的区别：
 * - 历史页面：完全基于数据库查询，用于回顾
 * - 输出流：完全基于SSE实时数据，用于监控当前任务
 */

import { useState, useMemo, useCallback, useRef } from "react";
import { toast } from "sonner";
import { Search, Download, Activity, User, Bot, Settings, Zap, FileText, AlertCircle } from "lucide-react";

import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Badge } from "~/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "~/components/ui/select";
import { Markdown } from "~/components/yadra/markdown";
import { parseJSON } from "~/core/utils/json";
import { ScrollContainer, type ScrollContainerRef } from "~/components/conversation/scroll-container";
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

type FilterType = "all" | "user" | "assistant";

export function OutputStream({ className }: OutputStreamProps) {
  // 🔥 使用新的数据架构 - 从 unified-store 获取数据
  const currentUrlParam = useCurrentUrlParam();
  const threadData = useCurrentThread();
  const messages = useThreadMessages();
  const responding = useUnifiedStore((state) => state.responding);
  
  const [searchQuery, setSearchQuery] = useState("");
  const [roleFilter, setRoleFilter] = useState<FilterType>("all");
  const [autoScroll, setAutoScroll] = useState(true);
  
  // 🔥 使用智能滚动容器
  const scrollContainerRef = useRef<ScrollContainerRef>(null);

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

  // 🔥 移除复杂的availableOptions计算，简化代码

  // 🔥 修复：简化过滤逻辑，默认显示所有消息，只保留基本搜索
  const filteredMessages = useMemo(() => {
    // 🚀 按照用户要求：不要做那么多筛选，直接显示所有store中的消息
    let filtered = allMessages;
    
    // 只保留基本的文本搜索功能
    if (searchQuery) {
      filtered = filtered.filter(message => 
        message.content.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (message.reasoningContent && message.reasoningContent.toLowerCase().includes(searchQuery.toLowerCase())) ||
        (message.langGraphMetadata?.agent && message.langGraphMetadata.agent.toLowerCase().includes(searchQuery.toLowerCase()))
      );
    }
    
    // 🔥 可选的角色筛选（但默认显示全部）
    if (roleFilter !== "all") {
      filtered = filtered.filter(message => message.role === roleFilter);
    }
    
    return filtered;
  }, [allMessages, searchQuery, roleFilter]);

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
          agent: msg.langGraphMetadata?.agent,
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
    // 🔥 修复：使用LangGraph原生字段识别事件类型
    const agent = message.langGraphMetadata?.agent;
    
    // 基于agent类型识别特定事件
    if (agent === 'projectmanager') return 'plan_generated';
    if (agent === 'reporter') return 'artifact';
    if (agent === 'podcast') return 'artifact';
    
    // 基于消息内容和状态识别事件类型
    if (message.toolCalls && message.toolCalls.length > 0) return 'tool_calls';
    if (message.finishReason === 'interrupt') return 'interrupt';
    if (message.finishReason === 'reask') return 'reask';
    if (message.isStreaming) return 'streaming';
    if (message.reasoningContent) return 'reasoning';
    if (message.resources && message.resources.length > 0) return 'resource';
    
    // 🔥 移除废弃的metadata事件检查，使用简化的逻辑
    return 'message';
  }, []);

  const getEventIcon = useCallback((message: Message) => {
    const eventType = getEventType(message);
    
    switch (eventType) {
      case 'node_start':
      case 'node_complete':
        return <Settings className="h-4 w-4 text-blue-600" />;
      case 'plan_generated':
        return <FileText className="h-4 w-4 text-green-600" />;
      case 'search_results':
        return <Search className="h-4 w-4 text-amber-600" />;
      case 'agent_output':
        return <Bot className="h-4 w-4 text-purple-600" />;
      case 'progress':
        return <Activity className="h-4 w-4 text-orange-600" />;
      case 'artifact':
        return <FileText className="h-4 w-4 text-purple-600" />;
      case 'complete':
        return <Badge className="h-4 w-4 text-green-600" />;
      case 'error':
        return <AlertCircle className="h-4 w-4 text-red-500" />;
      case 'message_chunk':
        return <Zap className="h-4 w-4 animate-pulse text-blue-600" />;
      case 'interrupt':
        return <AlertCircle className="h-4 w-4 text-orange-500 animate-pulse" />;
      case 'user_input':
        return <User className="h-4 w-4 text-blue-600" />;
      case 'user_feedback':
        return <User className="h-4 w-4 text-green-600" />;
      case 'tool_calls':
        return <Settings className="h-4 w-4 text-blue-600" />;
      case 'reask':
        return <Search className="h-4 w-4 text-amber-600" />;
      case 'streaming':
        return <Zap className="h-4 w-4 animate-pulse text-blue-600" />;
      case 'reasoning':
        return <FileText className="h-4 w-4 text-purple-600" />;
      case 'resource':
        return <FileText className="h-4 w-4 text-green-600" />;
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
      return <Zap className="h-4 w-4 animate-pulse text-blue-600" />;
    }
    return <Bot className="h-4 w-4" />;
  };

  // 智能内容渲染函数
  const renderSmartContent = useCallback((content: string) => {
    // 尝试检测和格式化JSON内容
    const trimmedContent = content.trim();
    
    // 检测是否为JSON格式
    if ((trimmedContent.startsWith('{') && trimmedContent.endsWith('}')) || 
        (trimmedContent.startsWith('[') && trimmedContent.endsWith(']')) ||
        trimmedContent.includes('```json')) {
      
      try {
        // 使用项目现有的parseJSON工具处理JSON
        const parsedData = parseJSON(trimmedContent, null);
        
        if (parsedData !== null) {
          // 格式化JSON为易读的Markdown格式
          const formattedJson = '```json\n' + JSON.stringify(parsedData, null, 2) + '\n```';
          
          return (
            <div className="space-y-2">
              <div className="text-xs text-muted-foreground bg-muted/30 px-2 py-1 rounded">
                📄 JSON数据（已格式化）
              </div>
              <Markdown 
                animated={true}
                enableCopy={true}
                className="prose-sm"
              >
                {formattedJson}
              </Markdown>
            </div>
          );
        }
      } catch (error) {
        // JSON解析失败，fallback到普通渲染
      }
    }
    
    // 检测是否包含结构化数据关键词
    if (content.includes('"type":') || content.includes('"id":') || content.includes('"status":')) {
      return (
        <div className="space-y-2">
          <div className="text-xs text-muted-foreground bg-blue-50 dark:bg-blue-950/20 px-2 py-1 rounded">
            🔧 结构化数据
          </div>
          <Markdown 
            animated={true}
            enableCopy={true}
            className="prose-sm"
          >
            {content}
          </Markdown>
        </div>
      );
    }
    
    // 普通Markdown渲染（启用所有增强功能）
    return (
      <Markdown 
        animated={true}
        enableCopy={true}
        checkLinkCredibility={true}
        className="prose-sm"
      >
        {content}
      </Markdown>
    );
  }, []);

  const getEventBadge = useCallback((message: Message) => {
    const eventType = getEventType(message);
    const badges = [];
    
    if (message.role === "user") {
      badges.push(
        <Badge key="role" variant={message.source === "button" ? "secondary" : "default"}>
          {message.source === "button" ? "指令" : "查询"}
        </Badge>
      );
    } else if (message.langGraphMetadata?.agent) {
      badges.push(
        <Badge key="agent" variant="outline">
          {message.langGraphMetadata.agent}
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
        <Badge key="streaming" variant="default" className="animate-pulse bg-blue-600 text-xs">
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
                <div className="w-2 h-2 bg-green-600 rounded-full animate-pulse"></div>
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
        
        {/* 🔥 简化过滤器：只保留基本的角色筛选和统计信息 */}
        <div className="flex items-center justify-between">
          <Select value={roleFilter} onValueChange={(value: FilterType) => setRoleFilter(value)}>
            <SelectTrigger className="w-40">
              <SelectValue placeholder="角色筛选" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">显示全部消息</SelectItem>
              <SelectItem value="user">只显示用户消息</SelectItem>
              <SelectItem value="assistant">只显示AI消息</SelectItem>
            </SelectContent>
          </Select>
          
          <div className="text-sm text-muted-foreground">
            显示 {filteredMessages.length} / {allMessages.length} 条消息
          </div>
        </div>
      </div>

      {/* 🔥 使用智能滚动容器 - 替换原有的ScrollArea */}
      <ScrollContainer
        ref={scrollContainerRef}
        className="flex-1"
        autoScrollToBottom={autoScroll}
        showScrollIndicator={true}
        throttleMs={16}
        onScrollChange={(position) => {
          // 可以在这里添加滚动状态监听逻辑
        }}
      >
        <div className="p-4 space-y-4">
          {filteredMessages.length === 0 ? (
            <div className="text-center text-muted-foreground py-8">
              <Activity className="mx-auto h-12 w-12 mb-4 opacity-50" />
              <p>没有找到匹配的输出流</p>
              {responding && (
                <p className="text-xs mt-2 text-blue-600">正在等待新的输出...</p>
              )}
            </div>
          ) : (
            filteredMessages.map((message, index) => (
              <Card key={message.id} className={cn(
                "relative transition-all duration-200",
                message.isStreaming && "ring-2 ring-blue-600/50 bg-blue-50/20 dark:bg-blue-950/20"
              )}>
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      {getEventIcon(message)}
                      <CardTitle className="text-sm">
                        {message.role === "user" 
                          ? (message.source === "button" ? "用户指令" : "用户查询")
                          : message.langGraphMetadata?.agent || message.role
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
                    {renderSmartContent(message.content)}
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
      </ScrollContainer>
    </div>
  );
} 