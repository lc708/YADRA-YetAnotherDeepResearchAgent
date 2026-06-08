"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { FixedSizeList as List } from "react-window";
import type { Artifact } from "~/lib/supa";
import { ArtifactUtils } from "~/lib/supa";
import { ArtifactCard } from "./artifact-card";
import { ArtifactViewer } from "./artifact-viewer";
import { useReportOperations } from "./report-operations";
import { useThreadArtifacts, useCurrentThread } from "~/core/store/unified-store";
import { Input } from "~/components/ui/input";
import { Search } from "lucide-react";
import { Button } from "~/components/ui/button";
import { toast } from "sonner";

const ITEM_HEIGHT = 120;

interface ArtifactFeedProps {
  traceId: string;
  className?: string;
}

export function ArtifactFeed({ traceId, className }: ArtifactFeedProps) {
  // 使用新的数据源：从unified store获取artifacts
  const allArtifacts = useThreadArtifacts(traceId);
  
  const [filteredArtifacts, setFilteredArtifacts] = useState<Artifact[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState<"all" | "process" | "result">("all");
  const [selectedArtifact, setSelectedArtifact] = useState<Artifact | null>(null);
  const [listHeight, setListHeight] = useState(400); // 默认高度
  
  const containerRef = useRef<HTMLDivElement>(null); // 改为整个组件的ref
  const listContainerRef = useRef<HTMLDivElement>(null);
  
  // 报告操作钩子
  const { copyToClipboard, downloadAsMarkdown, downloadFromUrl } = useReportOperations();
  
  // 获取研究状态数据，用于播客生成
  const threadData = useCurrentThread();
  const researchIds = threadData?.metadata.researchIds || [];
  const researchReportIds = threadData?.metadata.reportMessageIds || new Map();
  
  // 播客生成处理函数
  const handleGeneratePodcast = useCallback(async (artifact: Artifact) => {
    try {
      // 从artifact的metadata中获取关联的researchId
      // 或者通过artifact的node_name匹配研究报告
      let researchId: string | null = null;
      
      // 方法1: 从metadata中获取source_message_id
      if (artifact.metadata?.source_message_id) {
        // source_message_id可能对应研究报告的消息ID
        // 需要通过researchReportIds反向查找researchId
        for (const [rId, reportMessageId] of researchReportIds.entries()) {
          if (reportMessageId === artifact.metadata.source_message_id) {
            researchId = rId;
            break;
          }
        }
      } else {
        // 方法2: 通过researchReportIds映射查找
        // 遍历所有研究，找到对应的报告ID
        for (const [rId, reportMessageId] of researchReportIds.entries()) {
          // 检查artifact ID是否匹配报告消息ID
          if (artifact.id === `artifact-${reportMessageId}`) {
            researchId = rId;
            break;
          }
        }
      }
      
      if (!researchId) {
        toast.error("无法找到对应的研究报告，无法生成播客");
        return;
      }
      
      // 检查是否有对应的研究报告
      const reportMessageId = researchReportIds.get(researchId);
      if (!reportMessageId) {
        toast.error("研究报告不存在，无法生成播客");
        return;
      }
      
      toast.success("开始生成播客...");
      // TODO: implement podcast generation API
      
    } catch (error) {
      console.error("Failed to generate podcast:", error);
      toast.error("播客生成失败，请稍后重试");
    }
  }, [researchReportIds]);

  // 动态计算列表高度
  useEffect(() => {
    const updateHeight = () => {
      if (containerRef.current && listContainerRef.current) {
        // 获取整个组件容器的高度
        const totalHeight = containerRef.current.clientHeight;
        
        // 计算搜索和过滤区域的高度
        const headerHeight = containerRef.current.querySelector('.mb-4')?.clientHeight || 120;
        
        // 可用于列表的高度 = 总高度 - 头部高度 - 边距
        const availableHeight = totalHeight - headerHeight - 16; // 16px为边距
        

        
        // 确保高度合理：最小400px，最大1200px
        const calculatedHeight = Math.max(400, Math.min(1200, availableHeight));
        
        if (calculatedHeight !== listHeight && calculatedHeight > 350) { // 只有显著变化才更新
          setListHeight(calculatedHeight);
        }
      }
    };

    // 延迟初始计算，确保DOM已完全渲染
    const timeoutId = setTimeout(updateHeight, 100);
    
    // 再次延迟计算，确保flex布局已生效
    const timeoutId2 = setTimeout(updateHeight, 500);

    // 监听窗口大小变化
    window.addEventListener('resize', updateHeight);
    
    // 使用ResizeObserver监听容器大小变化
    let resizeObserver: ResizeObserver | null = null;
    if (window.ResizeObserver && containerRef.current) {
      resizeObserver = new ResizeObserver((entries) => {
        // 延迟执行，避免频繁计算
        setTimeout(updateHeight, 10);
      });
      resizeObserver.observe(containerRef.current);
    }

    return () => {
      clearTimeout(timeoutId);
      clearTimeout(timeoutId2);
      window.removeEventListener('resize', updateHeight);
      if (resizeObserver) {
        resizeObserver.disconnect();
      }
    };
  }, []); // 移除依赖，避免重复执行

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

      // 🔥 注意：artifact转换逻辑已迁移到unified-store，待重新设计
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
            onGeneratePodcast={handleGeneratePodcast}
          />
        </div>
      );
    },
    [filteredArtifacts, copyToClipboard, downloadFromUrl, handleGeneratePodcast],
  );

  // 如果没有artifacts，显示等待状态
  if (allArtifacts.length === 0) {
    return (
      <div className={`flex flex-col h-full ${className || ''}`}>
        <div className="text-muted-foreground flex flex-1 flex-col items-center justify-center space-y-2 min-h-[400px]">
          <div className="mx-auto h-8 w-8 animate-spin rounded-full border-b-2 border-blue-600"></div>
          <p>研究会话正在启动中...</p>
          <p className="text-sm">工件将在研究过程中实时显示</p>
        </div>
      </div>
    );
  }

  return (
    <div className={`flex flex-col h-full ${className || ''}`} ref={containerRef}>
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

      {/* 
        📏 ArtifactFeed高度优化说明：
        
        🚨 修复：react-window要求height为数字，不能是字符串
        
        解决方案：
        1. 使用useRef获取容器DOM元素
        2. 使用useEffect和ResizeObserver动态计算高度
        3. 确保传递给List的height是数字类型
        
        高度分配：
        1. 搜索和过滤区域：固定高度 (约120px)
        2. 工件列表区域：动态计算的数字高度
        3. 最小高度：400px 确保基本可用性
        
        优势：
        - 充分利用可用屏幕空间
        - 适应不同屏幕尺寸
        - 符合react-window的API要求
        - 响应式高度调整
        
        技术细节：
        - ResizeObserver监听容器大小变化
        - window.resize监听窗口大小变化
        - Math.max确保最小高度400px
      */}
      <div className="flex-1 min-h-[400px] border-t" ref={listContainerRef}>
        {filteredArtifacts.length > 0 ? (
          <List
            height={listHeight}
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
