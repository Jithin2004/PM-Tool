-- ============================================================
-- MIGRATION: Calendar Events (Canonical Capacity/Availability)
-- Run this in your Supabase Dashboard > SQL Editor
-- Safe to re-run (uses IF NOT EXISTS / DO blocks for all operations)
-- ============================================================

-- 1. Create calendar_events table (if not exists — includes all columns)
CREATE TABLE IF NOT EXISTS calendar_events (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  workspace_id UUID NOT NULL,
  event_type TEXT NOT NULL CHECK (event_type IN ('holiday', 'leave', 'meeting', 'festival', 'regional', 'company', 'sprint', 'deployment', 'client_review', 'approval')),
  title TEXT NOT NULL,
  description TEXT,
  start_date TIMESTAMPTZ NOT NULL,
  end_date TIMESTAMPTZ NOT NULL,
  participants UUID[] DEFAULT '{}',
  capacity_impact NUMERIC NOT NULL DEFAULT 1.0 CHECK (capacity_impact >= 0 AND capacity_impact <= 1),
  is_recurring BOOLEAN DEFAULT FALSE,
  recurrence_rule TEXT,
  timezone TEXT DEFAULT 'UTC',
  auto_generated BOOLEAN DEFAULT FALSE,
  capacity_modifier NUMERIC DEFAULT 1.0 CHECK (capacity_modifier >= 0),
  source_id TEXT,
  source_table TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Add columns if table already existed (idempotent)
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'calendar_events' AND column_name = 'is_recurring') THEN
    ALTER TABLE calendar_events ADD COLUMN is_recurring BOOLEAN DEFAULT FALSE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'calendar_events' AND column_name = 'recurrence_rule') THEN
    ALTER TABLE calendar_events ADD COLUMN recurrence_rule TEXT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'calendar_events' AND column_name = 'timezone') THEN
    ALTER TABLE calendar_events ADD COLUMN timezone TEXT DEFAULT 'UTC';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'calendar_events' AND column_name = 'auto_generated') THEN
    ALTER TABLE calendar_events ADD COLUMN auto_generated BOOLEAN DEFAULT FALSE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'calendar_events' AND column_name = 'capacity_modifier') THEN
    ALTER TABLE calendar_events ADD COLUMN capacity_modifier NUMERIC DEFAULT 1.0;
  END IF;
END $$;

-- 3. Update CHECK constraint for event_type (add new types if table already existed)
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'calendar_events_event_type_check' AND table_name = 'calendar_events') THEN
    ALTER TABLE calendar_events DROP CONSTRAINT calendar_events_event_type_check;
  END IF;
END $$;
ALTER TABLE calendar_events ADD CONSTRAINT calendar_events_event_type_check
  CHECK (event_type IN ('holiday', 'leave', 'meeting', 'festival', 'regional', 'company', 'sprint', 'deployment', 'client_review', 'approval'));

-- 4. Indexes for common query patterns
CREATE INDEX IF NOT EXISTS idx_calendar_events_workspace_id ON calendar_events (workspace_id);
CREATE INDEX IF NOT EXISTS idx_calendar_events_date_range ON calendar_events (workspace_id, start_date, end_date);
CREATE INDEX IF NOT EXISTS idx_calendar_events_event_type ON calendar_events (event_type);
CREATE INDEX IF NOT EXISTS idx_calendar_events_source ON calendar_events (source_table, source_id);
CREATE INDEX IF NOT EXISTS idx_calendar_events_recurring ON calendar_events (is_recurring) WHERE is_recurring = TRUE;

-- 5. Enable Row Level Security
ALTER TABLE calendar_events ENABLE ROW LEVEL SECURITY;

-- 6. RLS Policies
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'calendar_events'
    AND policyname = 'Calendar events viewable by workspace members'
  ) THEN
    CREATE POLICY "Calendar events viewable by workspace members"
    ON calendar_events FOR SELECT USING (
      EXISTS (
        SELECT 1 FROM workspace_members
        WHERE workspace_members.workspace_id = calendar_events.workspace_id
        AND workspace_members.user_id = auth.uid()
      )
    );
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'calendar_events'
    AND policyname = 'Admins and PMs can insert calendar events'
  ) THEN
    CREATE POLICY "Admins and PMs can insert calendar events"
    ON calendar_events FOR INSERT WITH CHECK (
      EXISTS (
        SELECT 1 FROM workspace_members
        WHERE workspace_members.workspace_id = calendar_events.workspace_id
        AND workspace_members.user_id = auth.uid()
        AND workspace_members.role IN ('admin', 'pm', 'super_admin')
      )
    );
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'calendar_events'
    AND policyname = 'Admins and PMs can update calendar events'
  ) THEN
    CREATE POLICY "Admins and PMs can update calendar events"
    ON calendar_events FOR UPDATE USING (
      EXISTS (
        SELECT 1 FROM workspace_members
        WHERE workspace_members.workspace_id = calendar_events.workspace_id
        AND workspace_members.user_id = auth.uid()
        AND workspace_members.role IN ('admin', 'pm', 'super_admin')
      )
    );
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'calendar_events'
    AND policyname = 'Admins and PMs can delete calendar events'
  ) THEN
    CREATE POLICY "Admins and PMs can delete calendar events"
    ON calendar_events FOR DELETE USING (
      EXISTS (
        SELECT 1 FROM workspace_members
        WHERE workspace_members.workspace_id = calendar_events.workspace_id
        AND workspace_members.user_id = auth.uid()
        AND workspace_members.role IN ('admin', 'pm', 'super_admin')
      )
    );
  END IF;
END $$;

-- ============================================================
-- Verification
-- ============================================================
-- SELECT COUNT(*) FROM calendar_events;
-- SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'calendar_events' ORDER BY ordinal_position;
