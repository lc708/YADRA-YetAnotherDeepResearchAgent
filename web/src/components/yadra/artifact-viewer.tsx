import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "~/components/ui/dialog";
import { Badge } from "~/components/ui/badge";
import { ScrollArea } from "~/components/ui/scroll-area";
import { Button } from "~/components/ui/button";
import { ExternalLink } from "lucide-react";
import type { Artifact } from "~/lib/supa";
import ReactMarkdown from "react-markdown";

interface ArtifactViewerProps {
  artifact: Artifact | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ArtifactViewer({
  artifact,
  open,
  onOpenChange,
}: ArtifactViewerProps) {
  if (!artifact) return null;

  const isMarkdown =
    artifact.mime.includes("markdown") || artifact.mime.includes("text");

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
              {artifact.payload_url && (
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
                {isMarkdown ? (
                  <div className="prose prose-sm max-w-none">
                    <ReactMarkdown>
                      {artifact.payload_url ||
                        "Content will be loaded from payload URL"}
                    </ReactMarkdown>
                  </div>
                ) : (
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
