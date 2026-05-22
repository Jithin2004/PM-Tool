-- ============================================================
-- MIGRATION: Cryptographic Immutable Audit Trail (WORM)
-- Run this in your Supabase Dashboard > SQL Editor
-- ============================================================

-- Enable pgcrypto extension if not already present
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- 1. Create change_logs table with UUID types to match projects.id in V2
CREATE TABLE IF NOT EXISTS change_logs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  timestamp TIMESTAMPTZ DEFAULT NOW(),
  changes TEXT NOT NULL,
  reason TEXT NOT NULL,
  author_name TEXT NOT NULL,
  author_role TEXT NOT NULL,
  previous_hash TEXT,
  hash TEXT
);

-- 2. Extend task_history_logs table with cryptographic columns
ALTER TABLE task_history_logs ADD COLUMN IF NOT EXISTS previous_hash TEXT;
ALTER TABLE task_history_logs ADD COLUMN IF NOT EXISTS hash TEXT;

-- 3. Backfill existing logs with mock genesis block hashes (if any exist)
UPDATE change_logs 
SET previous_hash = 'GENESIS_BLOCK', 
    hash = encode(digest(changes || reason || 'GENESIS_BLOCK', 'sha256'), 'hex') 
WHERE hash IS NULL;

UPDATE task_history_logs 
SET previous_hash = 'GENESIS_BLOCK', 
    hash = encode(digest(field_name || 'GENESIS_BLOCK', 'sha256'), 'hex') 
WHERE hash IS NULL;

-- 4. Enable Row Level Security
ALTER TABLE change_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE task_history_logs ENABLE ROW LEVEL SECURITY;

-- 5. Set up SELECT and INSERT policies for change_logs
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'change_logs'
    AND policyname = 'Change logs viewable by authenticated users'
  ) THEN
    CREATE POLICY "Change logs viewable by authenticated users"
    ON change_logs FOR SELECT USING (auth.uid() IS NOT NULL);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'change_logs'
    AND policyname = 'Authenticated users can insert change logs'
  ) THEN
    CREATE POLICY "Authenticated users can insert change logs"
    ON change_logs FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
  END IF;
END $$;

-- 6. Strict WORM Policies: Forbid UPDATE and DELETE on change_logs and task_history_logs
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'change_logs'
    AND policyname = 'Forbid UPDATE on change logs'
  ) THEN
    CREATE POLICY "Forbid UPDATE on change logs"
    ON change_logs FOR UPDATE USING (false);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'change_logs'
    AND policyname = 'Forbid DELETE on change logs'
  ) THEN
    CREATE POLICY "Forbid DELETE on change logs"
    ON change_logs FOR DELETE USING (false);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'task_history_logs'
    AND policyname = 'Forbid UPDATE on task history logs'
  ) THEN
    CREATE POLICY "Forbid UPDATE on task history logs"
    ON task_history_logs FOR UPDATE USING (false);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'task_history_logs'
    AND policyname = 'Forbid DELETE on task history logs'
  ) THEN
    CREATE POLICY "Forbid DELETE on task history logs"
    ON task_history_logs FOR DELETE USING (false);
  END IF;
END $$;
