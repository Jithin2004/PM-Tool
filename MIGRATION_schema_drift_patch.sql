-- ============================================================
-- MIGRATION: Schema Drift Patch
-- Fixes 3 schema drifts discovered by synthetic stress test
-- Run this in your Supabase Dashboard > SQL Editor
-- Safe to re-run (uses IF NOT EXISTS / DO blocks)
-- ============================================================

-- 1. connected_accounts: add missing `connected` column
--    integrationService.ts inserts `connected: input.connected ?? true`
--    but the CREATE TABLE in MIGRATION_ecosystem_expansion.sql never defined it
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'connected_accounts' AND column_name = 'connected'
  ) THEN
    ALTER TABLE connected_accounts ADD COLUMN connected boolean NOT NULL DEFAULT true;
  END IF;
END $$;

-- 2. task_dependencies: add unique constraint for upsert on_conflict
--    createTaskDependency() upserts with onConflict: 'workspace_id,task_id,depends_on_task_id'
--    but the existing PK is only (task_id, depends_on_task_id) without workspace_id
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'task_dependencies'::regclass
    AND conname = 'task_dependencies_workspace_unique'
  ) THEN
    ALTER TABLE task_dependencies
      ADD CONSTRAINT task_dependencies_workspace_unique
      UNIQUE (workspace_id, task_id, depends_on_task_id);
  END IF;
END $$;

-- ============================================================
-- Verification queries (run separately to confirm)
-- ============================================================
-- SELECT column_name, data_type FROM information_schema.columns
--   WHERE table_name = 'connected_accounts' ORDER BY ordinal_position;
-- SELECT conname, conkey FROM pg_constraint
--   WHERE conrelid = 'task_dependencies'::regclass;
