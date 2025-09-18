// Copyright (c) 2025 YADRA

/**
 * FeedbackSystem - 反馈系统组件
 * 
 * 🔄 替换目标：
 * - ~/components/yadra/feedback-system（旧版本）
 * - 已移除workspace/[traceId]/components/feedback-system
 * 
 * 📍 使用位置：
 * - conversation-panel.tsx - 消息反馈
 * - workspace页面 - 整体反馈
 * - hero-input.tsx - 输入反馈
 * 
 * 🎯 功能特性：
 * - 多种反馈类型
 * - 现代交互动画
 * - 反馈统计展示
 * - 状态持久化
 */

"use client";

import React, { useState, useCallback, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "~/lib/utils";
import { Button } from "~/components/ui/button";
import { Textarea } from "~/components/ui/textarea";
import { 
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger
} from "~/components/ui/dialog";

export type FeedbackType = 
  | "like"        // 点赞
  | "dislike"     // 点踩
  | "rating"      // 评分
  | "text"        // 文字反馈
  | "bug"         // 错误报告
  | "suggestion"  // 建议
  | "question";   // 问题

export interface FeedbackData {
  id: string;
  type: FeedbackType;
  messageId?: string;
  rating?: number; // 1-5
  text?: string;
  category?: string;
  metadata?: {
    userAgent?: string;
    timestamp?: Date;
    sessionId?: string;
    context?: Record<string, any>;
  };
}

interface FeedbackSystemProps {
  messageId?: string;
  variant?: "inline" | "modal" | "sidebar" | "floating";
  showRating?: boolean;
  showTextFeedback?: boolean;
  showCategories?: boolean;
  allowAnonymous?: boolean;
  onFeedback?: (feedback: FeedbackData) => void;
  onClose?: () => void;
  className?: string;
}

// 反馈类别
const FEEDBACK_CATEGORIES = [
  { id: "accuracy", label: "准确性", icon: "🎯" },
  { id: "helpfulness", label: "实用性", icon: "💡" },
  { id: "clarity", label: "清晰度", icon: "📝" },
  { id: "completeness", label: "完整性", icon: "✅" },
  { id: "speed", label: "响应速度", icon: "⚡" },
  { id: "ui", label: "界面体验", icon: "🎨" },
  { id: "other", label: "其他", icon: "💬" }
];

// 评分星星组件
const StarRating: React.FC<{
  rating: number;
  onRatingChange: (rating: number) => void;
  readonly?: boolean;
  size?: "sm" | "md" | "lg";
}> = ({ rating, onRatingChange, readonly = false, size = "md" }) => {
  const [hoverRating, setHoverRating] = useState(0);

  const starSize = {
    sm: "text-sm",
    md: "text-lg",
    lg: "text-xl"
  }[size];

  return (
    <div className="flex items-center gap-1">
      {[1, 2, 3, 4, 5].map((star) => (
        <motion.button
          key={star}
          type="button"
          disabled={readonly}
          className={cn(
            starSize,
            "transition-colors",
            readonly ? "cursor-default" : "cursor-pointer hover:scale-110"
          )}
          whileHover={readonly ? {} : { scale: 1.1 }}
          whileTap={readonly ? {} : { scale: 0.95 }}
          onMouseEnter={() => !readonly && setHoverRating(star)}
          onMouseLeave={() => !readonly && setHoverRating(0)}
          onClick={() => !readonly && onRatingChange(star)}
        >
          <span
            className={cn(
              star <= (hoverRating || rating)
                ? "text-yellow-400"
                : "text-muted-foreground"
            )}
          >
            ⭐
          </span>
        </motion.button>
      ))}
      {rating > 0 && (
        <span className="ml-2 text-sm text-muted-foreground">
          {rating}/5
        </span>
      )}
    </div>
  );
};

// 快速反馈按钮
const QuickFeedbackButtons: React.FC<{
  onFeedback: (type: FeedbackType) => void;
  currentFeedback?: FeedbackType;
}> = ({ onFeedback, currentFeedback }) => {
  return (
    <div className="flex items-center gap-2">
      <motion.button
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        onClick={() => onFeedback("like")}
        className={cn(
          "flex items-center gap-1 px-2 py-1 rounded text-sm transition-colors",
          currentFeedback === "like"
            ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400"
            : "hover:bg-muted"
        )}
      >
        👍 有用
      </motion.button>

      <motion.button
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        onClick={() => onFeedback("dislike")}
        className={cn(
          "flex items-center gap-1 px-2 py-1 rounded text-sm transition-colors",
          currentFeedback === "dislike"
            ? "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400"
            : "hover:bg-muted"
        )}
      >
        👎 无用
      </motion.button>

      <motion.button
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        onClick={() => onFeedback("text")}
        className="flex items-center gap-1 px-2 py-1 rounded text-sm hover:bg-muted transition-colors"
      >
        💬 详细反馈
      </motion.button>
    </div>
  );
};

// 详细反馈表单
const DetailedFeedbackForm: React.FC<{
  initialType?: FeedbackType;
  showRating?: boolean;
  showCategories?: boolean;
  onSubmit: (feedback: Partial<FeedbackData>) => void;
  onCancel: () => void;
}> = ({ initialType, showRating = true, showCategories = true, onSubmit, onCancel }) => {
  const [feedbackType, setFeedbackType] = useState<FeedbackType>(initialType || "text");
  const [rating, setRating] = useState(0);
  const [text, setText] = useState("");
  const [category, setCategory] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    const feedback: Partial<FeedbackData> = {
      type: feedbackType,
      text: text.trim() || undefined,
      rating: showRating && rating > 0 ? rating : undefined,
      category: category || undefined
    };

    onSubmit(feedback);
  };

  const isValid = text.trim().length > 0 || rating > 0;

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {/* 反馈类型选择 */}
      <div>
        <label className="text-sm font-medium mb-2 block">反馈类型</label>
        <div className="grid grid-cols-2 gap-2">
          {[
            { type: "text" as const, label: "一般反馈", icon: "💬" },
            { type: "bug" as const, label: "错误报告", icon: "🐛" },
            { type: "suggestion" as const, label: "改进建议", icon: "💡" },
            { type: "question" as const, label: "疑问", icon: "❓" }
          ].map(({ type, label, icon }) => (
            <button
              key={type}
              type="button"
              onClick={() => setFeedbackType(type)}
              className={cn(
                "flex items-center gap-2 p-2 rounded border text-sm transition-colors",
                feedbackType === type
                  ? "border-primary bg-primary/10"
                  : "border-muted hover:bg-muted/50"
              )}
            >
              <span>{icon}</span>
              <span>{label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* 评分 */}
      {showRating && (
        <div>
          <label className="text-sm font-medium mb-2 block">整体评分</label>
          <StarRating
            rating={rating}
            onRatingChange={setRating}
            size="md"
          />
        </div>
      )}

      {/* 类别选择 */}
      {showCategories && (
        <div>
          <label className="text-sm font-medium mb-2 block">反馈类别</label>
          <div className="grid grid-cols-2 gap-2">
            {FEEDBACK_CATEGORIES.map((cat) => (
              <button
                key={cat.id}
                type="button"
                onClick={() => setCategory(cat.id === category ? "" : cat.id)}
                className={cn(
                  "flex items-center gap-2 p-2 rounded border text-sm transition-colors",
                  category === cat.id
                    ? "border-primary bg-primary/10"
                    : "border-muted hover:bg-muted/50"
                )}
              >
                <span>{cat.icon}</span>
                <span>{cat.label}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* 文字反馈 */}
      <div>
        <label className="text-sm font-medium mb-2 block">详细描述</label>
        <Textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="请详细描述您的反馈..."
          rows={4}
          className="resize-none"
        />
      </div>

      {/* 提交按钮 */}
      <div className="flex gap-2 pt-2">
        <Button
          type="submit"
          disabled={!isValid}
          className="flex-1"
        >
          提交反馈
        </Button>
        <Button
          type="button"
          variant="outline"
          onClick={onCancel}
        >
          取消
        </Button>
      </div>
    </form>
  );
};

export const FeedbackSystem: React.FC<FeedbackSystemProps> = ({
  messageId,
  variant = "inline",
  showRating = true,
  showTextFeedback = true,
  showCategories = true,
  allowAnonymous = true,
  onFeedback,
  onClose,
  className
}) => {
  const [currentFeedback, setCurrentFeedback] = useState<FeedbackType | null>(null);
  const [showDetailedForm, setShowDetailedForm] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [feedbackStats, setFeedbackStats] = useState<Record<string, number>>({});

  // 生成反馈ID
  const generateFeedbackId = () => {
    return `feedback_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  };

  // 处理快速反馈
  const handleQuickFeedback = useCallback(async (type: FeedbackType) => {
    if (currentFeedback === type) {
      // 取消反馈
      setCurrentFeedback(null);
      return;
    }

    setCurrentFeedback(type);

    if (type === "text") {
      setShowDetailedForm(true);
      return;
    }

    // 提交简单反馈
    const feedback: FeedbackData = {
      id: generateFeedbackId(),
      type,
      messageId,
      metadata: {
        timestamp: new Date(),
        userAgent: navigator.userAgent
      }
    };

    try {
      setIsSubmitting(true);
      await onFeedback?.(feedback);
      
      // 更新统计
      setFeedbackStats(prev => ({
        ...prev,
        [type]: (prev[type] || 0) + 1
      }));
    } catch (error) {
      console.error("Failed to submit feedback:", error);
      setCurrentFeedback(null);
    } finally {
      setIsSubmitting(false);
    }
  }, [currentFeedback, messageId, onFeedback]);

  // 处理详细反馈提交
  const handleDetailedFeedback = useCallback(async (feedbackData: Partial<FeedbackData>) => {
    const feedback: FeedbackData = {
      id: generateFeedbackId(),
      messageId,
      ...feedbackData,
      metadata: {
        timestamp: new Date(),
        userAgent: navigator.userAgent,
        ...feedbackData.metadata
      }
    } as FeedbackData;

    try {
      setIsSubmitting(true);
      await onFeedback?.(feedback);
      
      setShowDetailedForm(false);
      setCurrentFeedback(feedback.type);
      
      // 更新统计
      setFeedbackStats(prev => ({
        ...prev,
        [feedback.type]: (prev[feedback.type] || 0) + 1
      }));
    } catch (error) {
      console.error("Failed to submit feedback:", error);
    } finally {
      setIsSubmitting(false);
    }
  }, [messageId, onFeedback]);

  // 内联模式
  if (variant === "inline") {
    return (
      <div className={cn("space-y-2", className)}>
        <QuickFeedbackButtons
          onFeedback={handleQuickFeedback}
          currentFeedback={currentFeedback || undefined}
        />

        <AnimatePresence>
          {showDetailedForm && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              className="overflow-hidden"
            >
              <div className="p-4 border rounded-lg bg-card">
                <DetailedFeedbackForm
                  initialType="text"
                  showRating={showRating}
                  showCategories={showCategories}
                  onSubmit={handleDetailedFeedback}
                  onCancel={() => setShowDetailedForm(false)}
                />
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {isSubmitting && (
          <div className="text-sm text-muted-foreground">
            正在提交反馈...
          </div>
        )}
      </div>
    );
  }

  // 模态框模式
  if (variant === "modal") {
    return (
      <Dialog open={showDetailedForm} onOpenChange={setShowDetailedForm}>
        <DialogTrigger asChild>
          <div className={className}>
            <QuickFeedbackButtons
              onFeedback={handleQuickFeedback}
              currentFeedback={currentFeedback || undefined}
            />
          </div>
        </DialogTrigger>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>提供反馈</DialogTitle>
          </DialogHeader>
          <DetailedFeedbackForm
            showRating={showRating}
            showCategories={showCategories}
            onSubmit={handleDetailedFeedback}
            onCancel={() => setShowDetailedForm(false)}
          />
        </DialogContent>
      </Dialog>
    );
  }

  // 浮动模式
  if (variant === "floating") {
    return (
      <motion.div
        initial={{ opacity: 0, scale: 0.8, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.8, y: 20 }}
        className={cn(
          "fixed bottom-4 right-4 bg-card border rounded-lg shadow-lg p-4 z-50",
          "max-w-sm",
          className
        )}
      >
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-medium text-sm">反馈</h3>
          <Button
            variant="ghost"
            size="sm"
            onClick={onClose}
            className="h-6 w-6 p-0"
          >
            ✕
          </Button>
        </div>

        <QuickFeedbackButtons
          onFeedback={handleQuickFeedback}
          currentFeedback={currentFeedback || undefined}
        />

        <AnimatePresence>
          {showDetailedForm && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              className="mt-3 overflow-hidden"
            >
              <DetailedFeedbackForm
                initialType="text"
                showRating={showRating}
                showCategories={showCategories}
                onSubmit={handleDetailedFeedback}
                onCancel={() => setShowDetailedForm(false)}
              />
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    );
  }

  // 侧边栏模式
  return (
    <motion.div
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 20 }}
      className={cn(
        "w-80 bg-card border-l p-4 h-full overflow-y-auto",
        className
      )}
    >
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold">反馈系统</h3>
          <Button
            variant="ghost"
            size="sm"
            onClick={onClose}
            className="h-6 w-6 p-0"
          >
            ✕
          </Button>
        </div>

        <QuickFeedbackButtons
          onFeedback={handleQuickFeedback}
          currentFeedback={currentFeedback || undefined}
        />

        {/* 反馈统计 */}
        {Object.keys(feedbackStats).length > 0 && (
          <div className="p-3 bg-muted/20 rounded">
            <h4 className="font-medium text-sm mb-2">反馈统计</h4>
            <div className="space-y-1 text-xs">
              {Object.entries(feedbackStats).map(([type, count]) => (
                <div key={type} className="flex justify-between">
                  <span>{type}</span>
                  <span>{count}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        <AnimatePresence>
          {showDetailedForm && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              className="overflow-hidden"
            >
              <DetailedFeedbackForm
                initialType="text"
                showRating={showRating}
                showCategories={showCategories}
                onSubmit={handleDetailedFeedback}
                onCancel={() => setShowDetailedForm(false)}
              />
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  );
};

export default FeedbackSystem; 