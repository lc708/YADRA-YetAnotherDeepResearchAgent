// Copyright (c) 2025 YADRA

"use client";

import { useCallback, useEffect, useRef } from "react";
import { useRouter, usePathname } from "next/navigation";
import { toast } from "sonner";
import { useUnifiedStore } from "~/core/store/unified-store";

interface OriginalInput {
  thread_id: string;
  original_input: string;
}

export function useReaskHandler() {
  const router = useRouter();
  const pathname = usePathname();
  const currentThreadId = useUnifiedStore((state) => state.currentThreadId);
  const clearThread = useUnifiedStore((state) => state.clearThread);
  const originalInputRef = useRef<string | null>(null);

  const handleReaskEvent = useCallback((event: CustomEvent<OriginalInput>) => {
    const { thread_id, original_input } = event.detail;
    
    // 保存原始输入
    originalInputRef.current = original_input;
    
    // 如果在 workspace 页面，导航到新的页面
    if (pathname.startsWith("/workspace/")) {
      // 清除当前会话
      if (currentThreadId) {
        clearThread(currentThreadId);
      }
      
      // 导航到聊天页面，准备新的会话
      router.push("/chat");
      
      // 延迟一下，确保页面已经导航
      setTimeout(() => {
        // 触发新的消息发送
        const inputElement = document.querySelector('textarea[name="message"]') as HTMLTextAreaElement;
        if (inputElement) {
          inputElement.value = original_input;
          inputElement.dispatchEvent(new Event('input', { bubbles: true }));
          
          // 模拟提交
          const form = inputElement.closest('form');
          if (form) {
            form.dispatchEvent(new Event('submit', { bubbles: true }));
      }
        }
      }, 500);
    } else {
      // 如果在聊天页面，直接发送新消息
      const inputElement = document.querySelector('textarea[name="message"]') as HTMLTextAreaElement;
      if (inputElement) {
        inputElement.value = original_input;
        inputElement.dispatchEvent(new Event('input', { bubbles: true }));
        
        // 模拟提交
        const form = inputElement.closest('form');
        if (form) {
          form.dispatchEvent(new Event('submit', { bubbles: true }));
        }
      }
    }
    
    toast.success("正在使用原始输入重新开始研究...");
  }, [router, pathname, currentThreadId, clearThread]);
      
  const handleClearAndRestart = useCallback(() => {
    if (originalInputRef.current) {
      // 清除当前会话
      if (currentThreadId) {
        clearThread(currentThreadId);
      }
      
      // 导航到聊天页面
      router.push("/chat");
      
      // 延迟一下，确保页面已经导航
      setTimeout(() => {
        // 触发新的消息发送
        const inputElement = document.querySelector('textarea[name="message"]') as HTMLTextAreaElement;
        if (inputElement && originalInputRef.current) {
          inputElement.value = originalInputRef.current;
          inputElement.dispatchEvent(new Event('input', { bubbles: true }));
          
          // 模拟提交
          const form = inputElement.closest('form');
          if (form) {
            form.dispatchEvent(new Event('submit', { bubbles: true }));
          }
        }
      }, 500);
      
      toast.success("已清除会话，正在重新开始...");
    } else {
      toast.error("没有找到原始输入");
    }
  }, [router, currentThreadId, clearThread]);

  useEffect(() => {
    // 监听 reask 事件
    const handleEvent = (event: Event) => {
      handleReaskEvent(event as CustomEvent<OriginalInput>);
    };
    
    window.addEventListener("reask", handleEvent);
    
    return () => {
      window.removeEventListener("reask", handleEvent);
    };
  }, [handleReaskEvent]);

  // 监听键盘快捷键
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      // Cmd/Ctrl + Shift + R 清除并重新开始
      if ((event.metaKey || event.ctrlKey) && event.shiftKey && event.key === 'R') {
        event.preventDefault();
        handleClearAndRestart();
      }
    };
    
    window.addEventListener("keydown", handleKeyDown);
    
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [handleClearAndRestart]);

  return {
    originalInput: originalInputRef.current,
    handleClearAndRestart,
  };
}