// Copyright (c) 2025 YADRA

"use client";

import { useMemo } from "react";

import { useUnifiedStore, useCurrentThread } from "~/core/store/unified-store";
import { cn } from "~/lib/utils";

import { MessagesBlock } from "./components/messages-block";
import { ResearchBlock } from "./components/research-block";

export default function Main() {
  const threadData = useCurrentThread();
  const openResearchId = threadData?.metadata.openResearchId || null;
  const doubleColumnMode = useMemo(
    () => openResearchId !== null,
    [openResearchId],
  );

  return (
    <main
      className={cn(
        "container mx-auto max-w-6xl space-y-6 p-4",
        doubleColumnMode && "grid grid-cols-2 gap-6 space-y-0",
      )}
    >
      <MessagesBlock />
      {doubleColumnMode && <ResearchBlock researchId={openResearchId} />}
    </main>
  );
}
