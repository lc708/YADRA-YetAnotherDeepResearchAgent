// Copyright (c) 2025 YADRA

import "~/styles/globals.css";

import { type Metadata, type Viewport } from "next";
import Script from "next/script";

import { GlobalSidebar } from "~/components/layout/global-sidebar";
import { ThemeProviderWrapper } from "~/components/yadra/theme-provider-wrapper";
import { loadConfig } from "~/core/api/config";
import { env } from "~/env";

import { Toaster } from "../components/yadra/toaster";

export const metadata: Metadata = {
  metadataBase: new URL('https://www.yadra.im'),
  title: "YADRA - 智能深度研究AI助手 | 3分钟生成专业研究报告、小红书爆款文案",
  description: "YADRA是专业的AI深度研究助手，支持生成研究报告、新闻稿件、小红书爆款文案、科普博客。输入主题，3-5分钟自动生成专业内容，支持实时编辑和多格式导出。",
  keywords: "AI研究助手,研究报告生成,小红书爆款文案,深度调研工具,智能分析,学术研究,市场调研,新闻稿件,社媒文案,科普博客",
  authors: [{ name: "YADRA Team" }],
  creator: "YADRA Team",
  publisher: "YADRA",
  robots: "index, follow, max-image-preview:large, max-snippet:-1, max-video-preview:-1",
  category: "productivity",
  classification: "AI工具,研究助手,内容生成",
  icons: [
    { rel: "icon", url: "/favicon.ico", sizes: "any" },
    { rel: "icon", url: "/favicon.svg", type: "image/svg+xml" },
    { rel: "apple-touch-icon", url: "/apple-touch-icon.png" },
  ],
  manifest: "/manifest.json",
  alternates: {
    canonical: "/",
    languages: {
      "zh-CN": "/",
      "en": "/en",
    },
  },
  openGraph: {
    type: "website",
    locale: "zh_CN",
    title: "YADRA - 智能深度研究AI助手 | 3分钟生成专业研究报告、小红书爆款文案",
    description: "专业AI研究助手，支持生成研究报告、新闻稿件、小红书爆款文案、科普博客。3-5分钟自动生成高质量内容，实时编辑，多格式导出。",
    url: "/",
    siteName: "YADRA",
    images: [
      {
        url: "/og-image.png",
        width: 1200,
        height: 630,
        alt: "YADRA AI研究助手 - 智能生成研究报告和小红书爆款文案",
        type: "image/png",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "YADRA - 智能深度研究AI助手 | 3分钟生成专业研究报告、小红书爆款文案",
    description: "专业AI研究助手，支持生成研究报告、新闻稿件、小红书爆款文案、科普博客。3-5分钟自动生成高质量内容。",
    images: ["/twitter-image.png"],
    creator: "@YADRA_AI",
  },
  verification: {
    // 添加后续需要的验证码
    // google: "your-google-verification-code",
    // baidu: "your-baidu-verification-code",
  },
  other: {
    "mobile-web-app-capable": "yes",
    "apple-mobile-web-app-capable": "yes",
    "apple-mobile-web-app-status-bar-style": "default",
    "format-detection": "telephone=no",
  },
};

// Viewport configuration for Next.js 15
export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1.0,
  themeColor: '#ffffff',
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
    <html lang="zh-CN" className="font-sans" suppressHydrationWarning>
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
        <Script
          id="structured-data"
          type="application/ld+json"
          strategy="beforeInteractive"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              "@context": "https://schema.org",
              "@type": "SoftwareApplication",
              "name": "YADRA",
              "description": "专业的AI深度研究助手，支持生成研究报告、新闻稿件、小红书爆款文案、科普博客",
              "applicationCategory": "BusinessApplication",
              "operatingSystem": "Web",
              "offers": {
                "@type": "Offer",
                "price": "0",
                "priceCurrency": "CNY",
                "availability": "https://schema.org/InStock",
              },
              "creator": {
                "@type": "Organization",
                "name": "YADRA Team",
              },
              "featureList": [
                "智能研究报告生成",
                "小红书爆款文案创作",
                "新闻稿件撰写",
                "科普博客创建",
                "实时在线编辑",
                "多格式导出",
              ],
            }),
          }}
        />
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
