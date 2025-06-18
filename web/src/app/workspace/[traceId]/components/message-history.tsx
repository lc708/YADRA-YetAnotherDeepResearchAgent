// Copyright (c) 2025 YADRA

"use client";

import { useState, useMemo, useCallback } from "react";
import { Search, Filter, Download, FileText, User, Bot, Settings } from "lucide-react";
import { toast } from "sonner";

import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Badge } from "~/components/ui/badge";
import { ScrollArea } from "~/components/ui/scroll-area";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "~/components/ui/select";
import { Separator } from "~/components/ui/separator";
import { Markdown } from "~/components/yadra/markdown";
import { useMessages, useMessageIds } from "~/core/store";
import type { Message, MessageRole, MessageSource } from "~/core/messages";
import { cn } from "~/lib/utils";

interface MessageHistoryProps {
  traceId: string;
  className?: string;
}

type FilterType = "all" | "user" | "assistant" | "tool";
type SourceFilter = "all" | "input" | "button" | "system";

export function MessageHistory({ traceId, className }: MessageHistoryProps) {
  const messageIds = useMessageIds();
  const messages = useMessages();
  
  const [searchQuery, setSearchQuery] = useState("");
  const [roleFilter, setRoleFilter] = useState<FilterType>("all");
  const [sourceFilter, setSourceFilter] = useState<SourceFilter>("all");
  const [agentFilter, setAgentFilter] = useState<string>("all");

  // 获取所有消息
  const allMessages = useMemo(() => {
    return messages || [];
  }, [messages]);

  // 获取唯一的agent类型
  const availableAgents = useMemo(() => {
    const agents = new Set<string>();
    allMessages.forEach(msg => {
      if (msg.agent) {
        agents.add(msg.agent);
      }
    });
    return Array.from(agents);
  }, [allMessages]);

  // 过滤消息
  const filteredMessages = useMemo(() => {
    return allMessages.filter(message => {
      // 搜索过滤
      if (searchQuery && !message.content.toLowerCase().includes(searchQuery.toLowerCase())) {
        return false;
      }
      
      // 角色过滤
      if (roleFilter !== "all" && message.role !== roleFilter) {
        return false;
      }
      
      // 来源过滤
      if (sourceFilter !== "all" && message.source !== sourceFilter) {
        return false;
      }
      
      // Agent过滤
      if (agentFilter !== "all" && message.agent !== agentFilter) {
        return false;
      }
      
      return true;
    });
  }, [allMessages, searchQuery, roleFilter, sourceFilter, agentFilter]);

  // 导出对话历史
  const handleExport = useCallback(() => {
    try {
      const exportData = {
        traceId,
        exportTime: new Date().toISOString(),
        totalMessages: filteredMessages.length,
        messages: filteredMessages.map(msg => ({
          id: msg.id,
          role: msg.role,
          agent: msg.agent,
          source: msg.source,
          content: msg.content,
          timestamp: msg.originalInput?.timestamp || new Date().toISOString(),
        }))
      };
      
      const blob = new Blob([JSON.stringify(exportData, null, 2)], { 
        type: "application/json" 
      });
      const url = URL.createObjectURL(blob);
      
      const link = document.createElement("a");
      link.href = url;
      link.download = `conversation-history-${traceId}-${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
      URL.revokeObjectURL(url);
      toast.success(`已导出 ${filteredMessages.length} 条消息`);
    } catch (error) {
      console.error("Failed to export conversation:", error);
      toast.error("导出失败");
    }
  }, [traceId, filteredMessages]);

  // 获取消息图标
  const getMessageIcon = (message: Message) => {
    if (message.role === "user") {
      return message.source === "button" ? <Settings className="h-4 w-4" /> : <User className="h-4 w-4" />;
    }
    if (message.role === "tool") {
      return <Settings className="h-4 w-4" />;
    }
    return <Bot className="h-4 w-4" />;
  };

  // 获取消息标签
  const getMessageBadge = (message: Message) => {
    if (message.role === "user") {
      return (
        <Badge variant={message.source === "button" ? "secondary" : "default"}>
          {message.source === "button" ? "指令" : "查询"}
        </Badge>
      );
    }
    if (message.agent) {
      return <Badge variant="outline">{message.agent}</Badge>;
    }
    return <Badge variant="secondary">{message.role}</Badge>;
  };

  return (
    <div className={cn("flex flex-col h-full", className)}>
      {/* 搜索和过滤栏 */}
      <div className="flex flex-col gap-4 p-4 border-b">
        <div className="flex items-center gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="搜索消息内容..."
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
          
          {availableAgents.length > 0 && (
            <Select value={agentFilter} onValueChange={setAgentFilter}>
              <SelectTrigger className="w-32">
                <SelectValue placeholder="Agent" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">所有Agent</SelectItem>
                {availableAgents.map(agent => (
                  <SelectItem key={agent} value={agent}>{agent}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
          
          <div className="text-sm text-muted-foreground">
            共 {filteredMessages.length} 条消息
          </div>
        </div>
      </div>

      {/* 消息列表 */}
      <ScrollArea className="flex-1 h-0">
        <div className="p-4 space-y-4">
          {filteredMessages.length === 0 ? (
            <div className="text-center text-muted-foreground py-8">
              <FileText className="mx-auto h-12 w-12 mb-4 opacity-50" />
              <p>没有找到匹配的消息</p>
            </div>
          ) : (
            filteredMessages.map((message, index) => (
              <Card key={message.id} className="relative">
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      {getMessageIcon(message)}
                      <CardTitle className="text-sm">
                        {message.role === "user" 
                          ? (message.source === "button" ? "用户指令" : "用户查询")
                          : message.agent || message.role
                        }
                      </CardTitle>
                      {getMessageBadge(message)}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      #{index + 1}
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="prose prose-sm max-w-none">
                    <Markdown>{message.content}</Markdown>
                  </div>
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