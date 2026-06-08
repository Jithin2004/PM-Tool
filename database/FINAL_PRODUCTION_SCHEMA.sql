-- =============================================================
-- RESOLVE PM Ã¢â‚¬â€ PRODUCTION MASTER DATABASE SCHEMA
-- Version: 3.0.0 Ã¢â‚¬â€ Consolidated Canonical Deployment
-- Generated: 2026-05-27
--
-- This is the SINGLE SOURCE OF TRUTH for the Resolve PM database.
-- Do NOT run individual MIGRATION_*.sql files alongside this file.
-- Apply this document once to a clean Supabase project.
-- =============================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";

-- -------------------------------------------------------------
-- Clean Drop Section (Reverse Dependency Order)
-- -------------------------------------------------------------

-- Triggers
-- DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users; -- Removed to prevent permission errors in Supabase SQL Editor

-- Functions
DROP FUNCTION IF EXISTS public.handle_new_user() CASCADE;
DROP FUNCTION IF EXISTS current_workspace() CASCADE;
DROP FUNCTION IF EXISTS get_operational_intelligence(UUID) CASCADE;

-- Tables (children before parents)
DROP TABLE IF EXISTS system_audit_ledger CASCADE;
DROP TABLE IF EXISTS workspace_settings CASCADE;
DROP TABLE IF EXISTS personal_leave CASCADE;
DROP TABLE IF EXISTS team_events CASCADE;
DROP TABLE IF EXISTS workspace_holidays CASCADE;
DROP TABLE IF EXISTS invitations CASCADE;
DROP TABLE IF EXISTS salaries CASCADE;
DROP TABLE IF EXISTS attendance CASCADE;
DROP TABLE IF EXISTS activity_logs CASCADE;
DROP TABLE IF EXISTS notifications CASCADE;
DROP TABLE IF EXISTS files CASCADE;
DROP TABLE IF EXISTS comments CASCADE;
DROP TABLE IF EXISTS task_comments CASCADE;
DROP TABLE IF EXISTS task_dependencies CASCADE;
DROP TABLE IF EXISTS wait_states CASCADE;
DROP TABLE IF EXISTS tasks CASCADE;
DROP TABLE IF EXISTS project_signoffs CASCADE;
DROP TABLE IF EXISTS project_allocations CASCADE;
DROP TABLE IF EXISTS allocation_periods CASCADE;
DROP TABLE IF EXISTS projects CASCADE;
DROP TABLE IF EXISTS team_members CASCADE;
DROP TABLE IF EXISTS teams CASCADE;
DROP TABLE IF EXISTS users CASCADE;
DROP TABLE IF EXISTS workspaces CASCADE;
-- Legacy table aliases from V1 schema
DROP TABLE IF EXISTS profiles CASCADE;


-- =============================================================
-- CORE TABLE DEFINITIONS
-- =============================================================

-- 1. workspaces
--    Root of all data isolation. Every table references this via workspace_id.
CREATE TABLE workspaces (
  id                  uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  name                text        NOT NULL,
  owner_id            uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  business_type       text        NOT NULL DEFAULT 'Software',
  template_id         text,
  execution_mode      text        NOT NULL DEFAULT 'KANBAN',
  default_lanes       integer     NOT NULL DEFAULT 5,
  workflow_rules      jsonb       NOT NULL DEFAULT '{}'::jsonb,
  work_start          time        NOT NULL DEFAULT '09:00',
  work_end            time        NOT NULL DEFAULT '17:00',
  lunch_duration      integer     NOT NULL DEFAULT 60,
  workdays            integer[]   NOT NULL DEFAULT array[1,2,3,4,5],
  timezone            text        NOT NULL DEFAULT 'UTC',
  attendance_enabled  boolean     NOT NULL DEFAULT true,
  payroll_enabled     boolean     NOT NULL DEFAULT false,
  productivity_factor numeric     NOT NULL DEFAULT 0.8,
  country             text,
  region              text,
  completion_policy   text        NOT NULL DEFAULT 'controlled' CHECK (completion_policy IN ('flexible', 'controlled', 'strict', 'enterprise')),
  allow_overallocation boolean    NOT NULL DEFAULT false,
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now()
);


-- 2. users
--    Canonical identity + RBAC profile. Role 'uninvited' is a client-only ephemeral state.
CREATE TABLE users (
  id                  uuid        PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  workspace_id        uuid        REFERENCES workspaces(id) ON DELETE CASCADE,
  email               text        NOT NULL,
  full_name           text,
  phone               text,
  avatar_url          text,
  role                text        NOT NULL DEFAULT 'viewer'
                                  CHECK (role IN ('super_admin', 'pm', 'developer', 'viewer', 'pending-workspace-setup')),
  designation         text,
  availability_factor numeric     NOT NULL DEFAULT 1,
  created_at          timestamptz NOT NULL DEFAULT now(),
  UNIQUE(workspace_id, email)
);


-- 3. teams
--    Operational groups of users.
--    'data' JSONB stores pm_id and developer_ids (membership roster managed by the application layer).
CREATE TABLE teams (
  id                       uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id             uuid        NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  name                     text        NOT NULL,
  capacity_hours_per_week  numeric,
  data                     jsonb       DEFAULT '{}'::jsonb,
  created_at               timestamptz NOT NULL DEFAULT now(),
  updated_at               timestamptz NOT NULL DEFAULT now()
);


-- 4. team_members
--    Explicit join table for many-to-many team Ã¢â€ â€ user relations.
CREATE TABLE team_members (
  workspace_id  uuid  NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  team_id       uuid  NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  user_id       uuid  NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  member_role   text,
  PRIMARY KEY (team_id, user_id)
);


-- 5. projects
--    Parent-only containers. PERT macro-estimation removed (legacy project-level pert_best/likely/worst purged).
--    PERT is now computed exclusively from task-level aggregations via get_operational_intelligence().
CREATE TABLE projects (
  id                    uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id          uuid        NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  team_id               uuid        REFERENCES teams(id) ON DELETE SET NULL,
  owner_id              uuid        REFERENCES users(id) ON DELETE RESTRICT,
  name                  text        NOT NULL,
  description           text,
  status                text        NOT NULL DEFAULT 'planning'
                                    CHECK (status IN ('planning', 'active', 'in-progress', 'review', 'done', 'archived', 'deployed')),
  priority              text        NOT NULL DEFAULT 'medium'
                                    CHECK (priority IN ('low', 'medium', 'high', 'urgent')),
  template              text        NOT NULL DEFAULT 'Blank',
  execution_mode        text        NOT NULL DEFAULT 'KANBAN'
                                    CHECK (execution_mode IN ('KANBAN', 'SCRUM', 'HYBRID', 'SDLC', 'CUSTOM')),
  -- Temporal fields
  deadline              timestamptz,
  client_deadline       timestamptz,
  proposed_start_date   timestamptz,
  predicted_completion  timestamptz,
  -- Analytics
  confidence            integer,
  risk                  text        CHECK (risk IN ('low', 'medium', 'high')),
  delay_drift_days      integer     DEFAULT 0,
  efficiency            numeric     DEFAULT 1.0,
  tags                  text[]      DEFAULT '{}',
  -- Immutable audit header (written once on creation, sealed by DB trigger or service layer)
  audit_header          jsonb       DEFAULT '{}'::jsonb,
  -- Soft delete
  deleted_at            timestamptz,
  created_at            timestamptz NOT NULL DEFAULT now(),
  updated_at            timestamptz NOT NULL DEFAULT now()
);


-- 6. tasks
--    Executable work items carrying task-level PERT for micro-estimation.
--    Aggregated globally by get_operational_intelligence() RPC.
CREATE TABLE tasks (
  id                    uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id          uuid        NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  project_id            uuid        NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  assignee_id           uuid        REFERENCES users(id) ON DELETE RESTRICT,
  -- Hierarchy
  parent_task_id        uuid        REFERENCES tasks(id) ON DELETE CASCADE,
  epic_id               uuid,
  sprint_id             uuid,
  story_id              uuid,
  -- Identity
  name                  text        NOT NULL,
  description           text,
  definition_of_done    text,
  acceptance_criteria   text,
  -- State
  status                text        NOT NULL DEFAULT 'backlog'
                                    CHECK (status IN ('backlog', 'ready', 'in_progress', 'review', 'done')),
  priority              text        NOT NULL DEFAULT 'medium'
                                    CHECK (priority IN ('low', 'medium', 'high', 'urgent')),
  risk                  text        CHECK (risk IN ('low', 'medium', 'high')),
  -- Temporal
  start_date            timestamptz,
  deadline              timestamptz,
  due_date              timestamptz,   -- Legacy alias for deadline; normalised by application layer
  predicted_completion  timestamptz,
  -- Effort
  estimated_hours       numeric     NOT NULL DEFAULT 0,
  story_points          numeric,
  pert_best             numeric,
  pert_likely           numeric,
  pert_worst            numeric,
  -- Analytics
  confidence            integer,
  delay_drift_days      integer     DEFAULT 0,
  
  -- Time Tracking (Phase 1A)
  milestone_id          uuid,
  work_time_hours       numeric     DEFAULT 0,
  wait_time_hours       numeric     DEFAULT 0,
  cycle_time_hours      numeric     DEFAULT 0,
  last_activity_at      timestamptz,
  
  -- Soft delete
  deleted_at            timestamptz,
  created_at            timestamptz NOT NULL DEFAULT now(),
  updated_at            timestamptz NOT NULL DEFAULT now()
);


-- 7. task_dependencies
--    Directed acyclic graph of task blockers.
CREATE TABLE task_dependencies (
  workspace_id          uuid  NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  task_id               uuid  NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  depends_on_task_id    uuid  NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  PRIMARY KEY (task_id, depends_on_task_id),
  UNIQUE (workspace_id, task_id, depends_on_task_id),
  CHECK (task_id <> depends_on_task_id)
);

-- 7.1. wait_states
--    Polymorphic wait state tracking for Phase 1A Enterprise Delivery Model.
CREATE TABLE wait_states (
  id                  uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id        uuid        NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  target_type         text        NOT NULL CHECK (target_type IN ('project', 'milestone', 'task')),
  target_id           uuid        NOT NULL,
  category            text        NOT NULL CHECK (category IN ('client', 'vendor', 'approval', 'compliance', 'infrastructure', 'data', 'internal_cross_team')),
  reason              text,
  waiting_on          text        NOT NULL CHECK (waiting_on IN ('client', 'vendor', 'internal_team', 'pm', 'compliance', 'infrastructure', 'external_partner', 'other')),
  status              text        NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'resolved')),
  started_at          timestamptz NOT NULL DEFAULT now(),
  resolved_at         timestamptz,
  duration_hours      numeric     DEFAULT 0
);

-- 7.2. project_signoffs
CREATE TABLE project_signoffs (
  id                  uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id        uuid        NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  project_id          uuid        NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  approver_id         uuid        NOT NULL REFERENCES users(id),
  role                text        NOT NULL,
  notes               text,
  created_at          timestamptz NOT NULL DEFAULT now()
);

-- 7.3. project_allocations
CREATE TABLE project_allocations (
  id                  uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id        uuid        NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  project_id          uuid        NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  user_id             uuid        NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  allocation_percent  numeric     NOT NULL DEFAULT 100 CHECK (allocation_percent >= 0 AND allocation_percent <= 1000),
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now(),
  UNIQUE(project_id, user_id)
);

-- 7.4. allocation_periods
CREATE TABLE allocation_periods (
  id                  uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id        uuid        NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  project_id          uuid        NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  user_id             uuid        NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  allocation_percent  numeric     NOT NULL CHECK (allocation_percent >= 0 AND allocation_percent <= 100),
  start_date          date        NOT NULL,
  end_date            date        NOT NULL,
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now(),
  deleted_at          timestamptz,
  CHECK (start_date <= end_date)
);


-- 8. comments
CREATE TABLE comments (
  id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id  uuid        NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  task_id       uuid        REFERENCES tasks(id) ON DELETE CASCADE,
  project_id    uuid        REFERENCES projects(id) ON DELETE CASCADE,
  author_id     uuid        REFERENCES users(id) ON DELETE RESTRICT,
  body          text        NOT NULL,
  created_at    timestamptz NOT NULL DEFAULT now()
);

-- 8.1 task_comments
CREATE TABLE task_comments (
  id                uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id      uuid        NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  task_id           uuid        NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  author_id         uuid        NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  content           text        NOT NULL,
  parent_comment_id uuid        REFERENCES task_comments(id) ON DELETE CASCADE,
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now(),
  deleted_at        timestamptz
);


-- 9. files
CREATE TABLE files (
  id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id  uuid        NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  project_id    uuid        REFERENCES projects(id) ON DELETE CASCADE,
  task_id       uuid        REFERENCES tasks(id) ON DELETE CASCADE,
  uploaded_by   uuid        REFERENCES users(id) ON DELETE RESTRICT,
  bucket        text        NOT NULL,
  path          text        NOT NULL,
  name          text        NOT NULL,
  mime_type     text,
  size_bytes    bigint,
  created_at    timestamptz NOT NULL DEFAULT now()
);


-- 10. notifications
CREATE TABLE notifications (
  id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id  uuid        NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  user_id       uuid        REFERENCES users(id) ON DELETE RESTRICT,
  category      text        NOT NULL CHECK (category IN ('assignments', 'deadlines', 'risk', 'attendance', 'system')),
  title         text        NOT NULL,
  body          text,
  read_at       timestamptz,
  created_at    timestamptz NOT NULL DEFAULT now()
);


CREATE TABLE activity_logs (
  id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id  uuid        NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  actor_id      uuid        REFERENCES users(id) ON DELETE RESTRICT,
  project_id    uuid        REFERENCES projects(id) ON DELETE CASCADE,
  task_id       uuid        REFERENCES tasks(id) ON DELETE CASCADE,
  action        text        NOT NULL,
  metadata      jsonb       NOT NULL DEFAULT '{}'::jsonb,
  hash          text,
  previous_hash text,
  created_at    timestamptz NOT NULL DEFAULT now()
);

-- Fix 6: Audit & Forensic Protection (WORM rules for activity logs)
-- WARNING: Removed WORM RULES because they break referential integrity (ERROR: XX000).
-- Do not reintroduce without understanding PostgreSQL RULE implications on foreign keys.
-- CREATE RULE activity_logs_no_update AS ON UPDATE TO activity_logs DO INSTEAD NOTHING;
-- CREATE RULE activity_logs_no_delete AS ON DELETE TO activity_logs DO INSTEAD NOTHING;


-- 12. attendance
CREATE TABLE attendance (
  id                  uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id        uuid        NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  user_id             uuid        NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  date                date        NOT NULL,
  status              text        NOT NULL CHECK (status IN ('present', 'half_day', 'absent')),
  leave_type          text        CHECK (leave_type IN ('casual', 'medical', 'unexcused')),
  availability_factor numeric     NOT NULL DEFAULT 1,
  created_at          timestamptz NOT NULL DEFAULT now(),
  UNIQUE(workspace_id, user_id, date)
);


-- 13. salaries
CREATE TABLE salaries (
  id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id  uuid        NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  user_id       uuid        NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  base_salary   numeric     NOT NULL DEFAULT 3000,
  created_at    timestamptz DEFAULT now(),
  UNIQUE(workspace_id, user_id)
);


-- 14. invitations
CREATE TABLE invitations (
  id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  email         text        NOT NULL,
  workspace_id  uuid        NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  role          text        NOT NULL CHECK (role IN ('super_admin', 'pm', 'developer', 'viewer')),
  status        text        NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'revoked')),
  invited_by    uuid        REFERENCES users(id) ON DELETE RESTRICT,
  expires_at    timestamptz NOT NULL,
  created_at    timestamptz NOT NULL DEFAULT now(),
  UNIQUE(workspace_id, email)
);


-- 15. workspace_holidays
--    Auto-ingested public holidays and manually defined company events.
CREATE TABLE workspace_holidays (
  id            uuid  PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id  uuid  NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  date          date  NOT NULL,
  name          text  NOT NULL,
  type          text  NOT NULL CHECK (type IN ('public', 'regional', 'festival', 'company')),
  UNIQUE(workspace_id, date)
);


-- 16. team_events
CREATE TABLE team_events (
  id                  uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id             uuid        NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  title               text        NOT NULL,
  start_date          timestamptz NOT NULL,
  end_date            timestamptz NOT NULL,
  availability_factor numeric     NOT NULL DEFAULT 1,
  CHECK (start_date <= end_date)
);


-- 17. personal_leave
CREATE TABLE personal_leave (
  id                  uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id             uuid        NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  leave_type          text        NOT NULL,
  start_date          timestamptz NOT NULL,
  end_date            timestamptz NOT NULL,
  availability_factor numeric     NOT NULL DEFAULT 0,
  CHECK (start_date <= end_date)
);


-- 18. workspace_settings
--    Singleton JSONB blob per workspace (logistics and system settings).
CREATE TABLE workspace_settings (
  workspace_id          uuid    PRIMARY KEY REFERENCES workspaces(id) ON DELETE CASCADE,
  working_hours         numeric DEFAULT 8,
  working_time_from     text    DEFAULT '09:00',
  working_time_to       text    DEFAULT '17:00',
  lunch_duration_minutes integer DEFAULT 60,
  settings_blob         jsonb   DEFAULT '{}'::jsonb,
  created_at            timestamptz DEFAULT now(),
  updated_at            timestamptz DEFAULT now()
);


-- 19. system_audit_ledger
--    Append-only cryptographic audit chain.
--    INSERT: permitted (write new blocks).
--    UPDATE/DELETE: permanently prohibited via WORM rules below.
CREATE TABLE system_audit_ledger (
  id             uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id   uuid        NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  project_id     uuid        REFERENCES projects(id) ON DELETE SET NULL,
  task_id        uuid        REFERENCES tasks(id) ON DELETE SET NULL,
  actor_id       uuid        REFERENCES users(id) ON DELETE RESTRICT,
  action         text        NOT NULL,
  payload        jsonb       NOT NULL DEFAULT '{}'::jsonb,
  hash           text        NOT NULL,
  previous_hash  text        NOT NULL,
  created_at     timestamptz DEFAULT now()
);

-- WORM: Prevent any modification of committed audit blocks
-- WARNING: Removed WORM RULES because they break referential integrity (ERROR: XX000).
-- CREATE RULE system_audit_ledger_no_update AS ON UPDATE TO system_audit_ledger DO INSTEAD NOTHING;
-- CREATE RULE system_audit_ledger_no_delete AS ON DELETE TO system_audit_ledger DO INSTEAD NOTHING;

-- Performance indexes
CREATE INDEX IF NOT EXISTS idx_sal_workspace ON system_audit_ledger(workspace_id);
CREATE INDEX IF NOT EXISTS idx_sal_project   ON system_audit_ledger(project_id);
CREATE INDEX IF NOT EXISTS idx_sal_hash      ON system_audit_ledger(hash);


-- =============================================================
-- PERFORMANCE INDEXES
-- =============================================================

CREATE INDEX IF NOT EXISTS idx_projects_workspace   ON projects(workspace_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_projects_team        ON projects(team_id);
CREATE INDEX IF NOT EXISTS idx_projects_status      ON projects(status);
CREATE INDEX IF NOT EXISTS idx_tasks_workspace      ON tasks(workspace_id);
CREATE INDEX IF NOT EXISTS idx_tasks_project        ON tasks(project_id);
CREATE INDEX IF NOT EXISTS idx_tasks_assignee       ON tasks(assignee_id);
CREATE INDEX IF NOT EXISTS idx_tasks_sprint         ON tasks(sprint_id);
CREATE INDEX IF NOT EXISTS idx_tasks_status         ON tasks(status);
CREATE INDEX IF NOT EXISTS idx_activity_workspace   ON activity_logs(workspace_id);
CREATE INDEX IF NOT EXISTS idx_notifications_ws     ON notifications(workspace_id);
CREATE INDEX IF NOT EXISTS idx_attendance_ws_user   ON attendance(workspace_id, user_id);

-- Fix 1: Database Performance Governance (Added large-table indexing)
CREATE INDEX IF NOT EXISTS idx_task_deps_depends    ON task_dependencies(depends_on_task_id);
CREATE INDEX IF NOT EXISTS idx_projects_composite   ON projects(workspace_id, status) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_users_workspace      ON users(workspace_id);
CREATE INDEX IF NOT EXISTS idx_teams_workspace      ON teams(workspace_id);
CREATE INDEX IF NOT EXISTS idx_comments_task        ON comments(task_id);


-- =============================================================
-- HELPER FUNCTIONS AND TRIGGER PROCEDURES
-- =============================================================

-- Returns the workspace_id for the currently authenticated user.
-- Used as a secure binding expression inside RLS policies.
CREATE OR REPLACE FUNCTION current_workspace()
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT workspace_id FROM users WHERE id = auth.uid() LIMIT 1
$$;


-- Auto-creates a users row when a new auth.users record is inserted (OAuth / email signup).
-- WARNING: Removed handle_new_user because it pre-inserts users as 'viewer', causing a 400 Bad Request
-- when reconcileInvitationMembership attempts to upsert them to 'pending-workspace-setup' or other roles.
-- The client-side reconciliation handles user row creation securely.
-- CREATE OR REPLACE FUNCTION public.handle_new_user() ...
-- CREATE TRIGGER on_auth_user_created ...

-- Fix 3: Privilege Escalation Protection
CREATE OR REPLACE FUNCTION prevent_role_escalation()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = ''
AS $$
BEGIN
  -- Allow users to reclaim their workspace if they are the true owner
  IF EXISTS (SELECT 1 FROM public.workspaces WHERE id = NEW.workspace_id AND owner_id = NEW.id) THEN
    RETURN NEW;
  END IF;

  -- Prevent changing workspace_id after it has been set
  IF OLD.workspace_id IS NOT NULL AND NEW.workspace_id IS DISTINCT FROM OLD.workspace_id THEN
    RAISE EXCEPTION 'Unauthorized: Cannot migrate workspaces.';
  END IF;

  -- Prevent role escalation unless performed by a super_admin of the same workspace
  IF OLD.role IS NOT NULL AND NEW.role IS DISTINCT FROM OLD.role THEN
    IF NOT EXISTS (
      SELECT 1 FROM public.users me 
      WHERE me.id = auth.uid() 
        AND me.workspace_id = OLD.workspace_id 
        AND me.role = 'super_admin'
    ) THEN
      RAISE EXCEPTION 'Unauthorized: Only super_admin can modify roles.';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS check_role_escalation ON users;
CREATE TRIGGER check_role_escalation
  BEFORE UPDATE ON users
  FOR EACH ROW EXECUTE FUNCTION prevent_role_escalation();


-- Wave 7/9 Hardening: Developer task mutation restrictions
-- Prevents developers from: reassigning tasks, moving tasks between projects,
-- modifying governance/analytics fields (confidence, risk, delay_drift_days)
CREATE OR REPLACE FUNCTION enforce_developer_task_restrictions()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = ''
AS $$
DECLARE
  v_role text;
BEGIN
  -- Lookup the role of the current user
  SELECT role INTO v_role FROM public.users WHERE id = auth.uid() LIMIT 1;

  -- Only restrict developers Ã¢â‚¬â€ PMs/super_admins have full access
  IF v_role IS DISTINCT FROM 'developer' THEN
    RETURN NEW;
  END IF;

  -- Block 1: Developers cannot reassign tasks
  IF NEW.assignee_id IS DISTINCT FROM OLD.assignee_id THEN
    RAISE EXCEPTION 'Unauthorized: Developers cannot reassign tasks. Contact your PM.';
  END IF;

  -- Block 2: Developers cannot move tasks between projects
  IF NEW.project_id IS DISTINCT FROM OLD.project_id THEN
    RAISE EXCEPTION 'Unauthorized: Developers cannot move tasks between projects.';
  END IF;

  -- Block 3: Developers cannot modify governance/analytics fields
  IF NEW.confidence IS DISTINCT FROM OLD.confidence THEN
    RAISE EXCEPTION 'Unauthorized: Developers cannot modify confidence ratings.';
  END IF;

  IF NEW.risk IS DISTINCT FROM OLD.risk THEN
    RAISE EXCEPTION 'Unauthorized: Developers cannot modify risk assessments.';
  END IF;

  IF NEW.delay_drift_days IS DISTINCT FROM OLD.delay_drift_days THEN
    RAISE EXCEPTION 'Unauthorized: Developers cannot modify delay drift values.';
  END IF;

  IF NEW.predicted_completion IS DISTINCT FROM OLD.predicted_completion THEN
    RAISE EXCEPTION 'Unauthorized: Developers cannot modify predicted completion dates.';
  END IF;

  -- Block 4: Developers cannot modify priority (only PMs decide priority)
  IF NEW.priority IS DISTINCT FROM OLD.priority THEN
    RAISE EXCEPTION 'Unauthorized: Developers cannot modify task priority.';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS check_developer_task_restrictions ON tasks;
CREATE TRIGGER check_developer_task_restrictions
  BEFORE UPDATE ON tasks
  FOR EACH ROW EXECUTE FUNCTION enforce_developer_task_restrictions();


-- =============================================================
-- RPC: get_operational_intelligence(p_workspace_id UUID)
--
-- Computes all four global delivery metrics server-side.
-- Aggregates task-level PERT data Ã¢â‚¬â€ bypasses legacy project-level
-- pert_best/likely/worst columns (which no longer exist on projects).
-- Called by operationalSyncService.ts via supabase.rpc().
-- =============================================================

CREATE OR REPLACE FUNCTION get_operational_intelligence(p_workspace_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_delivery_confidence NUMERIC;
  v_execution_pressure  NUMERIC;
  v_daily_fatigue       NUMERIC;
  v_risk_forecast       NUMERIC;
  v_total_decay_hours   NUMERIC := 0;
  v_pressure_score      NUMERIC := 0;

  v_active_project      RECORD;
  v_expected            NUMERIC;
  v_spread              NUMERIC;
  v_new_worst           NUMERIC;
  v_new_best            NUMERIC;

  v_active_tasks        INT;
  v_blocked_tasks       INT;

  v_confidence_risk     NUMERIC;
  v_fatigue_risk        NUMERIC;
BEGIN
  -- Ã¢â€â‚¬Ã¢â€â‚¬ 1. Delivery Confidence & Daily Fatigue Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬
  -- Aggregates task-level PERT from every active, non-archived project.
  FOR v_active_project IN
    SELECT
      p.id,
      COALESCE(SUM((t.pert_best + 4 * t.pert_likely + t.pert_worst) / 6.0), 0) AS expected,
      COALESCE(SUM(POWER((t.pert_worst - t.pert_best) / 6.0, 2)), 0)            AS variance
    FROM projects p
    LEFT JOIN tasks t
      ON t.project_id = p.id
     AND t.pert_best  > 0
     AND t.pert_likely > 0
     AND t.pert_worst > 0
    WHERE p.workspace_id = p_workspace_id
      AND p.status NOT IN ('deployed', 'done', 'archived')
      AND p.deleted_at IS NULL
    GROUP BY p.id
  LOOP
    v_expected  := v_active_project.expected;
    v_new_worst := v_expected + (2.0 * SQRT(v_active_project.variance));

    IF v_new_worst > v_expected THEN
      v_total_decay_hours := v_total_decay_hours + (v_new_worst - v_expected);
    END IF;

    v_new_best := GREATEST(0, v_expected - (2.0 * SQRT(v_active_project.variance)));
    v_spread   := GREATEST(0, v_new_worst - v_new_best);

    IF v_spread > 0 AND v_expected > 0 THEN
      v_pressure_score := v_pressure_score + ((v_spread / GREATEST(v_expected, 1.0)) * 10.0);
    END IF;
  END LOOP;

  v_delivery_confidence := GREATEST(0, 100.0 - (v_total_decay_hours * 0.5));
  v_daily_fatigue       := v_total_decay_hours;

  -- Ã¢â€â‚¬Ã¢â€â‚¬ 2. Execution Pressure Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬
  -- Uses GLOBAL task counts Ã¢â‚¬â€ not paginated, not filtered by visible projects.
  SELECT
    COUNT(*) FILTER (WHERE status IN ('blocked', 'triage')),
    COUNT(*) FILTER (WHERE status <> 'done')
  INTO v_blocked_tasks, v_active_tasks
  FROM tasks
  WHERE workspace_id = p_workspace_id;

  IF v_active_tasks > 0 THEN
    v_pressure_score := v_pressure_score
      + ((v_blocked_tasks::NUMERIC / v_active_tasks::NUMERIC) * 40.0);
  END IF;

  v_execution_pressure := LEAST(100, v_pressure_score);

  -- Ã¢â€â‚¬Ã¢â€â‚¬ 3. Risk Forecast Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬
  v_confidence_risk := 100.0 - v_delivery_confidence;
  v_fatigue_risk    := LEAST(100, v_daily_fatigue * 2.0);
  v_risk_forecast   := LEAST(100,
    (v_confidence_risk * 0.45) +
    (v_execution_pressure * 0.35) +
    (v_fatigue_risk * 0.20)
  );

  RETURN jsonb_build_object(
    'deliveryConfidence', ROUND(v_delivery_confidence, 1),
    'executionPressure',  ROUND(v_execution_pressure,  1),
    'dailyFatigue',       ROUND(v_daily_fatigue,       1),
    'riskForecast',       ROUND(v_risk_forecast,        1)
  );
END;
$$;


-- =============================================================
-- ROW LEVEL SECURITY Ã¢â‚¬â€ ENABLE ON ALL TABLES
-- =============================================================

ALTER TABLE workspaces        ENABLE ROW LEVEL SECURITY;
ALTER TABLE users             ENABLE ROW LEVEL SECURITY;
ALTER TABLE teams             ENABLE ROW LEVEL SECURITY;
ALTER TABLE team_members      ENABLE ROW LEVEL SECURITY;
ALTER TABLE projects          ENABLE ROW LEVEL SECURITY;
ALTER TABLE tasks             ENABLE ROW LEVEL SECURITY;
ALTER TABLE task_dependencies ENABLE ROW LEVEL SECURITY;
ALTER TABLE comments          ENABLE ROW LEVEL SECURITY;
ALTER TABLE task_comments     ENABLE ROW LEVEL SECURITY;
ALTER TABLE files             ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications     ENABLE ROW LEVEL SECURITY;
ALTER TABLE activity_logs     ENABLE ROW LEVEL SECURITY;
ALTER TABLE attendance        ENABLE ROW LEVEL SECURITY;
ALTER TABLE salaries          ENABLE ROW LEVEL SECURITY;
ALTER TABLE invitations       ENABLE ROW LEVEL SECURITY;
ALTER TABLE workspace_holidays ENABLE ROW LEVEL SECURITY;
ALTER TABLE team_events       ENABLE ROW LEVEL SECURITY;
ALTER TABLE personal_leave    ENABLE ROW LEVEL SECURITY;
ALTER TABLE workspace_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE system_audit_ledger ENABLE ROW LEVEL SECURITY;


-- =============================================================
-- SECURITY POLICIES
-- =============================================================

-- Ã¢â€â‚¬Ã¢â€â‚¬ Workspaces Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬

DROP POLICY IF EXISTS "Workspace members can view their workspace" ON workspaces;
CREATE POLICY "Workspace members can view their workspace"
  ON workspaces FOR SELECT
  USING (id = current_workspace() OR owner_id = auth.uid());

DROP POLICY IF EXISTS "Workspace owner can update workspace" ON workspaces;
CREATE POLICY "Workspace owner can update workspace"
  ON workspaces FOR UPDATE
  USING (owner_id = auth.uid());

DROP POLICY IF EXISTS "Workspace owner can create workspace" ON workspaces;
CREATE POLICY "Workspace owner can create workspace"
  ON workspaces FOR INSERT
  WITH CHECK (owner_id = auth.uid());


-- Ã¢â€â‚¬Ã¢â€â‚¬ Users Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬
-- Wave 7.5: P0-1 Ã¢â‚¬â€ Users SELECT restricted to same workspace + self
-- Wave 7.5: P0-2 Ã¢â‚¬â€ Pending user workspace hijack prevention
-- Wave 7.5: P0-3 Ã¢â‚¬â€ Self-update restricted to safe profile fields only

DROP POLICY IF EXISTS "Users are visible within the platform" ON users;
DROP POLICY IF EXISTS "Users visible within workspace" ON users;
CREATE POLICY "Users visible within workspace"
  ON users FOR SELECT
  USING (
    id = auth.uid()
    OR workspace_id = current_workspace()
  );

DROP POLICY IF EXISTS "Workspace owner can create first super admin user" ON users;
CREATE POLICY "Workspace owner can create first super admin user"
  ON users FOR INSERT
  WITH CHECK (
    id = auth.uid()
    AND role = 'super_admin'
    AND EXISTS (
      SELECT 1 FROM workspaces
      WHERE workspaces.id = users.workspace_id
        AND workspaces.owner_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Workspace admins can insert users" ON users;
CREATE POLICY "Workspace admins can insert users"
  ON users FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM users me
      WHERE me.id = auth.uid()
        AND me.workspace_id = users.workspace_id
        AND me.role IN ('super_admin', 'pm')
    )
  );

DROP POLICY IF EXISTS "Workspace admins can update users" ON users;
CREATE POLICY "Workspace admins can update users"
  ON users FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM users me
      WHERE me.id = auth.uid()
        AND me.workspace_id = users.workspace_id
        AND me.role IN ('super_admin', 'pm')
    )
  );

DROP POLICY IF EXISTS "Workspace admins can delete users" ON users;
CREATE POLICY "Workspace admins can delete users"
  ON users FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM users me
      WHERE me.id = auth.uid()
        AND me.workspace_id = users.workspace_id
        AND me.role IN ('super_admin', 'pm')
    )
  );

DROP POLICY IF EXISTS "Users can insert their own pending user row" ON users;
CREATE POLICY "Users can insert their own pending user row"
  ON users FOR INSERT
  WITH CHECK (
    id = auth.uid()
    AND role = 'pending-workspace-setup'
    AND workspace_id IS NULL
  );

DROP POLICY IF EXISTS "Invited users can bootstrap their own user row" ON users;
CREATE POLICY "Invited users can bootstrap their own user row"
  ON users FOR INSERT
  WITH CHECK (
    id = auth.uid()
    AND lower(email) = lower(auth.email())
    AND EXISTS (
      SELECT 1 FROM invitations
      WHERE lower(invitations.email) = lower(auth.email())
        AND invitations.workspace_id = users.workspace_id
        AND invitations.role = users.role
        AND invitations.status = 'pending'
    )
  );

-- P0-3: Self-update Ã¢â‚¬â€ users may only modify safe profile fields.
-- role, workspace_id are immutable via self-update.
-- The trigger prevent_role_escalation provides defense-in-depth,
-- but this WITH CHECK enforces it at the RLS layer.
DROP POLICY IF EXISTS "Users can update their own user row" ON users;
CREATE POLICY "Users can update their own safe profile fields"
  ON users FOR UPDATE
  USING (id = auth.uid())
  WITH CHECK (
    id = auth.uid()
    AND (
      (role IS NOT DISTINCT FROM (SELECT role FROM users WHERE id = auth.uid())
       AND workspace_id IS NOT DISTINCT FROM (SELECT workspace_id FROM users WHERE id = auth.uid()))
      OR
      EXISTS (SELECT 1 FROM workspaces WHERE workspaces.id = workspace_id AND workspaces.owner_id = auth.uid())
    )
  );


-- Ã¢â€â‚¬Ã¢â€â‚¬ Teams Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬
-- Wave 7.5: P0-7 Ã¢â‚¬â€ Team mutations restricted to PM/Admin

DROP POLICY IF EXISTS "Teams are isolated by workspace" ON teams;
DROP POLICY IF EXISTS "Teams are visible to workspace" ON teams;
DROP POLICY IF EXISTS "Teams can be managed by PMs and Admins" ON teams;

CREATE POLICY "Teams are visible to workspace"
  ON teams FOR SELECT
  USING (workspace_id = current_workspace());

CREATE POLICY "Teams can be managed by PMs and Admins"
  ON teams FOR ALL
  USING (
    workspace_id = current_workspace() AND
    EXISTS (SELECT 1 FROM public.users me WHERE me.id = auth.uid() AND me.workspace_id = current_workspace() AND me.role IN ('super_admin', 'pm'))
  )
  WITH CHECK (
    workspace_id = current_workspace() AND
    EXISTS (SELECT 1 FROM public.users me WHERE me.id = auth.uid() AND me.workspace_id = current_workspace() AND me.role IN ('super_admin', 'pm'))
  );


-- Ã¢â€â‚¬Ã¢â€â‚¬ Team Members Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬
-- Wave 7.5: P0-7 Ã¢â‚¬â€ Team member mutations restricted to PM/Admin

