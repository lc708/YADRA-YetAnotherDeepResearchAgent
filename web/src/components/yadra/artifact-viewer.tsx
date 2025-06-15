import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "~/components/ui/dialog";
import { Badge } from "~/components/ui/badge";
import { ScrollArea } from "~/components/ui/scroll-area";
import { Button } from "~/components/ui/button";
import { ExternalLink, Edit, Save, X } from "lucide-react";
import type { Artifact } from "~/lib/supa";
import ReactMarkdown from "react-markdown";
import { useState, useCallback, useMemo } from "react";
import ReportEditor from "~/components/editor";
import type { Content } from "@tiptap/react";

interface ArtifactViewerProps {
  artifact: Artifact | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave?: (artifact: Artifact, content: string) => void;
}

export function ArtifactViewer({
  artifact,
  open,
  onOpenChange,
  onSave,
}: ArtifactViewerProps) {
  // 所有hooks必须在条件检查之前调用
  const [isEditing, setIsEditing] = useState(false);
  const [editContent, setEditContent] = useState("");

  // 将markdown字符串转换为TipTap Content格式
  const markdownToTiptapContent = useCallback((markdown: string): Content => {
    if (!markdown || markdown.trim() === "") {
      return {
        type: "doc",
        content: [
          {
            type: "paragraph",
            content: [
              {
                type: "text",
                text: "",
              },
            ],
          },
        ],
      };
    }

    // 简单的markdown到TipTap JSON转换
    // 这里使用基本的HTML作为中间格式，TipTap可以解析HTML
    return markdown;
  }, []);

  const handleEdit = useCallback(() => {
    if (artifact) {
      setEditContent(artifact.payload_url || "");
      setIsEditing(true);
    }
  }, [artifact]);

  const handleSave = useCallback(() => {
    if (onSave && artifact && editContent !== artifact.payload_url) {
      onSave(artifact, editContent);
    }
    setIsEditing(false);
  }, [onSave, artifact, editContent]);

  const handleCancel = useCallback(() => {
    setEditContent("");
    setIsEditing(false);
  }, []);

  const handleMarkdownChange = useCallback((markdown: string) => {
    setEditContent(markdown);
  }, []);

  // 准备编辑器内容
  const editorContent = useMemo(() => {
    return markdownToTiptapContent(editContent);
  }, [editContent, markdownToTiptapContent]);

  // 条件检查放在所有hooks之后
  if (!artifact) return null;

  const isMarkdown =
    artifact.mime.includes("markdown") || artifact.mime.includes("text");
  const isReport = artifact.type === "result" && isMarkdown;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[80vh] max-w-4xl">
        <DialogHeader>
          <div className="flex items-start justify-between">
            <DialogTitle className="text-lg font-semibold">
              {artifact.node_name}
            </DialogTitle>
            <div className="flex items-center gap-2">
              <Badge
                variant={artifact.type === "process" ? "secondary" : "default"}
              >
                {artifact.type}
              </Badge>
              
              {/* 编辑模式控制按钮 */}
              {isReport && !isEditing && (
                <Button size="sm" variant="outline" onClick={handleEdit}>
                  <Edit className="mr-1 h-4 w-4" />
                  Edit
                </Button>
              )}
              
              {isEditing && (
                <>
                  <Button size="sm" variant="outline" onClick={handleSave}>
                    <Save className="mr-1 h-4 w-4" />
                    Save
                  </Button>
                  <Button size="sm" variant="ghost" onClick={handleCancel}>
                    <X className="mr-1 h-4 w-4" />
                    Cancel
                  </Button>
                </>
              )}
              
              {artifact.payload_url && !isEditing && (
                <Button size="sm" variant="outline">
                  <ExternalLink className="mr-1 h-4 w-4" />
                  Open
                </Button>
              )}
            </div>
          </div>
        </DialogHeader>

        <ScrollArea className="max-h-[60vh]">
          <div className="space-y-4">
            {artifact.summary && (
              <div>
                <h4 className="mb-2 font-medium">Summary</h4>
                <p className="text-muted-foreground text-sm">
                  {artifact.summary}
                </p>
              </div>
            )}

            <div>
              <h4 className="mb-2 font-medium">Content</h4>
              <div className="rounded-lg border p-4">
                {isEditing && isReport ? (
                  // 编辑模式：使用Novel编辑器
                  <div className="min-h-[400px]">
                    <ReportEditor
                      content={editorContent}
                      onMarkdownChange={handleMarkdownChange}
                    />
                  </div>
                ) : isMarkdown ? (
                  // 查看模式：显示Markdown渲染结果
                  <div className="prose prose-sm max-w-none">
                    <ReactMarkdown>
                      {artifact.payload_url ||
                        "Content will be loaded from payload URL"}
                    </ReactMarkdown>
                  </div>
                ) : (
                  // 非Markdown内容
                  <div className="text-muted-foreground py-8 text-center">
                    <p>Preview not available for this content type</p>
                    <p className="mt-1 text-xs">MIME: {artifact.mime}</p>
                  </div>
                )}
              </div>
            </div>

            <div className="text-muted-foreground text-xs">
              <p>Created: {new Date(artifact.created_at).toLocaleString()}</p>
              <p>Node: {artifact.node_name}</p>
              <p>Type: {artifact.mime}</p>
            </div>
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
