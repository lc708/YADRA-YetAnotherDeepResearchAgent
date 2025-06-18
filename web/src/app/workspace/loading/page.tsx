"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { LoadingAnimation } from "~/components/yadra/loading-animation";

export default function WorkspaceLoadingPage() {
  const router = useRouter();

  useEffect(() => {
    // 缩短等待时间到3秒 - 通常研究任务创建不需要这么久
    const timeout = setTimeout(() => {
      console.log("[Loading] Timeout reached, redirecting to home");
      router.push("/");
    }, 3000);

    return () => clearTimeout(timeout);
  }, [router]);

  return (
    <div className="flex h-screen items-center justify-center">
      <div className="text-center">
        <LoadingAnimation />
        <p className="mt-4 text-sm text-muted-foreground">
          正在准备研究环境...
        </p>
        <p className="mt-2 text-xs text-muted-foreground/60">
          这通常只需要几秒钟
        </p>
      </div>
    </div>
  );
} 