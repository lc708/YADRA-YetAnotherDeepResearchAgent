"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { LoadingAnimation } from "~/components/yadra/loading-animation";

export default function WorkspaceLoadingPage() {
  const router = useRouter();

  useEffect(() => {
    // 如果停留在加载页面超过5秒，返回首页
    const timeout = setTimeout(() => {
      router.push("/");
    }, 5000);

    return () => clearTimeout(timeout);
  }, [router]);

  return (
    <div className="flex h-screen items-center justify-center">
      <div className="text-center">
        <LoadingAnimation />
        <p className="mt-4 text-sm text-muted-foreground">
          正在创建新的对话...
        </p>
      </div>
    </div>
  );
} 