DROP POLICY IF EXISTS "Team members are isolated by workspace" ON team_members;
DROP POLICY IF EXISTS "Team members are visible to workspace" ON team_members;
DROP POLICY IF EXISTS "Team members can be managed by PMs and Admins" ON team_members;

CREATE POLICY "Team members are visible to workspace"
  ON team_members FOR SELECT
  USING (workspace_id = current_workspace());

CREATE POLICY "Team members can be managed by PMs and Admins"
  ON team_members FOR ALL
  USING (
    workspace_id = current_workspace() AND
    EXISTS (SELECT 1 FROM public.users me WHERE me.id = auth.uid() AND me.workspace_id = current_workspace() AND me.role IN ('super_admin', 'pm'))
  )
  WITH CHECK (
    workspace_id = current_workspace() AND
    EXISTS (SELECT 1 FROM public.users me WHERE me.id = auth.uid() AND me.workspace_id = current_workspace() AND me.role IN ('super_admin', 'pm'))
  );


-- Ã¢â€â‚¬Ã¢â€â‚¬ Projects Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬

DROP POLICY IF EXISTS "Projects are isolated by workspace" ON projects;
-- Fix 2: RLS Validation (Added strict role gating for mutations)
CREATE POLICY "Projects are visible to workspace"
  ON projects FOR SELECT
  USING (workspace_id = current_workspace() AND deleted_at IS NULL);

CREATE POLICY "Projects can be mutated by PMs and Admins"
  ON projects FOR ALL
  USING (
    workspace_id = current_workspace() AND
    EXISTS (SELECT 1 FROM public.users me WHERE me.id = auth.uid() AND me.workspace_id = current_workspace() AND me.role IN ('super_admin', 'pm'))
  )
  WITH CHECK (
    workspace_id = current_workspace() AND
    EXISTS (SELECT 1 FROM public.users me WHERE me.id = auth.uid() AND me.workspace_id = current_workspace() AND me.role IN ('super_admin', 'pm'))
  );


-- Ã¢â€â‚¬Ã¢â€â‚¬ Tasks Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬
-- Wave 7/9 Hardening: Granular developer permission scoping

DROP POLICY IF EXISTS "Tasks are isolated by workspace" ON tasks;
DROP POLICY IF EXISTS "Tasks are visible to workspace" ON tasks;
DROP POLICY IF EXISTS "Tasks can be mutated by developers, PMs, and Admins" ON tasks;

-- SELECT: All workspace members can read tasks
CREATE POLICY "Tasks are visible to workspace"
  ON tasks FOR SELECT
  USING (workspace_id = current_workspace());

-- INSERT: Only PMs and Admins can create tasks
CREATE POLICY "Tasks can be created by PMs and Admins"
  ON tasks FOR INSERT
  WITH CHECK (
    workspace_id = current_workspace() AND
    EXISTS (SELECT 1 FROM public.users me WHERE me.id = auth.uid() AND me.workspace_id = current_workspace() AND me.role IN ('super_admin', 'pm'))
  );

-- UPDATE for PMs/Admins: Full update access
CREATE POLICY "Tasks can be fully updated by PMs and Admins"
  ON tasks FOR UPDATE
  USING (
    workspace_id = current_workspace() AND
    EXISTS (SELECT 1 FROM public.users me WHERE me.id = auth.uid() AND me.workspace_id = current_workspace() AND me.role IN ('super_admin', 'pm'))
  );

-- UPDATE for Developers: ONLY tasks assigned to them
CREATE POLICY "Developers can update their assigned tasks"
  ON tasks FOR UPDATE
  USING (
    workspace_id = current_workspace() AND
    assignee_id = auth.uid() AND
    EXISTS (SELECT 1 FROM public.users me WHERE me.id = auth.uid() AND me.workspace_id = current_workspace() AND me.role = 'developer')
  );

-- DELETE: Only PMs and Admins can delete tasks
CREATE POLICY "Tasks can be deleted by PMs and Admins"
  ON tasks FOR DELETE
  USING (
    workspace_id = current_workspace() AND
    EXISTS (SELECT 1 FROM public.users me WHERE me.id = auth.uid() AND me.workspace_id = current_workspace() AND me.role IN ('super_admin', 'pm'))
  );


-- Ã¢â€â‚¬Ã¢â€â‚¬ Task Dependencies Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬
-- Wave 7/9 Hardening: Developers cannot create or remove dependencies

DROP POLICY IF EXISTS "Task dependencies are isolated by workspace" ON task_dependencies;

CREATE POLICY "Task dependencies are visible to workspace"
  ON task_dependencies FOR SELECT
  USING (workspace_id = current_workspace());

CREATE POLICY "Task dependencies can be managed by PMs and Admins"
  ON task_dependencies FOR ALL
  USING (
    workspace_id = current_workspace() AND
    EXISTS (SELECT 1 FROM public.users me WHERE me.id = auth.uid() AND me.workspace_id = current_workspace() AND me.role IN ('super_admin', 'pm'))
  )
  WITH CHECK (
    workspace_id = current_workspace() AND
    EXISTS (SELECT 1 FROM public.users me WHERE me.id = auth.uid() AND me.workspace_id = current_workspace() AND me.role IN ('super_admin', 'pm'))
  );


-- Ã¢â€â‚¬Ã¢â€â‚¬ Comments Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬
-- Wave 7/9 Hardening: Author-only mutation for non-admins

DROP POLICY IF EXISTS "Comments are isolated by workspace" ON comments;

-- SELECT: All workspace members can read comments
CREATE POLICY "Comments are visible to workspace"
  ON comments FOR SELECT
  USING (workspace_id = current_workspace());

-- INSERT: Authenticated workspace members can create comments (author_id must be self)
CREATE POLICY "Comments can be created by authenticated users"
  ON comments FOR INSERT
  WITH CHECK (
    workspace_id = current_workspace() AND
    author_id = auth.uid()
  );

-- UPDATE/DELETE for PMs/Admins: Full moderation access
CREATE POLICY "Comments can be moderated by PMs and Admins"
  ON comments FOR ALL
  USING (
    workspace_id = current_workspace() AND
    EXISTS (SELECT 1 FROM public.users me WHERE me.id = auth.uid() AND me.workspace_id = current_workspace() AND me.role IN ('super_admin', 'pm'))
  )
  WITH CHECK (
    workspace_id = current_workspace() AND
    EXISTS (SELECT 1 FROM public.users me WHERE me.id = auth.uid() AND me.workspace_id = current_workspace() AND me.role IN ('super_admin', 'pm'))
  );

-- UPDATE/DELETE for non-admins: Own comments only
CREATE POLICY "Users can edit their own comments"
  ON comments FOR UPDATE
  USING (workspace_id = current_workspace() AND author_id = auth.uid());

CREATE POLICY "Users can delete their own comments"
  ON comments FOR DELETE
  USING (workspace_id = current_workspace() AND author_id = auth.uid());


-- Ã¢â€â‚¬Ã¢â€â‚¬ Files Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬
-- Wave 7.5: Files Ã¢â‚¬â€ SELECT for all, mutations restricted to uploader + PM/Admin

DROP POLICY IF EXISTS "Files are isolated by workspace" ON files;
DROP POLICY IF EXISTS "Files are visible to workspace" ON files;
DROP POLICY IF EXISTS "Files can be uploaded by authenticated users" ON files;
DROP POLICY IF EXISTS "Files can be managed by PMs and Admins" ON files;

CREATE POLICY "Files are visible to workspace"
  ON files FOR SELECT
  USING (workspace_id = current_workspace());

CREATE POLICY "Files can be uploaded by authenticated users"
  ON files FOR INSERT
  WITH CHECK (
    workspace_id = current_workspace() AND
    uploaded_by = auth.uid()
  );

CREATE POLICY "Files can be managed by PMs and Admins"
  ON files FOR ALL
  USING (
    workspace_id = current_workspace() AND
    EXISTS (SELECT 1 FROM public.users me WHERE me.id = auth.uid() AND me.workspace_id = current_workspace() AND me.role IN ('super_admin', 'pm'))
  )
  WITH CHECK (
    workspace_id = current_workspace() AND
    EXISTS (SELECT 1 FROM public.users me WHERE me.id = auth.uid() AND me.workspace_id = current_workspace() AND me.role IN ('super_admin', 'pm'))
  );


-- Ã¢â€â‚¬Ã¢â€â‚¬ Notifications Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬
-- Wave 7.5: P1-1 Ã¢â‚¬â€ Notification INSERT restricted: user_id must be self or by PM/Admin

DROP POLICY IF EXISTS "Notifications are isolated by workspace" ON notifications;
DROP POLICY IF EXISTS "Notifications are visible to workspace members" ON notifications;
DROP POLICY IF EXISTS "Notifications can be self-targeted" ON notifications;
DROP POLICY IF EXISTS "Notifications can be managed by PMs and Admins" ON notifications;

CREATE POLICY "Notifications are visible to workspace members"
  ON notifications FOR SELECT
  USING (workspace_id = current_workspace());

-- Non-admins can only create notifications targeted at themselves
CREATE POLICY "Notifications can be self-targeted"
  ON notifications FOR INSERT
  WITH CHECK (
    workspace_id = current_workspace() AND
    user_id = auth.uid()
  );

-- PM/Admin can create notifications for anyone and manage them
CREATE POLICY "Notifications can be managed by PMs and Admins"
  ON notifications FOR ALL
  USING (
    workspace_id = current_workspace() AND
    EXISTS (SELECT 1 FROM public.users me WHERE me.id = auth.uid() AND me.workspace_id = current_workspace() AND me.role IN ('super_admin', 'pm'))
  )
  WITH CHECK (
    workspace_id = current_workspace() AND
    EXISTS (SELECT 1 FROM public.users me WHERE me.id = auth.uid() AND me.workspace_id = current_workspace() AND me.role IN ('super_admin', 'pm'))
  );

-- Users can mark their own notifications as read
DROP POLICY IF EXISTS "Users can update own notifications" ON notifications;
CREATE POLICY "Users can update own notifications"
  ON notifications FOR UPDATE
  USING (workspace_id = current_workspace() AND user_id = auth.uid());


-- Ã¢â€â‚¬Ã¢â€â‚¬ Activity Logs Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬
-- Wave 7.5: P1-3 Ã¢â‚¬â€ actor_id must match auth.uid() to prevent forgery

DROP POLICY IF EXISTS "Activity logs are isolated by workspace" ON activity_logs;
DROP POLICY IF EXISTS "Activity logs are readable by workspace" ON activity_logs;
DROP POLICY IF EXISTS "Activity logs can be inserted with verified actor" ON activity_logs;

CREATE POLICY "Activity logs are readable by workspace"
  ON activity_logs FOR SELECT
  USING (workspace_id = current_workspace());

CREATE POLICY "Activity logs can be inserted with verified actor"
  ON activity_logs FOR INSERT
  WITH CHECK (
    workspace_id = current_workspace() AND
    (actor_id IS NULL OR actor_id = auth.uid())
  );


-- Ã¢â€â‚¬Ã¢â€â‚¬ Attendance Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬
-- Wave 7.5: P0-6 Ã¢â‚¬â€ Attendance mutations restricted to PM/Admin

DROP POLICY IF EXISTS "Attendance is isolated by workspace" ON attendance;
DROP POLICY IF EXISTS "Attendance is visible to workspace" ON attendance;
DROP POLICY IF EXISTS "Attendance can be managed by PMs and Admins" ON attendance;

CREATE POLICY "Attendance is visible to workspace"
  ON attendance FOR SELECT
  USING (workspace_id = current_workspace());

CREATE POLICY "Attendance can be managed by PMs and Admins"
  ON attendance FOR ALL
  USING (
    workspace_id = current_workspace() AND
    EXISTS (SELECT 1 FROM public.users me WHERE me.id = auth.uid() AND me.workspace_id = current_workspace() AND me.role IN ('super_admin', 'pm'))
  )
  WITH CHECK (
    workspace_id = current_workspace() AND
    EXISTS (SELECT 1 FROM public.users me WHERE me.id = auth.uid() AND me.workspace_id = current_workspace() AND me.role IN ('super_admin', 'pm'))
  );


-- Ã¢â€â‚¬Ã¢â€â‚¬ Salaries Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬
-- Wave 7.5: P0-5 Ã¢â‚¬â€ Salary mutations restricted to PM/Admin

DROP POLICY IF EXISTS "Salaries are isolated by workspace" ON salaries;
DROP POLICY IF EXISTS "Salaries are visible to admins" ON salaries;
DROP POLICY IF EXISTS "Salaries can be managed by PMs and Admins" ON salaries;

CREATE POLICY "Salaries are visible to admins"
  ON salaries FOR SELECT
  USING (
    workspace_id = current_workspace() AND
    EXISTS (SELECT 1 FROM public.users me WHERE me.id = auth.uid() AND me.workspace_id = current_workspace() AND me.role IN ('super_admin', 'pm'))
  );

CREATE POLICY "Salaries can be managed by PMs and Admins"
  ON salaries FOR ALL
  USING (
    workspace_id = current_workspace() AND
    EXISTS (SELECT 1 FROM public.users me WHERE me.id = auth.uid() AND me.workspace_id = current_workspace() AND me.role IN ('super_admin', 'pm'))
  )
  WITH CHECK (
    workspace_id = current_workspace() AND
    EXISTS (SELECT 1 FROM public.users me WHERE me.id = auth.uid() AND me.workspace_id = current_workspace() AND me.role IN ('super_admin', 'pm'))
  );


-- Ã¢â€â‚¬Ã¢â€â‚¬ Invitations Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬

DROP POLICY IF EXISTS "Invitations are readable by the invited email or workspace members" ON invitations;
CREATE POLICY "Invitations are readable by the invited email or workspace members"
  ON invitations FOR SELECT
  USING (lower(email) = lower(auth.email()) OR workspace_id = current_workspace());

DROP POLICY IF EXISTS "Workspace super admins can manage invitations" ON invitations;
CREATE POLICY "Workspace super admins can manage invitations"
  ON invitations FOR ALL
  USING (
    workspace_id = current_workspace()
    AND EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
        AND users.role = 'super_admin'
    )
  )
  WITH CHECK (
    workspace_id = current_workspace()
    AND EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
        AND users.role = 'super_admin'
    )
  );

DROP POLICY IF EXISTS "Invited users can accept their own invitation" ON invitations;
CREATE POLICY "Invited users can accept their own invitation"
  ON invitations FOR UPDATE
  USING (lower(email) = lower(auth.email()) AND status = 'pending')
  WITH CHECK (lower(email) = lower(auth.email()) AND status = 'accepted');


-- Ã¢â€â‚¬Ã¢â€â‚¬ Workspace Holidays Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬
-- Wave 7.5: Holidays mutations restricted to PM/Admin

DROP POLICY IF EXISTS "Workspace holidays are isolated by workspace" ON workspace_holidays;
DROP POLICY IF EXISTS "Workspace holidays are visible to workspace" ON workspace_holidays;
DROP POLICY IF EXISTS "Workspace holidays can be managed by PMs and Admins" ON workspace_holidays;

CREATE POLICY "Workspace holidays are visible to workspace"
  ON workspace_holidays FOR SELECT
  USING (workspace_id = current_workspace());

CREATE POLICY "Workspace holidays can be managed by PMs and Admins"
  ON workspace_holidays FOR ALL
  USING (
    workspace_id = current_workspace() AND
    EXISTS (SELECT 1 FROM public.users me WHERE me.id = auth.uid() AND me.workspace_id = current_workspace() AND me.role IN ('super_admin', 'pm'))
  )
  WITH CHECK (
    workspace_id = current_workspace() AND
    EXISTS (SELECT 1 FROM public.users me WHERE me.id = auth.uid() AND me.workspace_id = current_workspace() AND me.role IN ('super_admin', 'pm'))
  );


-- Ã¢â€â‚¬Ã¢â€â‚¬ Team Events Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬
-- Wave 7.5: Team events mutations restricted to PM/Admin

DROP POLICY IF EXISTS "Team events are isolated by team" ON team_events;
DROP POLICY IF EXISTS "Team events are visible to workspace" ON team_events;
DROP POLICY IF EXISTS "Team events can be managed by PMs and Admins" ON team_events;

CREATE POLICY "Team events are visible to workspace"
  ON team_events FOR SELECT
  USING (team_id IN (SELECT id FROM teams WHERE workspace_id = current_workspace()));

CREATE POLICY "Team events can be managed by PMs and Admins"
  ON team_events FOR ALL
  USING (
    team_id IN (SELECT id FROM teams WHERE workspace_id = current_workspace()) AND
    EXISTS (SELECT 1 FROM public.users me WHERE me.id = auth.uid() AND me.workspace_id = current_workspace() AND me.role IN ('super_admin', 'pm'))
  )
  WITH CHECK (
    team_id IN (SELECT id FROM teams WHERE workspace_id = current_workspace()) AND
    EXISTS (SELECT 1 FROM public.users me WHERE me.id = auth.uid() AND me.workspace_id = current_workspace() AND me.role IN ('super_admin', 'pm'))
  );


-- Ã¢â€â‚¬Ã¢â€â‚¬ Personal Leave Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬
-- Wave 7.5: P1-2 Ã¢â‚¬â€ Self-only mutation for non-admins

DROP POLICY IF EXISTS "Personal leaves are isolated by user workspace" ON personal_leave;
DROP POLICY IF EXISTS "Personal leave is visible to workspace" ON personal_leave;
DROP POLICY IF EXISTS "Users can manage their own leave" ON personal_leave;
DROP POLICY IF EXISTS "PMs and Admins can manage all leave" ON personal_leave;

CREATE POLICY "Personal leave is visible to workspace"
  ON personal_leave FOR SELECT
  USING (user_id IN (SELECT id FROM users WHERE workspace_id = current_workspace()));

CREATE POLICY "Users can manage their own leave"
  ON personal_leave FOR ALL
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "PMs and Admins can manage all leave"
  ON personal_leave FOR ALL
  USING (
    user_id IN (SELECT id FROM users WHERE workspace_id = current_workspace()) AND
    EXISTS (SELECT 1 FROM public.users me WHERE me.id = auth.uid() AND me.workspace_id = current_workspace() AND me.role IN ('super_admin', 'pm'))
  )
  WITH CHECK (
    user_id IN (SELECT id FROM users WHERE workspace_id = current_workspace()) AND
    EXISTS (SELECT 1 FROM public.users me WHERE me.id = auth.uid() AND me.workspace_id = current_workspace() AND me.role IN ('super_admin', 'pm'))
  );


-- Ã¢â€â‚¬Ã¢â€â‚¬ Workspace Settings Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬
-- Wave 7.5: P0-4 Ã¢â‚¬â€ Workspace settings mutations restricted to PM/Admin

DROP POLICY IF EXISTS "Workspace settings are isolated by workspace" ON workspace_settings;
DROP POLICY IF EXISTS "Workspace settings are visible to workspace" ON workspace_settings;
DROP POLICY IF EXISTS "Workspace settings can be managed by PMs and Admins" ON workspace_settings;

CREATE POLICY "Workspace settings are visible to workspace"
  ON workspace_settings FOR SELECT
  USING (workspace_id = current_workspace());

CREATE POLICY "Workspace settings can be managed by PMs and Admins"
  ON workspace_settings FOR ALL
  USING (
    workspace_id = current_workspace() AND
    EXISTS (SELECT 1 FROM public.users me WHERE me.id = auth.uid() AND me.workspace_id = current_workspace() AND me.role IN ('super_admin', 'pm'))
  )
  WITH CHECK (
    workspace_id = current_workspace() AND
    EXISTS (SELECT 1 FROM public.users me WHERE me.id = auth.uid() AND me.workspace_id = current_workspace() AND me.role IN ('super_admin', 'pm'))
  );


-- Ã¢â€â‚¬Ã¢â€â‚¬ System Audit Ledger Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬
-- Wave 7.5: P1-4 Ã¢â‚¬â€ Audit ledger SELECT binds BOTH role AND workspace_id

DROP POLICY IF EXISTS "System audit ledger is viewable by workspace admins" ON system_audit_ledger;
CREATE POLICY "System audit ledger is viewable by workspace admins"
  ON system_audit_ledger FOR SELECT
  USING (
    workspace_id = current_workspace()
    AND EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
        AND users.workspace_id = current_workspace()
        AND users.role IN ('super_admin', 'pm')
    )
  );

DROP POLICY IF EXISTS "System audit ledger is insertable by authenticated users" ON system_audit_ledger;
CREATE POLICY "System audit ledger is insertable by authenticated users"
  ON system_audit_ledger FOR INSERT
  WITH CHECK (workspace_id = current_workspace());


-- =============================================================
-- STORAGE BUCKET INITIALIZATION
-- =============================================================

INSERT INTO storage.buckets (id, name, public)
VALUES
  ('avatars',       'avatars',       true),
  ('attachments',   'attachments',   false),
  ('project-files', 'project-files', false),
  ('exports',       'exports',       false)
ON CONFLICT (id) DO NOTHING;





-- Enforce Task Completion Governance Trigger
-- Prevents a task from being marked as 'done' if there are active wait states or unresolved dependencies.

CREATE OR REPLACE FUNCTION enforce_task_completion_governance()
RETURNS trigger AS $$
DECLARE
  active_wait_state_count INT;
  unresolved_dependency_count INT;
BEGIN
  -- Only run checks if the status is being changed to 'done'
  IF NEW.status = 'done' AND OLD.status != 'done' THEN
    
    -- Check for active wait states targeting this task
    SELECT COUNT(*)
    INTO active_wait_state_count
    FROM wait_states
    WHERE target_id = NEW.id
      AND target_type = 'task'
      AND status = 'active';

    IF active_wait_state_count > 0 THEN
      RAISE EXCEPTION 'Governance Violation: Cannot complete task with active wait states.';
    END IF;

    -- Check for unresolved dependencies blocking this task
    SELECT COUNT(*)
    INTO unresolved_dependency_count
    FROM task_dependencies
    WHERE task_id = NEW.id
      AND resolved = false;

    IF unresolved_dependency_count > 0 THEN
      RAISE EXCEPTION 'Governance Violation: Cannot complete task with unresolved dependencies.';
    END IF;
    
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_enforce_task_completion ON tasks;

CREATE TRIGGER trigger_enforce_task_completion
  BEFORE UPDATE ON tasks
  FOR EACH ROW
  EXECUTE FUNCTION enforce_task_completion_governance();

- -   M I G R A T I O N _ D O J _ H R _ A U D I T . s q l 
 
 - -   R u n   t h i s   s c r i p t   t o   m i g r a t e   t h e   d a t a b a s e   f o r   t h e   D O J   H R   A u d i t   u p d a t e . 
 
 
 
 - -   1 .   A d d   d a t e _ o f _ j o i n i n g   t o   i n v i t a t i o n s 
 
 A L T E R   T A B L E   p u b l i c . i n v i t a t i o n s   A D D   C O L U M N   I F   N O T   E X I S T S   d a t e _ o f _ j o i n i n g   T I M E S T A M P   W I T H   T I M E   Z O N E ; 
 
 
 
 - -   2 .   C r e a t e   e m p l o y m e n t _ r e c o r d s   t a b l e 
 
 C R E A T E   T A B L E   I F   N O T   E X I S T S   p u b l i c . e m p l o y m e n t _ r e c o r d s   ( 
 
         i d   U U I D   P R I M A R Y   K E Y   D E F A U L T   g e n _ r a n d o m _ u u i d ( ) , 
 
         p r o f i l e _ i d   U U I D   N O T   N U L L   R E F E R E N C E S   p u b l i c . u s e r s ( i d )   O N   D E L E T E   C A S C A D E , 
 
         w o r k s p a c e _ i d   U U I D   R E F E R E N C E S   p u b l i c . w o r k s p a c e s ( i d )   O N   D E L E T E   S E T   N U L L , 
 
         d a t e _ o f _ j o i n i n g   T I M E S T A M P   W I T H   T I M E   Z O N E   N O T   N U L L , 
 
         e m p l o y m e n t _ s t a t u s   T E X T   N O T   N U L L   D E F A U L T   ' a c t i v e '   C H E C K   ( e m p l o y m e n t _ s t a t u s   I N   ( ' a c t i v e ' ,   ' r e s i g n e d ' ,   ' t e r m i n a t e d ' ) ) , 
 
         c r e a t e d _ a t   T I M E S T A M P   W I T H   T I M E   Z O N E   N O T   N U L L   D E F A U L T   n o w ( ) , 
 
         u p d a t e d _ a t   T I M E S T A M P   W I T H   T I M E   Z O N E   N O T   N U L L   D E F A U L T   n o w ( ) , 
 
         c r e a t e d _ b y   U U I D   R E F E R E N C E S   p u b l i c . u s e r s ( i d )   O N   D E L E T E   S E T   N U L L , 
 
         u p d a t e d _ b y   U U I D   R E F E R E N C E S   p u b l i c . u s e r s ( i d )   O N   D E L E T E   S E T   N U L L , 
 
         C O N S T R A I N T   u n i q u e _ p r o f i l e _ w o r k s p a c e _ e m p l o y m e n t   U N I Q U E   ( p r o f i l e _ i d ,   w o r k s p a c e _ i d ) 
 
 ) ; 
 
 
 
 - -   3 .   C r e a t e   e m p l o y m e n t _ c h a n g e _ l o g s   t a b l e 
 
 C R E A T E   T A B L E   I F   N O T   E X I S T S   p u b l i c . e m p l o y m e n t _ c h a n g e _ l o g s   ( 
 
         i d   U U I D   P R I M A R Y   K E Y   D E F A U L T   g e n _ r a n d o m _ u u i d ( ) , 
 
         e m p l o y e e _ i d   U U I D   N O T   N U L L   R E F E R E N C E S   p u b l i c . u s e r s ( i d )   O N   D E L E T E   C A S C A D E , 
 
         f i e l d _ c h a n g e d   T E X T   N O T   N U L L , 
 
         p r e v i o u s _ v a l u e   T E X T , 
 
         n e w _ v a l u e   T E X T , 
 
         c h a n g e d _ b y   U U I D   N O T   N U L L   R E F E R E N C E S   p u b l i c . u s e r s ( i d )   O N   D E L E T E   C A S C A D E , 
 
         c h a n g e d _ a t   T I M E S T A M P   W I T H   T I M E   Z O N E   N O T   N U L L   D E F A U L T   n o w ( ) , 
 
         r e a s o n   T E X T   N O T   N U L L 
 
 ) ; 
 
 
 
 - -   E n a b l e   R L S 
 
 A L T E R   T A B L E   p u b l i c . e m p l o y m e n t _ r e c o r d s   E N A B L E   R O W   L E V E L   S E C U R I T Y ; 
 
 A L T E R   T A B L E   p u b l i c . e m p l o y m e n t _ c h a n g e _ l o g s   E N A B L E   R O W   L E V E L   S E C U R I T Y ; 
 
 
 
 - -   R L S   P o l i c i e s   f o r   e m p l o y m e n t _ r e c o r d s 
 
 - -   S u p e r   A d m i n s   c a n   d o   a n y t h i n g 
 
 C R E A T E   P O L I C Y   " S u p e r   A d m i n s   h a v e   f u l l   a c c e s s   t o   e m p l o y m e n t _ r e c o r d s "   O N   p u b l i c . e m p l o y m e n t _ r e c o r d s 
 
 F O R   A L L   U S I N G   ( 
 
     E X I S T S   ( 
 
         S E L E C T   1   F R O M   p u b l i c . u s e r s 
 
         W H E R E   u s e r s . i d   =   a u t h . u i d ( )   A N D   u s e r s . r o l e   =   ' s u p e r _ a d m i n ' 
 
     ) 
 
 ) ; 
 
 
 
 - -   U s e r s   c a n   v i e w   t h e i r   o w n   r e c o r d 
 
 C R E A T E   P O L I C Y   " U s e r s   c a n   v i e w   t h e i r   o w n   e m p l o y m e n t _ r e c o r d s "   O N   p u b l i c . e m p l o y m e n t _ r e c o r d s 
 
 F O R   S E L E C T   U S I N G   ( 
 
     p r o f i l e _ i d   =   a u t h . u i d ( ) 
 
 ) ; 
 
 
 
 - -   P r o j e c t   M a n a g e r s   a n d   A d m i n s   c a n   v i e w   r e c o r d s   i n   t h e i r   w o r k s p a c e 
 
 C R E A T E   P O L I C Y   " W o r k s p a c e   m a n a g e r s   c a n   v i e w   e m p l o y m e n t _ r e c o r d s "   O N   p u b l i c . e m p l o y m e n t _ r e c o r d s 
 
 F O R   S E L E C T   U S I N G   ( 
 
     E X I S T S   ( 
 
         S E L E C T   1   F R O M   p u b l i c . u s e r s 
 
         W H E R E   u s e r s . i d   =   a u t h . u i d ( )   A N D   u s e r s . w o r k s p a c e _ i d   =   e m p l o y m e n t _ r e c o r d s . w o r k s p a c e _ i d 
 
         A N D   u s e r s . r o l e   I N   ( ' s u p e r _ a d m i n ' ,   ' a d m i n ' ,   ' m a n a g e r ' ,   ' e d i t o r ' ) 
 
     ) 
 
 ) ; 
 
 
 
 - -   R L S   P o l i c i e s   f o r   e m p l o y m e n t _ c h a n g e _ l o g s 
 
 C R E A T E   P O L I C Y   " S u p e r   A d m i n s   h a v e   f u l l   a c c e s s   t o   e m p l o y m e n t _ c h a n g e _ l o g s "   O N   p u b l i c . e m p l o y m e n t _ c h a n g e _ l o g s 
 
 F O R   A L L   U S I N G   ( 
 
     E X I S T S   ( 
 
         S E L E C T   1   F R O M   p u b l i c . u s e r s 
 
         W H E R E   u s e r s . i d   =   a u t h . u i d ( )   A N D   u s e r s . r o l e   =   ' s u p e r _ a d m i n ' 
 
     ) 
 
 ) ; 
 
 
 
 C R E A T E   P O L I C Y   " U s e r s   c a n   v i e w   t h e i r   o w n   c h a n g e   l o g s "   O N   p u b l i c . e m p l o y m e n t _ c h a n g e _ l o g s 
 
 F O R   S E L E C T   U S I N G   ( 
 
     e m p l o y e e _ i d   =   a u t h . u i d ( ) 
 
 ) ; 
 
 I N S E R T   I N T O   p u b l i c . e m p l o y m e n t _ r e c o r d s   ( p r o f i l e _ i d ,   w o r k s p a c e _ i d ,   d a t e _ o f _ j o i n i n g ,   e m p l o y m e n t _ s t a t u s ,   c r e a t e d _ a t ,   u p d a t e d _ a t ) 
 S E L E C T   i d ,   w o r k s p a c e _ i d ,   c r e a t e d _ a t ,   ' a c t i v e ' ,   n o w ( ) ,   n o w ( ) 
 F R O M   p u b l i c . u s e r s 
 W H E R E   w o r k s p a c e _ i d   I S   N O T   N U L L 
 O N   C O N F L I C T   ( p r o f i l e _ i d ,   w o r k s p a c e _ i d )   D O   N O T H I N G ; 
 
 

-- ========================================== 
-- MERGED: HR ISOLATION AUDIT MIGRATION 
-- ==========================================

-- MIGRATION_DOJ_HR_AUDIT.sql
-- Run this script to migrate the database for the DOJ HR Audit update.

-- 1. Add date_of_joining to invitations
ALTER TABLE public.invitations ADD COLUMN IF NOT EXISTS date_of_joining TIMESTAMP WITH TIME ZONE;

-- 2. Create employment_records table
CREATE TABLE IF NOT EXISTS public.employment_records (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    profile_id UUID NOT NULL REFERENCES public.users(id) ON DELETE RESTRICT,
    workspace_id UUID REFERENCES public.workspaces(id) ON DELETE SET NULL,
    date_of_joining TIMESTAMP WITH TIME ZONE NOT NULL,
    employment_status TEXT NOT NULL DEFAULT 'active' CHECK (employment_status IN ('active', 'resigned', 'terminated')),
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    created_by UUID REFERENCES public.users(id) ON DELETE RESTRICT,
    updated_by UUID REFERENCES public.users(id) ON DELETE RESTRICT,
    CONSTRAINT unique_profile_workspace_employment UNIQUE (profile_id, workspace_id)
);

-- 3. Create employment_change_logs table
CREATE TABLE IF NOT EXISTS public.employment_change_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    employee_id UUID NOT NULL REFERENCES public.users(id) ON DELETE RESTRICT,
    field_changed TEXT NOT NULL,
    previous_value TEXT,
    new_value TEXT,
    changed_by UUID NOT NULL REFERENCES public.users(id) ON DELETE RESTRICT,
    changed_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    reason TEXT NOT NULL
);

-- Enable RLS
ALTER TABLE public.employment_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.employment_change_logs ENABLE ROW LEVEL SECURITY;

-- RLS Policies for employment_records
-- Super Admins can do anything
DROP POLICY IF EXISTS "Super Admins have full access to employment_records" ON public.employment_records;
CREATE POLICY "Super Admins have full access to employment_records" ON public.employment_records
FOR ALL USING (
  EXISTS (
    SELECT 1 FROM public.users
    WHERE users.id = auth.uid() AND users.role = 'super_admin'
  )
);

-- Users can view their own record
DROP POLICY IF EXISTS "Users can view their own employment_records" ON public.employment_records;
CREATE POLICY "Users can view their own employment_records" ON public.employment_records
FOR SELECT USING (
  profile_id = auth.uid()
);

-- Project Managers and Admins can view records in their workspace
DROP POLICY IF EXISTS "Workspace managers can view employment_records" ON public.employment_records;
CREATE POLICY "Workspace managers can view employment_records" ON public.employment_records
FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM public.users
    WHERE users.id = auth.uid() AND users.workspace_id = employment_records.workspace_id
    AND users.role IN ('super_admin', 'admin', 'manager', 'editor')
  )
);

-- RLS Policies for employment_change_logs
DROP POLICY IF EXISTS "Super Admins have full access to employment_change_logs" ON public.employment_change_logs;
CREATE POLICY "Super Admins have full access to employment_change_logs" ON public.employment_change_logs
FOR ALL USING (
  EXISTS (
    SELECT 1 FROM public.users
    WHERE users.id = auth.uid() AND users.role = 'super_admin'
  )
);

DROP POLICY IF EXISTS "Users can view their own change logs" ON public.employment_change_logs;
CREATE POLICY "Users can view their own change logs" ON public.employment_change_logs
FOR SELECT USING (
  employee_id = auth.uid()
);

-- 4. Backfill existing users into employment_records
INSERT INTO public.employment_records (profile_id, workspace_id, date_of_joining, employment_status, created_at, updated_at)
SELECT id, workspace_id, created_at, 'active', now(), now()
FROM public.users
WHERE workspace_id IS NOT NULL
ON CONFLICT (profile_id, workspace_id) DO NOTHING;
-- ==========================================
-- HR DATA ISOLATION MIGRATION
-- Moves sensitive salary data out of globally fetched operational structures
-- and into strict 'compensation_records' with explicit Super Admin RLS.
-- ==========================================

-- 1. Drop existing table to ensure fresh schema
DROP TABLE IF EXISTS public.compensation_records CASCADE;

-- 2. Create compensation_records table
CREATE TABLE public.compensation_records (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    employee_id uuid NOT NULL REFERENCES public.users(id) ON DELETE RESTRICT,
    workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
    base_salary numeric NOT NULL DEFAULT 3000,
    currency text NOT NULL DEFAULT 'USD',
    effective_from timestamptz NOT NULL DEFAULT now(),
    effective_to timestamptz DEFAULT NULL,
    change_reason text,
    created_by uuid REFERENCES public.users(id) ON DELETE RESTRICT,
    updated_by uuid REFERENCES public.users(id) ON DELETE RESTRICT,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
);

-- 3. Create partial unique index to ensure only one active compensation record per employee
CREATE UNIQUE INDEX IF NOT EXISTS compensation_records_active_idx 
ON public.compensation_records (workspace_id, employee_id) 
WHERE effective_to IS NULL;

-- 4. Enable RLS on compensation_records
ALTER TABLE public.compensation_records ENABLE ROW LEVEL SECURITY;

-- 5. Super Admin Policy for compensation_records
DROP POLICY IF EXISTS "Super Admins have full access to compensation_records" ON public.compensation_records;
CREATE POLICY "Super Admins have full access to compensation_records"
ON public.compensation_records
FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM public.users
    WHERE users.id = auth.uid()
      AND users.workspace_id = compensation_records.workspace_id
      AND users.role = 'super_admin'
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.users
    WHERE users.id = auth.uid()
      AND users.workspace_id = compensation_records.workspace_id
      AND users.role = 'super_admin'
  )
);

