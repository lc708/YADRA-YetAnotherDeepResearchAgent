// Copyright (c) 2025 YADRA

/**
 * ArtifactCard - 制品卡片组件
 * 
 * 🔄 替换目标：
 * - ~/components/yadra/artifact-card（旧版本）
 * - ~/components/yadra/artifact-viewer（查看器）
 * 
 * 📍 使用位置：
 * - artifact-feed.tsx - 制品展示
 * - conversation-panel.tsx - 制品预览
 * - workspace页面 - 制品管理
 * 
 * 🎯 功能特性：
 * - 多类型制品支持
 * - 预览和下载功能
 * - 响应式布局
 * - 快速操作
 */

"use client";

import React, { useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "~/lib/utils";
import { Button } from "~/components/ui/button";
import StatusBadge, { type StatusType } from "../conversation/status-badge";
import MarkdownRenderer from "../conversation/markdown-renderer";

export type ArtifactType = 
  | "document"     // 文档
  | "code"         // 代码
  | "image"        // 图片
  | "audio"        // 音频
  | "video"        // 视频
  | "data"         // 数据文件
  | "presentation" // 演示文稿
  | "report"       // 报告
  | "chart"        // 图表
  | "other";       // 其他

export interface Artifact {
  id: string;
  title: string;
  description?: string;
  type: ArtifactType;
  mimeType: string;
  size: number; // bytes
  url?: string;
  content?: string; // 文本内容
  preview?: string; // 预览内容
  thumbnail?: string; // 缩略图
  status: StatusType;
  createdAt: Date;
  updatedAt?: Date;
  metadata?: {
    author?: string;
    version?: string;
    tags?: string[];
    language?: string;
    duration?: number; // 音视频时长
    dimensions?: { width: number; height: number }; // 图片尺寸
    pageCount?: number; // 文档页数
  };
}

interface ArtifactCardProps {
  artifact: Artifact;
  variant?: "grid" | "list" | "compact";
  showPreview?: boolean;
  showMetadata?: boolean;
  showActions?: boolean;
  onView?: (artifact: Artifact) => void;
  onDownload?: (artifact: Artifact) => void;
  onEdit?: (artifact: Artifact) => void;
  onDelete?: (artifactId: string) => void;
  onShare?: (artifact: Artifact) => void;
  className?: string;
}

// 获取文件类型图标
const getTypeIcon = (type: ArtifactType, mimeType: string) => {
  switch (type) {
    case "document":
      if (mimeType.includes("pdf")) return "📄";
      if (mimeType.includes("word")) return "📝";
      return "📋";
    case "code":
      return "💻";
    case "image":
      return "🖼️";
    case "audio":
      return "🎵";
    case "video":
      return "🎬";
    case "data":
      return "📊";
    case "presentation":
      return "📊";
    case "report":
      return "📈";
    case "chart":
      return "📉";
    default:
      return "📎";
  }
};

// 获取文件类型颜色
const getTypeColor = (type: ArtifactType) => {
  switch (type) {
    case "document":
      return "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400";
    case "code":
      return "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400";
    case "image":
      return "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400";
    case "audio":
      return "bg-pink-100 text-pink-700 dark:bg-pink-900/30 dark:text-pink-400";
    case "video":
      return "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400";
    case "data":
      return "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400";
    case "presentation":
      return "bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-400";
    case "report":
      return "bg-cyan-100 text-cyan-700 dark:bg-cyan-900/30 dark:text-cyan-400";
    case "chart":
      return "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400";
    default:
      return "bg-gray-100 text-gray-700 dark:bg-gray-900/30 dark:text-gray-400";
  }
};

// 格式化文件大小
const formatFileSize = (bytes: number): string => {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + " " + sizes[i];
};

// 格式化时长
const formatDuration = (seconds: number): string => {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);
  
  if (hours > 0) {
    return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }
  return `${minutes}:${secs.toString().padStart(2, '0')}`;
};

// 制品预览组件
const ArtifactPreview: React.FC<{ artifact: Artifact }> = ({ artifact }) => {
  if (artifact.type === "image" && artifact.thumbnail) {
    return (
      <div className="relative w-full h-32 bg-muted rounded overflow-hidden">
        <img
          src={artifact.thumbnail}
          alt={artifact.title}
          className="w-full h-full object-cover"
        />
      </div>
    );
  }

  if (artifact.type === "code" && artifact.preview) {
    return (
      <div className="bg-muted/50 rounded p-3 text-xs font-mono overflow-hidden">
        <pre className="line-clamp-4">{artifact.preview}</pre>
      </div>
    );
  }

  if (artifact.preview) {
    return (
      <div className="text-sm text-muted-foreground line-clamp-3">
        {artifact.preview}
      </div>
    );
  }

  // 默认预览
  return (
    <div className="flex items-center justify-center h-24 bg-muted/30 rounded">
      <span className="text-4xl">{getTypeIcon(artifact.type, artifact.mimeType)}</span>
    </div>
  );
};

