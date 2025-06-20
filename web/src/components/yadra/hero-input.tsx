"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { createPortal } from "react-dom";
import { useRouter, useSearchParams } from "next/navigation";
import { nanoid } from "nanoid";
import { Send, Paperclip, Lightbulb, ChevronDown, GraduationCap, BookOpen, Newspaper, MessageCircle, Brain, User, StopCircle, Settings } from "lucide-react";
import { MagicWandIcon } from "@radix-ui/react-icons";
import { AnimatePresence, motion } from "framer-motion";
import { cn } from "~/lib/utils";

import { Button } from "~/components/ui/button";
import MessageInput, { type MessageInputRef } from "~/components/yadra/message-input";
import { ReportStyleDialog } from "~/components/yadra/report-style-dialog";
import { Tooltip } from "~/components/yadra/tooltip";
import { enhancePrompt } from "~/core/api/prompt-enhancer";
import { getConfig } from "~/core/api/config";
import { useSettingsStore, setEnableBackgroundInvestigation, setEnableDeepThinking, setReportStyle } from "~/core/store";
import type { Resource } from "~/core/messages";
import { sendMessageAndGetThreadId } from "~/core/api/chat";
import { 
  createResearchStream, 
  isNavigationEvent, 
  isMetadataEvent,
  isPlanGeneratedEvent,
  isAgentOutputEvent,
  isMessageChunkEvent,
  isArtifactEvent,
  isCompleteEvent,
  isErrorEvent,
  buildResearchConfig 
} from "~/core/api/research-stream";
import { 
  createResearchSession,
  validateResearchQuestion,
  buildWorkspaceUrl 
} from "~/core/api/research-create";
import { generateInitialQuestionIDs, getVisitorId } from "~/core/utils";

import { FeedbackSystem } from "~/app/workspace/[traceId]/components/feedback-system";
import { Detective } from "~/components/yadra/icons/detective";
import { 
  useWorkspaceActions, 
  useWorkspaceFeedback,
  useMessageIds,
  sendMessage
} from "~/core/store";
import { 
  useUnifiedStore,
  setCurrentUrlParam,
  setUrlParamMapping,
  setCurrentThreadId,
  setResponding
} from "~/core/store/unified-store";

const PLACEHOLDER_TEXTS = [
  "YADRA能帮助你今天做什么？",
  "分析量子计算的最新发展趋势...",
  "比较各国可再生能源政策...", 
  "研究AI对医疗保健的影响...",
  "调查可持续城市规划策略...",
  "探索区块链在金融领域的应用...",
];

// 报告风格配置 - 使用简洁明确的图标
const REPORT_STYLES = [
  {
    value: "academic" as const,
    label: "学术报告",
    description: "严谨客观，逻辑缜密，适合研究分析",
    icon: GraduationCap,
    color: "text-emerald-400",
  },
  {
    value: "popular_science" as const,
    label: "科普解读", 
    description: "通俗易懂，深入浅出，适合大众传播",
    icon: BookOpen,
    color: "text-blue-400",
  },
  {
    value: "news" as const,
    label: "新闻资讯",
    description: "事实为准，简洁明了，适合快速阅读",
    icon: Newspaper,
    color: "text-orange-400",
  },
  {
    value: "social_media" as const,
    label: "社交媒体",
    description: "生动有趣，观点鲜明，适合分享传播",
    icon: MessageCircle,
    color: "text-purple-400",
  },
];

interface HeroInputProps {
  className?: string;
  traceId?: string;
  placeholder?: string;
  onSendMessage?: (message: string, options?: { 
    resources?: Resource[];
    interruptFeedback?: string;
  }) => void;
  context?: 'homepage' | 'workspace';
}

