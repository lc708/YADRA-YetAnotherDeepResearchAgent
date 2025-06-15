"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { nanoid } from "nanoid";
import { Send, Paperclip } from "lucide-react";
import { MagicWandIcon } from "@radix-ui/react-icons";
import { AnimatePresence, motion } from "framer-motion";
import { cn } from "~/lib/utils";

import { Button } from "~/components/ui/button";
import MessageInput, { type MessageInputRef } from "~/components/yadra/message-input";
import { ReportStyleDialog } from "~/components/yadra/report-style-dialog";
import { Tooltip } from "~/components/yadra/tooltip";
import { enhancePrompt } from "~/core/api/prompt-enhancer";
import { useSettingsStore, setEnableBackgroundInvestigation } from "~/core/store";
import type { Resource } from "~/core/messages";

const PLACEHOLDER_TEXTS = [
  "YADRA能帮助你今天做什么？",
  "分析量子计算的最新发展趋势...",
  "比较各国可再生能源政策...", 
  "研究AI对医疗保健的影响...",
  "调查可持续城市规划策略...",
  "探索区块链在金融领域的应用...",
];

interface HeroInputProps {
  className?: string;
}

export function HeroInput({ className }: HeroInputProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [currentPlaceholder, setCurrentPlaceholder] = useState(0);
  const [currentPrompt, setCurrentPrompt] = useState("");
  const [isEnhancing, setIsEnhancing] = useState(false);
  const [isEnhanceAnimating, setIsEnhanceAnimating] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);
  
  const inputRef = useRef<MessageInputRef>(null);
  const reportStyle = useSettingsStore((state) => state.general.reportStyle);

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

  const handleSendMessage = useCallback(
    (message: string, resources: Array<Resource>) => {
      if (!message?.trim()) return;

      const traceId = nanoid();
      const params = new URLSearchParams({
        q: message,
        investigation: "true",
        ...(reportStyle && { style: reportStyle }),
        ...(resources.length > 0 && { resources: JSON.stringify(resources) }),
      });
      
      router.push(`/workspace/${traceId}?${params.toString()}`);
    },
    [router, reportStyle],
  );

  // 监听示例问题选择事件
  useEffect(() => {
    const handleQuestionSelect = (event: CustomEvent) => {
      const { question } = event.detail;
      if (question && inputRef.current) {
        inputRef.current.setContent(question);
        setCurrentPrompt(question);
        // 自动发送选中的问题
        setTimeout(() => {
          handleSendMessage(question, []);
        }, 100);
      }
    };

    window.addEventListener('heroQuestionSelect', handleQuestionSelect as EventListener);
    
    return () => {
      window.removeEventListener('heroQuestionSelect', handleQuestionSelect as EventListener);
    };
  }, [handleSendMessage]);

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
            placeholder={PLACEHOLDER_TEXTS[currentPlaceholder]}
            onChange={setCurrentPrompt}
            onEnter={handleSendMessage}
          />
          
          <div className="flex items-center justify-between border-t border-white/10 px-4 py-3 sm:px-6">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setShowAdvanced(!showAdvanced)}
                className="flex items-center gap-2 text-sm text-gray-400 hover:text-white transition-colors"
              >
                <Paperclip className="h-4 w-4" />
                <span className="hidden sm:inline">高级选项</span>
              </button>
              
              {showAdvanced && (
                <motion.div
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  className="flex items-center gap-2"
                >
                  <ReportStyleDialog />
                </motion.div>
              )}
            </div>
            
            <div className="flex items-center gap-2">
              <Tooltip title="AI增强提示">
                <Button
                  variant="ghost"
                  size="sm"
                  className={cn(
                    "h-8 w-8 p-0",
                    isEnhancing && "animate-pulse",
                  )}
                  onClick={handleEnhancePrompt}
                  disabled={isEnhancing || currentPrompt.trim() === ""}
                >
                  {isEnhancing ? (
                    <div className="h-3 w-3 animate-bounce rounded-full bg-white/70" />
                  ) : (
                    <MagicWandIcon className="h-4 w-4 text-blue-400" />
                  )}
                </Button>
              </Tooltip>
              
              <Button
                onClick={() => inputRef.current?.submit()}
                disabled={!currentPrompt.trim()}
                className="flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition-all hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Send className="h-4 w-4" />
                <span className="hidden sm:inline">发送</span>
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
