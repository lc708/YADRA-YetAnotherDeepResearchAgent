"use client";

import { useState, useEffect, useCallback } from "react";
import { FixedSizeList as List } from "react-window";
import type { Artifact } from "~/lib/supa";
import { ArtifactUtils } from "~/lib/supa";
import { ArtifactCard } from "./artifact-card";
import { ArtifactViewer } from "./artifact-viewer";
import { useReportOperations } from "./report-operations";
import { useWorkspaceArtifacts } from "~/core/store/workspace-store";
import { Input } from "~/components/ui/input";
import { Search } from "lucide-react";
import { Button } from "~/components/ui/button";

const ITEM_HEIGHT = 120;

interface ArtifactFeedProps {
  traceId: string;
  className?: string;
}

export function ArtifactFeed({ traceId, className }: ArtifactFeedProps) {
  // 使用新的数据源：从workspace store获取artifacts
  const allArtifacts = useWorkspaceArtifacts(traceId);
  
  const [filteredArtifacts, setFilteredArtifacts] = useState<Artifact[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState<"all" | "process" | "result">("all");
  const [selectedArtifact, setSelectedArtifact] = useState<Artifact | null>(null);
  
  // 报告操作钩子
  const { copyToClipboard, downloadAsMarkdown, downloadFromUrl } = useReportOperations();

  // 过滤逻辑
  useEffect(() => {
    let filtered = allArtifacts;

    if (searchQuery) {
      filtered = filtered.filter(
        (artifact) =>
          artifact.node_name
            .toLowerCase()
            .includes(searchQuery.toLowerCase()) ||
          artifact.summary?.toLowerCase().includes(searchQuery.toLowerCase()),
      );
    }

    if (typeFilter !== "all") {
      filtered = filtered.filter((artifact) => artifact.type === typeFilter);
    }

    setFilteredArtifacts(filtered);
  }, [allArtifacts, searchQuery, typeFilter]);

  const handleSaveArtifact = useCallback(async (artifact: Artifact, content: string) => {
    try {
      // 更新本地状态 - 这里可以添加保存到后端的逻辑
      console.log("Saving artifact:", artifact.id, content);
      // 注意：由于我们现在使用state-adapter，保存逻辑需要更新到主store
      // 这个功能将在后续的Phase中完善
    } catch (error) {
      console.error("Failed to save artifact:", error);
    }
  }, []);

  const renderItem = useCallback(
    ({ index, style }: { index: number; style: React.CSSProperties }) => {
      const artifact = filteredArtifacts[index];
      if (!artifact) return null;

      return (
        <div style={style} className="px-2 py-1">
          <ArtifactCard 
            artifact={artifact} 
            onView={setSelectedArtifact}
            onEdit={setSelectedArtifact}
            onCopy={copyToClipboard}
            onDownload={downloadFromUrl}
          />
        </div>
      );
    },
    [filteredArtifacts, copyToClipboard, downloadFromUrl],
  );

  // 如果没有artifacts，显示等待状态
  if (allArtifacts.length === 0) {
    return (
      <div className={className}>
        <div className="text-muted-foreground flex h-64 flex-col items-center justify-center space-y-2">
          <div className="mx-auto h-8 w-8 animate-spin rounded-full border-b-2 border-blue-600"></div>
          <p>研究会话正在启动中...</p>
          <p className="text-sm">工件将在研究过程中实时显示</p>
        </div>
      </div>
    );
  }

  return (
    <div className={className}>
      <div className="mb-4 space-y-4">
        <div className="relative">
          <Search className="text-muted-foreground absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 transform" />
          <Input
            placeholder="搜索工件..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            variant={typeFilter === "all" ? "default" : "outline"}
            size="sm"
            onClick={() => setTypeFilter("all")}
          >
            全部 ({allArtifacts.length})
          </Button>
          <Button
            variant={typeFilter === "process" ? "default" : "outline"}
            size="sm"
            onClick={() => setTypeFilter("process")}
          >
            过程 ({allArtifacts.filter(a => a.type === "process").length})
          </Button>
          <Button
            variant={typeFilter === "result" ? "default" : "outline"}
            size="sm"
            onClick={() => setTypeFilter("result")}
          >
            结果 ({allArtifacts.filter(a => a.type === "result").length})
          </Button>
        </div>
      </div>

      <div className="h-[600px] rounded-lg border">
        {filteredArtifacts.length > 0 ? (
          <List
            height={600}
            width="100%"
            itemCount={filteredArtifacts.length}
            itemSize={ITEM_HEIGHT}
            itemData={filteredArtifacts}
          >
            {renderItem}
          </List>
        ) : (
          <div className="text-muted-foreground flex h-full flex-col items-center justify-center space-y-2">
            <p>没有找到匹配的工件</p>
            <p className="text-sm">尝试调整搜索条件或过滤器</p>
          </div>
        )}
      </div>

      <ArtifactViewer
        artifact={selectedArtifact}
        open={!!selectedArtifact}
        onOpenChange={(open) => !open && setSelectedArtifact(null)}
        onSave={handleSaveArtifact}
      />
    </div>
  );
}
