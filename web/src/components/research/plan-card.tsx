// Copyright (c) 2025 YADRA

/**
 * PlanCard - 计划展示卡片组件
 * 
 * 🔄 替换目标：
 * - ~/components/yadra/plan-card（旧版本）
 * - ~/app/chat/components/plan-card（废弃版本）
 * 
 * 📍 使用位置：
 * - conversation-panel.tsx - 计划展示和审批
 * - workspace页面 - 计划管理
 * 
 * 🎯 功能特性：
 * - 交互式计划审批
 * - 内联编辑功能
 * - 版本对比显示
 * - 快速操作按钮
 */

"use client";

import React, { useState, useCallback, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "~/lib/utils";
import { Button } from "~/components/ui/button";
import { Textarea } from "~/components/ui/textarea";
import StatusBadge, { type StatusType } from "../conversation/status-badge";
import MarkdownRenderer from "../conversation/markdown-renderer";

export interface PlanStep {
  id: string;
  title: string;
  description: string;
  estimatedTime?: number;
  dependencies?: string[];
  priority: "low" | "medium" | "high" | "critical";
  status?: StatusType;
}

export interface ResearchPlan {
  id: string;
  title: string;
  objective: string;
  steps: PlanStep[];
  status: StatusType;
  estimatedDuration?: number;
  complexity: "simple" | "moderate" | "complex" | "expert";
  confidence: number; // 0-1
  createdAt: Date;
  updatedAt?: Date;
  version: number;
  previousVersions?: ResearchPlan[];
  metadata?: {
    sources?: number;
    tools?: string[];
    keywords?: string[];
  };
}

interface PlanCardProps {
  plan: ResearchPlan;
  variant?: "default" | "compact" | "detailed";
  isEditable?: boolean;
  showActions?: boolean;
  showMetadata?: boolean;
  onApprove?: (planId: string) => void;
  onModify?: (planId: string, modifications: string) => void;
  onReject?: (planId: string, reason: string) => void;
  onEdit?: (planId: string, newPlan: Partial<ResearchPlan>) => void;
  onSkipToReport?: (planId: string) => void;
  onReask?: (planId: string) => void;
  className?: string;
}

// 步骤优先级颜色
const getPriorityColor = (priority: PlanStep["priority"]) => {
  switch (priority) {
    case "critical":
      return "bg-red-50 text-red-700 border-red-200";
    case "high":
      return "bg-orange-50 text-orange-700 border-orange-200";
    case "medium":
      return "bg-blue-50 text-blue-700 border-blue-200";
    case "low":
      return "bg-muted text-muted-foreground border-border";
    default:
      return "bg-muted text-muted-foreground border-border";
  }
};

// 复杂度指示器
const ComplexityIndicator: React.FC<{ complexity: ResearchPlan["complexity"] }> = ({ complexity }) => {
  const getComplexityConfig = () => {
    switch (complexity) {
      case "simple":
        return { color: "text-green-600", dots: 1, label: "简单" };
      case "moderate":
        return { color: "text-blue-600", dots: 2, label: "中等" };
      case "complex":
        return { color: "text-orange-600", dots: 3, label: "复杂" };
      case "expert":
        return { color: "text-red-600", dots: 4, label: "专家级" };
    }
  };

  const config = getComplexityConfig();

  return (
    <div className="flex items-center gap-1">
      <span className="text-xs text-muted-foreground">复杂度:</span>
      <div className="flex items-center gap-0.5">
        {[...Array(4)].map((_, i) => (
          <div
            key={i}
            className={cn(
              "w-1.5 h-1.5 rounded-full",
              i < config.dots ? config.color.replace("text-", "bg-") : "bg-muted"
            )}
          />
        ))}
      </div>
      <span className={cn("text-xs font-medium", config.color)}>
        {config.label}
      </span>
    </div>
  );
};

// 计划步骤组件
const PlanStepItem: React.FC<{
  step: PlanStep;
  index: number;
  isEditable: boolean;
  onEdit?: (stepId: string, newStep: Partial<PlanStep>) => void;
}> = ({ step, index, isEditable, onEdit }) => {
  const [isEditing, setIsEditing] = useState(false);
  const [editedTitle, setEditedTitle] = useState(step.title);
  const [editedDescription, setEditedDescription] = useState(step.description);

  const handleSave = () => {
    onEdit?.(step.id, {
      title: editedTitle,
      description: editedDescription
    });
    setIsEditing(false);
  };

  const handleCancel = () => {
    setEditedTitle(step.title);
    setEditedDescription(step.description);
    setIsEditing(false);
  };

  return (
    <motion.div
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.3, delay: index * 0.1 }}
      className="relative"
    >
      {/* 连接线 */}
      {index > 0 && (
        <div className="absolute left-4 -top-4 w-0.5 h-4 bg-gray-300/60" />
      )}

      <div className="flex items-start gap-3 p-3 rounded-lg border border-border bg-muted hover:bg-muted/80 transition-colors">
        {/* 步骤编号 */}
        <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary text-white flex items-center justify-center text-sm font-medium shadow-sm">
          {index + 1}
        </div>

        {/* 步骤内容 */}
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2 mb-2">
            <div className="flex-1">
              {isEditing ? (
                <input
                  type="text"
                  value={editedTitle}
                  onChange={(e) => setEditedTitle(e.target.value)}
                  className="w-full p-1 text-sm font-medium bg-background border border-input rounded focus:ring-2 focus:ring-ring focus:border-transparent"
                  autoFocus
                />
              ) : (
                <h4 className="font-medium text-sm text-foreground">{step.title}</h4>
              )}
            </div>

            <div className="flex items-center gap-1">
              {/* 优先级标签 */}
              <span className={cn(
                "px-2 py-0.5 rounded text-xs",
                getPriorityColor(step.priority)
              )}>
                {step.priority}
              </span>

              {/* 状态徽章 */}
              {step.status && (
                <StatusBadge status={step.status} size="sm" />
              )}

              {/* 编辑按钮 */}
              {isEditable && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setIsEditing(!isEditing)}
                  className="h-6 w-6 p-0"
                >
                  {isEditing ? "💾" : "✏️"}
                </Button>
              )}
            </div>
          </div>

          {/* 步骤描述 */}
          {isEditing ? (
            <div className="space-y-2">
              <Textarea
                value={editedDescription}
                onChange={(e) => setEditedDescription(e.target.value)}
                className="text-sm"
                rows={3}
              />
              <div className="flex gap-2">
                <Button size="sm" onClick={handleSave}>保存</Button>
                <Button size="sm" variant="outline" onClick={handleCancel}>取消</Button>
              </div>
            </div>
          ) : (
            <MarkdownRenderer
              content={step.description}
              variant="compact"
              className="text-sm"
            />
          )}

          {/* 估计时间和依赖 */}
          <div className="flex items-center gap-4 mt-2 text-xs text-gray-500">
            {step.estimatedTime && (
              <span>⏱️ {step.estimatedTime}分钟</span>
            )}
            {step.dependencies && step.dependencies.length > 0 && (
              <span>🔗 依赖 {step.dependencies.length} 个步骤</span>
            )}
          </div>
        </div>
      </div>
    </motion.div>
  );
};

