"use client";

import { MessageSquare, FileText, Activity, Headphones, Minimize2, Maximize2 } from "lucide-react";
import { useState, useCallback, useEffect, useMemo } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { cn } from "~/lib/utils";

import { Button } from "~/components/ui/button";
import { HeroInput } from "~/components/yadra/hero-input";
import { useUnifiedStore, sendAskMessage } from "~/core/store/unified-store";
import type { MessageRole } from "~/core/messages/types";
import type { ResearchRequest } from "~/core/store/unified-store";
import { useSettingsStore } from "~/core/store/settings-store";
import { Input } from "~/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import { PlanCard } from "~/components/research/plan-card";
import type { ResearchPlan } from "~/components/research/plan-card";
import type { PlanStep } from "~/components/research/plan-card";

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

export default function WorkspacePage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  
  // 🔥 获取URL参数
  const urlParam = searchParams.get('id');
  
  // 🔥 从unified-store获取当前线程数据
  const currentThreadId = useUnifiedStore((state) => {
    if (urlParam) {
      return state.getThreadIdByUrlParam(urlParam);
    }
    return state.currentThreadId;
  });
  
  const currentThread = useUnifiedStore((state) => {
    if (currentThreadId) {
      return state.getThread(currentThreadId);
    }
    return null;
  });
  
  // 🔥 使用unified-store的消息而不是本地state
  const storeMessages = currentThread?.messages || [];
  const hasMessages = storeMessages.length > 0;
  
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
      
      // 调用sendAskMessage处理研究请求
      const result = await sendAskMessage(
        request,
        {
          // 🔥 事件处理器 - 可以在这里添加自定义逻辑
          onNavigation: async (data) => {
            console.log("[WorkspacePage] Navigation event received:", data);
          },
          onMetadata: async (data) => {
            console.log("[WorkspacePage] Metadata event received:", data);
          },
          onProgress: async (data) => {
            console.log("[WorkspacePage] Progress event received:", data);
          },
          onComplete: async (data) => {
            console.log("[WorkspacePage] Research completed:", data);
          },
          onError: async (data) => {
            console.error("[WorkspacePage] Research error:", data);
          }
        },
        {
          // 🔥 配置选项
          onNavigate: async (workspaceUrl) => {
            // 处理URL跳转
            console.log("[WorkspacePage] Navigating to:", workspaceUrl);
            
            // 提取URL参数
            const urlMatch = workspaceUrl.match(/\/workspace\?id=([^&]+)/);
            if (urlMatch && urlMatch[1]) {
              const newUrlParam = urlMatch[1];
              router.replace(`/workspace?id=${newUrlParam}`);
            }
          }
        }
      );
      
      console.log("[WorkspacePage] Research request completed:", result);
      
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
          <h1 className="text-4xl font-bold text-white mb-4">
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
        <div className="backdrop-blur-sm bg-black/20 rounded-lg p-4">
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
    <div className="absolute bottom-0 left-0 right-0 backdrop-blur-sm bg-black/20 p-4 z-10">
      <HeroInput 
        placeholder="继续研究对话..."
        className="w-full"
        onSubmitResearch={handleResearchSubmit}
      />
    </div>
  );

  // 🚀 对话面板组件
  const ConversationPanel = () => (
    <div className="flex flex-col h-full p-4">
      <div className="flex-1 overflow-y-auto space-y-4 mb-4">
        {storeMessages.map((msg) => (
          <div key={msg.id} className={cn(
            "flex gap-3 p-3 rounded-lg",
            msg.role === 'user' ? "bg-blue-500/20 ml-8" : "bg-gray-500/20 mr-8"
          )}>
            <div className="flex-1">
              <div className="text-sm font-medium text-white mb-1">
                {msg.role === 'user' ? '您' : 'AI助手'}
              </div>
              <div className="text-gray-300 whitespace-pre-wrap">
                {msg.content}
              </div>
            </div>
          </div>
        ))}

      </div>
    </div>
  );

  // 🚀 工件面板组件
  const ArtifactsPanel = () => {
    const currentInterrupt = useUnifiedStore(state =>
      currentThreadId ? state.getCurrentInterrupt(currentThreadId) : null
    );
    
    // 🔥 获取真实的计划数据
    const getPlanFromMessages = (): any | null => {
      if (!currentThreadId) return null;
      
      const thread = useUnifiedStore.getState().threads.get(currentThreadId);
      if (!thread) return null;
      
      // 查找最新的planner消息（包含计划数据）
      const plannerMessages = thread.messages.filter(msg => msg.agent === 'planner');
      if (plannerMessages.length === 0) return null;
      
      const latestPlanMessage = plannerMessages[plannerMessages.length - 1];
      if (!latestPlanMessage) return null;
      
      try {
        // 🔥 第一层解析：获取plan_data对象
        const planData = JSON.parse(latestPlanMessage.content);
        console.log('🔍 Parsed plan_data:', planData);
        
        // 🔥 第二层解析：解析plan_data.plan字符串
        if (planData && planData.plan && typeof planData.plan === 'string') {
          const actualPlan = JSON.parse(planData.plan);
          console.log('✅ Parsed actual plan:', actualPlan);
          return actualPlan;
        }
        
        // 🔥 兜底：如果plan_data直接包含计划数据
        if (planData && planData.title && planData.steps) {
          console.log('✅ Direct plan data found:', planData);
          return planData;
        }
        
        console.warn('⚠️ Plan data structure not recognized:', planData);
        return null;
      } catch (error) {
        console.warn('❌ Failed to parse plan data:', error);
        console.warn('Raw message content:', latestPlanMessage.content);
        return null;
      }
    };
    
    // 将后端Plan数据转换为前端ResearchPlan格式
    const convertInterruptToPlan = (): ResearchPlan | null => {
      if (!currentInterrupt) return null;
      
      const backendPlan = getPlanFromMessages();
      if (!backendPlan) {
        console.warn('No plan data found in messages');
        return null;
      }
      
      // 🔥 正确映射后端Plan数据结构
      const steps: PlanStep[] = (backendPlan.steps || []).map((step: any, index: number) => ({
        id: `step-${index + 1}`,
        title: step.title || `步骤 ${index + 1}`,
        description: step.description || '无描述',
        priority: step.step_type === 'research' ? 'high' as const : 'medium' as const,
        status: step.execution_res ? 'completed' as const : 'pending' as const,
        estimatedTime: 15 // 默认估算时间
      }));
      
      return {
        id: currentInterrupt.interruptId,
        title: backendPlan.title || '研究计划',
        objective: backendPlan.thought || currentInterrupt.message,
        steps: steps,
        status: 'pending' as const,
        estimatedDuration: steps.length * 15, // 基于步骤数估算总时长
        complexity: steps.length <= 2 ? 'simple' as const : 
                   steps.length <= 4 ? 'moderate' as const : 'complex' as const,
        confidence: 0.8,
        createdAt: new Date(),
        version: 1,
        metadata: {
          sources: 0,
          tools: ['tavily_search'],
          keywords: []
        }
      };
    };

    // 处理PlanCard回调函数
    const handlePlanApprove = async (planId: string) => {
      if (!currentThreadId) return;
      
      // 对应interrupt的"accepted"选项
      await sendAskMessage({
        question: "",
        askType: "followup",
        config: {
          autoAcceptedPlan: true,
          enableBackgroundInvestigation: false,
          reportStyle: "academic",
          enableDeepThinking: false,
          maxPlanIterations: 3,
          maxStepNum: 10,
          maxSearchResults: 10
        },
        context: {
          threadId: currentThreadId
        },
        interrupt_feedback: "accepted" // 🔥 正确位置：顶级字段
      });
      
      useUnifiedStore.getState().clearCurrentInterrupt(currentThreadId);
    };

    const handlePlanModify = async (planId: string, modifications: string) => {
      if (!currentThreadId) return;
      
      // 对应interrupt的"edit_plan"选项
      await sendAskMessage({
        question: modifications,
        askType: "followup",
        config: {
          autoAcceptedPlan: false,
          enableBackgroundInvestigation: false,
          reportStyle: "academic",
          enableDeepThinking: false,
          maxPlanIterations: 3,
          maxStepNum: 10,
          maxSearchResults: 10
        },
        context: {
          threadId: currentThreadId
        },
        interrupt_feedback: "edit_plan" // 🔥 正确位置：顶级字段
      });
      
      useUnifiedStore.getState().clearCurrentInterrupt(currentThreadId);
    };

    const handlePlanSkipToReport = async (planId: string) => {
      if (!currentThreadId) return;
      
      // 对应interrupt的跳转报告选项
      await sendAskMessage({
        question: "",
        askType: "followup",
        config: {
          autoAcceptedPlan: true,
          enableBackgroundInvestigation: false,
          reportStyle: "academic",
          enableDeepThinking: false,
          maxPlanIterations: 3,
          maxStepNum: 10,
          maxSearchResults: 10
        },
        context: {
          threadId: currentThreadId
        },
        interrupt_feedback: "goto_reporter" // 🔥 正确位置：顶级字段
      });
      
      useUnifiedStore.getState().clearCurrentInterrupt(currentThreadId);
    };

    const handlePlanReask = (planId: string) => {
      if (!currentThreadId) return;
      
      // 重新提问功能
      useUnifiedStore.getState().clearCurrentInterrupt(currentThreadId);
      // 可以触发重新输入状态
    };

    const plan = convertInterruptToPlan();

    return (
      <div className="flex flex-col h-full p-4">
        <div className="flex-1 overflow-y-auto">
          {plan ? (
            <PlanCard
              plan={plan}
              variant="detailed"
              showActions={true}
              onApprove={handlePlanApprove}
              onModify={handlePlanModify}
              onSkipToReport={handlePlanSkipToReport}
              onReask={handlePlanReask}
              className="mb-4"
            />
          ) : (
            <div className="text-center text-gray-400 mt-8">
              <FileText className="mx-auto h-12 w-12 mb-4" />
              <p>研究工件将在这里显示</p>
            </div>
          )}
        </div>
      </div>
    );
  };

  // 🚀 输出流面板组件
  const HistoryPanel = () => (
    <div className="flex flex-col h-full p-4">
      <div className="flex-1 overflow-y-auto">
        <div className="text-center text-gray-400 mt-8">
          <Activity className="mx-auto h-12 w-12 mb-4" />
          <p>实时输出流将在这里显示</p>
        </div>
      </div>
    </div>
  );

  // 🚀 播客面板组件
  const PodcastPanel = () => (
    <div className="flex flex-col h-full p-4">
      <div className="flex-1 overflow-y-auto">
        <div className="text-center text-gray-400 mt-8">
          <Headphones className="mx-auto h-12 w-12 mb-4" />
          <p>播客内容将在这里显示</p>
        </div>
      </div>
    </div>
  );

  return (
    <div className="h-full w-full flex flex-col bg-gradient-to-br from-slate-900 via-slate-800 to-black relative">
      {/* 顶部导航栏 - 仅在有消息时显示 */}
      {hasMessages && (
        <div className="flex-shrink-0 flex items-center justify-between px-4 py-3 bg-transparent">
          <div className="flex items-center gap-2">
            <h1 className="text-lg font-semibold text-white">当前研究</h1>
          </div>

          {/* 面板控制按钮 */}
          <div className="flex items-center gap-1">
            <Button
              variant={conversationVisible ? "default" : "outline"}
              size="sm"
              onClick={toggleConversationPanel}
              className="gap-1 bg-transparent border-white/20 text-white hover:bg-white/10"
            >
              <MessageSquare className="h-4 w-4" />
              <span className="hidden lg:inline">对话</span>
              {conversationVisible ? <Minimize2 className="h-3 w-3 hidden sm:inline" /> : <Maximize2 className="h-3 w-3 hidden sm:inline" />}
            </Button>
            
            <Button
              variant={artifactVisible ? "default" : "outline"}
              size="sm"
              onClick={toggleArtifactsPanel}
              className="gap-1 bg-transparent border-white/20 text-white hover:bg-white/10"
            >
              <FileText className="h-4 w-4" />
              <span className="hidden lg:inline">工件</span>
              {artifactVisible ? <Minimize2 className="h-3 w-3 hidden sm:inline" /> : <Maximize2 className="h-3 w-3 hidden sm:inline" />}
            </Button>
            
            <Button
              variant={historyVisible ? "default" : "outline"}
              size="sm"
              onClick={toggleHistoryPanel}
              className="gap-1 bg-transparent border-white/20 text-white hover:bg-white/10"
            >
              <Activity className="h-4 w-4" />
              <span className="hidden lg:inline">输出流</span>
              {historyVisible ? <Minimize2 className="h-3 w-3 hidden sm:inline" /> : <Maximize2 className="h-3 w-3 hidden sm:inline" />}
            </Button>
            
            <Button
              variant={podcastVisible ? "default" : "outline"}
              size="sm"
              onClick={togglePodcastPanel}
              className="gap-1 bg-transparent border-white/20 text-white hover:bg-white/10"
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
                "border-r border-white/10": visiblePanels.length > 1
              })}>
                <ConversationPanel />
                {/* 在多面板模式下，输入框属于对话面板 */}
                {layoutMode === LayoutMode.MULTI_PANEL && <PanelInputContainer />}
              </div>
            )}

            {/* 工件面板 */}
            {artifactVisible && (
              <div className={cn("flex flex-col h-full", panelWidthClass, {
                "border-r border-white/10": historyVisible || podcastVisible
              })}>
                <div className="flex-shrink-0 px-4 py-3 border-b border-white/10">
                  <div className="flex items-center justify-between">
                    <h2 className="text-lg font-semibold text-white">
                      研究工件
                    </h2>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={toggleArtifactsPanel}
                      className="h-8 w-8 p-0 text-white hover:bg-white/10"
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
                "border-r border-white/10": podcastVisible
              })}>
                <div className="flex-shrink-0 px-4 py-3 border-b border-white/10">
                  <div className="flex items-center justify-between">
                    <h2 className="text-lg font-semibold text-white">
                      实时输出流
                    </h2>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={toggleHistoryPanel}
                      className="h-8 w-8 p-0 text-white hover:bg-white/10"
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
                <div className="flex-shrink-0 px-4 py-3 border-b border-white/10">
                  <div className="flex items-center justify-between">
                    <h2 className="text-lg font-semibold text-white">
                      播客内容
                    </h2>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={togglePodcastPanel}
                      className="h-8 w-8 p-0 text-white hover:bg-white/10"
                    >
                      <Minimize2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
                <PodcastPanel />
              </div>
            )}

            {/* 当有对话但所有面板都隐藏时显示提示 */}
            {hasMessages && visiblePanels.length === 0 && (
              <div className="flex flex-1 items-center justify-center">
                <div className="text-center">
                  <MessageSquare className="mx-auto h-12 w-12 text-gray-400" />
                  <h3 className="mt-4 text-lg font-medium text-white">
                    选择要查看的面板
                  </h3>
                  <p className="mt-2 text-sm text-gray-400">
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