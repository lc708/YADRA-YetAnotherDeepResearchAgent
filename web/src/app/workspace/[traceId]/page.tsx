"use client";

import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { useParams, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";

import { Button } from "~/components/ui/button";
import { ArtifactFeed } from "~/components/yadra/artifact-feed";
import type { Resource } from "~/core/messages";
import { setEnableBackgroundInvestigation, setReportStyle } from "~/core/store";
import { sendMessage } from "~/core/store/store";

export default function WorkspacePage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const traceId = params.traceId as string;
  const [initialized, setInitialized] = useState(false);
  const [query, setQuery] = useState<string | null>(null);

  useEffect(() => {
    if (!initialized && searchParams) {
      const q = searchParams.get("q");
      const investigation = searchParams.get("investigation");
      const style = searchParams.get("style");
      const resourcesParam = searchParams.get("resources");

      if (q) {
        setQuery(q);
        
        if (investigation === "true") {
          setEnableBackgroundInvestigation(true);
        }
        if (style) {
          setReportStyle(style as "academic" | "popular_science" | "news" | "social_media");
        }

        let resources: Resource[] = [];
        if (resourcesParam) {
          try {
            resources = JSON.parse(resourcesParam);
          } catch (error) {
            console.error("Failed to parse resources:", error);
          }
        }

        void sendMessage(q, { resources });
        setInitialized(true);
      }
    }
  }, [searchParams, initialized, traceId]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-black">
      <div className="container mx-auto max-w-6xl space-y-6 p-4 sm:p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0 flex-1">
            <h1 className="text-xl font-bold text-white sm:text-2xl">研究工作区</h1>
            <p className="text-gray-400 truncate text-sm sm:text-base">
              查询: {query ?? "未提供查询"}
            </p>
          </div>
          <Button variant="outline" size="sm" asChild className="self-start">
            <Link href="/">
              <ArrowLeft className="mr-2 h-4 w-4" />
              返回首页
            </Link>
          </Button>
        </div>

        <div className="grid gap-6 lg:grid-cols-2">
          <div className="space-y-4">
            <h2 className="text-lg font-semibold text-white">研究进度</h2>
            <div className="rounded-lg border border-white/20 bg-white/5 backdrop-blur-sm p-4 shadow-sm">
              <p className="text-gray-300 text-sm">
                研究会话已启动: {traceId.slice(0, 8)}...
              </p>
              <div className="mt-4 space-y-2">
                <div className="flex items-center gap-2">
                  <div className="h-2 w-2 rounded-full bg-green-500"></div>
                  <span className="text-sm text-gray-300">会话已初始化</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="h-2 w-2 animate-pulse rounded-full bg-blue-500"></div>
                  <span className="text-sm text-gray-300">等待工件生成...</span>
                </div>
              </div>
            </div>
          </div>
          
          <div className="space-y-4">
            <h2 className="text-lg font-semibold text-white">研究工件</h2>
            <div className="rounded-lg border border-white/20 bg-white/5 backdrop-blur-sm shadow-sm">
              <ArtifactFeed traceId={traceId} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
