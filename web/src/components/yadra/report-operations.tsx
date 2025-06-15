import { useCallback } from "react";
import { toast } from "sonner";
import type { Artifact } from "~/lib/supa";

export interface ReportOperationsProps {
  artifact: Artifact;
}

export function useReportOperations() {
  const copyToClipboard = useCallback(async (artifact: Artifact) => {
    try {
      const content = artifact.payload_url || "";
      await navigator.clipboard.writeText(content);
      toast.success("Report copied to clipboard");
    } catch (error) {
      console.error("Failed to copy to clipboard:", error);
      toast.error("Failed to copy to clipboard");
    }
  }, []);

  const downloadAsMarkdown = useCallback((artifact: Artifact) => {
    try {
      const content = artifact.payload_url || "";
      const blob = new Blob([content], { type: "text/markdown" });
      const url = URL.createObjectURL(blob);
      
      const link = document.createElement("a");
      link.href = url;
      link.download = `${artifact.node_name.replace(/[^a-zA-Z0-9]/g, "_")}.md`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
      URL.revokeObjectURL(url);
      toast.success("Report downloaded successfully");
    } catch (error) {
      console.error("Failed to download report:", error);
      toast.error("Failed to download report");
    }
  }, []);

  const downloadFromUrl = useCallback(async (artifact: Artifact) => {
    try {
      if (!artifact.payload_url) {
        toast.error("No download URL available");
        return;
      }

      // 如果是URL，尝试下载
      if (artifact.payload_url.startsWith("http")) {
        const link = document.createElement("a");
        link.href = artifact.payload_url;
        link.target = "_blank";
        link.download = artifact.node_name;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        toast.success("Download started");
      } else {
        // 如果是内容，作为Markdown下载
        downloadAsMarkdown(artifact);
      }
    } catch (error) {
      console.error("Failed to download:", error);
      toast.error("Failed to download");
    }
  }, [downloadAsMarkdown]);

  return {
    copyToClipboard,
    downloadAsMarkdown,
    downloadFromUrl,
  };
} 