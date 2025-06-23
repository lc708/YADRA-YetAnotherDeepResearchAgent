"use client";

import { MessageSquare, FileText, Activity, Headphones, Minimize2, Maximize2 } from "lucide-react";
import { useState, useCallback, useEffect, useMemo, useRef } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { cn } from "~/lib/utils";

import { Button } from "~/components/ui/button";
import { ScrollContainer, type ScrollContainerRef } from "~/components/conversation/scroll-container";
import { HeroInput } from "~/components/yadra/hero-input";
import { 
  useUnifiedStore, 
  sendAskMessage,
  useCurrentPlan,
  useCurrentInterrupt,
} from "~/core/store/unified-store";
import { type StatusType } from "~/components/conversation/status-badge";
import type { MessageRole } from "~/core/messages/types";
import type { ResearchRequest } from "~/core/store/unified-store";
import { useSettingsStore } from "~/core/store/settings-store";
import { Input } from "~/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import { PlanCard } from "~/components/research/plan-card";
import type { ResearchPlan } from "~/components/research/plan-card";
import type { PlanStep } from "~/components/research/plan-card";
import { OutputStream } from "./components/output-stream";
import { PodcastPanel } from "./components/podcast-panel";
import { ArtifactFeed } from "~/components/yadra/artifact-feed";
import { MessageContainer } from "~/components/conversation/message-container";
import { LoadingAnimation } from "~/components/conversation/loading-animation";
import { toast } from "sonner";

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

  // 🚀 对话面板组件 - 使用智能滚动容器
  const ConversationPanel = () => {
    const messages = storeMessages; // 使用已定义的storeMessages
    const responding = useUnifiedStore((state) => state.responding);
    const scrollContainerRef = useRef<ScrollContainerRef>(null);

    // 过滤和转换消息，只显示对话相关的内容
    const conversationMessages = useMemo(() => {
      if (!messages || messages.length === 0) {
        return [];
      }

      return messages
        .filter((msg: any) => {
          // 只显示用户消息和主要的AI回复，过滤掉技术性的输出流内容
          if (msg.role === 'user') return true;
          if (msg.role === 'assistant' && msg.agent === 'generalmanager') return true;
          if (msg.role === 'assistant' && msg.agent === 'reporter') return true;
          return false;
        })
        .map((msg: any) => ({
          id: msg.id,
          role: msg.role as "user" | "assistant" | "system",
          content: msg.content,
          timestamp: new Date(msg.originalInput?.timestamp || Date.now()),
          status: msg.isStreaming ? "pending" as const : "completed" as const,
          isStreaming: msg.isStreaming,
          metadata: {
            model: msg.agent,
            tokens: undefined,
            reasoning: msg.reasoningContent,
            artifacts: msg.resources?.map((r: any) => r.title) || []
          }
        }));
    }, [messages]);

    return (
      <div className="flex flex-col h-full">
        {/* 消息列表 */}
        <ScrollContainer ref={scrollContainerRef} className="flex-1 px-2" autoScrollToBottom={true}>
          <div className="space-y-4 py-4">
            {conversationMessages.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-center py-12">
                <MessageSquare className="h-12 w-12 text-muted-foreground mb-4" />
                <h3 className="text-lg font-medium text-muted-foreground mb-2">
                  开始对话
                </h3>
                <p className="text-sm text-muted-foreground max-w-sm">
                  在下方输入您的研究问题，AI助手将为您提供深度分析和见解。
                </p>
              </div>
            ) : (
              conversationMessages.map((message: any, index: number) => (
                <motion.div
                  key={message.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.3, delay: index * 0.1 }}
                >
                  <MessageContainer
                    message={message}
                    showAvatar={true}
                    showTimestamp={true}
                    showActions={true}
                    showStatus={true}
                    isLatest={index === conversationMessages.length - 1}
                    onCopy={(content) => {
                      navigator.clipboard.writeText(content);
                      toast.success("已复制到剪贴板");
                    }}
                    className="border-0 shadow-none bg-transparent"
                  />
                </motion.div>
              ))
            )}
            
            {/* 加载指示器 */}
            {responding && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="flex items-center justify-center py-4"
              >
                <LoadingAnimation 
                  type="typing" 
                  size="md" 
                  text="AI正在思考中..."
                />
              </motion.div>
            )}
          </div>
        </ScrollContainer>
      </div>
    );
  };

  // 🚀 工件面板组件
  const ArtifactsPanel = () => {
    // 🔥 添加本地状态控制按钮显示
    const [planActionInProgress, setPlanActionInProgress] = useState<string | null>(null);

    // 🚀 重构：使用Store层的Hook接口替代业务逻辑
    const currentInterrupt = useCurrentInterrupt(currentThreadId || undefined);
    const currentPlan = useCurrentPlan(currentThreadId || undefined);
    
    // 🔥 监听plan变化，当有新plan生成时重新显示按钮
    useEffect(() => {
      // 如果当前是modify状态，且有新的interrupt（说明重新生成了plan），则重新显示按钮
      if (planActionInProgress === 'modify' && currentInterrupt !== null) {
        setPlanActionInProgress(null);
      }
    }, [currentInterrupt, planActionInProgress]);
    
    // 🚀 重构：将业务逻辑移到Store层，组件只负责UI逻辑
    const shouldShowActions = (): boolean => {
      return currentInterrupt !== null && planActionInProgress === null;
    };
    
    // 🚀 重构：转换BusinessPlan到ResearchPlan格式（为了兼容现有组件）
    const getLatestPlan = (): ResearchPlan | null => {
      if (!currentPlan) return null;
      
      return {
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
        status: currentPlan.status === "approved" ? "completed" : 
                currentPlan.status === "rejected" ? "error" : 
                currentPlan.status as StatusType,
        estimatedDuration: currentPlan.estimatedDuration,
        complexity: currentPlan.complexity,
        confidence: currentPlan.confidence,
        createdAt: currentPlan.createdAt,
        updatedAt: currentPlan.updatedAt,
        version: currentPlan.version,
        metadata: currentPlan.metadata
      };
    };

    // 处理PlanCard回调函数
    const handlePlanApprove = async (planId: string) => {
      if (!currentThreadId || !urlParam) return;
      
      // 🔥 立即隐藏按钮
      setPlanActionInProgress('approve');
      
      // 获取session_id
      const sessionState = useUnifiedStore.getState().sessionState;
      const sessionId = sessionState?.sessionMetadata?.session_id;
      
      if (!sessionId) {
        console.error('❌ [handlePlanApprove] Session ID not found for followup request');
        setPlanActionInProgress(null); // 🔥 出错时恢复按钮
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
      
      // 🔥 不需要清除planActionInProgress，因为用户操作已完成，按钮应该保持隐藏
    };

    const handlePlanModify = async (planId: string, modifications: string) => {
      if (!currentThreadId || !urlParam) return;
      
      // 🔥 编辑计划：等用户提交修改建议后才隐藏按钮，这里不设置状态
      
      // 获取session_id
      const sessionState = useUnifiedStore.getState().sessionState;
      const sessionId = sessionState?.sessionMetadata?.session_id;
      
      if (!sessionId) {
        console.error('❌ [handlePlanModify] Session ID not found for followup request');
        return;
      }
      
      // 🔥 用户提交修改建议后，立即隐藏按钮
      setPlanActionInProgress('modify');
      
      // 🔥 HITL场景：发送修改建议给后端重新规划
      await sendAskMessage({
        question: `[EDIT_PLAN] ${modifications}`, // 🔥 修复：使用后端期望的格式
        askType: "followup",
        config: {} as any,
        context: {
          sessionId: sessionId,
          threadId: currentThreadId,
          urlParam: urlParam
        },
        interrupt_feedback: "edit_plan" // 🔥 这会被question中的[EDIT_PLAN]格式覆盖
      });
    };

    const handlePlanSkipToReport = async (planId: string) => {
      if (!currentThreadId || !urlParam) return;
      
      // 🔥 立即隐藏按钮
      setPlanActionInProgress('skip_to_report');
      
      // 获取session_id
      const sessionState = useUnifiedStore.getState().sessionState;
      const sessionId = sessionState?.sessionMetadata?.session_id;
      
      if (!sessionId) {
        console.error('❌ [handlePlanSkipToReport] Session ID not found for followup request');
        setPlanActionInProgress(null); // 🔥 出错时恢复按钮
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
      
      // 🔥 立即隐藏按钮
      setPlanActionInProgress('reask');
      
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

    // 🔥 修复：只有在确实有计划消息时才调用getLatestPlan，避免不必要的日志
    const hasPlanMessage = currentThreadId ? (() => {
      const thread = useUnifiedStore.getState().threads.get(currentThreadId);
      return thread?.messages?.some(msg => 
        msg.agent === 'projectmanager' && msg.metadata?.planEvent === true
      ) || false;
    })() : false;
    
    const latestPlan = hasPlanMessage ? getLatestPlan() : null;
    
    const showActionButtons = shouldShowActions();

    return (
      <div className="flex flex-col h-full p-4">
        <div className="flex-1 overflow-y-auto space-y-4">
          {/* 🔥 显示计划卡片（如果有计划数据） - 不依赖interrupt状态 */}
          {latestPlan && (
            <PlanCard
              plan={latestPlan}
              variant="detailed"
              showActions={showActionButtons}
              onApprove={handlePlanApprove}
              onModify={handlePlanModify}
              onSkipToReport={handlePlanSkipToReport}
              onReask={handlePlanReask}
              className="mb-4"
            />
          )}
          
          {/* 🔥 取消工件流显示 - 只显示PlanCard */}
          {!latestPlan && (
            <div className="text-center text-gray-400 mt-8">
              <FileText className="mx-auto h-12 w-12 mb-4" />
              <p>研究计划将在这里显示</p>
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