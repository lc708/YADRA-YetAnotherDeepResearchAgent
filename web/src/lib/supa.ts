import { createClient } from "@supabase/supabase-js";

import { env } from "~/env";

export const supabase = createClient(
  env.NEXT_PUBLIC_SUPABASE_URL ?? "",
  env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "",
);

export type ArtifactType = "process" | "result";

export interface Artifact {
  id: string;
  trace_id: string;
  node_name: string;
  type: ArtifactType;
  mime: string;
  summary?: string;
  payload_url?: string;
  created_at: string;
  user_id: string;
}

export interface Database {
  public: {
    Tables: {
      artifacts: {
        Row: Artifact;
        Insert: Omit<Artifact, "id" | "created_at">;
        Update: Partial<Omit<Artifact, "id" | "created_at">>;
      };
    };
  };
}
