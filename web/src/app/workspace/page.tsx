"use client";

import { MessageSquare, FileText, Activity, Headphones, Minimize2, Maximize2 } from "lucide-react";
import { useState, useCallback, useEffect, useMemo, useRef } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { cn } from "~/lib/utils";

import { Button } from "~/components/ui/button";
import { ScrollArea } from "~/components/ui/scroll-area";
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
import { OutputStream } from "./components/output-stream";
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
      
      // 调用sendAskMessage处理研究请求
      const result = await sendAskMessage(
        request,
        {
          // 🔥 事件处理器 - 添加OutputStream需要的所有13种事件处理
          onNavigation: async (data) => {
            console.log("[WorkspacePage] Navigation event received:", data);
            // sendAskMessage内部已处理导航逻辑
          },
          onMetadata: async (data) => {
            console.log("[WorkspacePage] Metadata event received:", data);
            // sendAskMessage内部已处理metadata
          },
          onNodeStart: async (data) => {
            console.log('[WorkspacePage] Node started:', data.node_name);
            const currentThreadId = useUnifiedStore.getState().currentThreadId;
            if (currentThreadId) {
              const progressMessage = {
                id: `node-start-${data.node_name}-${Date.now()}`,
                content: `🚀 开始执行: ${data.node_name}`,
                contentChunks: [`🚀 开始执行: ${data.node_name}`],
                role: "assistant" as const,
                threadId: currentThreadId,
                isStreaming: false,
                agent: undefined,
                resources: [],
                metadata: {
                  nodeEvent: true,
                  nodeType: 'start',
                  nodeName: data.node_name,
                  timestamp: data.timestamp,
                },
                originalInput: {
                  text: '',
                  locale: 'zh-CN',
                  settings: {},
                  resources: [],
                  timestamp: data.timestamp,
                },
              };
              useUnifiedStore.getState().addMessage(currentThreadId, progressMessage);
            }
          },
          onNodeComplete: async (data) => {
            console.log('[WorkspacePage] Node completed:', data.node_name);
            const currentThreadId = useUnifiedStore.getState().currentThreadId;
            if (currentThreadId) {
              const progressMessage = {
                id: `node-complete-${data.node_name}-${Date.now()}`,
                content: `✅ 完成执行: ${data.node_name}${data.duration_ms ? ` (${data.duration_ms}ms)` : ''}`,
                contentChunks: [`✅ 完成执行: ${data.node_name}${data.duration_ms ? ` (${data.duration_ms}ms)` : ''}`],
                role: "assistant" as const,
                threadId: currentThreadId,
                isStreaming: false,
                agent: undefined,
                resources: [],
                metadata: {
                  nodeEvent: true,
                  nodeType: 'complete',
                  nodeName: data.node_name,
                  duration: data.duration_ms,
                  timestamp: data.timestamp,
                },
                originalInput: {
                  text: '',
                  locale: 'zh-CN',
                  settings: {},
                  resources: [],
                  timestamp: data.timestamp,
                },
              };
              useUnifiedStore.getState().addMessage(currentThreadId, progressMessage);
            }
          },
          onPlanGenerated: async (data) => {
            console.log('[WorkspacePage] Plan generated:', data);
            const currentThreadId = useUnifiedStore.getState().currentThreadId;
            if (currentThreadId) {
              const planMessage = {
                id: `plan-${data.execution_id}-${Date.now()}`,
                content: `📋 研究计划已生成 (第${data.plan_iterations}次迭代)`,
                contentChunks: [`📋 研究计划已生成 (第${data.plan_iterations}次迭代)`],
                role: "assistant" as const,
                threadId: currentThreadId,
                isStreaming: false,
                agent: "planner" as const,
                resources: [],
                metadata: {
                  planEvent: true,
                  planData: data.plan_data,
                  planIterations: data.plan_iterations,
                  timestamp: data.timestamp,
                },
                originalInput: {
                  text: '',
                  locale: 'zh-CN',
                  settings: {},
                  resources: [],
                  timestamp: data.timestamp,
                },
              };
              useUnifiedStore.getState().addMessage(currentThreadId, planMessage);
            }
          },
          onSearchResults: async (data) => {
            console.log('[WorkspacePage] Search results:', data);
            const currentThreadId = useUnifiedStore.getState().currentThreadId;
            if (currentThreadId) {
              const searchMessage = {
                id: `search-${data.execution_id}-${Date.now()}`,
                content: `🔍 搜索完成: "${data.query}" (${data.results.length} 个结果)`,
                contentChunks: [`🔍 搜索完成: "${data.query}" (${data.results.length} 个结果)`],
                role: "assistant" as const,
                threadId: currentThreadId,
                isStreaming: false,
                agent: "researcher" as const,
                resources: data.results.map((result: any) => ({
                  uri: result.url || '',
                  title: result.title || '',
                })),
                metadata: {
                  searchEvent: true,
                  query: data.query,
                  source: data.source,
                  resultsCount: data.results.length,
                  timestamp: data.timestamp,
                },
                originalInput: {
                  text: '',
                  locale: 'zh-CN',
                  settings: {},
                  resources: [],
                  timestamp: data.timestamp,
                },
              };
              useUnifiedStore.getState().addMessage(currentThreadId, searchMessage);
            }
          },
          onAgentOutput: async (data) => {
            console.log('[WorkspacePage] Agent output:', data);
            const currentThreadId = useUnifiedStore.getState().currentThreadId;
            if (currentThreadId) {
              const agentMessage = {
                id: `agent-${data.agent_name}-${Date.now()}`,
                content: data.content,
                contentChunks: [data.content],
                role: "assistant" as const,
                threadId: currentThreadId,
                isStreaming: false,
                agent: data.agent_name as any,
                resources: [],
                metadata: {
                  agentEvent: true,
                  agentType: data.agent_type,
                  agentMetadata: data.metadata,
                  timestamp: data.timestamp,
                },
                originalInput: {
                  text: '',
                  locale: 'zh-CN',
                  settings: {},
                  resources: [],
                  timestamp: data.timestamp,
                },
              };
              useUnifiedStore.getState().addMessage(currentThreadId, agentMessage);
            }
          },
          onMessageChunk: async (data) => {
            console.log('[WorkspacePage] Message chunk:', data);
            const currentThreadId = useUnifiedStore.getState().currentThreadId;
            if (currentThreadId) {
              // 🔥 使用新的消息块合并逻辑
              useUnifiedStore.getState().mergeMessageChunk(currentThreadId, {
                execution_id: data.execution_id,
                agent_name: data.agent_name,
                chunk_type: data.chunk_type,
                chunk_id: data.chunk_id,
                content: data.content,
                sequence: data.sequence,
                is_final: data.is_final,
                metadata: data.metadata,
                timestamp: data.timestamp,
              });
            }
          },
          onArtifact: async (data) => {
            console.log('[WorkspacePage] Artifact generated:', data);
            const currentThreadId = useUnifiedStore.getState().currentThreadId;
            if (currentThreadId) {
              const artifactMessage = {
                id: data.artifact_id,
                content: data.content,
                contentChunks: [data.content],
                role: "assistant" as const,
                threadId: currentThreadId,
                isStreaming: false,
                agent: "reporter" as const,
                resources: [],
                metadata: {
                  artifactEvent: true,
                  artifactType: data.type,
                  artifactTitle: data.title,
                  artifactFormat: data.format,
                  artifactMetadata: data.metadata,
                  timestamp: data.timestamp,
                },
                originalInput: {
                  text: '',
                  locale: 'zh-CN',
                  settings: {},
                  resources: [],
                  timestamp: data.timestamp,
                },
              };
              useUnifiedStore.getState().addMessage(currentThreadId, artifactMessage);
            }
          },
          onInterrupt: async (data) => {
            console.log('[WorkspacePage] Interrupt event:', data);
            const currentThreadId = useUnifiedStore.getState().currentThreadId;
            if (currentThreadId) {
              const interruptMessage = {
                id: `interrupt-${data.interrupt_id}-${Date.now()}`,
                content: `⚠️ 需要用户决策: ${data.message}`,
                contentChunks: [`⚠️ 需要用户决策: ${data.message}`],
                role: "assistant" as const,
                threadId: currentThreadId,
                isStreaming: false,
                agent: undefined,
                resources: [],
                metadata: {
                  interruptEvent: true,
                  interruptId: data.interrupt_id,
                  interruptMessage: data.message,
                  interruptOptions: data.options,
                  nodeName: data.node_name,
                  timestamp: data.timestamp,
                },
                finishReason: "interrupt" as const,
                originalInput: {
                  text: '',
                  locale: 'zh-CN',
                  settings: {},
                  resources: [],
                  timestamp: data.timestamp,
                },
              };
              useUnifiedStore.getState().addMessage(currentThreadId, interruptMessage);
            }
          },
          onProgress: async (data) => {
            console.log("[WorkspacePage] Progress event received:", data);
            const currentThreadId = useUnifiedStore.getState().currentThreadId;
            if (currentThreadId) {
              const progressMessage = {
                id: `progress-${data.execution_id}-${Date.now()}`,
                content: `⏳ ${data.current_step_description}`,
                contentChunks: [`⏳ ${data.current_step_description}`],
                role: "assistant" as const,
                threadId: currentThreadId,
                isStreaming: false,
                agent: undefined,
                resources: [],
                metadata: {
                  progressEvent: true,
                  currentNode: data.current_node,
                  completedNodes: data.completed_nodes,
                  remainingNodes: data.remaining_nodes,
                  timestamp: data.timestamp,
                },
                originalInput: {
                  text: '',
                  locale: 'zh-CN',
                  settings: {},
                  resources: [],
                  timestamp: data.timestamp,
                },
              };
              useUnifiedStore.getState().addMessage(currentThreadId, progressMessage);
            }
          },
          onComplete: async (data) => {
            console.log("[WorkspacePage] Research completed:", data);
            const currentThreadId = useUnifiedStore.getState().currentThreadId;
            if (currentThreadId) {
              const completeMessage = {
                id: `complete-${data.execution_id}`,
                content: `🎉 研究完成！总耗时: ${data.total_duration_ms}ms，生成了 ${data.artifacts_generated.length} 个工件`,
                contentChunks: [`🎉 研究完成！总耗时: ${data.total_duration_ms}ms，生成了 ${data.artifacts_generated.length} 个工件`],
                role: "assistant" as const,
                threadId: currentThreadId,
                isStreaming: false,
                agent: undefined,
                resources: [],
                metadata: {
                  completeEvent: true,
                  totalDuration: data.total_duration_ms,
                  tokensConsumed: data.tokens_consumed,
                  totalCost: data.total_cost,
                  artifactsGenerated: data.artifacts_generated,
                  finalStatus: data.final_status,
                  summary: data.summary,
                  timestamp: data.timestamp,
                },
                originalInput: {
                  text: '',
                  locale: 'zh-CN',
                  settings: {},
                  resources: [],
                  timestamp: data.timestamp,
                },
              };
              useUnifiedStore.getState().addMessage(currentThreadId, completeMessage);
            }
          },
          onError: async (data) => {
            console.error("[WorkspacePage] Research error:", data);
            const currentThreadId = useUnifiedStore.getState().currentThreadId;
            if (currentThreadId) {
              const errorMessage = {
                id: `error-${data.execution_id}-${Date.now()}`,
                content: `❌ 错误: ${data.error_message}`,
                contentChunks: [`❌ 错误: ${data.error_message}`],
                role: "assistant" as const,
                threadId: currentThreadId,
                isStreaming: false,
                agent: undefined,
                resources: [],
                metadata: {
                  errorEvent: true,
                  errorCode: data.error_code,
                  errorDetails: data.error_details,
                  suggestions: data.suggestions,
                  timestamp: data.timestamp,
                },
                originalInput: {
                  text: '',
                  locale: 'zh-CN',
                  settings: {},
                  resources: [],
                  timestamp: data.timestamp,
                },
              };
              useUnifiedStore.getState().addMessage(currentThreadId, errorMessage);
            }
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

  // 🚀 对话面板组件 - 使用OutputStream组件
  const ConversationPanel = () => {
    const messages = storeMessages; // 使用已定义的storeMessages
    const responding = useUnifiedStore((state) => state.responding);
    const scrollAreaRef = useRef<HTMLDivElement>(null);

    // 自动滚动到底部
    useEffect(() => {
      if (scrollAreaRef.current) {
        const scrollContainer = scrollAreaRef.current.querySelector('[data-radix-scroll-area-viewport]');
        if (scrollContainer) {
          scrollContainer.scrollTop = scrollContainer.scrollHeight;
        }
      }
    }, [messages]);

    // 过滤和转换消息，只显示对话相关的内容
    const conversationMessages = useMemo(() => {
      if (!messages || messages.length === 0) {
        return [];
      }

      return messages
        .filter((msg: any) => {
          // 只显示用户消息和主要的AI回复，过滤掉技术性的输出流内容
          if (msg.role === 'user') return true;
          if (msg.role === 'assistant' && msg.agent === 'coordinator') return true;
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
        <ScrollArea ref={scrollAreaRef} className="flex-1 px-2">
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
        </ScrollArea>
      </div>
    );
  };

  // 🚀 工件面板组件
  const ArtifactsPanel = () => {
    const currentInterrupt = useUnifiedStore(state =>
      currentThreadId ? state.getCurrentInterrupt(currentThreadId) : null
    );
    
    // 🔥 获取真实的计划数据 - 不依赖interrupt状态
    const getPlanFromMessages = (): any | null => {
      if (!currentThreadId) return null;
      
      const thread = useUnifiedStore.getState().threads.get(currentThreadId);
      if (!thread) return null;
      
      // 🔥 修复：查找包含计划数据的planner消息
      const plannerMessages = thread.messages.filter(msg => 
        msg.agent === 'planner' && msg.metadata?.planEvent === true
      );
      if (plannerMessages.length === 0) return null;
      
      const latestPlanMessage = plannerMessages[plannerMessages.length - 1];
      if (!latestPlanMessage?.metadata?.planData) return null;
      
      try {
        // 🔥 修复：从metadata中获取计划数据，而不是解析content
        const planData = latestPlanMessage.metadata.planData;
        console.log('🔍 Plan data from metadata:', planData);
        
        // 🔥 检查plan_data结构
        if (planData && typeof planData === 'object') {
          // 如果plan_data.plan是字符串，需要解析
          if (planData.plan && typeof planData.plan === 'string') {
            try {
              const actualPlan = JSON.parse(planData.plan);
              console.log('✅ Parsed plan from plan_data.plan:', actualPlan);
              return actualPlan;
            } catch (parseError) {
              console.warn('❌ Failed to parse plan_data.plan string:', parseError);
              return null;
            }
          }
          
          // 如果plan_data直接包含计划数据
          if (planData.title && planData.steps) {
            console.log('✅ Direct plan data found:', planData);
            return planData;
          }
        }
        
        console.warn('⚠️ Plan data structure not recognized:', planData);
        return null;
      } catch (error) {
        console.warn('❌ Failed to process plan data from metadata:', error);
        return null;
      }
    };
    
    // 🔥 重构：获取最新计划，不依赖interrupt状态
    const getLatestPlan = (): ResearchPlan | null => {
      const backendPlan = getPlanFromMessages();
      if (!backendPlan) {
        // 🔥 修复：移除日志输出，避免重复刷新
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
      
      // 使用currentInterrupt的ID，如果没有则生成一个基于时间的ID
      const planId = currentInterrupt?.interruptId || `plan-${Date.now()}`;
      const planTitle = backendPlan.title || '研究计划';
      const planObjective = backendPlan.thought || currentInterrupt?.message || '研究目标';
      
      return {
        id: planId,
        title: planTitle,
        objective: planObjective,
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
    
    // 🔥 检查是否需要显示反馈按钮
    const shouldShowActions = (): boolean => {
      return currentInterrupt !== null;
    };

    // 处理PlanCard回调函数
    const handlePlanApprove = async (planId: string) => {
      if (!currentThreadId || !urlParam) return;
      
      // 获取session_id
      const sessionState = useUnifiedStore.getState().sessionState;
      const sessionId = sessionState?.sessionMetadata?.session_id;
      
      // 🔍 详细调试信息
      console.log('🔍 [handlePlanApprove] Debug sessionState:', {
        sessionState: sessionState,
        sessionMetadata: sessionState?.sessionMetadata,
        session_id: sessionId,
        session_id_type: typeof sessionId,
        currentThreadId: currentThreadId,
        urlParam: urlParam
      });
      
      if (!sessionId) {
        console.error('❌ [handlePlanApprove] Session ID not found for followup request');
        console.error('❌ sessionState详细状态:', sessionState);
        return;
      }
      
      // 🔥 HITL场景：不传递config，使用原始研究配置
      await sendAskMessage({
        question: "",
        askType: "followup",
        config: {} as any, // 🔥 修复：HITL场景下不传递config，后端会使用原始配置
        context: {
          sessionId: sessionId,
          threadId: currentThreadId,
          urlParam: urlParam
        },
        interrupt_feedback: "accepted" // 🔥 正确位置：顶级字段
      });
      
      useUnifiedStore.getState().clearCurrentInterrupt(currentThreadId);
    };

    const handlePlanModify = async (planId: string, modifications: string) => {
      if (!currentThreadId || !urlParam) return;
      
      // 获取session_id
      const sessionState = useUnifiedStore.getState().sessionState;
      const sessionId = sessionState?.sessionMetadata?.session_id;
      
      // 🔍 详细调试信息
      console.log('🔍 [handlePlanModify] Debug sessionState:', {
        sessionState: sessionState,
        sessionMetadata: sessionState?.sessionMetadata,
        session_id: sessionId,
        session_id_type: typeof sessionId,
        currentThreadId: currentThreadId,
        urlParam: urlParam,
        modifications: modifications
      });
      
      if (!sessionId) {
        console.error('❌ [handlePlanModify] Session ID not found for followup request');
        console.error('❌ sessionState详细状态:', sessionState);
        return;
      }
      
      // 🔥 HITL场景：不传递config，使用原始研究配置
      await sendAskMessage({
        question: modifications,
        askType: "followup",
        config: {} as any, // 🔥 修复：HITL场景下不传递config，后端会使用原始配置
        context: {
          sessionId: sessionId,
          threadId: currentThreadId,
          urlParam: urlParam
        },
        interrupt_feedback: "edit_plan" // 🔥 正确位置：顶级字段
      });
      
      useUnifiedStore.getState().clearCurrentInterrupt(currentThreadId);
    };

    const handlePlanSkipToReport = async (planId: string) => {
      if (!currentThreadId || !urlParam) return;
      
      // 获取session_id
      const sessionState = useUnifiedStore.getState().sessionState;
      const sessionId = sessionState?.sessionMetadata?.session_id;
      
      // 🔍 详细调试信息
      console.log('🔍 [handlePlanSkipToReport] Debug sessionState:', {
        sessionState: sessionState,
        sessionMetadata: sessionState?.sessionMetadata,
        session_id: sessionId,
        session_id_type: typeof sessionId,
        currentThreadId: currentThreadId,
        urlParam: urlParam
      });
      
      if (!sessionId) {
        console.error('❌ [handlePlanSkipToReport] Session ID not found for followup request');
        console.error('❌ sessionState详细状态:', sessionState);
        return;
      }
      
      // 🔥 HITL场景：不传递config，使用原始研究配置
      await sendAskMessage({
        question: "",
        askType: "followup",
        config: {} as any, // 🔥 修复：HITL场景下不传递config，后端会使用原始配置
        context: {
          sessionId: sessionId,
          threadId: currentThreadId,
          urlParam: urlParam
        },
        interrupt_feedback: "goto_reporter" // 🔥 正确位置：顶级字段
      });
      
      useUnifiedStore.getState().clearCurrentInterrupt(currentThreadId);
    };

    const handlePlanReask = (planId: string) => {
      if (!currentThreadId) return;
      
      // 🔥 过渡方案：重置当前研究状态，回到workspace初始根界面
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
        msg.agent === 'planner' && msg.metadata?.planEvent === true
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