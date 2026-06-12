// Copyright (c) 2025 YADRA

/**
 * ScrollContainer - 智能滚动容器组件
 * 
 * 🔄 替换目标：
 * - ~/components/yadra/scroll-container（旧版本）
 * 
 * 📍 使用位置：
 * - conversation-panel.tsx - 消息列表滚动
 * - 其他需要滚动的内容区域
 * 
 * 🎯 功能特性：
 * - 智能自动滚动：新消息自动滚动到底部
 * - 滚动阴影：视觉层次感
 * - 位置感知：检测是否在底部
 * - 性能优化：防抖和节流
 */

"use client";

import React, { useRef, useEffect, useCallback, useState, forwardRef, useImperativeHandle } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "~/lib/utils";

export interface ScrollContainerRef {
  scrollToBottom: (smooth?: boolean) => void;
  scrollToTop: (smooth?: boolean) => void;
  scrollToElement: (element: HTMLElement, smooth?: boolean) => void;
  isAtBottom: () => boolean;
  isAtTop: () => boolean;
}

interface ScrollContainerProps {
  children: React.ReactNode;
  className?: string;
  autoScrollToBottom?: boolean;
  scrollShadowColor?: string;
  showScrollIndicator?: boolean;
  onScrollChange?: (position: { isAtBottom: boolean; isAtTop: boolean; scrollTop: number; scrollHeight: number }) => void;
  onReachBottom?: () => void;
  onReachTop?: () => void;
  // 性能优化选项
  throttleMs?: number;
}

