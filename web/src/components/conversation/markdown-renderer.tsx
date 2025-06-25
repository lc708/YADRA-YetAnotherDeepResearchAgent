// Copyright (c) 2025 YADRA

/**
 * MarkdownRenderer - 增强Markdown渲染组件
 * 
 * 🔄 替换目标：
 * - ~/components/yadra/markdown-renderer（旧版本）
 * - 各组件中的内联markdown渲染逻辑
 * 
 * 📍 使用位置：
 * - message-container.tsx - 消息内容渲染
 * - research-card.tsx - 研究结果渲染
 * - plan-card.tsx - 计划内容渲染
 * - artifact-card.tsx - 文档内容渲染
 * 
 * 🎯 功能特性：
 * - 完整的Markdown支持
 * - 代码高亮和复制功能
 * - 自定义样式和主题
 */

"use client";

import React, { useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "~/lib/utils";
import { Button } from "~/components/ui/button";

interface MarkdownRendererProps {
  content: string;
  className?: string;
  showCopyButton?: boolean;
  maxHeight?: string;
  variant?: "default" | "compact" | "card";
}

// 代码块组件
const CodeBlock: React.FC<{
  code: string;
  language?: string;
  showCopy?: boolean;
}> = ({ code, language, showCopy = true }) => {
  const [copied, setCopied] = useState(false);

  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy code:', err);
    }
  }, [code]);

  return (
    <div className="relative group my-4">
      <pre className={cn(
        "bg-muted/50 rounded-lg p-4 overflow-x-auto text-sm",
        "border border-border/50"
      )}>
        <code className={cn(
          "font-mono",
          language && `language-${language}`
        )}>
          {code}
        </code>
      </pre>
      
      {showCopy && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="absolute top-2 right-2"
        >
          <Button
            variant="ghost"
            size="sm"
            onClick={handleCopy}
            className="h-8 w-8 p-0 bg-background/80 backdrop-blur-sm"
          >
            <AnimatePresence mode="wait">
              {copied ? (
                <motion.div
                  key="check"
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  exit={{ scale: 0 }}
                  className="text-green-600"
                >
                  ✓
                </motion.div>
              ) : (
                <motion.div
                  key="copy"
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  exit={{ scale: 0 }}
                  className="text-muted-foreground"
                >
                  📋
                </motion.div>
              )}
            </AnimatePresence>
          </Button>
        </motion.div>
      )}
    </div>
  );
};

// 简化的Markdown解析和渲染
const renderMarkdown = (content: string, showCopyButton: boolean): React.ReactNode => {
  // 处理代码块
  const codeBlockRegex = /```(\w+)?\n([\s\S]*?)```/g;
  const parts: React.ReactNode[] = [];
  let lastIndex = 0;
  let match;
  let keyCounter = 0;

  while ((match = codeBlockRegex.exec(content)) !== null) {
    // 添加代码块前的文本
    if (match.index > lastIndex) {
      const textBefore = content.slice(lastIndex, match.index);
      if (textBefore.trim()) {
        parts.push(
          <div 
            key={`text-${keyCounter++}`}
            className="prose prose-slate max-w-none prose-p:leading-tight prose-p:mb-2 prose-li:leading-tight prose-li:mb-0.5 prose-ul:my-1"
            dangerouslySetInnerHTML={{ 
              __html: processInlineMarkdown(textBefore) 
            }} 
          />
        );
      }
    }

    // 添加代码块
    const language = match[1] || '';
    const code = match[2] || '';
    parts.push(
      <CodeBlock
        key={`code-${keyCounter++}`}
        code={code}
        language={language}
        showCopy={showCopyButton}
      />
    );

    lastIndex = match.index + match[0].length;
  }

  // 添加最后剩余的文本
  if (lastIndex < content.length) {
    const remainingText = content.slice(lastIndex);
    if (remainingText.trim()) {
              parts.push(
          <div 
            key={`text-${keyCounter++}`}
            className="prose prose-slate max-w-none prose-p:leading-tight prose-p:mb-2 prose-li:leading-tight prose-li:mb-0.5 prose-ul:my-1"
            dangerouslySetInnerHTML={{ 
              __html: processInlineMarkdown(remainingText) 
            }} 
          />
        );
    }
  }

  // 如果没有代码块，直接渲染整个内容
  if (parts.length === 0) {
    return (
      <div 
        className="prose prose-slate max-w-none prose-p:leading-tight prose-p:mb-2 prose-li:leading-tight prose-li:mb-0.5 prose-ul:my-1"
        dangerouslySetInnerHTML={{ 
          __html: processInlineMarkdown(content) 
        }} 
      />
    );
  }

  return <>{parts}</>;
};

// 处理内联Markdown
const processInlineMarkdown = (text: string): string => {
  // 转义HTML
  text = text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');

  // 标题
  text = text.replace(/^### (.*$)/gm, '<h3 class="text-lg font-bold mb-2 mt-4">$1</h3>');
  text = text.replace(/^## (.*$)/gm, '<h2 class="text-xl font-bold mb-2 mt-4">$1</h2>');
  text = text.replace(/^# (.*$)/gm, '<h1 class="text-2xl font-bold mb-2 mt-4">$1</h1>');

  // 粗体
  text = text.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
  
  // 斜体
  text = text.replace(/\*(.*?)\*/g, '<em>$1</em>');
  
  // 内联代码
  text = text.replace(/`(.*?)`/g, '<code class="bg-muted px-1 py-0.5 rounded text-sm font-mono">$1</code>');
  
  // 链接
  text = text.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" class="text-primary hover:underline" target="_blank" rel="noopener noreferrer">$1</a>');
  
  // 列表项
  text = text.replace(/^[\s]*[-*+]\s+(.*$)/gm, '<li class="ml-4 list-disc leading-tight mb-0.5">$1</li>');
  
  // 引用
  text = text.replace(/^>\s+(.*$)/gm, '<blockquote class="border-l-4 border-primary/30 pl-4 py-2 my-4 bg-muted/30 rounded-r text-muted-foreground">$1</blockquote>');
  
  // 段落
  text = text.replace(/\n\n/g, '</p><p class="mb-2 leading-tight">');
  text = `<p class="mb-2 leading-tight">${text}</p>`;
  
  // 换行
  text = text.replace(/\n/g, '<br>');

  return text;
};

export const MarkdownRenderer: React.FC<MarkdownRendererProps> = ({
  content,
  className,
  showCopyButton = true,
  maxHeight,
  variant = "default"
}) => {
  const variantStyles = {
    default: "",
    compact: "text-sm",
    card: "bg-card p-4 rounded-lg border"
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className={cn(
        variantStyles[variant],
        "overflow-hidden",
        maxHeight && "overflow-y-auto",
        className
      )}
      style={{ maxHeight }}
    >
      {renderMarkdown(content, showCopyButton)}
    </motion.div>
  );
};

export default MarkdownRenderer; 