import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import { Eye, Download } from "lucide-react";
import { cn } from "~/lib/utils";
import type { Artifact } from "~/lib/supa";

interface ArtifactCardProps {
  artifact: Artifact;
  onView?: (artifact: Artifact) => void;
  className?: string;
}

export function ArtifactCard({
  artifact,
  onView,
  className,
}: ArtifactCardProps) {
  const isProcess = artifact.type === "process";

  return (
    <Card
      className={cn(
        "transition-all hover:shadow-md",
        isProcess
          ? "border-muted bg-muted/20"
          : "border-primary/20 bg-primary/5",
        className,
      )}
    >
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <CardTitle className="line-clamp-2 text-sm font-medium">
            {artifact.node_name}
          </CardTitle>
          <Badge variant={isProcess ? "secondary" : "default"}>
            {artifact.type}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        {artifact.summary && (
          <p className="text-muted-foreground mb-3 line-clamp-3 text-sm">
            {artifact.summary}
          </p>
        )}
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant="outline"
            onClick={() => onView?.(artifact)}
            className="flex-1"
          >
            <Eye className="mr-1 h-4 w-4" />
            View
          </Button>
          {artifact.payload_url && (
            <Button size="sm" variant="ghost">
              <Download className="h-4 w-4" />
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
