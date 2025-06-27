"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { createPortal } from "react-dom";
import { useRouter, useSearchParams } from "next/navigation";
import { Send, ChevronDown, GraduationCap, BookOpen, Newspaper, MessageCircle, Brain, User, StopCircle } from "lucide-react";
import { MagicWandIcon } from "@radix-ui/react-icons";
import { AnimatePresence, motion } from "framer-motion";
import { cn } from "~/lib/utils";

import { Button } from "~/components/ui/button";
import MessageInput, { type MessageInputRef } from "~/components/yadra/message-input";
import { Tooltip } from "~/components/yadra/tooltip";
import { enhancePrompt } from "~/core/api/prompt-enhancer";
import { useSettingsStore, setEnableDeepThinking, setReportStyle } from "~/core/store";
import { useUnifiedStore, useFinalReport, setResponding, setCurrentUrlParam, setUrlParamMapping, setCurrentThreadId } from "~/core/store/unified-store";
import { fetchStream } from "~/core/sse/fetch-stream";
import { resolveServiceURL } from "~/core/api/resolve-service-url";
import { generateInitialQuestionIDs, getVisitorId } from "~/core/utils";

const PLACEHOLDER_TEXTS = [
  "YADRA能帮助你今天做什么？",
  "分析量子计算的最新发展趋势...",
  "比较各国可再生能源政策...", 
  "研究AI对医疗保健的影响...",
  "调查可持续城市规划策略...",
  "探索区块链在金融领域的应用...",
];

// 报告风格配置
const REPORT_STYLES = [
  {
    value: "academic" as const,
    label: "研究报告",
    description: "严谨客观，数据翔实，适合研究分析",
    icon: GraduationCap,
    color: "text-emerald-400",
  },
  {
    value: "popular_science" as const,
    label: "科普博客", 
    description: "观点清晰，通俗易懂，适合大众传播",
    icon: BookOpen,
    color: "text-blue-400",
  },
  {
    value: "news" as const,
    label: "新闻稿件",
    description: "采用专业新闻风格，适合快速阅读",
    icon: Newspaper,
    color: "text-orange-400",
  },
  {
    value: "social_media" as const,
    label: "社媒文案",
    description: "小红书/X风格，适合分享传播",
    icon: MessageCircle,
    color: "text-purple-400",
  },
];

interface HeroInputProps {
  className?: string;
  placeholder?: string;
  // 🚀 ASK API研究请求回调
  onSubmitResearch?: (request: import("~/core/store/unified-store").ResearchRequest) => Promise<void>;
}

