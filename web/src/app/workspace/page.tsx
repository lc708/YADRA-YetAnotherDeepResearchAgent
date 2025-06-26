"use client";

import { useState, useCallback, useMemo, useEffect } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { cn } from "~/lib/utils";
import { useShallow } from "zustand/react/shallow";
import { toast } from "sonner";

import { Button } from "~/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import { Input } from "~/components/ui/input";
import { Badge } from "~/components/ui/badge";
import { Textarea } from "~/components/ui/textarea";
import {
  MessageSquare,
  FileText,
  Activity,
  Headphones,
  X,
} from "lucide-react";

import { 
  useUnifiedStore, 
  useThreadMessages,
  sendAskMessage,
  useCurrentPlan,
  useCurrentInterrupt,
  useFinalReport
} from "~/core/store";
import type { ResearchRequest, BusinessPlan, BusinessPlanStep } from "~/core/store";

import { OutputStream } from "~/app/workspace/components/output-stream";
import { PlanCard } from "~/components/research/plan-card";
import type { ResearchPlan } from "~/components/research/plan-card";
import { MessageContainer } from "~/components/conversation/message-container";
import { ScrollContainer } from "~/components/conversation/scroll-container";
import { LoadingAnimation } from "~/components/conversation/loading-animation";
import { MarkdownRenderer } from "~/components/conversation/markdown-renderer";
import { HeroInput } from "~/components/yadra/hero-input";
import ReportViewer from "~/components/editor/report-viewer";

// 消息类型定义
interface Message {
  id: string;
  content: string;
  role: 'user' | 'assistant';
  timestamp: Date;
}

// 布局模式枚举
enum LayoutMode {
  WELCOME = 'welcome',
  CHAT_ONLY = 'chat_only',      // 新增：仅聊天模式
  CHAT_WITH_ARTIFACTS = 'chat_with_artifacts'  // 新增：聊天+工件模式
}

// 🔥 稳定的空数组引用，避免useShallow无限循环
const EMPTY_MESSAGES: any[] = [];