// 制品元数据组件
const ArtifactMetadata: React.FC<{ artifact: Artifact }> = ({ artifact }) => {
  const { metadata } = artifact;
  if (!metadata) return null;

  return (
    <div className="space-y-2 text-xs text-muted-foreground">
      {metadata.author && (
        <div className="flex items-center gap-2">
          <span>👤</span>
          <span>{metadata.author}</span>
        </div>
      )}
      
      {metadata.version && (
        <div className="flex items-center gap-2">
          <span>🏷️</span>
          <span>v{metadata.version}</span>
        </div>
      )}

      {metadata.language && (
        <div className="flex items-center gap-2">
          <span>🌐</span>
          <span>{metadata.language}</span>
        </div>
      )}

      {metadata.duration && (
        <div className="flex items-center gap-2">
          <span>⏱️</span>
          <span>{formatDuration(metadata.duration)}</span>
        </div>
      )}

      {metadata.dimensions && (
        <div className="flex items-center gap-2">
          <span>📐</span>
          <span>{metadata.dimensions.width} × {metadata.dimensions.height}</span>
        </div>
      )}

      {metadata.pageCount && (
        <div className="flex items-center gap-2">
          <span>📃</span>
          <span>{metadata.pageCount} 页</span>
        </div>
      )}

      {metadata.tags && metadata.tags.length > 0 && (
        <div className="flex flex-wrap gap-1 mt-2">
          {metadata.tags.map((tag, index) => (
            <span
              key={index}
              className="px-2 py-0.5 bg-muted rounded text-xs"
            >
              {tag}
            </span>
          ))}
        </div>
      )}
    </div>
  );
};

// 制品操作按钮
const ArtifactActions: React.FC<{
  artifact: Artifact;
  onView?: (artifact: Artifact) => void;
  onDownload?: (artifact: Artifact) => void;
  onEdit?: (artifact: Artifact) => void;
  onDelete?: (artifactId: string) => void;
  onShare?: (artifact: Artifact) => void;
}> = ({ artifact, onView, onDownload, onEdit, onDelete, onShare }) => {
  const [showMore, setShowMore] = useState(false);

  return (
    <div className="flex items-center gap-1">
      {/* 主要操作 */}
      {onView && (
        <Button
          variant="ghost"
          size="sm"
          onClick={() => onView(artifact)}
          className="h-8 px-2 text-xs"
        >
          👁️ 查看
        </Button>
      )}

      {onDownload && (
        <Button
          variant="ghost"
          size="sm"
          onClick={() => onDownload(artifact)}
          className="h-8 px-2 text-xs"
        >
          ⬇️ 下载
        </Button>
      )}

      {/* 更多操作 */}
      <div className="relative">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setShowMore(!showMore)}
          className="h-8 w-8 p-0"
        >
          ⋯
        </Button>

        <AnimatePresence>
          {showMore && (
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: -10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: -10 }}
              className="absolute right-0 top-full mt-1 bg-background border rounded-lg shadow-lg p-1 z-10"
            >
              {onShare && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    onShare(artifact);
                    setShowMore(false);
                  }}
                  className="w-full justify-start h-8 px-2 text-xs"
                >
                  🔗 分享
                </Button>
              )}

              {onEdit && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    onEdit(artifact);
                    setShowMore(false);
                  }}
                  className="w-full justify-start h-8 px-2 text-xs"
                >
                  ✏️ 编辑
                </Button>
              )}

              {onDelete && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    onDelete(artifact.id);
                    setShowMore(false);
                  }}
                  className="w-full justify-start h-8 px-2 text-xs text-red-600 hover:text-red-700"
                >
                  🗑️ 删除
                </Button>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
};