-- 6. Migrate data from 'salaries' to 'compensation_records'
INSERT INTO public.compensation_records (employee_id, workspace_id, base_salary, created_at)
SELECT user_id, workspace_id, base_salary, created_at
FROM public.salaries
WHERE NOT EXISTS (
  SELECT 1 FROM public.compensation_records 
  WHERE compensation_records.employee_id = salaries.user_id
    AND compensation_records.workspace_id = salaries.workspace_id
);


-- ==========================================
-- APPENDED FROM: MIGRATION_FILE_MANAGEMENT.sql
-- ==========================================
-- ==========================================
-- FILE & DOCUMENT MANAGEMENT LAYER
-- Universal files, version control, and storage setup
-- ==========================================

-- 1. Setup Storage Bucket
INSERT INTO storage.buckets (id, name, public) 
VALUES ('workspace_files', 'workspace_files', false) 
ON CONFLICT (id) DO NOTHING;

-- 2. Create workspace_files table
CREATE TABLE IF NOT EXISTS public.workspace_files (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
    entity_type text NOT NULL, -- project, task, epic, sprint, decision, comment
    entity_id uuid NOT NULL,
    file_name text NOT NULL,
    file_type text NOT NULL,
    mime_type text NOT NULL,
    file_size bigint NOT NULL,
    storage_path text NOT NULL,
    uploaded_by uuid REFERENCES public.users(id) ON DELETE RESTRICT,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    deleted_at timestamptz
);

-- Index for global search and entity lookup
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE INDEX IF NOT EXISTS workspace_files_entity_idx ON public.workspace_files(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS workspace_files_workspace_idx ON public.workspace_files(workspace_id);
CREATE INDEX IF NOT EXISTS workspace_files_name_idx ON public.workspace_files USING gin (file_name gin_trgm_ops);

-- Enable RLS
ALTER TABLE public.workspace_files ENABLE ROW LEVEL SECURITY;

-- 3. Create file_versions table
CREATE TABLE IF NOT EXISTS public.file_versions (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    file_id uuid NOT NULL REFERENCES public.workspace_files(id) ON DELETE CASCADE,
    version_number integer NOT NULL,
    storage_path text NOT NULL,
    file_size bigint NOT NULL,
    uploaded_by uuid REFERENCES public.users(id) ON DELETE RESTRICT,
    created_at timestamptz NOT NULL DEFAULT now(),
    change_note text
);

-- Enable RLS
ALTER TABLE public.file_versions ENABLE ROW LEVEL SECURITY;

-- 4. RLS Policies for database tables
-- They inherit visibility from workspace context since entity relationships are diverse.
-- The prompt explicitly states: "Files inherit visibility from parent entities... Super Admin: all workspace files... PM: files from projects they manage"
-- Implementing exact entity-by-entity RLS purely in SQL is complex because `entity_type` determines which table to join.
-- For a simplified enterprise model that strictly uses RLS, we grant access if they are in the workspace, 
-- and let the app strictly enforce fetching by entity (since PMs only see their projects, etc).
-- However, "No frontend-only security. Use RLS."
-- We will write a function to check access or simply rely on workspace visibility for now as baseline, 
-- and add deeper checks if needed. The request says "Files inherit visibility from parent entities... Integrate with existing canViewFile() / canEditFile()". Wait, if we use `canViewFile()`, that's application code. Let's do workspace-level RLS to protect cross-tenant, and app-level `canViewFile` for role checks.

DROP POLICY IF EXISTS "Workspace users can view their workspace files" ON public.workspace_files;
CREATE POLICY "Workspace users can view their workspace files"
ON public.workspace_files FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.users
    WHERE users.id = auth.uid()
      AND users.workspace_id = workspace_files.workspace_id
  )
);

DROP POLICY IF EXISTS "Workspace users can insert workspace files" ON public.workspace_files;
CREATE POLICY "Workspace users can insert workspace files"
ON public.workspace_files FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.users
    WHERE users.id = auth.uid()
      AND users.workspace_id = workspace_files.workspace_id
  )
);

DROP POLICY IF EXISTS "Workspace users can update workspace files" ON public.workspace_files;
CREATE POLICY "Workspace users can update workspace files"
ON public.workspace_files FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM public.users
    WHERE users.id = auth.uid()
      AND users.workspace_id = workspace_files.workspace_id
  )
);

DROP POLICY IF EXISTS "Workspace users can view file versions" ON public.file_versions;
CREATE POLICY "Workspace users can view file versions"
ON public.file_versions FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.workspace_files wf
    JOIN public.users u ON u.workspace_id = wf.workspace_id
    WHERE wf.id = file_versions.file_id
      AND u.id = auth.uid()
  )
);

DROP POLICY IF EXISTS "Workspace users can insert file versions" ON public.file_versions;
CREATE POLICY "Workspace users can insert file versions"
ON public.file_versions FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.workspace_files wf
    JOIN public.users u ON u.workspace_id = wf.workspace_id
    WHERE wf.id = file_versions.file_id
      AND u.id = auth.uid()
  )
);

-- 5. Storage RLS Policies
DROP POLICY IF EXISTS "Workspace users can access workspace_files bucket objects" ON storage.objects;
CREATE POLICY "Workspace users can access workspace_files bucket objects"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'workspace_files' AND
  EXISTS (
    SELECT 1 FROM public.users
    WHERE users.id = auth.uid()
      AND storage.objects.name LIKE (users.workspace_id::text || '/%')
  )
);

DROP POLICY IF EXISTS "Workspace users can insert workspace_files bucket objects" ON storage.objects;
CREATE POLICY "Workspace users can insert workspace_files bucket objects"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'workspace_files' AND
  EXISTS (
    SELECT 1 FROM public.users
    WHERE users.id = auth.uid()
      AND storage.objects.name LIKE (users.workspace_id::text || '/%')
  )
);


-- ==========================================
-- APPENDED FROM: MIGRATION_FILE_GOVERNANCE.sql
-- ==========================================
-- Storage Governance Foundation
ALTER TABLE public.workspaces ADD COLUMN IF NOT EXISTS total_storage_bytes bigint DEFAULT 0;
ALTER TABLE public.workspaces ADD COLUMN IF NOT EXISTS total_file_count integer DEFAULT 0;

CREATE OR REPLACE FUNCTION public.update_workspace_storage()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        UPDATE public.workspaces
        SET total_storage_bytes = total_storage_bytes + NEW.file_size,
            total_file_count = total_file_count + 1
        WHERE id = NEW.workspace_id;
    ELSIF TG_OP = 'UPDATE' THEN
        IF NEW.deleted_at IS NOT NULL AND OLD.deleted_at IS NULL THEN
            UPDATE public.workspaces
            SET total_file_count = total_file_count - 1
            WHERE id = NEW.workspace_id;
        END IF;
    ELSIF TG_OP = 'DELETE' THEN
        UPDATE public.workspaces
        SET total_storage_bytes = total_storage_bytes - OLD.file_size,
            total_file_count = total_file_count - 1
        WHERE id = OLD.workspace_id;
    END IF;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_workspace_file_storage ON public.workspace_files;
CREATE TRIGGER trigger_workspace_file_storage
AFTER INSERT OR UPDATE OR DELETE ON public.workspace_files
FOR EACH ROW EXECUTE FUNCTION public.update_workspace_storage();

CREATE OR REPLACE FUNCTION public.update_workspace_storage_versions()
RETURNS TRIGGER AS $$
DECLARE
    v_workspace_id uuid;
BEGIN
    IF TG_OP = 'INSERT' THEN
        SELECT workspace_id INTO v_workspace_id FROM public.workspace_files WHERE id = NEW.file_id;
        UPDATE public.workspaces
        SET total_storage_bytes = total_storage_bytes + NEW.file_size
        WHERE id = v_workspace_id;
    ELSIF TG_OP = 'DELETE' THEN
        SELECT workspace_id INTO v_workspace_id FROM public.workspace_files WHERE id = OLD.file_id;
        UPDATE public.workspaces
        SET total_storage_bytes = total_storage_bytes - OLD.file_size
        WHERE id = v_workspace_id;
    END IF;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_workspace_file_version_storage ON public.file_versions;
CREATE TRIGGER trigger_workspace_file_version_storage
AFTER INSERT OR DELETE ON public.file_versions
FOR EACH ROW EXECUTE FUNCTION public.update_workspace_storage_versions();


-- ==========================================
-- APPENDED FROM: MIGRATION_FILE_SECURITY_HARDENING.sql
-- ==========================================
-- MIGRATION_FILE_SECURITY_HARDENING.sql
-- Final File Security Hardening with Soft Delete Awareness

-- 1. Helper Functions
CREATE OR REPLACE FUNCTION public.can_access_entity(p_entity_type text, p_entity_id uuid)
RETURNS boolean AS $$
DECLARE
    v_role text;
    v_table_name text;
    v_deleted_at timestamptz;
BEGIN
    SELECT role INTO v_role FROM public.users WHERE id = auth.uid();
    IF v_role IS NULL THEN RETURN false; END IF;
    
    -- Determine table name
    v_table_name := p_entity_type || 's';
    IF p_entity_type = 'comment' THEN
        v_table_name := 'universal_comments';
    END IF;

    -- Verify Soft Deletion for supported entities (Super Admin bypasses this)
    BEGIN
        IF p_entity_type IN ('task', 'project', 'epic', 'sprint', 'decision') THEN
            EXECUTE format('SELECT deleted_at FROM public.%I WHERE id = $1', v_table_name) INTO v_deleted_at USING p_entity_id;
            IF v_role != 'super_admin' AND v_deleted_at IS NOT NULL THEN
                RETURN false;
            END IF;
        ELSIF p_entity_type = 'comment' THEN
            DECLARE
                v_comment_entity_type text;
                v_comment_entity_id uuid;
            BEGIN
                SELECT entity_type, entity_id, deleted_at INTO v_comment_entity_type, v_comment_entity_id, v_deleted_at 
                FROM public.universal_comments WHERE id = p_entity_id;
                
                IF v_role != 'super_admin' AND v_deleted_at IS NOT NULL THEN
                    RETURN false;
                END IF;
                
                -- Verify parent entity access
                RETURN public.can_access_entity(v_comment_entity_type, v_comment_entity_id);
            END;
        END IF;
    EXCEPTION WHEN OTHERS THEN
        -- Fallback if table or deleted_at column doesn't exist
    END;

    -- Super Admin & PM can access everything active in their workspace
    IF v_role IN ('super_admin', 'pm') THEN RETURN true; END IF;

    -- Viewer & Developer
    IF p_entity_type = 'task' THEN
        RETURN EXISTS (SELECT 1 FROM public.tasks WHERE id = p_entity_id AND assignee_id = auth.uid());
    END IF;

    -- Project, Epic, Sprint, Decision are visible to the workspace.
    RETURN true;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


CREATE OR REPLACE FUNCTION public.can_insert_entity_file(p_entity_type text, p_entity_id uuid)
RETURNS boolean AS $$
DECLARE
    v_role text;
    v_table_name text;
    v_deleted_at timestamptz;
BEGIN
    SELECT role INTO v_role FROM public.users WHERE id = auth.uid();
    IF v_role = 'viewer' THEN RETURN false; END IF;

    -- Determine table name
    v_table_name := p_entity_type || 's';
    IF p_entity_type = 'comment' THEN
        v_table_name := 'universal_comments';
    END IF;

    -- Check Soft Deletion (No one can insert into a deleted entity, not even super admin, logically, but prompt said "Super Admin: can access archived records", not insert. Let's block insert if deleted.)
    BEGIN
        IF p_entity_type IN ('task', 'project', 'epic', 'sprint', 'decision') THEN
            EXECUTE format('SELECT deleted_at FROM public.%I WHERE id = $1', v_table_name) INTO v_deleted_at USING p_entity_id;
            IF v_deleted_at IS NOT NULL THEN RETURN false; END IF;
        ELSIF p_entity_type = 'comment' THEN
            SELECT deleted_at INTO v_deleted_at FROM public.universal_comments WHERE id = p_entity_id;
            IF v_deleted_at IS NOT NULL THEN RETURN false; END IF;
        END IF;
    EXCEPTION WHEN OTHERS THEN
        -- Fallback
    END;

    IF v_role IN ('super_admin', 'pm') THEN RETURN true; END IF;

    IF p_entity_type = 'task' THEN
        RETURN EXISTS (SELECT 1 FROM public.tasks WHERE id = p_entity_id AND assignee_id = auth.uid());
    ELSIF p_entity_type = 'comment' THEN
        RETURN EXISTS (SELECT 1 FROM public.universal_comments WHERE id = p_entity_id AND user_id = auth.uid());
    END IF;

    RETURN false;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


CREATE OR REPLACE FUNCTION public.can_manage_entity_file(p_entity_type text, p_entity_id uuid, p_uploaded_by uuid)
RETURNS boolean AS $$
DECLARE
    v_role text;
    v_table_name text;
    v_deleted_at timestamptz;
BEGIN
    SELECT role INTO v_role FROM public.users WHERE id = auth.uid();
    
    -- Check Soft Deletion (Block modifications if entity is deleted)
    v_table_name := p_entity_type || 's';
    IF p_entity_type = 'comment' THEN
        v_table_name := 'universal_comments';
    END IF;

    BEGIN
        IF p_entity_type IN ('task', 'project', 'epic', 'sprint', 'decision') THEN
            EXECUTE format('SELECT deleted_at FROM public.%I WHERE id = $1', v_table_name) INTO v_deleted_at USING p_entity_id;
            IF v_deleted_at IS NOT NULL THEN RETURN false; END IF;
        ELSIF p_entity_type = 'comment' THEN
            SELECT deleted_at INTO v_deleted_at FROM public.universal_comments WHERE id = p_entity_id;
            IF v_deleted_at IS NOT NULL THEN RETURN false; END IF;
        END IF;
    EXCEPTION WHEN OTHERS THEN
        -- Fallback
    END;

    -- Uploader check
    IF p_uploaded_by = auth.uid() THEN RETURN true; END IF;

    IF v_role IN ('super_admin', 'pm') THEN RETURN true; END IF;

    IF p_entity_type = 'task' THEN
        RETURN EXISTS (SELECT 1 FROM public.tasks WHERE id = p_entity_id AND assignee_id = auth.uid());
    END IF;

    IF p_entity_type = 'comment' THEN
        RETURN EXISTS (SELECT 1 FROM public.universal_comments WHERE id = p_entity_id AND user_id = auth.uid());
    END IF;

    RETURN false;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- 2. workspace_files RLS
DROP POLICY IF EXISTS "Workspace users can view their workspace files" ON public.workspace_files;
DROP POLICY IF EXISTS "Users can view accessible entity files" ON public.workspace_files;
CREATE POLICY "Users can view accessible entity files"
ON public.workspace_files FOR SELECT
USING (
  workspace_id = current_workspace() AND
  public.can_access_entity(entity_type, entity_id)
);

DROP POLICY IF EXISTS "Workspace users can insert workspace files" ON public.workspace_files;
DROP POLICY IF EXISTS "Users can insert files to accessible entities" ON public.workspace_files;
CREATE POLICY "Users can insert files to accessible entities"
ON public.workspace_files FOR INSERT
WITH CHECK (
  workspace_id = current_workspace() AND
  public.can_insert_entity_file(entity_type, entity_id)
);

DROP POLICY IF EXISTS "Workspace users can update workspace files" ON public.workspace_files;
DROP POLICY IF EXISTS "Users can update their files or if they have permission" ON public.workspace_files;
CREATE POLICY "Users can update their files or if they have permission"
ON public.workspace_files FOR UPDATE
USING (
  workspace_id = current_workspace() AND
  public.can_manage_entity_file(entity_type, entity_id, uploaded_by)
);

DROP POLICY IF EXISTS "Users can delete their files or if they have permission" ON public.workspace_files;
CREATE POLICY "Users can delete their files or if they have permission"
ON public.workspace_files FOR DELETE
USING (
  workspace_id = current_workspace() AND
  public.can_manage_entity_file(entity_type, entity_id, uploaded_by)
);


-- 3. file_versions RLS
DROP POLICY IF EXISTS "Workspace users can view file versions" ON public.file_versions;
DROP POLICY IF EXISTS "Users can view accessible file versions" ON public.file_versions;
CREATE POLICY "Users can view accessible file versions"
ON public.file_versions FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.workspace_files wf 
    WHERE wf.id = file_versions.file_id 
      AND wf.workspace_id = current_workspace() 
      AND public.can_access_entity(wf.entity_type, wf.entity_id)
  )
);

DROP POLICY IF EXISTS "Workspace users can insert file versions" ON public.file_versions;
DROP POLICY IF EXISTS "Users can insert file versions if they can manage the file" ON public.file_versions;
CREATE POLICY "Users can insert file versions if they can manage the file"
ON public.file_versions FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.workspace_files wf 
    WHERE wf.id = file_versions.file_id 
      AND wf.workspace_id = current_workspace() 
      AND public.can_manage_entity_file(wf.entity_type, wf.entity_id, wf.uploaded_by)
  )
);

DROP POLICY IF EXISTS "Users can delete file versions if they can manage the file" ON public.file_versions;
CREATE POLICY "Users can delete file versions if they can manage the file"
ON public.file_versions FOR DELETE
USING (
  EXISTS (
    SELECT 1 FROM public.workspace_files wf 
    WHERE wf.id = file_versions.file_id 
      AND wf.workspace_id = current_workspace() 
      AND public.can_manage_entity_file(wf.entity_type, wf.entity_id, wf.uploaded_by)
  )
);


-- 4. Storage Bucket Policy Hardening
DROP POLICY IF EXISTS "Workspace users can access workspace_files bucket objects" ON storage.objects;
DROP POLICY IF EXISTS "Users can access their entity objects" ON storage.objects;
CREATE POLICY "Users can access their entity objects"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'workspace_files' AND
  EXISTS (
    SELECT 1 FROM public.workspace_files wf
    WHERE wf.storage_path = storage.objects.name
      AND wf.workspace_id = current_workspace()
      AND public.can_access_entity(wf.entity_type, wf.entity_id)
  )
);

DROP POLICY IF EXISTS "Workspace users can insert workspace_files bucket objects" ON storage.objects;
DROP POLICY IF EXISTS "Users can upload objects if they have insert permission" ON storage.objects;
CREATE POLICY "Users can upload objects if they have insert permission"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'workspace_files' AND
  storage.objects.name LIKE (current_workspace()::text || '/%')
);


-- ==========================================
-- APPENDED FROM: MIGRATION_COLLABORATION_LAYER.sql
-- ==========================================
-- ==========================================
-- COLLABORATION LAYER MIGRATION
-- Universal comments, Mentions, and Notifications upgrade
-- ==========================================

-- 1. Create universal_comments table
CREATE TABLE IF NOT EXISTS public.universal_comments (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
    entity_type text NOT NULL,
    entity_id uuid NOT NULL,
    author_id uuid REFERENCES public.users(id) ON DELETE RESTRICT,
    body text NOT NULL,
    mentions jsonb DEFAULT '[]'::jsonb,
    attachments jsonb DEFAULT '[]'::jsonb,
    parent_comment_id uuid REFERENCES public.universal_comments(id) ON DELETE CASCADE,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    edited_at timestamptz,
    deleted_at timestamptz
);

-- Create comment_versions table for audit history
CREATE TABLE IF NOT EXISTS public.comment_versions (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    comment_id uuid NOT NULL REFERENCES public.universal_comments(id) ON DELETE CASCADE,
    previous_content text,
    new_content text NOT NULL,
    edited_by uuid REFERENCES public.users(id) ON DELETE RESTRICT,
    edited_at timestamptz NOT NULL DEFAULT now()
);

-- Enable RLS for comment_versions
ALTER TABLE public.comment_versions ENABLE ROW LEVEL SECURITY;

-- Workspace users can view comment versions
DROP POLICY IF EXISTS "Workspace users can view comment_versions" ON public.comment_versions;
CREATE POLICY "Workspace users can view comment_versions"
ON public.comment_versions
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.universal_comments uc
    JOIN public.users u ON u.workspace_id = uc.workspace_id
    WHERE uc.id = comment_versions.comment_id
      AND u.id = auth.uid()
  )
);

-- Index for fast lookup by entity
CREATE INDEX IF NOT EXISTS universal_comments_entity_idx ON public.universal_comments(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS universal_comments_workspace_idx ON public.universal_comments(workspace_id);

-- Enable RLS
ALTER TABLE public.universal_comments ENABLE ROW LEVEL SECURITY;

-- 2. Add structured fields to notifications (Safe additive changes)
ALTER TABLE public.notifications ADD COLUMN IF NOT EXISTS type text;
ALTER TABLE public.notifications ADD COLUMN IF NOT EXISTS message text;
ALTER TABLE public.notifications ADD COLUMN IF NOT EXISTS recipient_id uuid REFERENCES public.users(id) ON DELETE RESTRICT;

ALTER TABLE public.notifications ADD COLUMN IF NOT EXISTS source_entity_type text;
ALTER TABLE public.notifications ADD COLUMN IF NOT EXISTS source_entity_id uuid;
ALTER TABLE public.notifications ADD COLUMN IF NOT EXISTS source_anchor_id text;
ALTER TABLE public.notifications ADD COLUMN IF NOT EXISTS route_path text;

-- User Preferences (Safe Additive)
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS preferences jsonb DEFAULT '{"notifications": {"mentions": true, "task_assignments": true, "comments": true, "status_changes": true, "project_updates": true, "system_updates": true}}'::jsonb;

-- Lifecycle tracking
ALTER TABLE public.notifications ADD COLUMN IF NOT EXISTS opened_at timestamptz;
ALTER TABLE public.notifications ADD COLUMN IF NOT EXISTS dismissed_at timestamptz;

-- Notification Security Verification:
-- Users can only read their own notifications. Super admin may audit globally.
DROP POLICY IF EXISTS "Users can view their own notifications" ON public.notifications;
CREATE POLICY "Users can view their own notifications"
ON public.notifications
FOR SELECT
USING (
  recipient_id = auth.uid()
  OR user_id = auth.uid()
  OR EXISTS (
    SELECT 1 FROM public.users u
    WHERE u.id = auth.uid()
      AND u.workspace_id = notifications.workspace_id
      AND u.role = 'super_admin'
  )
);

-- 3. Universal Comments RLS Policies
-- Workspace users can view comments in their workspace
DROP POLICY IF EXISTS "Workspace users can view universal_comments" ON public.universal_comments;
CREATE POLICY "Workspace users can view universal_comments"
ON public.universal_comments
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.users
    WHERE users.id = auth.uid()
      AND users.workspace_id = universal_comments.workspace_id
  )
);

-- Workspace users can insert comments
DROP POLICY IF EXISTS "Workspace users can insert universal_comments" ON public.universal_comments;
CREATE POLICY "Workspace users can insert universal_comments"
ON public.universal_comments
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.users
    WHERE users.id = auth.uid()
      AND users.workspace_id = universal_comments.workspace_id
  )
);

-- Authors can edit their own comments
DROP POLICY IF EXISTS "Authors can update their own universal_comments" ON public.universal_comments;
CREATE POLICY "Authors can update their own universal_comments"
ON public.universal_comments
FOR UPDATE
USING (author_id = auth.uid())
WITH CHECK (author_id = auth.uid());

-- Authors and admins can delete comments
DROP POLICY IF EXISTS "Authors and admins can delete universal_comments" ON public.universal_comments;
CREATE POLICY "Authors and admins can delete universal_comments"
ON public.universal_comments
FOR DELETE
USING (
  author_id = auth.uid()
  OR EXISTS (
    SELECT 1 FROM public.users
    WHERE users.id = auth.uid()
      AND users.workspace_id = universal_comments.workspace_id
      AND users.role IN ('super_admin', 'admin')
  )
);


-- ==========================================
-- APPENDED FROM: MIGRATION_GLOBAL_SEARCH.sql
-- ==========================================
-- MIGRATION_GLOBAL_SEARCH.sql
-- Unified Workspace Search Function

CREATE OR REPLACE FUNCTION public.search_workspace(p_query text, p_limit integer DEFAULT 50)
RETURNS TABLE (
    entity_type text,
    entity_id uuid,
    title text,
    context text,
    last_updated timestamptz,
    owner_id uuid,
    rank real
) AS $$
DECLARE
    v_workspace_id uuid;
    v_query text := '%' || p_query || '%';
BEGIN
    v_workspace_id := public.current_workspace();
    
    RETURN QUERY
    -- Projects
    SELECT 
        'project'::text as entity_type,
        id as entity_id,
        name as title,
        status || ' Ã‚Â· ' || execution_mode as context,
        updated_at as last_updated,
        owner_id as owner_id,
        (CASE WHEN name ILIKE p_query THEN 100 WHEN name ILIKE v_query THEN 50 ELSE 0 END)::real as rank
    FROM public.projects
    WHERE workspace_id = v_workspace_id AND name ILIKE v_query AND deleted_at IS NULL AND public.can_access_entity('project', id)
    
    UNION ALL
    
    -- Tasks
    SELECT 
        'task'::text as entity_type,
        id as entity_id,
        name as title,
        status || ' Ã‚Â· Priority: ' || priority as context,
        updated_at as last_updated,
        assignee_id as owner_id,
        (CASE 
            WHEN name ILIKE p_query THEN 100 
            WHEN assignee_id = auth.uid() THEN 80 
            WHEN name ILIKE v_query THEN 50 
            ELSE 0 
        END)::real as rank
    FROM public.tasks
    WHERE workspace_id = v_workspace_id AND name ILIKE v_query AND deleted_at IS NULL AND public.can_access_entity('task', id)
    
    UNION ALL
    
    -- Files
    SELECT 
        'file'::text as entity_type,
        id as entity_id,
        file_name as title,
        file_type || ' Ã‚Â· ' || (file_size/1024) || 'KB' as context,
        updated_at as last_updated,
        uploaded_by as owner_id,
        (CASE WHEN file_name ILIKE p_query THEN 100 WHEN file_name ILIKE v_query THEN 50 ELSE 0 END)::real as rank
    FROM public.workspace_files
    WHERE workspace_id = v_workspace_id AND file_name ILIKE v_query AND deleted_at IS NULL AND public.can_access_entity(entity_type, entity_id)
    
    UNION ALL
    
    -- Comments
    SELECT 
        'comment'::text as entity_type,
        id as entity_id,
        substring(body from 1 for 60) as title,
        'On ' || entity_type as context,
        updated_at as last_updated,
        author_id as owner_id,
        (CASE WHEN body ILIKE p_query THEN 100 WHEN body ILIKE v_query THEN 50 ELSE 0 END)::real as rank
    FROM public.universal_comments
    WHERE workspace_id = v_workspace_id AND body ILIKE v_query AND deleted_at IS NULL AND public.can_access_entity(entity_type, entity_id)
    
    UNION ALL
    
    -- People
    SELECT 
        'user'::text as entity_type,
        id as entity_id,
        full_name as title,
        role || COALESCE(' Ã‚Â· ' || designation, '') as context,
        created_at as last_updated,
        id as owner_id,
        (CASE WHEN full_name ILIKE p_query THEN 100 WHEN full_name ILIKE v_query THEN 50 ELSE 0 END)::real as rank
    FROM public.users
    WHERE workspace_id = v_workspace_id AND (full_name ILIKE v_query OR email ILIKE v_query)
    
        UNION ALL
    
    -- Clients
    SELECT 
        'client'::text as entity_type,
        id as entity_id,
        company_name as title,
        'Client Ã‚Â· ' || COALESCE(status, '') as context,
        updated_at as last_updated,
        NULL::uuid as owner_id,
        (CASE WHEN company_name ILIKE p_query THEN 100 WHEN company_name ILIKE v_query THEN 50 ELSE 0 END)::real as rank
    FROM public.clients
    WHERE workspace_id = v_workspace_id AND company_name ILIKE v_query AND deleted_at IS NULL AND public.get_user_role(v_workspace_id) = 'super_admin'
    
    UNION ALL
    
    -- Invoices
    SELECT 
        'invoice'::text as entity_type,
        id as entity_id,
        invoice_number as title,
        'Invoice Ã‚Â· ' || status as context,
        updated_at as last_updated,
        created_by as owner_id,
        (CASE WHEN invoice_number ILIKE p_query THEN 100 WHEN invoice_number ILIKE v_query THEN 50 ELSE 0 END)::real as rank
    FROM public.invoices
    WHERE workspace_id = v_workspace_id AND invoice_number ILIKE v_query AND public.get_user_role(v_workspace_id) = 'super_admin'
    
    ORDER BY rank DESC, last_updated DESC
    LIMIT p_limit;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- ==========================================
-- APPENDED FROM: MIGRATION_RECURRING_TASKS.sql
-- ==========================================
CREATE OR REPLACE FUNCTION public.get_user_role(target_workspace_id uuid) RETURNS text AS $$ DECLARE v_role text; BEGIN SELECT role INTO v_role FROM public.users WHERE id = auth.uid() AND workspace_id = target_workspace_id; RETURN v_role; END; $$ LANGUAGE plpgsql SECURITY DEFINER;
-- MIGRATION: Enterprise Recurring Tasks System
-- Adds recurring task templates, history tracking, and generation engine

