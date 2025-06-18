// Copyright (c) 2025 YADRA

"use client";

import { useState, useMemo } from "react";
import { Search, Calendar, Clock, Hash, Filter } from "lucide-react";

import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "~/components/ui/collapsible";
import { Checkbox } from "~/components/ui/checkbox";
import { useThreadMessages, useCurrentThread } from "~/core/store";
import type { Message } from "~/core/messages";
import { cn } from "~/lib/utils";

interface SearchPanelProps {
  traceId: string;
  onSearchResults?: (results: Message[]) => void;
  className?: string;
}

interface SearchFilters {
  query: string;
  roles: string[];
  agents: string[];
  sources: string[];
  dateRange: {
    start: string;
    end: string;
  };
  contentLength: {
    min: number;
    max: number;
  };
}

export function SearchPanel({ traceId, onSearchResults, className }: SearchPanelProps) {
  const thread = useCurrentThread();
  const messages = useThreadMessages();
  
  const [isAdvancedOpen, setIsAdvancedOpen] = useState(false);
  const [filters, setFilters] = useState<SearchFilters>({
    query: "",
    roles: [],
    agents: [],
    sources: [],
    dateRange: {
      start: "",
      end: "",
    },
    contentLength: {
      min: 0,
      max: 10000,
    },
  });

  // 获取所有消息
  const allMessages = useMemo(() => {
    return messages || [];
  }, [messages]);

  // 获取可用的选项
  const availableOptions = useMemo(() => {
    const roles = new Set<string>();
    const agents = new Set<string>();
    const sources = new Set<string>();
    
    allMessages.forEach(msg => {
      roles.add(msg.role);
      if (msg.agent) agents.add(msg.agent);
      if (msg.source) sources.add(msg.source);
    });
    
    return {
      roles: Array.from(roles),
      agents: Array.from(agents),
      sources: Array.from(sources),
    };
  }, [allMessages]);

  // 执行搜索
  const searchResults = useMemo(() => {
    let results = allMessages;

    // 文本搜索
    if (filters.query.trim()) {
      const query = filters.query.toLowerCase();
      results = results.filter(msg => 
        msg.content.toLowerCase().includes(query)
      );
    }

    // 角色过滤
    if (filters.roles.length > 0) {
      results = results.filter(msg => filters.roles.includes(msg.role));
    }

    // Agent过滤
    if (filters.agents.length > 0) {
      results = results.filter(msg => msg.agent && filters.agents.includes(msg.agent));
    }

    // 来源过滤
    if (filters.sources.length > 0) {
      results = results.filter(msg => msg.source && filters.sources.includes(msg.source));
    }

    // 日期范围过滤
    if (filters.dateRange.start || filters.dateRange.end) {
      results = results.filter(msg => {
        const timestamp = msg.originalInput?.timestamp;
        if (!timestamp) return false;
        
        const msgDate = new Date(timestamp);
        const startDate = filters.dateRange.start ? new Date(filters.dateRange.start) : null;
        const endDate = filters.dateRange.end ? new Date(filters.dateRange.end) : null;
        
        if (startDate && msgDate < startDate) return false;
        if (endDate && msgDate > endDate) return false;
        
        return true;
      });
    }

    // 内容长度过滤
    results = results.filter(msg => {
      const length = msg.content.length;
      return length >= filters.contentLength.min && length <= filters.contentLength.max;
    });

    return results;
  }, [allMessages, filters]);

  // 通知搜索结果
  useMemo(() => {
    onSearchResults?.(searchResults);
  }, [searchResults, onSearchResults]);

  // 更新过滤器
  const updateFilters = (updates: Partial<SearchFilters>) => {
    setFilters(prev => ({ ...prev, ...updates }));
  };

  // 切换多选项
  const toggleArrayFilter = (key: keyof Pick<SearchFilters, 'roles' | 'agents' | 'sources'>, value: string) => {
    setFilters(prev => ({
      ...prev,
      [key]: prev[key].includes(value)
        ? prev[key].filter(item => item !== value)
        : [...prev[key], value]
    }));
  };

  // 清除所有过滤器
  const clearFilters = () => {
    setFilters({
      query: "",
      roles: [],
      agents: [],
      sources: [],
      dateRange: { start: "", end: "" },
      contentLength: { min: 0, max: 10000 },
    });
  };

  return (
    <Card className={cn("w-full", className)}>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Search className="h-5 w-5" />
          消息搜索
          <span className="text-sm font-normal text-muted-foreground">
            ({searchResults.length} 条结果)
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* 基础搜索 */}
        <div className="space-y-2">
          <Label htmlFor="search-query">搜索内容</Label>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              id="search-query"
              placeholder="输入关键词搜索消息内容..."
              value={filters.query}
              onChange={(e) => updateFilters({ query: e.target.value })}
              className="pl-10"
            />
          </div>
        </div>

        {/* 高级搜索 */}
        <Collapsible open={isAdvancedOpen} onOpenChange={setIsAdvancedOpen}>
          <CollapsibleTrigger asChild>
            <Button variant="ghost" className="w-full justify-start">
              <Filter className="mr-2 h-4 w-4" />
              高级搜索
            </Button>
          </CollapsibleTrigger>
          <CollapsibleContent className="space-y-4 mt-4">
            {/* 角色过滤 */}
            {availableOptions.roles.length > 0 && (
              <div className="space-y-2">
                <Label>消息角色</Label>
                <div className="flex flex-wrap gap-2">
                  {availableOptions.roles.map(role => (
                    <div key={role} className="flex items-center space-x-2">
                      <Checkbox
                        id={`role-${role}`}
                        checked={filters.roles.includes(role)}
                        onCheckedChange={() => toggleArrayFilter('roles', role)}
                      />
                      <Label htmlFor={`role-${role}`} className="text-sm">
                        {role}
                      </Label>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Agent过滤 */}
            {availableOptions.agents.length > 0 && (
              <div className="space-y-2">
                <Label>AI Agent</Label>
                <div className="flex flex-wrap gap-2">
                  {availableOptions.agents.map(agent => (
                    <div key={agent} className="flex items-center space-x-2">
                      <Checkbox
                        id={`agent-${agent}`}
                        checked={filters.agents.includes(agent)}
                        onCheckedChange={() => toggleArrayFilter('agents', agent)}
                      />
                      <Label htmlFor={`agent-${agent}`} className="text-sm">
                        {agent}
                      </Label>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* 来源过滤 */}
            {availableOptions.sources.length > 0 && (
              <div className="space-y-2">
                <Label>消息来源</Label>
                <div className="flex flex-wrap gap-2">
                  {availableOptions.sources.map(source => (
                    <div key={source} className="flex items-center space-x-2">
                      <Checkbox
                        id={`source-${source}`}
                        checked={filters.sources.includes(source)}
                        onCheckedChange={() => toggleArrayFilter('sources', source)}
                      />
                      <Label htmlFor={`source-${source}`} className="text-sm">
                        {source === 'input' ? '输入框' : source === 'button' ? '按钮' : source}
                      </Label>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* 日期范围 */}
            <div className="space-y-2">
              <Label className="flex items-center gap-2">
                <Calendar className="h-4 w-4" />
                日期范围
              </Label>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <Label htmlFor="date-start" className="text-xs">开始日期</Label>
                  <Input
                    id="date-start"
                    type="date"
                    value={filters.dateRange.start}
                    onChange={(e) => updateFilters({ 
                      dateRange: { ...filters.dateRange, start: e.target.value }
                    })}
                  />
                </div>
                <div>
                  <Label htmlFor="date-end" className="text-xs">结束日期</Label>
                  <Input
                    id="date-end"
                    type="date"
                    value={filters.dateRange.end}
                    onChange={(e) => updateFilters({ 
                      dateRange: { ...filters.dateRange, end: e.target.value }
                    })}
                  />
                </div>
              </div>
            </div>

            {/* 内容长度 */}
            <div className="space-y-2">
              <Label className="flex items-center gap-2">
                <Hash className="h-4 w-4" />
                内容长度 (字符数)
              </Label>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <Label htmlFor="length-min" className="text-xs">最小长度</Label>
                  <Input
                    id="length-min"
                    type="number"
                    min="0"
                    value={filters.contentLength.min}
                    onChange={(e) => updateFilters({ 
                      contentLength: { ...filters.contentLength, min: parseInt(e.target.value) || 0 }
                    })}
                  />
                </div>
                <div>
                  <Label htmlFor="length-max" className="text-xs">最大长度</Label>
                  <Input
                    id="length-max"
                    type="number"
                    min="0"
                    value={filters.contentLength.max}
                    onChange={(e) => updateFilters({ 
                      contentLength: { ...filters.contentLength, max: parseInt(e.target.value) || 10000 }
                    })}
                  />
                </div>
              </div>
            </div>
          </CollapsibleContent>
        </Collapsible>

        {/* 操作按钮 */}
        <div className="flex justify-between">
          <Button variant="outline" onClick={clearFilters} size="sm">
            清除过滤器
          </Button>
          <div className="text-sm text-muted-foreground">
            共找到 {searchResults.length} 条消息
          </div>
        </div>
      </CardContent>
    </Card>
  );
} 