export const ScrollContainer = forwardRef<ScrollContainerRef, ScrollContainerProps>(({
  children,
  className,
  autoScrollToBottom = false,
  scrollShadowColor = "rgba(0, 0, 0, 0.1)",
  showScrollIndicator = true,
  onScrollChange,
  onReachBottom,
  onReachTop,
  throttleMs = 16, // 60fps
}, ref) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const [isAtBottom, setIsAtBottom] = useState(true);
  const [isAtTop, setIsAtTop] = useState(true);
  const [showTopShadow, setShowTopShadow] = useState(false);
  const [showBottomShadow, setShowBottomShadow] = useState(false);
  const lastScrollTime = useRef(0);
  const scrollTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // 节流滚动处理
  const throttledScrollHandler = useCallback((scrollTop: number, scrollHeight: number, clientHeight: number) => {
    const now = Date.now();
    if (now - lastScrollTime.current < throttleMs) {
      return;
    }
    lastScrollTime.current = now;

    const atBottom = Math.abs(scrollHeight - clientHeight - scrollTop) < 5;
    const atTop = scrollTop < 5;

    setIsAtBottom(atBottom);
    setIsAtTop(atTop);
    setShowTopShadow(scrollTop > 10);
    setShowBottomShadow(!atBottom && scrollHeight > clientHeight);

    // 触发回调
    onScrollChange?.({
      isAtBottom: atBottom,
      isAtTop: atTop,
      scrollTop,
      scrollHeight
    });

    // 到达边界回调
    if (atBottom && onReachBottom) {
      onReachBottom();
    }
    if (atTop && onReachTop) {
      onReachTop();
    }
  }, [throttleMs, onScrollChange, onReachBottom, onReachTop]);

  // 滚动事件处理
  const handleScroll = useCallback((e: React.UIEvent<HTMLDivElement>) => {
    const target = e.currentTarget;
    const { scrollTop, scrollHeight, clientHeight } = target;
    
    // 清除之前的定时器
    if (scrollTimeoutRef.current) {
      clearTimeout(scrollTimeoutRef.current);
    }

    // 使用 requestAnimationFrame 优化性能
    scrollTimeoutRef.current = setTimeout(() => {
      throttledScrollHandler(scrollTop, scrollHeight, clientHeight);
    }, 0);
  }, [throttledScrollHandler]);

  // 滚动到底部
  const scrollToBottom = useCallback((smooth = true) => {
    if (!containerRef.current) return;
    
    const scrollOptions: ScrollToOptions = {
      top: containerRef.current.scrollHeight,
      behavior: smooth ? 'smooth' : 'instant'
    };
    
    containerRef.current.scrollTo(scrollOptions);
  }, []);

  // 滚动到顶部
  const scrollToTop = useCallback((smooth = true) => {
    if (!containerRef.current) return;
    
    const scrollOptions: ScrollToOptions = {
      top: 0,
      behavior: smooth ? 'smooth' : 'instant'
    };
    
    containerRef.current.scrollTo(scrollOptions);
  }, []);

  // 滚动到指定元素
  const scrollToElement = useCallback((element: HTMLElement, smooth = true) => {
    if (!containerRef.current) return;
    
    element.scrollIntoView({
      behavior: smooth ? 'smooth' : 'instant',
      block: 'nearest',
      inline: 'nearest'
    });
  }, []);

  // 检查是否在底部
  const checkIsAtBottom = useCallback(() => {
    if (!containerRef.current) return false;
    const { scrollTop, scrollHeight, clientHeight } = containerRef.current;
    return Math.abs(scrollHeight - clientHeight - scrollTop) < 5;
  }, []);

  // 检查是否在顶部
  const checkIsAtTop = useCallback(() => {
    if (!containerRef.current) return false;
    return containerRef.current.scrollTop < 5;
  }, []);

  // 暴露方法给父组件
  useImperativeHandle(ref, () => ({
    scrollToBottom,
    scrollToTop,
    scrollToElement,
    isAtBottom: checkIsAtBottom,
    isAtTop: checkIsAtTop,
  }), [scrollToBottom, scrollToTop, scrollToElement, checkIsAtBottom, checkIsAtTop]);

  // 自动滚动到底部（当内容变化时）
  useEffect(() => {
    if (autoScrollToBottom && isAtBottom) {
      // 使用 requestAnimationFrame 确保 DOM 更新后再滚动
      requestAnimationFrame(() => {
        scrollToBottom(false); // 快速滚动，不使用动画
      });
    }
  }, [children, autoScrollToBottom, isAtBottom, scrollToBottom]);

  // 初始化时检查滚动状态
  useEffect(() => {
    if (containerRef.current) {
      const { scrollTop, scrollHeight, clientHeight } = containerRef.current;
      throttledScrollHandler(scrollTop, scrollHeight, clientHeight);
    }
  }, [throttledScrollHandler]);

  // 清理定时器
  useEffect(() => {
    return () => {
      if (scrollTimeoutRef.current) {
        clearTimeout(scrollTimeoutRef.current);
      }
    };
  }, []);

  return (
    <div className={cn("relative h-full w-full", className)}>
      {/* 顶部阴影 */}
      <AnimatePresence>
        {showTopShadow && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute top-0 left-0 right-0 h-4 pointer-events-none z-10"
            style={{
              background: `linear-gradient(to bottom, ${scrollShadowColor}, transparent)`
            }}
          />
        )}
      </AnimatePresence>

      {/* 滚动容器 */}
      <div
        ref={containerRef}
        onScroll={handleScroll}
        className={cn(
          "h-full w-full overflow-y-auto overflow-x-hidden",
          "scrollbar-thin scrollbar-thumb-muted-foreground/20 scrollbar-track-transparent",
          "scroll-smooth"
        )}
      >
        <div ref={contentRef} className="min-h-full">
          {children}
        </div>
      </div>

      {/* 底部阴影 */}
      <AnimatePresence>
        {showBottomShadow && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute bottom-0 left-0 right-0 h-4 pointer-events-none z-10"
            style={{
              background: `linear-gradient(to top, ${scrollShadowColor}, transparent)`
            }}
          />
        )}
      </AnimatePresence>

      {/* 滚动指示器 */}
      {showScrollIndicator && !isAtBottom && (
        <motion.button
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.8 }}
          onClick={() => scrollToBottom(true)}
          className={cn(
            "absolute bottom-4 left-1/2 transform -translate-x-1/2 z-20",
            "bg-primary text-primary-foreground",
            "rounded-full p-2 shadow-lg",
            "hover:bg-primary/90 transition-colors",
            "focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2"
          )}
          aria-label="滚动到底部"
        >
          <svg
            className="w-4 h-4"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M19 14l-7 7m0 0l-7-7m7 7V3"
            />
          </svg>
        </motion.button>
      )}
    </div>
  );
});

ScrollContainer.displayName = "ScrollContainer";

export default ScrollContainer; 