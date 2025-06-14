"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { nanoid } from "nanoid";
import MessageInput from "./message-input";
import { cn } from "~/lib/utils";

const PLACEHOLDER_TEXTS = [
  "Analyze the latest developments in quantum computing...",
  "Research the impact of AI on healthcare industry...",
  "Compare renewable energy policies across countries...",
  "Investigate emerging trends in biotechnology...",
];

interface HeroInputProps {
  className?: string;
}

export function HeroInput({ className }: HeroInputProps) {
  const router = useRouter();
  const [currentPlaceholder, setCurrentPlaceholder] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentPlaceholder((prev) => (prev + 1) % PLACEHOLDER_TEXTS.length);
    }, 3000);
    return () => clearInterval(interval);
  }, []);

  const handleSubmit = (content: string) => {
    if (!content?.trim()) return;

    const traceId = nanoid();
    router.push(`/workspace/${traceId}?q=${encodeURIComponent(content)}`);
  };

  return (
    <div className={cn("mx-auto w-full max-w-4xl", className)}>
      <div className="relative">
        <MessageInput
          placeholder={PLACEHOLDER_TEXTS[currentPlaceholder]}
          onEnter={handleSubmit}
          className="min-h-[120px] text-lg"
        />
      </div>
    </div>
  );
}
