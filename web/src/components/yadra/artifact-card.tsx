import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import { Eye, Download, Edit, Copy, FileText, Code, Music, Image } from "lucide-react";
import { cn } from "~/lib/utils";
import type { Artifact } from "~/lib/supa";
import { ArtifactUtils } from "~/lib/supa";

interface ArtifactCardProps {
  artifact: Artifact;
  onView?: (artifact: Artifact) => void;
  onEdit?: (artifact: Artifact) => void;
  onCopy?: (artifact: Artifact) => void;
  onDownload?: (artifact: Artifact) => void;
  className?: string;
}

export function ArtifactCard({
  artifact,
  onView,
  onEdit,
  onCopy,
  onDownload,
  className,
}: ArtifactCardProps) {
  const isProcess = artifact.type === "process";
  const isReport = ArtifactUtils.isReport(artifact);
  const isCode = ArtifactUtils.isCode(artifact);
  const isMedia = ArtifactUtils.isMedia(artifact);
  
  // 获取图标
  const getIcon = () => {
    if (isCode) return <Code className="h-4 w-4" />;
    if (isMedia) return <Music className="h-4 w-4" />;
    return <FileText className="h-4 w-4" />;
  };
  
  // 获取类型标签
  const getTypeBadge = () => {
    if (isProcess) {
      return <Badge variant="secondary">过程</Badge>;
    }
    
    // Result类型的细分
    if (isReport) {
      return <Badge variant="default">报告</Badge>;
    }
    if (isCode) {
      return <Badge variant="outline">代码</Badge>;
    }
    if (isMedia) {
      return <Badge variant="outline">媒体</Badge>;
    }
    
    return <Badge variant="default">结果</Badge>;
  };
  
  // 获取显示名称
  const displayName = ArtifactUtils.getDisplayName(artifact);

  return (
    <Card className={cn("transition-all hover:shadow-md", className)}>
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-2 min-w-0 flex-1">
            {getIcon()}
            <CardTitle className="text-sm font-medium truncate">
              {displayName}
            </CardTitle>
          </div>
          {getTypeBadge()}
        </div>
        {artifact.summary && (
          <p className="text-xs text-muted-foreground line-clamp-2">
            {artifact.summary}
          </p>
        )}
      </CardHeader>
      
      <CardContent className="pt-0">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1 text-xs text-muted-foreground">
            <span>{artifact.mime}</span>
            {artifact.metadata?.word_count && (
              <>
                <span>•</span>
                <span>{artifact.metadata.word_count} 字</span>
              </>
            )}
          </div>
          
          <div className="flex items-center gap-1">
            {/* 查看按钮 - 所有类型都支持 */}
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onView?.(artifact)}
              className="h-8 w-8 p-0"
            >
              <Eye className="h-3 w-3" />
            </Button>
            
            {/* 编辑按钮 - 只有报告类型支持 */}
            {isReport && onEdit && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => onEdit(artifact)}
                className="h-8 w-8 p-0"
              >
                <Edit className="h-3 w-3" />
              </Button>
            )}
            
            {/* 复制按钮 - 文本类型支持 */}
            {(isReport || isCode) && onCopy && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => onCopy(artifact)}
                className="h-8 w-8 p-0"
              >
                <Copy className="h-3 w-3" />
              </Button>
            )}
            
            {/* 下载按钮 - 所有类型都支持 */}
            {onDownload && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => onDownload(artifact)}
                className="h-8 w-8 p-0"
              >
                <Download className="h-3 w-3" />
              </Button>
            )}
          </div>
        </div>
        
        {/* 批次信息 - 如果有多个结果 */}
        {artifact.metadata?.batch_id && (
          <div className="mt-2 text-xs text-muted-foreground">
            批次: {artifact.metadata.batch_id}
            {artifact.metadata.sequence && ` (${artifact.metadata.sequence})`}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
