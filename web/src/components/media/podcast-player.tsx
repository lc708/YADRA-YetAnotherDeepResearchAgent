// Copyright (c) 2025 YADRA

/**
 * PodcastPlayer - 媒体播放器组件
 * 
 * 🔄 替换目标：
 * - ~/components/yadra/podcast-card（旧版本）
 * - ~/components/yadra/podcast-player（旧版本）
 * 
 * 📍 使用位置：
 * - conversation-panel.tsx - 播客播放
 * - artifact-feed.tsx - 音频制品播放
 * - workspace页面 - 媒体播放
 * 
 * 🎯 功能特性：
 * - 现代播放器界面
 * - 波形可视化
 * - 字幕同步显示
 * - 播放控制功能
 */

"use client";

import React, { useState, useRef, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "~/lib/utils";
import { Button } from "~/components/ui/button";
import { Slider } from "~/components/ui/slider";
import StatusBadge, { type StatusType } from "../conversation/status-badge";

export interface TranscriptSegment {
  id: string;
  startTime: number; // seconds
  endTime: number;   // seconds
  text: string;
  speaker?: string;
  confidence?: number;
}

export interface PodcastData {
  id: string;
  title: string;
  description?: string;
  audioUrl: string;
  duration: number; // seconds
  transcript?: TranscriptSegment[];
  thumbnail?: string;
  status: StatusType;
  metadata?: {
    author?: string;
    publishedAt?: Date;
    tags?: string[];
    language?: string;
    quality?: "low" | "medium" | "high";
    fileSize?: number;
  };
}

interface PodcastPlayerProps {
  podcast: PodcastData;
  variant?: "default" | "compact" | "minimal";
  autoPlay?: boolean;
  showTranscript?: boolean;
  showWaveform?: boolean;
  onPlayStateChange?: (isPlaying: boolean) => void;
  onProgress?: (currentTime: number, duration: number) => void;
  onComplete?: () => void;
  className?: string;
}

// 播放速度选项
const SPEED_OPTIONS = [0.5, 0.75, 1, 1.25, 1.5, 1.75, 2];

// 格式化时间
const formatTime = (seconds: number): string => {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);
  
  if (hours > 0) {
    return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }
  return `${minutes}:${secs.toString().padStart(2, '0')}`;
};

// 波形可视化组件
const WaveformVisualizer: React.FC<{
  audioRef: React.RefObject<HTMLAudioElement | null>;
  currentTime: number;
  duration: number;
  isPlaying: boolean;
}> = ({ audioRef, currentTime, duration, isPlaying }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationRef = useRef<number | null>(null);

  // 模拟波形数据（实际应用中应该从音频文件解析）
  const generateWaveformData = useCallback(() => {
    const points = 100;
    return Array.from({ length: points }, (_, i) => {
      return Math.sin(i * 0.1) * 0.5 + Math.random() * 0.3;
    });
  }, []);

  const [waveformData] = useState(generateWaveformData);

  const drawWaveform = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const { width, height } = canvas;
    const progress = duration > 0 ? currentTime / duration : 0;

    ctx.clearRect(0, 0, width, height);

    // 绘制波形
    const barWidth = width / waveformData.length;
    waveformData.forEach((amplitude, index) => {
      const barHeight = amplitude * height * 0.8;
      const x = index * barWidth;
      const y = (height - barHeight) / 2;

      // 已播放部分
      if (index / waveformData.length <= progress) {
        ctx.fillStyle = 'hsl(var(--primary))';
      } else {
        ctx.fillStyle = 'hsl(var(--muted-foreground) / 0.3)';
      }

      ctx.fillRect(x, y, barWidth - 1, barHeight);
    });

    // 绘制进度指示器
    const progressX = progress * width;
    ctx.fillStyle = 'hsl(var(--primary))';
    ctx.fillRect(progressX - 1, 0, 2, height);

  }, [waveformData, currentTime, duration]);

  useEffect(() => {
    if (isPlaying) {
      const animate = () => {
        drawWaveform();
        animationRef.current = requestAnimationFrame(animate);
      };
      animate();
    } else {
      drawWaveform();
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    }

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [isPlaying, drawWaveform]);

  return (
    <canvas
      ref={canvasRef}
      width={300}
      height={60}
      className="w-full h-12 rounded bg-muted/30"
    />
  );
};

