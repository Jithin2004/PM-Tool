-- =============================================================================
-- RESOLVE PM v1.3 MAINTENANCE PATCH
-- patch_v1_3_schema_fixes.sql
-- Objective: Fix clock_events/leave_balances privileges, work_sessions relationships,
--            and integration_sync_jobs schema drift.
-- Safe to run on existing databases — idempotent and non-destructive.
-- =============================================================================

-- ── 1. GRANTS FOR HR & ATTENDANCE SCHEMA ─────────────────────────────────────
-- Ensure the Postgres roles have appropriate base table privileges so RLS policies can be evaluated.
GRANT SELECT, INSERT, UPDATE, DELETE ON public.clock_events TO authenticated, anon, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.leave_balances TO authenticated, anon, service_role;


-- ── 2. SCHEMA DRIFT RECONCILIATION FOR INTEGRATION SYNC JOBS ────────────────
-- Make provider nullable for backward compatibility
ALTER TABLE public.integration_sync_jobs ALTER COLUMN provider DROP NOT NULL;

-- Change default status to 'queued' as expected by runtime
ALTER TABLE public.integration_sync_jobs ALTER COLUMN status SET DEFAULT 'queued';

-- Drop started_at default of now() so it starts NULL until processed
ALTER TABLE public.integration_sync_jobs ALTER COLUMN started_at DROP DEFAULT;

-- Add missing columns safely if they do not exist
ALTER TABLE public.integration_sync_jobs 
    ADD COLUMN IF NOT EXISTS service TEXT,
    ADD COLUMN IF NOT EXISTS payload JSONB DEFAULT '{}'::jsonb,
    ADD COLUMN IF NOT EXISTS attempts INTEGER DEFAULT 0,
    ADD COLUMN IF NOT EXISTS next_retry_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS last_error TEXT,
    ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT now();

-- Backfill 'service' from 'provider' if existing legacy jobs exist
UPDATE public.integration_sync_jobs 
    SET service = provider 
    WHERE service IS NULL AND provider IS NOT NULL;

-- Once backfilled, service can be made NOT NULL
ALTER TABLE public.integration_sync_jobs ALTER COLUMN service SET NOT NULL;


-- ── 3. RE-ESTABLISH MISSING RELATIONSHIPS ON WORK SESSIONS ───────────────────
-- Re-establish the foreign key constraints to ensure PostgREST maps relations correctly.
DO $$
BEGIN
    -- Drop constraints if they exist to prevent duplication or constraint mismatch errors
    ALTER TABLE public.work_sessions DROP CONSTRAINT IF EXISTS work_sessions_workspace_id_fkey;
    ALTER TABLE public.work_sessions DROP CONSTRAINT IF EXISTS work_sessions_user_id_fkey;
    ALTER TABLE public.work_sessions DROP CONSTRAINT IF EXISTS work_sessions_task_id_fkey;
    ALTER TABLE public.work_sessions DROP CONSTRAINT IF EXISTS work_sessions_project_id_fkey;
    ALTER TABLE public.work_sessions DROP CONSTRAINT IF EXISTS work_sessions_attendance_session_id_fkey;
    ALTER TABLE public.work_sessions DROP CONSTRAINT IF EXISTS work_sessions_milestone_id_fkey;
    ALTER TABLE public.work_sessions DROP CONSTRAINT IF EXISTS work_sessions_epic_id_fkey;
    ALTER TABLE public.work_sessions DROP CONSTRAINT IF EXISTS work_sessions_story_id_fkey;
    ALTER TABLE public.work_sessions DROP CONSTRAINT IF EXISTS work_sessions_invoice_id_fkey;

    -- Add constraints
    ALTER TABLE public.work_sessions 
        ADD CONSTRAINT work_sessions_workspace_id_fkey FOREIGN KEY (workspace_id) REFERENCES public.workspaces(id) ON DELETE CASCADE,
        ADD CONSTRAINT work_sessions_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE,
        ADD CONSTRAINT work_sessions_task_id_fkey FOREIGN KEY (task_id) REFERENCES public.tasks(id) ON DELETE SET NULL,
        ADD CONSTRAINT work_sessions_project_id_fkey FOREIGN KEY (project_id) REFERENCES public.projects(id) ON DELETE SET NULL,
        ADD CONSTRAINT work_sessions_attendance_session_id_fkey FOREIGN KEY (attendance_session_id) REFERENCES public.clock_events(id) ON DELETE SET NULL,
        ADD CONSTRAINT work_sessions_milestone_id_fkey FOREIGN KEY (milestone_id) REFERENCES public.milestones(id) ON DELETE SET NULL,
        ADD CONSTRAINT work_sessions_epic_id_fkey FOREIGN KEY (epic_id) REFERENCES public.epics(id) ON DELETE SET NULL,
        ADD CONSTRAINT work_sessions_story_id_fkey FOREIGN KEY (story_id) REFERENCES public.stories(id) ON DELETE SET NULL,
        ADD CONSTRAINT work_sessions_invoice_id_fkey FOREIGN KEY (invoice_id) REFERENCES public.invoices(id) ON DELETE SET NULL;