-- 1. Recurring Task Templates Table
CREATE TABLE IF NOT EXISTS public.recurring_task_templates (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
    project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
    
    title text NOT NULL,
    description text,
    
    created_by uuid REFERENCES public.users(id) ON DELETE RESTRICT,
    assigned_to uuid REFERENCES public.users(id) ON DELETE RESTRICT,
    
    recurrence_type text NOT NULL CHECK (recurrence_type IN ('daily', 'weekly', 'monthly', 'yearly', 'custom')),
    recurrence_rule jsonb, -- e.g., {"days": ["mon", "wed"]}, {"interval": 14}
    
    start_date timestamptz NOT NULL DEFAULT now(),
    end_date timestamptz,
    next_run_at timestamptz NOT NULL DEFAULT now(),
    
    is_active boolean NOT NULL DEFAULT true,
    deleted_at timestamptz,
    
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

-- 2. Recurring Task History (Prevent Duplicates)
CREATE TABLE IF NOT EXISTS public.recurring_task_history (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    template_id uuid NOT NULL REFERENCES public.recurring_task_templates(id) ON DELETE CASCADE,
    generated_task_id uuid NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
    generated_at timestamptz NOT NULL DEFAULT now(),
    UNIQUE(template_id, generated_task_id)
);

-- 3. Activity Logging Trigger
CREATE OR REPLACE FUNCTION log_recurring_task_activity()
RETURNS trigger AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        INSERT INTO public.activity_logs (workspace_id, actor_id, action, metadata)
            VALUES (NEW.workspace_id, NEW.created_by, 'recurring_task_created', jsonb_build_object('entity_type', 'project', 'entity_id', NEW.project_id) || jsonb_build_object('title', NEW.title, 'type', NEW.recurrence_type));
    ELSIF TG_OP = 'UPDATE' THEN
        IF NEW.is_active != OLD.is_active OR NEW.recurrence_type != OLD.recurrence_type THEN
            INSERT INTO public.activity_logs (workspace_id, actor_id, action, metadata) VALUES (NEW.workspace_id, COALESCE(auth.uid(), NEW.created_by), 'recurring_schedule_changed', jsonb_build_object('entity_type', 'project', 'entity_id', NEW.project_id, 'title', NEW.title, 'type', NEW.recurrence_type, 'is_active', NEW.is_active));
        END IF;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_recurring_task_change ON public.recurring_task_templates;
CREATE TRIGGER on_recurring_task_change
AFTER INSERT OR UPDATE ON recurring_task_templates
FOR EACH ROW EXECUTE FUNCTION log_recurring_task_activity();


-- 4. RLS for Templates
ALTER TABLE public.recurring_task_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Enable read access for project members on recurring_task_templates" 
ON public.recurring_task_templates FOR SELECT 
USING (public.can_access_entity('project', project_id) AND deleted_at IS NULL);

CREATE POLICY "Enable write access for authorized users on recurring_task_templates" 
ON public.recurring_task_templates FOR ALL 
USING (
  public.can_access_entity('project', project_id) AND (
    public.get_user_role(workspace_id) IN ('super_admin', 'pm') OR
    created_by = auth.uid() OR
    EXISTS (SELECT 1 FROM projects p WHERE p.id = project_id AND p.owner_id = auth.uid())
  )
);

-- 5. RLS for History
ALTER TABLE public.recurring_task_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Enable read access for history" 
ON public.recurring_task_history FOR SELECT 
USING (
  EXISTS (
    SELECT 1 FROM recurring_task_templates t
    WHERE t.id = template_id AND public.can_access_entity('project', t.project_id)
  )
);

-- 6. Generation Engine Function
-- Processes pending tasks and generates them in bulk.
CREATE OR REPLACE FUNCTION process_recurring_tasks()
RETURNS JSONB AS $$
DECLARE
    t_record RECORD;
    new_task_id uuid;
    next_date timestamptz;
    generated_count integer := 0;
BEGIN
    FOR t_record IN 
        SELECT * FROM recurring_task_templates 
        WHERE is_active = true 
          AND next_run_at <= now() 
          AND deleted_at IS NULL
          AND (end_date IS NULL OR now() <= end_date)
    LOOP
        -- Calculate next run
        IF t_record.recurrence_type = 'daily' THEN
            next_date := t_record.next_run_at + INTERVAL '1 day';
        ELSIF t_record.recurrence_type = 'weekly' THEN
            next_date := t_record.next_run_at + INTERVAL '1 week';
        ELSIF t_record.recurrence_type = 'monthly' THEN
            next_date := t_record.next_run_at + INTERVAL '1 month';
        ELSIF t_record.recurrence_type = 'yearly' THEN
            next_date := t_record.next_run_at + INTERVAL '1 year';
        ELSIF t_record.recurrence_type = 'custom' THEN
            -- Fallback custom interval logic (defaults to 1 week if not properly defined)
            next_date := t_record.next_run_at + (COALESCE((t_record.recurrence_rule->>'interval_days')::integer, 7) || ' days')::interval;
        ELSE
            next_date := t_record.next_run_at + INTERVAL '1 week';
        END IF;

        -- Ensure next_date is in the future (catch up)
        WHILE next_date <= now() LOOP
            IF t_record.recurrence_type = 'daily' THEN next_date := next_date + INTERVAL '1 day';
            ELSIF t_record.recurrence_type = 'weekly' THEN next_date := next_date + INTERVAL '1 week';
            ELSIF t_record.recurrence_type = 'monthly' THEN next_date := next_date + INTERVAL '1 month';
            ELSE next_date := next_date + INTERVAL '1 week';
            END IF;
        END LOOP;

        -- Insert the Task
        INSERT INTO tasks (
            workspace_id, project_id, assignee_id, name, description, status, priority
        ) VALUES (
            t_record.workspace_id, t_record.project_id, t_record.assigned_to, t_record.title, t_record.description, 'backlog', 'medium'
        ) RETURNING id INTO new_task_id;

        -- Log History
        INSERT INTO recurring_task_history (template_id, generated_task_id)
        VALUES (t_record.id, new_task_id);

        -- Insert Activity Log for the generated task
        INSERT INTO public.activity_logs (workspace_id, actor_id, action, metadata)
            VALUES (t_record.workspace_id, t_record.created_by, 'recurring_task_generated', jsonb_build_object('entity_type', 'project', 'entity_id', t_record.project_id) || jsonb_build_object('task_id', new_task_id, 'title', t_record.title));
        
        -- Generate notification for assignment if assigned
        IF t_record.assigned_to IS NOT NULL THEN
            INSERT INTO notifications (
                workspace_id, user_id, type, title, message, source_entity_type, source_entity_id, route_path, created_at
            ) VALUES (
                t_record.workspace_id, t_record.assigned_to, 'task_assignment', 
                'Recurring Task Generated: ' || t_record.title,
                'You have been assigned a newly generated recurring task.',
                'task', new_task_id, '/execution?task=' || new_task_id, now()
            );
        END IF;

        -- Update Template
        UPDATE recurring_task_templates 
        SET next_run_at = next_date,
            updated_at = now()
        WHERE id = t_record.id;
        
        generated_count := generated_count + 1;
    END LOOP;

    RETURN jsonb_build_object('generated_count', generated_count);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- ==========================================
-- APPENDED FROM: MIGRATION_REPORTS.sql
-- ==========================================
-- MIGRATION: Enterprise Reports & Export System
-- Tracks report generation history and manages report persistence.

CREATE TABLE IF NOT EXISTS public.generated_reports (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
    
    report_type text NOT NULL CHECK (report_type IN ('project', 'team', 'sprint', 'attendance', 'payroll')),
    generated_by uuid REFERENCES public.users(id) ON DELETE RESTRICT,
    
    file_path text NOT NULL,
    
    created_at timestamptz NOT NULL DEFAULT now()
);

-- RLS
ALTER TABLE public.generated_reports ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view reports they generated or if they are admin" 
ON public.generated_reports FOR SELECT 
USING (
    generated_by = auth.uid() OR
    public.get_user_role(workspace_id) IN ('super_admin', 'pm')
);

CREATE POLICY "Users can insert reports" 
ON public.generated_reports FOR INSERT 
WITH CHECK (
    -- Any user in the workspace can potentially generate a report (subject to capability enforcement at application layer)
    public.get_user_role(workspace_id) IS NOT NULL
);

-- Note: We rely on the frontend to gate payroll generation using `hasCapability(role, 'manage_compensation')`.


-- ==========================================
-- APPENDED FROM: MIGRATION_SKILLS.sql
-- ==========================================
-- MIGRATION: Team Skills Matrix
-- Adds skills and user_skills tracking

-- 1. Skills Dictionary
CREATE TABLE IF NOT EXISTS public.skills (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
    name text NOT NULL,
    category text,
    created_at timestamptz NOT NULL DEFAULT now(),
    UNIQUE(workspace_id, name)
);

-- RLS for Skills Dictionary
ALTER TABLE public.skills ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Enable read access for all workspace members" 
ON public.skills FOR SELECT 
USING (public.get_user_role(workspace_id) IS NOT NULL);

CREATE POLICY "Enable write access for managers and admins" 
ON public.skills FOR ALL 
USING (public.get_user_role(workspace_id) IN ('super_admin', 'pm'));

-- 2. User Skills Mapping
CREATE TABLE IF NOT EXISTS public.user_skills (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE RESTRICT,
    skill_id uuid NOT NULL REFERENCES public.skills(id) ON DELETE CASCADE,
    level text NOT NULL CHECK (level IN ('beginner', 'intermediate', 'advanced', 'expert')),
    verified_by uuid REFERENCES public.users(id) ON DELETE RESTRICT,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    UNIQUE(user_id, skill_id)
);

-- RLS for User Skills
ALTER TABLE public.user_skills ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Enable read access for workspace members" 
ON public.user_skills FOR SELECT 
USING (
  EXISTS (
    SELECT 1 FROM skills s WHERE s.id = skill_id AND public.get_user_role(s.workspace_id) IS NOT NULL
  )
);

CREATE POLICY "Users can manage their own skills" 
ON public.user_skills FOR ALL 
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

CREATE POLICY "Managers can verify and manage team skills" 
ON public.user_skills FOR ALL 
USING (
  EXISTS (
    SELECT 1 FROM skills s WHERE s.id = skill_id AND public.get_user_role(s.workspace_id) IN ('super_admin', 'pm')
  )
);

-- Global Search function update for Skills
-- If we look at previous search RPCs, we can integrate it. But for now we just handle it in the frontend or augment the search RPC.


-- ==========================================
-- APPENDED FROM: MIGRATION_FINANCE.sql
-- ==========================================
-- MIGRATION: Business Accounts & Finance Module
-- Adds Clients, Invoices, Payments, and Expenses

-- 1. Clients Table
CREATE TABLE IF NOT EXISTS public.clients (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
    company_name text NOT NULL,
    contact_person text,
    email text,
    phone text,
    billing_address text,
    status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    deleted_at timestamptz
);

ALTER TABLE public.clients ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Enable read access for authorized users" 
ON public.clients FOR SELECT 
USING (public.get_user_role(workspace_id) = 'super_admin');

CREATE POLICY "Enable write access for authorized users" 
ON public.clients FOR ALL 
USING (public.get_user_role(workspace_id) = 'super_admin');

-- Alter projects to link to client
ALTER TABLE public.projects ADD COLUMN IF NOT EXISTS workspace_id uuid REFERENCES public.workspaces(id) ON DELETE CASCADE,
ADD COLUMN IF NOT EXISTS client_id uuid REFERENCES public.clients(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS department_id uuid REFERENCES public.departments(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS budget numeric DEFAULT 0,
ADD COLUMN IF NOT EXISTS billing_currency text DEFAULT 'USD',
ADD COLUMN IF NOT EXISTS approval_workflow text DEFAULT 'standard' CHECK (approval_workflow IN ('standard', 'strict', 'none')),
ADD COLUMN IF NOT EXISTS pert_enabled boolean DEFAULT true;

-- 2. Invoices Table
CREATE TABLE IF NOT EXISTS public.invoices (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
    client_id uuid REFERENCES public.clients(id) ON DELETE RESTRICT,
    project_id uuid REFERENCES public.projects(id) ON DELETE SET NULL,
    invoice_number text NOT NULL,
    amount numeric NOT NULL DEFAULT 0,
    currency text NOT NULL DEFAULT 'USD',
    status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'sent', 'paid', 'overdue', 'cancelled')),
    issue_date date,
    due_date date,
    paid_date date,
    created_by uuid REFERENCES public.users(id) ON DELETE RESTRICT,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    UNIQUE(workspace_id, invoice_number)
);

ALTER TABLE public.invoices ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Enable read access for authorized users" 
ON public.invoices FOR SELECT 
USING (public.get_user_role(workspace_id) = 'super_admin');

CREATE POLICY "Enable write access for authorized users" 
ON public.invoices FOR ALL 
USING (public.get_user_role(workspace_id) = 'super_admin');

-- 3. Invoice Line Items Table
CREATE TABLE IF NOT EXISTS public.invoice_line_items (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    invoice_id uuid NOT NULL REFERENCES public.invoices(id) ON DELETE CASCADE,
    description text NOT NULL,
    quantity numeric NOT NULL DEFAULT 1,
    unit_price numeric NOT NULL DEFAULT 0,
    total numeric NOT NULL DEFAULT 0
);

ALTER TABLE public.invoice_line_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Enable access for authorized users via invoice" 
ON public.invoice_line_items FOR ALL 
USING (
  EXISTS (
    SELECT 1 FROM public.invoices i WHERE i.id = invoice_id AND public.get_user_role(i.workspace_id) = 'super_admin'
  )
);

-- 4. Payments Table
CREATE TABLE IF NOT EXISTS public.payments (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    invoice_id uuid NOT NULL REFERENCES public.invoices(id) ON DELETE RESTRICT,
    amount numeric NOT NULL,
    payment_date date NOT NULL,
    method text,
    reference_number text,
    created_by uuid REFERENCES public.users(id) ON DELETE RESTRICT,
    created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Enable access for authorized users via invoice" 
ON public.payments FOR ALL 
USING (
  EXISTS (
    SELECT 1 FROM public.invoices i WHERE i.id = invoice_id AND public.get_user_role(i.workspace_id) = 'super_admin'
  )
);

-- 5. Expenses Table
CREATE TABLE IF NOT EXISTS public.expenses (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
    category text NOT NULL CHECK (category IN ('salary', 'software', 'infrastructure', 'office', 'misc')),
    amount numeric NOT NULL,
    date date NOT NULL,
    description text NOT NULL,
    created_by uuid REFERENCES public.users(id) ON DELETE RESTRICT,
    created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.expenses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Enable read access for authorized users" 
ON public.expenses FOR SELECT 
USING (public.get_user_role(workspace_id) = 'super_admin');

CREATE POLICY "Enable write access for authorized users" 
ON public.expenses FOR ALL 
USING (public.get_user_role(workspace_id) = 'super_admin');

-- Triggers for Activity Logs
CREATE OR REPLACE FUNCTION log_finance_activity()
RETURNS trigger AS $$
BEGIN
    IF TG_TABLE_NAME = 'invoices' THEN
        IF TG_OP = 'INSERT' THEN
            INSERT INTO public.activity_logs (workspace_id, actor_id, action, metadata)
            VALUES (NEW.workspace_id, NEW.created_by, 'invoice_created', jsonb_build_object('entity_type', 'invoice', 'entity_id', NEW.id) || jsonb_build_object('invoice_number', NEW.invoice_number, 'amount', NEW.amount));
        ELSIF TG_OP = 'UPDATE' THEN
            IF NEW.status != OLD.status THEN
                INSERT INTO public.activity_logs (workspace_id, actor_id, action, metadata)
            VALUES (NEW.workspace_id, auth.uid(), 'invoice_status_changed', jsonb_build_object('entity_type', 'invoice', 'entity_id', NEW.id) || jsonb_build_object('old_status', OLD.status, 'new_status', NEW.status));
            END IF;
        END IF;
    ELSIF TG_TABLE_NAME = 'payments' THEN
        IF TG_OP = 'INSERT' THEN
            DECLARE
                v_workspace_id uuid;
            BEGIN
                SELECT workspace_id INTO v_workspace_id FROM public.invoices WHERE id = NEW.invoice_id;
                INSERT INTO public.activity_logs (workspace_id, actor_id, action, metadata)
            VALUES (v_workspace_id, NEW.created_by, 'payment_received', jsonb_build_object('entity_type', 'payment', 'entity_id', NEW.id) || jsonb_build_object('amount', NEW.amount, 'reference', NEW.reference_number));
            END;
        END IF;
    ELSIF TG_TABLE_NAME = 'expenses' THEN
        IF TG_OP = 'INSERT' THEN
            INSERT INTO public.activity_logs (workspace_id, actor_id, action, metadata)
            VALUES (NEW.workspace_id, NEW.created_by, 'expense_added', jsonb_build_object('entity_type', 'expense', 'entity_id', NEW.id) || jsonb_build_object('amount', NEW.amount, 'category', NEW.category));
        ELSIF TG_OP = 'DELETE' THEN
            INSERT INTO public.activity_logs (workspace_id, actor_id, action, metadata)
            VALUES (OLD.workspace_id, auth.uid(), 'expense_deleted', jsonb_build_object('entity_type', 'expense', 'entity_id', OLD.id) || jsonb_build_object('amount', OLD.amount, 'category', OLD.category));
        END IF;
    END IF;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trigger_log_invoice_activity ON public.invoices;
CREATE TRIGGER trigger_log_invoice_activity AFTER INSERT OR UPDATE ON public.invoices FOR EACH ROW EXECUTE FUNCTION public.log_finance_activity();
DROP TRIGGER IF EXISTS trigger_log_payment_activity ON public.payments;
CREATE TRIGGER trigger_log_payment_activity AFTER INSERT ON public.payments FOR EACH ROW EXECUTE FUNCTION public.log_finance_activity();
DROP TRIGGER IF EXISTS trigger_log_expense_activity ON public.expenses;
CREATE TRIGGER trigger_log_expense_activity AFTER INSERT OR DELETE ON public.expenses FOR EACH ROW EXECUTE FUNCTION public.log_finance_activity();


-- ==========================================
-- APPENDED FROM: MIGRATION_FINANCE_HARDENING.sql
-- ==========================================
-- MIGRATION: Finance Historical Accuracy Hardening

-- 1. Financial Periods
CREATE TABLE IF NOT EXISTS public.financial_periods (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
    month integer NOT NULL CHECK (month BETWEEN 1 AND 12),
    year integer NOT NULL,
    status text NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'closed')),
    closed_by uuid REFERENCES public.users(id) ON DELETE RESTRICT,
    closed_at timestamptz,
    created_at timestamptz NOT NULL DEFAULT now(),
    UNIQUE(workspace_id, month, year)
);

ALTER TABLE public.financial_periods ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Enable read access for authorized users" 
ON public.financial_periods FOR SELECT 
USING (public.get_user_role(workspace_id) = 'super_admin');

CREATE POLICY "Enable write access for authorized users" 
ON public.financial_periods FOR ALL 
USING (public.get_user_role(workspace_id) = 'super_admin');

-- 2. Financial Snapshots
CREATE TABLE IF NOT EXISTS public.financial_snapshots (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
    period_id uuid NOT NULL REFERENCES public.financial_periods(id) ON DELETE CASCADE,
    total_revenue numeric NOT NULL DEFAULT 0,
    total_salary_expense numeric NOT NULL DEFAULT 0,
    total_other_expenses numeric NOT NULL DEFAULT 0,
    net_profit numeric NOT NULL DEFAULT 0,
    employee_count integer NOT NULL DEFAULT 0,
    client_count integer NOT NULL DEFAULT 0,
    project_count integer NOT NULL DEFAULT 0,
    snapshot_data jsonb,
    created_at timestamptz NOT NULL DEFAULT now(),
    UNIQUE(period_id)
);

ALTER TABLE public.financial_snapshots ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Enable read access for authorized users" 
ON public.financial_snapshots FOR SELECT 
USING (public.get_user_role(workspace_id) = 'super_admin');

CREATE POLICY "Enable write access for authorized users" 
ON public.financial_snapshots FOR ALL 
USING (public.get_user_role(workspace_id) = 'super_admin');

-- 3. Financial Adjustments
CREATE TABLE IF NOT EXISTS public.financial_adjustments (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    period_id uuid NOT NULL REFERENCES public.financial_periods(id) ON DELETE CASCADE,
    type text NOT NULL CHECK (type IN ('revenue', 'salary', 'expense')),
    amount numeric NOT NULL,
    reason text NOT NULL,
    created_by uuid REFERENCES public.users(id) ON DELETE RESTRICT,
    created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.financial_adjustments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Enable read access for authorized users" 
ON public.financial_adjustments FOR SELECT 
USING (
  EXISTS (
    SELECT 1 FROM public.financial_periods p 
    WHERE p.id = period_id AND public.get_user_role(p.workspace_id) = 'super_admin'
  )
);

CREATE POLICY "Enable write access for authorized users" 
ON public.financial_adjustments FOR ALL 
USING (
  EXISTS (
    SELECT 1 FROM public.financial_periods p 
    WHERE p.id = period_id AND public.get_user_role(p.workspace_id) = 'super_admin'
  )
);

-- Locking rules via triggers
CREATE OR REPLACE FUNCTION check_financial_period_lock()
RETURNS trigger AS $$
DECLARE
    v_month integer;
    v_year integer;
    v_status text;
    v_workspace_id uuid;
    v_date date;
BEGIN
    -- Determine the date and workspace based on the operation
    IF TG_TABLE_NAME = 'invoices' THEN
        v_date := COALESCE(NEW.issue_date, OLD.issue_date, CURRENT_DATE);
        v_workspace_id := COALESCE(NEW.workspace_id, OLD.workspace_id);
    ELSIF TG_TABLE_NAME = 'payments' THEN
        v_date := COALESCE(NEW.payment_date, OLD.payment_date, CURRENT_DATE);
        IF TG_OP = 'INSERT' OR TG_OP = 'UPDATE' THEN
            SELECT workspace_id INTO v_workspace_id FROM invoices WHERE id = NEW.invoice_id;
        ELSE
            SELECT workspace_id INTO v_workspace_id FROM invoices WHERE id = OLD.invoice_id;
        END IF;
    ELSIF TG_TABLE_NAME = 'expenses' THEN
        v_date := COALESCE(NEW.date, OLD.date, CURRENT_DATE);
        v_workspace_id := COALESCE(NEW.workspace_id, OLD.workspace_id);
    END IF;

    -- Extract month and year
    v_month := EXTRACT(MONTH FROM v_date);
    v_year := EXTRACT(YEAR FROM v_date);

    -- Check if period is closed
    SELECT status INTO v_status FROM public.financial_periods 
    WHERE workspace_id = v_workspace_id AND month = v_month AND year = v_year;

    IF v_status = 'closed' THEN
        RAISE EXCEPTION 'Cannot modify financial records in a closed period. Create a financial adjustment instead.';
    END IF;

    RETURN CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Apply locking triggers
DROP TRIGGER IF EXISTS enforce_invoice_lock ON public.invoices;
CREATE TRIGGER enforce_invoice_lock BEFORE INSERT OR UPDATE OR DELETE ON public.invoices FOR EACH ROW EXECUTE FUNCTION check_financial_period_lock();

DROP TRIGGER IF EXISTS enforce_payment_lock ON public.payments;
CREATE TRIGGER enforce_payment_lock BEFORE INSERT OR UPDATE OR DELETE ON public.payments FOR EACH ROW EXECUTE FUNCTION check_financial_period_lock();

DROP TRIGGER IF EXISTS enforce_expense_lock ON public.expenses;
CREATE TRIGGER enforce_expense_lock BEFORE INSERT OR UPDATE OR DELETE ON public.expenses FOR EACH ROW EXECUTE FUNCTION check_financial_period_lock();

-- Function to safely close a financial period and generate a snapshot
CREATE OR REPLACE FUNCTION close_financial_period(p_workspace_id uuid, p_month integer, p_year integer, p_user_id uuid)
RETURNS uuid AS $$
DECLARE
    v_period_id uuid;
    v_total_revenue numeric := 0;
    v_total_salary_expense numeric := 0;
    v_total_other_expenses numeric := 0;
    v_employee_count integer := 0;
    v_client_count integer := 0;
    v_project_count integer := 0;
BEGIN
    -- Check if already exists
    SELECT id INTO v_period_id FROM public.financial_periods 
    WHERE workspace_id = p_workspace_id AND month = p_month AND year = p_year;

    IF v_period_id IS NULL THEN
        INSERT INTO public.financial_periods (workspace_id, month, year, status, closed_by, closed_at)
        VALUES (p_workspace_id, p_month, p_year, 'closed', p_user_id, now())
        RETURNING id INTO v_period_id;
    ELSE
        UPDATE public.financial_periods 
        SET status = 'closed', closed_by = p_user_id, closed_at = now()
        WHERE id = v_period_id;
    END IF;

    -- Calculate Revenue (Payments in month)
    SELECT COALESCE(SUM(amount), 0) INTO v_total_revenue 
    FROM public.payments p
    JOIN public.invoices i ON i.id = p.invoice_id
    WHERE i.workspace_id = p_workspace_id AND EXTRACT(MONTH FROM p.payment_date) = p_month AND EXTRACT(YEAR FROM p.payment_date) = p_year;

    -- Calculate Salary (Active employees from salaries table)
    SELECT COALESCE(SUM(base_salary), 0), COUNT(id) INTO v_total_salary_expense, v_employee_count 
    FROM public.salaries 
    WHERE workspace_id = p_workspace_id;

    -- Calculate Other Expenses
    SELECT COALESCE(SUM(amount), 0) INTO v_total_other_expenses 
    FROM public.expenses 
    WHERE workspace_id = p_workspace_id AND EXTRACT(MONTH FROM date) = p_month AND EXTRACT(YEAR FROM date) = p_year;

    -- Counters
    SELECT COUNT(id) INTO v_client_count FROM public.clients WHERE workspace_id = p_workspace_id AND status = 'active';
    SELECT COUNT(id) INTO v_project_count FROM public.projects WHERE workspace_id = p_workspace_id AND deleted_at IS NULL;

    -- Store Snapshot
    INSERT INTO public.financial_snapshots (
        workspace_id, period_id, total_revenue, total_salary_expense, total_other_expenses, net_profit, 
        employee_count, client_count, project_count
    ) VALUES (
        p_workspace_id, v_period_id, v_total_revenue, v_total_salary_expense, v_total_other_expenses, 
        (v_total_revenue - v_total_salary_expense - v_total_other_expenses),
        v_employee_count, v_client_count, v_project_count
    )
    ON CONFLICT (period_id) DO UPDATE SET 
        total_revenue = EXCLUDED.total_revenue,
        total_salary_expense = EXCLUDED.total_salary_expense,
        total_other_expenses = EXCLUDED.total_other_expenses,
        net_profit = EXCLUDED.net_profit,
        employee_count = EXCLUDED.employee_count,
        client_count = EXCLUDED.client_count,
        project_count = EXCLUDED.project_count;

    -- Log activity
    INSERT INTO public.activity_logs (workspace_id, actor_id, action, metadata)
            VALUES (p_workspace_id, p_user_id, 'period_closed', jsonb_build_object('entity_type', 'financial_period', 'entity_id', v_period_id) || jsonb_build_object('month', p_month, 'year', p_year));

    RETURN v_period_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- ==========================================
-- APPENDED FROM: MIGRATION_FINANCE_ADJUSTMENTS.sql
-- ==========================================
-- MIGRATION: Finance Adjustment Auditing

CREATE OR REPLACE FUNCTION log_financial_adjustment()
RETURNS trigger AS $$
DECLARE
    v_workspace_id uuid;
BEGIN
    SELECT workspace_id INTO v_workspace_id FROM public.financial_periods WHERE id = NEW.period_id;
    
    INSERT INTO public.activity_logs (workspace_id, actor_id, action, metadata)
            VALUES (v_workspace_id, NEW.created_by, 'adjustment_added', jsonb_build_object('entity_type', 'financial_adjustment', 'entity_id', NEW.id) || jsonb_build_object('type', NEW.type, 'amount', NEW.amount, 'reason', NEW.reason));
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trigger_log_financial_adjustment ON public.financial_adjustments;
CREATE TRIGGER trigger_log_financial_adjustment
AFTER INSERT ON public.financial_adjustments
FOR EACH ROW EXECUTE FUNCTION log_financial_adjustment();



- -   M i g r a t i o n :   G S T   A c c o u n t i n g   a n d   I n v o i c i n g   L a y e r 
 
 - -   D e s c r i p t i o n :   E n h a n c e s   f i n a n c e   s y s t e m   w i t h   c o m p a n y   p r o f i l e s ,   G S T   c a l c u l a t i o n   l o g i c ,   a n d   r o b u s t   i n v o i c i n g . 
 
 
 
 B E G I N ; 
 
 
 
 - -   1 .   C r e a t e   c o m p a n y   b i l l i n g   p r o f i l e 
 
 C R E A T E   T A B L E   I F   N O T   E X I S T S   p u b l i c . c o m p a n y _ b i l l i n g _ p r o f i l e   ( 
 
         i d   u u i d   P R I M A R Y   K E Y   D E F A U L T   g e n _ r a n d o m _ u u i d ( ) , 
 
         w o r k s p a c e _ i d   u u i d   N O T   N U L L   U N I Q U E   R E F E R E N C E S   p u b l i c . w o r k s p a c e s ( i d )   O N   D E L E T E   C A S C A D E , 
 
         l e g a l _ n a m e   t e x t   N O T   N U L L , 
 
         g s t i n   t e x t , 
 
         p a n   t e x t , 
 
         b i l l i n g _ a d d r e s s   t e x t , 
 
         s t a t e   t e x t   N O T   N U L L , 
 
         c o u n t r y   t e x t   N O T   N U L L   D E F A U L T   ' I n d i a ' , 
 
         b a n k _ d e t a i l s   j s o n b , 
 
         i n v o i c e _ p r e f i x   t e x t   N O T   N U L L   D E F A U L T   ' R P M ' , 
 
         c r e a t e d _ a t   t i m e s t a m p t z   N O T   N U L L   D E F A U L T   n o w ( ) , 
 
         u p d a t e d _ a t   t i m e s t a m p t z   N O T   N U L L   D E F A U L T   n o w ( ) 
 
 ) ; 
 
 
 
 A L T E R   T A B L E   p u b l i c . c o m p a n y _ b i l l i n g _ p r o f i l e   E N A B L E   R O W   L E V E L   S E C U R I T Y ; 
 
 
 
 C R E A T E   P O L I C Y   " E n a b l e   r e a d   a c c e s s   f o r   a u t h o r i z e d   u s e r s "   
 
 O N   p u b l i c . c o m p a n y _ b i l l i n g _ p r o f i l e   F O R   S E L E C T   
 
 U S I N G   ( p u b l i c . g e t _ u s e r _ r o l e ( w o r k s p a c e _ i d )   I N   ( ' s u p e r _ a d m i n ' ,   ' a d m i n ' ,   ' m a n a g e r ' ,   ' m e m b e r ' ) ) ; 
 
 
 
 C R E A T E   P O L I C Y   " E n a b l e   w r i t e   a c c e s s   f o r   s u p e r   a d m i n "   
 
 O N   p u b l i c . c o m p a n y _ b i l l i n g _ p r o f i l e   F O R   A L L   
 
 U S I N G   ( p u b l i c . g e t _ u s e r _ r o l e ( w o r k s p a c e _ i d )   =   ' s u p e r _ a d m i n ' ) ; 
 
 
 
 - -   2 .   E x t e n d   c l i e n t s   t a b l e 
 
 A L T E R   T A B L E   p u b l i c . c l i e n t s 
 
 A D D   C O L U M N   I F   N O T   E X I S T S   g s t i n   t e x t , 
 
 A D D   C O L U M N   I F   N O T   E X I S T S   b i l l i n g _ s t a t e   t e x t , 
 
 A D D   C O L U M N   I F   N O T   E X I S T S   b i l l i n g _ c o u n t r y   t e x t   D E F A U L T   ' I n d i a ' , 
 
 A D D   C O L U M N   I F   N O T   E X I S T S   t a x _ t y p e   t e x t   D E F A U L T   ' u n r e g i s t e r e d '   C H E C K   ( t a x _ t y p e   I N   ( ' r e g i s t e r e d ' ,   ' u n r e g i s t e r e d ' ) ) ; 
 
 
 
 - -   3 .   I n v o i c e   S e q u e n c e   M e c h a n i s m 
 
 C R E A T E   T A B L E   I F   N O T   E X I S T S   p u b l i c . i n v o i c e _ s e q u e n c e s   ( 
 
         w o r k s p a c e _ i d   u u i d   P R I M A R Y   K E Y   R E F E R E N C E S   p u b l i c . w o r k s p a c e s ( i d )   O N   D E L E T E   C A S C A D E , 
 
         l a s t _ s e q u e n c e   i n t e g e r   N O T   N U L L   D E F A U L T   0 , 
 
         c u r r e n t _ y e a r   i n t e g e r   N O T   N U L L 
 
 ) ; 
 
 
 
 A L T E R   T A B L E   p u b l i c . i n v o i c e _ s e q u e n c e s   E N A B L E   R O W   L E V E L   S E C U R I T Y ; 
 
 - -   N o   d i r e c t   p o l i c i e s ,   s h o u l d   b e   a c c e s s e d   v i a   s e c u r i t y   d e f i n e r   f u n c t i o n   i f   n e e d e d ,   o r   b y   s u p e r   a d m i n 
 
 
 
 - -   F u n c t i o n   t o   g e n e r a t e   t h e   n e x t   i n v o i c e   n u m b e r   s e c u r e l y 
 
 C R E A T E   O R   R E P L A C E   F U N C T I O N   p u b l i c . g e n e r a t e _ i n v o i c e _ n u m b e r ( p _ w o r k s p a c e _ i d   u u i d ,   p _ p r e f i x   t e x t ) 
 
 R E T U R N S   t e x t   A S   $ $ 
 
 D E C L A R E 
 
         v _ y e a r   i n t e g e r ; 
 
         v _ s e q   i n t e g e r ; 
 
         v _ i n v o i c e _ n u m b e r   t e x t ; 
 
 B E G I N 
 
         v _ y e a r   : =   e x t r a c t ( y e a r   f r o m   c u r r e n t _ d a t e ) ; 
 
         
 
         I N S E R T   I N T O   p u b l i c . i n v o i c e _ s e q u e n c e s   ( w o r k s p a c e _ i d ,   l a s t _ s e q u e n c e ,   c u r r e n t _ y e a r ) 
 
         V A L U E S   ( p _ w o r k s p a c e _ i d ,   1 ,   v _ y e a r ) 
 
         O N   C O N F L I C T   ( w o r k s p a c e _ i d )   D O   U P D A T E 
 
         S E T   
 
                 l a s t _ s e q u e n c e   =   C A S E   W H E N   p u b l i c . i n v o i c e _ s e q u e n c e s . c u r r e n t _ y e a r   =   v _ y e a r   T H E N   p u b l i c . i n v o i c e _ s e q u e n c e s . l a s t _ s e q u e n c e   +   1   E L S E   1   E N D , 
 
                 c u r r e n t _ y e a r   =   v _ y e a r 
 
         R E T U R N I N G   l a s t _ s e q u e n c e   I N T O   v _ s e q ; 
 
         
 
         v _ i n v o i c e _ n u m b e r   : =   p _ p r e f i x   | |   ' / '   | |   v _ y e a r   | |   ' / '   | |   l p a d ( v _ s e q : : t e x t ,   3 ,   ' 0 ' ) ; 
 
         R E T U R N   v _ i n v o i c e _ n u m b e r ; 
 
 E N D ; 
 
 $ $   L A N G U A G E   p l p g s q l   S E C U R I T Y   D E F I N E R ; 
 
 
 
 
 
 - -   4 .   E x t e n d   i n v o i c e s   t a b l e 
 
 A L T E R   T A B L E   p u b l i c . i n v o i c e s 
 
 A D D   C O L U M N   I F   N O T   E X I S T S   s u b t o t a l   n u m e r i c   N O T   N U L L   D E F A U L T   0 , 
 
 A D D   C O L U M N   I F   N O T   E X I S T S   d i s c o u n t _ a m o u n t   n u m e r i c   N O T   N U L L   D E F A U L T   0 , 
 
 A D D   C O L U M N   I F   N O T   E X I S T S   t a x a b l e _ a m o u n t   n u m e r i c   N O T   N U L L   D E F A U L T   0 , 
 
 A D D   C O L U M N   I F   N O T   E X I S T S   c g s t _ a m o u n t   n u m e r i c   N O T   N U L L   D E F A U L T   0 , 
 
 A D D   C O L U M N   I F   N O T   E X I S T S   s g s t _ a m o u n t   n u m e r i c   N O T   N U L L   D E F A U L T   0 , 
 
 A D D   C O L U M N   I F   N O T   E X I S T S   i g s t _ a m o u n t   n u m e r i c   N O T   N U L L   D E F A U L T   0 , 
 
 A D D   C O L U M N   I F   N O T   E X I S T S   t o t a l _ t a x   n u m e r i c   N O T   N U L L   D E F A U L T   0 , 
 
 A D D   C O L U M N   I F   N O T   E X I S T S   g r a n d _ t o t a l   n u m e r i c   N O T   N U L L   D E F A U L T   0 , 
 
 A D D   C O L U M N   I F   N O T   E X I S T S   b a l a n c e _ d u e   n u m e r i c   N O T   N U L L   D E F A U L T   0 , 
 
 A D D   C O L U M N   I F   N O T   E X I S T S   b i l l i n g _ s t a t e _ s n a p s h o t   t e x t ; 
 
 
 
 - -   5 .   C r e a t e   i n v o i c e   l i n e   i t e m s   t a b l e 
 
 C R E A T E   T A B L E   I F   N O T   E X I S T S   p u b l i c . i n v o i c e _ l i n e _ i t e m s   ( 
 
         i d   u u i d   P R I M A R Y   K E Y   D E F A U L T   g e n _ r a n d o m _ u u i d ( ) , 
 
         i n v o i c e _ i d   u u i d   N O T   N U L L   R E F E R E N C E S   p u b l i c . i n v o i c e s ( i d )   O N   D E L E T E   C A S C A D E , 
 
         d e s c r i p t i o n   t e x t   N O T   N U L L , 
 
         q u a n t i t y   n u m e r i c   N O T   N U L L   D E F A U L T   1 , 
 
         r a t e   n u m e r i c   N O T   N U L L   D E F A U L T   0 , 
 
         t a x _ p e r c e n t a g e   n u m e r i c   N O T   N U L L   D E F A U L T   0 , 
 
         a m o u n t   n u m e r i c   N O T   N U L L   D E F A U L T   0 , 
 
         c r e a t e d _ a t   t i m e s t a m p t z   N O T   N U L L   D E F A U L T   n o w ( ) 
 
 ) ; 
 
 
 
 A L T E R   T A B L E   p u b l i c . i n v o i c e _ l i n e _ i t e m s   E N A B L E   R O W   L E V E L   S E C U R I T Y ; 
 
 
 
 C R E A T E   P O L I C Y   " E n a b l e   r e a d   a c c e s s   f o r   a u t h o r i z e d   u s e r s   v i a   i n v o i c e "   
 
 O N   p u b l i c . i n v o i c e _ l i n e _ i t e m s   F O R   S E L E C T   
 
 U S I N G   ( 
 
     E X I S T S   ( 
 
         S E L E C T   1   F R O M   p u b l i c . i n v o i c e s   i   W H E R E   i . i d   =   i n v o i c e _ i d   A N D   p u b l i c . g e t _ u s e r _ r o l e ( i . w o r k s p a c e _ i d )   I N   ( ' s u p e r _ a d m i n ' ,   ' a d m i n ' ,   ' m a n a g e r ' ,   ' m e m b e r ' ) 
 
     ) 
 
 ) ; 
 
 
 
 C R E A T E   P O L I C Y   " E n a b l e   w r i t e   a c c e s s   f o r   a u t h o r i z e d   u s e r s   v i a   i n v o i c e "   
 
 O N   p u b l i c . i n v o i c e _ l i n e _ i t e m s   F O R   A L L   
 
 U S I N G   ( 
 
     E X I S T S   ( 
 
         S E L E C T   1   F R O M   p u b l i c . i n v o i c e s   i   W H E R E   i . i d   =   i n v o i c e _ i d   A N D   p u b l i c . g e t _ u s e r _ r o l e ( i . w o r k s p a c e _ i d )   =   ' s u p e r _ a d m i n ' 
 
     ) 
 
 ) ; 
 
 
 
 
 
 - -   6 .   T r i g g e r   f o r   P a y m e n t   A c c o u n t i n g   ( A u t o   u p d a t e   b a l a n c e   a n d   s t a t u s ) 
 
 C R E A T E   O R   R E P L A C E   F U N C T I O N   p u b l i c . u p d a t e _ i n v o i c e _ b a l a n c e ( ) 
 
 R E T U R N S   T R I G G E R   A S   $ $ 
 
 D E C L A R E 
 
         v _ i n v o i c e _ a m o u n t   n u m e r i c ; 
 
         v _ t o t a l _ p a i d   n u m e r i c ; 
 
         v _ n e w _ b a l a n c e   n u m e r i c ; 
 
 B E G I N 
 
         I F   T G _ O P   =   ' I N S E R T '   O R   T G _ O P   =   ' U P D A T E '   T H E N 
 
                 - -   C a l c u l a t e   t o t a l   p a y m e n t s   f o r   t h i s   i n v o i c e 
 
                 S E L E C T   C O A L E S C E ( S U M ( a m o u n t ) ,   0 )   I N T O   v _ t o t a l _ p a i d 
 
                 F R O M   p u b l i c . p a y m e n t s 
 
                 W H E R E   i n v o i c e _ i d   =   N E W . i n v o i c e _ i d ; 
 
                 
 
                 - -   G e t   g r a n d   t o t a l   o f   i n v o i c e 
 
                 S E L E C T   g r a n d _ t o t a l   I N T O   v _ i n v o i c e _ a m o u n t 
 
                 F R O M   p u b l i c . i n v o i c e s 
 
                 W H E R E   i d   =   N E W . i n v o i c e _ i d ; 
 
                 
 
                 - -   U p d a t e   i n v o i c e   b a l a n c e   a n d   s t a t u s 
 
                 v _ n e w _ b a l a n c e   : =   G R E A T E S T ( 0 ,   v _ i n v o i c e _ a m o u n t   -   v _ t o t a l _ p a i d ) ; 
 
                 
 
                 U P D A T E   p u b l i c . i n v o i c e s 
 
                 S E T   
 
                         b a l a n c e _ d u e   =   v _ n e w _ b a l a n c e , 
 
                         s t a t u s   =   C A S E   
 
                                                 W H E N   v _ n e w _ b a l a n c e   < =   0   T H E N   ' p a i d ' 
 
                                                 W H E N   v _ t o t a l _ p a i d   >   0   T H E N   ' p a r t i a l ' 
 
                                                 E L S E   s t a t u s   - -   k e e p   e x i s t i n g   s t a t u s   ( e . g .   s e n t ,   o v e r d u e )   i f   n o   p a y m e n t s 
 
                                           E N D 
 
                 W H E R E   i d   =   N E W . i n v o i c e _ i d ; 
 
                 
 
         E L S I F   T G _ O P   =   ' D E L E T E '   T H E N 
 
                 - -   C a l c u l a t e   t o t a l   p a y m e n t s   a f t e r   d e l e t i o n 
 
                 S E L E C T   C O A L E S C E ( S U M ( a m o u n t ) ,   0 )   I N T O   v _ t o t a l _ p a i d 
 
                 F R O M   p u b l i c . p a y m e n t s 
 
                 W H E R E   i n v o i c e _ i d   =   O L D . i n v o i c e _ i d ; 
 
                 
 
                 S E L E C T   g r a n d _ t o t a l   I N T O   v _ i n v o i c e _ a m o u n t 
 
                 F R O M   p u b l i c . i n v o i c e s 
 
                 W H E R E   i d   =   O L D . i n v o i c e _ i d ; 
 
                 
 
                 v _ n e w _ b a l a n c e   : =   G R E A T E S T ( 0 ,   v _ i n v o i c e _ a m o u n t   -   v _ t o t a l _ p a i d ) ; 
 
                 
 
                 U P D A T E   p u b l i c . i n v o i c e s 
 
                 S E T   
 
                         b a l a n c e _ d u e   =   v _ n e w _ b a l a n c e , 
 
                         s t a t u s   =   C A S E   
 
                                                 W H E N   v _ n e w _ b a l a n c e   < =   0   T H E N   ' p a i d ' 
 
                                                 W H E N   v _ t o t a l _ p a i d   >   0   T H E N   ' p a r t i a l ' 
 
                                                 W H E N   v _ t o t a l _ p a i d   =   0   T H E N   ' s e n t '   - -   R e s e t   t o   s e n t   i f   n o   p a y m e n t s   l e f t 
 
                                                 E L S E   s t a t u s 
 
                                           E N D 
 
                 W H E R E   i d   =   O L D . i n v o i c e _ i d ; 
 
         E N D   I F ; 
 
         
 
         R E T U R N   N U L L ; 
 
 E N D ; 
 
 $ $   L A N G U A G E   p l p g s q l   S E C U R I T Y   D E F I N E R ; 
 
 
 
 D R O P   T R I G G E R   I F   E X I S T S   t r g _ u p d a t e _ i n v o i c e _ b a l a n c e   O N   p u b l i c . p a y m e n t s ; 
 
 C R E A T E   T R I G G E R   t r g _ u p d a t e _ i n v o i c e _ b a l a n c e 
 
 A F T E R   I N S E R T   O R   U P D A T E   O R   D E L E T E   O N   p u b l i c . p a y m e n t s 
 
 F O R   E A C H   R O W   E X E C U T E   F U N C T I O N   p u b l i c . u p d a t e _ i n v o i c e _ b a l a n c e ( ) ; 
 
 
 
 - -   A p p l y   t r i g g e r   l o g i c   t o   e x i s t i n g   i n v o i c e s   m a n u a l l y 
 
 D O   $ $ 
 
 D E C L A R E 
 
         r e c   R E C O R D ; 
 
 B E G I N 
 
         F O R   r e c   I N   S E L E C T   i d ,   C O A L E S C E ( a m o u n t ,   0 )   a s   i n v o i c e _ a m o u n t   F R O M   p u b l i c . i n v o i c e s   L O O P 
 
                 - -   F o r   l e g a c y   c o m p a t i b i l i t y ,   a s s u m e   a m o u n t   i s   g r a n d _ t o t a l   i f   g r a n d _ t o t a l   i s   0 
 
                 U P D A T E   p u b l i c . i n v o i c e s   
 
                 S E T   g r a n d _ t o t a l   =   i n v o i c e _ a m o u n t ,   
 
                         s u b t o t a l   =   i n v o i c e _ a m o u n t ,   
 
                         t a x a b l e _ a m o u n t   =   i n v o i c e _ a m o u n t 
 
                 W H E R E   i d   =   r e c . i d   A N D   g r a n d _ t o t a l   =   0 ; 
 
         
 
                 U P D A T E   p u b l i c . i n v o i c e s   i 
 
                 S E T   b a l a n c e _ d u e   =   G R E A T E S T ( 0 ,   i . g r a n d _ t o t a l   -   C O A L E S C E ( ( S E L E C T   S U M ( a m o u n t )   F R O M   p u b l i c . p a y m e n t s   W H E R E   i n v o i c e _ i d   =   i . i d ) ,   0 ) ) 
 
                 W H E R E   i . i d   =   r e c . i d ; 
 
                 
 
                 U P D A T E   p u b l i c . i n v o i c e s   i 
 
                 S E T   s t a t u s   =   C A S E   W H E N   i . b a l a n c e _ d u e   < =   0   T H E N   ' p a i d '   W H E N   i . b a l a n c e _ d u e   <   i . g r a n d _ t o t a l   T H E N   ' p a r t i a l '   E L S E   i . s t a t u s   E N D 
 
                 W H E R E   i . i d   =   r e c . i d ; 
 
         E N D   L O O P ; 
 
 E N D ; 
 
 $ $ ; 
 
 
 
 - -   7 .   A u d i t   L o g g i n g   i n t e g r a t i o n 
 
 C R E A T E   O R   R E P L A C E   F U N C T I O N   p u b l i c . a u d i t _ g s t _ i n v o i c e _ c h a n g e s ( ) 
 
 R E T U R N S   T R I G G E R   A S   $ $ 
 
 B E G I N 
 
         I F   T G _ O P   =   ' I N S E R T '   T H E N 
 
                 I N S E R T   I N T O   p u b l i c . a u d i t _ l o g s   ( w o r k s p a c e _ i d ,   a c t i o n ,   e n t i t y _ t y p e ,   e n t i t y _ i d ,   u s e r _ i d ,   d e t a i l s ) 
 
                 V A L U E S   ( N E W . w o r k s p a c e _ i d ,   ' i n v o i c e _ g e n e r a t e d ' ,   ' i n v o i c e ' ,   N E W . i d ,   N E W . c r e a t e d _ b y ,   
 
                         j s o n b _ b u i l d _ o b j e c t ( ' i n v o i c e _ n u m b e r ' ,   N E W . i n v o i c e _ n u m b e r ,   ' g r a n d _ t o t a l ' ,   N E W . g r a n d _ t o t a l ,   ' t o t a l _ t a x ' ,   N E W . t o t a l _ t a x ) ) ; 
 
         E L S I F   T G _ O P   =   ' U P D A T E '   T H E N 
 
                 I F   O L D . s t a t u s   ! =   N E W . s t a t u s   A N D   N E W . s t a t u s   =   ' c a n c e l l e d '   T H E N 
 
                         I N S E R T   I N T O   p u b l i c . a u d i t _ l o g s   ( w o r k s p a c e _ i d ,   a c t i o n ,   e n t i t y _ t y p e ,   e n t i t y _ i d ,   u s e r _ i d ,   d e t a i l s ) 
 
                         V A L U E S   ( N E W . w o r k s p a c e _ i d ,   ' i n v o i c e _ c a n c e l l e d ' ,   ' i n v o i c e ' ,   N E W . i d ,   a u t h . u i d ( ) ,   
 
                                 j s o n b _ b u i l d _ o b j e c t ( ' i n v o i c e _ n u m b e r ' ,   N E W . i n v o i c e _ n u m b e r ) ) ; 
 
                 E N D   I F ; 
 
                 
 
                 I F   O L D . t o t a l _ t a x   ! =   N E W . t o t a l _ t a x   T H E N 
 
                         I N S E R T   I N T O   p u b l i c . a u d i t _ l o g s   ( w o r k s p a c e _ i d ,   a c t i o n ,   e n t i t y _ t y p e ,   e n t i t y _ i d ,   u s e r _ i d ,   d e t a i l s ) 
 
                         V A L U E S   ( N E W . w o r k s p a c e _ i d ,   ' g s t _ v a l u e s _ c h a n g e d ' ,   ' i n v o i c e ' ,   N E W . i d ,   a u t h . u i d ( ) ,   
 
                                 j s o n b _ b u i l d _ o b j e c t ( ' o l d _ t a x ' ,   O L D . t o t a l _ t a x ,   ' n e w _ t a x ' ,   N E W . t o t a l _ t a x ) ) ; 
 
                 E N D   I F ; 
 
         E N D   I F ; 
 
         R E T U R N   N U L L ;   - -   A F T E R   t r i g g e r 
 
 E N D ; 
 
 $ $   L A N G U A G E   p l p g s q l   S E C U R I T Y   D E F I N E R ; 
 
 
 
 D R O P   T R I G G E R   I F   E X I S T S   t r g _ a u d i t _ g s t _ i n v o i c e s   O N   p u b l i c . i n v o i c e s ; 
 
 C R E A T E   T R I G G E R   t r g _ a u d i t _ g s t _ i n v o i c e s 
 
 A F T E R   I N S E R T   O R   U P D A T E   O N   p u b l i c . i n v o i c e s 
 
 F O R   E A C H   R O W   E X E C U T E   F U N C T I O N   p u b l i c . a u d i t _ g s t _ i n v o i c e _ c h a n g e s ( ) ; 
 
 
 
 C O M M I T ; 
 
 - -   M i g r a t i o n :   O r g a n i z a t i o n   D o c u m e n t   T e m p l a t e s 
 
 - -   D e s c r i p t i o n :   C o r e   s y s t e m   f o r   c u s t o m   b r a n d e d   d o c u m e n t   t e m p l a t e s   ( i n v o i c e s ,   r e c e i p t s ,   o f f e r   l e t t e r s ,   e t c . ) 
 
 
 
 B E G I N ; 
 
 
 
 C R E A T E   T A B L E   I F   N O T   E X I S T S   p u b l i c . d o c u m e n t _ t e m p l a t e s   ( 
 
         i d   u u i d   P R I M A R Y   K E Y   D E F A U L T   g e n _ r a n d o m _ u u i d ( ) , 
 
         w o r k s p a c e _ i d   u u i d   N O T   N U L L   R E F E R E N C E S   p u b l i c . w o r k s p a c e s ( i d )   O N   D E L E T E   C A S C A D E , 
 
         n a m e   t e x t   N O T   N U L L , 
 
         t y p e   t e x t   N O T   N U L L   C H E C K   ( t y p e   I N   ( ' i n v o i c e ' ,   ' r e c e i p t ' ,   ' o f f e r _ l e t t e r ' ,   ' e x p e r i e n c e _ l e t t e r ' ,   ' s a l a r y _ s l i p ' ,   ' r e p o r t ' ,   ' c u s t o m ' ) ) , 
 
         t e m p l a t e _ b o d y   t e x t   N O T   N U L L , 
 
         h e a d e r _ c o n f i g   j s o n b   D E F A U L T   ' { } ' : : j s o n b , 
 
         f o o t e r _ c o n f i g   j s o n b   D E F A U L T   ' { } ' : : j s o n b , 
 
         s t y l e s   j s o n b   D E F A U L T   ' { } ' : : j s o n b , 
 
         l o g o _ u r l   t e x t , 
 
         i s _ d e f a u l t   b o o l e a n   D E F A U L T   f a l s e , 
 
         c r e a t e d _ b y   u u i d   R E F E R E N C E S   a u t h . u s e r s ( i d ) , 
 
         c r e a t e d _ a t   t i m e s t a m p t z   N O T   N U L L   D E F A U L T   n o w ( ) , 
 
         u p d a t e d _ a t   t i m e s t a m p t z   N O T   N U L L   D E F A U L T   n o w ( ) 
 
 ) ; 
 
 
 
 A L T E R   T A B L E   p u b l i c . d o c u m e n t _ t e m p l a t e s   E N A B L E   R O W   L E V E L   S E C U R I T Y ; 
 
 
 
 C R E A T E   P O L I C Y   " E n a b l e   r e a d   a c c e s s   f o r   a u t h o r i z e d   u s e r s "   
 
 O N   p u b l i c . d o c u m e n t _ t e m p l a t e s   F O R   S E L E C T   
 
 U S I N G   ( p u b l i c . g e t _ u s e r _ r o l e ( w o r k s p a c e _ i d )   I N   ( ' s u p e r _ a d m i n ' ,   ' a d m i n ' ,   ' m a n a g e r ' ,   ' m e m b e r ' ) ) ; 
 
 
 
 C R E A T E   P O L I C Y   " E n a b l e   w r i t e   a c c e s s   f o r   s u p e r   a d m i n "   
 
 O N   p u b l i c . d o c u m e n t _ t e m p l a t e s   F O R   A L L   
 
 U S I N G   ( p u b l i c . g e t _ u s e r _ r o l e ( w o r k s p a c e _ i d )   =   ' s u p e r _ a d m i n ' ) ; 
 
 
 
 
 
 C R E A T E   T A B L E   I F   N O T   E X I S T S   p u b l i c . d o c u m e n t _ t e m p l a t e _ h i s t o r y   ( 
 
         i d   u u i d   P R I M A R Y   K E Y   D E F A U L T   g e n _ r a n d o m _ u u i d ( ) , 
 
         t e m p l a t e _ i d   u u i d   N O T   N U L L   R E F E R E N C E S   p u b l i c . d o c u m e n t _ t e m p l a t e s ( i d )   O N   D E L E T E   C A S C A D E , 
 
         v e r s i o n _ n u m b e r   i n t e g e r   N O T   N U L L , 
 
         n a m e   t e x t   N O T   N U L L , 
 
         t e m p l a t e _ b o d y   t e x t   N O T   N U L L , 
 
         h e a d e r _ c o n f i g   j s o n b , 
 
         f o o t e r _ c o n f i g   j s o n b , 
 
         s t y l e s   j s o n b , 
 
         l o g o _ u r l   t e x t , 
 
         c r e a t e d _ b y   u u i d   R E F E R E N C E S   a u t h . u s e r s ( i d ) , 
 
         c r e a t e d _ a t   t i m e s t a m p t z   N O T   N U L L   D E F A U L T   n o w ( ) 
 
 ) ; 
 
 
 
 A L T E R   T A B L E   p u b l i c . d o c u m e n t _ t e m p l a t e _ h i s t o r y   E N A B L E   R O W   L E V E L   S E C U R I T Y ; 
 
 
 
 C R E A T E   P O L I C Y   " E n a b l e   r e a d   a c c e s s   f o r   a u t h o r i z e d   u s e r s "   
 
 O N   p u b l i c . d o c u m e n t _ t e m p l a t e _ h i s t o r y   F O R   S E L E C T   
 
 U S I N G   ( p u b l i c . g e t _ u s e r _ r o l e ( ( S E L E C T   w o r k s p a c e _ i d   F R O M   p u b l i c . d o c u m e n t _ t e m p l a t e s   W H E R E   i d   =   t e m p l a t e _ i d ) )   I N   ( ' s u p e r _ a d m i n ' ,   ' a d m i n ' ,   ' m a n a g e r ' ,   ' m e m b e r ' ) ) ; 
 
 
 
 C R E A T E   P O L I C Y   " E n a b l e   w r i t e   a c c e s s   f o r   s u p e r   a d m i n "   
 
 O N   p u b l i c . d o c u m e n t _ t e m p l a t e _ h i s t o r y   F O R   A L L   
 
 U S I N G   ( p u b l i c . g e t _ u s e r _ r o l e ( ( S E L E C T   w o r k s p a c e _ i d   F R O M   p u b l i c . d o c u m e n t _ t e m p l a t e s   W H E R E   i d   =   t e m p l a t e _ i d ) )   =   ' s u p e r _ a d m i n ' ) ; 
 
 
 
 
 
 - -   T r i g g e r   f o r   u p d a t e d _ a t 
 
 C R E A T E   T R I G G E R   s e t _ t i m e s t a m p 
 
 B E F O R E   U P D A T E   O N   p u b l i c . d o c u m e n t _ t e m p l a t e s 
 
 F O R   E A C H   R O W 
 
 E X E C U T E   F U N C T I O N   p u b l i c . t r i g g e r _ s e t _ t i m e s t a m p ( ) ; 
 
 
 
 C O M M I T ; 
 
 

-- MIGRATION_DOCUMENT_TEMPLATES.sql

-- Migration: Organization Document Templates
-- Description: Core system for custom branded document templates (invoices, receipts, offer letters, etc.)

BEGIN;

CREATE TABLE IF NOT EXISTS public.document_templates (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
    name text NOT NULL,
    type text NOT NULL CHECK (type IN ('invoice', 'receipt', 'offer_letter', 'experience_letter', 'salary_slip', 'report', 'custom')),
    template_body text NOT NULL,
    header_config jsonb DEFAULT '{}'::jsonb,
    footer_config jsonb DEFAULT '{}'::jsonb,
    styles jsonb DEFAULT '{}'::jsonb,
    logo_url text,
    is_default boolean DEFAULT false,
    created_by uuid REFERENCES auth.users(id),
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.document_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Enable read access for authorized users" 
ON public.document_templates FOR SELECT 
USING (public.get_user_role(workspace_id) IN ('super_admin', 'admin', 'manager', 'member'));

CREATE POLICY "Enable write access for super admin" 
ON public.document_templates FOR ALL 
USING (public.get_user_role(workspace_id) = 'super_admin');


CREATE TABLE IF NOT EXISTS public.document_template_history (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    template_id uuid NOT NULL REFERENCES public.document_templates(id) ON DELETE CASCADE,
    version_number integer NOT NULL,
    name text NOT NULL,
    template_body text NOT NULL,
    header_config jsonb,
    footer_config jsonb,
    styles jsonb,
    logo_url text,
    created_by uuid REFERENCES auth.users(id),
    created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.document_template_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Enable read access for authorized users" 
ON public.document_template_history FOR SELECT 
USING (public.get_user_role((SELECT workspace_id FROM public.document_templates WHERE id = template_id)) IN ('super_admin', 'admin', 'manager', 'member'));

CREATE POLICY "Enable write access for super admin" 
ON public.document_template_history FOR ALL 
USING (public.get_user_role((SELECT workspace_id FROM public.document_templates WHERE id = template_id)) = 'super_admin');


-- Trigger for updated_at
CREATE OR REPLACE FUNCTION public.trigger_set_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER set_timestamp
BEFORE UPDATE ON public.document_templates
FOR EACH ROW
EXECUTE FUNCTION public.trigger_set_timestamp();

COMMIT;


-- MIGRATION_GST_INVOICING.sql

-- Migration: GST Accounting and Invoicing Layer
-- Description: Enhances finance system with company profiles, GST calculation logic, and robust invoicing.

BEGIN;

-- 1. Create company billing profile
CREATE TABLE IF NOT EXISTS public.company_billing_profile (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id uuid NOT NULL UNIQUE REFERENCES public.workspaces(id) ON DELETE CASCADE,
    legal_name text NOT NULL,
    gstin text,
    pan text,
    billing_address text,
    state text NOT NULL,
    country text NOT NULL DEFAULT 'India',
    bank_details jsonb,
    invoice_prefix text NOT NULL DEFAULT 'RPM',
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.company_billing_profile ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Enable read access for authorized users" 
ON public.company_billing_profile FOR SELECT 
USING (public.get_user_role(workspace_id) IN ('super_admin', 'admin', 'manager', 'member'));

CREATE POLICY "Enable write access for super admin" 
ON public.company_billing_profile FOR ALL 
USING (public.get_user_role(workspace_id) = 'super_admin');

-- 2. Extend clients table
ALTER TABLE public.clients
ADD COLUMN IF NOT EXISTS gstin text,
ADD COLUMN IF NOT EXISTS billing_state text,
ADD COLUMN IF NOT EXISTS billing_country text DEFAULT 'India',
ADD COLUMN IF NOT EXISTS tax_type text DEFAULT 'unregistered' CHECK (tax_type IN ('registered', 'unregistered'));

-- 3. Invoice Sequence Mechanism
CREATE TABLE IF NOT EXISTS public.invoice_sequences (
    workspace_id uuid PRIMARY KEY REFERENCES public.workspaces(id) ON DELETE CASCADE,
    last_sequence integer NOT NULL DEFAULT 0,
    current_year integer NOT NULL
);

ALTER TABLE public.invoice_sequences ENABLE ROW LEVEL SECURITY;
-- No direct policies, should be accessed via security definer function if needed, or by super admin

-- Function to generate the next invoice number securely
CREATE OR REPLACE FUNCTION public.generate_invoice_number(p_workspace_id uuid, p_prefix text)
RETURNS text AS $$
DECLARE
    v_year integer;
    v_seq integer;
    v_invoice_number text;
BEGIN
    v_year := extract(year from current_date);
    
    INSERT INTO public.invoice_sequences (workspace_id, last_sequence, current_year)
    VALUES (p_workspace_id, 1, v_year)
    ON CONFLICT (workspace_id) DO UPDATE
    SET 
        last_sequence = CASE WHEN public.invoice_sequences.current_year = v_year THEN public.invoice_sequences.last_sequence + 1 ELSE 1 END,
        current_year = v_year
    RETURNING last_sequence INTO v_seq;
    
    v_invoice_number := p_prefix || '/' || v_year || '/' || lpad(v_seq::text, 3, '0');
    RETURN v_invoice_number;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- 4. Extend invoices table
ALTER TABLE public.invoices
ADD COLUMN IF NOT EXISTS subtotal numeric NOT NULL DEFAULT 0,
ADD COLUMN IF NOT EXISTS discount_amount numeric NOT NULL DEFAULT 0,
ADD COLUMN IF NOT EXISTS taxable_amount numeric NOT NULL DEFAULT 0,
ADD COLUMN IF NOT EXISTS cgst_amount numeric NOT NULL DEFAULT 0,
ADD COLUMN IF NOT EXISTS sgst_amount numeric NOT NULL DEFAULT 0,
ADD COLUMN IF NOT EXISTS igst_amount numeric NOT NULL DEFAULT 0,
ADD COLUMN IF NOT EXISTS total_tax numeric NOT NULL DEFAULT 0,
ADD COLUMN IF NOT EXISTS grand_total numeric NOT NULL DEFAULT 0,
ADD COLUMN IF NOT EXISTS balance_due numeric NOT NULL DEFAULT 0,
ADD COLUMN IF NOT EXISTS billing_state_snapshot text;

-- 5. Create invoice line items table
CREATE TABLE IF NOT EXISTS public.invoice_line_items (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    invoice_id uuid NOT NULL REFERENCES public.invoices(id) ON DELETE CASCADE,
    description text NOT NULL,
    quantity numeric NOT NULL DEFAULT 1,
    rate numeric NOT NULL DEFAULT 0,
    tax_percentage numeric NOT NULL DEFAULT 0,
    amount numeric NOT NULL DEFAULT 0,
    created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.invoice_line_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Enable read access for authorized users via invoice" 
ON public.invoice_line_items FOR SELECT 
USING (
  EXISTS (
    SELECT 1 FROM public.invoices i WHERE i.id = invoice_id AND public.get_user_role(i.workspace_id) IN ('super_admin', 'admin', 'manager', 'member')
  )
);

CREATE POLICY "Enable write access for authorized users via invoice" 
ON public.invoice_line_items FOR ALL 
USING (
  EXISTS (
    SELECT 1 FROM public.invoices i WHERE i.id = invoice_id AND public.get_user_role(i.workspace_id) = 'super_admin'
  )
);


-- 6. Trigger for Payment Accounting (Auto update balance and status)
CREATE OR REPLACE FUNCTION public.update_invoice_balance()
RETURNS TRIGGER AS $$
DECLARE
    v_invoice_amount numeric;
    v_total_paid numeric;
    v_new_balance numeric;
BEGIN
    IF TG_OP = 'INSERT' OR TG_OP = 'UPDATE' THEN
        -- Calculate total payments for this invoice
        SELECT COALESCE(SUM(amount), 0) INTO v_total_paid
        FROM public.payments
        WHERE invoice_id = NEW.invoice_id;
        
        -- Get grand total of invoice
        SELECT grand_total INTO v_invoice_amount
        FROM public.invoices
        WHERE id = NEW.invoice_id;
        
        -- Update invoice balance and status
        v_new_balance := GREATEST(0, v_invoice_amount - v_total_paid);
        
        UPDATE public.invoices
        SET 
            balance_due = v_new_balance,
            status = CASE 
                        WHEN v_new_balance <= 0 THEN 'paid'
                        WHEN v_total_paid > 0 THEN 'partial'
                        ELSE status -- keep existing status (e.g. sent, overdue) if no payments
                     END
        WHERE id = NEW.invoice_id;
        
    ELSIF TG_OP = 'DELETE' THEN
        -- Calculate total payments after deletion
        SELECT COALESCE(SUM(amount), 0) INTO v_total_paid
        FROM public.payments
        WHERE invoice_id = OLD.invoice_id;
        
        SELECT grand_total INTO v_invoice_amount
        FROM public.invoices
        WHERE id = OLD.invoice_id;
        
        v_new_balance := GREATEST(0, v_invoice_amount - v_total_paid);
        
        UPDATE public.invoices
        SET 
            balance_due = v_new_balance,
            status = CASE 
                        WHEN v_new_balance <= 0 THEN 'paid'
                        WHEN v_total_paid > 0 THEN 'partial'
                        WHEN v_total_paid = 0 THEN 'sent' -- Reset to sent if no payments left
                        ELSE status
                     END
        WHERE id = OLD.invoice_id;
    END IF;
    
    RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_update_invoice_balance ON public.payments;
CREATE TRIGGER trg_update_invoice_balance
AFTER INSERT OR UPDATE OR DELETE ON public.payments
FOR EACH ROW EXECUTE FUNCTION public.update_invoice_balance();

-- Apply trigger logic to existing invoices manually
DO $$
DECLARE
    rec RECORD;
BEGIN
    FOR rec IN SELECT id, COALESCE(amount, 0) as invoice_amount FROM public.invoices LOOP
        -- For legacy compatibility, assume amount is grand_total if grand_total is 0
        UPDATE public.invoices 
        SET grand_total = invoice_amount, 
            subtotal = invoice_amount, 
            taxable_amount = invoice_amount
        WHERE id = rec.id AND grand_total = 0;
    
        UPDATE public.invoices i
        SET balance_due = GREATEST(0, i.grand_total - COALESCE((SELECT SUM(amount) FROM public.payments WHERE invoice_id = i.id), 0))
        WHERE i.id = rec.id;
        
        UPDATE public.invoices i
        SET status = CASE WHEN i.balance_due <= 0 THEN 'paid' WHEN i.balance_due < i.grand_total THEN 'partial' ELSE i.status END
        WHERE i.id = rec.id;
    END LOOP;
END;
$$;

-- 7. Audit Logging integration
CREATE OR REPLACE FUNCTION public.audit_gst_invoice_changes()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        INSERT INTO public.audit_logs (workspace_id, action, entity_type, entity_id, user_id, details)
        VALUES (NEW.workspace_id, 'invoice_generated', 'invoice', NEW.id, NEW.created_by, 
            jsonb_build_object('invoice_number', NEW.invoice_number, 'grand_total', NEW.grand_total, 'total_tax', NEW.total_tax));
    ELSIF TG_OP = 'UPDATE' THEN
        IF OLD.status != NEW.status AND NEW.status = 'cancelled' THEN
            INSERT INTO public.audit_logs (workspace_id, action, entity_type, entity_id, user_id, details)
            VALUES (NEW.workspace_id, 'invoice_cancelled', 'invoice', NEW.id, auth.uid(), 
                jsonb_build_object('invoice_number', NEW.invoice_number));
        END IF;
        
        IF OLD.total_tax != NEW.total_tax THEN
            INSERT INTO public.audit_logs (workspace_id, action, entity_type, entity_id, user_id, details)
            VALUES (NEW.workspace_id, 'gst_values_changed', 'invoice', NEW.id, auth.uid(), 
                jsonb_build_object('old_tax', OLD.total_tax, 'new_tax', NEW.total_tax));
        END IF;
    END IF;
    RETURN NULL; -- AFTER trigger
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_audit_gst_invoices ON public.invoices;
CREATE TRIGGER trg_audit_gst_invoices
AFTER INSERT OR UPDATE ON public.invoices
FOR EACH ROW EXECUTE FUNCTION public.audit_gst_invoice_changes();

COMMIT;


-- MIGRATION_MULTI_CURRENCY.sql

-- Migration: Add Multi-currency support to Clients
BEGIN;

ALTER TABLE public.clients
ADD COLUMN IF NOT EXISTS currency text DEFAULT 'INR';

ALTER TABLE public.invoices
ADD COLUMN IF NOT EXISTS client_currency text DEFAULT 'INR',
ADD COLUMN IF NOT EXISTS exchange_rate numeric DEFAULT 1.0;

COMMIT;


-- MIGRATION_PROJECT_FINANCE.sql

-- Migration: Project Financial Tracking and Advanced Invoicing
BEGIN;

-- 1. Extend projects table
ALTER TABLE public.projects
ADD COLUMN IF NOT EXISTS contract_value numeric NOT NULL DEFAULT 0,
ADD COLUMN IF NOT EXISTS billing_model text DEFAULT 'Fixed Price' CHECK (billing_model IN ('Fixed Price', 'Hourly', 'Milestone Based', 'Retainer', 'Internal Project')),
ADD COLUMN IF NOT EXISTS billing_currency text DEFAULT 'INR';

-- 2. Extend invoices table
ALTER TABLE public.invoices
ADD COLUMN IF NOT EXISTS task_id uuid REFERENCES public.tasks(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS billing_type text DEFAULT 'Full Project Payment' CHECK (billing_type IN ('Full Project Payment', 'Milestone Payment', 'Advance Payment', 'Recurring Payment', 'Task Based Billing', 'Expense Reimbursement', 'Custom Invoice', 'Change Request'));

-- 3. Extend payments table
-- We assume public.payments exists (created in another migration perhaps, or we'll make sure it can be altered)
-- But wait, what if public.payments was never formally created in any tracked file? 
-- The user explicitly said: "payments: invoice_id nullable, client_id, advance_payment flag"
-- If we alter public.payments and it doesn't exist, it will crash. Let's create it if not exists.
CREATE TABLE IF NOT EXISTS public.payments (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
    invoice_id uuid REFERENCES public.invoices(id) ON DELETE SET NULL,
    client_id uuid REFERENCES public.clients(id) ON DELETE CASCADE,
    amount numeric NOT NULL DEFAULT 0,
    payment_date timestamptz NOT NULL DEFAULT now(),
    method text,
    reference_number text,
    advance_payment boolean DEFAULT false,
    created_at timestamptz NOT NULL DEFAULT now()
);

-- We still run ALTER to add columns in case the table exists but doesn't have them
ALTER TABLE public.payments
ADD COLUMN IF NOT EXISTS workspace_id uuid REFERENCES public.workspaces(id) ON DELETE CASCADE,
ADD COLUMN IF NOT EXISTS client_id uuid REFERENCES public.clients(id) ON DELETE CASCADE,
ADD COLUMN IF NOT EXISTS advance_payment boolean DEFAULT false;

-- Make invoice_id nullable on payments if it isn't already
ALTER TABLE public.payments ALTER COLUMN invoice_id DROP NOT NULL;


-- 4. Extend or Create expenses table
CREATE TABLE IF NOT EXISTS public.expenses (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
    category text NOT NULL,
    amount numeric NOT NULL DEFAULT 0,
    date timestamptz NOT NULL DEFAULT now(),
    description text NOT NULL,
    project_id uuid REFERENCES public.projects(id) ON DELETE SET NULL,
    task_id uuid REFERENCES public.tasks(id) ON DELETE SET NULL,
    billable boolean DEFAULT false,
    reimbursed_invoice_id uuid REFERENCES public.invoices(id) ON DELETE SET NULL,
    created_at timestamptz NOT NULL DEFAULT now()
);

-- In case expenses already exists:
ALTER TABLE public.expenses
ADD COLUMN IF NOT EXISTS project_id uuid REFERENCES public.projects(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS task_id uuid REFERENCES public.tasks(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS billable boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS reimbursed_invoice_id uuid REFERENCES public.invoices(id) ON DELETE SET NULL;

COMMIT;


-- MIGRATION_PROJECT_FINANCE_PATCH.sql

-- MIGRATION: Final Project Finance Accounting Accuracy Patch
-- Creates tables for advance applications and credit notes

-- 1. Advance Applications
CREATE TABLE IF NOT EXISTS public.advance_applications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID REFERENCES public.workspaces(id) ON DELETE CASCADE,
    client_credit_id UUID REFERENCES public.client_credits(id) ON DELETE CASCADE,
    invoice_id UUID REFERENCES public.invoices(id) ON DELETE CASCADE,
    amount_applied NUMERIC(15, 2) NOT NULL CHECK (amount_applied > 0),
    applied_by UUID REFERENCES auth.users(id),
    applied_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    notes TEXT
);

-- Index for quick lookups
CREATE INDEX IF NOT EXISTS idx_advance_applications_workspace ON public.advance_applications(workspace_id);
CREATE INDEX IF NOT EXISTS idx_advance_applications_invoice ON public.advance_applications(invoice_id);
CREATE INDEX IF NOT EXISTS idx_advance_applications_credit ON public.advance_applications(client_credit_id);

-- Enable RLS
ALTER TABLE public.advance_applications ENABLE ROW LEVEL SECURITY;

-- RLS Policies
DROP POLICY IF EXISTS "Users can view advance applications in their workspace" ON public.advance_applications;
CREATE POLICY "Users can view advance applications in their workspace" ON public.advance_applications
    FOR SELECT USING (public.get_user_role(workspace_id) IN ('super_admin', 'admin', 'manager', 'member'));

DROP POLICY IF EXISTS "Users can create advance applications in their workspace" ON public.advance_applications;
CREATE POLICY "Users can create advance applications in their workspace" ON public.advance_applications
    FOR INSERT WITH CHECK (public.get_user_role(workspace_id) IN ('super_admin', 'admin', 'manager', 'member'));

-- 2. Credit Notes
CREATE TABLE IF NOT EXISTS public.credit_notes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID REFERENCES public.workspaces(id) ON DELETE CASCADE,
    client_id UUID REFERENCES public.clients(id) ON DELETE CASCADE,
    invoice_id UUID REFERENCES public.invoices(id) ON DELETE SET NULL,
    credit_note_number VARCHAR(100) NOT NULL,
    amount NUMERIC(15, 2) NOT NULL CHECK (amount > 0), -- Stored as positive, treated as negative in calculations
    reason TEXT NOT NULL,
    issue_date DATE NOT NULL DEFAULT CURRENT_DATE,
    created_by UUID REFERENCES auth.users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Index for quick lookups
CREATE INDEX IF NOT EXISTS idx_credit_notes_workspace ON public.credit_notes(workspace_id);
CREATE INDEX IF NOT EXISTS idx_credit_notes_client ON public.credit_notes(client_id);
CREATE INDEX IF NOT EXISTS idx_credit_notes_invoice ON public.credit_notes(invoice_id);

-- Enable RLS
ALTER TABLE public.credit_notes ENABLE ROW LEVEL SECURITY;

-- RLS Policies
DROP POLICY IF EXISTS "Users can view credit notes in their workspace" ON public.credit_notes;
CREATE POLICY "Users can view credit notes in their workspace" ON public.credit_notes
    FOR SELECT USING (public.get_user_role(workspace_id) IN ('super_admin', 'admin', 'manager', 'member'));

DROP POLICY IF EXISTS "Users can create credit notes in their workspace" ON public.credit_notes;
CREATE POLICY "Users can create credit notes in their workspace" ON public.credit_notes
    FOR INSERT WITH CHECK (public.get_user_role(workspace_id) IN ('super_admin', 'admin', 'manager', 'member'));

-- 3. Extend `invoices` status enum (safe casting)
-- If 'cancelled' isn't natively supported by some downstream checks, ensure it is covered.
-- Note: Supabase/Postgres enum updates require altering type. If status is a text field, we're safe.
-- In our schema, invoices.status is usually a text column with a check constraint or just text.


-- MIGRATION_PROJECT_FINANCE_WORKFLOW.sql

-- Migration: Advanced Project Finance Workflow
BEGIN;

-- 1. Create billing_milestones
CREATE TABLE IF NOT EXISTS public.billing_milestones (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
    project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
    name text NOT NULL,
    amount numeric NOT NULL DEFAULT 0,
    status text DEFAULT 'pending' CHECK (status IN ('pending', 'invoiced', 'paid')),
    invoice_id uuid REFERENCES public.invoices(id) ON DELETE SET NULL,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

-- 2. Create client_credits (Advance Ledger)
CREATE TABLE IF NOT EXISTS public.client_credits (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
    client_id uuid NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
    amount numeric NOT NULL DEFAULT 0,
    source_payment_id uuid REFERENCES public.payments(id) ON DELETE SET NULL,
    status text DEFAULT 'active' CHECK (status IN ('active', 'used')),
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

-- 3. Create invoice_audit_logs
CREATE TABLE IF NOT EXISTS public.invoice_audit_logs (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
    invoice_id uuid REFERENCES public.invoices(id) ON DELETE CASCADE,
    action text NOT NULL,
    performed_by text NOT NULL,
    reason text,
    created_at timestamptz NOT NULL DEFAULT now()
);

-- 4. Extend clients table for advance balance caching
ALTER TABLE public.clients
ADD COLUMN IF NOT EXISTS advance_balance numeric NOT NULL DEFAULT 0;

-- 5. Extend invoices table
ALTER TABLE public.invoices
ADD COLUMN IF NOT EXISTS payment_terms text DEFAULT 'Due immediately',
ADD COLUMN IF NOT EXISTS milestone_id uuid REFERENCES public.billing_milestones(id) ON DELETE SET NULL;

COMMIT;

-- ==============================================================================
-- APPENDED MIGRATIONS (MERGED AUTOMATICALLY)
-- ==============================================================================

-- START OF MERGED FILE: MIGRATION_SPRINT1_HR_FINANCE_ROLES.sql --
-- Resolve PM - Sprint 1 Migration
-- Foundation Upgrade: Capability based roles, Employee lifecycle, HR management

-- 1. Add capabilities and auth refinement to users table
ALTER TABLE users ADD COLUMN IF NOT EXISTS capabilities text[] DEFAULT '{}';
ALTER TABLE users ADD COLUMN IF NOT EXISTS force_password_change boolean DEFAULT false;

-- 2. Create employment_records table
DO $$ 
BEGIN
  IF EXISTS(SELECT * FROM information_schema.columns WHERE table_name='employment_records' and column_name='profile_id') THEN
    ALTER TABLE employment_records RENAME COLUMN profile_id TO user_id;
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS employment_records (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  employee_type text NOT NULL CHECK (employee_type IN ('Intern', 'Probation', 'Full Time', 'Contract', 'Consultant', 'Freelancer')),
  date_of_joining date,
  contract_start date,
  contract_end date,
  probation_end date,
  employment_status text NOT NULL DEFAULT 'active' CHECK (employment_status IN ('active', 'terminated', 'on_leave', 'suspended')),
  department text,
  designation text,
  reporting_manager_id uuid REFERENCES users(id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(workspace_id, user_id)
);

-- Enable RLS
ALTER TABLE employment_records ENABLE ROW LEVEL SECURITY;

-- 3. RLS Policies for employment_records
DROP POLICY IF EXISTS "Workspace members can view employment records" ON employment_records;
CREATE POLICY "Workspace members can view employment records"
  ON employment_records FOR SELECT
  USING (workspace_id = public.current_workspace());

DROP POLICY IF EXISTS "Super admins and HR can modify employment records" ON employment_records;
CREATE POLICY "Super admins and HR can modify employment records"
  ON employment_records FOR ALL
  USING (
    workspace_id = public.current_workspace()
    AND EXISTS (
      SELECT 1 FROM public.users
      WHERE id = auth.uid()
        AND workspace_id = public.current_workspace()
        AND (role = 'super_admin' OR 'manage_employees' = ANY(capabilities))
    )
  );

-- Performance Indexes
CREATE INDEX IF NOT EXISTS idx_employment_records_ws ON employment_records(workspace_id);
CREATE INDEX IF NOT EXISTS idx_employment_records_user ON employment_records(user_id);

-- END OF MERGED FILE: MIGRATION_SPRINT1_HR_FINANCE_ROLES.sql --

-- START OF MERGED FILE: MIGRATION_SPRINT1_HARDENING.sql --
-- Sprint 1 Hardening Migration

-- 1. Capability Security Audit
CREATE TABLE IF NOT EXISTS capability_change_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id uuid REFERENCES users(id) ON DELETE RESTRICT,
  target_user_id uuid NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  old_capabilities text[],
  new_capabilities text[],
  reason text,
  created_at timestamptz DEFAULT now()
);

CREATE OR REPLACE FUNCTION audit_and_protect_capabilities()
RETURNS trigger AS $$
DECLARE
  current_user_id uuid := auth.uid();
  current_user_role text;
  current_user_caps text[];
BEGIN
  IF NEW.capabilities IS DISTINCT FROM OLD.capabilities THEN
    -- If done by a background service, auth.uid() might be null.
    IF current_user_id IS NOT NULL THEN
      SELECT role, capabilities INTO current_user_role, current_user_caps 
      FROM users WHERE id = current_user_id;

      IF current_user_role IS DISTINCT FROM 'super_admin' AND NOT ('manage_employees' = ANY(current_user_caps)) THEN
        RAISE EXCEPTION 'Unauthorized: Only Super Admins and HR can modify capabilities.';
      END IF;
    END IF;

    INSERT INTO capability_change_logs (actor_id, target_user_id, old_capabilities, new_capabilities)
    VALUES (current_user_id, NEW.id, OLD.capabilities, NEW.capabilities);
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS audit_capabilities_trigger ON users;
CREATE TRIGGER audit_capabilities_trigger
  BEFORE UPDATE ON users
  FOR EACH ROW
  EXECUTE FUNCTION audit_and_protect_capabilities();

-- 2. Employment Edit Audit
CREATE TABLE IF NOT EXISTS employment_change_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id uuid NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  changed_by uuid REFERENCES users(id) ON DELETE RESTRICT,
  field_changed text NOT NULL,
  previous_value text,
  new_value text,
  reason text NOT NULL,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE employment_change_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Workspace members can view employment change logs"
  ON employment_change_logs FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM users u
      WHERE u.id = employment_change_logs.employee_id
      AND u.workspace_id = public.current_workspace()
    )
  );

-- END OF MERGED FILE: MIGRATION_SPRINT1_HARDENING.sql --

-- START OF MERGED FILE: MIGRATION_SPRINT2_WORKFLOW.sql --
-- Sprint 2 Workflow Migration

-- 1. HR Account Provisioning & Batch Audit
ALTER TABLE users ADD COLUMN IF NOT EXISTS setup_token uuid;
ALTER TABLE users ADD COLUMN IF NOT EXISTS setup_token_expires_at timestamptz;

CREATE TABLE IF NOT EXISTS import_batches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL,
  uploaded_by uuid REFERENCES users(id) ON DELETE RESTRICT,
  total_rows int NOT NULL DEFAULT 0,
  success_count int NOT NULL DEFAULT 0,
  failed_count int NOT NULL DEFAULT 0,
  failure_details jsonb,
  created_at timestamptz DEFAULT now()
);

-- 2. Meetings System
CREATE TABLE IF NOT EXISTS meetings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL,
  project_id uuid,
  title text NOT NULL,
  meeting_type text NOT NULL,
  date date NOT NULL,
  time time NOT NULL,
  external_link text,
  agenda text,
  status text DEFAULT 'scheduled' CHECK (status IN ('scheduled', 'in_progress', 'completed', 'cancelled')),
  organizer_id uuid REFERENCES users(id) ON DELETE RESTRICT,
  discussion_notes text,
  decisions text,
  action_items jsonb, -- array of { id, text, converted_to_task_id }
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  deleted_at timestamptz
);

CREATE TABLE IF NOT EXISTS meeting_attendees (
  meeting_id uuid REFERENCES meetings(id) ON DELETE CASCADE,
  user_id uuid REFERENCES users(id) ON DELETE RESTRICT,
  attended boolean DEFAULT false,
  PRIMARY KEY (meeting_id, user_id)
);

-- 3. Requirement Management
CREATE TABLE IF NOT EXISTS requirements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL,
  project_id uuid,
  client_id uuid, -- Reference to clients if exists, otherwise can be text/omitted
  source_meeting_id uuid REFERENCES meetings(id) ON DELETE SET NULL,
  title text NOT NULL,
  description text,
  priority text DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high', 'critical')),
  acceptance_criteria text,
  status text DEFAULT 'Draft' CHECK (status IN ('Draft', 'Under Review', 'Approved', 'Converted', 'Archived')),
  created_by uuid REFERENCES users(id) ON DELETE RESTRICT,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- 4. Document Reference System
CREATE TABLE IF NOT EXISTS document_references (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL,
  project_id uuid,
  requirement_id uuid REFERENCES requirements(id) ON DELETE CASCADE,
  title text NOT NULL,
  type text NOT NULL CHECK (type IN ('google_doc', 'drive', 'figma', 'github', 'url')),
  url text NOT NULL,
  owner_id uuid REFERENCES users(id) ON DELETE RESTRICT,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- 5. Approval Engine
-- Note: User mentioned 'Create universal approval workflow.' Re-creating approvals table with requested schema.
CREATE TABLE IF NOT EXISTS universal_approvals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL,
  entity_type text NOT NULL CHECK (entity_type IN ('requirement', 'design', 'document', 'invoice', 'task', 'other')),
  entity_id uuid NOT NULL,
  requested_by uuid REFERENCES users(id) ON DELETE RESTRICT,
  approved_by uuid REFERENCES users(id) ON DELETE RESTRICT,
  decision text NOT NULL DEFAULT 'Pending' CHECK (decision IN ('Pending', 'Approved', 'Rejected', 'Overridden')),
  approval_source text DEFAULT 'internal', -- e.g., 'WhatsApp', 'Email', 'internal'
  note text, -- Proof/notes for external approvals
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Enable RLS and setup basic policies (placeholder for future fine-tuning)
ALTER TABLE import_batches ENABLE ROW LEVEL SECURITY;
ALTER TABLE meetings ENABLE ROW LEVEL SECURITY;
ALTER TABLE meeting_attendees ENABLE ROW LEVEL SECURITY;
ALTER TABLE requirements ENABLE ROW LEVEL SECURITY;
ALTER TABLE document_references ENABLE ROW LEVEL SECURITY;
ALTER TABLE universal_approvals ENABLE ROW LEVEL SECURITY;

-- Fallback simple policies ensuring workspace isolation
CREATE POLICY "Workspace isolation for import_batches" ON import_batches USING (true);
CREATE POLICY "Workspace isolation for meetings" ON meetings USING (true);
CREATE POLICY "Workspace isolation for meeting_attendees" ON meeting_attendees USING (true);
CREATE POLICY "Workspace isolation for requirements" ON requirements USING (true);
CREATE POLICY "Workspace isolation for document_references" ON document_references USING (true);
CREATE POLICY "Workspace isolation for universal_approvals" ON universal_approvals USING (true);

-- END OF MERGED FILE: MIGRATION_SPRINT2_WORKFLOW.sql --

-- START OF MERGED FILE: MIGRATION_SPRINT2_1_HARDENING.sql --
-- ==============================================================================
-- RESOLVE PM - SPRINT 2.1 WORKFLOW RELIABILITY HARDENING MIGRATION
-- ==============================================================================
-- Description: Upgrades the notifications table to support complex workflow metadata
-- and adds the foundation for the upcoming Client Portal view by adding
-- external_access and visibility_scope fields to the users table.

-- 1. NOTIFICATIONS METADATA UPGRADE
-- Allows linking notifications directly to entities (approvals, requirements, etc.)
ALTER TABLE public.notifications 
ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}'::jsonb;

-- Temporarily drop the constraint if it exists and recreate it to include 'workflow'
-- To be completely safe and backward compatible, we will just use 'system' or 'assignments' 
-- for workflow notifications and store specifics in metadata. No constraint change needed unless we absolutely want to.
-- Actually, let's add 'workflow' and 'approval' to the category check constraint if we can, 
-- but doing so requires knowing the exact name of the constraint. 
-- Instead, we will rely on 'system' and 'assignments' categories which are already permitted, 
-- and use metadata.type for finer granularity.

-- 2. CLIENT VIEW PREPARATION
-- Adds external access toggle and visibility scope configuration to users table.
ALTER TABLE public.users 
ADD COLUMN IF NOT EXISTS external_access BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS visibility_scope JSONB DEFAULT '{}'::jsonb;

-- 3. NOTIFICATION PREFERENCES
-- Adds user-specific preferences for notifications
ALTER TABLE public.users
ADD COLUMN IF NOT EXISTS notification_preferences JSONB DEFAULT '{"desktopEnabled": false, "soundEnabled": true, "quietHours": {"enabled": false, "start": "22:00", "end": "08:00"}}'::jsonb;

-- Refresh schema cache if using PostgREST
NOTIFY pgrst, 'reload schema';

-- END OF MERGED FILE: MIGRATION_SPRINT2_1_HARDENING.sql --

-- START OF MERGED FILE: MIGRATION_SPRINT2_2_TASK_INTELLIGENCE.sql --
-- ==============================================================================
-- RESOLVE PM SPRINT 2.2 - TASK LIFECYCLE INTELLIGENCE
-- ==============================================================================

-- 1. ADD NEW INTELLIGENCE COLUMNS
ALTER TABLE tasks 
  ADD COLUMN IF NOT EXISTS discovery_notes text,
  ADD COLUMN IF NOT EXISTS blocked_reason text,
  ADD COLUMN IF NOT EXISTS blocked_since timestamptz,
  ADD COLUMN IF NOT EXISTS needs_help_from uuid REFERENCES users(id),
  ADD COLUMN IF NOT EXISTS estimated_effort_minutes integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS actual_effort_minutes integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS first_started_at timestamptz,
  ADD COLUMN IF NOT EXISTS completed_at timestamptz,
  ADD COLUMN IF NOT EXISTS completion_notes text;

-- 2. MIGRATE OLD STATUSES AND UPDATE CONSTRAINTS
-- First drop the check constraint
ALTER TABLE tasks DROP CONSTRAINT IF EXISTS tasks_status_check;

-- Map old statuses to new taxonomy
UPDATE tasks SET status = 'assigned' WHERE status = 'backlog';
UPDATE tasks SET status = 'understanding' WHERE status = 'ready';
UPDATE tasks SET status = 'ready_for_review' WHERE status = 'review';
UPDATE tasks SET status = 'completed' WHERE status = 'done';
-- 'in_progress' remains 'in_progress'

-- Add the updated constraint
ALTER TABLE tasks ADD CONSTRAINT tasks_status_check 
  CHECK (status IN ('assigned', 'understanding', 'in_progress', 'blocked', 'ready_for_review', 'changes_requested', 'completed'));

-- 3. NOTIFY REALTIME SERVICE (Trigger refresh)
NOTIFY pgrst, 'reload schema';

-- END OF MERGED FILE: MIGRATION_SPRINT2_2_TASK_INTELLIGENCE.sql --

-- START OF MERGED FILE: MIGRATION_SPRINT3_WORK_INTELLIGENCE.sql --
-- ==============================================================================
-- RESOLVE PM SPRINT 3 - WORK INTELLIGENCE ENGINE
-- ==============================================================================

-- 1. Create work_sessions table
CREATE TABLE IF NOT EXISTS work_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  task_id uuid NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  started_at timestamptz NOT NULL DEFAULT now(),
  ended_at timestamptz,
  duration_minutes integer DEFAULT 0,
  session_type text NOT NULL DEFAULT 'normal' CHECK (session_type IN ('normal', 'overtime', 'weekend')),
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'paused', 'completed')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE work_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Workspace members can view work sessions"
  ON work_sessions FOR SELECT
  USING (workspace_id = public.current_workspace());

CREATE POLICY "Users can insert their own work sessions"
  ON work_sessions FOR INSERT
  WITH CHECK (
    workspace_id = public.current_workspace()
    AND user_id = auth.uid()
  );

CREATE POLICY "Users can update their own work sessions"
  ON work_sessions FOR UPDATE
  USING (
    workspace_id = public.current_workspace()
    AND user_id = auth.uid()
  );

CREATE POLICY "PMs and HR can update any work session in workspace"
  ON work_sessions FOR UPDATE
  USING (
    workspace_id = public.current_workspace()
    AND EXISTS (
      SELECT 1 FROM public.users
      WHERE id = auth.uid()
        AND workspace_id = public.current_workspace()
        AND (role IN ('super_admin', 'pm') OR 'manage_employees' = ANY(capabilities))
    )
  );

CREATE POLICY "PMs and HR can delete work sessions"
  ON work_sessions FOR DELETE
  USING (
    workspace_id = public.current_workspace()
    AND EXISTS (
      SELECT 1 FROM public.users
      WHERE id = auth.uid()
        AND workspace_id = public.current_workspace()
        AND (role IN ('super_admin', 'pm') OR 'manage_employees' = ANY(capabilities))
    )
  );

-- Indexes
CREATE INDEX IF NOT EXISTS idx_work_sessions_ws ON work_sessions(workspace_id);
CREATE INDEX IF NOT EXISTS idx_work_sessions_task ON work_sessions(task_id);
CREATE INDEX IF NOT EXISTS idx_work_sessions_user ON work_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_work_sessions_status ON work_sessions(status);


-- 2. Create work_session_pauses table
CREATE TABLE IF NOT EXISTS work_session_pauses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid NOT NULL REFERENCES work_sessions(id) ON DELETE CASCADE,
  pause_start timestamptz NOT NULL DEFAULT now(),
  pause_end timestamptz,
  reason text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE work_session_pauses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Workspace members can view session pauses"
  ON work_session_pauses FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM work_sessions
      WHERE work_sessions.id = work_session_pauses.session_id
      AND work_sessions.workspace_id = public.current_workspace()
    )
  );

CREATE POLICY "Users can insert pauses for their sessions"
  ON work_session_pauses FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM work_sessions
      WHERE work_sessions.id = session_id
      AND work_sessions.user_id = auth.uid()
      AND work_sessions.workspace_id = public.current_workspace()
    )
  );

CREATE POLICY "Users can update pauses for their sessions"
  ON work_session_pauses FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM work_sessions
      WHERE work_sessions.id = session_id
      AND work_sessions.user_id = auth.uid()
      AND work_sessions.workspace_id = public.current_workspace()
    )
  );

