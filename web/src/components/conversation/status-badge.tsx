// Copyright (c) 2025 YADRA

/**
 * StatusBadge - 状态徽章组件
 * 
 * 🔄 替换目标：
 * - ~/components/yadra/status-badge（如存在）
 * - 各组件中的内联状态显示
 * 
 * 📍 使用位置：
 * - message-container.tsx - 消息状态
 * - research-card.tsx - 研究状态
 * - plan-card.tsx - 计划状态
 * - conversation-panel.tsx - 整体状态
 * 
 * 🎯 功能特性：
 * - 多种状态类型和样式
 * - 动画效果和图标支持
 * - 自适应颜色主题
 * - 脉冲和闪烁效果
 */

"use client";

import React from "react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "~/lib/utils";

export type StatusType = 
  | "idle"          // 空闲
  | "loading"       // 加载中
  | "processing"    // 处理中
  | "success"       // 成功
  | "error"         // 错误
  | "warning"       // 警告
  | "info"          // 信息
  | "pending"       // 等待中
  | "completed"     // 已完成
  | "cancelled"     // 已取消
  | "researching"   // 研究中
  | "planning"      // 规划中
  | "generating"    // 生成中
  | "streaming";    // 流式传输中

export type StatusVariant = "default" | "outline" | "ghost" | "solid";
export type StatusSize = "sm" | "md" | "lg";

interface StatusBadgeProps {
  status: StatusType;
  variant?: StatusVariant;
  size?: StatusSize;
  text?: string;
  showIcon?: boolean;
  showPulse?: boolean;
  className?: string;
  onClick?: () => void;
}

const statusConfig = {
  idle: {
    color: "bg-muted text-muted-foreground",
    outlineColor: "border-muted-foreground/30 text-muted-foreground",
    icon: "○",
    label: "空闲"
  },
  loading: {
    color: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
    outlineColor: "border-blue-300 text-blue-700 dark:border-blue-700 dark:text-blue-400",
    icon: "◐",
    label: "加载中"
  },
  processing: {
    color: "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400",
    outlineColor: "border-purple-300 text-purple-700 dark:border-purple-700 dark:text-purple-400",
    icon: "⚙",
    label: "处理中"
  },
  success: {
    color: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
    outlineColor: "border-green-300 text-green-700 dark:border-green-700 dark:text-green-400",
    icon: "✓",
    label: "成功"
  },
  error: {
    color: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
    outlineColor: "border-red-300 text-red-700 dark:border-red-700 dark:text-red-400",
    icon: "✗",
    label: "错误"
  },
  warning: {
    color: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400",
    outlineColor: "border-yellow-300 text-yellow-700 dark:border-yellow-700 dark:text-yellow-400",
    icon: "⚠",
    label: "警告"
  },
  info: {
    color: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
    outlineColor: "border-blue-300 text-blue-700 dark:border-blue-700 dark:text-blue-400",
    icon: "ⓘ",
    label: "信息"
  },
  pending: {
    color: "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400",
    outlineColor: "border-orange-300 text-orange-700 dark:border-orange-700 dark:text-orange-400",
    icon: "⏳",
    label: "等待中"
  },
  completed: {
    color: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
    outlineColor: "border-green-300 text-green-700 dark:border-green-700 dark:text-green-400",
    icon: "✅",
    label: "已完成"
  },
  cancelled: {
    color: "bg-gray-100 text-gray-700 dark:bg-gray-900/30 dark:text-gray-400",
    outlineColor: "border-gray-300 text-gray-700 dark:border-gray-700 dark:text-gray-400",
    icon: "⊘",
    label: "已取消"
  },
  researching: {
    color: "bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-400",
    outlineColor: "border-indigo-300 text-indigo-700 dark:border-indigo-700 dark:text-indigo-400",
    icon: "🔍",
    label: "研究中"
  },
  planning: {
    color: "bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-400",
    outlineColor: "border-violet-300 text-violet-700 dark:border-violet-700 dark:text-violet-400",
    icon: "📋",
    label: "规划中"
  },
  generating: {
    color: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400",
    outlineColor: "border-emerald-300 text-emerald-700 dark:border-emerald-700 dark:text-emerald-400",
    icon: "✨",
    label: "生成中"
  },
  streaming: {
    color: "bg-cyan-100 text-cyan-700 dark:bg-cyan-900/30 dark:text-cyan-400",
    outlineColor: "border-cyan-300 text-cyan-700 dark:border-cyan-700 dark:text-cyan-400",
    icon: "📡",
    label: "流式传输中"
  }
};

const sizeConfig = {
  sm: {
    container: "px-2 py-0.5 text-xs",
    icon: "text-xs",
    gap: "gap-1"
  },
  md: {
    container: "px-2.5 py-1 text-sm",
    icon: "text-sm",
    gap: "gap-1.5"
  },
  lg: {
    container: "px-3 py-1.5 text-base",
    icon: "text-base",
    gap: "gap-2"
  }
};

// 动态状态（需要动画效果）
const animatedStatuses: StatusType[] = [
  "loading", "processing", "researching", "planning", "generating", "streaming"
];

export const StatusBadge: React.FC<StatusBadgeProps> = ({
  status,
  variant = "default",
  size = "md",
  text,
  showIcon = true,
  showPulse = true,
  className,
  onClick
}) => {
  const config = statusConfig[status];
  const sizeStyles = sizeConfig[size];
  const isAnimated = animatedStatuses.includes(status);
  const displayText = text || config.label;

  const getVariantStyles = () => {
    switch (variant) {
      case "outline":
        return `border ${config.outlineColor} bg-transparent`;
      case "ghost":
        return `${config.outlineColor} bg-transparent hover:${config.color}`;
      case "solid":
        return config.color;
      default:
        return config.color;
    }
  };

  const badgeContent = (
    <div
      className={cn(
        "inline-flex items-center rounded-full font-medium transition-all duration-200",
        sizeStyles.container,
        sizeStyles.gap,
        getVariantStyles(),
        onClick && "cursor-pointer hover:scale-105",
        className
      )}
      onClick={onClick}
    >
      {showIcon && (
        <motion.span
          className={cn("select-none", sizeStyles.icon)}
          animate={isAnimated ? { rotate: [0, 360] } : {}}
          transition={isAnimated ? { duration: 2, repeat: Infinity, ease: "linear" } : {}}
        >
          {config.icon}
        </motion.span>
      )}
      <span className="font-medium">{displayText}</span>
    </div>
  );

  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={status}
        initial={{ opacity: 0, scale: 0.8 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.8 }}
        transition={{ duration: 0.2 }}
        className="relative"
      >
        {/* 脉冲效果 */}
        {showPulse && isAnimated && (
          <motion.div
            className={cn(
              "absolute inset-0 rounded-full opacity-30",
              config.color
            )}
            animate={{ scale: [1, 1.2, 1], opacity: [0.3, 0.1, 0.3] }}
            transition={{ duration: 2, repeat: Infinity }}
          />
        )}
        
        {badgeContent}
      </motion.div>
    </AnimatePresence>
  );
};

export default StatusBadge; 