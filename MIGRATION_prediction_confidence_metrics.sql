CREATE TABLE IF NOT EXISTS prediction_confidence_metrics (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  workspace_id UUID NOT NULL,
  task_id UUID NOT NULL,
  predicted_confidence NUMERIC NOT NULL,
  actual_error_days INTEGER NOT NULL,
  confidence_error INTEGER NOT NULL,
  confidence_bucket TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_pcm_workspace ON prediction_confidence_metrics (workspace_id, confidence_bucket);
CREATE INDEX IF NOT EXISTS idx_pcm_bucket ON prediction_confidence_metrics (confidence_bucket);

ALTER TABLE prediction_confidence_metrics ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'prediction_confidence_metrics' AND policyname = 'PCM viewable by workspace members'
  ) THEN
    CREATE POLICY "PCM viewable by workspace members"
    ON prediction_confidence_metrics FOR SELECT USING (
      EXISTS (SELECT 1 FROM workspace_members WHERE workspace_members.workspace_id = prediction_confidence_metrics.workspace_id AND workspace_members.user_id = auth.uid())
    );
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'prediction_confidence_metrics' AND policyname = 'Members can insert PCM'
  ) THEN
    CREATE POLICY "Members can insert PCM"
    ON prediction_confidence_metrics FOR INSERT WITH CHECK (
      EXISTS (SELECT 1 FROM workspace_members WHERE workspace_members.workspace_id = prediction_confidence_metrics.workspace_id AND workspace_members.user_id = auth.uid())
    );
  END IF;
END $$;
