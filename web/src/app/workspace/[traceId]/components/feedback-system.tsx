// Copyright (c) 2025 YADRA

"use client";

import { AnimatePresence, motion } from "framer-motion";
import { X, MessageCircle, ThumbsUp, ThumbsDown, AlertCircle } from "lucide-react";
import { useCallback } from "react";

import { Button } from "~/components/ui/button";
import { Card, CardContent } from "~/components/ui/card";
import type { Option } from "~/core/messages";
import { cn } from "~/lib/utils";

interface FeedbackSystemProps {
  feedback?: { option: Option } | null;
  onRemoveFeedback?: () => void;
  className?: string;
  variant?: "compact" | "full";
}

export function FeedbackSystem({
  feedback,
  onRemoveFeedback,
  className,
  variant = "compact",
}: FeedbackSystemProps) {
  const handleRemoveFeedback = useCallback(() => {
    onRemoveFeedback?.();
  }, [onRemoveFeedback]);

  const getFeedbackIcon = (optionValue: string) => {
    switch (optionValue) {
      case "accepted":
        return <ThumbsUp className="h-4 w-4" />;
      case "rejected":
        return <ThumbsDown className="h-4 w-4" />;
      case "edit":
        return <MessageCircle className="h-4 w-4" />;
      default:
        return <AlertCircle className="h-4 w-4" />;
    }
  };

  const getFeedbackColor = (optionValue: string) => {
    switch (optionValue) {
      case "accepted":
        return "border-green-500 bg-green-50 text-green-700 dark:bg-green-950 dark:text-green-300";
      case "rejected":
        return "border-red-500 bg-red-50 text-red-700 dark:bg-red-950 dark:text-red-300";
      case "edit":
        return "border-blue-500 bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-300";
      default:
        return "border-brand bg-brand/10 text-brand";
    }
  };

  if (!feedback) return null;

  if (variant === "compact") {
    return (
      <AnimatePresence>
        <motion.div
          className={cn(
            "flex items-center justify-center gap-2 rounded-2xl border px-3 py-1.5",
            getFeedbackColor(feedback.option.value),
            className
          )}
          initial={{ opacity: 0, scale: 0.8, y: -10 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.8, y: -10 }}
          transition={{ duration: 0.2, ease: "easeInOut" }}
        >
          {getFeedbackIcon(feedback.option.value)}
          <span className="text-sm font-medium">
            {feedback.option.text}
          </span>
          <Button
            variant="ghost"
            size="sm"
            className="h-5 w-5 p-0 opacity-60 hover:opacity-100"
            onClick={handleRemoveFeedback}
          >
            <X className="h-3 w-3" />
          </Button>
        </motion.div>
      </AnimatePresence>
    );
  }

  return (
    <AnimatePresence>
      <motion.div
        className={cn("w-full", className)}
        initial={{ opacity: 0, height: 0 }}
        animate={{ opacity: 1, height: "auto" }}
        exit={{ opacity: 0, height: 0 }}
        transition={{ duration: 0.3, ease: "easeInOut" }}
      >
        <Card className={cn("border-l-4", getFeedbackColor(feedback.option.value))}>
          <CardContent className="flex items-center justify-between p-4">
            <div className="flex items-center gap-3">
              {getFeedbackIcon(feedback.option.value)}
              <div>
                <h4 className="font-semibold">反馈已记录</h4>
                <p className="text-sm text-muted-foreground">
                  您的反馈: <span className="font-medium">{feedback.option.text}</span>
                </p>
              </div>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleRemoveFeedback}
              className="opacity-60 hover:opacity-100"
            >
              <X className="h-4 w-4" />
              <span className="ml-1">清除</span>
            </Button>
          </CardContent>
        </Card>
      </motion.div>
    </AnimatePresence>
  );
}

interface FeedbackOptionsProps {
  options: Option[];
  onFeedback: (feedback: { option: Option }) => void;
  disabled?: boolean;
  className?: string;
}

export function FeedbackOptions({
  options,
  onFeedback,
  disabled = false,
  className,
}: FeedbackOptionsProps) {
  const handleOptionClick = useCallback(
    (option: Option) => {
      if (!disabled) {
        onFeedback({ option });
      }
    },
    [onFeedback, disabled]
  );

  return (
    <motion.div
      className={cn("flex gap-2", className)}
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay: 0.3 }}
    >
      {options.map((option) => (
        <Button
          key={option.value}
          variant={option.value === "accepted" ? "default" : "outline"}
          size="sm"
          disabled={disabled}
          onClick={() => handleOptionClick(option)}
          className="gap-2"
        >
          {option.value === "accepted" && <ThumbsUp className="h-3 w-3" />}
          {option.value === "rejected" && <ThumbsDown className="h-3 w-3" />}
          {option.value === "edit" && <MessageCircle className="h-3 w-3" />}
          {option.text}
        </Button>
      ))}
    </motion.div>
  );
} 