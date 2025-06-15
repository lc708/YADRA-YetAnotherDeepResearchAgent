// Copyright (c) 2025 YADRA

"use client";

import { HelpCircle, MessageCircle, ThumbsUp, ThumbsDown, Zap } from "lucide-react";
import { useState } from "react";

import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "~/components/ui/collapsible";
import { cn } from "~/lib/utils";

interface UserGuideProps {
  className?: string;
}

export function UserGuide({ className }: UserGuideProps) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <Card className={cn("border-blue-200 bg-blue-50/50 dark:border-blue-800 dark:bg-blue-950/50", className)}>
      <Collapsible open={isOpen} onOpenChange={setIsOpen}>
        <CollapsibleTrigger asChild>
          <CardHeader className="cursor-pointer hover:bg-blue-100/50 dark:hover:bg-blue-900/50 transition-colors">
            <CardTitle className="flex items-center justify-between text-sm">
              <div className="flex items-center gap-2">
                <HelpCircle className="h-4 w-4 text-blue-600" />
                <span>反馈和中断系统使用指南</span>
                <Badge variant="secondary" className="text-xs">1.3 新功能</Badge>
              </div>
              <Button variant="ghost" size="sm" className="h-6 w-6 p-0">
                {isOpen ? "−" : "+"}
              </Button>
            </CardTitle>
          </CardHeader>
        </CollapsibleTrigger>
        
        <CollapsibleContent>
          <CardContent className="space-y-4 text-sm">
            <div className="space-y-3">
              <div className="flex items-start gap-3">
                <div className="flex h-6 w-6 items-center justify-center rounded-full bg-green-100 dark:bg-green-900">
                  <ThumbsUp className="h-3 w-3 text-green-600" />
                </div>
                <div>
                  <h4 className="font-medium">接受计划</h4>
                  <p className="text-muted-foreground">
                    当AI生成研究计划后，点击"接受"或"开始研究"按钮来启动研究流程。
                  </p>
                </div>
              </div>
              
              <div className="flex items-start gap-3">
                <div className="flex h-6 w-6 items-center justify-center rounded-full bg-blue-100 dark:bg-blue-900">
                  <MessageCircle className="h-3 w-3 text-blue-600" />
                </div>
                <div>
                  <h4 className="font-medium">编辑计划</h4>
                  <p className="text-muted-foreground">
                    点击"编辑计划"按钮可以提供修改建议，AI会根据您的反馈调整研究计划。
                  </p>
                </div>
              </div>
              
              <div className="flex items-start gap-3">
                <div className="flex h-6 w-6 items-center justify-center rounded-full bg-red-100 dark:bg-red-900">
                  <ThumbsDown className="h-3 w-3 text-red-600" />
                </div>
                <div>
                  <h4 className="font-medium">拒绝计划</h4>
                  <p className="text-muted-foreground">
                    如果计划不符合预期，可以拒绝并要求AI重新生成计划。
                  </p>
                </div>
              </div>
              
              <div className="flex items-start gap-3">
                <div className="flex h-6 w-6 items-center justify-center rounded-full bg-orange-100 dark:bg-orange-900">
                  <Zap className="h-3 w-3 text-orange-600" />
                </div>
                <div>
                  <h4 className="font-medium">中断研究</h4>
                  <p className="text-muted-foreground">
                    在研究过程中，您可以随时提供反馈来调整研究方向或停止当前操作。
                  </p>
                </div>
              </div>
            </div>
            
            <div className="rounded-lg bg-blue-100/50 dark:bg-blue-900/50 p-3">
              <h4 className="font-medium text-blue-800 dark:text-blue-200 mb-2">💡 使用提示</h4>
              <ul className="space-y-1 text-blue-700 dark:text-blue-300 text-xs">
                <li>• 反馈会在您发送下一条消息时一起发送给AI</li>
                <li>• 您可以在输入框上方看到当前的反馈状态</li>
                <li>• 点击反馈标签旁的 × 可以取消反馈</li>
                <li>• 如果按钮显示为灰色，请等待AI完成当前操作</li>
              </ul>
            </div>
          </CardContent>
        </CollapsibleContent>
      </Collapsible>
    </Card>
  );
} 