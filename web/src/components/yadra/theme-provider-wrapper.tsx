// Copyright (c) 2025 YADRA


"use client";

import { usePathname } from "next/navigation";

import { ThemeProvider } from "~/components/theme-provider";

export function ThemeProviderWrapper({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const isChatPage = pathname?.startsWith("/chat");

  return (
    <ThemeProvider
      attribute="class"
      defaultTheme={"dark"}
      enableSystem={isChatPage}
      forcedTheme={isChatPage ? undefined : "dark"}
      disableTransitionOnChange
    >
      {children}
    </ThemeProvider>
  );
}
