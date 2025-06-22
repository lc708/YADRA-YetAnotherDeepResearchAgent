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
  | "streaming"     // 流式传输中
  | "reasoning"     // 深度推理中
  | "research"      // 研究中
  | "thinking";     // 思考中

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

// 状态配置
const statusConfig = {
  idle: {
    color: "text-gray-600",
    outlineColor: "border-gray-200",
    icon: "○",
    label: "待机"
  },
  loading: {
    color: "text-blue-600",
    outlineColor: "border-blue-200",
    icon: "⟳",
    label: "加载中"
  },
  processing: {
    color: "text-blue-600",
    outlineColor: "border-blue-200",
    icon: "⚙",
    label: "处理中"
  },
  success: {
    color: "text-green-600",
    outlineColor: "border-green-200",
    icon: "✓",
    label: "成功"
  },
  error: {
    color: "text-red-500",
    outlineColor: "border-red-200",
    icon: "✗",
    label: "错误"
  },
  warning: {
    color: "text-orange-600",
    outlineColor: "border-orange-200",
    icon: "⚠",
    label: "警告"
  },
  info: {
    color: "text-blue-600",
    outlineColor: "border-blue-200",
    icon: "ⓘ",
    label: "信息"
  },
  pending: {
    color: "text-amber-600",
    outlineColor: "border-amber-200",
    icon: "⏳",
    label: "等待中"
  },
  completed: {
    color: "text-green-600",
    outlineColor: "border-green-200",
    icon: "✅",
    label: "已完成"
  },
  cancelled: {
    color: "text-gray-600",
    outlineColor: "border-gray-200",
    icon: "⊘",
    label: "已取消"
  },
  researching: {
    color: "text-purple-600",
    outlineColor: "border-purple-200",
    icon: "🔍",
    label: "研究中"
  },
  planning: {
    color: "text-indigo-600",
    outlineColor: "border-indigo-200",
    icon: "📋",
    label: "规划中"
  },
  generating: {
    color: "text-emerald-600",
    outlineColor: "border-emerald-200",
    icon: "✨",
    label: "生成中"
  },
  streaming: {
    color: "text-blue-600",
    outlineColor: "border-blue-200",
    icon: "📡",
    label: "流式传输"
  },
  reasoning: {
    color: "text-purple-600",
    outlineColor: "border-purple-200",
    icon: "🧠",
    label: "推理中"
  },
  research: {
    color: "text-purple-600",
    outlineColor: "border-purple-200",
    icon: "🔬",
    label: "研究中"
  },
  thinking: {
    color: "text-violet-600",
    outlineColor: "border-violet-200",
    icon: "💭",
    label: "思考中"
  }
};

// 尺寸配置
const sizeConfig = {
  sm: {
    padding: "px-2 py-1",
    text: "text-xs",
    icon: "text-xs"
  },
  md: {
    padding: "px-3 py-1.5",
    text: "text-sm",
    icon: "text-sm"
  },
  lg: {
    padding: "px-4 py-2",
    text: "text-base",
    icon: "text-base"
  }
};

// 需要动画的状态
const animatedStatuses: StatusType[] = [
  "loading",
  "processing", 
  "researching",
  "planning",
  "generating",
  "streaming",
  "reasoning",
  "thinking"
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
        return `border ${config.outlineColor} ${config.color} bg-transparent`;
      case "ghost":
        return `${config.color} bg-transparent hover:bg-gray-50`;
      case "solid":
        return `${config.color} bg-current text-white`;
      default:
        return `${config.color} bg-gray-50 border border-gray-200`;
    }
  };

  const badgeContent = (
    <div
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full font-medium transition-all duration-200",
        sizeStyles.padding,
        sizeStyles.text,
        getVariantStyles(),
        onClick && "cursor-pointer hover:scale-105",
        isAnimated && showPulse && "animate-pulse",
        className
      )}
      onClick={onClick}
    >
      {showIcon && (
        <span className={cn("inline-block", sizeStyles.icon)}>
          {config.icon}
        </span>
      )}
      <span>{displayText}</span>
    </div>
  );

  if (isAnimated && showPulse) {
    return (
      <AnimatePresence>
        <motion.div
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.8 }}
          transition={{ duration: 0.2 }}
        >
          {badgeContent}
        </motion.div>
      </AnimatePresence>
    );
  }

  return badgeContent;
};

export default StatusBadge; 