END $$;


-- ── 4. ADD TASK_NUMBER TO TASKS ──────────────────────────────────────────────
-- Add task_number column to tasks if missing so work_sessions engine query functions correctly.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'tasks' AND column_name = 'task_number'
  ) THEN
    ALTER TABLE public.tasks ADD COLUMN task_number SERIAL;
  END IF;
END $$;


-- ── 5. CREATING ATTENDANCE_POLICIES SCHEMA ────────────────────────────────────
-- Create attendance_policies table if missing
CREATE TABLE IF NOT EXISTS public.attendance_policies (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    working_days TEXT[] NOT NULL DEFAULT ARRAY['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday']::text[],
    daily_hours NUMERIC NOT NULL DEFAULT 8,
    settings JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT attendance_policies_workspace_id_key UNIQUE (workspace_id)
);

-- Enable RLS and create policies
ALTER TABLE public.attendance_policies ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Enable read for workspace members" ON public.attendance_policies;
CREATE POLICY "Enable read for workspace members" ON public.attendance_policies 
    FOR SELECT USING (
        workspace_id = (auth.jwt() -> 'app_metadata' ->> 'workspace_id')::uuid 
        AND (auth.jwt() -> 'app_metadata' ->> 'role') IN ('super_admin', 'admin', 'project_manager', 'team_lead', 'developer', 'employee', 'hr', 'finance', 'client')
    );

DROP POLICY IF EXISTS "Enable write for admins" ON public.attendance_policies;
CREATE POLICY "Enable write for admins" ON public.attendance_policies 
    FOR ALL USING (
        workspace_id = (auth.jwt() -> 'app_metadata' ->> 'workspace_id')::uuid 
        AND (auth.jwt() -> 'app_metadata' ->> 'role') IN ('super_admin', 'admin', 'hr')
    );

-- Table grants
GRANT SELECT, INSERT, UPDATE, DELETE ON public.attendance_policies TO authenticated, anon, service_role;


-- ── 6. USER JWT APP_METADATA SYNCHRONISATION ──────────────────────────────────
-- Setup trigger function to sync public.users.workspace_id and role to auth.users.raw_app_meta_data
CREATE OR REPLACE FUNCTION public.sync_user_app_metadata()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public, extensions
AS $$
BEGIN
  UPDATE auth.users
  SET raw_app_meta_data = COALESCE(raw_app_meta_data, '{}'::jsonb) || 
    jsonb_build_object(
      'workspace_id', NEW.workspace_id,
      'role', NEW.role
    )
  WHERE id = NEW.id;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_public_user_updated ON public.users;
CREATE TRIGGER on_public_user_updated
  AFTER INSERT OR UPDATE OF workspace_id, role ON public.users
  FOR EACH ROW EXECUTE PROCEDURE public.sync_user_app_metadata();

-- One-time backfill migration for existing users
UPDATE auth.users u
SET raw_app_meta_data = COALESCE(u.raw_app_meta_data, '{}'::jsonb) || 
  jsonb_build_object(
    'workspace_id', p.workspace_id,
    'role', p.role
  )
FROM public.users p
WHERE u.id = p.id AND p.workspace_id IS NOT NULL;


-- ── 7. CREATING & ALTERING ACTIVITY_EVENTS SCHEMA ─────────────────────────────
-- Create activity_events table base if not exists
CREATE TABLE IF NOT EXISTS public.activity_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
    actor_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
    entity_type TEXT,
    entity_id UUID,
    action_type TEXT,
    before_value JSONB,
    after_value JSONB,
    metadata JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Safely adjust existing column constraints to allow optional entity and action types
ALTER TABLE public.activity_events ALTER COLUMN entity_id DROP NOT NULL;
ALTER TABLE public.activity_events ALTER COLUMN entity_type DROP NOT NULL;
ALTER TABLE public.activity_events ALTER COLUMN action_type DROP NOT NULL;