export function HeroInput({ 
  className, 
  traceId, 
  placeholder: customPlaceholder, 
  onSendMessage, 
  context = 'homepage' 
}: HeroInputProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [currentPlaceholder, setCurrentPlaceholder] = useState(0);
  const [currentPrompt, setCurrentPrompt] = useState("");
  const [isEnhancing, setIsEnhancing] = useState(false);
  const [isEnhanceAnimating, setIsEnhanceAnimating] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showStyleDropdown, setShowStyleDropdown] = useState(false);
  const [dropdownPosition, setDropdownPosition] = useState({ top: 0, left: 0 });
  const [resources, setResources] = useState<Resource[]>([]);
  const [showReportStyleDialog, setShowReportStyleDialog] = useState(false);
  
  const inputRef = useRef<MessageInputRef>(null);
  const styleButtonRef = useRef<HTMLButtonElement>(null);
  const reportStyle = useSettingsStore((state) => state.general.reportStyle);
  const enableDeepThinking = useSettingsStore((state) => state.general.enableDeepThinking);
  const backgroundInvestigation = useSettingsStore((state) => state.general.enableBackgroundInvestigation);
  
  const responding = context === 'workspace' ? useUnifiedStore((state) => state.responding) : false;
  const messageIds = context === 'workspace' ? useMessageIds() : [];
  const feedback = context === 'workspace' ? useWorkspaceFeedback() : null;
  const { removeFeedback } = context === 'workspace' ? useWorkspaceActions() : { removeFeedback: () => {} };

  // 检测basic和reasoning model配置
  const [basicModel, setBasicModel] = useState<string | null>(null);
  const [reasoningModel, setReasoningModel] = useState<string | null>(null);
  
  // 判断是否可以操作（有输入内容且不在响应中）
  const canOperate = currentPrompt.trim() !== "" && !responding;
  
  // 在workspace模式下，如果正在响应，显示终止按钮
  const showStopButton = context === 'workspace' && responding;

  // 计算下拉框位置
  const calculateDropdownPosition = useCallback(() => {
    if (!styleButtonRef.current) return;
    
    const rect = styleButtonRef.current.getBoundingClientRect();
    setDropdownPosition({
      top: rect.bottom + 8, // 按钮下方8px
      left: rect.left,
    });
  }, []);

  // 显示下拉框时计算位置
  const handleShowDropdown = useCallback((show: boolean) => {
    if (show) {
      calculateDropdownPosition();
    }
    setShowStyleDropdown(show);
  }, [calculateDropdownPosition]);
  
  useEffect(() => {
    try {
      const config = getConfig();
      const basic = config.models.basic?.[0];
      const reasoning = config.models.reasoning?.[0];
      setBasicModel(basic || null);
      setReasoningModel(reasoning || null);
    } catch (error) {
      // Config not loaded yet or no models configured
      setBasicModel(null);
      setReasoningModel(null);
    }
  }, []);

  useEffect(() => {
    const reaskText = searchParams.get('reask');
    if (reaskText && inputRef.current) {
      console.log("检测到reask参数:", reaskText);
      inputRef.current.setContent(reaskText);
      setCurrentPrompt(reaskText);
      
      const newUrl = window.location.pathname;
      window.history.replaceState({}, '', newUrl);
    }
  }, [searchParams]);

  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentPlaceholder((prev) => (prev + 1) % PLACEHOLDER_TEXTS.length);
    }, 4000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    setEnableBackgroundInvestigation(true);
  }, []);

  // 点击外部关闭下拉菜单
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (styleButtonRef.current && !styleButtonRef.current.contains(event.target as Node)) {
        setShowStyleDropdown(false);
      }
    };
    
    if (showStyleDropdown) {
      document.addEventListener('click', handleClickOutside);
      return () => document.removeEventListener('click', handleClickOutside);
    }
  }, [showStyleDropdown]);

  // 监听窗口resize和scroll，重新计算位置
  useEffect(() => {
    if (!showStyleDropdown) return;

    const handleResize = () => calculateDropdownPosition();
    const handleScroll = () => calculateDropdownPosition();

    window.addEventListener('resize', handleResize);
    window.addEventListener('scroll', handleScroll, true);
    
    return () => {
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('scroll', handleScroll, true);
    };
  }, [showStyleDropdown, calculateDropdownPosition]);

  const handleSubmit = useCallback(
    async (e?: React.FormEvent) => {
      if (e) e.preventDefault();
      if (!currentPrompt.trim() || !canOperate || isSubmitting || responding) return;

      if (context === 'workspace' && onSendMessage) {
        try {
          await onSendMessage(currentPrompt, {
            resources,
            interruptFeedback: feedback?.option.value,
          });
          setCurrentPrompt("");
          setResources([]);
          
          if (feedback) {
            removeFeedback();
          }
        } catch (error) {
          console.error("Failed to send message:", error);
        }
      } else {
        // 🔥 两步分离架构 - Step 1: 创建研究任务
        setIsSubmitting(true);
        
        try {
          // 验证问题有效性
          if (!validateResearchQuestion(currentPrompt)) {
            alert('问题长度必须在1-2000字符之间');
            setIsSubmitting(false);
            return;
          }
          
          // 构建配置 - 保持原有嵌套格式，但添加auto_accepted_plan
          const settings = useSettingsStore.getState().general;
          const config = {
            research: {
              report_style: settings.reportStyle,
              enable_web_search: true,
              max_research_depth: 3,
              enable_deep_thinking: settings.enableDeepThinking,
              enable_background_investigation: settings.enableBackgroundInvestigation,
              auto_accepted_plan: settings.autoAcceptedPlan, // 🔥 关键：包含用户的autoAcceptedPlan设置
            },
            model: {
              provider: "anthropic",
              model_name: "claude-3-5-sonnet",
              temperature: 0.7,
              top_p: 0.9,
              max_tokens: 4000,
            },
            output: {
              language: "zhCN",
              output_format: "markdown",
              include_artifacts: true,
              include_citations: true,
            },
            preferences: {
            maxPlanIterations: settings.maxPlanIterations,
            maxStepNum: settings.maxStepNum,
            maxSearchResults: settings.maxSearchResults,
            }
          };
          
          console.log('[HandleSubmit] Creating research session with two-step architecture...');
          
          // Step 1: 快速创建会话并获取url_param
          const createResponse = await createResearchSession(currentPrompt, config);
          
          console.log('[HandleSubmit] Research session created:', {
            url_param: createResponse.url_param,
            workspace_url: createResponse.workspace_url,
            estimated_duration: createResponse.estimated_duration
          });
          
          // 清空输入框 (立即反馈)
          setCurrentPrompt("");
          if (inputRef.current) {
            inputRef.current.setContent("");
          }
          
          // Step 2: 立即跳转到workspace页面
          console.log('[HandleSubmit] Navigating to workspace...');
          
          // 🔥 通过URL查询参数传递ask响应数据，避免后续workspace查询
          const workspaceUrl = new URL(createResponse.workspace_url, window.location.origin);
          workspaceUrl.searchParams.set('thread_id', createResponse.thread_id);
          workspaceUrl.searchParams.set('session_id', createResponse.session_id.toString());
          workspaceUrl.searchParams.set('frontend_uuid', createResponse.frontend_uuid);
          workspaceUrl.searchParams.set('action', 'continue'); // SSE action类型
          
          console.log('[HandleSubmit] Workspace URL with params:', workspaceUrl.toString());
          router.push(workspaceUrl.toString());
          
          // 设置正在提交状态为false（导航后在workspace页面处理）
          setIsSubmitting(false);
          
        } catch (error: any) {
          console.error("Failed to create research session:", error);
          
          // 更详细的错误处理
          let errorMessage = '创建研究任务失败';
          if (error.message) {
            if (error.message.includes('API request failed: 500')) {
              errorMessage = '服务器内部错误，请稍后重试';
            } else if (error.message.includes('API request failed: 400')) {
              errorMessage = '请求参数错误，请检查问题内容';
            } else if (error.message.includes('Failed to fetch')) {
              errorMessage = '网络连接失败，请检查网络连接';
            } else {
              errorMessage = error.message;
            }
          }
          
          alert(`错误: ${errorMessage}`);
          setIsSubmitting(false);
        }
      }
    },
    [currentPrompt, canOperate, reportStyle, enableDeepThinking, router, isSubmitting, responding, context, onSendMessage, resources, feedback, removeFeedback]
  );

  // 监听示例问题选择事件
  useEffect(() => {
    const handleQuestionSelect = (event: CustomEvent<{ question: string }>) => {
      const { question } = event.detail;
      if (question) {
        setCurrentPrompt(question);
                  // 自动发送选中的问题
          setTimeout(() => {
            handleSubmit();
          }, 100);
      }
    };

    window.addEventListener('heroQuestionSelect', handleQuestionSelect as EventListener);
    return () => {
      window.removeEventListener('heroQuestionSelect', handleQuestionSelect as EventListener);
    };
  }, [handleSubmit]);

  const handleEnhancePrompt = useCallback(async () => {
    if (currentPrompt.trim() === "" || isEnhancing) {
      return;
    }

    setIsEnhancing(true);
    setIsEnhanceAnimating(true);

    try {
      const enhancedPrompt = await enhancePrompt({
        prompt: currentPrompt,
        report_style: reportStyle.toUpperCase(),
      });

      await new Promise((resolve) => setTimeout(resolve, 500));

      if (inputRef.current) {
        inputRef.current.setContent(enhancedPrompt);
        setCurrentPrompt(enhancedPrompt);
      }

      setTimeout(() => {
        setIsEnhanceAnimating(false);
      }, 1000);
    } catch (error) {
      console.error("Failed to enhance prompt:", error);
      setIsEnhanceAnimating(false);
    } finally {
      setIsEnhancing(false);
    }
  }, [currentPrompt, isEnhancing, reportStyle]);

  // 获取当前选择的风格
  const currentStyleConfig = REPORT_STYLES.find((style) => style.value === reportStyle) || REPORT_STYLES[0]!;
  const CurrentStyleIcon = currentStyleConfig.icon;

  // Portal 下拉框组件
  const StyleDropdown = () => {
    if (!showStyleDropdown) return null;
    
    return createPortal(
      <AnimatePresence>
        <motion.div
          initial={{ opacity: 0, y: -10, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -10, scale: 0.95 }}
          transition={{ duration: 0.15 }}
          className="w-56 border border-white/20 bg-white/5 backdrop-blur-xl rounded-xl shadow-2xl overflow-hidden"
          style={{ 
            position: 'fixed',
            top: dropdownPosition.top,
            left: dropdownPosition.left,
            zIndex: 99999,
          }}
          onMouseEnter={() => setShowStyleDropdown(true)}
          onMouseLeave={() => setShowStyleDropdown(false)}
          onClick={(e) => e.stopPropagation()}
        >
          <div className="p-2 space-y-1">
            {REPORT_STYLES.map((style) => {
              const StyleIcon = style.icon;
              const isSelected = reportStyle === style.value;
              
              return (
                <button
                  key={style.value}
                  onClick={() => {
                    setReportStyle(style.value);
                    setShowStyleDropdown(false);
                  }}
                  className={cn(
                    "w-full flex items-center gap-3 p-3 rounded-lg text-left transition-all duration-200",
                    "backdrop-blur-sm border",
                    isSelected 
                      ? "bg-blue-500/20 text-blue-300 border-blue-400/30 shadow-[0_0_20px_rgba(59,130,246,0.2)]" 
                      : "text-gray-300 hover:bg-white/5 hover:text-white border-transparent hover:border-white/10"
                  )}
                >
                  <div className={cn(
                    "flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border backdrop-blur-sm transition-all duration-300",
                    isSelected 
                      ? "border-blue-400/50 bg-blue-500/20" 
                      : "border-white/20 bg-white/10"
                  )}>
                    <StyleIcon className={cn(
                      "h-4 w-4 transition-colors duration-300",
                      isSelected ? "text-blue-300" : style.color
                    )} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium">{style.label}</div>
                    <div className="text-xs text-gray-400 truncate">{style.description}</div>
                  </div>
                </button>
              );
            })}
          </div>
        </motion.div>
      </AnimatePresence>,
      document.body
    );
  };

  return (
    <div className={cn("mx-auto w-full max-w-4xl", className)}>
      {/* Feedback system for workspace context */}
      {context === 'workspace' && feedback && (
        <div className="mb-4">
          <FeedbackSystem
            feedback={feedback}
            onRemoveFeedback={removeFeedback}
            variant="compact"
          />
        </div>
      )}
      
      {/* Settings toggles for workspace context */}
      {context === 'workspace' && (
        <div className="mb-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            {reasoningModel && (
              <Tooltip
                delayDuration={300}
                className="max-w-xs border border-white/20 bg-black/90 backdrop-blur-sm text-white shadow-xl"
                title={
                  <div className="p-2">
                    <p className="mb-2 font-medium text-blue-300">
                      {enableDeepThinking ? "推理模式" : "常规模式"}
                    </p>
                    <p className="text-xs text-gray-300 leading-relaxed">
                      {enableDeepThinking 
                        ? "AI将进行深度思考和推理，生成更加深思熟虑的研究计划"
                        : "AI将以常规模式处理您的问题，快速生成研究计划"
                      }
                    </p>
                    <div className="mt-2 pt-2 border-t border-white/10">
                      <p className="text-xs text-gray-400">
                        使用模型：{enableDeepThinking ? reasoningModel : basicModel}
                      </p>
                    </div>
                  </div>
                }
              >
                <button
                  type="button"
                  onClick={() => setEnableDeepThinking(!enableDeepThinking)}
                  className={cn(
                    "group relative overflow-hidden rounded-lg border h-9 px-3 text-xs font-medium transition-all duration-300",
                    "backdrop-blur-sm flex items-center gap-1.5",
                    enableDeepThinking
                      ? "border-blue-400/50 bg-blue-500/20 text-blue-300 shadow-[0_0_20px_rgba(59,130,246,0.3)]"
                      : "border-gray-200/20 bg-gray-50/5 text-gray-600 hover:border-gray-300/30 hover:bg-gray-100/10 hover:text-gray-800"
                  )}
                >
                  {enableDeepThinking && (
                    <div className="absolute inset-0 bg-gradient-to-r from-blue-500/10 via-purple-500/10 to-blue-500/10 opacity-50"></div>
                  )}
                  <div className="relative z-10 flex items-center gap-1.5">
                    <Lightbulb 
                      className={cn(
                        "h-5 w-5 transition-all duration-300",
                        enableDeepThinking 
                          ? "text-blue-300 drop-shadow-[0_0_6px_rgba(59,130,246,0.8)]" 
                          : "text-gray-500 group-hover:text-gray-700"
                      )} 
                    />
                    <span>推理模式</span>
                  </div>
                  <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/5 to-transparent opacity-0 transition-opacity duration-300 group-hover:opacity-100"></div>
                </button>
              </Tooltip>
            )}

            <Tooltip
              delayDuration={300}
              className="max-w-xs border border-white/20 bg-black/90 backdrop-blur-sm text-white shadow-xl"
              title={
                <div className="p-2">
                  <p className="mb-2 font-medium text-green-300">调研模式</p>
                  <p className="text-xs text-gray-300 leading-relaxed">
                    {backgroundInvestigation ? "已启用" : "已关闭"} - 
                    在制定计划前进行快速搜索，适用于时事热点和最新动态研究
                  </p>
                </div>
              }
            >
              <button
                type="button"
                onClick={() => setEnableBackgroundInvestigation(!backgroundInvestigation)}
                className={cn(
                  "group relative overflow-hidden rounded-lg border h-9 px-3 text-xs font-medium transition-all duration-300",
                  "backdrop-blur-sm flex items-center gap-1.5",
                  backgroundInvestigation
                    ? "border-green-400/50 bg-green-500/20 text-green-300 shadow-[0_0_20px_rgba(34,197,94,0.3)]"
                    : "border-gray-200/20 bg-gray-50/5 text-gray-600 hover:border-gray-300/30 hover:bg-gray-100/10 hover:text-gray-800"
                )}
              >
                {backgroundInvestigation && (
                  <div className="absolute inset-0 bg-gradient-to-r from-green-500/10 via-emerald-500/10 to-green-500/10 opacity-50"></div>
                )}
                <div className="relative z-10 flex items-center gap-1.5">
                  <Detective 
                    className={cn(
                      "h-5 w-5 transition-all duration-300",
                      backgroundInvestigation 
                        ? "text-green-300 drop-shadow-[0_0_6px_rgba(34,197,94,0.8)]" 
                        : "text-gray-500 group-hover:text-gray-700"
                    )} 
                  />
                  <span>调研模式</span>
                </div>
                <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/5 to-transparent opacity-0 transition-opacity duration-300 group-hover:opacity-100"></div>
              </button>
            </Tooltip>
          </div>

          <div className="flex items-center gap-2">
            <ReportStyleDialog />
          </div>
        </div>
      )}
      
      {/* Resources display for workspace context */}
      {context === 'workspace' && resources.length > 0 && (
        <div className="mb-4 flex flex-wrap gap-2">
          {resources.map((resource, index) => (
            <div
              key={index}
              className="flex items-center gap-2 rounded-md bg-muted px-3 py-1 text-sm"
            >
              <Paperclip className="h-3 w-3" />
              <span className="truncate max-w-32">{resource.title}</span>
              <button
                onClick={() => setResources(prev => prev.filter((_, i) => i !== index))}
                className="text-muted-foreground hover:text-foreground"
              >
                ×
              </button>
            </div>
          ))}
        </div>
      )}
      
      <div className="relative">
        <div className="relative overflow-hidden rounded-xl border border-white/20 bg-white/5 backdrop-blur-sm transition-all duration-200 focus-within:border-white/30 focus-within:bg-white/10">
          <AnimatePresence>
            {isEnhanceAnimating && (
              <motion.div
                className="pointer-events-none absolute inset-0 z-20"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.3 }}
              >
                <div className="relative h-full w-full">
                  <motion.div
                    className="absolute inset-0 rounded-xl bg-gradient-to-r from-blue-500/10 via-purple-500/10 to-blue-500/10"
                    animate={{
                      background: [
                        "linear-gradient(45deg, rgba(59, 130, 246, 0.1), rgba(147, 51, 234, 0.1), rgba(59, 130, 246, 0.1))",
                        "linear-gradient(225deg, rgba(147, 51, 234, 0.1), rgba(59, 130, 246, 0.1), rgba(147, 51, 234, 0.1))",
                        "linear-gradient(45deg, rgba(59, 130, 246, 0.1), rgba(147, 51, 234, 0.1), rgba(59, 130, 246, 0.1))",
                      ],
                    }}
                    transition={{ duration: 2, repeat: Infinity }}
                  />
                  {[...Array(6)].map((_, i) => (
                    <motion.div
                      key={i}
                      className="absolute h-2 w-2 rounded-full bg-blue-400"
                      style={{
                        left: `${20 + i * 12}%`,
                        top: `${30 + (i % 2) * 40}%`,
                      }}
                      animate={{
                        y: [-10, -20, -10],
                        opacity: [0, 1, 0],
                        scale: [0.5, 1, 0.5],
                      }}
                      transition={{
                        duration: 1.5,
                        repeat: Infinity,
                        delay: i * 0.2,
                      }}
                    />
                  ))}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
          
          <MessageInput
            ref={inputRef}
            className="min-h-[80px] px-4 py-4 sm:px-6 sm:py-6"
            placeholder={context === 'homepage' ? PLACEHOLDER_TEXTS[currentPlaceholder] : (customPlaceholder || "继续对话...")}
            onChange={setCurrentPrompt}
                         onEnter={() => handleSubmit()}
          />
          
          {/* 去掉分割线，统一按钮高度为 h-9 */}
          <div className="flex items-center justify-between px-4 py-3 sm:px-6">
            <div className="flex items-center gap-2">
              {/* 风格选择按钮 - 只显示图标，去掉外框 */}
              <div className="relative">
                <button
                  ref={styleButtonRef}
                  type="button"
                  onMouseEnter={() => handleShowDropdown(true)}
                  onMouseLeave={() => handleShowDropdown(false)}
                  onClick={(e) => {
                    e.stopPropagation();
                    handleShowDropdown(!showStyleDropdown);
                  }}
                  className={cn(
                    "group relative overflow-hidden rounded-lg h-9 px-3 text-xs font-medium transition-all duration-300",
                    "backdrop-blur-sm flex items-center gap-2",
                    showStyleDropdown
                      ? "bg-blue-500/20 text-blue-300"
                      : "bg-white/5 text-gray-300 hover:bg-white/10 hover:text-white"
                  )}
                >
                  <CurrentStyleIcon className={cn(
                    "h-4 w-4 transition-colors duration-300",
                    showStyleDropdown ? "text-blue-300" : currentStyleConfig.color
                  )} />
                  <span className="hidden sm:inline">写作风格</span>
                  <span className="sm:hidden">风格</span>
                  <ChevronDown className={cn(
                    "h-3 w-3 transition-transform duration-200",
                    showStyleDropdown && "rotate-180"
                  )} />
                  
                  {/* hover 光效 */}
                  <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/5 to-transparent opacity-0 transition-opacity duration-300 group-hover:opacity-100"></div>
                </button>
              </div>

              {/* 推理模式 Toggle 按钮 - 仅在配置了reasoning model时显示，去掉外框 */}
              {reasoningModel && (
                <Tooltip
                  delayDuration={300}
                  side="bottom"
                  sideOffset={8}
                  className="max-w-xs border border-white/20 bg-black/90 backdrop-blur-sm text-white shadow-xl"
                  title={
                    <div className="p-2">
                      <p className="mb-2 font-medium text-blue-300">
                        {enableDeepThinking ? "推理模式" : "常规模式"}
                      </p>
                      <p className="text-xs text-gray-300 leading-relaxed">
                        {enableDeepThinking 
                          ? "AI将进行深度思考和推理，生成更加深思熟虑的研究计划"
                          : "AI将以常规模式处理您的问题，快速生成研究计划"
                        }
                      </p>
                      <div className="mt-2 pt-2 border-t border-white/10">
                        <p className="text-xs text-gray-400">
                          使用模型：{enableDeepThinking ? reasoningModel : basicModel}
                        </p>
                      </div>
                    </div>
                  }
                >
                  <button
                    type="button"
                    onClick={() => setEnableDeepThinking(!enableDeepThinking)}
                    className="group relative overflow-hidden rounded-lg h-9 px-1 transition-all duration-300 backdrop-blur-sm flex items-center hover:bg-white/5"
                  >
                    {/* Toggle 滑块背景 - 去掉外框 */}
                    <div className="relative w-12 h-6 rounded-full bg-white/10">
                      {/* 滑块 */}
                      <motion.div
                        className={cn(
                          "absolute top-1/2 -translate-y-1/2 w-5 h-5 rounded-full transition-all duration-300 flex items-center justify-center",
                          enableDeepThinking 
                            ? "left-[26px] bg-gradient-to-r from-purple-500 to-pink-500 shadow-[0_0_15px_rgba(168,85,247,0.6)]" 
                            : "left-[2px] bg-blue-400"
                        )}
                        layout
                      >
                        {enableDeepThinking ? (
                          <Brain className="h-4 w-4 text-white" />
                        ) : (
                          <User className="h-4 w-4 text-white" />
                        )}
                      </motion.div>
                    </div>
                    
                    {/* hover 光效 */}
                    <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/5 to-transparent opacity-0 transition-opacity duration-300 group-hover:opacity-100"></div>
                  </button>
                </Tooltip>
              )}
            </div>
            
            <div className="flex items-center gap-2">
              {/* File attachment button for workspace context */}
              {context === 'workspace' && (
                <Tooltip title="附加文件">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-9 w-9 p-0 text-gray-600 hover:text-brand dark:text-gray-400 dark:hover:text-brand"
                    disabled={responding}
                  >
                    <Paperclip className="h-4 w-4" />
                  </Button>
                </Tooltip>
              )}
              
              {/* 提示词优化按钮 - 主题色底色，白色图标 */}
              {context === 'homepage' && (
                <Tooltip 
                  delayDuration={300}
                  side="bottom"
                  sideOffset={8}
                  className="border border-white/20 bg-black/90 backdrop-blur-sm text-white shadow-xl"
                  title="AI增强提示 - 让AI优化您的问题描述"
                >
                  <Button
                    variant="ghost"
                    size="sm"
                    className={cn(
                      "h-9 w-9 p-0 border transition-all duration-300",
                      canOperate
                        ? "border-blue-500/50 bg-blue-600/80 hover:bg-blue-600 hover:shadow-[0_0_20px_rgba(59,130,246,0.4)]"
                        : "border-gray-400/20 bg-gray-500/20 cursor-not-allowed",
                      isEnhancing && "animate-pulse border-blue-400/50 bg-blue-500/20"
                    )}
                    onClick={handleEnhancePrompt}
                    disabled={!canOperate || isEnhancing}
                  >
                    {isEnhancing ? (
                      <div className="h-3 w-3 animate-bounce rounded-full bg-white shadow-[0_0_10px_rgba(255,255,255,0.8)]" />
                    ) : (
                      <MagicWandIcon className={cn(
                        "h-4 w-4 transition-colors",
                        canOperate ? "text-white" : "text-gray-500"
                      )} />
                    )}
                  </Button>
                </Tooltip>
              )}
              
              {/* 发送/停止按钮 */}
              <Tooltip
                delayDuration={300}
                side="bottom"
                sideOffset={8}
                className="border border-white/20 bg-black/90 backdrop-blur-sm text-white shadow-xl"
                title={responding ? "停止生成" : (canOperate ? (isSubmitting ? "正在处理..." : "发送消息") : "请输入消息")}
              >
                <Button
                                     onClick={responding ? () => {} : () => handleSubmit()}
                  disabled={!canOperate || (isSubmitting && !responding)}
                  className={cn(
                    "h-9 w-9 p-0 rounded-lg border transition-all duration-300",
                    canOperate && !isSubmitting
                      ? "border-blue-500/50 bg-blue-600/80 hover:bg-blue-600 hover:shadow-[0_0_20px_rgba(59,130,246,0.4)]"
                      : "border-gray-400/20 bg-gray-500/20 cursor-not-allowed"
                  )}
                >
                  {responding ? (
                    <StopCircle className="h-4 w-4" />
                  ) : isSubmitting ? (
                    <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                  ) : (
                    <Send className={cn(
                      "h-4 w-4 transition-colors",
                      canOperate ? "text-white" : "text-gray-500"
                    )} />
                  )}
                </Button>
              </Tooltip>
            </div>
          </div>
        </div>
      </div>

      {/* Portal 渲染的下拉框 */}
      <StyleDropdown />
    </div>
  );
}