export default function WorkspacePage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  
  // 🔥 获取URL参数
  const urlParam = searchParams.get('id');
  
  // 🔥 修复：使用稳定的空数组引用，避免无限循环
  
  const { currentThreadId, hasMessages } = useUnifiedStore(
    useShallow((state) => {
      let threadId = null;
      
      if (urlParam) {
        threadId = state.getThreadIdByUrlParam(urlParam);
      } else {
        threadId = state.currentThreadId;
      }
      
      const thread = threadId ? state.getThread(threadId) : null;
      const messages = thread?.messages || EMPTY_MESSAGES;
      
      return {
        currentThreadId: threadId,
        hasMessages: messages.length > 0
      };
    })
  );
  
  // 输出流弹窗状态
  const [showOutputDrawer, setShowOutputDrawer] = useState(false);

  // 🚀 ASK API研究请求处理
  const handleResearchSubmit = useCallback(async (request: ResearchRequest) => {
    try {
      console.log("[WorkspacePage] Handling research request:", request);
      
      // 🚀 重构：使用简化的sendAskMessage调用，所有事件处理已在Store层统一处理
      const result = await sendAskMessage(request, {
        onNavigate: async (workspaceUrl: string) => {
          console.log("[WorkspacePage] Navigating to:", workspaceUrl);
          // 提取URL参数
          const urlMatch = workspaceUrl.match(/\/workspace\?id=([^&]+)/);
          if (urlMatch && urlMatch[1]) {
            const newUrlParam = urlMatch[1];
            router.replace(`/workspace?id=${newUrlParam}`);
          }
        }
      });
      
      console.log("[WorkspacePage] Research request completed:", result as any);
      
    } catch (error) {
      console.error("[WorkspacePage] Research request failed:", error);
      // TODO: 显示错误提示给用户
    }
  }, [router]);
  
  // 🚀 获取计划状态 - Hook必须在组件顶层调用
  const currentPlanData = useCurrentPlan(currentThreadId || undefined);
  
  // 🚀 计算布局模式 - 基于计划状态自动切换，使用稳定的依赖
  const layoutMode = useMemo(() => {
    if (!hasMessages) return LayoutMode.WELCOME;
    
    // 检测是否有计划数据来决定布局，使用稳定的判断条件
    const hasPlan = currentPlanData && !currentPlanData.isStreaming;
    if (hasPlan) {
      return LayoutMode.CHAT_WITH_ARTIFACTS;
    }
    
    return LayoutMode.CHAT_ONLY;
  }, [hasMessages, currentPlanData?.messageId, currentPlanData?.isStreaming]);

  // 🚀 计算面板宽度 - 基于布局模式
  const panelWidthClass = useMemo(() => {
    if (layoutMode === LayoutMode.CHAT_ONLY) {
      return "w-1/2 mx-auto";
    }
    if (layoutMode === LayoutMode.CHAT_WITH_ARTIFACTS) {
      return "w-1/3"; // 聊天面板1/3宽度
    }
    return "w-full";
  }, [layoutMode]);

  const artifactPanelWidthClass = useMemo(() => {
    if (layoutMode === LayoutMode.CHAT_WITH_ARTIFACTS) {
      return "w-1/2"; // 工件面板1/2宽度
    }
    return "w-full";
  }, [layoutMode]);

  // 输出流弹窗切换函数
  const toggleOutputDrawer = () => setShowOutputDrawer(!showOutputDrawer);



  // 🚀 欢迎内容组件
  const WelcomeContent = () => (
    <div className="flex flex-1 items-center justify-center">
      <div className="text-center max-w-2xl mx-auto px-4">
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-gray-900 mb-4">
            你好，我能帮你什么？
          </h1>
          <p className="text-xl text-gray-300">
            开始您的深度研究之旅
          </p>
        </div>
        

      </div>
    </div>
  );

  // 🚀 全局输入框组件（用于欢迎和单对话模式）
  const GlobalInputContainer = () => (
    <div className="absolute bottom-4 left-4 right-4 z-50">
      <div className="max-w-4xl mx-auto">
        <div className="backdrop-blur-sm bg-black/0 rounded-lg p-4">
          <HeroInput 
            placeholder={hasMessages ? "继续研究对话..." : "开始您的研究之旅..."}
            className="w-full"
            onSubmitResearch={handleResearchSubmit}
          />
        </div>
      </div>
    </div>
  );

  // 🚀 面板内输入框组件（用于多面板模式）
  const PanelInputContainer = () => (
    <div className="absolute bottom-0 left-0 right-0 backdrop-blur-sm bg-black/0 p-4 z-10">
      <HeroInput 
        placeholder="继续研究对话..."
        className="w-full"
        onSubmitResearch={handleResearchSubmit}
      />
    </div>
  );

  // 🚀 对话面板组件 - 自己获取messages，避免父组件重新渲染
  const ConversationPanel = useCallback(() => {
    // 🔥 ConversationPanel自己获取messages，避免父组件过度订阅
    const storeMessages = useThreadMessages(currentThreadId || undefined);
    
    // 🔥 转换store消息格式为MessageContainer期望的格式
    const messages = storeMessages.map((msg): import("~/components/conversation/message-container").Message => ({
      id: msg.id,
      role: msg.role as "user" | "assistant" | "system",
      content: msg.content,
      timestamp: msg.originalInput?.timestamp 
        ? new Date(msg.originalInput.timestamp) 
        : msg.langGraphMetadata?.timestamp 
          ? new Date(msg.langGraphMetadata.timestamp)
          : new Date(),
      status: msg.isStreaming ? "pending" : "completed",
      isStreaming: msg.isStreaming,
      metadata: {
        model: msg.agent,
        reasoning: msg.reasoningContent,
        artifacts: msg.resources?.map(r => r.title) || []
      }
    }));
    
    return (
      <div className="flex flex-col h-full">
        <div className="flex-1 overflow-hidden">
          <ScrollContainer 
            className="h-full px-4 py-4 pb-32"
            autoScrollToBottom={true}
            data-scroll-container
          >
            <div className="space-y-4 max-w-4xl mx-auto">
              {messages.length === 0 ? (
                <div className="flex items-center justify-center h-64">
                  <div className="text-center text-gray-400">
                    <MessageSquare className="mx-auto h-12 w-12 mb-4" />
                    <p>开始新的研究对话</p>
                  </div>
                </div>
              ) : (
                messages.map((message) => (
                  <MessageContainer
                    key={message.id}
                    message={message}
                    className="animate-in fade-in-0 slide-in-from-bottom-2 duration-300"
                  />
                ))
              )}
            </div>
          </ScrollContainer>
        </div>
      </div>
    );
  }, [currentThreadId]);

  // 🚀 工件面板组件 - 复用顶层的计划数据，避免重复Hook调用
  const ArtifactsPanel = useCallback(() => {
    // 🚀 使用Store层的Hook接口获取计划和报告
    const currentInterrupt = useCurrentInterrupt(currentThreadId || undefined);
    const finalReport = useFinalReport(currentThreadId || undefined); // 🔥 添加最终报告
    
    // 🔥 解析计划数据 - 使用顶层传入的计划数据，避免在每次渲染时重新计算
    const currentPlan = useMemo(() => {
      if (!currentPlanData || currentPlanData.isStreaming) return null;
      
      try {
        // 🔥 从currentPlanData.content中解析BusinessPlan
        let jsonContent = currentPlanData.content.trim();
        
        // 查找JSON的开始和结束位置
        const jsonStart = jsonContent.indexOf('{');
        if (jsonStart === -1) return null;
        
        jsonContent = jsonContent.substring(jsonStart);
        
        // 查找JSON的结束位置
        let braceCount = 0;
        let jsonEnd = -1;
        
        for (let i = 0; i < jsonContent.length; i++) {
          if (jsonContent[i] === '{') {
            braceCount++;
          } else if (jsonContent[i] === '}') {
            braceCount--;
            if (braceCount === 0) {
              jsonEnd = i + 1;
              break;
            }
          }
        }
        
        if (jsonEnd === -1) return null;
        
        const jsonString = jsonContent.substring(0, jsonEnd);
        const backendPlan = JSON.parse(jsonString);
        
        if (!backendPlan || !backendPlan.title || !backendPlan.steps) return null;
        
        // 转换为BusinessPlan格式
        const steps: BusinessPlanStep[] = (backendPlan.steps || []).map((step: any, index: number) => ({
          id: `step-${index + 1}`,
          title: step.title || `步骤 ${index + 1}`,
          description: step.description || '无描述',
          priority: step.execution_res ? 'high' as const : 'medium' as const,
          status: step.execution_res ? 'completed' as const : 'pending' as const,
          estimatedTime: 15
        }));
        
        return {
          id: `plan-${currentPlanData.messageId}`,
          title: backendPlan.title || '研究计划',
          objective: backendPlan.thought || '研究目标',
          steps: steps,
          status: 'pending' as const,
          estimatedDuration: steps.length * 15,
          complexity: steps.length <= 2 ? 'simple' as const : 
                     steps.length <= 4 ? 'moderate' as const : 'complex' as const,
          confidence: backendPlan.has_enough_context ? 0.9 : 0.7,
          createdAt: new Date(currentPlanData.timestamp || Date.now()),
          metadata: {
            sources: 0,
            tools: ['tavily_search'],
            keywords: [],
            locale: backendPlan.locale || 'zh-CN'
          }
        } as BusinessPlan;
      } catch (error) {
        console.warn('Failed to parse plan:', error);
        return null;
      }
    }, [currentPlanData]);
    
    // 🚀 简化：直接判断是否显示操作按钮
    const shouldShowActions = (): boolean => {
      return currentInterrupt !== null && currentPlan !== null;
    };

    // 🚀 简化：处理PlanCard回调函数
    const handlePlanApprove = async (planId: string) => {
      if (!currentThreadId || !urlParam) return;
      
      // 获取session_id
      const sessionState = useUnifiedStore.getState().sessionState;
      const sessionId = sessionState?.sessionMetadata?.session_id;
      
      if (!sessionId) {
        console.error('❌ [handlePlanApprove] Session ID not found for followup request');
        return;
      }
      
      // 🔥 HITL场景：不传递config，使用原始研究配置
      await sendAskMessage({
        question: "",
        askType: "followup",
        config: {} as any,
        context: {
          sessionId: sessionId,
          threadId: currentThreadId,
          urlParam: urlParam
        },
        interrupt_feedback: "accepted" // ✅ 格式正确，后端会自然继续执行
      });
    };

    const handlePlanModify = async (planId: string, modifications: string) => {
      if (!currentThreadId || !urlParam) return;
      
      // 获取session_id
      const sessionState = useUnifiedStore.getState().sessionState;
      const sessionId = sessionState?.sessionMetadata?.session_id;
      
      if (!sessionId) {
        console.error('❌ [handlePlanModify] Session ID not found for followup request');
        return;
      }
      
      // 🔥 修复：统一使用interrupt_feedback，移除question中的命令格式冲突
      await sendAskMessage({
        question: modifications, // 🔥 修复：直接传递用户的修改建议，不使用命令格式
        askType: "followup",
        config: {} as any,
        context: {
          sessionId: sessionId,
          threadId: currentThreadId,
          urlParam: urlParam
        },
        interrupt_feedback: "edit_plan" // 🔥 让interrupt_feedback独立工作
      });
    };

    const handlePlanSkipToReport = async (planId: string) => {
      if (!currentThreadId || !urlParam) return;
      
      // 获取session_id
      const sessionState = useUnifiedStore.getState().sessionState;
      const sessionId = sessionState?.sessionMetadata?.session_id;
      
      if (!sessionId) {
        console.error('❌ [handlePlanSkipToReport] Session ID not found for followup request');
        return;
      }
      
      // 🔥 HITL场景：使用后端期望的格式
      await sendAskMessage({
        question: "",
        askType: "followup",
        config: {} as any,
        context: {
          sessionId: sessionId,
          threadId: currentThreadId,
          urlParam: urlParam
        },
        interrupt_feedback: "skip_research" // 🔥 修复：使用后端期望的格式
      });
    };

    const handlePlanReask = (planId: string) => {
      if (!currentThreadId) return;
      
      // 🔥 重新提问是纯前端操作，立即清除状态
      const store = useUnifiedStore.getState();
      
      // 1. 清除当前interrupt状态
      store.clearCurrentInterrupt(currentThreadId);
      
      // 2. 清除当前线程状态
      store.clearThread(currentThreadId);
      
      // 3. 重置URL参数和当前线程
      store.setCurrentThread(null);
      store.setCurrentUrlParam(null);
      
      // 4. 重置会话状态
      store.setSessionState(null);
      
      // 5. 导航回到workspace根路径
      window.location.href = '/workspace';
    };

    return (
      <div className="flex flex-col h-full p-4">
        <div className="flex-1 overflow-y-auto space-y-4">
          {/* 🔥 显示计划（如果存在） */}
          {currentPlan && (
            (() => {
              // 转换BusinessPlan到ResearchPlan格式（为了兼容PlanCard组件）
              const displayPlan: ResearchPlan = {
                id: currentPlan.id,
                title: currentPlan.title,
                objective: currentPlan.objective,
                steps: currentPlan.steps.map(step => ({
                  id: step.id,
                  title: step.title,
                  description: step.description,
                  priority: step.priority,
                  status: step.status,
                  estimatedTime: step.estimatedTime
                })),
                status: "pending",
                estimatedDuration: currentPlan.estimatedDuration,
                complexity: currentPlan.complexity,
                confidence: currentPlan.confidence,
                createdAt: currentPlan.createdAt,
                updatedAt: currentPlan.updatedAt,
                version: 1, // 简化版本号
                metadata: currentPlan.metadata
              };

              return (
                <PlanCard
                  key={displayPlan.id}
                  plan={displayPlan}
                  variant="detailed"
                  showActions={shouldShowActions()}
                  onApprove={handlePlanApprove}
                  onModify={handlePlanModify}
                  onSkipToReport={handlePlanSkipToReport}
                  onReask={handlePlanReask}
                  className="mb-4"
                />
              );
            })()
          )}

          {/* 🔥 显示最终报告（如果存在） */}
          {finalReport && (
            <Card className="mb-4">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <FileText className="h-5 w-5" />
                  最终研究报告
                </CardTitle>
              </CardHeader>
                              <CardContent>
                 <ReportViewer 
                   content={finalReport.content} 
                   title="研究报告"
                   readonly={false}
                 />
                </CardContent>
            </Card>
          )}

          {/* 🔥 空状态显示 */}
          {!currentPlan && !finalReport && (
            <div className="flex-1 flex items-center justify-center">
              <div className="text-center text-gray-400">
                <FileText className="mx-auto h-12 w-12 mb-4" />
                <p>研究计划和报告将在这里显示</p>
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }, [currentPlanData, currentThreadId]);

  // 🚀 输出流面板组件 - 使用OutputStream组件
  const HistoryPanel = () => (
    <div className="flex flex-col h-full">
      <OutputStream className="flex-1" />
    </div>
  );

  return (
          <div className="h-full w-full flex flex-col bg-app-background relative">
      {/* 顶部导航栏 - 仅在有消息时显示 */}
      {hasMessages && (
        <div className="flex-shrink-0 flex items-center justify-between px-4 py-3 bg-transparent">
          <div className="flex items-center gap-2">
            <h1 className="text-lg font-semibold text-foreground">当前研究</h1>
          </div>

          {/* 面板控制按钮 - 移除对话和工件按钮 */}
          <div className="flex items-center gap-1">
            <Button
              variant={showOutputDrawer ? "default" : "outline"}
              size="sm"
              onClick={toggleOutputDrawer}
              className="gap-1 bg-transparent border-border text-muted-foreground hover:bg-muted"
            >
              <Activity className="h-4 w-4" />
              <span className="hidden lg:inline">原始输出流</span>
            </Button>
            
            <Button
              variant="outline"
              size="sm"
              disabled={true}
              className="gap-1 bg-transparent border-border text-gray-400 cursor-not-allowed"
            >
              <Headphones className="h-4 w-4" />
              <span className="hidden lg:inline">播客</span>
              <span className="text-xs text-gray-400">（敬请期待）</span>
            </Button>
          </div>
        </div>
      )}

      {/* 主要内容区域 - 根据布局模式渲染 */}
      <div className="flex-1 min-h-0 flex flex-col">
        {layoutMode === LayoutMode.WELCOME ? (
          // 🚀 欢迎模式：居中显示欢迎内容
          <WelcomeContent />
        ) : (
          // 🚀 基于布局模式显示面板系统
          <div className="flex h-full">
            {/* 对话面板 - 始终显示 */}
            <div className={cn("flex flex-col h-full relative", panelWidthClass, {
              "border-r border-border": layoutMode === LayoutMode.CHAT_WITH_ARTIFACTS
            })}>
              <div className={cn("flex-1 overflow-hidden", {
                "pb-20": layoutMode === LayoutMode.CHAT_WITH_ARTIFACTS
              })}>
                <ConversationPanel />
              </div>
              {/* 在双面板模式下，输入框属于对话面板 */}
              {layoutMode === LayoutMode.CHAT_WITH_ARTIFACTS && <PanelInputContainer />}
            </div>

            {/* 工件面板 - 仅在双面板模式显示 */}
            {layoutMode === LayoutMode.CHAT_WITH_ARTIFACTS && (
              <div className={cn("flex flex-col h-full", artifactPanelWidthClass)}>
                <div className="flex-shrink-0 px-4 py-3 border-b border-border">
                  <div className="flex items-center justify-between">
                    <h2 className="text-lg font-semibold text-foreground">
                      研究工件
                    </h2>
                  </div>
                </div>
                <ArtifactsPanel />
              </div>
            )}
          </div>
        )}
      </div>

      {/* 全局输入框 - 仅在欢迎和单对话模式显示 */}
      {(layoutMode === LayoutMode.WELCOME || layoutMode === LayoutMode.CHAT_ONLY) && (
        <GlobalInputContainer />
      )}

      {/* 右侧输出流弹窗 */}
      {showOutputDrawer && (
        <div className="fixed inset-0 z-50 bg-black/50" onClick={() => setShowOutputDrawer(false)}>
          <div 
            className="fixed right-0 top-0 h-full w-96 bg-background shadow-xl border-l border-border"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex flex-col h-full">
              <div className="flex-shrink-0 px-4 py-3 border-b border-border">
                <div className="flex items-center justify-between">
                  <h2 className="text-lg font-semibold text-foreground">
                    实时输出流
                  </h2>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setShowOutputDrawer(false)}
                    className="h-8 w-8 p-0 text-muted-foreground hover:bg-muted"
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              </div>
              <HistoryPanel />
            </div>
          </div>
        </div>
      )}
    </div>
  );
} 