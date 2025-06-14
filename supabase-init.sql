
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

CREATE TYPE artifact_type AS ENUM ('process', 'result');

CREATE TABLE public.artifacts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  trace_id UUID NOT NULL,
  node_name TEXT NOT NULL,
  type artifact_type NOT NULL,
  mime TEXT NOT NULL,
  summary TEXT,
  payload_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE
);

CREATE INDEX idx_artifacts_trace_id ON public.artifacts(trace_id);
CREATE INDEX idx_artifacts_user_id ON public.artifacts(user_id);
CREATE INDEX idx_artifacts_created_at ON public.artifacts(created_at DESC);
CREATE INDEX idx_artifacts_type ON public.artifacts(type);

ALTER TABLE public.artifacts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own artifacts"
  ON public.artifacts FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own artifacts"
  ON public.artifacts FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own artifacts"
  ON public.artifacts FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own artifacts"
  ON public.artifacts FOR DELETE
  USING (auth.uid() = user_id);

ALTER PUBLICATION supabase_realtime ADD TABLE public.artifacts;

CREATE OR REPLACE FUNCTION public.set_artifact_user_id()
RETURNS TRIGGER AS $$
BEGIN
  NEW.user_id = auth.uid();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER set_artifact_user_id_trigger
  BEFORE INSERT ON public.artifacts
  FOR EACH ROW
  EXECUTE FUNCTION public.set_artifact_user_id();

GRANT USAGE ON SCHEMA public TO anon, authenticated;
GRANT ALL ON public.artifacts TO authenticated;
GRANT SELECT ON public.artifacts TO anon;

CREATE OR REPLACE VIEW public.artifact_stats AS
SELECT 
  user_id,
  trace_id,
  COUNT(*) as total_artifacts,
  COUNT(CASE WHEN type = 'process' THEN 1 END) as process_count,
  COUNT(CASE WHEN type = 'result' THEN 1 END) as result_count,
  MIN(created_at) as first_artifact,
  MAX(created_at) as last_artifact
FROM public.artifacts
GROUP BY user_id, trace_id;

GRANT SELECT ON public.artifact_stats TO authenticated;