// 字幕显示组件
const TranscriptDisplay: React.FC<{
  transcript: TranscriptSegment[];
  currentTime: number;
  onSeek: (time: number) => void;
}> = ({ transcript, currentTime, onSeek }) => {
  const [activeSegmentId, setActiveSegmentId] = useState<string | null>(null);

  useEffect(() => {
    const activeSegment = transcript.find(
      segment => currentTime >= segment.startTime && currentTime <= segment.endTime
    );
    setActiveSegmentId(activeSegment?.id || null);
  }, [currentTime, transcript]);

  return (
    <div className="max-h-40 overflow-y-auto space-y-2 p-3 bg-muted/20 rounded">
      <h4 className="font-medium text-sm mb-2">字幕</h4>
      {transcript.map((segment) => (
        <motion.div
          key={segment.id}
          initial={{ opacity: 0.6 }}
          animate={{ 
            opacity: activeSegmentId === segment.id ? 1 : 0.6,
            scale: activeSegmentId === segment.id ? 1.02 : 1
          }}
          transition={{ duration: 0.2 }}
          className={cn(
            "p-2 rounded text-sm cursor-pointer transition-colors",
            activeSegmentId === segment.id 
              ? "bg-primary/10 border-l-2 border-primary" 
              : "hover:bg-muted/50"
          )}
          onClick={() => onSeek(segment.startTime)}
        >
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xs text-muted-foreground">
              {formatTime(segment.startTime)}
            </span>
            {segment.speaker && (
              <span className="text-xs font-medium text-primary">
                {segment.speaker}
              </span>
            )}
          </div>
          <p className="leading-relaxed">{segment.text}</p>
        </motion.div>
      ))}
    </div>
  );
};

