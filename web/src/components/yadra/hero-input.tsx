"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { nanoid } from "nanoid";
import { Send, Paperclip } from "lucide-react";
import { cn } from "~/lib/utils";

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
  const [currentPlaceholder, setCurrentPlaceholder] = useState(0);
  const [input, setInput] = useState("");

  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentPlaceholder((prev) => (prev + 1) % PLACEHOLDER_TEXTS.length);
    }, 4000);
    return () => clearInterval(interval);
  }, []);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!input?.trim()) return;

    const traceId = nanoid();
    router.push(`/workspace/${traceId}?q=${encodeURIComponent(input)}`);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  };

  return (
    <div className={cn("mx-auto w-full max-w-4xl", className)}>
      <form onSubmit={handleSubmit} className="relative">
        <div className="relative overflow-hidden rounded-xl border border-white/20 bg-white/5 backdrop-blur-sm transition-all duration-200 focus-within:border-white/30 focus-within:bg-white/10">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={PLACEHOLDER_TEXTS[currentPlaceholder]}
            className="w-full resize-none border-0 bg-transparent px-4 py-4 text-white placeholder-gray-400 outline-none sm:px-6 sm:py-6 sm:text-lg"
            rows={3}
            style={{ minHeight: "80px" }}
          />
          
          <div className="flex items-center justify-between border-t border-white/10 px-4 py-3 sm:px-6">
            <button
              type="button"
              className="flex items-center gap-2 text-sm text-gray-400 hover:text-white transition-colors"
            >
              <Paperclip className="h-4 w-4" />
              <span className="hidden sm:inline">附加文件</span>
            </button>
            
            <button
              type="submit"
              disabled={!input.trim()}
              className="flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition-all hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Send className="h-4 w-4" />
              <span className="hidden sm:inline">发送</span>
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}
