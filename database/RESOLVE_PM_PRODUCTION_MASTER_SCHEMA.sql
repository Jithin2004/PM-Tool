

-- =============================================================
-- RESOLVE PM — PRODUCTION MASTER DATABASE SCHEMA
-- Version: 3.0.0 — Consolidated Canonical Deployment
-- Generated: 2026-05-27
--
-- This is the SINGLE SOURCE OF TRUTH for the Resolve PM database.
-- Do NOT run individual MIGRATION_*.sql files alongside this file.
-- Apply this document once to a clean Supabase project.
-- =============================================================

CREATE EXTENSION IF NOT EXISTS pgcrypto;

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
--    Explicit join table for many-to-many team ↔ user relations.
CREATE TABLE team_members (
  workspace_id  uuid  NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  team_id       uuid  NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  user_id       uuid  NOT NULL REFERENCES users(id) ON DELETE CASCADE,
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
  owner_id              uuid        REFERENCES users(id) ON DELETE SET NULL,
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
  assignee_id           uuid        REFERENCES users(id) ON DELETE SET NULL,
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
  user_id             uuid        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
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
  user_id             uuid        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
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
  author_id     uuid        REFERENCES users(id) ON DELETE SET NULL,
  body          text        NOT NULL,
  created_at    timestamptz NOT NULL DEFAULT now()
);

-- 8.1 task_comments
CREATE TABLE task_comments (
  id                uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id      uuid        NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  task_id           uuid        NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  author_id         uuid        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
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
  uploaded_by   uuid        REFERENCES users(id) ON DELETE SET NULL,
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
  user_id       uuid        REFERENCES users(id) ON DELETE CASCADE,
  category      text        NOT NULL CHECK (category IN ('assignments', 'deadlines', 'risk', 'attendance', 'system')),
  title         text        NOT NULL,
  body          text,
  read_at       timestamptz,
  created_at    timestamptz NOT NULL DEFAULT now()
);


