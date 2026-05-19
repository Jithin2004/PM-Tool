-- ============================================================
-- MIGRATION: Tactical Execution Board Tables
-- Run this in your Supabase Dashboard > SQL Editor
-- Safe to re-run (uses IF NOT EXISTS / DO blocks for policies)
-- ============================================================

-- 1. Create tactical_tasks table
CREATE TABLE IF NOT EXISTS tactical_tasks (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  status TEXT NOT NULL DEFAULT 'triage' CHECK (status IN (
    'triage', 'in_flight', 'validation',
    'sprint_backlog', 'in_progress', 'code_review', 'merged'
  )),
  assigned_to TEXT,
  weight NUMERIC NOT NULL DEFAULT 1.0,
  due_date TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Create task_history_logs table
CREATE TABLE IF NOT EXISTS task_history_logs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  task_id TEXT NOT NULL,
  timestamp TIMESTAMPTZ DEFAULT NOW(),
  author_id TEXT,
  author_name TEXT NOT NULL,
  author_role TEXT NOT NULL,
  field_name TEXT NOT NULL,
  old_value TEXT,
  new_value TEXT,
  telemetry_snapshot JSONB NOT NULL DEFAULT '{}'::jsonb
);

-- 3. Enable Row Level Security
ALTER TABLE tactical_tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE task_history_logs ENABLE ROW LEVEL SECURITY;

-- 4. RLS Policies for tactical_tasks
-- (Using DO blocks so they are idempotent / skip if already exist)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'tactical_tasks'
    AND policyname = 'Tactical tasks viewable by authenticated users'
  ) THEN
    CREATE POLICY "Tactical tasks viewable by authenticated users"
    ON tactical_tasks FOR SELECT USING (auth.uid() IS NOT NULL);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'tactical_tasks'
    AND policyname = 'Admins and PMs can insert tactical tasks'
  ) THEN
    CREATE POLICY "Admins and PMs can insert tactical tasks"
    ON tactical_tasks FOR INSERT WITH CHECK (
      EXISTS (
        SELECT 1 FROM users
        WHERE users.id = auth.uid()
        AND users.role IN ('super_admin', 'pm')
      )
    );
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'tactical_tasks'
    AND policyname = 'Admins and PMs can update tactical tasks'
  ) THEN
    CREATE POLICY "Admins and PMs can update tactical tasks"
    ON tactical_tasks FOR UPDATE USING (
      EXISTS (
        SELECT 1 FROM users
        WHERE users.id = auth.uid()
        AND users.role IN ('super_admin', 'pm')
      )
    );
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'tactical_tasks'
    AND policyname = 'Admins and PMs can delete tactical tasks'
  ) THEN
    CREATE POLICY "Admins and PMs can delete tactical tasks"
    ON tactical_tasks FOR DELETE USING (
      EXISTS (
        SELECT 1 FROM users
        WHERE users.id = auth.uid()
        AND users.role IN ('super_admin', 'pm')
      )
    );
  END IF;
END $$;

-- 5. RLS Policies for task_history_logs
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'task_history_logs'
    AND policyname = 'Task history logs viewable by authenticated users'
  ) THEN
    CREATE POLICY "Task history logs viewable by authenticated users"
    ON task_history_logs FOR SELECT USING (auth.uid() IS NOT NULL);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'task_history_logs'
    AND policyname = 'Authenticated users can insert task history logs'
  ) THEN
    CREATE POLICY "Authenticated users can insert task history logs"
    ON task_history_logs FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
  END IF;
END $$;

-- ============================================================
-- Verification: Run these queries to confirm tables are live
-- ============================================================
-- SELECT COUNT(*) FROM tactical_tasks;
-- SELECT COUNT(*) FROM task_history_logs;