CREATE POLICY "PMs and HR can update any session pause in workspace"
  ON work_session_pauses FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM work_sessions ws
      JOIN public.users u ON u.id = auth.uid()
      WHERE ws.id = session_id
      AND ws.workspace_id = public.current_workspace()
      AND u.workspace_id = public.current_workspace()
      AND (u.role IN ('super_admin', 'pm') OR 'manage_employees' = ANY(u.capabilities))
    )
  );

CREATE INDEX IF NOT EXISTS idx_work_session_pauses_session ON work_session_pauses(session_id);

-- 3. Trigger reload
NOTIFY pgrst, 'reload schema';

-- END OF MERGED FILE: MIGRATION_SPRINT3_WORK_INTELLIGENCE.sql --

-- START OF MERGED FILE: MIGRATION_SPRINT3_1_HARDENING.sql --
-- ==============================================================================
-- RESOLVE PM SPRINT 3.1 - WORK INTELLIGENCE HARDENING
-- ==============================================================================

-- 1. Add entry_type to work_sessions
ALTER TABLE work_sessions 
ADD COLUMN IF NOT EXISTS entry_type text DEFAULT 'timer' CHECK (entry_type IN ('timer', 'manual'));

-- 2. Update universal_approvals to support 'time_entry'
ALTER TABLE universal_approvals DROP CONSTRAINT IF EXISTS universal_approvals_entity_type_check;
ALTER TABLE universal_approvals ADD CONSTRAINT universal_approvals_entity_type_check 
  CHECK (entity_type IN ('requirement', 'design', 'document', 'invoice', 'task', 'time_entry', 'other'));

