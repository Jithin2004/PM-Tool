-- ============================================================
-- MIGRATION: Prediction Errors (ETA Calibration Layer)
-- Records predicted vs actual completion for every task
-- Enables confidence calibration, bias detection, model tuning
-- Run this in your Supabase Dashboard > SQL Editor
-- Safe to re-run
-- ============================================================

CREATE TABLE IF NOT EXISTS prediction_errors (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  workspace_id UUID NOT NULL,
  task_id UUID NOT NULL,
  task_name TEXT,
  assignee_id UUID,
  predicted_completion DATE NOT NULL,
  actual_completion DATE NOT NULL,
  prediction_error_days INTEGER NOT NULL,
  predicted_confidence NUMERIC,
  confidence_error NUMERIC,
  predicted_risk TEXT,
  estimated_hours NUMERIC,
  actual_hours NUMERIC,
  pert_best NUMERIC,
  pert_likely NUMERIC,
  pert_worst NUMERIC,
  delay_drift_days NUMERIC,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_prediction_errors_workspace ON prediction_errors (workspace_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_prediction_errors_task ON prediction_errors (task_id);
CREATE INDEX IF NOT EXISTS idx_prediction_errors_error ON prediction_errors (prediction_error_days);

ALTER TABLE prediction_errors ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'prediction_errors' AND policyname = 'Prediction errors viewable by workspace members'
  ) THEN
    CREATE POLICY "Prediction errors viewable by workspace members"
    ON prediction_errors FOR SELECT USING (
      EXISTS (SELECT 1 FROM workspace_members WHERE workspace_members.workspace_id = prediction_errors.workspace_id AND workspace_members.user_id = auth.uid())
    );
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'prediction_errors' AND policyname = 'Members can insert prediction errors'
  ) THEN
    CREATE POLICY "Members can insert prediction errors"
    ON prediction_errors FOR INSERT WITH CHECK (
      EXISTS (SELECT 1 FROM workspace_members WHERE workspace_members.workspace_id = prediction_errors.workspace_id AND workspace_members.user_id = auth.uid())
    );
  END IF;
END $$;

-- Measure: mean absolute error per workspace
-- SELECT workspace_id, AVG(ABS(prediction_error_days)) AS mae, COUNT(*) AS samples FROM prediction_errors GROUP BY workspace_id;

-- Measure: bias (signed average error — positive means overestimating)
-- SELECT workspace_id, AVG(prediction_error_days) AS bias FROM prediction_errors GROUP BY workspace_id;