export const ArtifactCard: React.FC<ArtifactCardProps> = ({
  artifact,
  variant = "grid",
  showPreview = true,
  showMetadata = true,
  showActions = true,
  onView,
  onDownload,
  onEdit,
  onDelete,
  onShare,
  className
}) => {
  const [isExpanded, setIsExpanded] = useState(false);

  const isProcessing = artifact.status === "processing";
  const hasError = artifact.status === "error";
  const isCompleted = artifact.status === "completed";

  // 网格布局
  if (variant === "grid") {
    return (
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.3 }}
        className={cn(
          "bg-card border rounded-lg overflow-hidden",
          "hover:shadow-md transition-shadow duration-200",
          hasError && "border-red-200 dark:border-red-800",
          isCompleted && "border-green-200 dark:border-green-800",
          className
        )}
      >
        {/* 预览区域 */}
        {showPreview && (
          <div className="p-3">
            <ArtifactPreview artifact={artifact} />
          </div>
        )}

        {/* 内容区域 */}
        <div className="p-3 pt-0">
          {/* 头部信息 */}
          <div className="flex items-start gap-2 mb-2">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <span className={cn(
                  "px-2 py-0.5 rounded text-xs font-medium",
                  getTypeColor(artifact.type)
                )}>
                  {getTypeIcon(artifact.type, artifact.mimeType)} {artifact.type}
                </span>
                <StatusBadge status={artifact.status} size="sm" />
              </div>
              
              <h3 className="font-medium text-sm truncate" title={artifact.title}>
                {artifact.title}
              </h3>
              
              <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
                <span>{formatFileSize(artifact.size)}</span>
                <span>•</span>
                <span>{artifact.createdAt.toLocaleDateString()}</span>
              </div>
            </div>
          </div>

          {/* 描述 */}
          {artifact.description && (
            <p className="text-xs text-muted-foreground line-clamp-2 mb-2">
              {artifact.description}
            </p>
          )}

          {/* 元数据 */}
          {showMetadata && (
            <div className="mb-3">
              <ArtifactMetadata artifact={artifact} />
            </div>
          )}

          {/* 操作按钮 */}
          {showActions && (
            <ArtifactActions
              artifact={artifact}
              onView={onView}
              onDownload={onDownload}
              onEdit={onEdit}
              onDelete={onDelete}
              onShare={onShare}
            />
          )}
        </div>
      </motion.div>
    );
  }

  // 列表布局
  if (variant === "list") {
    return (
      <motion.div
        initial={{ opacity: 0, x: -20 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.3 }}
        className={cn(
          "bg-card border rounded-lg p-4",
          "hover:shadow-md transition-shadow duration-200",
          hasError && "border-red-200 dark:border-red-800",
          isCompleted && "border-green-200 dark:border-green-800",
          className
        )}
      >
        <div className="flex items-start gap-4">
          {/* 图标/预览 */}
          <div className="flex-shrink-0">
            {artifact.thumbnail ? (
              <img
                src={artifact.thumbnail}
                alt={artifact.title}
                className="w-12 h-12 rounded object-cover"
              />
            ) : (
              <div className="w-12 h-12 rounded bg-muted flex items-center justify-center text-lg">
                {getTypeIcon(artifact.type, artifact.mimeType)}
              </div>
            )}
          </div>

          {/* 内容 */}
          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-3">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <h3 className="font-medium text-sm">{artifact.title}</h3>
                  <span className={cn(
                    "px-2 py-0.5 rounded text-xs font-medium",
                    getTypeColor(artifact.type)
                  )}>
                    {artifact.type}
                  </span>
                  <StatusBadge status={artifact.status} size="sm" />
                </div>

                {artifact.description && (
                  <p className="text-sm text-muted-foreground line-clamp-2 mb-2">
                    {artifact.description}
                  </p>
                )}

                <div className="flex items-center gap-4 text-xs text-muted-foreground">
                  <span>{formatFileSize(artifact.size)}</span>
                  <span>{artifact.createdAt.toLocaleDateString()}</span>
                  {artifact.metadata?.pageCount && (
                    <span>{artifact.metadata.pageCount} 页</span>
                  )}
                  {artifact.metadata?.duration && (
                    <span>{formatDuration(artifact.metadata.duration)}</span>
                  )}
                </div>
              </div>

              {/* 操作按钮 */}
              {showActions && (
                <ArtifactActions
                  artifact={artifact}
                  onView={onView}
                  onDownload={onDownload}
                  onEdit={onEdit}
                  onDelete={onDelete}
                  onShare={onShare}
                />
              )}
            </div>
          </div>
        </div>
      </motion.div>
    );
  }

  // 紧凑布局
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className={cn(
        "flex items-center gap-3 p-2 rounded border bg-card/50",
        "hover:bg-card transition-colors duration-200",
        hasError && "border-red-200 dark:border-red-800",
        isCompleted && "border-green-200 dark:border-green-800",
        className
      )}
    >
      {/* 图标 */}
      <div className="flex-shrink-0 text-lg">
        {getTypeIcon(artifact.type, artifact.mimeType)}
      </div>

      {/* 内容 */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="font-medium text-sm truncate">{artifact.title}</span>
          <StatusBadge status={artifact.status} size="sm" />
        </div>
        <div className="text-xs text-muted-foreground">
          {formatFileSize(artifact.size)} • {artifact.type}
        </div>
      </div>

      {/* 快速操作 */}
      {showActions && (
        <div className="flex items-center gap-1">
          {onView && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onView(artifact)}
              className="h-6 w-6 p-0"
            >
              👁️
            </Button>
          )}
          {onDownload && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onDownload(artifact)}
              className="h-6 w-6 p-0"
            >
              ⬇️
            </Button>
          )}
        </div>
      )}
    </motion.div>
  );
};

export default ArtifactCard; 