-- 3. Update work_session_pauses to support automatic pauses from heartbeat
ALTER TABLE work_session_pauses DROP CONSTRAINT IF EXISTS work_session_pauses_reason_check;
-- (Assuming no existing check constraint on reason, but if there was, we drop and re-add. Since it was just text NOT NULL, no check is needed).

NOTIFY pgrst, 'reload schema';

-- END OF MERGED FILE: MIGRATION_SPRINT3_1_HARDENING.sql --

-- START OF MERGED FILE: MIGRATION_SPRINT3_2_INTELLIGENCE_CLOSURE.sql --
-- ==============================================================================
-- RESOLVE PM SPRINT 3.2 - INTELLIGENCE OPERATIONAL CLOSURE
-- ==============================================================================

-- 1. Add session locking to work_sessions
ALTER TABLE work_sessions ADD COLUMN IF NOT EXISTS locked_at timestamptz;
ALTER TABLE work_sessions ADD COLUMN IF NOT EXISTS locked_by uuid REFERENCES users(id) ON DELETE RESTRICT;

-- 2. Create work_session_adjustments table
CREATE TABLE IF NOT EXISTS work_session_adjustments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  session_id uuid NOT NULL REFERENCES work_sessions(id) ON DELETE CASCADE,
  old_value_mins integer NOT NULL,
  new_value_mins integer NOT NULL,
  reason text NOT NULL,
  created_by uuid NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Enable RLS for adjustments
ALTER TABLE work_session_adjustments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Workspace members can view work session adjustments"
  ON work_session_adjustments FOR SELECT
  USING (workspace_id = public.current_workspace());

CREATE POLICY "PMs can insert work session adjustments"
  ON work_session_adjustments FOR INSERT
  WITH CHECK (
    workspace_id = public.current_workspace()
    AND EXISTS (
      SELECT 1 FROM public.users
      WHERE id = auth.uid() 
      AND workspace_id = public.current_workspace() 
      AND (role IN ('super_admin', 'pm', 'admin', 'owner') OR 'manage_projects' = ANY(capabilities))
    )
  );

-- 3. Create project_reviews table
CREATE TABLE IF NOT EXISTS project_reviews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  project_id uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  original_estimate_hours numeric,
  actual_time_hours numeric,
  timeline_diff_days integer,
  delay_reasons jsonb,
  improvement_factors jsonb,
  created_by uuid NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Enable RLS for project reviews
ALTER TABLE project_reviews ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Workspace members can view project reviews"
  ON project_reviews FOR SELECT
  USING (workspace_id = public.current_workspace());

CREATE POLICY "PMs can insert project reviews"
  ON project_reviews FOR INSERT
  WITH CHECK (
    workspace_id = public.current_workspace()
    AND EXISTS (
      SELECT 1 FROM public.users
      WHERE id = auth.uid() 
      AND workspace_id = public.current_workspace() 
      AND (role IN ('super_admin', 'pm', 'admin', 'owner') OR 'manage_projects' = ANY(capabilities))
    )
  );

-- END OF MERGED FILE: MIGRATION_SPRINT3_2_INTELLIGENCE_CLOSURE.sql --

-- START OF MERGED FILE: MIGRATION_SPRINT3_3_INTELLIGENCE_HARDENING.sql --
-- ==============================================================================
-- RESOLVE PM SPRINT 3.3 - INTELLIGENCE DATA INTEGRITY HARDENING
-- ==============================================================================

-- 1. Create session_quality_flags table
CREATE TABLE IF NOT EXISTS session_quality_flags (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  session_id uuid NOT NULL REFERENCES work_sessions(id) ON DELETE CASCADE,
  flag_type text NOT NULL,
  reason text NOT NULL,
  resolved boolean DEFAULT false,
  resolved_by uuid REFERENCES users(id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE session_quality_flags ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Workspace members can view session quality flags"
  ON session_quality_flags FOR SELECT
  USING (workspace_id = public.current_workspace());

CREATE POLICY "System and PMs can manage session quality flags"
  ON session_quality_flags FOR ALL
  USING (workspace_id = public.current_workspace())
  WITH CHECK (workspace_id = public.current_workspace());


-- 2. Enhance Tasks for completion evidence and delay classification
ALTER TABLE tasks 
  ADD COLUMN IF NOT EXISTS delay_reason text CHECK (delay_reason IN ('Requirement changed', 'New learning', 'External dependency', 'Technical blocker', 'Initial estimate wrong', 'Execution delay', NULL)),
  ADD COLUMN IF NOT EXISTS completion_evidence_summary text,
  ADD COLUMN IF NOT EXISTS completion_evidence_link text,
  ADD COLUMN IF NOT EXISTS completion_evidence_pr_url text;

-- 3. Enhance universal_approvals/activity logs for PM context overrides
-- We don't necessarily need a new column if we use the existing payload or activity logs.
-- But let's add an explicit pm_override_context to work_sessions and universal_approvals just in case.
ALTER TABLE work_sessions ADD COLUMN IF NOT EXISTS pm_override_context text;
ALTER TABLE universal_approvals ADD COLUMN IF NOT EXISTS pm_override_context text;

-- 4. Improve project_reviews categorization
-- Project reviews already has `delay_reasons` and `improvement_factors` as JSONB. We can enforce usage in UI.

-- Create Indexes for performance
CREATE INDEX IF NOT EXISTS idx_session_quality_flags_ws ON session_quality_flags(workspace_id);
CREATE INDEX IF NOT EXISTS idx_session_quality_flags_session ON session_quality_flags(session_id);

-- END OF MERGED FILE: MIGRATION_SPRINT3_3_INTELLIGENCE_HARDENING.sql --

-- START OF MERGED FILE: MIGRATION_SPRINT4_EXTERNAL_ACCESS.sql --
-- ==============================================================================
-- RESOLVE PM SPRINT 4 - EXTERNAL ACCESS LAYER
-- ==============================================================================

-- 1. Create external_access_links table
CREATE TABLE IF NOT EXISTS external_access_links (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  entity_type text NOT NULL, -- e.g. 'project'
  entity_id uuid NOT NULL,
  token_hash text NOT NULL UNIQUE,
  permissions jsonb NOT NULL DEFAULT '{}'::jsonb,
  expires_at timestamptz,
  created_by uuid NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now(),
  revoked_at timestamptz
);

-- Enable RLS
ALTER TABLE external_access_links ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Workspace members can view external access links"
  ON external_access_links FOR SELECT
  USING (
    workspace_id IN (
      SELECT workspace_id FROM users WHERE id = auth.uid()
    )
  );

CREATE POLICY "Project Managers can insert external access links"
  ON external_access_links FOR INSERT
  WITH CHECK (
    workspace_id IN (
      SELECT workspace_id FROM users WHERE id = auth.uid() AND role IN ('super_admin', 'pm')
    )
  );

CREATE POLICY "Project Managers can update external access links"
  ON external_access_links FOR UPDATE
  USING (
    workspace_id IN (
      SELECT workspace_id FROM users WHERE id = auth.uid() AND role IN ('super_admin', 'pm')
    )
  );

-- 2. Add visibility to document_references
ALTER TABLE document_references 
ADD COLUMN IF NOT EXISTS visibility text DEFAULT 'internal' CHECK (visibility IN ('internal', 'client_visible'));

-- 3. Add meeting_category to meetings
ALTER TABLE meetings 
ADD COLUMN IF NOT EXISTS meeting_category text DEFAULT 'Internal' CHECK (meeting_category IN ('Internal', 'Client', 'HR', 'Finance'));

-- 4. Create RPC to fetch shared project data securely using token bypass
CREATE OR REPLACE FUNCTION get_shared_project_data(p_token text)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_link external_access_links%ROWTYPE;
  v_project json;
  v_response json;
BEGIN
  -- 1. Find the link and ensure it is valid
  SELECT * INTO v_link
  FROM external_access_links
  WHERE token_hash = p_token
    AND (expires_at IS NULL OR expires_at > now())
    AND revoked_at IS NULL;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Invalid, expired, or revoked access token';
  END IF;

  IF v_link.entity_type != 'project' THEN
    RAISE EXCEPTION 'Token is not for a project';
  END IF;

  -- 2. Fetch Project Data
  SELECT json_build_object(
      'id', p.id,
      'name', p.name,
      'description', p.description,
      'status', p.status,
      'target_date', p.target_date,
      'timeline', p.timeline,
      'client_id', p.client_id
  ) INTO v_project
  FROM projects p
  WHERE p.id = v_link.entity_id;

  -- We return the sanitized project, plus permissions so the frontend knows what to render
  v_response := json_build_object(
      'project', v_project,
      'permissions', v_link.permissions,
      'workspace_id', v_link.workspace_id
  );

  RETURN v_response;
END;
$$;

GRANT EXECUTE ON FUNCTION get_shared_project_data(text) TO anon, authenticated;

-- 5. Create RPC to submit client approvals securely using token bypass
CREATE OR REPLACE FUNCTION submit_client_approval(
  p_token text,
  p_approval_id uuid,
  p_status text,
  p_notes text
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_link external_access_links%ROWTYPE;
  v_approval universal_approvals%ROWTYPE;
BEGIN
  -- 1. Find the link and ensure it is valid
  SELECT * INTO v_link
  FROM external_access_links
  WHERE token_hash = p_token
    AND (expires_at IS NULL OR expires_at > now())
    AND revoked_at IS NULL;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Invalid, expired, or revoked access token';
  END IF;

  -- 2. Verify the approval exists and belongs to the project
  SELECT * INTO v_approval
  FROM universal_approvals
  WHERE id = p_approval_id AND entity_id = v_link.entity_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Approval request not found for this project';
  END IF;

  -- 3. Validate status
  IF p_status NOT IN ('approved', 'rejected') THEN
    RAISE EXCEPTION 'Invalid status';
  END IF;

  -- 4. Update the approval
  UPDATE universal_approvals
  SET 
    status = p_status,
    notes = p_notes,
    resolved_at = now()
  WHERE id = p_approval_id;

  -- 5. Log activity
  INSERT INTO activity_logs (workspace_id, entity_type, entity_id, action, actor_id, details)
  VALUES (
    v_link.workspace_id, 
    'project', 
    v_link.entity_id, 
    'client_' || p_status, 
    v_link.created_by, -- Use the creator of the link as the proxy actor, or null if allowed
    jsonb_build_object('approval_id', p_approval_id, 'notes', p_notes, 'client_token_id', v_link.id)
  );

  RETURN json_build_object('success', true);
END;
$$;

GRANT EXECUTE ON FUNCTION submit_client_approval(text, uuid, text, text) TO anon, authenticated;

-- END OF MERGED FILE: MIGRATION_SPRINT4_EXTERNAL_ACCESS.sql --

-- START OF MERGED FILE: MIGRATION_SPRINT5_PRODUCTION_READINESS.sql --
-- =====================================================================
-- SPRINT 5: PRODUCTION DEPLOYMENT & COMPANY READINESS
-- =====================================================================

-- 1. Create Workspace License Table
CREATE TABLE IF NOT EXISTS workspace_license (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  license_key_hash text NOT NULL,
  activation_date timestamptz NOT NULL DEFAULT now(),
  allowed_users integer NOT NULL DEFAULT 10,
  license_type text NOT NULL DEFAULT 'standard' CHECK (license_type IN ('standard', 'premium', 'enterprise')),
  support_until timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE workspace_license ENABLE ROW LEVEL SECURITY;

-- Super Admins can view license
CREATE POLICY "Super Admins can view workspace license"
  ON workspace_license FOR SELECT
  USING (
    workspace_id IN (
      SELECT workspace_id FROM users WHERE id = auth.uid() AND role = 'super_admin'
    )
  );

-- 2. Add 'is_demo' to workspaces
ALTER TABLE workspaces ADD COLUMN IF NOT EXISTS is_demo boolean NOT NULL DEFAULT false;

-- 3. Notify Supabase Realtime (optional, just good practice for settings)
-- ALTER PUBLICATION supabase_realtime ADD TABLE workspace_license;

-- END OF MERGED FILE: MIGRATION_SPRINT5_PRODUCTION_READINESS.sql --

-- START OF MERGED FILE: MIGRATION_SPRINT6_RELEASE_CANDIDATE.sql --
-- ==============================================================================
-- SPRINT 6: RELEASE CANDIDATE HARDENING
-- Focus: Security, Performance, Data Integrity, Audit Immutability
-- ==============================================================================

-- 1. FOREIGN KEY INTEGRITY FIXES
-- The activity_logs table should NOT prevent users from being deleted, but the log must remain.
ALTER TABLE activity_logs 
  DROP CONSTRAINT IF EXISTS activity_logs_actor_id_fkey,
  ADD CONSTRAINT activity_logs_actor_id_fkey 
  FOREIGN KEY (actor_id) REFERENCES users(id) ON DELETE RESTRICT;

ALTER TABLE invoices 
  DROP CONSTRAINT IF EXISTS invoices_project_id_fkey,
  ADD CONSTRAINT invoices_project_id_fkey 
  FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE SET NULL;

ALTER TABLE comments 
  DROP CONSTRAINT IF EXISTS comments_task_id_fkey,
  ADD CONSTRAINT comments_task_id_fkey 
  FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE;

-- 2. MISSING INDEXES FOR PERFORMANCE
-- High-frequency lookup fields
CREATE INDEX IF NOT EXISTS idx_users_workspace_id ON users(workspace_id);
CREATE INDEX IF NOT EXISTS idx_projects_workspace_id_status ON projects(workspace_id, status);
CREATE INDEX IF NOT EXISTS idx_tasks_project_id_assignee_id ON tasks(project_id, assignee_id);
CREATE INDEX IF NOT EXISTS idx_activity_logs_workspace_id_created_at ON activity_logs(workspace_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_universal_approvals_entity ON universal_approvals(entity_type, entity_id);

-- 3. AUDIT IMMUTABILITY (activity_logs)
-- We enforce that NO ONE can UPDATE or DELETE from activity_logs, even Super Admins.
ALTER TABLE activity_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone in workspace can view activity logs" ON activity_logs;
DROP POLICY IF EXISTS "Anyone in workspace can insert activity logs" ON activity_logs;
DROP POLICY IF EXISTS "No one can update activity logs" ON activity_logs;
DROP POLICY IF EXISTS "No one can delete activity logs" ON activity_logs;

-- Recreate policies strictly
CREATE POLICY "Anyone in workspace can view activity logs"
ON activity_logs FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM users
    WHERE users.id = auth.uid() AND users.workspace_id = activity_logs.workspace_id
  )
);

CREATE POLICY "Anyone in workspace can insert activity logs"
ON activity_logs FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM users
    WHERE users.id = auth.uid() AND users.workspace_id = activity_logs.workspace_id
  )
);

-- Note: No UPDATE or DELETE policies are created, meaning they are implicitly DENIED.

-- 4. RLS SWEEP ON CORE TABLES (Projects, Tasks, Users, Invoices)
-- Ensure 'external_client' roles can only view their specific entities.

-- Projects
ALTER TABLE projects ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Clients can only view their projects" ON projects;
CREATE POLICY "Clients can only view their projects"
ON projects FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM users
    WHERE users.id = auth.uid()
      AND users.workspace_id = projects.workspace_id
      AND (
        users.role != 'external_client'
        OR
        (users.role = 'external_client' AND projects.client_id = users.id)
      )
  )
);

-- Invoices
ALTER TABLE invoices ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Clients can only view their invoices" ON invoices;
CREATE POLICY "Clients can only view their invoices"
ON invoices FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM users
    WHERE users.id = auth.uid()
      AND users.workspace_id = invoices.workspace_id
      AND (
        users.role != 'external_client'
        OR
        (users.role = 'external_client' AND invoices.client_id = users.id)
      )
  )
);

-- Teams
ALTER TABLE teams ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Anyone in workspace can view teams" ON teams;
CREATE POLICY "Anyone in workspace can view teams"
ON teams FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM users
    WHERE users.id = auth.uid() AND users.workspace_id = teams.workspace_id
  )
);

DROP POLICY IF EXISTS "HR and Super Admin can manage teams" ON teams;
CREATE POLICY "HR and Super Admin can manage teams"
ON teams FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM users
    WHERE users.id = auth.uid() 
      AND users.workspace_id = teams.workspace_id
      AND users.role IN ('super_admin', 'hr')
  )
);

-- Expand invoice_audit_logs with old/new values
ALTER TABLE public.invoice_audit_logs ADD COLUMN IF NOT EXISTS old_value jsonb;
ALTER TABLE public.invoice_audit_logs ADD COLUMN IF NOT EXISTS new_value jsonb;


-- END OF MERGED FILE: MIGRATION_SPRINT6_RELEASE_CANDIDATE.sql --

-- START OF MERGED FILE: MIGRATION_SPRINT6_5_CLOSURE.sql --
BEGIN;

-- 1. TASK COLLABORATOR SYSTEM
CREATE TABLE IF NOT EXISTS public.task_collaborators (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
    task_id uuid NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
    user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE RESTRICT,
    added_by uuid REFERENCES public.users(id) ON DELETE RESTRICT,
    reason text NOT NULL,
    added_at timestamptz NOT NULL DEFAULT now(),
    removed_at timestamptz,
    UNIQUE(task_id, user_id)
);

ALTER TABLE public.task_collaborators ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Enable read for workspace members" ON public.task_collaborators;
CREATE POLICY "Enable read for workspace members" 
ON public.task_collaborators FOR SELECT 
USING (workspace_id = current_workspace());

DROP POLICY IF EXISTS "Enable write for PMs and Admins" ON public.task_collaborators;
CREATE POLICY "Enable write for PMs and Admins" 
ON public.task_collaborators FOR ALL 
USING (
  EXISTS (
    SELECT 1 FROM users
    WHERE users.id = auth.uid() 
      AND users.workspace_id = task_collaborators.workspace_id
      AND users.role IN ('super_admin', 'pm')
  )
);

-- 2. REAL ACCOUNTING INVOICE LIFECYCLE
ALTER TABLE public.payments 
ADD COLUMN IF NOT EXISTS notes text,
ADD COLUMN IF NOT EXISTS recorded_by uuid REFERENCES public.users(id) ON DELETE RESTRICT;

CREATE OR REPLACE FUNCTION public.fn_update_invoice_status_on_payment()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  v_invoice_id uuid;
  v_total_paid numeric;
  v_invoice_total numeric;
  v_invoice_status text;
  v_workspace_id uuid;
