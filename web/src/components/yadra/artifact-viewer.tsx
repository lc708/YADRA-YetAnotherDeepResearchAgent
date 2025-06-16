import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "~/components/ui/dialog";
import { Badge } from "~/components/ui/badge";
import { ScrollArea } from "~/components/ui/scroll-area";
import { Button } from "~/components/ui/button";
import { ExternalLink, Edit, Save, X, FileText } from "lucide-react";
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
      {/* 
        📏 对话框宽度控制说明：
        
        当前设置: max-w-4xl (1024px)
        
        宽度控制层级:
        1. DialogContent: max-w-4xl - 主要宽度限制
        2. UI组件默认: sm:max-w-lg (512px) - 被上面覆盖
        3. 内容区域: max-w-none - 移除prose默认宽度限制
        
        实际宽度计算:
        对话框宽度 = min(max-w-4xl, 100vw - 2rem) = min(1024px, 视窗宽度 - 32px)
        
        🔧 未来调整选项:
        - 更宽: max-w-6xl (1152px) 或 max-w-7xl (1280px)
        - 响应式: max-w-[95vw] 或 max-w-[90vw]
        - 全屏: max-w-[calc(100vw-2rem)]
        
        📱 移动端考虑:
        - 当前在小屏幕上会自动适应
        - 可能需要针对移动端特殊处理
        
        🎯 Open按钮实现后可提供独立页面，避免宽度限制
      */}
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
                  // 编辑模式：明显的视觉区分
                  <div className="min-h-[400px] border-2 border-blue-300 bg-blue-50/50 rounded-lg p-4 dark:bg-blue-900/20 dark:border-blue-400">
                    <div className="mb-3 flex items-center gap-2 text-sm text-blue-600 dark:text-blue-400 font-medium">
                      <Edit className="h-4 w-4" />
                      编辑模式 - 您可以修改内容
                    </div>
                    <ReportEditor
                      content={editorContent}
                      onMarkdownChange={handleMarkdownChange}
                    />
                  </div>
                ) : isMarkdown ? (
                  // 查看模式：优化的预览样式
                  <div className="prose prose-gray max-w-none dark:prose-invert prose-headings:font-semibold prose-p:leading-relaxed prose-li:my-1 prose-blockquote:border-l-blue-500">
                    <ReactMarkdown
                      components={{
                        // 自定义标题样式
                        h1: ({children}) => (
                          <h1 className="text-2xl font-bold mb-4 text-gray-900 dark:text-gray-100 border-b border-gray-200 pb-2">
                            {children}
                          </h1>
                        ),
                        h2: ({children}) => (
                          <h2 className="text-xl font-semibold mb-3 mt-6 text-gray-800 dark:text-gray-200">
                            {children}
                          </h2>
                        ),
                        h3: ({children}) => (
                          <h3 className="text-lg font-medium mb-2 mt-4 text-gray-700 dark:text-gray-300">
                            {children}
                          </h3>
                        ),
                        // 自定义段落样式
                        p: ({children}) => (
                          <p className="mb-4 leading-relaxed text-gray-700 dark:text-gray-300">
                            {children}
                          </p>
                        ),
                        // 自定义列表样式
                        ul: ({children}) => (
                          <ul className="mb-4 pl-6 space-y-1 text-gray-700 dark:text-gray-300">
                            {children}
                          </ul>
                        ),
                        ol: ({children}) => (
                          <ol className="mb-4 pl-6 space-y-1 text-gray-700 dark:text-gray-300">
                            {children}
                          </ol>
                        ),
                        // 自定义引用样式
                        blockquote: ({children}) => (
                          <blockquote className="border-l-4 border-blue-500 pl-4 italic text-gray-600 dark:text-gray-400 bg-gray-50 dark:bg-gray-800/50 py-2 my-4 rounded-r">
                            {children}
                          </blockquote>
                        ),
                        // 自定义代码块样式
                        code: ({children, className}) => {
                          const isInline = !className;
                          return isInline ? (
                            <code className="bg-gray-100 dark:bg-gray-800 px-1 py-0.5 rounded text-sm font-mono text-gray-800 dark:text-gray-200">
                              {children}
                            </code>
                          ) : (
                            <code className={className}>{children}</code>
                          );
                        },
                      }}
                    >
                      {artifact.payload_url || "正在加载内容..."}
                    </ReactMarkdown>
                  </div>
                ) : (
                  // 非Markdown内容 - 改进提示样式
                  <div className="text-muted-foreground py-12 text-center border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg bg-gray-50 dark:bg-gray-800/50">
                    <FileText className="mx-auto h-12 w-12 text-gray-400 mb-4" />
                    <p className="text-lg mb-2">内容预览不可用</p>
                    <p className="text-sm">此内容类型不支持在线预览</p>
                    <p className="mt-2 text-xs font-mono bg-gray-200 dark:bg-gray-700 px-2 py-1 rounded">
                      MIME: {artifact.mime}
                    </p>
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
