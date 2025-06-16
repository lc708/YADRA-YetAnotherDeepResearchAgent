// Copyright (c) 2025 YADRA

import { useState } from "react";
import { Check, FileText, Newspaper, Users, GraduationCap, Sparkles } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

import { Button } from "~/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "~/components/ui/dialog";
import { setReportStyle, useSettingsStore } from "~/core/store";
import { cn } from "~/lib/utils";

import { Tooltip } from "./tooltip";

const REPORT_STYLES = [
  {
    value: "academic" as const,
    label: "学术报告",
    description: "严谨客观，逻辑缜密，适合研究分析",
    icon: GraduationCap,
    gradient: "from-emerald-500/20 to-teal-500/20",
    iconColor: "text-emerald-400",
  },
  {
    value: "popular_science" as const,
    label: "科普解读",
    description: "通俗易懂，深入浅出，适合大众传播",
    icon: FileText,
    gradient: "from-blue-500/20 to-cyan-500/20",
    iconColor: "text-blue-400",
  },
  {
    value: "news" as const,
    label: "新闻资讯",
    description: "事实为准，简洁明了，适合快速阅读",
    icon: Newspaper,
    gradient: "from-orange-500/20 to-red-500/20",
    iconColor: "text-orange-400",
  },
  {
    value: "social_media" as const,
    label: "社交媒体",
    description: "生动有趣，观点鲜明，适合分享传播",
    icon: Users,
    gradient: "from-purple-500/20 to-pink-500/20",
    iconColor: "text-purple-400",
  },
];

export function ReportStyleDialog() {
  const [open, setOpen] = useState(false);
  const currentStyle = useSettingsStore((state) => state.general.reportStyle);

  const handleStyleChange = (
    style: "academic" | "popular_science" | "news" | "social_media",
  ) => {
    setReportStyle(style);
    setOpen(false);
  };

  const currentStyleConfig =
    REPORT_STYLES.find((style) => style.value === currentStyle) ||
    REPORT_STYLES[0]!;
  const CurrentIcon = currentStyleConfig.icon;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <Tooltip
        delayDuration={300}
        className="max-w-xs border border-white/20 bg-black/90 backdrop-blur-sm text-white shadow-xl"
        title={
          <div className="p-2">
            <p className="mb-2 font-medium text-blue-300">报告风格</p>
            <p className="text-xs text-gray-300 leading-relaxed">
              当前：{currentStyleConfig.label}
            </p>
            <p className="text-xs text-gray-400 mt-1">
              {currentStyleConfig.description}
            </p>
          </div>
        }
      >
        <DialogTrigger asChild>
          <button
            className={cn(
              "group relative overflow-hidden rounded-lg border px-3 py-1.5 text-xs font-medium transition-all duration-300",
              "backdrop-blur-sm flex items-center gap-1.5",
              "border-white/20 bg-white/5 text-gray-300 hover:border-white/30 hover:bg-white/10 hover:text-white"
            )}
          >
            <CurrentIcon className={cn("h-3 w-3", currentStyleConfig.iconColor)} />
            <span className="hidden sm:inline">{currentStyleConfig.label}</span>
            <span className="sm:hidden">风格</span>
            
            {/* hover 光效 */}
            <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/5 to-transparent opacity-0 transition-opacity duration-300 group-hover:opacity-100"></div>
          </button>
        </DialogTrigger>
      </Tooltip>
      
      <DialogContent className="sm:max-w-md border border-white/20 bg-black/95 backdrop-blur-xl text-white shadow-2xl">
        <DialogHeader className="text-center pb-2">
          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-gradient-to-br from-blue-500/20 to-purple-500/20 border border-blue-400/30">
            <Sparkles className="h-6 w-6 text-blue-400" />
          </div>
          <DialogTitle className="text-xl font-semibold text-white">
            选择报告风格
          </DialogTitle>
          <DialogDescription className="text-gray-400 text-sm">
            为您的研究报告选择最适合的写作风格
          </DialogDescription>
        </DialogHeader>
        
        <div className="grid gap-3 py-4">
          <AnimatePresence>
            {REPORT_STYLES.map((style, index) => {
              const Icon = style.icon;
              const isSelected = currentStyle === style.value;

              return (
                <motion.button
                  key={style.value}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.1 }}
                  className={cn(
                    "group relative overflow-hidden rounded-xl border p-4 text-left transition-all duration-300",
                    "backdrop-blur-sm flex items-start gap-3",
                    isSelected 
                      ? "border-blue-400/50 bg-blue-500/20 shadow-[0_0_20px_rgba(59,130,246,0.2)]" 
                      : "border-white/10 bg-white/5 hover:border-white/20 hover:bg-white/10 hover:scale-[1.02]"
                  )}
                  onClick={() => handleStyleChange(style.value)}
                >
                  {/* 背景渐变 */}
                  <div className={cn(
                    "absolute inset-0 bg-gradient-to-br opacity-0 transition-opacity duration-300",
                    style.gradient,
                    "group-hover:opacity-50",
                    isSelected && "opacity-30"
                  )} />
                  
                  {/* 图标 */}
                  <div className={cn(
                    "relative z-10 flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border backdrop-blur-sm transition-all duration-300",
                    isSelected 
                      ? "border-blue-400/50 bg-blue-500/20" 
                      : "border-white/20 bg-white/10 group-hover:border-white/30"
                  )}>
                    <Icon className={cn(
                      "h-5 w-5 transition-colors duration-300",
                      isSelected ? "text-blue-300" : style.iconColor
                    )} />
                  </div>
                  
                  {/* 内容 */}
                  <div className="relative z-10 flex-1 space-y-1">
                    <div className="flex items-center gap-2">
                      <h4 className={cn(
                        "font-medium transition-colors duration-300",
                        isSelected ? "text-blue-200" : "text-white"
                      )}>
                        {style.label}
                      </h4>
                      <AnimatePresence>
                        {isSelected && (
                          <motion.div
                            initial={{ scale: 0, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            exit={{ scale: 0, opacity: 0 }}
                            transition={{ duration: 0.2 }}
                          >
                            <Check className="h-4 w-4 text-blue-300" />
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>
                    <p className={cn(
                      "text-sm leading-relaxed transition-colors duration-300",
                      isSelected ? "text-gray-300" : "text-gray-400"
                    )}>
                      {style.description}
                    </p>
                  </div>
                  
                  {/* hover 光效 */}
                  <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/5 to-transparent opacity-0 transition-opacity duration-300 group-hover:opacity-100"></div>
                </motion.button>
              );
            })}
          </AnimatePresence>
        </div>
      </DialogContent>
    </Dialog>
  );
}
