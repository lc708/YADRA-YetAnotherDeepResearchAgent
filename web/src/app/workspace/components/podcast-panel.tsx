// Copyright (c) 2025 YADRA

"use client";

import { LoadingOutlined } from "@ant-design/icons";
import { Headphones, Download, Play, Pause, Volume2, VolumeX } from "lucide-react";
import { useState, useMemo, useCallback } from "react";

import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import { ScrollArea } from "~/components/ui/scroll-area";
import { RainbowText } from "~/components/yadra/rainbow-text";
import { Tooltip } from "~/components/yadra/tooltip";
import type { Message } from "~/core/messages";
import { useUnifiedStore, useThreadMessages } from "~/core/store/unified-store";
import { cn } from "~/lib/utils";

interface PodcastPanelProps {
  className?: string;
}

interface PodcastData {
  title?: string;
  researchId?: string;
  audioUrl?: string;
  error?: string;
}

export function PodcastPanel({ className }: PodcastPanelProps) {
  const [currentlyPlaying, setCurrentlyPlaying] = useState<string | null>(null);
  const [audioElements, setAudioElements] = useState<Map<string, HTMLAudioElement>>(new Map());
  
  // 使用unified-store获取当前线程的消息
  const messages = useThreadMessages();
  
  // 🔥 修复：使用LangGraph原生字段过滤出播客消息
  const podcastMessages = useMemo(() => {
    return messages.filter((message): message is Message => 
        message !== undefined && message.langGraphMetadata?.agent === "podcast"
      );
  }, [messages]);
  
  // 解析播客数据
  const podcastList = useMemo(() => {
    return podcastMessages.map(message => {
      try {
        const data: PodcastData = JSON.parse(message.content || "{}");
        return {
          id: message.id,
          message,
          data,
          isGenerating: message.isStreaming,
          hasError: !!data.error,
          hasAudio: !!data.audioUrl,
        };
      } catch {
        return {
          id: message.id,
          message,
          data: {},
          isGenerating: message.isStreaming,
          hasError: true,
          hasAudio: false,
        };
      }
    });
  }, [podcastMessages]);
  
  // 播放控制
  const handlePlayPause = useCallback((podcastId: string, audioUrl: string) => {
    const existingAudio = audioElements.get(podcastId);
    
    if (existingAudio) {
      if (currentlyPlaying === podcastId) {
        existingAudio.pause();
        setCurrentlyPlaying(null);
      } else {
        // 暂停其他正在播放的音频
        audioElements.forEach((audio, id) => {
          if (id !== podcastId) {
            audio.pause();
          }
        });
        
        existingAudio.play();
        setCurrentlyPlaying(podcastId);
      }
    } else {
      // 创建新的音频元素
      const audio = new Audio(audioUrl);
      
      audio.addEventListener('ended', () => {
        setCurrentlyPlaying(null);
      });
      
      audio.addEventListener('error', () => {
        console.error('Audio playback error');
        setCurrentlyPlaying(null);
      });
      
      // 暂停其他正在播放的音频
      audioElements.forEach((audio) => {
        audio.pause();
      });
      
      setAudioElements(prev => new Map(prev).set(podcastId, audio));
      audio.play();
      setCurrentlyPlaying(podcastId);
    }
  }, [audioElements, currentlyPlaying]);
  
  // 下载播客
  const handleDownload = useCallback((title: string, audioUrl: string) => {
    const link = document.createElement('a');
    link.href = audioUrl;
    link.download = `${title.replace(/[^a-zA-Z0-9\u4e00-\u9fa5]/g, '-')}.mp3`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }, []);
  
  if (podcastList.length === 0) {
    return (
      <div className={cn("flex h-full w-full items-center justify-center", className)}>
        <Card className="w-full max-w-sm">
          <CardContent className="flex flex-col items-center gap-4 p-6">
            <Headphones className="h-12 w-12 text-muted-foreground" />
            <div className="text-center">
              <h3 className="font-semibold">暂无播客</h3>
              <p className="text-sm text-muted-foreground">
                从研究报告生成播客后，将在这里显示
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }
  
  return (
    <div className={cn("flex h-full w-full flex-col", className)}>
      {/* 播客列表 */}
      <ScrollArea className="flex-1">
        <div className="space-y-4 p-4">
          {podcastList.map(({ id, message, data, isGenerating, hasError, hasAudio }) => (
            <Card key={id} className="transition-all hover:shadow-md">
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-2 min-w-0 flex-1">
                    {isGenerating ? (
                      <LoadingOutlined className="animate-spin" />
                    ) : hasError ? (
                      <VolumeX className="h-4 w-4 text-red-500" />
                    ) : (
                      <Volume2 className="h-4 w-4 text-green-500" />
                    )}
                    <CardTitle className="text-sm font-medium truncate">
                      <RainbowText animated={isGenerating}>
                        {data.title || "未命名播客"}
                      </RainbowText>
                    </CardTitle>
                  </div>
                  <div className="flex items-center gap-2">
                    {isGenerating && (
                      <Badge variant="secondary">生成中</Badge>
                    )}
                    {hasError && (
                      <Badge variant="destructive">错误</Badge>
                    )}
                    {hasAudio && (
                      <Badge variant="default">已完成</Badge>
                    )}
                  </div>
                </div>
                
                {/* 错误信息 */}
                {hasError && data.error && (
                  <p className="text-xs text-red-500 mt-2">
                    {data.error}
                  </p>
                )}
                
                {/* 生成状态 */}
                {isGenerating && (
                  <p className="text-xs text-muted-foreground mt-2">
                    正在生成播客音频，请稍候...
                  </p>
                )}
              </CardHeader>
              
              {/* 播客控制 */}
              {hasAudio && data.audioUrl && (
                <CardContent className="pt-0">
                  <div className="flex items-center gap-2">
                    <Tooltip title={currentlyPlaying === id ? "暂停播放" : "开始播放"}>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handlePlayPause(id, data.audioUrl!)}
                        className="gap-2"
                      >
                        {currentlyPlaying === id ? (
                          <Pause className="h-3 w-3" />
                        ) : (
                          <Play className="h-3 w-3" />
                        )}
                        {currentlyPlaying === id ? "暂停" : "播放"}
                      </Button>
                    </Tooltip>
                    
                    <Tooltip title="下载播客">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDownload(data.title || "podcast", data.audioUrl!)}
                        className="gap-2"
                      >
                        <Download className="h-3 w-3" />
                        下载
                      </Button>
                    </Tooltip>
                  </div>
                </CardContent>
              )}
            </Card>
          ))}
        </div>
      </ScrollArea>
    </div>
  );
} 