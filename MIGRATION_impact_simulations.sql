-- ============================================================
-- MIGRATION: Impact Simulations (Persistent Decision Layer)
-- Run this in your Supabase Dashboard > SQL Editor
-- Safe to re-run (uses IF NOT EXISTS / DO blocks)
-- ============================================================

CREATE TABLE IF NOT EXISTS impact_simulations (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  workspace_id UUID NOT NULL,
  trigger_type TEXT NOT NULL,
  trigger_id TEXT,
  trigger_fingerprint TEXT,
  affected_entities JSONB NOT NULL DEFAULT '[]'::jsonb,
  eta_delta NUMERIC NOT NULL DEFAULT 0,
  risk_delta NUMERIC NOT NULL DEFAULT 0,
  confidence_delta NUMERIC NOT NULL DEFAULT 0,
  capacity_delta NUMERIC NOT NULL DEFAULT 0,
  release_delta NUMERIC NOT NULL DEFAULT 0,
  mitigations JSONB NOT NULL DEFAULT '[]'::jsonb,
  severity TEXT NOT NULL DEFAULT 'LOW' CHECK (severity IN ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL')),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'dismissed', 'expired')),
  stale BOOLEAN NOT NULL DEFAULT FALSE,
  stale_reason TEXT,
  trigger_snapshot JSONB,
  created_by UUID,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ DEFAULT (NOW() + INTERVAL '24 hours')
);

CREATE INDEX IF NOT EXISTS idx_impact_simulations_workspace ON impact_simulations (workspace_id, status);
CREATE INDEX IF NOT EXISTS idx_impact_simulations_trigger ON impact_simulations (trigger_type, trigger_id);
CREATE INDEX IF NOT EXISTS idx_impact_simulations_expires ON impact_simulations (expires_at) WHERE status = 'pending';

ALTER TABLE impact_simulations ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'impact_simulations' AND policyname = 'Impact simulations viewable by workspace members'
  ) THEN
    CREATE POLICY "Impact simulations viewable by workspace members"
    ON impact_simulations FOR SELECT USING (
      EXISTS (SELECT 1 FROM workspace_members WHERE workspace_members.workspace_id = impact_simulations.workspace_id AND workspace_members.user_id = auth.uid())
    );
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'impact_simulations' AND policyname = 'Members can insert impact simulations'
  ) THEN
    CREATE POLICY "Members can insert impact simulations"
    ON impact_simulations FOR INSERT WITH CHECK (
      EXISTS (SELECT 1 FROM workspace_members WHERE workspace_members.workspace_id = impact_simulations.workspace_id AND workspace_members.user_id = auth.uid())
    );
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'impact_simulations' AND policyname = 'Members can update impact simulations'
  ) THEN
    CREATE POLICY "Members can update impact simulations"
    ON impact_simulations FOR UPDATE USING (
      EXISTS (SELECT 1 FROM workspace_members WHERE workspace_members.workspace_id = impact_simulations.workspace_id AND workspace_members.user_id = auth.uid())
    );
  END IF;
END $$;

-- SELECT COUNT(*) FROM impact_simulations;