export function HeroInput({ 
  className, 
  placeholder: customPlaceholder, 
  onSubmitResearch
}: HeroInputProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [currentPlaceholder, setCurrentPlaceholder] = useState(0);
  const [currentPrompt, setCurrentPrompt] = useState("");
  const [isEnhancing, setIsEnhancing] = useState(false);
  const [isEnhanceAnimating, setIsEnhanceAnimating] = useState(false);
  const [showStyleDropdown, setShowStyleDropdown] = useState(false);
  const [dropdownPosition, setDropdownPosition] = useState({ top: 0, left: 0 });
  
  const inputRef = useRef<MessageInputRef>(null);
  const styleButtonRef = useRef<HTMLButtonElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const reportStyle = useSettingsStore((state) => state.general.reportStyle);
  const enableDeepThinking = useSettingsStore((state) => state.general.enableDeepThinking);
  
  // 统一使用responding状态
  const responding = useUnifiedStore((state) => state.responding);
  
  // 获取当前线程ID用于检测任务完成状态
  const currentThreadId = useUnifiedStore((state) => state.currentThreadId);
  const finalReport = useFinalReport(currentThreadId || undefined);
  
  // 判断是否可以操作：只有任务完全完成（生成报告）后才允许发送新消息
  const isTaskCompleted = finalReport !== null;
  const canOperate = currentPrompt.trim() !== "" && !responding && (isTaskCompleted || !currentThreadId);

  // 计算上拉框位置
  const calculateDropdownPosition = useCallback(() => {
    if (!styleButtonRef.current) return;
    
    const rect = styleButtonRef.current.getBoundingClientRect();
    const dropdownHeight = 280; // 大概的下拉框高度
    const newTop = rect.top - dropdownHeight - 8; // 在按钮上方显示
    const newLeft = rect.left;
    
    // 只有位置真正变化时才更新状态
    setDropdownPosition(prev => {
      if (prev.top === newTop && prev.left === newLeft) {
        return prev; // 返回相同的对象引用，避免重新渲染
      }
      return { top: newTop, left: newLeft };
    });
  }, []);



  useEffect(() => {
    const reaskText = searchParams.get('reask');
    if (reaskText && inputRef.current) {
  
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
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node;
      const isClickInButton = styleButtonRef.current && styleButtonRef.current.contains(target);
      const isClickInDropdown = dropdownRef.current && dropdownRef.current.contains(target);
      
      if (!isClickInButton && !isClickInDropdown) {
        setShowStyleDropdown(false);
      }
    };

    const handleResize = () => calculateDropdownPosition();

    if (showStyleDropdown) {
      document.addEventListener('mousedown', handleClickOutside);
      window.addEventListener('resize', handleResize);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      window.removeEventListener('resize', handleResize);
    };
  }, [showStyleDropdown]);

  // 🚀 构建研究配置的辅助函数
  const buildResearchConfig = useCallback(() => {
    const settings = useSettingsStore.getState().general;
    
    return {
      autoAcceptedPlan: settings.autoAcceptedPlan,
      enableBackgroundInvestigation: settings.enableBackgroundInvestigation,
      reportStyle: settings.reportStyle,
      enableDeepThinking: settings.enableDeepThinking,
      maxPlanIterations: settings.maxPlanIterations,
      maxStepNum: settings.maxStepNum,
      maxSearchResults: settings.maxSearchResults
    };
  }, []); // 不需要依赖，因为直接从 store 获取最新值

  const handleSubmit = useCallback(async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!currentPrompt.trim() || !canOperate || responding) return;

    if (onSubmitResearch) {
      // 🚀 ASK API研究请求回调
      try {
        const researchRequest = {
          question: currentPrompt,
          askType: 'initial' as const,
          config: buildResearchConfig()
        };
        

        
        await onSubmitResearch(researchRequest);
        
        // 清空输入框
        setCurrentPrompt("");
        if (inputRef.current) {
          inputRef.current.setContent("");
        }
        
      } catch (error) {
        console.error("[HeroInput] Research request failed:", error);
      }
    } else {
      // 🔥 如果没有回调，显示提示

    }
  }, [currentPrompt, canOperate, responding, onSubmitResearch, buildResearchConfig]);

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

  return (
    <div className={cn("mx-auto w-full max-w-4xl", className)}>
      <div className="relative">
        <div className="relative w-full">
          <div className="relative w-full overflow-hidden rounded-xl border border-border bg-transparent shadow-sm transition-all duration-300 focus-within:border-primary focus-within:shadow-md">
            {/* 文字输入区域 */}
            <div className="p-4 bg-white">
              <textarea
                value={currentPrompt}
                onChange={(e) => setCurrentPrompt(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    handleSubmit();
                  }
                }}
                placeholder={customPlaceholder || PLACEHOLDER_TEXTS[currentPlaceholder]}
                                  className="w-full resize-none bg-transparent text-sm text-foreground placeholder-muted-foreground outline-none border-none"
                rows={2}
                style={{ 
                  minHeight: '48px', // 2行的最小高度
                  maxHeight: '168px', // 7行的最大高度 (24px * 7)
                  lineHeight: '24px',
                  overflowY: currentPrompt.split('\n').length > 7 || currentPrompt.length > 280 ? 'auto' : 'hidden'
                }}
                onInput={(e) => {
                  const target = e.target as HTMLTextAreaElement;
                  target.style.height = 'auto';
                  target.style.height = Math.min(target.scrollHeight, 168) + 'px';
                }}
              />
            </div>
            
            {/* 控制按钮行 - 始终在底部 */}
                          <div className="flex items-center justify-between px-4 pb-4 border-t border-border/40 bg-white">
              {/* 左侧控制组 */}
              <div className="flex items-center gap-2">
                {/* 写作风格选择器 */}
                <div className="relative">
                  <button
                    ref={styleButtonRef}
                    type="button"
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      if (showStyleDropdown) {
                        setShowStyleDropdown(false);
                      } else {
                        calculateDropdownPosition();
                        setShowStyleDropdown(true);
                      }
                    }}
                    className={cn(
                      "group relative overflow-hidden rounded-lg h-9 px-3 text-xs font-medium transition-all duration-300",
                      "backdrop-blur-sm flex items-center gap-2",
                      showStyleDropdown
                        ? "bg-blue-50 text-blue-700"
                        : "bg-muted text-muted-foreground hover:bg-muted/80 hover:text-foreground"
                    )}
                  >
                    <CurrentStyleIcon className={cn(
                      "h-4 w-4 transition-colors duration-300",
                      showStyleDropdown ? "text-blue-600" : currentStyleConfig.color
                    )} />
                    <span className="hidden sm:inline">写作风格</span>
                    <span className="sm:hidden">风格</span>
                    <ChevronDown className={cn(
                      "h-3 w-3 transition-transform duration-200 rotate-180",
                      showStyleDropdown && "rotate-0"
                    )} />
                    
                    <div className="absolute inset-0 bg-gradient-to-r from-transparent via-gray-200/20 to-transparent opacity-0 transition-opacity duration-300 group-hover:opacity-100"></div>
                  </button>
                </div>

                {/* 推理模式 Toggle 按钮 */}
                <Tooltip
                  delayDuration={300}
                  side="top"
                  sideOffset={8}
                  className="max-w-xs border border-gray-200 bg-white backdrop-blur-sm text-gray-900 shadow-xl"
                  title={
                    <div className="p-2">
                      <p className="mb-2 font-medium text-gray-900">
                        {enableDeepThinking ? "推理模式" : "常规模式"}
                      </p>
                      <p className="text-xs text-gray-600 leading-relaxed">
                        {enableDeepThinking 
                          ? "使用DeepSeek R1，生成更加深思熟虑的研究计划"
                          : "使用Gemini 2.5 Flash，快速生成研究计划"
                        }
                      </p>
                    </div>
                  }
                >
                  <button
                    type="button"
                    onClick={() => setEnableDeepThinking(!enableDeepThinking)}
                    className="group relative overflow-hidden rounded-lg h-9 px-1 transition-all duration-300 backdrop-blur-sm flex items-center hover:bg-gray-50"
                  >
                    <div className="relative w-12 h-6 rounded-full bg-gray-200">
                      <motion.div
                        className={cn(
                          "absolute top-1/2 -translate-y-1/2 w-5 h-5 rounded-full transition-all duration-300 flex items-center justify-center",
                          enableDeepThinking 
                            ? "left-[26px] bg-gradient-to-r from-purple-500 to-pink-500 shadow-[0_0_15px_rgba(168,85,247,0.6)]" 
                            : "left-[2px] bg-blue-500"
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
                    
                    <div className="absolute inset-0 bg-gradient-to-r from-transparent via-gray-200/20 to-transparent opacity-0 transition-opacity duration-300 group-hover:opacity-100"></div>
                  </button>
                </Tooltip>
              </div>
              
              {/* 右侧操作组 */}
              <div className="flex items-center gap-2">
                {/* 提示词优化按钮 */}
                <Tooltip 
                  delayDuration={300}
                  side="top"
                  sideOffset={8}
                  className="border border-gray-200 bg-white backdrop-blur-sm text-gray-900 shadow-xl"
                  title="AI增强提示 - 让AI帮您优化提示词"
                >
                  <Button
                    variant="ghost"
                    size="sm"
                    className={cn(
                      "h-9 w-9 p-0 border transition-all duration-300",
                      canOperate
                        ? "border-blue-300 bg-blue-500 hover:bg-blue-600 hover:shadow-md"
                        : "border-gray-200 bg-gray-100 cursor-not-allowed",
                      isEnhancing && "animate-pulse border-blue-400 bg-blue-400"
                    )}
                    onClick={handleEnhancePrompt}
                    disabled={!canOperate || isEnhancing}
                  >
                    {isEnhancing ? (
                      <div className="h-3 w-3 animate-bounce rounded-full bg-white shadow-sm" />
                    ) : (
                      <MagicWandIcon className={cn(
                        "h-4 w-4 transition-colors",
                        canOperate ? "text-white" : "text-gray-400"
                      )} />
                    )}
                  </Button>
                </Tooltip>
                
                {/* 发送/停止按钮 */}
                <Tooltip
                  delayDuration={300}
                  side="top"
                  sideOffset={8}
                  className="border border-gray-200 bg-white backdrop-blur-sm text-gray-900 shadow-xl"
                  title={responding ? "停止生成" : (canOperate ? "发送消息" : (!isTaskCompleted && currentThreadId ? "等待当前任务完成" : "请输入消息"))}
                >
                  <Button
                    onClick={responding ? () => {} : () => handleSubmit()}
                    disabled={!canOperate}
                    className={cn(
                      "h-9 w-9 p-0 rounded-lg border transition-all duration-300",
                      canOperate
                        ? "border-blue-300 bg-blue-500 hover:bg-blue-600 hover:shadow-md"
                        : "border-gray-200 bg-gray-100 cursor-not-allowed"
                    )}
                  >
                    {responding ? (
                      <StopCircle className="h-4 w-4 text-white" />
                    ) : (
                      <Send className={cn(
                        "h-4 w-4 transition-colors",
                        canOperate ? "text-white" : "text-gray-400"
                      )} />
                    )}
                  </Button>
                </Tooltip>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 上拉框 */}
      {showStyleDropdown && createPortal(
        <motion.div
          ref={dropdownRef}
          initial={{ opacity: 0, scale: 0.95, y: 10 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 10 }}
          transition={{ duration: 0.15 }}
          className="w-56 border border-gray-200 bg-white backdrop-blur-xl rounded-xl shadow-xl overflow-hidden"
          style={{ 
            position: 'fixed',
            top: dropdownPosition.top,
            left: dropdownPosition.left,
            zIndex: 99999,
          }}
          onClick={(e) => e.stopPropagation()}
        >
          <div className="p-2 space-y-1">
            {REPORT_STYLES.map((style) => {
              const StyleIcon = style.icon;
              const isSelected = reportStyle === style.value;
              
              return (
                <button
                  key={style.value}
                  onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      setReportStyle(style.value);
                      setShowStyleDropdown(false);
                    }}
                  className={cn(
                    "w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-left transition-all duration-200",
                    isSelected
                      ? "bg-blue-50 text-blue-900"
                      : "text-gray-700 hover:bg-gray-50 hover:text-gray-900"
                  )}
                >
                  <StyleIcon className={cn(
                    "h-4 w-4 transition-colors",
                    isSelected ? "text-blue-600" : style.color
                  )} />
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-sm">{style.label}</div>
                    <div className="text-xs opacity-70 line-clamp-2">{style.description}</div>
                  </div>
                  {isSelected && (
                    <div className="h-2 w-2 rounded-full bg-blue-500 shadow-sm" />
                  )}
                </button>
              );
            })}
          </div>
        </motion.div>,
        document.body
      )}
    </div>
  );
} 