export const PodcastPlayer: React.FC<PodcastPlayerProps> = ({
  podcast,
  variant = "default",
  autoPlay = false,
  showTranscript = true,
  showWaveform = true,
  onPlayStateChange,
  onProgress,
  onComplete,
  className
}) => {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(podcast.duration);
  const [volume, setVolume] = useState(1);
  const [playbackRate, setPlaybackRate] = useState(1);
  const [isLoading, setIsLoading] = useState(false);
  const [showSpeedMenu, setShowSpeedMenu] = useState(false);
  const [showTranscriptPanel, setShowTranscriptPanel] = useState(false);

  // 播放/暂停
  const togglePlay = useCallback(async () => {
    if (!audioRef.current) return;

    try {
      if (isPlaying) {
        audioRef.current.pause();
      } else {
        setIsLoading(true);
        await audioRef.current.play();
      }
    } catch (error) {
      console.error('Playback failed:', error);
      setIsLoading(false);
    }
  }, [isPlaying]);

  // 跳转到指定时间
  const seekTo = useCallback((time: number) => {
    if (audioRef.current) {
      audioRef.current.currentTime = time;
      setCurrentTime(time);
    }
  }, []);

  // 快进/快退
  const skip = useCallback((seconds: number) => {
    if (audioRef.current) {
      const newTime = Math.max(0, Math.min(duration, currentTime + seconds));
      seekTo(newTime);
    }
  }, [currentTime, duration, seekTo]);

  // 音频事件处理
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const handleTimeUpdate = () => {
      const time = audio.currentTime;
      setCurrentTime(time);
      onProgress?.(time, duration);
    };

    const handlePlay = () => {
      setIsPlaying(true);
      setIsLoading(false);
      onPlayStateChange?.(true);
    };

    const handlePause = () => {
      setIsPlaying(false);
      setIsLoading(false);
      onPlayStateChange?.(false);
    };

    const handleEnded = () => {
      setIsPlaying(false);
      setCurrentTime(0);
      onComplete?.();
    };

    const handleLoadedMetadata = () => {
      setDuration(audio.duration);
    };

    const handleWaiting = () => setIsLoading(true);
    const handleCanPlay = () => setIsLoading(false);

    audio.addEventListener('timeupdate', handleTimeUpdate);
    audio.addEventListener('play', handlePlay);
    audio.addEventListener('pause', handlePause);
    audio.addEventListener('ended', handleEnded);
    audio.addEventListener('loadedmetadata', handleLoadedMetadata);
    audio.addEventListener('waiting', handleWaiting);
    audio.addEventListener('canplay', handleCanPlay);

    return () => {
      audio.removeEventListener('timeupdate', handleTimeUpdate);
      audio.removeEventListener('play', handlePlay);
      audio.removeEventListener('pause', handlePause);
      audio.removeEventListener('ended', handleEnded);
      audio.removeEventListener('loadedmetadata', handleLoadedMetadata);
      audio.removeEventListener('waiting', handleWaiting);
      audio.removeEventListener('canplay', handleCanPlay);
    };
  }, [duration, onPlayStateChange, onProgress, onComplete]);

  // 设置音量
  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.volume = volume;
    }
  }, [volume]);

  // 设置播放速度
  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.playbackRate = playbackRate;
    }
  }, [playbackRate]);

  // 自动播放
  useEffect(() => {
    if (autoPlay && audioRef.current) {
      togglePlay();
    }
  }, [autoPlay, togglePlay]);

  const progress = duration > 0 ? (currentTime / duration) * 100 : 0;

  // 紧凑模式
  if (variant === "compact") {
    return (
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className={cn(
          "flex items-center gap-3 p-3 bg-card border rounded-lg",
          className
        )}
      >
        <audio ref={audioRef} src={podcast.audioUrl} preload="metadata" />
        
        {/* 播放按钮 */}
        <Button
          variant="ghost"
          size="sm"
          onClick={togglePlay}
          disabled={isLoading}
          className="h-8 w-8 p-0"
        >
          {isLoading ? "⏳" : isPlaying ? "⏸️" : "▶️"}
        </Button>

        {/* 标题和进度 */}
        <div className="flex-1 min-w-0">
          <h4 className="font-medium text-sm truncate">{podcast.title}</h4>
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <span>{formatTime(currentTime)}</span>
            <div className="flex-1 h-1 bg-muted rounded-full overflow-hidden">
              <div 
                className="h-full bg-primary transition-all duration-300"
                style={{ width: `${progress}%` }}
              />
            </div>
            <span>{formatTime(duration)}</span>
          </div>
        </div>

        <StatusBadge status={podcast.status} size="sm" />
      </motion.div>
    );
  }

  // 最小模式
  if (variant === "minimal") {
    return (
      <div className={cn("flex items-center gap-2", className)}>
        <audio ref={audioRef} src={podcast.audioUrl} preload="metadata" />
        <Button
          variant="ghost"
          size="sm"
          onClick={togglePlay}
          disabled={isLoading}
          className="h-6 w-6 p-0"
        >
          {isLoading ? "⏳" : isPlaying ? "⏸️" : "▶️"}
        </Button>
        <span className="text-xs text-muted-foreground">
          {formatTime(currentTime)} / {formatTime(duration)}
        </span>
      </div>
    );
  }

  // 默认完整模式
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className={cn(
        "bg-card border rounded-lg overflow-hidden",
        "hover:shadow-md transition-shadow duration-200",
        className
      )}
    >
      <audio ref={audioRef} src={podcast.audioUrl} preload="metadata" />

      {/* 头部信息 */}
      <div className="p-4 border-b">
        <div className="flex items-start gap-3">
          {/* 缩略图 */}
          {podcast.thumbnail && (
            <img
              src={podcast.thumbnail}
              alt={podcast.title}
              className="w-16 h-16 rounded object-cover"
            />
          )}

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <h3 className="font-semibold text-base">{podcast.title}</h3>
              <StatusBadge status={podcast.status} size="sm" />
            </div>
            
            {podcast.description && (
              <p className="text-sm text-muted-foreground line-clamp-2 mb-2">
                {podcast.description}
              </p>
            )}

            {podcast.metadata && (
              <div className="flex items-center gap-4 text-xs text-muted-foreground">
                {podcast.metadata.author && (
                  <span>👤 {podcast.metadata.author}</span>
                )}
                <span>⏱️ {formatTime(duration)}</span>
                {podcast.metadata.quality && (
                  <span>🎵 {podcast.metadata.quality}</span>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* 波形可视化 */}
      {showWaveform && (
        <div className="p-4 border-b">
          <WaveformVisualizer
            audioRef={audioRef}
            currentTime={currentTime}
            duration={duration}
            isPlaying={isPlaying}
          />
        </div>
      )}

      {/* 播放控制 */}
      <div className="p-4">
        {/* 进度条 */}
        <div className="mb-4">
          <Slider
            value={[currentTime]}
            max={duration}
            step={1}
            onValueChange={([value]) => seekTo(value || 0)}
            className="w-full"
          />
          <div className="flex justify-between text-xs text-muted-foreground mt-1">
            <span>{formatTime(currentTime)}</span>
            <span>{formatTime(duration)}</span>
          </div>
        </div>

        {/* 控制按钮 */}
        <div className="flex items-center justify-center gap-2 mb-4">
          {/* 快退 */}
          <Button
            variant="ghost"
            size="sm"
            onClick={() => skip(-15)}
            className="h-8 w-8 p-0"
          >
            ⏪
          </Button>

          {/* 播放/暂停 */}
          <Button
            onClick={togglePlay}
            disabled={isLoading}
            size="lg"
            className="h-12 w-12 rounded-full"
          >
            {isLoading ? "⏳" : isPlaying ? "⏸️" : "▶️"}
          </Button>

          {/* 快进 */}
          <Button
            variant="ghost"
            size="sm"
            onClick={() => skip(15)}
            className="h-8 w-8 p-0"
          >
            ⏩
          </Button>
        </div>

        {/* 底部控制 */}
        <div className="flex items-center justify-between">
          {/* 音量控制 */}
          <div className="flex items-center gap-2">
            <span className="text-sm">🔊</span>
            <Slider
              value={[volume]}
              max={1}
              step={0.1}
              onValueChange={([value]) => setVolume(value || 0)}
              className="w-20"
            />
          </div>

          {/* 播放速度 */}
          <div className="relative">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowSpeedMenu(!showSpeedMenu)}
              className="text-xs"
            >
              {playbackRate}x
            </Button>

            <AnimatePresence>
              {showSpeedMenu && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.9, y: -10 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.9, y: -10 }}
                  className="absolute bottom-full mb-2 right-0 bg-background border rounded-lg shadow-lg p-1"
                >
                  {SPEED_OPTIONS.map((speed) => (
                    <Button
                      key={speed}
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setPlaybackRate(speed);
                        setShowSpeedMenu(false);
                      }}
                      className={cn(
                        "w-full justify-center text-xs",
                        playbackRate === speed && "bg-primary/10"
                      )}
                    >
                      {speed}x
                    </Button>
                  ))}
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* 字幕按钮 */}
          {podcast.transcript && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowTranscriptPanel(!showTranscriptPanel)}
              className={cn(
                "text-xs",
                showTranscriptPanel && "bg-primary/10"
              )}
            >
              📝 字幕
            </Button>
          )}
        </div>
      </div>

      {/* 字幕面板 */}
      <AnimatePresence>
        {showTranscriptPanel && podcast.transcript && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="border-t overflow-hidden"
          >
            <TranscriptDisplay
              transcript={podcast.transcript}
              currentTime={currentTime}
              onSeek={seekTo}
            />
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
};

export default PodcastPlayer; 