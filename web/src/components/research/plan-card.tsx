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

// 步骤优先级颜色 - 保留但不使用
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

// 复杂度指示器 - 简化版本
const ComplexityIndicator: React.FC<{ complexity: ResearchPlan["complexity"] }> = ({ complexity }) => {
  const getComplexityConfig = () => {
    switch (complexity) {
      case "simple":
        return { color: "text-green-700", bgColor: "bg-green-600", dots: 1, label: "简单" };
      case "moderate":
        return { color: "text-blue-700", bgColor: "bg-blue-600", dots: 2, label: "中等" };
      case "complex":
        return { color: "text-orange-700", bgColor: "bg-orange-600", dots: 3, label: "复杂" };
      case "expert":
        return { color: "text-red-700", bgColor: "bg-red-600", dots: 4, label: "专家级" };
    }
  };

  const config = getComplexityConfig();

  return (
    <div className="flex items-center gap-1">
      <div className="flex items-center gap-0.5">
        {[...Array(4)].map((_, i) => (
          <div
            key={i}
            className={cn(
              "w-1.5 h-1.5 rounded-full",
              i < config.dots ? config.bgColor : "bg-gray-200"
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

// 计划步骤组件 - 简化版本
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
        <div className="absolute left-4 -top-2 w-0.5 h-2 bg-gray-300/60" />
      )}

      <div className="flex items-start gap-3 p-3 rounded-lg border border-slate-200 bg-slate-50 hover:bg-slate-100 hover:border-slate-300 transition-colors">
        {/* 步骤编号 */}
        <div className="flex-shrink-0 w-7 h-7 rounded-full bg-blue-600 text-white flex items-center justify-center text-xs font-bold shadow-md">
          {index + 1}
        </div>

        {/* 步骤内容 */}
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2 mb-1">
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
                <h4 className="font-semibold text-sm text-gray-900">{step.title}</h4>
              )}
            </div>

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
              className="text-sm leading-relaxed"
            />
          )}
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
    <div className="p-4 border-t border-slate-200 bg-gradient-to-r from-slate-50 to-white">
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

  // 🔥 新增：根据步骤数计算预估时间 x = n * 0.5 + 0.5
  const calculateEstimatedTime = (stepCount: number) => {
    return stepCount * 0.5 + 0.5; // 每个步骤0.5分钟 + 出具报告0.5分钟
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className={cn(
        "bg-white border-2 border-slate-200 rounded-xl overflow-hidden shadow-lg",
        "hover:shadow-xl hover:border-slate-300 transition-all duration-300",
        isApproved && "border-emerald-300 bg-emerald-50",
        isRejected && "border-red-300 bg-red-50",
        isPending && "border-blue-400 bg-blue-50",
        className
      )}
    >
      {/* 卡片头部 */}
      <div className="p-4 border-b border-slate-200 bg-gradient-to-r from-slate-50 to-white plan-card-content">
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between gap-2 mb-2">
              <div className="flex items-center gap-2">
                <h3 className="font-bold text-lg text-gray-900">{plan.title}</h3>
                <StatusBadge 
                  status={plan.status} 
                  size="sm"
                  showPulse={isPending}
                />
              </div>
              
              {/* 🔥 新增：复杂度、时间、工具信息移到标题行右侧 */}
              <div className="flex items-center gap-3">
                {/* 复杂度指示器 */}
                <ComplexityIndicator complexity={plan.complexity} />
                
                {/* 预计时间 */}
                <span className="text-xs font-medium text-gray-700">
                  ⏱️ {formatDuration(calculateEstimatedTime(plan.steps.length))}
                </span>
                
                {/* 工具信息 */}
                {showMetadata && plan.metadata?.tools && (
                  <span className="text-xs font-medium text-gray-700">
                    🔧 {plan.metadata.tools.join(", ")}
                  </span>
                )}
              </div>
            </div>

            <MarkdownRenderer
              content={plan.objective}
              variant="compact"
              className="text-sm leading-relaxed"
            />
          </div>

          {/* 展开按钮 */}
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setIsExpanded(!isExpanded)}
            className="h-8 w-8 p-0 hover:bg-muted/80 text-muted-foreground flex-shrink-0"
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
            <div className="p-4 plan-card-content">
              <div className="space-y-2">
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