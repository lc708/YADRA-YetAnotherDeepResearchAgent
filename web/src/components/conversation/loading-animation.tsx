// Copyright (c) 2025 YADRA

/**
 * LoadingAnimation - 智能加载动画组件
 * 
 * 🔄 替换目标：
 * - ~/components/yadra/loading-animation（旧版本）
 * - ~/components/yadra/typing-animation（打字机效果）
 * 
 * 📍 使用位置：
 * - conversation-panel.tsx - 消息加载状态
 * - research-card.tsx - 研究进度加载
 * - 各种异步操作加载状态
 * 
 * 🎯 功能特性：
 * - 多种加载动画类型
 * - 自适应尺寸和颜色
 * - 可配置文本和状态
 * - 性能优化的动画
 */

"use client";

import React from "react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "~/lib/utils";

export type LoadingType = 
  | "dots"          // 三点跳动
  | "spinner"       // 旋转圆圈
  | "pulse"         // 脉冲效果
  | "typing"        // 打字机效果
  | "progress"      // 进度条
  | "skeleton"      // 骨架屏
  | "wave"          // 波浪效果
  | "research";     // 研究专用动画

export type LoadingSize = "sm" | "md" | "lg" | "xl";

interface LoadingAnimationProps {
  type?: LoadingType;
  size?: LoadingSize;
  color?: string;
  text?: string;
  subText?: string;
  progress?: number; // 0-100 for progress type
  className?: string;
  showText?: boolean;
  duration?: number; // 动画持续时间（秒）
}

const sizeConfig = {
  sm: { container: "h-4 w-4", dot: "w-1 h-1", text: "text-xs" },
  md: { container: "h-6 w-6", dot: "w-1.5 h-1.5", text: "text-sm" },
  lg: { container: "h-8 w-8", dot: "w-2 h-2", text: "text-base" },
  xl: { container: "h-12 w-12", dot: "w-3 h-3", text: "text-lg" },
};

// 三点跳动动画
const DotsAnimation = ({ size, color }: { size: LoadingSize; color: string }) => {
  const dotVariants = {
    initial: { y: 0 },
    animate: { y: -8 },
  };

  return (
    <div className="flex items-center space-x-1">
      {[0, 1, 2].map((index) => (
        <motion.div
          key={index}
          className={cn(sizeConfig[size].dot, "rounded-full")}
          style={{ backgroundColor: color }}
          variants={dotVariants}
          initial="initial"
          animate="animate"
          transition={{
            duration: 0.6,
            repeat: Infinity,
            repeatType: "reverse",
            delay: index * 0.2,
          }}
        />
      ))}
    </div>
  );
};

// 旋转圆圈动画
const SpinnerAnimation = ({ size, color }: { size: LoadingSize; color: string }) => {
  return (
    <motion.div
      className={cn(sizeConfig[size].container, "border-2 border-t-transparent rounded-full")}
      style={{ borderColor: `${color} transparent transparent transparent` }}
      animate={{ rotate: 360 }}
      transition={{
        duration: 1,
        repeat: Infinity,
        ease: "linear",
      }}
    />
  );
};

// 脉冲效果
const PulseAnimation = ({ size, color }: { size: LoadingSize; color: string }) => {
  return (
    <motion.div
      className={cn(sizeConfig[size].container, "rounded-full")}
      style={{ backgroundColor: color }}
      animate={{ scale: [1, 1.2, 1], opacity: [1, 0.7, 1] }}
      transition={{
        duration: 1.5,
        repeat: Infinity,
        ease: "easeInOut",
      }}
    />
  );
};

// 打字机效果
const TypingAnimation = ({ size, color }: { size: LoadingSize; color: string }) => {
  return (
    <div className="flex items-center space-x-1">
      {[0, 1, 2].map((index) => (
        <motion.div
          key={index}
          className={cn(sizeConfig[size].dot, "rounded-full")}
          style={{ backgroundColor: color }}
          animate={{ opacity: [0.3, 1, 0.3] }}
          transition={{
            duration: 1.4,
            repeat: Infinity,
            delay: index * 0.2,
          }}
        />
      ))}
    </div>
  );
};

// 进度条动画
const ProgressAnimation = ({ progress, color }: { progress: number; color: string }) => {
  return (
    <div className="w-full h-2 bg-muted rounded-full overflow-hidden">
      <motion.div
        className="h-full rounded-full"
        style={{ backgroundColor: color }}
        initial={{ width: "0%" }}
        animate={{ width: `${Math.min(100, Math.max(0, progress))}%` }}
        transition={{ duration: 0.3, ease: "easeOut" }}
      />
    </div>
  );
};

