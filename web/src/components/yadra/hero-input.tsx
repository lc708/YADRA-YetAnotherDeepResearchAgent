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
import { useUnifiedStore, setResponding, setCurrentUrlParam, setUrlParamMapping, setCurrentThreadId } from "~/core/store/unified-store";
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
  placeholder?: string;
  onSendMessage?: (message: string) => void;
  // 🚀 新增：ASK API研究请求回调
  onSubmitResearch?: (request: import("~/core/store/unified-store").ResearchRequest) => Promise<void>;
}

export function HeroInput({ 
  className, 
  placeholder: customPlaceholder, 
  onSendMessage,
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
  
  // 判断是否可以操作
  const canOperate = currentPrompt.trim() !== "" && !responding;

  // 计算上拉框位置
  const calculateDropdownPosition = useCallback(() => {
    if (!styleButtonRef.current) return;
    
    const rect = styleButtonRef.current.getBoundingClientRect();
    const newTop = rect.top - 8;
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
    return {
      autoAcceptedPlan: false, // 确保需要用户确认
      enableBackgroundInvestigation: true,
      reportStyle: reportStyle,
      enableDeepThinking: enableDeepThinking,
      maxPlanIterations: 3,
      maxStepNum: 5,
      maxSearchResults: 5
    };
  }, [reportStyle, enableDeepThinking]);

  const handleSubmit = useCallback(async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!currentPrompt.trim() || !canOperate || responding) return;

    if (onSendMessage) {
      // 🔥 传统消息发送回调（用于followup场景）
      try {
        await onSendMessage(currentPrompt);
        setCurrentPrompt("");
        if (inputRef.current) {
          inputRef.current.setContent("");
        }
      } catch (error) {
        console.error("Failed to send message:", error);
      }
    } else if (onSubmitResearch) {
      // 🚀 新架构：ASK API研究请求回调
      try {
        const researchRequest = {
          question: currentPrompt,
          askType: 'initial' as const,
          config: buildResearchConfig()
        };
        
        console.log("[HeroInput] Submitting research request:", {
          question: currentPrompt.substring(0, 50) + '...',
          config: researchRequest.config
        });
        
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
      // 🔥 兜底：如果没有任何回调，显示提示
      console.warn("[HeroInput] No callback provided for message submission");
    }
  }, [currentPrompt, canOperate, responding, onSendMessage, onSubmitResearch, buildResearchConfig]);

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
            placeholder={customPlaceholder || PLACEHOLDER_TEXTS[currentPlaceholder]}
            onChange={setCurrentPrompt}
            onEnter={() => handleSubmit()}
          />
          
          <div className="flex items-center justify-between px-4 py-3 sm:px-6">
            <div className="flex items-center gap-2">
              {/* 风格选择按钮 - 统一交互区域 */}
              <div className="relative">
                <button
                  ref={styleButtonRef}
                  type="button"
                                      onClick={(e) => {
                      e.stopPropagation();
                      if (!showStyleDropdown) {
                        calculateDropdownPosition();
                        setShowStyleDropdown(true);
                      } else {
                        setShowStyleDropdown(false);
                      }
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
                    "h-3 w-3 transition-transform duration-200 rotate-180",
                    showStyleDropdown && "rotate-0"
                  )} />
                  
                  <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/5 to-transparent opacity-0 transition-opacity duration-300 group-hover:opacity-100"></div>
                </button>
              </div>

              {/* 推理模式 Toggle 按钮 */}
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
                  </div>
                }
              >
                <button
                  type="button"
                  onClick={() => setEnableDeepThinking(!enableDeepThinking)}
                  className="group relative overflow-hidden rounded-lg h-9 px-1 transition-all duration-300 backdrop-blur-sm flex items-center hover:bg-white/5"
                >
                  <div className="relative w-12 h-6 rounded-full bg-white/10">
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
                  
                  <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/5 to-transparent opacity-0 transition-opacity duration-300 group-hover:opacity-100"></div>
                </button>
              </Tooltip>
            </div>
            
            <div className="flex items-center gap-2">
              {/* 提示词优化按钮 */}
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
              
              {/* 发送/停止按钮 */}
              <Tooltip
                delayDuration={300}
                side="bottom"
                sideOffset={8}
                className="border border-white/20 bg-black/90 backdrop-blur-sm text-white shadow-xl"
                title={responding ? "停止生成" : (canOperate ? "发送消息" : "请输入消息")}
              >
                <Button
                  onClick={responding ? () => {} : () => handleSubmit()}
                  disabled={!canOperate}
                  className={cn(
                    "h-9 w-9 p-0 rounded-lg border transition-all duration-300",
                    canOperate
                      ? "border-blue-500/50 bg-blue-600/80 hover:bg-blue-600 hover:shadow-[0_0_20px_rgba(59,130,246,0.4)]"
                      : "border-gray-400/20 bg-gray-500/20 cursor-not-allowed"
                  )}
                >
                  {responding ? (
                    <StopCircle className="h-4 w-4" />
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

      {/* 上拉框 */}
      {showStyleDropdown && createPortal(
        <motion.div
          ref={dropdownRef}
          initial={{ opacity: 0, scale: 0.95, y: 10 }}
          animate={{ opacity: 1, scale: 1, y: '-100%' }}
          exit={{ opacity: 0, scale: 0.95, y: 10 }}
          transition={{ duration: 0.15 }}
          className="w-56 border border-white/20 bg-white/5 backdrop-blur-xl rounded-xl shadow-2xl overflow-hidden"
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
                      ? "bg-blue-500/20 text-blue-300"
                      : "text-gray-300 hover:bg-white/10 hover:text-white"
                  )}
                >
                  <StyleIcon className={cn(
                    "h-4 w-4 transition-colors",
                    isSelected ? "text-blue-300" : style.color
                  )} />
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-sm">{style.label}</div>
                    <div className="text-xs opacity-70 line-clamp-2">{style.description}</div>
                  </div>
                  {isSelected && (
                    <div className="h-2 w-2 rounded-full bg-blue-400 shadow-[0_0_8px_rgba(59,130,246,0.6)]" />
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