// 计划操作按钮
const PlanActions: React.FC<{
  plan: ResearchPlan;
  onApprove?: (planId: string) => void;
  onModify?: (planId: string, modifications: string) => void;
  onReject?: (planId: string, reason: string) => void;
  onSkipToReport?: (planId: string) => void;
  onReask?: (planId: string) => void;
}> = ({ plan, onApprove, onModify, onReject, onSkipToReport, onReask }) => {
  const [showModifyInput, setShowModifyInput] = useState(false);
  const [modifications, setModifications] = useState("");

  const handleModify = () => {
    if (modifications.trim()) {
      onModify?.(plan.id, modifications);
      setModifications("");
      setShowModifyInput(false);
    }
  };

  return (
    <div className="p-4 border-t border-gray-200/50 bg-gradient-to-r from-gray-50/60 to-white/80">
      <AnimatePresence mode="wait">
        {!showModifyInput ? (
          <motion.div
            key="actions"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="space-y-3"
          >
            {/* 主要操作按钮 */}
            <div className="flex items-center gap-2">
              <Button
                onClick={() => onApprove?.(plan.id)}
                className="flex-1"
                size="sm"
              >
                🚀 开始研究
              </Button>
              <Button
                onClick={() => onSkipToReport?.(plan.id)}
                variant="outline"
                size="sm"
                className="flex-1"
              >
                📊 立即输出报告
              </Button>
            </div>
            
            {/* 次要操作按钮 */}
            <div className="flex items-center gap-2">
              <Button
                onClick={() => setShowModifyInput(true)}
                variant="outline"
                size="sm"
                className="flex-1"
              >
                ✏️ 编辑计划
              </Button>
              <Button
                onClick={() => onReask?.(plan.id)}
                variant="outline"
                size="sm"
                className="flex-1"
              >
                🔄 重新提问
              </Button>
            </div>
          </motion.div>
        ) : (
          <motion.div
            key="modify"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="space-y-3"
          >
            <h4 className="text-sm font-medium">修改建议</h4>
            <Textarea
              value={modifications}
              onChange={(e) => setModifications(e.target.value)}
              placeholder="请描述需要修改的内容..."
              rows={3}
            />
            <div className="flex gap-2">
              <Button onClick={handleModify} size="sm">提交修改</Button>
              <Button 
                onClick={() => setShowModifyInput(false)} 
                variant="outline" 
                size="sm"
              >
                取消
              </Button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export const PlanCard: React.FC<PlanCardProps> = ({
  plan,
  variant = "default",
  isEditable = false,
  showActions = true,
  showMetadata = true,
  onApprove,
  onModify,
  onReject,
  onEdit,
  onSkipToReport,
  onReask,
  className
}) => {
  const [isExpanded, setIsExpanded] = useState(variant === "detailed");

  const isPending = plan.status === "pending";
  const isApproved = plan.status === "completed";
  const isRejected = plan.status === "error";

  const formatDuration = (minutes: number) => {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    if (hours > 0) return `${hours}h ${mins}m`;
    return `${mins}m`;
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className={cn(
        "bg-background border border-border rounded-lg overflow-hidden shadow-sm",
        "hover:shadow-md hover:border-border-dark transition-all duration-300",
        isApproved && "border-green-300 bg-green-50",
        isRejected && "border-red-300 bg-red-50",
        isPending && "border-blue-300 bg-blue-50",
        className
      )}
    >
      {/* 卡片头部 */}
      <div className="p-4 border-b border-border/50 bg-gradient-to-r from-muted/80 to-background/90">
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-2">
              <h3 className="font-semibold text-base text-foreground">{plan.title}</h3>
              <StatusBadge 
                status={plan.status} 
                size="sm"
                showPulse={isPending}
              />
            </div>

            <MarkdownRenderer
              content={plan.objective}
              variant="compact"
              className="text-sm text-muted-foreground mb-3"
            />

            {/* 计划统计 */}
            <div className="flex items-center gap-4 text-xs text-muted-foreground">
              <span>📋 {plan.steps.length} 个步骤</span>
              {plan.estimatedDuration && (
                <span>⏱️ 预计 {formatDuration(plan.estimatedDuration)}</span>
              )}
              <span>🎯 置信度 {Math.round(plan.confidence * 100)}%</span>
            </div>

            {showMetadata && (
              <div className="flex items-center gap-4 mt-2">
                <ComplexityIndicator complexity={plan.complexity} />
                {plan.version > 1 && (
                  <span className="text-xs text-muted-foreground">
                    v{plan.version}
                  </span>
                )}
              </div>
            )}
          </div>

          {/* 展开按钮 */}
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setIsExpanded(!isExpanded)}
            className="h-8 w-8 p-0 hover:bg-muted/80 text-muted-foreground"
          >
            <motion.div
              animate={{ rotate: isExpanded ? 180 : 0 }}
              transition={{ duration: 0.2 }}
            >
              ▼
            </motion.div>
          </Button>
        </div>
      </div>

      {/* 展开内容 */}
      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.3 }}
            className="overflow-hidden"
          >
            {/* 计划步骤 */}
            <div className="p-4">
              <h4 className="font-medium text-sm mb-4 text-foreground">执行步骤</h4>
              <div className="space-y-3">
                {plan.steps.map((step, index) => (
                  <PlanStepItem
                    key={step.id}
                    step={step}
                    index={index}
                    isEditable={isEditable}
                    onEdit={(stepId, newStep) => {
                      // 更新步骤逻辑
                      const updatedSteps = plan.steps.map(s => 
                        s.id === stepId ? { ...s, ...newStep } : s
                      );
                      onEdit?.(plan.id, { steps: updatedSteps });
                    }}
                  />
                ))}
              </div>
            </div>

            {/* 元数据 */}
            {showMetadata && plan.metadata && (
              <div className="p-4 border-t border-border/40 bg-muted/40">
                <h4 className="font-medium text-sm mb-2 text-foreground">计划详情</h4>
                <div className="grid grid-cols-2 gap-4 text-xs">
                  {plan.metadata.sources && (
                    <div>
                      <span className="text-muted-foreground">数据源: </span>
                      <span className="font-medium text-foreground">{plan.metadata.sources} 个</span>
                    </div>
                  )}
                  {plan.metadata.tools && (
                    <div>
                      <span className="text-muted-foreground">工具: </span>
                      <span className="font-medium text-foreground">{plan.metadata.tools.join(", ")}</span>
                    </div>
                  )}
                  {plan.metadata.keywords && (
                    <div className="col-span-2">
                      <span className="text-muted-foreground">关键词: </span>
                      <div className="flex flex-wrap gap-1 mt-1">
                        {plan.metadata.keywords.map((keyword, index) => (
                          <span 
                            key={index}
                            className="px-2 py-0.5 bg-muted border border-border rounded text-xs text-muted-foreground"
                          >
                            {keyword}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* 操作按钮 */}
            {showActions && isPending && (
              <PlanActions
                plan={plan}
                onApprove={onApprove}
                onModify={onModify}
                onReject={onReject}
                onSkipToReport={onSkipToReport}
                onReask={onReask}
              />
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
};

export default PlanCard; 