"use client";

import { useState, useEffect, useCallback } from "react";
import { FixedSizeList as List } from "react-window";
import { supabase, type Artifact } from "~/lib/supa";
import { ArtifactCard } from "./artifact-card";
import { ArtifactViewer } from "./artifact-viewer";
import { Input } from "~/components/ui/input";
import { Search } from "lucide-react";
import { Button } from "~/components/ui/button";

interface ArtifactFeedProps {
  traceId: string;
  className?: string;
}

const ITEM_HEIGHT = 200;
const ITEMS_PER_PAGE = 50;

export function ArtifactFeed({ traceId, className }: ArtifactFeedProps) {
  const [artifacts, setArtifacts] = useState<Artifact[]>([]);
  const [filteredArtifacts, setFilteredArtifacts] = useState<Artifact[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState<"all" | "process" | "result">(
    "all",
  );
  const [loading, setLoading] = useState(true);
  const [selectedArtifact, setSelectedArtifact] = useState<Artifact | null>(
    null,
  );

  useEffect(() => {
    fetchArtifacts();
  }, [traceId]);

  useEffect(() => {
    const channel = supabase
      .channel("artifacts")
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "artifacts",
          filter: `trace_id=eq.${traceId}`,
        },
        (payload) => {
          const newArtifact = payload.new as Artifact;
          setArtifacts((prev) => [...prev, newArtifact]);
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [traceId]);

  useEffect(() => {
    let filtered = artifacts;

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
  }, [artifacts, searchQuery, typeFilter]);

  const fetchArtifacts = async () => {
    try {
      const { data, error } = await supabase
        .from("artifacts")
        .select("*")
        .eq("trace_id", traceId)
        .order("created_at", { ascending: false })
        .limit(ITEMS_PER_PAGE);

      if (error) throw error;
      setArtifacts(data || []);
    } catch (error) {
      console.error("Error fetching artifacts:", error);
      setArtifacts([
        {
          id: "demo-1",
          trace_id: traceId,
          node_name: "Research Planning",
          type: "process",
          mime: "text/markdown",
          summary: "Initial research plan for quantum computing analysis",
          payload_url: undefined,
          created_at: new Date().toISOString(),
          user_id: "demo-user",
        },
        {
          id: "demo-2",
          trace_id: traceId,
          node_name: "Quantum Computing Report",
          type: "result",
          mime: "text/markdown",
          summary:
            "Comprehensive analysis of quantum computing developments in 2024",
          payload_url: undefined,
          created_at: new Date().toISOString(),
          user_id: "demo-user",
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  const renderItem = useCallback(
    ({ index, style }: { index: number; style: React.CSSProperties }) => {
      const artifact = filteredArtifacts[index];
      if (!artifact) return null;

      return (
        <div style={style} className="px-2 py-1">
          <ArtifactCard artifact={artifact} onView={setSelectedArtifact} />
        </div>
      );
    },
    [filteredArtifacts],
  );

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        Loading artifacts...
      </div>
    );
  }

  return (
    <div className={className}>
      <div className="mb-4 space-y-4">
        <div className="relative">
          <Search className="text-muted-foreground absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 transform" />
          <Input
            placeholder="Search artifacts..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>
        <div className="flex gap-2">
          <Button
            variant={typeFilter === "all" ? "default" : "outline"}
            size="sm"
            onClick={() => setTypeFilter("all")}
          >
            All
          </Button>
          <Button
            variant={typeFilter === "process" ? "default" : "outline"}
            size="sm"
            onClick={() => setTypeFilter("process")}
          >
            Process
          </Button>
          <Button
            variant={typeFilter === "result" ? "default" : "outline"}
            size="sm"
            onClick={() => setTypeFilter("result")}
          >
            Result
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
          <div className="text-muted-foreground flex h-full items-center justify-center">
            No artifacts found for this trace
          </div>
        )}
      </div>

      <ArtifactViewer
        artifact={selectedArtifact}
        open={!!selectedArtifact}
        onOpenChange={(open) => !open && setSelectedArtifact(null)}
      />
    </div>
  );
}