CREATE TABLE activity_logs (
  id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id  uuid        NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  actor_id      uuid        REFERENCES users(id) ON DELETE SET NULL,
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
  user_id             uuid        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
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
  user_id       uuid        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
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
  invited_by    uuid        REFERENCES users(id) ON DELETE SET NULL,
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
  user_id             uuid        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
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
  actor_id       uuid        REFERENCES users(id) ON DELETE SET NULL,
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

  -- Only restrict developers — PMs/super_admins have full access
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
-- Aggregates task-level PERT data — bypasses legacy project-level
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
  -- ── 1. Delivery Confidence & Daily Fatigue ─────────────────────────────────
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

  -- ── 2. Execution Pressure ───────────────────────────────────────────────────
  -- Uses GLOBAL task counts — not paginated, not filtered by visible projects.
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

  -- ── 3. Risk Forecast ────────────────────────────────────────────────────────
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
-- ROW LEVEL SECURITY — ENABLE ON ALL TABLES
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

-- ── Workspaces ────────────────────────────────────────────────

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


-- ── Users ─────────────────────────────────────────────────────
-- Wave 7.5: P0-1 — Users SELECT restricted to same workspace + self
-- Wave 7.5: P0-2 — Pending user workspace hijack prevention
-- Wave 7.5: P0-3 — Self-update restricted to safe profile fields only

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

-- P0-3: Self-update — users may only modify safe profile fields.
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


-- ── Teams ─────────────────────────────────────────────────────
-- Wave 7.5: P0-7 — Team mutations restricted to PM/Admin

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


-- ── Team Members ──────────────────────────────────────────────
-- Wave 7.5: P0-7 — Team member mutations restricted to PM/Admin

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


-- ── Projects ──────────────────────────────────────────────────

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


-- ── Tasks ─────────────────────────────────────────────────────
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


-- ── Task Dependencies ─────────────────────────────────────────
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


-- ── Comments ──────────────────────────────────────────────────
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


-- ── Files ─────────────────────────────────────────────────────
-- Wave 7.5: Files — SELECT for all, mutations restricted to uploader + PM/Admin

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


-- ── Notifications ─────────────────────────────────────────────
-- Wave 7.5: P1-1 — Notification INSERT restricted: user_id must be self or by PM/Admin

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


-- ── Activity Logs ─────────────────────────────────────────────
-- Wave 7.5: P1-3 — actor_id must match auth.uid() to prevent forgery

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


-- ── Attendance ────────────────────────────────────────────────
-- Wave 7.5: P0-6 — Attendance mutations restricted to PM/Admin

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


-- ── Salaries ──────────────────────────────────────────────────
-- Wave 7.5: P0-5 — Salary mutations restricted to PM/Admin

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


-- ── Invitations ───────────────────────────────────────────────

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


-- ── Workspace Holidays ────────────────────────────────────────
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


-- ── Team Events ───────────────────────────────────────────────
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


-- ── Personal Leave ────────────────────────────────────────────
-- Wave 7.5: P1-2 — Self-only mutation for non-admins

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


-- ── Workspace Settings ────────────────────────────────────────
-- Wave 7.5: P0-4 — Workspace settings mutations restricted to PM/Admin

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


-- ── System Audit Ledger ───────────────────────────────────────
-- Wave 7.5: P1-4 — Audit ledger SELECT binds BOTH role AND workspace_id

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

- -   M I G R A T I O N _ D O J _ H R _ A U D I T . s q l  
 - -   R u n   t h i s   s c r i p t   t o   m i g r a t e   t h e   d a t a b a s e   f o r   t h e   D O J   H R   A u d i t   u p d a t e .  
  
 - -   1 .   A d d   d a t e _ o f _ j o i n i n g   t o   i n v i t a t i o n s  
 A L T E R   T A B L E   p u b l i c . i n v i t a t i o n s   A D D   C O L U M N   I F   N O T   E X I S T S   d a t e _ o f _ j o i n i n g   T I M E S T A M P   W I T H   T I M E   Z O N E ;  
  
 - -   2 .   C r e a t e   e m p l o y m e n t _ r e c o r d s   t a b l e  
 C R E A T E   T A B L E   I F   N O T   E X I S T S   p u b l i c . e m p l o y m e n t _ r e c o r d s   (  
         i d   U U I D   P R I M A R Y   K E Y   D E F A U L T   g e n _ r a n d o m _ u u i d ( ) ,  
         p r o f i l e _ i d   U U I D   N O T   N U L L   R E F E R E N C E S   p u b l i c . u s e r s ( i d )   O N   D E L E T E   C A S C A D E ,  
         w o r k s p a c e _ i d   U U I D   R E F E R E N C E S   p u b l i c . w o r k s p a c e s ( i d )   O N   D E L E T E   S E T   N U L L ,  
         d a t e _ o f _ j o i n i n g   T I M E S T A M P   W I T H   T I M E   Z O N E   N O T   N U L L ,  
         e m p l o y m e n t _ s t a t u s   T E X T   N O T   N U L L   D E F A U L T   ' a c t i v e '   C H E C K   ( e m p l o y m e n t _ s t a t u s   I N   ( ' a c t i v e ' ,   ' r e s i g n e d ' ,   ' t e r m i n a t e d ' ) ) ,  
         c r e a t e d _ a t   T I M E S T A M P   W I T H   T I M E   Z O N E   N O T   N U L L   D E F A U L T   n o w ( ) ,  
         u p d a t e d _ a t   T I M E S T A M P   W I T H   T I M E   Z O N E   N O T   N U L L   D E F A U L T   n o w ( ) ,  
         c r e a t e d _ b y   U U I D   R E F E R E N C E S   p u b l i c . u s e r s ( i d )   O N   D E L E T E   S E T   N U L L ,  
         u p d a t e d _ b y   U U I D   R E F E R E N C E S   p u b l i c . u s e r s ( i d )   O N   D E L E T E   S E T   N U L L ,  
         C O N S T R A I N T   u n i q u e _ p r o f i l e _ w o r k s p a c e _ e m p l o y m e n t   U N I Q U E   ( p r o f i l e _ i d ,   w o r k s p a c e _ i d )  
 ) ;  
  
 - -   3 .   C r e a t e   e m p l o y m e n t _ c h a n g e _ l o g s   t a b l e  
 C R E A T E   T A B L E   I F   N O T   E X I S T S   p u b l i c . e m p l o y m e n t _ c h a n g e _ l o g s   (  
         i d   U U I D   P R I M A R Y   K E Y   D E F A U L T   g e n _ r a n d o m _ u u i d ( ) ,  
         e m p l o y e e _ i d   U U I D   N O T   N U L L   R E F E R E N C E S   p u b l i c . u s e r s ( i d )   O N   D E L E T E   C A S C A D E ,  
         f i e l d _ c h a n g e d   T E X T   N O T   N U L L ,  
         p r e v i o u s _ v a l u e   T E X T ,  
         n e w _ v a l u e   T E X T ,  
         c h a n g e d _ b y   U U I D   N O T   N U L L   R E F E R E N C E S   p u b l i c . u s e r s ( i d )   O N   D E L E T E   C A S C A D E ,  
         c h a n g e d _ a t   T I M E S T A M P   W I T H   T I M E   Z O N E   N O T   N U L L   D E F A U L T   n o w ( ) ,  
         r e a s o n   T E X T   N O T   N U L L  
 ) ;  
  
 - -   E n a b l e   R L S  
 A L T E R   T A B L E   p u b l i c . e m p l o y m e n t _ r e c o r d s   E N A B L E   R O W   L E V E L   S E C U R I T Y ;  
 A L T E R   T A B L E   p u b l i c . e m p l o y m e n t _ c h a n g e _ l o g s   E N A B L E   R O W   L E V E L   S E C U R I T Y ;  
  
 - -   R L S   P o l i c i e s   f o r   e m p l o y m e n t _ r e c o r d s  
 - -   S u p e r   A d m i n s   c a n   d o   a n y t h i n g  
 C R E A T E   P O L I C Y   " S u p e r   A d m i n s   h a v e   f u l l   a c c e s s   t o   e m p l o y m e n t _ r e c o r d s "   O N   p u b l i c . e m p l o y m e n t _ r e c o r d s  
 F O R   A L L   U S I N G   (  
     E X I S T S   (  
         S E L E C T   1   F R O M   p u b l i c . u s e r s  
         W H E R E   u s e r s . i d   =   a u t h . u i d ( )   A N D   u s e r s . r o l e   =   ' s u p e r _ a d m i n '  
     )  
 ) ;  
  
 - -   U s e r s   c a n   v i e w   t h e i r   o w n   r e c o r d  
 C R E A T E   P O L I C Y   " U s e r s   c a n   v i e w   t h e i r   o w n   e m p l o y m e n t _ r e c o r d s "   O N   p u b l i c . e m p l o y m e n t _ r e c o r d s  
 F O R   S E L E C T   U S I N G   (  
     p r o f i l e _ i d   =   a u t h . u i d ( )  
 ) ;  
  
 - -   P r o j e c t   M a n a g e r s   a n d   A d m i n s   c a n   v i e w   r e c o r d s   i n   t h e i r   w o r k s p a c e  
 C R E A T E   P O L I C Y   " W o r k s p a c e   m a n a g e r s   c a n   v i e w   e m p l o y m e n t _ r e c o r d s "   O N   p u b l i c . e m p l o y m e n t _ r e c o r d s  
 F O R   S E L E C T   U S I N G   (  
     E X I S T S   (  
         S E L E C T   1   F R O M   p u b l i c . u s e r s  
         W H E R E   u s e r s . i d   =   a u t h . u i d ( )   A N D   u s e r s . w o r k s p a c e _ i d   =   e m p l o y m e n t _ r e c o r d s . w o r k s p a c e _ i d  
         A N D   u s e r s . r o l e   I N   ( ' s u p e r _ a d m i n ' ,   ' a d m i n ' ,   ' m a n a g e r ' ,   ' e d i t o r ' )  
     )  
 ) ;  
  
 - -   R L S   P o l i c i e s   f o r   e m p l o y m e n t _ c h a n g e _ l o g s  
 C R E A T E   P O L I C Y   " S u p e r   A d m i n s   h a v e   f u l l   a c c e s s   t o   e m p l o y m e n t _ c h a n g e _ l o g s "   O N   p u b l i c . e m p l o y m e n t _ c h a n g e _ l o g s  
 F O R   A L L   U S I N G   (  
     E X I S T S   (  
         S E L E C T   1   F R O M   p u b l i c . u s e r s  
         W H E R E   u s e r s . i d   =   a u t h . u i d ( )   A N D   u s e r s . r o l e   =   ' s u p e r _ a d m i n '  
     )  
 ) ;  
  
 C R E A T E   P O L I C Y   " U s e r s   c a n   v i e w   t h e i r   o w n   c h a n g e   l o g s "   O N   p u b l i c . e m p l o y m e n t _ c h a n g e _ l o g s  
 F O R   S E L E C T   U S I N G   (  
     e m p l o y e e _ i d   =   a u t h . u i d ( )  
 ) ;  
 I N S E R T   I N T O   p u b l i c . e m p l o y m e n t _ r e c o r d s   ( p r o f i l e _ i d ,   w o r k s p a c e _ i d ,   d a t e _ o f _ j o i n i n g ,   e m p l o y m e n t _ s t a t u s ,   c r e a t e d _ a t ,   u p d a t e d _ a t ) 
 S E L E C T   i d ,   w o r k s p a c e _ i d ,   c r e a t e d _ a t ,   ' a c t i v e ' ,   n o w ( ) ,   n o w ( ) 
 F R O M   p u b l i c . u s e r s 
 W H E R E   w o r k s p a c e _ i d   I S   N O T   N U L L 
 O N   C O N F L I C T   ( p r o f i l e _ i d ,   w o r k s p a c e _ i d )   D O   N O T H I N G ;  
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
    profile_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    workspace_id UUID REFERENCES public.workspaces(id) ON DELETE SET NULL,
    date_of_joining TIMESTAMP WITH TIME ZONE NOT NULL,
    employment_status TEXT NOT NULL DEFAULT 'active' CHECK (employment_status IN ('active', 'resigned', 'terminated')),
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    created_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
    updated_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
    CONSTRAINT unique_profile_workspace_employment UNIQUE (profile_id, workspace_id)
);

-- 3. Create employment_change_logs table
CREATE TABLE IF NOT EXISTS public.employment_change_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    employee_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    field_changed TEXT NOT NULL,
    previous_value TEXT,
    new_value TEXT,
    changed_by UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
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
    employee_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
    base_salary numeric NOT NULL DEFAULT 3000,
    currency text NOT NULL DEFAULT 'USD',
    effective_from timestamptz NOT NULL DEFAULT now(),
    effective_to timestamptz DEFAULT NULL,
    change_reason text,
    created_by uuid REFERENCES public.users(id) ON DELETE SET NULL,
    updated_by uuid REFERENCES public.users(id) ON DELETE SET NULL,
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