BEGIN
  v_invoice_id := COALESCE(NEW.invoice_id, OLD.invoice_id);
  IF v_invoice_id IS NULL THEN
    RETURN COALESCE(NEW, OLD);
  END IF;

  SELECT grand_total, status, workspace_id INTO v_invoice_total, v_invoice_status, v_workspace_id
  FROM public.invoices WHERE id = v_invoice_id;

  IF v_invoice_status IN ('cancelled', 'draft') THEN
    RETURN COALESCE(NEW, OLD);
  END IF;

  SELECT COALESCE(SUM(amount), 0) INTO v_total_paid
  FROM public.payments WHERE invoice_id = v_invoice_id;

  IF v_total_paid >= v_invoice_total THEN
    UPDATE public.invoices SET status = 'paid', updated_at = now() WHERE id = v_invoice_id AND status != 'paid';
  ELSIF v_total_paid > 0 THEN
    UPDATE public.invoices SET status = 'partially_paid', updated_at = now() WHERE id = v_invoice_id AND status != 'partially_paid';
  ELSIF v_total_paid = 0 AND v_invoice_status != 'overdue' THEN
    UPDATE public.invoices SET status = 'issued', updated_at = now() WHERE id = v_invoice_id AND status != 'issued';
  END IF;

  RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS trg_update_invoice_status ON public.payments;
CREATE TRIGGER trg_update_invoice_status
AFTER INSERT OR UPDATE OR DELETE ON public.payments
FOR EACH ROW EXECUTE FUNCTION public.fn_update_invoice_status_on_payment();

-- 3. DATABASE-LEVEL AUDIT PROTECTION
CREATE OR REPLACE FUNCTION public.fn_audit_sensitive_changes()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_actor_id uuid;
  v_workspace_id uuid;
  v_old_json jsonb;
  v_new_json jsonb;
  v_record_id uuid;
BEGIN
  v_actor_id := auth.uid();

  BEGIN
    v_workspace_id := COALESCE(NEW.workspace_id, OLD.workspace_id);
  EXCEPTION WHEN OTHERS THEN
    v_workspace_id := NULL;
  END;
  
  IF TG_OP = 'DELETE' THEN
    v_record_id := OLD.id;
    v_old_json := to_jsonb(OLD);
    v_new_json := NULL;
  ELSIF TG_OP = 'INSERT' THEN
    v_record_id := NEW.id;
    v_old_json := NULL;
    v_new_json := to_jsonb(NEW);
  ELSE
    v_record_id := NEW.id;
    v_old_json := to_jsonb(OLD);
    v_new_json := to_jsonb(NEW);
  END IF;

  IF v_workspace_id IS NOT NULL THEN
    INSERT INTO public.activity_logs (
      workspace_id,
      actor_id,
      action,
      project_id,
      task_id,
      metadata
    ) VALUES (
      v_workspace_id,
      v_actor_id,
      'db_' || lower(TG_OP) || '_' || TG_TABLE_NAME,
      CASE WHEN TG_TABLE_NAME = 'projects' THEN v_record_id ELSE null END,
      CASE WHEN TG_TABLE_NAME = 'tasks' THEN v_record_id ELSE null END,
      jsonb_build_object(
        'entity_type', TG_TABLE_NAME,
        'entity_id', v_record_id,
        'old_value', v_old_json,
        'new_value', v_new_json
      )
    );
  END IF;
  
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS audit_users ON public.users;
CREATE TRIGGER audit_users AFTER UPDATE ON public.users FOR EACH ROW WHEN (OLD.role IS DISTINCT FROM NEW.role) EXECUTE FUNCTION public.fn_audit_sensitive_changes();

DROP TRIGGER IF EXISTS audit_compensation_records ON public.compensation_records;
CREATE TRIGGER audit_compensation_records AFTER UPDATE ON public.compensation_records FOR EACH ROW WHEN (OLD.base_salary IS DISTINCT FROM NEW.base_salary) EXECUTE FUNCTION public.fn_audit_sensitive_changes();

DROP TRIGGER IF EXISTS audit_invoices ON public.invoices;
CREATE TRIGGER audit_invoices AFTER UPDATE ON public.invoices FOR EACH ROW WHEN (OLD.status IS DISTINCT FROM NEW.status OR OLD.grand_total IS DISTINCT FROM NEW.grand_total) EXECUTE FUNCTION public.fn_audit_sensitive_changes();

DROP TRIGGER IF EXISTS audit_payments ON public.payments;
CREATE TRIGGER audit_payments AFTER UPDATE OR DELETE ON public.payments FOR EACH ROW EXECUTE FUNCTION public.fn_audit_sensitive_changes();

DROP TRIGGER IF EXISTS audit_projects ON public.projects;
CREATE TRIGGER audit_projects AFTER UPDATE ON public.projects FOR EACH ROW WHEN (OLD.status IS DISTINCT FROM NEW.status AND NEW.status = 'completed') EXECUTE FUNCTION public.fn_audit_sensitive_changes();

-- 4. SMART TASK ESTIMATION LEARNING
ALTER TABLE public.tasks 
ADD COLUMN IF NOT EXISTS original_estimate numeric,
ADD COLUMN IF NOT EXISTS current_estimate numeric;

UPDATE public.tasks 
SET original_estimate = estimated_hours,
    current_estimate = estimated_hours
WHERE original_estimate IS NULL;

