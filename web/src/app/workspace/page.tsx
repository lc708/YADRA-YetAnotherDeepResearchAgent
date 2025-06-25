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
  Minimize2,
  Maximize2,
  Search,
  Send,
  Plus,
  Mic,
  MicOff,
  Loader2,
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
import { PodcastPanel } from "~/app/workspace/components/podcast-panel";
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
  CONVERSATION = 'conversation', 
  MULTI_PANEL = 'multi_panel'
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
  
  // 面板可见性状态 - 默认只显示conversation panel
  const [conversationVisible, setConversationVisible] = useState(true);
  const [artifactVisible, setArtifactVisible] = useState(false);
  const [historyVisible, setHistoryVisible] = useState(false);
  const [podcastVisible, setPodcastVisible] = useState(false);

  // 任务状态
  const [taskStarted, setTaskStarted] = useState(false);
  
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
  
  // 🚀 计算布局模式
  const layoutMode = useMemo(() => {
    if (!hasMessages) return LayoutMode.WELCOME;
    
    const visiblePanels = [conversationVisible, artifactVisible, historyVisible, podcastVisible].filter(Boolean);
    
    // 如果只有对话面板可见
    if (visiblePanels.length === 1 && conversationVisible) {
      return LayoutMode.CONVERSATION;
    }
    
    // 如果有多个面板可见
    if (visiblePanels.length > 1) {
      return LayoutMode.MULTI_PANEL;
    }
    
    // 有消息但没有可见面板，默认显示对话
    return LayoutMode.CONVERSATION;
  }, [hasMessages, conversationVisible, artifactVisible, historyVisible, podcastVisible]);

  // 🚀 计算可见面板和宽度
  const visiblePanels = useMemo(() => {
    return [
      { type: 'conversation', visible: conversationVisible },
      { type: 'artifacts', visible: artifactVisible },
      { type: 'history', visible: historyVisible },
      { type: 'podcast', visible: podcastVisible },
    ].filter(panel => panel.visible);
  }, [conversationVisible, artifactVisible, historyVisible, podcastVisible]);

  const panelWidthClass = useMemo(() => {
    const count = visiblePanels.length;
    if (count === 1) return "w-full";
    if (count === 2) return "w-1/2"; 
    if (count === 3) return "w-1/3";
    return "w-1/4";
  }, [visiblePanels.length]);

  // 面板切换函数
  const toggleConversationPanel = () => setConversationVisible(!conversationVisible);
  const toggleArtifactsPanel = () => setArtifactVisible(!artifactVisible);
  const toggleHistoryPanel = () => setHistoryVisible(!historyVisible);
  const togglePodcastPanel = () => setPodcastVisible(!podcastVisible);

  // 监听消息变化来启动任务面板
  useEffect(() => {
    if (hasMessages && !taskStarted) {
      setTaskStarted(true);
      setArtifactVisible(true);
      setHistoryVisible(true);
      setPodcastVisible(true);
    }
  }, [hasMessages, taskStarted]);

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
  const ConversationPanel = () => {
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
            className="h-full px-4 py-4"
            autoScrollToBottom={true}
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
  };

  // 🚀 工件面板组件
  const ArtifactsPanel = () => {
    // 🚀 使用Store层的Hook接口获取计划和报告
    const currentInterrupt = useCurrentInterrupt(currentThreadId || undefined);
    const planData = useCurrentPlan(currentThreadId || undefined);
    const finalReport = useFinalReport(currentThreadId || undefined); // 🔥 添加最终报告
    
    // 🔥 解析计划数据
    const currentPlan = useMemo(() => {
      if (!planData || planData.isStreaming) return null;
      
      try {
        // 🔥 从planData.content中解析BusinessPlan
        let jsonContent = planData.content.trim();
        
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
          id: `plan-${planData.messageId}`,
          title: backendPlan.title || '研究计划',
          objective: backendPlan.thought || '研究目标',
          steps: steps,
          status: 'pending' as const,
          estimatedDuration: steps.length * 15,
          complexity: steps.length <= 2 ? 'simple' as const : 
                     steps.length <= 4 ? 'moderate' as const : 'complex' as const,
          confidence: backendPlan.has_enough_context ? 0.9 : 0.7,
          createdAt: new Date(planData.timestamp || Date.now()),
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
    }, [planData]);
    
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
  };

  // 🚀 输出流面板组件 - 使用OutputStream组件
  const HistoryPanel = () => (
    <div className="flex flex-col h-full">
      <OutputStream className="flex-1" />
    </div>
  );

  // 🚀 播客面板组件 - 导入迁移后的组件
  const PodcastPanelWrapper = () => (
    <PodcastPanel className="flex-1" />
  );

  return (
          <div className="h-full w-full flex flex-col bg-app-background relative">
      {/* 顶部导航栏 - 仅在有消息时显示 */}
      {hasMessages && (
        <div className="flex-shrink-0 flex items-center justify-between px-4 py-3 bg-transparent">
          <div className="flex items-center gap-2">
            <h1 className="text-lg font-semibold text-foreground">当前研究</h1>
          </div>

          {/* 面板控制按钮 */}
          <div className="flex items-center gap-1">
            <Button
              variant={conversationVisible ? "default" : "outline"}
              size="sm"
              onClick={toggleConversationPanel}
              className="gap-1 bg-transparent border-border text-muted-foreground hover:bg-muted"
            >
              <MessageSquare className="h-4 w-4" />
              <span className="hidden lg:inline">对话</span>
              {conversationVisible ? <Minimize2 className="h-3 w-3 hidden sm:inline" /> : <Maximize2 className="h-3 w-3 hidden sm:inline" />}
            </Button>
            
            <Button
              variant={artifactVisible ? "default" : "outline"}
              size="sm"
              onClick={toggleArtifactsPanel}
              className="gap-1 bg-transparent border-border text-muted-foreground hover:bg-muted"
            >
              <FileText className="h-4 w-4" />
              <span className="hidden lg:inline">工件</span>
              {artifactVisible ? <Minimize2 className="h-3 w-3 hidden sm:inline" /> : <Maximize2 className="h-3 w-3 hidden sm:inline" />}
            </Button>
            
            <Button
              variant={historyVisible ? "default" : "outline"}
              size="sm"
              onClick={toggleHistoryPanel}
              className="gap-1 bg-transparent border-border text-muted-foreground hover:bg-muted"
            >
              <Activity className="h-4 w-4" />
              <span className="hidden lg:inline">输出流</span>
              {historyVisible ? <Minimize2 className="h-3 w-3 hidden sm:inline" /> : <Maximize2 className="h-3 w-3 hidden sm:inline" />}
            </Button>
            
            <Button
              variant={podcastVisible ? "default" : "outline"}
              size="sm"
              onClick={togglePodcastPanel}
              className="gap-1 bg-transparent border-border text-muted-foreground hover:bg-muted"
            >
              <Headphones className="h-4 w-4" />
              <span className="hidden lg:inline">播客</span>
              {podcastVisible ? <Minimize2 className="h-3 w-3 hidden sm:inline" /> : <Maximize2 className="h-3 w-3 hidden sm:inline" />}
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
          // 🚀 对话和多面板模式：显示面板系统
          <div className="flex h-full">
            {/* 对话面板 */}
            {conversationVisible && (
              <div className={cn("flex flex-col h-full relative", panelWidthClass, {
                "border-r border-border": visiblePanels.length > 1
              })}>
                <ConversationPanel />
                {/* 在多面板模式下，输入框属于对话面板 */}
                {layoutMode === LayoutMode.MULTI_PANEL && <PanelInputContainer />}
              </div>
            )}

            {/* 工件面板 */}
            {artifactVisible && (
              <div className={cn("flex flex-col h-full", panelWidthClass, {
                "border-r border-border": historyVisible || podcastVisible
              })}>
                <div className="flex-shrink-0 px-4 py-3 border-b border-border">
                  <div className="flex items-center justify-between">
                    <h2 className="text-lg font-semibold text-foreground">
                      研究工件
                    </h2>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={toggleArtifactsPanel}
                      className="h-8 w-8 p-0 text-muted-foreground hover:bg-muted"
                    >
                      <Minimize2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
                <ArtifactsPanel />
              </div>
            )}

            {/* 输出流面板 */}
            {historyVisible && (
              <div className={cn("flex flex-col h-full", panelWidthClass, {
                "border-r border-border": podcastVisible
              })}>
                <div className="flex-shrink-0 px-4 py-3 border-b border-border">
                  <div className="flex items-center justify-between">
                    <h2 className="text-lg font-semibold text-foreground">
                      实时输出流
                    </h2>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={toggleHistoryPanel}
                      className="h-8 w-8 p-0 text-muted-foreground hover:bg-muted"
                    >
                      <Minimize2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
                <HistoryPanel />
              </div>
            )}

            {/* 播客面板 */}
            {podcastVisible && (
              <div className={cn("flex flex-col h-full", panelWidthClass)}>
                <div className="flex-shrink-0 px-4 py-3 border-b border-border">
                  <div className="flex items-center justify-between">
                    <h2 className="text-lg font-semibold text-foreground">
                      播客内容
                    </h2>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={togglePodcastPanel}
                      className="h-8 w-8 p-0 text-muted-foreground hover:bg-muted"
                    >
                      <Minimize2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
                <PodcastPanelWrapper />
              </div>
            )}

            {/* 当有对话但所有面板都隐藏时显示提示 */}
            {hasMessages && visiblePanels.length === 0 && (
              <div className="flex flex-1 items-center justify-center">
                <div className="text-center">
                  <MessageSquare className="mx-auto h-12 w-12 text-gray-400" />
                  <h3 className="mt-4 text-lg font-medium text-foreground">
                    选择要查看的面板
                  </h3>
                  <p className="mt-2 text-sm text-muted-foreground">
                    使用右上角的按钮开启对话、工件或其他面板
                  </p>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* 全局输入框 - 仅在欢迎和单对话模式显示 */}
      {(layoutMode === LayoutMode.WELCOME || layoutMode === LayoutMode.CONVERSATION) && (
        <GlobalInputContainer />
      )}
    </div>
  );
} 