// 骨架屏动画
const SkeletonAnimation = ({ size }: { size: LoadingSize }) => {
  const heights = {
    sm: ["h-3", "h-2", "h-3"],
    md: ["h-4", "h-3", "h-4"],
    lg: ["h-5", "h-4", "h-5"],
    xl: ["h-6", "h-5", "h-6"],
  };

  return (
    <div className="space-y-2 w-full">
      {heights[size].map((height, index) => (
        <motion.div
          key={index}
          className={cn(height, "bg-muted rounded", index === 1 ? "w-3/4" : "w-full")}
          animate={{ opacity: [0.5, 1, 0.5] }}
          transition={{
            duration: 1.5,
            repeat: Infinity,
            delay: index * 0.2,
          }}
        />
      ))}
    </div>
  );
};

// 波浪效果
const WaveAnimation = ({ size, color }: { size: LoadingSize; color: string }) => {
  return (
    <div className="flex items-center space-x-1">
      {[0, 1, 2, 3, 4].map((index) => (
        <motion.div
          key={index}
          className={cn("w-1 rounded-full", {
            "h-4": size === "sm",
            "h-6": size === "md",
            "h-8": size === "lg",
            "h-12": size === "xl",
          })}
          style={{ backgroundColor: color }}
          animate={{ scaleY: [1, 2, 1] }}
          transition={{
            duration: 1,
            repeat: Infinity,
            delay: index * 0.1,
          }}
        />
      ))}
    </div>
  );
};

// 研究专用动画
const ResearchAnimation = ({ size, color }: { size: LoadingSize; color: string }) => {
  return (
    <div className="relative">
      {/* 外圈旋转 */}
      <motion.div
        className={cn(sizeConfig[size].container, "border-2 border-dashed rounded-full")}
        style={{ borderColor: color }}
        animate={{ rotate: 360 }}
        transition={{ duration: 3, repeat: Infinity, ease: "linear" }}
      />
      {/* 内圈反向旋转 */}
      <motion.div
        className={cn("absolute inset-2 border border-solid rounded-full")}
        style={{ borderColor: color }}
        animate={{ rotate: -360 }}
        transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
      />
      {/* 中心点 */}
      <motion.div
        className="absolute inset-1/2 w-1 h-1 -translate-x-1/2 -translate-y-1/2 rounded-full"
        style={{ backgroundColor: color }}
        animate={{ scale: [1, 1.5, 1] }}
        transition={{ duration: 1, repeat: Infinity }}
      />
    </div>
  );
};

export const LoadingAnimation: React.FC<LoadingAnimationProps> = ({
  type = "dots",
  size = "md",
  color = "currentColor",
  text,
  subText,
  progress = 0,
  className,
  showText = true,
  duration = 1,
}) => {
  const renderAnimation = () => {
    const props = { size, color };
    
    switch (type) {
      case "dots":
        return <DotsAnimation {...props} />;
      case "spinner":
        return <SpinnerAnimation {...props} />;
      case "pulse":
        return <PulseAnimation {...props} />;
      case "typing":
        return <TypingAnimation {...props} />;
      case "progress":
        return <ProgressAnimation progress={progress} color={color} />;
      case "skeleton":
        return <SkeletonAnimation size={size} />;
      case "wave":
        return <WaveAnimation {...props} />;
      case "research":
        return <ResearchAnimation {...props} />;
      default:
        return <DotsAnimation {...props} />;
    }
  };

  return (
    <div className={cn("flex flex-col items-center justify-center space-y-2", className)}>
      <AnimatePresence mode="wait">
        <motion.div
          key={type}
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.8 }}
          transition={{ duration: 0.2 }}
        >
          {renderAnimation()}
        </motion.div>
      </AnimatePresence>
      
      {showText && (text || subText) && (
        <div className="text-center space-y-1">
          {text && (
            <motion.p
              className={cn(sizeConfig[size].text, "font-medium text-foreground")}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
            >
              {text}
            </motion.p>
          )}
          {subText && (
            <motion.p
              className={cn(sizeConfig[size].text, "text-muted-foreground")}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
            >
              {subText}
            </motion.p>
          )}
        </div>
      )}
    </div>
  );
};

export default LoadingAnimation; 