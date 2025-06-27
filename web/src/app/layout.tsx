// Copyright (c) 2025 YADRA

import "~/styles/globals.css";

import { type Metadata } from "next";
import Script from "next/script";

import { ThemeProviderWrapper } from "~/components/yadra/theme-provider-wrapper";
import { GlobalSidebar } from "~/components/layout/global-sidebar";
import { loadConfig } from "~/core/api/config";
import { env } from "~/env";

import { Toaster } from "../components/yadra/toaster";

export const metadata: Metadata = {
  title: "🚀 YADRA",
  description:
    "Deep Exploration and Efficient Research, an AI tool that combines language models with specialized tools for research tasks.",
  icons: [{ rel: "icon", url: "/favicon.ico" }],
};

// 临时禁用Google字体以解决Turbopack问题
// const geist = Geist({
//   subsets: ["latin"],
//   variable: "--font-geist-sans",
// });

export default async function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const conf = await loadConfig();
  return (
    <html lang="en" className="font-sans" suppressHydrationWarning>
      <head>
      <script>{`window.__yadraConfig = ${JSON.stringify(conf)}`}</script>
        <Script id="markdown-it-fix" strategy="beforeInteractive">
          {`
            if (typeof window !== 'undefined' && typeof window.isSpace === 'undefined') {
              window.isSpace = function(code) {
                return code === 0x20 || code === 0x09 || code === 0x0A || code === 0x0B || code === 0x0C || code === 0x0D;
              };
            }
          `}
        </Script>
      </head>
      <body className="bg-app">
        <ThemeProviderWrapper>
          <div className="flex h-screen">
            {/* 全局左侧边栏 */}
            <GlobalSidebar />
            
            {/* 主要内容区域 */}
            <main className="flex-1 overflow-y-auto">
              {children}
            </main>
          </div>
        </ThemeProviderWrapper>
        <Toaster />
        {
          // NO USER BEHAVIOR TRACKING OR PRIVATE DATA COLLECTION BY DEFAULT
          //
          // When `NEXT_PUBLIC_STATIC_WEBSITE_ONLY` is `true`, the script will be injected
          // into the page only when `AMPLITUDE_API_KEY` is provided in `.env`
        }
        {env.NEXT_PUBLIC_STATIC_WEBSITE_ONLY && env.AMPLITUDE_API_KEY && (
          <>
            <Script src="https://cdn.amplitude.com/script/d2197dd1df3f2959f26295bb0e7e849f.js"></Script>
            <Script id="amplitude-init" strategy="lazyOnload">
              {`window.amplitude.init('${env.AMPLITUDE_API_KEY}', {"fetchRemoteConfig":true,"autocapture":true});`}
            </Script>
          </>
        )}
      </body>
    </html>
  );
}
