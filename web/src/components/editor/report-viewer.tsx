// Copyright (c) 2025 YADRA

"use client";

import {
  EditorCommand,
  EditorCommandEmpty,
  EditorCommandItem,
  EditorCommandList,
  EditorContent,
  type EditorInstance,
  EditorRoot,
  ImageResizer,
  type JSONContent,
  handleCommandNavigation,
  handleImageDrop,
  handleImagePaste,
} from "novel";
import type { Content } from "@tiptap/react";
import { useEffect, useState, useCallback } from "react";
import { useDebouncedCallback } from "use-debounce";
import { defaultExtensions } from "./extensions";
import { ColorSelector } from "./selectors/color-selector";
import { LinkSelector } from "./selectors/link-selector";
import { MathSelector } from "./selectors/math-selector";
import { NodeSelector } from "./selectors/node-selector";
import { Separator } from "../ui/separator";
import { Button } from "../ui/button";
import { Download, Copy, FileText, Printer } from "lucide-react";
import { toast } from "sonner";

import GenerativeMenuSwitch from "./generative/generative-menu-switch";
import { uploadFn } from "./image-upload";
import { TextButtons } from "./selectors/text-buttons";
import { slashCommand, suggestionItems } from "./slash-command";

import "~/styles/prosemirror.css";

const hljs = require("highlight.js");

const extensions = [...defaultExtensions, slashCommand];

export interface ReportViewerProps {
  content: string; // Markdown content
  title?: string;
  readonly?: boolean;
  onContentChange?: (markdown: string) => void;
}

