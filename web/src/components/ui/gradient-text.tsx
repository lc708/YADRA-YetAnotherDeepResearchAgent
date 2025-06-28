"use client";

import React, { memo } from "react";
import { cn } from "~/lib/utils";

type GradientTheme = 
  | "primary"      // 品牌蓝渐变
  | "success"      // 成功绿渐变  
  | "warning"      // 警告橙渐变
  | "danger"       // 错误红渐变
  | "purple"       // 紫色强调渐变
  | "rainbow"      // 彩虹渐变
  | "subtle";      // 微妙灰度渐变

type GradientDirection = "to-r" | "to-br" | "to-b" | "to-bl" | "to-l" | "to-tl" | "to-t" | "to-tr";

interface GradientTextProps {
  children: React.ReactNode;
  theme?: GradientTheme;
  direction?: GradientDirection;
  className?: string;
  animated?: boolean;
  intensity?: "light" | "medium" | "strong";
}

const gradientThemes = {
  primary: {
    light: "from-blue-400 via-blue-500 to-blue-600",
    medium: "from-blue-500 via-blue-600 to-blue-700", 
    strong: "from-blue-600 via-blue-700 to-blue-800"
  },
  success: {
    light: "from-emerald-400 via-emerald-500 to-emerald-600",
    medium: "from-emerald-500 via-emerald-600 to-emerald-700",
    strong: "from-emerald-600 via-emerald-700 to-emerald-800"
  },
  warning: {
    light: "from-amber-400 via-amber-500 to-orange-500",
    medium: "from-amber-500 via-orange-500 to-orange-600",
    strong: "from-amber-600 via-orange-600 to-red-500"
  },
  danger: {
    light: "from-red-400 via-red-500 to-red-600",
    medium: "from-red-500 via-red-600 to-red-700",
    strong: "from-red-600 via-red-700 to-red-800"
  },
  purple: {
    light: "from-purple-400 via-purple-500 to-indigo-500",
    medium: "from-purple-500 via-purple-600 to-indigo-600",
    strong: "from-purple-600 via-indigo-600 to-blue-600"
  },
  rainbow: {
    light: "from-red-400 via-yellow-400 via-green-400 via-blue-400 to-purple-400",
    medium: "from-red-500 via-yellow-500 via-green-500 via-blue-500 to-purple-500",
    strong: "from-red-600 via-yellow-600 via-green-600 via-blue-600 to-purple-600"
  },
  subtle: {
    light: "from-gray-600 via-gray-700 to-gray-800",
    medium: "from-gray-700 via-gray-800 to-gray-900", 
    strong: "from-gray-800 via-gray-900 to-black"
  }
};

export const GradientText = memo(({
  children,
  theme = "primary",
  direction = "to-r",
  className = "",
  animated = false,
  intensity = "medium"
}: GradientTextProps) => {
  const gradientClass = gradientThemes[theme][intensity];
  
  return (
    <span 
      className={cn(
        "bg-gradient-" + direction,
        gradientClass,
        "bg-clip-text text-transparent",
        animated && "animate-pulse",
        className
      )}
    >
      {children}
    </span>
  );
});

GradientText.displayName = "GradientText";

// 预设组合组件
export const PrimaryGradientText = memo(({ children, className, ...props }: Omit<GradientTextProps, 'theme'>) => (
  <GradientText theme="primary" className={className} {...props}>
    {children}
  </GradientText>
));

export const SuccessGradientText = memo(({ children, className, ...props }: Omit<GradientTextProps, 'theme'>) => (
  <GradientText theme="success" className={className} {...props}>
    {children}
  </GradientText>
));

export const WarningGradientText = memo(({ children, className, ...props }: Omit<GradientTextProps, 'theme'>) => (
  <GradientText theme="warning" className={className} {...props}>
    {children}
  </GradientText>
));

export const DangerGradientText = memo(({ children, className, ...props }: Omit<GradientTextProps, 'theme'>) => (
  <GradientText theme="danger" className={className} {...props}>
    {children}
  </GradientText>
));

export const PurpleGradientText = memo(({ children, className, ...props }: Omit<GradientTextProps, 'theme'>) => (
  <GradientText theme="purple" className={className} {...props}>
    {children}
  </GradientText>
));

export const RainbowGradientText = memo(({ children, className, ...props }: Omit<GradientTextProps, 'theme'>) => (
  <GradientText theme="rainbow" className={className} {...props}>
    {children}
  </GradientText>
));

export const SubtleGradientText = memo(({ children, className, ...props }: Omit<GradientTextProps, 'theme'>) => (
  <GradientText theme="subtle" className={className} {...props}>
    {children}
  </GradientText>
)); 