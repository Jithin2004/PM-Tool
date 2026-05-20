CREATE TABLE IF NOT EXISTS prediction_context_metrics (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  workspace_id UUID NOT NULL,
  context_type TEXT NOT NULL,
  context_value TEXT NOT NULL,
  historical_accuracy NUMERIC NOT NULL DEFAULT 0,
  mean_error NUMERIC NOT NULL DEFAULT 0,
  overconfidence_rate NUMERIC NOT NULL DEFAULT 0,
  underconfidence_rate NUMERIC NOT NULL DEFAULT 0,
  sample_size INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_pcm_context ON prediction_context_metrics (workspace_id, context_type, context_value);
CREATE INDEX IF NOT EXISTS idx_pcm_type ON prediction_context_metrics (workspace_id, context_type, historical_accuracy DESC);

ALTER TABLE prediction_context_metrics ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'prediction_context_metrics' AND policyname = 'PCMx viewable by workspace members'
  ) THEN
    CREATE POLICY "PCMx viewable by workspace members"
    ON prediction_context_metrics FOR SELECT USING (
      EXISTS (SELECT 1 FROM workspace_members WHERE workspace_members.workspace_id = prediction_context_metrics.workspace_id AND workspace_members.user_id = auth.uid())
    );
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'prediction_context_metrics' AND policyname = 'Members can insert PCMx'
  ) THEN
    CREATE POLICY "Members can insert PCMx"
    ON prediction_context_metrics FOR INSERT WITH CHECK (
      EXISTS (SELECT 1 FROM workspace_members WHERE workspace_members.workspace_id = prediction_context_metrics.workspace_id AND workspace_members.user_id = auth.uid())
    );
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'prediction_context_metrics' AND policyname = 'Members can update PCMx'
  ) THEN
    CREATE POLICY "Members can update PCMx"
    ON prediction_context_metrics FOR UPDATE USING (
      EXISTS (SELECT 1 FROM workspace_members WHERE workspace_members.workspace_id = prediction_context_metrics.workspace_id AND workspace_members.user_id = auth.uid())
    );
  END IF;
END $$;

-- SELECT create_hypertable('prediction_context_metrics', 'created_at', if_not_exists => TRUE);