const ReportViewer = ({ 
  content, 
  title = "研究报告", 
  readonly = false,
  onContentChange 
}: ReportViewerProps) => {
  const [initialContent, setInitialContent] = useState<Content>(() => content);
  const [currentMarkdown, setCurrentMarkdown] = useState<string>(content);
  const [saveStatus, setSaveStatus] = useState("Saved");

  const [openNode, setOpenNode] = useState(false);
  const [openColor, setOpenColor] = useState(false);
  const [openLink, setOpenLink] = useState(false);
  const [openAI, setOpenAI] = useState(false);

  // 下载为Markdown文件
  const downloadMarkdown = useCallback(() => {
    const blob = new Blob([currentMarkdown], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${title}.md`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    toast.success("Markdown文件已下载");
  }, [currentMarkdown, title]);

  // 复制到剪贴板
  const copyToClipboard = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(currentMarkdown);
      toast.success("内容已复制到剪贴板");
    } catch (err) {
      toast.error("复制失败");
    }
  }, [currentMarkdown]);

  // 下载为HTML文件
  const downloadHTML = useCallback((editor: EditorInstance) => {
    const html = editor.getHTML();
    const fullHTML = `
<!DOCTYPE html>
<html lang="zh-CN">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${title}</title>
    <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 800px; margin: 0 auto; padding: 2rem; line-height: 1.6; }
        h1, h2, h3, h4, h5, h6 { color: #333; margin-top: 2rem; margin-bottom: 1rem; }
        p { margin-bottom: 1rem; }
        pre { background: #f5f5f5; padding: 1rem; border-radius: 4px; overflow-x: auto; }
        code { background: #f5f5f5; padding: 0.2rem 0.4rem; border-radius: 3px; }
        blockquote { border-left: 4px solid #ddd; margin: 1rem 0; padding-left: 1rem; color: #666; }
        table { border-collapse: collapse; width: 100%; margin: 1rem 0; }
        th, td { border: 1px solid #ddd; padding: 0.5rem; text-align: left; }
        th { background: #f5f5f5; }
    </style>
</head>
<body>
    ${html}
</body>
</html>`;
    
    const blob = new Blob([fullHTML], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${title}.html`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    toast.success("HTML文件已下载");
  }, [title]);

  // 打印
  const printReport = useCallback(() => {
    window.print();
    toast.success("打印对话框已打开");
  }, []);

  //Apply Codeblock Highlighting on the HTML from editor.getHTML()
  const highlightCodeblocks = (content: string) => {
    const doc = new DOMParser().parseFromString(content, "text/html");
    doc.querySelectorAll("pre code").forEach((el) => {
      // @ts-ignore
      // https://highlightjs.readthedocs.io/en/latest/api.html?highlight=highlightElement#highlightelement
      hljs.highlightElement(el);
    });
    return new XMLSerializer().serializeToString(doc);
  };

  const debouncedUpdates = useDebouncedCallback(
    async (editor: EditorInstance) => {
      const markdown = editor.storage.markdown.getMarkdown();
      setCurrentMarkdown(markdown);
      if (onContentChange) {
        onContentChange(markdown);
      }
      setSaveStatus("Saved");
    },
    500,
  );

  if (!initialContent) return null;

  return (
    <div className="relative w-full">
      {/* 工具栏 */}
      <div className="flex items-center justify-between p-2 border-b border-muted bg-muted/10 rounded-t-lg">
        <div className="flex items-center gap-2">
          <FileText className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm font-medium">{title}</span>
          {!readonly && (
            <span className="text-xs text-muted-foreground">({saveStatus})</span>
          )}
        </div>
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="sm"
            onClick={copyToClipboard}
            title="复制到剪贴板"
          >
            <Copy className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={downloadMarkdown}
            title="下载Markdown"
          >
            <Download className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={printReport}
            title="打印"
          >
            <Printer className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <EditorRoot>
        <EditorContent
          immediatelyRender={false}
          initialContent={initialContent as JSONContent}
          extensions={extensions}
          className="border-muted relative h-full w-full border-t-0 rounded-t-none"
          editable={!readonly}
          editorProps={{
            handleDOMEvents: {
              keydown: (_view, event) => handleCommandNavigation(event),
            },
            handlePaste: (view, event) =>
              handleImagePaste(view, event, uploadFn),
            handleDrop: (view, event, _slice, moved) =>
              handleImageDrop(view, event, moved, uploadFn),
            attributes: {
              class: `prose prose-base prose-p:my-4 dark:prose-invert prose-headings:font-title font-default focus:outline-none max-w-full ${readonly ? 'cursor-default' : ''}`,
            },
          }}
          onUpdate={({ editor }) => {
            if (!readonly) {
              debouncedUpdates(editor);
              setSaveStatus("Unsaved");
            }
          }}
          slotAfter={<ImageResizer />}
        >
          {!readonly && (
            <EditorCommand className="border-muted bg-background z-50 h-auto max-h-[330px] overflow-y-auto rounded-md border px-1 py-2 shadow-md transition-all">
              <EditorCommandEmpty className="text-muted-foreground px-2">
                No results
              </EditorCommandEmpty>
              <EditorCommandList>
                {suggestionItems.map((item) => (
                  <EditorCommandItem
                    value={item.title}
                    onCommand={(val) => item.command?.(val)}
                    className="hover:bg-accent aria-selected:bg-accent flex w-full items-center space-x-2 rounded-md px-2 py-1 text-left text-sm"
                    key={item.title}
                  >
                    <div className="border-muted bg-background flex h-10 w-10 items-center justify-center rounded-md border">
                      {item.icon}
                    </div>
                    <div>
                      <p className="font-medium">{item.title}</p>
                      <p className="text-muted-foreground text-xs">
                        {item.description}
                      </p>
                    </div>
                  </EditorCommandItem>
                ))}
              </EditorCommandList>
            </EditorCommand>
          )}

          {!readonly && (
            <GenerativeMenuSwitch open={openAI} onOpenChange={setOpenAI}>
              <Separator orientation="vertical" />
              <NodeSelector open={openNode} onOpenChange={setOpenNode} />
              <Separator orientation="vertical" />
              <TextButtons />
              <Separator orientation="vertical" />
              <ColorSelector open={openColor} onOpenChange={setOpenColor} />
              <Separator orientation="vertical" />
              <LinkSelector open={openLink} onOpenChange={setOpenLink} />
              <Separator orientation="vertical" />
              <MathSelector />
            </GenerativeMenuSwitch>
          )}
        </EditorContent>
      </EditorRoot>
    </div>
  );
};

export default ReportViewer; 