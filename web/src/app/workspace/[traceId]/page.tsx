"use client";

import { useParams, useSearchParams } from "next/navigation";

import { ArtifactFeed } from "~/components/yadra/artifact-feed";

export default function WorkspacePage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const traceId = params.traceId as string;
  const initialQuery = searchParams.get("q");

  return (
    <div className="grid h-full grid-cols-1 gap-6 lg:grid-cols-2">
      <div className="space-y-4">
        <h1 className="text-2xl font-bold">Research Workspace</h1>
        {initialQuery && (
          <div className="bg-muted rounded-lg p-4">
            <p className="text-muted-foreground text-sm">Initial Query:</p>
            <p>{initialQuery}</p>
          </div>
        )}
        <div className="rounded-lg border p-4">
          <p className="text-muted-foreground text-sm">
            Follow-up input will be implemented in next phase
          </p>
        </div>
      </div>
      <div className="space-y-4">
        <h2 className="text-xl font-semibold">Research Artifacts</h2>
        <ArtifactFeed traceId={traceId} />
      </div>
    </div>
  );
}
