// Copyright (c) 2025 YADRA

"use client";

import { useEffect, useCallback, useRef } from "react";
import { useRouter, usePathname } from "next/navigation";
import { toast } from "sonner";
import { useStore } from "~/core/store";

interface OriginalInput {
  text: string;
  locale: string;
  settings: {
    enable_background_investigation: boolean;
    auto_accepted_plan: boolean;
    report_style: string;
    [key: string]: unknown;
  };
  resources: unknown[];
  timestamp: string;
}

interface ReaskHandlerOptions {
  onRestore?: (originalInput: OriginalInput) => void;
  onError?: (error: Error) => void;
}

export function useReaskHandler(options: ReaskHandlerOptions = {}) {
  const { onRestore, onError } = options;
  const isHandlingRef = useRef(false);
  const router = useRouter();
  const pathname = usePathname();
  const clearConversation = useStore((state) => state.clearConversation);

  const handleReaskEvent = useCallback((event: CustomEvent<OriginalInput>) => {
    // 防止重复处理
    if (isHandlingRef.current) {
      console.warn("Reask event already being handled, ignoring duplicate");
      return;
    }

    isHandlingRef.current = true;

    try {
      const originalInput = event.detail;
      
      if (!originalInput) {
        throw new Error("No original input data received");
      }

      console.log("Handling reask event:", originalInput);

      // 验证必要字段
      if (!originalInput.text || typeof originalInput.text !== 'string') {
        throw new Error("Invalid original input: missing or invalid text");
      }

      if (!originalInput.locale || typeof originalInput.locale !== 'string') {
        throw new Error("Invalid original input: missing or invalid locale");
      }

      // 清空当前对话状态
      clearConversation();

      // 如果当前在workspace页面，需要导航到chat页面
      if (pathname.startsWith('/workspace/')) {
        const reaskData = encodeURIComponent(JSON.stringify(originalInput));
        router.push(`/chat?reask=${reaskData}`);
        return; // 导航后不需要继续处理
      }

      // 如果已经在chat页面，直接调用恢复回调
      onRestore?.(originalInput);

      // 显示成功提示
      toast.success("已恢复到原始输入状态", {
        description: "您可以修改查询内容后重新提交",
        duration: 3000,
      });

    } catch (error) {
      console.error("Error handling reask event:", error);
      
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      
      // 调用错误回调
      onError?.(error instanceof Error ? error : new Error(errorMessage));
      
      // 显示错误提示
      toast.error("恢复原始状态失败", {
        description: errorMessage,
        duration: 5000,
      });
    } finally {
      // 延迟重置标志，避免快速连续事件
      setTimeout(() => {
        isHandlingRef.current = false;
      }, 1000);
    }
  }, [onRestore, onError, clearConversation, pathname, router]);

  useEffect(() => {
    console.log("=== useReaskHandler: 设置事件监听器 ===");
    
    const handleReask = (event: CustomEvent) => {
      console.log("=== handleReask: 接收到reask事件 ===");
      console.log("Event:", event);
      console.log("Event detail:", event.detail);
      
      try {
        const originalInput = event.detail;
        
        if (!originalInput) {
          console.error("handleReask: originalInput为空");
          return;
        }
        
        console.log("handleReask: 准备清除对话");
        // 清除当前对话
        clearConversation();
        
        console.log("handleReask: 准备导航到聊天页面");
        // 导航到聊天页面并传递原始输入数据
        const params = new URLSearchParams({
          reask: 'true',
          originalInput: JSON.stringify(originalInput)
        });
        
        const url = `/chat?${params.toString()}`;
        console.log("handleReask: 导航URL:", url);
        
        router.push(url);
        console.log("handleReask: 导航完成");
        
      } catch (error) {
        console.error("handleReask: 处理reask事件时出错:", error);
      }
      
      console.log("=== handleReask: 处理完成 ===");
    };

    // 添加事件监听器到window和document
    console.log("添加window事件监听器");
    window.addEventListener('reask', handleReask as EventListener);
    
    console.log("添加document事件监听器");
    document.addEventListener('reask', handleReask as EventListener);

    // 清理函数
    return () => {
      console.log("=== useReaskHandler: 清理事件监听器 ===");
      window.removeEventListener('reask', handleReask as EventListener);
      document.removeEventListener('reask', handleReask as EventListener);
    };
  }, [router, clearConversation]);

  return {
    isHandling: isHandlingRef.current,
  };
}

// 导出类型供其他组件使用
export type { OriginalInput, ReaskHandlerOptions }; 