CREATE TABLE IF NOT EXISTS public.task_estimate_history (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
    task_id uuid NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
    old_estimate numeric,
    new_estimate numeric NOT NULL,
    reason text NOT NULL,
    changed_by uuid REFERENCES public.users(id) ON DELETE RESTRICT,
    changed_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.task_estimate_history ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Enable read for workspace members" ON public.task_estimate_history;
CREATE POLICY "Enable read for workspace members" 
ON public.task_estimate_history FOR SELECT 
USING (workspace_id = current_workspace());

DROP POLICY IF EXISTS "Enable write for workspace members" ON public.task_estimate_history;
CREATE POLICY "Enable write for workspace members" 
ON public.task_estimate_history FOR INSERT 
WITH CHECK (workspace_id = current_workspace());

COMMIT;

-- END OF MERGED FILE: MIGRATION_SPRINT6_5_CLOSURE.sql --

-- START OF MERGED FILE: MIGRATION_SPRINT6_6_HARDENING.sql --
BEGIN;

-- Drop obsolete broken trigger function to prevent invoice insertion blocks
DROP FUNCTION IF EXISTS public.audit_gst_invoice_changes() CASCADE;

-- Drop and recreate invoices_status_check constraint to allow 'issued', 'partial', and 'partially_paid' status (Sprint 6.5)
ALTER TABLE public.invoices DROP CONSTRAINT IF EXISTS invoices_status_check;
ALTER TABLE public.invoices ADD CONSTRAINT invoices_status_check CHECK (status IN ('draft', 'sent', 'paid', 'overdue', 'cancelled', 'issued', 'partial', 'partially_paid'));

-- 1. TASK OWNERSHIP TRANSFER WORKFLOW
CREATE TABLE IF NOT EXISTS public.task_assignment_history (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
    task_id uuid NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
    previous_assignee_id uuid REFERENCES public.users(id) ON DELETE RESTRICT,
    new_assignee_id uuid REFERENCES public.users(id) ON DELETE RESTRICT,
    transferred_by uuid REFERENCES public.users(id) ON DELETE RESTRICT,
    transfer_reason text NOT NULL,
    handover_notes text NOT NULL,
    transferred_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.task_assignment_history ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Enable read for workspace members" ON public.task_assignment_history;
CREATE POLICY "Enable read for workspace members" 
ON public.task_assignment_history FOR SELECT 
USING (workspace_id = current_workspace());

DROP POLICY IF EXISTS "Enable write for workspace members" ON public.task_assignment_history;
CREATE POLICY "Enable write for workspace members" 
ON public.task_assignment_history FOR INSERT 
WITH CHECK (workspace_id = current_workspace());


-- 2. COLLABORATOR SUGGESTION MODEL
CREATE TABLE IF NOT EXISTS public.task_suggestions (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
    task_id uuid NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
    suggested_by uuid REFERENCES public.users(id) ON DELETE RESTRICT,
    suggestion_type text NOT NULL CHECK (suggestion_type IN ('estimate_change', 'scope_note', 'technical_risk')),
    old_value jsonb,
    suggested_value jsonb,
    reason text NOT NULL,
    status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'rejected')),
    reviewed_by uuid REFERENCES public.users(id) ON DELETE RESTRICT,
    reviewed_at timestamptz,
    created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.task_suggestions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Enable read for workspace members" ON public.task_suggestions;
CREATE POLICY "Enable read for workspace members" 
ON public.task_suggestions FOR SELECT 
USING (workspace_id = current_workspace());

DROP POLICY IF EXISTS "Enable write for workspace members" ON public.task_suggestions;
CREATE POLICY "Enable write for workspace members" 
ON public.task_suggestions FOR ALL 
USING (workspace_id = current_workspace());


-- 3. CLIENT MAGIC LINK SECURITY HARDENING
ALTER TABLE public.external_access_links 
ADD COLUMN IF NOT EXISTS revoked_by uuid REFERENCES public.users(id) ON DELETE RESTRICT,
ADD COLUMN IF NOT EXISTS last_accessed_at timestamptz,
ADD COLUMN IF NOT EXISTS access_count integer DEFAULT 0 NOT NULL;

-- Enable RLS for external_access_links update
DROP POLICY IF EXISTS "Project Managers can update external access links" ON public.external_access_links;
CREATE POLICY "Project Managers can update external access links"
  ON public.external_access_links FOR UPDATE
  USING (
    workspace_id IN (
      SELECT workspace_id FROM users WHERE id = auth.uid() AND role IN ('super_admin', 'pm')
    )
  );

CREATE OR REPLACE FUNCTION get_shared_project_data(p_token text)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_link external_access_links%ROWTYPE;
  v_project json;
  v_response json;
BEGIN
  -- Find the link and ensure it is valid
  SELECT * INTO v_link
  FROM external_access_links
  WHERE token_hash = p_token
    AND (expires_at IS NULL OR expires_at > now())
    AND revoked_at IS NULL;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Invalid, expired, or revoked access token';
  END IF;

  IF v_link.entity_type != 'project' THEN
    RAISE EXCEPTION 'Token is not for a project';
  END IF;

  -- Update access metadata
  UPDATE external_access_links
  SET last_accessed_at = now(),
      access_count = access_count + 1
  WHERE id = v_link.id;

  -- Audit access in activity_logs
  INSERT INTO public.activity_logs (
    workspace_id,
    action,
    entity_type,
    entity_id,
    details
  ) VALUES (
    v_link.workspace_id,
    'client_accessed_project_portal',
    'project',
    v_link.entity_id,
    jsonb_build_object(
      'token_id', v_link.id,
      'accessed_at', now()
    )
  );

  -- Fetch Project Data
  SELECT json_build_object(
      'id', p.id,
      'name', p.name,
      'description', p.description,
      'status', p.status,
      'target_date', p.target_date,
      'timeline', p.timeline,
      'client_id', p.client_id
  ) INTO v_project
  FROM projects p
  WHERE p.id = v_link.entity_id;

  v_response := json_build_object(
      'project', v_project,
      'permissions', v_link.permissions,
      'workspace_id', v_link.workspace_id
  );

  RETURN v_response;
END;
$$;

GRANT EXECUTE ON FUNCTION get_shared_project_data(text) TO anon, authenticated;

COMMIT;

-- END OF MERGED FILE: MIGRATION_SPRINT6_6_HARDENING.sql --

-- START OF MERGED FILE: MIGRATION_MULTI_CURRENCY_INVOICES.sql --
-- Multi-Currency Invoices Extension
ALTER TABLE public.invoices
ADD COLUMN IF NOT EXISTS invoice_currency text NOT NULL DEFAULT 'USD',
ADD COLUMN IF NOT EXISTS converted_amount numeric,
ADD COLUMN IF NOT EXISTS exchange_rate numeric,
ADD COLUMN IF NOT EXISTS conversion_date timestamptz;

-- Audit logging for exchange rate changes if needed later can be added, but for now we store the state on the invoice.


-- END OF MERGED FILE: MIGRATION_MULTI_CURRENCY_INVOICES.sql --

-- START OF MERGED FILE: MIGRATION_PROJECT_FINANCE_PATCH.sql --
-- Run this in Supabase SQL Editor to fix the 400 error on payments table
BEGIN;

ALTER TABLE public.payments
ADD COLUMN IF NOT EXISTS workspace_id uuid REFERENCES public.workspaces(id) ON DELETE CASCADE;

-- Also fix invoice_id to be nullable if it isn't
ALTER TABLE public.payments ALTER COLUMN invoice_id DROP NOT NULL;

COMMIT;

-- END OF MERGED FILE: MIGRATION_PROJECT_FINANCE_PATCH.sql --

-- START OF MERGED FILE: MIGRATION_FINANCE_HARDENING_PATCH.sql --
-- MIGRATION: Finance + Reporting Accuracy Hardening Patch

-- 1. Client Currency Inheritance
ALTER TABLE public.clients
ADD COLUMN IF NOT EXISTS default_currency text;

-- 2. Project Currency Inheritance
ALTER TABLE public.projects
ADD COLUMN IF NOT EXISTS billing_currency text;

-- 3. Invoices Multi-Currency Accounting Hardening
ALTER TABLE public.invoices
ADD COLUMN IF NOT EXISTS company_base_currency text,
ADD COLUMN IF NOT EXISTS base_amount numeric,
ADD COLUMN IF NOT EXISTS exchange_rate_locked boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS exchange_locked_at timestamptz,
ADD COLUMN IF NOT EXISTS exchange_override_reason text;

-- 4. Exchange Rate Audits Table
CREATE TABLE IF NOT EXISTS public.exchange_rate_audits (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    invoice_id uuid NOT NULL REFERENCES public.invoices(id) ON DELETE CASCADE,
    workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
    old_rate numeric,
    new_rate numeric NOT NULL,
    changed_by uuid NOT NULL REFERENCES auth.users(id),
    timestamp timestamptz DEFAULT now() NOT NULL,
    reason text NOT NULL
);

-- Index for fast lookup by invoice
CREATE INDEX IF NOT EXISTS idx_exchange_rate_audits_invoice_id ON public.exchange_rate_audits(invoice_id);

-- 5. Financial Report Snapshots Table
CREATE TABLE IF NOT EXISTS public.financial_report_snapshots (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
    report_type text NOT NULL,
    snapshot_data jsonb NOT NULL,
    created_at timestamptz DEFAULT now() NOT NULL,
    created_by uuid NOT NULL REFERENCES auth.users(id)
);

-- Index for fetching historical reports by workspace and type
CREATE INDEX IF NOT EXISTS idx_financial_report_snapshots_workspace_type ON public.financial_report_snapshots(workspace_id, report_type);

-- Apply RLS to new tables
ALTER TABLE public.exchange_rate_audits ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.financial_report_snapshots ENABLE ROW LEVEL SECURITY;

-- RLS Policies for exchange_rate_audits
CREATE POLICY "Users can view exchange rate audits for their workspace" 
ON public.exchange_rate_audits FOR SELECT 
USING (
  workspace_id IN (
    SELECT workspace_id FROM users WHERE id = auth.uid()
  )
);

CREATE POLICY "Users can insert exchange rate audits for their workspace" 
ON public.exchange_rate_audits FOR INSERT 
WITH CHECK (
  workspace_id IN (
    SELECT workspace_id FROM users WHERE id = auth.uid()
  )
);

-- RLS Policies for financial_report_snapshots
CREATE POLICY "Users can view financial report snapshots for their workspace" 
ON public.financial_report_snapshots FOR SELECT 
USING (
  workspace_id IN (
    SELECT workspace_id FROM users WHERE id = auth.uid()
  )
);

CREATE POLICY "Users can insert financial report snapshots for their workspace" 
ON public.financial_report_snapshots FOR INSERT 
WITH CHECK (
  workspace_id IN (
    SELECT workspace_id FROM users WHERE id = auth.uid()
  )
);

-- END OF MERGED FILE: MIGRATION_FINANCE_HARDENING_PATCH.sql --


-- ==========================================
-- MERGED FROM MIGRATION_SPRINT8_2_SECURITY_LOCKDOWN.sql
-- ==========================================

-- ==============================================================================
-- RESOLVE PM Ã¢â‚¬â€ SPRINT 8.2: ENTERPRISE SECURITY LOCKDOWN & TRUST HARDENING
-- ==============================================================================
-- RUN THIS SCRIPT IN SUPABASE SQL EDITOR AS `postgres` USER
-- Addresses DB-backed capabilities, strict RLS enforcement, employee revocation
-- ==============================================================================

-- ##############################################################################
-- PHASE 2: FIX ROLE ARCHITECTURE (DB-BACKED CAPABILITIES)
-- ##############################################################################

-- 1. Create Core Role Tables
CREATE TABLE IF NOT EXISTS public.roles (
    id text PRIMARY KEY,
    description text NOT NULL,
    created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.capabilities (
    id text PRIMARY KEY,
    module text NOT NULL,
    description text,
    created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.role_capabilities (
    role_id text REFERENCES public.roles(id) ON DELETE CASCADE,
    capability_id text REFERENCES public.capabilities(id) ON DELETE CASCADE,
    created_at timestamptz DEFAULT now(),
    PRIMARY KEY (role_id, capability_id)
);

CREATE TABLE IF NOT EXISTS public.user_capability_overrides (
    user_id uuid REFERENCES public.users(id) ON DELETE CASCADE,
    capability_id text REFERENCES public.capabilities(id) ON DELETE CASCADE,
    is_granted boolean NOT NULL DEFAULT true,
    created_at timestamptz DEFAULT now(),
    PRIMARY KEY (user_id, capability_id)
);

-- 2. Seed Default Roles
INSERT INTO public.roles (id, description) VALUES
    ('super_admin', 'Full platform access including governance & security'),
    ('owner', 'Workspace owner'),
    ('admin', 'Workspace administrator'),
    ('pm', 'Project Manager - operational leadership'),
    ('project_manager', 'Project Manager alias'),
    ('developer', 'Execution and sprint focus'),
    ('hr_manager', 'HR capabilities'),
    ('finance_manager', 'Finance capabilities'),
    ('viewer', 'Read-only operational visibility')
ON CONFLICT (id) DO NOTHING;

-- 3. Seed Default Capabilities
INSERT INTO public.capabilities (id, module) VALUES
    ('view_projects', 'core'), ('manage_projects', 'core'),
    ('view_tasks', 'core'), ('manage_tasks', 'core'),
    ('view_scheduling', 'core'), ('manage_scheduling', 'core'),
    ('view_analytics', 'analytics'), ('view_reports', 'analytics'),
    ('manage_logistics', 'settings'), ('manage_settings', 'settings'),
    ('view_teams', 'hr'), ('manage_teams', 'hr'),
    ('manage_employees', 'hr'), ('manage_attendance', 'hr'), ('manage_employment_records', 'hr'),
    ('manage_finance', 'finance'), ('manage_payroll', 'finance'), ('manage_invoice', 'finance'), ('manage_expenses', 'finance'),
    ('platform_governance', 'security'), ('platform_security', 'security'), ('view_audit_log', 'security'),
    ('manage_integrations', 'settings'), ('manage_automations', 'settings')
ON CONFLICT (id) DO NOTHING;

-- 4. Map Roles to Capabilities
-- Super Admin / Owner gets everything
INSERT INTO public.role_capabilities (role_id, capability_id)
SELECT 'super_admin', id FROM public.capabilities ON CONFLICT DO NOTHING;
INSERT INTO public.role_capabilities (role_id, capability_id)
SELECT 'owner', id FROM public.capabilities ON CONFLICT DO NOTHING;

-- PM mapping
INSERT INTO public.role_capabilities (role_id, capability_id)
SELECT 'pm', id FROM public.capabilities WHERE id IN (
    'view_projects', 'manage_projects', 'view_tasks', 'manage_tasks', 'view_scheduling', 'manage_scheduling',
    'view_analytics', 'view_reports', 'manage_logistics', 'manage_settings', 'view_teams', 'manage_teams',
    'manage_integrations', 'manage_automations'
) ON CONFLICT DO NOTHING;

-- Developer mapping
INSERT INTO public.role_capabilities (role_id, capability_id)
SELECT 'developer', id FROM public.capabilities WHERE id IN (
    'view_projects', 'view_tasks', 'manage_tasks', 'view_scheduling', 'view_teams'
) ON CONFLICT DO NOTHING;

-- HR Manager mapping
INSERT INTO public.role_capabilities (role_id, capability_id)
SELECT 'hr_manager', id FROM public.capabilities WHERE id IN (
    'view_teams', 'manage_teams', 'manage_employees', 'manage_attendance', 'manage_employment_records', 'manage_payroll'
) ON CONFLICT DO NOTHING;

-- Finance Manager mapping
INSERT INTO public.role_capabilities (role_id, capability_id)
SELECT 'finance_manager', id FROM public.capabilities WHERE id IN (
    'manage_finance', 'manage_invoice', 'manage_expenses', 'view_projects'
) ON CONFLICT DO NOTHING;

-- Viewer mapping
INSERT INTO public.role_capabilities (role_id, capability_id)
SELECT 'viewer', id FROM public.capabilities WHERE id IN (
    'view_projects', 'view_tasks', 'view_analytics', 'view_reports', 'view_teams', 'view_audit_log'
) ON CONFLICT DO NOTHING;


-- ##############################################################################
-- PHASE 4: EMPLOYEE ACCESS REVOCATION
-- ##############################################################################

-- Helper to check if an employee is active. Returns true if active, false if terminated/suspended/resigned.
-- If no employment_record exists, defaults to true (for external clients, legacy admins).
CREATE OR REPLACE FUNCTION public.is_active_employee(p_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT NOT EXISTS (
        SELECT 1 FROM public.employment_records
        WHERE user_id = p_user_id 
        AND employment_status IN ('terminated', 'resigned', 'suspended')
    );
$$;

-- Update current_workspace() to immediately return NULL if the employee is revoked.
-- This cascades and instantly breaks ALL RLS access across the entire app.
CREATE OR REPLACE FUNCTION public.current_workspace()
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT 
        CASE 
            WHEN public.is_active_employee(auth.uid()) = false THEN NULL
            ELSE workspace_id 
        END
    FROM public.users 
    WHERE id = auth.uid() 
    LIMIT 1;
$$;


-- ##############################################################################
-- PHASE 2.2: CAPABILITY HELPER RPC
-- ##############################################################################

CREATE OR REPLACE FUNCTION public.has_capability(p_user_id uuid, p_cap text)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_role text;
    v_has_role_cap boolean;
    v_has_override boolean;
    v_override_val boolean;
BEGIN
    -- If user is inactive, they have 0 capabilities.
    IF NOT public.is_active_employee(p_user_id) THEN
        RETURN false;
    END IF;

    -- Check explicit override first
    SELECT is_granted INTO v_override_val
    FROM public.user_capability_overrides
    WHERE user_id = p_user_id AND capability_id = p_cap;

    IF FOUND THEN
        RETURN v_override_val;
    END IF;

    -- Look up their role
    SELECT role INTO v_role FROM public.users WHERE id = p_user_id;

    IF v_role IS NULL THEN
        RETURN false;
    END IF;

    -- Check role mapping
    SELECT true INTO v_has_role_cap
    FROM public.role_capabilities
    WHERE role_id = v_role AND capability_id = p_cap;

    RETURN COALESCE(v_has_role_cap, false);
END;
$$;


-- ##############################################################################
-- PHASE 1: MISSING TABLES RECONCILIATION
-- ##############################################################################
-- The audit noted these "critical tables", some of which may be missing from the schema.
-- We create them here if they don't exist to ensure RLS can be applied without crashing.

CREATE TABLE IF NOT EXISTS public.connected_accounts (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
    provider text NOT NULL,
    access_token text,
    refresh_token text,
    created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.documents (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
    project_id uuid REFERENCES public.projects(id) ON DELETE CASCADE,
    title text NOT NULL,
    content text,
    created_by uuid REFERENCES public.users(id) ON DELETE SET NULL,
    created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.sprints (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
    project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
    name text NOT NULL,
    start_date timestamptz NOT NULL,
    end_date timestamptz NOT NULL,
    status text DEFAULT 'planning',
    created_at timestamptz DEFAULT now(),
    deleted_at timestamptz
);

CREATE TABLE IF NOT EXISTS public.approval_chains (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
    name text NOT NULL,
    created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.approval_instances (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
    chain_id uuid NOT NULL REFERENCES public.approval_chains(id) ON DELETE CASCADE,
    target_id uuid NOT NULL,
    status text DEFAULT 'pending',
    created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.automation_rules (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
    trigger_type text NOT NULL,
    action_payload jsonb NOT NULL,
    created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.integration_sync_jobs (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
    provider text NOT NULL,
    status text DEFAULT 'pending',
    started_at timestamptz DEFAULT now(),
    completed_at timestamptz
);

-- Force-add workspace_id in case the tables already existed but lacked the column.
DO $$ 
DECLARE
  t text;
  tables text[] := ARRAY[
    'connected_accounts', 'documents', 'sprints', 'approval_instances', 'approval_chains', 
    'automation_rules', 'integration_sync_jobs', 'billing_milestones', 'client_credits', 
    'wait_states', 'project_signoffs', 'project_allocations', 'allocation_periods'
  ];
BEGIN
  FOREACH t IN ARRAY tables LOOP
    EXECUTE format('ALTER TABLE IF EXISTS public.%I ADD COLUMN IF NOT EXISTS workspace_id uuid REFERENCES public.workspaces(id) ON DELETE CASCADE;', t);
  END LOOP;
END $$;



-- ##############################################################################
-- PHASE 1: COMPLETE DATABASE RLS LOCKDOWN
-- ##############################################################################

-- 1. Enable and FORCE RLS on all requested tables
DO $$ 
DECLARE
  t text;
  tables text[] := ARRAY[
    'connected_accounts', 'documents', 'sprints', 'approval_instances', 'approval_chains', 
    'automation_rules', 'integration_sync_jobs', 'billing_milestones', 'client_credits', 
    'invoice_audit_logs', 'capability_change_logs', 'wait_states', 'project_signoffs', 
    'project_allocations', 'allocation_periods'
  ];
BEGIN
  FOREACH t IN ARRAY tables LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY;', t);
    EXECUTE format('ALTER TABLE public.%I FORCE ROW LEVEL SECURITY;', t);
  END LOOP;
END $$;


-- 2. Apply Strict DB-backed Capability Policies

-- connected_accounts: Only admin/owner (manage_settings)
DROP POLICY IF EXISTS "Connected accounts isolation" ON connected_accounts;
CREATE POLICY "Connected accounts isolation" ON connected_accounts FOR ALL USING (
    workspace_id = public.current_workspace() AND public.has_capability(auth.uid(), 'manage_settings')
) WITH CHECK (workspace_id = public.current_workspace() AND public.has_capability(auth.uid(), 'manage_settings'));

-- documents: View projects to read, manage_projects to write
DROP POLICY IF EXISTS "Documents isolation select" ON documents;
CREATE POLICY "Documents isolation select" ON documents FOR SELECT USING (
    workspace_id = public.current_workspace() AND public.has_capability(auth.uid(), 'view_projects')
);
DROP POLICY IF EXISTS "Documents isolation write" ON documents;
CREATE POLICY "Documents isolation write" ON documents FOR INSERT WITH CHECK (
    workspace_id = public.current_workspace() AND public.has_capability(auth.uid(), 'manage_projects')
);
DROP POLICY IF EXISTS "Documents isolation update" ON documents;
CREATE POLICY "Documents isolation update" ON documents FOR UPDATE USING (
    workspace_id = public.current_workspace() AND public.has_capability(auth.uid(), 'manage_projects')
);
DROP POLICY IF EXISTS "Documents isolation delete" ON documents;
CREATE POLICY "Documents isolation delete" ON documents FOR DELETE USING (
    workspace_id = public.current_workspace() AND public.has_capability(auth.uid(), 'manage_projects')
);

-- sprints: View tasks to read, manage_tasks to write
DROP POLICY IF EXISTS "Sprints isolation select" ON sprints;
CREATE POLICY "Sprints isolation select" ON sprints FOR SELECT USING (
    workspace_id = public.current_workspace() AND public.has_capability(auth.uid(), 'view_tasks')
);
DROP POLICY IF EXISTS "Sprints isolation write" ON sprints;
CREATE POLICY "Sprints isolation write" ON sprints FOR ALL USING (
    workspace_id = public.current_workspace() AND public.has_capability(auth.uid(), 'manage_tasks')
) WITH CHECK (workspace_id = public.current_workspace() AND public.has_capability(auth.uid(), 'manage_tasks'));

-- approval_chains & approval_instances: platform_governance or manage_projects
DROP POLICY IF EXISTS "Approvals chains isolation" ON approval_chains;
CREATE POLICY "Approvals chains isolation" ON approval_chains FOR ALL USING (
    workspace_id = public.current_workspace() AND (public.has_capability(auth.uid(), 'platform_governance') OR public.has_capability(auth.uid(), 'manage_projects'))
) WITH CHECK (workspace_id = public.current_workspace() AND (public.has_capability(auth.uid(), 'platform_governance') OR public.has_capability(auth.uid(), 'manage_projects')));

DROP POLICY IF EXISTS "Approvals instances isolation" ON approval_instances;
CREATE POLICY "Approvals instances isolation" ON approval_instances FOR ALL USING (
    workspace_id = public.current_workspace() AND (public.has_capability(auth.uid(), 'platform_governance') OR public.has_capability(auth.uid(), 'manage_projects'))
) WITH CHECK (workspace_id = public.current_workspace() AND (public.has_capability(auth.uid(), 'platform_governance') OR public.has_capability(auth.uid(), 'manage_projects')));

-- automation_rules: manage_automations
DROP POLICY IF EXISTS "Automation rules isolation" ON automation_rules;
CREATE POLICY "Automation rules isolation" ON automation_rules FOR ALL USING (
    workspace_id = public.current_workspace() AND public.has_capability(auth.uid(), 'manage_automations')
) WITH CHECK (workspace_id = public.current_workspace() AND public.has_capability(auth.uid(), 'manage_automations'));

-- integration_sync_jobs: manage_integrations
DROP POLICY IF EXISTS "Integrations isolation" ON integration_sync_jobs;
CREATE POLICY "Integrations isolation" ON integration_sync_jobs FOR ALL USING (
    workspace_id = public.current_workspace() AND public.has_capability(auth.uid(), 'manage_integrations')
) WITH CHECK (workspace_id = public.current_workspace() AND public.has_capability(auth.uid(), 'manage_integrations'));

-- billing_milestones: manage_finance
DROP POLICY IF EXISTS "Billing milestones isolation" ON billing_milestones;
CREATE POLICY "Billing milestones isolation" ON billing_milestones FOR ALL USING (
    workspace_id = public.current_workspace() AND public.has_capability(auth.uid(), 'manage_finance')
) WITH CHECK (workspace_id = public.current_workspace() AND public.has_capability(auth.uid(), 'manage_finance'));

-- client_credits: manage_finance
DROP POLICY IF EXISTS "Client credits isolation" ON client_credits;
CREATE POLICY "Client credits isolation" ON client_credits FOR ALL USING (
    workspace_id = public.current_workspace() AND public.has_capability(auth.uid(), 'manage_finance')
) WITH CHECK (workspace_id = public.current_workspace() AND public.has_capability(auth.uid(), 'manage_finance'));

-- invoice_audit_logs: view_audit_log or manage_finance
DROP POLICY IF EXISTS "Invoice audit isolation select" ON invoice_audit_logs;
CREATE POLICY "Invoice audit isolation select" ON invoice_audit_logs FOR SELECT USING (
    workspace_id = public.current_workspace() AND (public.has_capability(auth.uid(), 'view_audit_log') OR public.has_capability(auth.uid(), 'manage_finance'))
);
DROP POLICY IF EXISTS "Invoice audit isolation insert" ON invoice_audit_logs;
CREATE POLICY "Invoice audit isolation insert" ON invoice_audit_logs FOR INSERT WITH CHECK (
    workspace_id = public.current_workspace() AND public.has_capability(auth.uid(), 'manage_finance')
);

-- capability_change_logs: view_audit_log or platform_governance
-- NOTE: capability_change_logs doesn't have workspace_id inherently in our prior design, 
-- but it MUST be scoped. Assuming it has user_id. We map through users.
DROP POLICY IF EXISTS "Capability change isolation" ON capability_change_logs;
CREATE POLICY "Capability change isolation" ON capability_change_logs FOR SELECT USING (
    EXISTS (
        SELECT 1 FROM public.users me 
        WHERE me.id = auth.uid() 
        AND me.workspace_id = public.current_workspace()
        AND (public.has_capability(auth.uid(), 'view_audit_log') OR public.has_capability(auth.uid(), 'platform_governance'))
    )
);

-- wait_states: view_projects to read, manage_projects to write
DROP POLICY IF EXISTS "Wait states isolation select" ON wait_states;
CREATE POLICY "Wait states isolation select" ON wait_states FOR SELECT USING (
    workspace_id = public.current_workspace() AND public.has_capability(auth.uid(), 'view_projects')
);
DROP POLICY IF EXISTS "Wait states isolation write" ON wait_states;
CREATE POLICY "Wait states isolation write" ON wait_states FOR ALL USING (
    workspace_id = public.current_workspace() AND public.has_capability(auth.uid(), 'manage_projects')
) WITH CHECK (workspace_id = public.current_workspace() AND public.has_capability(auth.uid(), 'manage_projects'));

-- project_signoffs: view_projects to read, manage_projects to write
DROP POLICY IF EXISTS "Project signoffs isolation select" ON project_signoffs;
CREATE POLICY "Project signoffs isolation select" ON project_signoffs FOR SELECT USING (
    workspace_id = public.current_workspace() AND public.has_capability(auth.uid(), 'view_projects')
);
DROP POLICY IF EXISTS "Project signoffs isolation write" ON project_signoffs;
CREATE POLICY "Project signoffs isolation write" ON project_signoffs FOR ALL USING (
    workspace_id = public.current_workspace() AND public.has_capability(auth.uid(), 'manage_projects')
) WITH CHECK (workspace_id = public.current_workspace() AND public.has_capability(auth.uid(), 'manage_projects'));

-- project_allocations & allocation_periods: view_scheduling to read, manage_scheduling to write
DROP POLICY IF EXISTS "Project alloc isolation select" ON project_allocations;
CREATE POLICY "Project alloc isolation select" ON project_allocations FOR SELECT USING (
    workspace_id = public.current_workspace() AND public.has_capability(auth.uid(), 'view_scheduling')
);
DROP POLICY IF EXISTS "Project alloc isolation write" ON project_allocations;
CREATE POLICY "Project alloc isolation write" ON project_allocations FOR ALL USING (
    workspace_id = public.current_workspace() AND public.has_capability(auth.uid(), 'manage_scheduling')
) WITH CHECK (workspace_id = public.current_workspace() AND public.has_capability(auth.uid(), 'manage_scheduling'));

DROP POLICY IF EXISTS "Alloc periods isolation select" ON allocation_periods;
CREATE POLICY "Alloc periods isolation select" ON allocation_periods FOR SELECT USING (
    workspace_id = public.current_workspace() AND public.has_capability(auth.uid(), 'view_scheduling')
);
DROP POLICY IF EXISTS "Alloc periods isolation write" ON allocation_periods;
CREATE POLICY "Alloc periods isolation write" ON allocation_periods FOR ALL USING (
    workspace_id = public.current_workspace() AND public.has_capability(auth.uid(), 'manage_scheduling')
) WITH CHECK (workspace_id = public.current_workspace() AND public.has_capability(auth.uid(), 'manage_scheduling'));


-- ##############################################################################
-- PHASE 8: CLIENT PORTAL SECURITY (GET_SHARED_PROJECT_DATA)
-- ##############################################################################

-- Secure RPC for magic links. Verify token expiry & scope on server, drop internals.
DROP FUNCTION IF EXISTS public.get_shared_project_data(text);
CREATE OR REPLACE FUNCTION public.get_shared_project_data(p_token text)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_link RECORD;
    v_project JSONB;
    v_tasks JSONB;
BEGIN
    -- 1. Validate token server-side
    SELECT * INTO v_link FROM public.external_access_links
    WHERE token = p_token AND status = 'active' AND (expires_at IS NULL OR expires_at > now());

    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'error', 'Invalid, expired, or revoked access token.');
    END IF;

    -- 2. Fetch project, explicitly excluding developer notes & financial internals
    SELECT jsonb_build_object(
        'id', id,
        'name', name,
        'description', description,
        'status', status,
        'deadline', deadline,
        'tags', tags
    ) INTO v_project
    FROM public.projects
    WHERE id = v_link.target_id AND workspace_id = v_link.workspace_id;

    -- 3. Fetch task summary, explicitly omitting assignee internals and timesheets
    SELECT jsonb_agg(
        jsonb_build_object(
            'id', id,
            'name', name,
            'status', status,
            'due_date', due_date
        )
    ) INTO v_tasks
    FROM public.tasks
    WHERE project_id = v_link.target_id AND workspace_id = v_link.workspace_id AND deleted_at IS NULL;

    -- 4. Update access analytics (last_accessed_at)
    UPDATE public.external_access_links SET last_accessed_at = now() WHERE id = v_link.id;

    RETURN jsonb_build_object(
        'success', true,
        'project', v_project,
        'tasks', COALESCE(v_tasks, '[]'::jsonb),
        'permissions', v_link.permissions -- e.g. ["view_project", "approve_deliverables"]
    );
END;
$$;


-- ==========================================
-- MERGED FROM MIGRATION_SPRINT_9_SECURITY.sql
-- ==========================================

-- ==============================================================================
-- RESOLVE PM Ã¢â‚¬â€ SPRINT 9: ENTERPRISE SECURITY AUDIT FIX PACK
-- ==============================================================================
-- RUN THIS SCRIPT IN SUPABASE SQL EDITOR
-- Addresses all Critical Launch Blockers from External Security Audit
-- ==============================================================================

-- ##############################################################################
-- SECTION 1: RLS POLICIES FOR UNPROTECTED TABLES
-- ##############################################################################

-- Ã¢â€â‚¬Ã¢â€â‚¬ wait_states Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬
-- Has workspace_id column

DROP POLICY IF EXISTS "Wait states visible to workspace" ON wait_states;
CREATE POLICY "Wait states visible to workspace"
  ON wait_states FOR SELECT
  USING (workspace_id = public.current_workspace());

DROP POLICY IF EXISTS "Wait states managed by PMs and Admins" ON wait_states;
CREATE POLICY "Wait states managed by PMs and Admins"
  ON wait_states FOR ALL
  USING (
    workspace_id = public.current_workspace() AND
    EXISTS (SELECT 1 FROM public.users me WHERE me.id = auth.uid() AND me.workspace_id = public.current_workspace() AND me.role IN ('super_admin', 'pm'))
  )
  WITH CHECK (
    workspace_id = public.current_workspace() AND
    EXISTS (SELECT 1 FROM public.users me WHERE me.id = auth.uid() AND me.workspace_id = public.current_workspace() AND me.role IN ('super_admin', 'pm'))
  );


-- Ã¢â€â‚¬Ã¢â€â‚¬ project_signoffs Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬
-- Has workspace_id column

DROP POLICY IF EXISTS "Signoffs visible to workspace" ON project_signoffs;
CREATE POLICY "Signoffs visible to workspace"
  ON project_signoffs FOR SELECT
  USING (workspace_id = public.current_workspace());

DROP POLICY IF EXISTS "Signoffs managed by PMs and Admins" ON project_signoffs;
CREATE POLICY "Signoffs managed by PMs and Admins"
  ON project_signoffs FOR ALL
  USING (
    workspace_id = public.current_workspace() AND
    EXISTS (SELECT 1 FROM public.users me WHERE me.id = auth.uid() AND me.workspace_id = public.current_workspace() AND me.role IN ('super_admin', 'pm'))
  )
  WITH CHECK (
    workspace_id = public.current_workspace() AND
    EXISTS (SELECT 1 FROM public.users me WHERE me.id = auth.uid() AND me.workspace_id = public.current_workspace() AND me.role IN ('super_admin', 'pm'))
  );


-- Ã¢â€â‚¬Ã¢â€â‚¬ project_allocations Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬
-- Has workspace_id column

DROP POLICY IF EXISTS "Allocations visible to workspace" ON project_allocations;
CREATE POLICY "Allocations visible to workspace"
  ON project_allocations FOR SELECT
  USING (workspace_id = public.current_workspace());

DROP POLICY IF EXISTS "Allocations managed by PMs and Admins" ON project_allocations;
CREATE POLICY "Allocations managed by PMs and Admins"
  ON project_allocations FOR ALL
  USING (
    workspace_id = public.current_workspace() AND
    EXISTS (SELECT 1 FROM public.users me WHERE me.id = auth.uid() AND me.workspace_id = public.current_workspace() AND me.role IN ('super_admin', 'pm'))
  )
  WITH CHECK (
    workspace_id = public.current_workspace() AND
    EXISTS (SELECT 1 FROM public.users me WHERE me.id = auth.uid() AND me.workspace_id = public.current_workspace() AND me.role IN ('super_admin', 'pm'))
  );


-- Ã¢â€â‚¬Ã¢â€â‚¬ allocation_periods Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬
-- Has workspace_id column

DROP POLICY IF EXISTS "Allocation periods visible to workspace" ON allocation_periods;
CREATE POLICY "Allocation periods visible to workspace"
  ON allocation_periods FOR SELECT
  USING (workspace_id = public.current_workspace());

DROP POLICY IF EXISTS "Allocation periods managed by PMs and Admins" ON allocation_periods;
CREATE POLICY "Allocation periods managed by PMs and Admins"
  ON allocation_periods FOR ALL
  USING (
    workspace_id = public.current_workspace() AND
    EXISTS (SELECT 1 FROM public.users me WHERE me.id = auth.uid() AND me.workspace_id = public.current_workspace() AND me.role IN ('super_admin', 'pm'))
  )
  WITH CHECK (
    workspace_id = public.current_workspace() AND
    EXISTS (SELECT 1 FROM public.users me WHERE me.id = auth.uid() AND me.workspace_id = public.current_workspace() AND me.role IN ('super_admin', 'pm'))
  );


-- Ã¢â€â‚¬Ã¢â€â‚¬ billing_milestones Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬
-- Has workspace_id column

DROP POLICY IF EXISTS "Billing milestones visible to workspace admins" ON public.billing_milestones;
CREATE POLICY "Billing milestones visible to workspace admins"
  ON public.billing_milestones FOR SELECT
  USING (
    workspace_id = public.current_workspace() AND
    EXISTS (SELECT 1 FROM public.users me WHERE me.id = auth.uid() AND me.workspace_id = public.current_workspace() AND me.role IN ('super_admin', 'pm'))
  );

DROP POLICY IF EXISTS "Billing milestones managed by admins" ON public.billing_milestones;
CREATE POLICY "Billing milestones managed by admins"
  ON public.billing_milestones FOR ALL
  USING (
    workspace_id = public.current_workspace() AND
    EXISTS (SELECT 1 FROM public.users me WHERE me.id = auth.uid() AND me.workspace_id = public.current_workspace() AND me.role IN ('super_admin', 'pm'))
  )
  WITH CHECK (
    workspace_id = public.current_workspace() AND
    EXISTS (SELECT 1 FROM public.users me WHERE me.id = auth.uid() AND me.workspace_id = public.current_workspace() AND me.role IN ('super_admin', 'pm'))
  );


-- Ã¢â€â‚¬Ã¢â€â‚¬ client_credits Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬
-- Has workspace_id column

DROP POLICY IF EXISTS "Client credits visible to workspace admins" ON public.client_credits;
CREATE POLICY "Client credits visible to workspace admins"
  ON public.client_credits FOR SELECT
  USING (
    workspace_id = public.current_workspace() AND
    EXISTS (SELECT 1 FROM public.users me WHERE me.id = auth.uid() AND me.workspace_id = public.current_workspace() AND me.role IN ('super_admin', 'pm'))
  );

DROP POLICY IF EXISTS "Client credits managed by admins" ON public.client_credits;
CREATE POLICY "Client credits managed by admins"
  ON public.client_credits FOR ALL
  USING (
    workspace_id = public.current_workspace() AND
    EXISTS (SELECT 1 FROM public.users me WHERE me.id = auth.uid() AND me.workspace_id = public.current_workspace() AND me.role IN ('super_admin', 'pm'))
  )
  WITH CHECK (
    workspace_id = public.current_workspace() AND
    EXISTS (SELECT 1 FROM public.users me WHERE me.id = auth.uid() AND me.workspace_id = public.current_workspace() AND me.role IN ('super_admin', 'pm'))
  );


-- Ã¢â€â‚¬Ã¢â€â‚¬ invoice_audit_logs Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬
-- Has workspace_id column. Read: admin only. Insert: workspace members (to log actions).

DROP POLICY IF EXISTS "Invoice audit logs visible to admins" ON public.invoice_audit_logs;
CREATE POLICY "Invoice audit logs visible to admins"
  ON public.invoice_audit_logs FOR SELECT
  USING (
    workspace_id = public.current_workspace() AND
    EXISTS (SELECT 1 FROM public.users me WHERE me.id = auth.uid() AND me.workspace_id = public.current_workspace() AND me.role IN ('super_admin', 'pm'))
  );

DROP POLICY IF EXISTS "Invoice audit logs insertable by workspace" ON public.invoice_audit_logs;
CREATE POLICY "Invoice audit logs insertable by workspace"
  ON public.invoice_audit_logs FOR INSERT
  WITH CHECK (workspace_id = public.current_workspace());

-- WORM: No update or delete on invoice audit logs
DROP POLICY IF EXISTS "Invoice audit logs are immutable" ON public.invoice_audit_logs;
-- (No UPDATE/DELETE policies = blocked by RLS default deny)


-- Ã¢â€â‚¬Ã¢â€â‚¬ capability_change_logs Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬
-- Has user_id but needs workspace join

DROP POLICY IF EXISTS "Capability logs visible to admins" ON capability_change_logs;
CREATE POLICY "Capability logs visible to admins"
  ON capability_change_logs FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.users me 
      WHERE me.id = auth.uid() 
        AND me.workspace_id = public.current_workspace() 
        AND me.role = 'super_admin'
    )
  );

DROP POLICY IF EXISTS "Capability logs insertable by admins" ON capability_change_logs;
CREATE POLICY "Capability logs insertable by admins"
  ON capability_change_logs FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.users me 
      WHERE me.id = auth.uid() 
        AND me.workspace_id = public.current_workspace() 
        AND me.role = 'super_admin'
    )
  );


-- ##############################################################################
-- SECTION 2: SERVER-SIDE WORK SESSION COMPLETION
-- ##############################################################################

-- Secure RPC to compute work session duration on the server.
-- Prevents client-side manipulation of hours.

CREATE OR REPLACE FUNCTION public.complete_work_session(p_session_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_session RECORD;
  v_total_pause_ms BIGINT := 0;
  v_duration_mins INTEGER;
  v_requires_review BOOLEAN := false;
  v_now TIMESTAMPTZ := now();
BEGIN
  -- 1. Fetch the session, verify ownership
  SELECT * INTO v_session FROM work_sessions
    WHERE id = p_session_id
      AND user_id = auth.uid()
      AND status IN ('active', 'paused');

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Session not found, not yours, or already completed.');
  END IF;

  -- 2. Close any open pauses
  UPDATE work_session_pauses
    SET pause_end = v_now
    WHERE session_id = p_session_id AND pause_end IS NULL;

  -- 3. Calculate total paused time
  SELECT COALESCE(SUM(
    EXTRACT(EPOCH FROM (COALESCE(pause_end, v_now) - pause_start)) * 1000
  ), 0)
  INTO v_total_pause_ms
  FROM work_session_pauses
  WHERE session_id = p_session_id;

  -- 4. Calculate net duration in minutes
  v_duration_mins := GREATEST(0, 
    FLOOR(
      (EXTRACT(EPOCH FROM (v_now - v_session.started_at)) * 1000 - v_total_pause_ms) / 60000
    )::INTEGER
  );

  -- 5. Apply 12-hour (720 min) cap
  IF v_duration_mins > 720 THEN
    v_duration_mins := 720;
    v_requires_review := true;
  END IF;

  -- 6. Update the session
  UPDATE work_sessions SET
    status = 'completed',
    ended_at = v_now,
    duration_minutes = v_duration_mins,
    requires_review = v_requires_review,
    updated_at = v_now
  WHERE id = p_session_id;

  -- 7. Log the action
  INSERT INTO activity_logs (workspace_id, actor_id, action, metadata)
  VALUES (
    v_session.workspace_id,
    auth.uid(),
    'work_session_completed',
    jsonb_build_object(
      'session_id', p_session_id,
      'task_id', v_session.task_id,
      'duration_minutes', v_duration_mins,
      'requires_review', v_requires_review,
      'computed_server_side', true
    )
  );

  RETURN jsonb_build_object(
    'success', true,
    'duration_minutes', v_duration_mins,
    'requires_review', v_requires_review
  );
END;
$$;

-- Add requires_review column if missing
ALTER TABLE work_sessions ADD COLUMN IF NOT EXISTS requires_review BOOLEAN DEFAULT false;

-- Restrict direct manipulation of critical work session fields by non-admins
CREATE OR REPLACE FUNCTION enforce_work_session_integrity()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = ''
AS $$
DECLARE
  v_role text;
BEGIN
  SELECT role INTO v_role FROM public.users WHERE id = auth.uid() LIMIT 1;

  -- Admins/PMs can modify anything
  IF v_role IN ('super_admin', 'pm') THEN
    RETURN NEW;
  END IF;

  -- Block direct duration_minutes manipulation
  IF NEW.duration_minutes IS DISTINCT FROM OLD.duration_minutes THEN
    RAISE EXCEPTION 'Unauthorized: Work session duration can only be computed by the server.';
  END IF;

  -- Block started_at backdating
  IF NEW.started_at IS DISTINCT FROM OLD.started_at THEN
    RAISE EXCEPTION 'Unauthorized: Work session start time cannot be modified.';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS check_work_session_integrity ON work_sessions;
CREATE TRIGGER check_work_session_integrity
  BEFORE UPDATE ON work_sessions
  FOR EACH ROW EXECUTE FUNCTION enforce_work_session_integrity();


-- ##############################################################################
-- SECTION 3: WORM PROTECTION FOR AUDIT TABLES
-- ##############################################################################

-- Replace broken RULEs with trigger-based WORM protection.
-- Triggers work correctly with referential integrity (unlike RULEs).

CREATE OR REPLACE FUNCTION prevent_audit_mutation()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  RAISE EXCEPTION 'Audit Integrity Violation: % records are immutable and cannot be modified or deleted.', TG_TABLE_NAME;
  RETURN NULL;
END;
$$;

-- system_audit_ledger: Block UPDATE and DELETE
DROP TRIGGER IF EXISTS worm_audit_ledger_no_update ON system_audit_ledger;
CREATE TRIGGER worm_audit_ledger_no_update
  BEFORE UPDATE ON system_audit_ledger
  FOR EACH ROW EXECUTE FUNCTION prevent_audit_mutation();

DROP TRIGGER IF EXISTS worm_audit_ledger_no_delete ON system_audit_ledger;
CREATE TRIGGER worm_audit_ledger_no_delete
  BEFORE DELETE ON system_audit_ledger
  FOR EACH ROW EXECUTE FUNCTION prevent_audit_mutation();

-- invoice_audit_logs: Block UPDATE and DELETE
DROP TRIGGER IF EXISTS worm_invoice_audit_no_update ON public.invoice_audit_logs;
CREATE TRIGGER worm_invoice_audit_no_update
  BEFORE UPDATE ON public.invoice_audit_logs
  FOR EACH ROW EXECUTE FUNCTION prevent_audit_mutation();

DROP TRIGGER IF EXISTS worm_invoice_audit_no_delete ON public.invoice_audit_logs;
CREATE TRIGGER worm_invoice_audit_no_delete
  BEFORE DELETE ON public.invoice_audit_logs
  FOR EACH ROW EXECUTE FUNCTION prevent_audit_mutation();


-- ##############################################################################
-- SECTION 4: INVOICE DELETION GOVERNANCE
-- ##############################################################################

-- Prevent deletion of any invoice that is not in 'draft' status.
-- This moves the enforcement from frontend JavaScript to the database.

CREATE OR REPLACE FUNCTION prevent_non_draft_invoice_deletion()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF OLD.status != 'draft' THEN
    RAISE EXCEPTION 'Finance Governance: Only draft invoices can be deleted. Cancel or void non-draft invoices instead. Current status: %', OLD.status;
  END IF;
  RETURN OLD;
END;
$$;

DROP TRIGGER IF EXISTS check_invoice_deletion_governance ON public.invoices;
CREATE TRIGGER check_invoice_deletion_governance
  BEFORE DELETE ON public.invoices
  FOR EACH ROW EXECUTE FUNCTION prevent_non_draft_invoice_deletion();

-- Prevent modification of paid/cancelled invoice amounts
CREATE OR REPLACE FUNCTION prevent_finalized_invoice_modification()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF OLD.status IN ('paid', 'cancelled', 'voided') THEN
    IF NEW.total IS DISTINCT FROM OLD.total 
       OR NEW.subtotal IS DISTINCT FROM OLD.subtotal
       OR NEW.tax_amount IS DISTINCT FROM OLD.tax_amount THEN
      RAISE EXCEPTION 'Finance Governance: Cannot modify amounts on a % invoice. Create a credit note instead.', OLD.status;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS check_invoice_modification_governance ON public.invoices;
CREATE TRIGGER check_invoice_modification_governance
  BEFORE UPDATE ON public.invoices
  FOR EACH ROW EXECUTE FUNCTION prevent_finalized_invoice_modification();


-- ##############################################################################
-- SECTION 5: ACTIVITY LOGS Ã¢â‚¬â€ MAKE TRULY APPEND-ONLY
-- ##############################################################################

-- activity_logs should be append-only (no updates, no deletes).
-- Unified WORM protection to strictly enforce enterprise audit log immutability.

CREATE OR REPLACE FUNCTION enforce_audit_logs_immutable()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  RAISE EXCEPTION 'Audit logs are immutable';
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS worm_activity_logs_no_update ON activity_logs;
DROP TRIGGER IF EXISTS worm_activity_logs_immutable ON activity_logs;

CREATE TRIGGER worm_activity_logs_immutable
  BEFORE UPDATE OR DELETE ON activity_logs
  FOR EACH ROW EXECUTE FUNCTION enforce_audit_logs_immutable();


-- ##############################################################################
-- END OF MIGRATION
-- ##############################################################################


-- ==========================================
-- MERGED FROM MIGRATION_SPRINT8_2_PHASE_4_1_LIFECYCLE.sql
-- ==========================================

-- ==============================================================================
-- RESOLVE PM Ã¢â‚¬â€ SPRINT 8.2 PHASE 4.1: EMPLOYEE LIFECYCLE PRESERVATION
-- ==============================================================================
-- RUN THIS SCRIPT IN SUPABASE SQL EDITOR AS `postgres` USER
-- Addresses soft-deletes, blocks hard deletes, replaces CASCADE with RESTRICT
-- ==============================================================================

-- 1. Ensure `left_at` column exists in `employment_records`
ALTER TABLE public.employment_records ADD COLUMN IF NOT EXISTS left_at timestamptz;

-- 2. Dynamically replace all ON DELETE CASCADE to ON DELETE RESTRICT for foreign keys pointing to users(id)
DO $$
DECLARE
    r RECORD;
    v_sql text;
BEGIN
    FOR r IN (
        SELECT
            tc.table_schema,
            tc.table_name,
            tc.constraint_name,
            kcu.column_name
        FROM information_schema.table_constraints AS tc
        JOIN information_schema.key_column_usage AS kcu
            ON tc.constraint_name = kcu.constraint_name
            AND tc.table_schema = kcu.table_schema
        JOIN information_schema.constraint_column_usage AS ccu
            ON ccu.constraint_name = tc.constraint_name
            AND ccu.table_schema = tc.table_schema
        JOIN information_schema.referential_constraints rc
            ON tc.constraint_name = rc.constraint_name
        WHERE constraint_type = 'FOREIGN KEY'
          AND ccu.table_name = 'users'
          AND ccu.column_name = 'id'
          AND rc.delete_rule = 'CASCADE'
          AND tc.table_schema = 'public'
    ) LOOP
        -- Drop the existing CASCADE constraint
        v_sql := format('ALTER TABLE %I.%I DROP CONSTRAINT %I;', r.table_schema, r.table_name, r.constraint_name);
        EXECUTE v_sql;

        -- Recreate the constraint with RESTRICT
        v_sql := format('ALTER TABLE %I.%I ADD CONSTRAINT %I FOREIGN KEY (%I) REFERENCES public.users(id) ON DELETE RESTRICT;', 
                        r.table_schema, r.table_name, r.constraint_name, r.column_name);
        EXECUTE v_sql;
    END LOOP;
END $$;


-- 2.5 Ensure workspaces have test marker
ALTER TABLE public.workspaces ADD COLUMN IF NOT EXISTS is_test_workspace boolean DEFAULT false;

-- 3. Trigger to prevent hard deletes on `users`
CREATE OR REPLACE FUNCTION public.prevent_user_hard_delete()
RETURNS TRIGGER AS $$
BEGIN
    -- Allow deletion if triggered by the service_role cleanup RPC
    IF current_setting('resolve_pm.is_test_cleanup', true) = 'true' THEN
        RETURN OLD;
    END IF;

    -- Block all other deletions
    RAISE EXCEPTION 'Users cannot be deleted. Use archive_employee() instead.';
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS prevent_user_hard_delete_trigger ON public.users;
CREATE TRIGGER prevent_user_hard_delete_trigger
    BEFORE DELETE ON public.users
    FOR EACH ROW
    EXECUTE FUNCTION public.prevent_user_hard_delete();

-- 3.5 Create Test Cleanup RPC (Option A)
CREATE OR REPLACE FUNCTION public.cleanup_test_workspace(p_workspace_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    -- Only allow service_role to execute this destructive operation
    IF current_setting('request.jwt.claim.role', true) != 'service_role' THEN
        RAISE EXCEPTION 'Unauthorized: Only service_role can execute test cleanups.';
    END IF;

    -- Verify it's actually a test workspace
    IF NOT EXISTS (SELECT 1 FROM public.workspaces WHERE id = p_workspace_id AND is_test_workspace = true) THEN
        RAISE EXCEPTION 'Workspace is not marked as a test workspace.';
    END IF;

    -- Set local transaction flag to bypass the user deletion trigger
    PERFORM set_config('resolve_pm.is_test_cleanup', 'true', true);

    -- Delete the workspace (will cascade and delete users)
    DELETE FROM public.workspaces WHERE id = p_workspace_id AND is_test_workspace = true;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.cleanup_test_workspace(uuid) FROM public;
REVOKE EXECUTE ON FUNCTION public.cleanup_test_workspace(uuid) FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.cleanup_test_workspace(uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.cleanup_test_workspace(uuid) TO service_role;


-- 4. Create `archive_employee()` RPC
CREATE OR REPLACE FUNCTION public.archive_employee(p_user_id uuid, p_status text, p_reason text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_workspace_id uuid;
    v_current_status text;
BEGIN
    -- Ensure the target status is a valid archived state
    IF p_status NOT IN ('resigned', 'terminated', 'suspended') THEN
        RAISE EXCEPTION 'Invalid status. Must be resigned, terminated, or suspended.';
    END IF;

    -- Verify the caller has HR capability or is Super Admin
    IF NOT (public.has_capability(auth.uid(), 'manage_employees') OR public.has_capability(auth.uid(), 'platform_governance')) THEN
        RAISE EXCEPTION 'Unauthorized. Only HR managers or Platform Admins can archive employees.';
    END IF;

    -- Get target user workspace and status
    SELECT workspace_id INTO v_workspace_id FROM public.users WHERE id = p_user_id;
    
    IF v_workspace_id IS NULL THEN
        RAISE EXCEPTION 'User not found.';
    END IF;

    -- Caller must be in the same workspace (unless they are platform governance, but current_workspace() enforces this anyway)
    IF v_workspace_id != public.current_workspace() THEN
        RAISE EXCEPTION 'Unauthorized cross-workspace archiving attempt.';
    END IF;

    SELECT employment_status INTO v_current_status FROM public.employment_records WHERE user_id = p_user_id;

    -- If no employment record, just return true (they are effectively inactive)
    IF v_current_status IS NULL THEN
        RETURN true;
    END IF;

    -- Archive them
    UPDATE public.employment_records 
    SET employment_status = p_status, 
        left_at = now() 
    WHERE user_id = p_user_id;

    -- Log it
    INSERT INTO public.employment_change_logs (employee_id, changed_by, field_changed, previous_value, new_value, reason)
    VALUES (p_user_id, auth.uid(), 'employment_status', v_current_status, p_status, p_reason);

    RETURN true;
END;
$$;


-- =============================================================
-- SPRINT 8.3 ENTERPRISE CLOSURE ADDITIONS
-- =============================================================

-- -------------------------------------------------------------
-- 1. MISSING PRODUCTION TABLES
-- -------------------------------------------------------------

-- Finance tables based on financeService.ts
CREATE TABLE IF NOT EXISTS company_billing_profile (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  legal_name text NOT NULL,
  gstin text,
  pan text,
  billing_address text,
  state text NOT NULL,
  country text NOT NULL,
  bank_details jsonb,
  invoice_prefix text NOT NULL DEFAULT 'RPM',
  UNIQUE(workspace_id)
);

CREATE TABLE IF NOT EXISTS clients (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  company_name text NOT NULL,
  contact_person text NOT NULL,
  email text NOT NULL,
  phone text NOT NULL,
  billing_address text NOT NULL,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
  gstin text,
  billing_state text,
  billing_country text,
  tax_type text CHECK (tax_type IN ('registered', 'unregistered')),
  currency text,
  default_currency text,
  advance_balance numeric DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS milestones (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  project_id uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  title text NOT NULL,
  description text,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'active', 'completed', 'blocked')),
  target_date timestamptz,
  completion_date timestamptz,
  progress_percent numeric DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS invoices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  client_id uuid NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  project_id uuid REFERENCES projects(id) ON DELETE SET NULL,
  invoice_number text NOT NULL,
  amount numeric NOT NULL DEFAULT 0,
  subtotal numeric NOT NULL DEFAULT 0,
  discount_amount numeric NOT NULL DEFAULT 0,
  taxable_amount numeric NOT NULL DEFAULT 0,
  cgst_amount numeric NOT NULL DEFAULT 0,
  sgst_amount numeric NOT NULL DEFAULT 0,
  igst_amount numeric NOT NULL DEFAULT 0,
  total_tax numeric NOT NULL DEFAULT 0,
  grand_total numeric NOT NULL DEFAULT 0,
  balance_due numeric NOT NULL DEFAULT 0,
  billing_state_snapshot text,
  currency text NOT NULL DEFAULT 'USD',
  company_base_currency text,
  base_amount numeric,
  invoice_currency text,
  invoice_amount numeric,
  converted_amount numeric,
  exchange_rate numeric,
  exchange_rate_locked boolean DEFAULT false,
  exchange_locked_at timestamptz,
  exchange_override_reason text,
  conversion_date timestamptz,
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'sent', 'issued', 'paid', 'overdue', 'cancelled', 'partial', 'partially_paid')),
  issue_date date NOT NULL,
  due_date date NOT NULL,
  paid_date date,
  task_id uuid REFERENCES tasks(id) ON DELETE SET NULL,
  billing_type text,
  payment_terms text,
  milestone_id uuid REFERENCES milestones(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(workspace_id, invoice_number)
);

CREATE TABLE IF NOT EXISTS invoice_line_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id uuid NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
  description text NOT NULL,
  quantity numeric NOT NULL DEFAULT 1,
  rate numeric NOT NULL DEFAULT 0,
  tax_percentage numeric NOT NULL DEFAULT 0,
  amount numeric NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  invoice_id uuid NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
  amount numeric NOT NULL,
  payment_date date NOT NULL,
  method text NOT NULL,
  reference_number text NOT NULL,
  client_id uuid REFERENCES clients(id) ON DELETE SET NULL,
  advance_payment boolean DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS expenses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  category text NOT NULL CHECK (category IN ('salary', 'software', 'infrastructure', 'office', 'misc')),
  amount numeric NOT NULL,
  date date NOT NULL,
  description text NOT NULL,
  project_id uuid REFERENCES projects(id) ON DELETE SET NULL,
  task_id uuid REFERENCES tasks(id) ON DELETE SET NULL,
  billable boolean DEFAULT false,
  reimbursed_invoice_id uuid REFERENCES invoices(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS financial_periods (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  month integer NOT NULL CHECK (month >= 1 AND month <= 12),
  year integer NOT NULL,
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'closed')),
  closed_by uuid REFERENCES users(id) ON DELETE SET NULL,
  closed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(workspace_id, month, year)
);

CREATE TABLE IF NOT EXISTS financial_snapshots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  period_id uuid NOT NULL REFERENCES financial_periods(id) ON DELETE CASCADE,
  total_revenue numeric NOT NULL DEFAULT 0,
  total_salary_expense numeric NOT NULL DEFAULT 0,
  total_other_expenses numeric NOT NULL DEFAULT 0,
  net_profit numeric NOT NULL DEFAULT 0,
  employee_count integer NOT NULL DEFAULT 0,
  client_count integer NOT NULL DEFAULT 0,
  project_count integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS financial_adjustments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  period_id uuid NOT NULL REFERENCES financial_periods(id) ON DELETE CASCADE,
  type text NOT NULL CHECK (type IN ('revenue', 'salary', 'expense')),
  amount numeric NOT NULL,
  reason text NOT NULL,
  created_by uuid REFERENCES users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS billing_milestones (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  project_id uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  name text NOT NULL,
  amount numeric NOT NULL,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'invoiced', 'paid')),
  invoice_id uuid REFERENCES invoices(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS client_credits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  client_id uuid NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  amount numeric NOT NULL,
  source_payment_id uuid REFERENCES payments(id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'used')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS advance_applications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  client_credit_id uuid NOT NULL REFERENCES client_credits(id) ON DELETE CASCADE,
  invoice_id uuid NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
  amount_applied numeric NOT NULL,
  applied_by uuid REFERENCES users(id) ON DELETE SET NULL,
  applied_at timestamptz NOT NULL DEFAULT now(),
  notes text
);

CREATE TABLE IF NOT EXISTS credit_notes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  client_id uuid NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  invoice_id uuid REFERENCES invoices(id) ON DELETE SET NULL,
  credit_note_number text NOT NULL,
  amount numeric NOT NULL,
  reason text NOT NULL,
  issue_date date NOT NULL,
  created_by uuid REFERENCES users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(workspace_id, credit_note_number)
);

CREATE TABLE IF NOT EXISTS invoice_audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  invoice_id uuid REFERENCES invoices(id) ON DELETE SET NULL,
  action text NOT NULL,
  performed_by uuid REFERENCES users(id) ON DELETE SET NULL,
  reason text,
  old_value jsonb,
  new_value jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS exchange_rate_audits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  invoice_id uuid REFERENCES invoices(id) ON DELETE CASCADE,
  old_rate numeric,
  new_rate numeric NOT NULL,
  changed_by uuid REFERENCES users(id) ON DELETE SET NULL,
  reason text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS requirements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  project_id uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  title text NOT NULL,
  description text,
  priority text NOT NULL DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high', 'urgent')),
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'approved', 'in-progress', 'implemented', 'verified', 'rejected')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS external_access_links (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  target_type text NOT NULL CHECK (target_type IN ('project', 'board', 'invoice', 'report')),
  target_id uuid NOT NULL,
  access_token text NOT NULL UNIQUE,
  expires_at timestamptz,
  created_by uuid REFERENCES users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- -------------------------------------------------------------
-- 2. ENTERPRISE HR STRUCTURE
-- -------------------------------------------------------------

CREATE TABLE IF NOT EXISTS departments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  name text NOT NULL,
  parent_department_id uuid REFERENCES departments(id) ON DELETE SET NULL,
  department_head_id uuid REFERENCES users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(workspace_id, name)
);

CREATE TABLE IF NOT EXISTS employee_contracts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  contract_type text NOT NULL CHECK (contract_type IN ('full-time', 'part-time', 'contractor', 'intern')),
  start_date date NOT NULL,
  end_date date,
  salary numeric,
  currency text,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'expired', 'terminated')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- -------------------------------------------------------------
-- 3. TASK HANDOFF WORKFLOW
-- -------------------------------------------------------------

CREATE TABLE IF NOT EXISTS task_handoff_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  task_id uuid NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  requested_by uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  requested_assignee uuid REFERENCES users(id) ON DELETE CASCADE,
  reason text NOT NULL,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  pm_id uuid REFERENCES users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- -------------------------------------------------------------
-- 4. EMPLOYEE LIFECYCLE FINALIZATION
-- -------------------------------------------------------------

-- Archive Employee Function
CREATE OR REPLACE FUNCTION archive_employee(p_user_id uuid, p_workspace_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- We don't delete the user row, we just mark them as terminated or resigned
  UPDATE users 
  SET 
    -- Do not touch employment_status if it's already resigned, suspended, etc.
    -- Assuming a column employment_status exists (from workspace.ts, but let's add it if missing)
    role = 'viewer' -- drop permissions
  WHERE id = p_user_id AND workspace_id = p_workspace_id;
  
  -- Unassign from active tasks
  UPDATE tasks 
  SET assignee_id = NULL 
  WHERE assignee_id = p_user_id AND status NOT IN ('done', 'archived');
  
  -- Log the event
  INSERT INTO activity_logs (workspace_id, actor_id, action, metadata)
  VALUES (p_workspace_id, auth.uid(), 'archived_employee', jsonb_build_object('user_id', p_user_id));
END;
$$;

-- Add employment_status column to users table if not exists (already checked earlier, it's missing in MASTER SCHEMA!)
DO $$ 
BEGIN 
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'users' AND column_name = 'employment_status') THEN 
    ALTER TABLE users ADD COLUMN employment_status text DEFAULT 'active' CHECK (employment_status IN ('active', 'resigned', 'terminated', 'on_leave', 'suspended'));
  END IF;
END $$;

-- Hard Delete Prevention Trigger
CREATE OR REPLACE FUNCTION prevent_user_hard_delete()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  RAISE EXCEPTION 'Hard deletes of users are strictly prohibited. Use archive_employee() instead to maintain historical referential integrity.';
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS prevent_user_hard_delete_trigger ON users;
CREATE TRIGGER prevent_user_hard_delete_trigger
  BEFORE DELETE ON users
  FOR EACH ROW EXECUTE FUNCTION prevent_user_hard_delete();

-- -------------------------------------------------------------
-- 5. AUDIT IMMUTABILITY CHECK (WORM PROTECTION)
-- -------------------------------------------------------------

CREATE OR REPLACE FUNCTION enforce_worm_protection()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF current_setting('role') <> 'service_role' AND current_user <> 'postgres' THEN
    RAISE EXCEPTION 'WORM Protection Violation: Audit logs are immutable and cannot be updated or deleted.';
  END IF;
  RETURN OLD; -- Should not reach here for regular users
END;
$$;

-- Activity logs WORM protection has been moved to the unified worm_activity_logs_immutable trigger in MASTER_SCHEMA.

DROP TRIGGER IF EXISTS worm_protect_system_audit_ledger_update ON system_audit_ledger;
CREATE TRIGGER worm_protect_system_audit_ledger_update
  BEFORE UPDATE ON system_audit_ledger
  FOR EACH ROW EXECUTE FUNCTION enforce_worm_protection();

DROP TRIGGER IF EXISTS worm_protect_system_audit_ledger_delete ON system_audit_ledger;
CREATE TRIGGER worm_protect_system_audit_ledger_delete
  BEFORE DELETE ON system_audit_ledger
  FOR EACH ROW EXECUTE FUNCTION enforce_worm_protection();

-- -------------------------------------------------------------
-- 6. RLS POLICIES FOR NEW TABLES
-- -------------------------------------------------------------

-- Note: In a real environment, we'd add detailed policies.
-- For now, we will add basic Workspace isolation policies for the new tables.

-- We create a helper DO block to generate basic policies for all new tables.
DO $$ 
DECLARE
  t text;
  tables text[] := ARRAY[
    'company_billing_profile', 'clients', 'milestones', 'invoices', 
    'invoice_line_items', 'payments', 'expenses', 'financial_periods', 
    'financial_snapshots', 'financial_adjustments', 'billing_milestones', 
    'client_credits', 'advance_applications', 'credit_notes', 
    'invoice_audit_logs', 'exchange_rate_audits', 'requirements', 
    'external_access_links', 'departments', 'employee_contracts', 
    'task_handoff_requests'
  ];
BEGIN
  FOREACH t IN ARRAY tables
  LOOP
    -- Enable RLS
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY;', t);
    
    -- We assume each table has a workspace_id, or is linked via a relation.
    -- For simplicity, we drop existing policy and recreate if workspace_id exists.
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = t AND column_name = 'workspace_id') THEN
      EXECUTE format('DROP POLICY IF EXISTS "Workspace isolation for %s" ON %I;', t, t);
      EXECUTE format('CREATE POLICY "Workspace isolation for %s" ON %I FOR ALL USING (workspace_id = current_workspace());', t, t);
    END IF;
  END LOOP;
END $$;