-- Safely add new canonical columns from Phase 2
ALTER TABLE public.activity_events ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES public.users(id) ON DELETE SET NULL;
ALTER TABLE public.activity_events ADD COLUMN IF NOT EXISTS actor_name TEXT;
ALTER TABLE public.activity_events ADD COLUMN IF NOT EXISTS actor_avatar TEXT;
ALTER TABLE public.activity_events ADD COLUMN IF NOT EXISTS verb TEXT;
ALTER TABLE public.activity_events ADD COLUMN IF NOT EXISTS action TEXT;
ALTER TABLE public.activity_events ADD COLUMN IF NOT EXISTS title TEXT;
ALTER TABLE public.activity_events ADD COLUMN IF NOT EXISTS description TEXT;
ALTER TABLE public.activity_events ADD COLUMN IF NOT EXISTS severity TEXT CHECK (severity IN ('low', 'medium', 'high', 'critical'));
ALTER TABLE public.activity_events ADD COLUMN IF NOT EXISTS importance TEXT CHECK (importance IN ('info', 'normal', 'important', 'critical'));
ALTER TABLE public.activity_events ADD COLUMN IF NOT EXISTS icon_key TEXT;
ALTER TABLE public.activity_events ADD COLUMN IF NOT EXISTS ip_address TEXT;
ALTER TABLE public.activity_events ADD COLUMN IF NOT EXISTS device TEXT;
ALTER TABLE public.activity_events ADD COLUMN IF NOT EXISTS workspace_timezone TEXT DEFAULT 'UTC';
ALTER TABLE public.activity_events ADD COLUMN IF NOT EXISTS display_time TIMESTAMPTZ;
ALTER TABLE public.activity_events ADD COLUMN IF NOT EXISTS correlation_id TEXT;
ALTER TABLE public.activity_events ADD COLUMN IF NOT EXISTS run_id TEXT;
ALTER TABLE public.activity_events ADD COLUMN IF NOT EXISTS is_system BOOLEAN DEFAULT false;
ALTER TABLE public.activity_events ADD COLUMN IF NOT EXISTS visibility TEXT CHECK (visibility IN ('public', 'admin', 'private'));
ALTER TABLE public.activity_events ADD COLUMN IF NOT EXISTS origin TEXT;
ALTER TABLE public.activity_events ADD COLUMN IF NOT EXISTS module TEXT;
ALTER TABLE public.activity_events ADD COLUMN IF NOT EXISTS event_version INTEGER DEFAULT 1;
ALTER TABLE public.activity_events ADD COLUMN IF NOT EXISTS event_hash TEXT;

-- Safely add UNIQUE constraint to event_hash
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'activity_events_event_hash_key'
    ) THEN
        ALTER TABLE public.activity_events ADD CONSTRAINT activity_events_event_hash_key UNIQUE (event_hash);
    END IF;
END $$;

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_activity_events_workspace_id ON public.activity_events(workspace_id);
CREATE INDEX IF NOT EXISTS idx_activity_events_entity ON public.activity_events(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_activity_events_actor ON public.activity_events(actor_id);
CREATE INDEX IF NOT EXISTS idx_activity_events_user_id ON public.activity_events(user_id);
CREATE INDEX IF NOT EXISTS idx_activity_events_event_hash ON public.activity_events(event_hash);
CREATE INDEX IF NOT EXISTS idx_activity_events_category_severity ON public.activity_events(module, severity);
CREATE INDEX IF NOT EXISTS idx_activity_events_created_at ON public.activity_events(created_at DESC);

-- Enable RLS
ALTER TABLE public.activity_events ENABLE ROW LEVEL SECURITY;

-- Policies
DROP POLICY IF EXISTS "Enable read for workspace members" ON public.activity_events;
CREATE POLICY "Enable read for workspace members" ON public.activity_events 
    FOR SELECT USING (
        workspace_id = (auth.jwt() -> 'app_metadata' ->> 'workspace_id')::uuid 
        AND (auth.jwt() -> 'app_metadata' ->> 'role') IN ('super_admin', 'admin', 'project_manager', 'team_lead', 'developer', 'employee', 'hr', 'finance', 'client')
    );

DROP POLICY IF EXISTS "Enable insert for workspace members" ON public.activity_events;
CREATE POLICY "Enable insert for workspace members" ON public.activity_events 
    FOR INSERT WITH CHECK (
        workspace_id = (auth.jwt() -> 'app_metadata' ->> 'workspace_id')::uuid 
        AND (auth.jwt() -> 'app_metadata' ->> 'role') IN ('super_admin', 'admin', 'project_manager', 'team_lead', 'developer', 'employee', 'hr', 'finance')
    );

-- Table grants
GRANT SELECT, INSERT, UPDATE, DELETE ON public.activity_events TO authenticated, anon, service_role;



-- ── 8. CLOCK_EVENTS CHECK CONSTRAINT REMEDIATION ─────────────────────────────
-- Expand the check constraint to support PAUSE and RESUME events
ALTER TABLE public.clock_events DROP CONSTRAINT IF EXISTS clock_events_event_type_check;
ALTER TABLE public.clock_events ADD CONSTRAINT clock_events_event_type_check CHECK (event_type IN ('CLOCK_IN', 'CLOCK_OUT', 'PAUSE', 'RESUME'));


-- ── 9. NOTIFY POSTGREST SCHEMA CACHE REFRESH ────────────────────────────────
-- Ensure PostgREST immediately re-caches the relationships and tables.
NOTIFY pgrst, 'reload schema';


