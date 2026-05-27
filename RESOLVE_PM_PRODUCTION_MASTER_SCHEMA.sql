BEGIN;

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
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

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
DROP TABLE IF EXISTS task_dependencies CASCADE;
DROP TABLE IF EXISTS tasks CASCADE;
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


-- 11. activity_logs
CREATE TABLE activity_logs (
  id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id  uuid        NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  actor_id      uuid        REFERENCES users(id) ON DELETE SET NULL,
  project_id    uuid        REFERENCES projects(id) ON DELETE CASCADE,
  task_id       uuid        REFERENCES tasks(id) ON DELETE CASCADE,
  action        text        NOT NULL,
  metadata      jsonb       NOT NULL DEFAULT '{}'::jsonb,
  created_at    timestamptz NOT NULL DEFAULT now()
);


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
CREATE RULE system_audit_ledger_no_update AS
  ON UPDATE TO system_audit_ledger DO INSTEAD NOTHING;

CREATE RULE system_audit_ledger_no_delete AS
  ON DELETE TO system_audit_ledger DO INSTEAD NOTHING;

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
CREATE INDEX IF NOT EXISTS idx_activity_workspace   ON activity_logs(workspace_id);
CREATE INDEX IF NOT EXISTS idx_notifications_ws     ON notifications(workspace_id);
CREATE INDEX IF NOT EXISTS idx_attendance_ws_user   ON attendance(workspace_id, user_id);


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
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = ''
AS $$
BEGIN
  INSERT INTO public.users (id, email, full_name, avatar_url, role)
  VALUES (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name', split_part(new.email, '@', 1)),
    coalesce(new.raw_user_meta_data->>'avatar_url', new.raw_user_meta_data->>'picture'),
    'viewer'
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN new;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();


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

DROP POLICY IF EXISTS "Users are visible within the platform" ON users;
CREATE POLICY "Users are visible within the platform"
  ON users FOR SELECT
  USING (auth.uid() IS NOT NULL);

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

DROP POLICY IF EXISTS "Users can update their own user row" ON users;
CREATE POLICY "Users can update their own user row"
  ON users FOR UPDATE
  USING (id = auth.uid())
  WITH CHECK (id = auth.uid());


-- ── Teams ─────────────────────────────────────────────────────

DROP POLICY IF EXISTS "Teams are isolated by workspace" ON teams;
CREATE POLICY "Teams are isolated by workspace"
  ON teams FOR ALL
  USING (workspace_id = current_workspace())
  WITH CHECK (workspace_id = current_workspace());


-- ── Team Members ──────────────────────────────────────────────

DROP POLICY IF EXISTS "Team members are isolated by workspace" ON team_members;
CREATE POLICY "Team members are isolated by workspace"
  ON team_members FOR ALL
  USING (workspace_id = current_workspace())
  WITH CHECK (workspace_id = current_workspace());


-- ── Projects ──────────────────────────────────────────────────

DROP POLICY IF EXISTS "Projects are isolated by workspace" ON projects;
CREATE POLICY "Projects are isolated by workspace"
  ON projects FOR ALL
  USING (workspace_id = current_workspace() AND deleted_at IS NULL)
  WITH CHECK (workspace_id = current_workspace());


-- ── Tasks ─────────────────────────────────────────────────────

DROP POLICY IF EXISTS "Tasks are isolated by workspace" ON tasks;
CREATE POLICY "Tasks are isolated by workspace"
  ON tasks FOR ALL
  USING (workspace_id = current_workspace())
  WITH CHECK (workspace_id = current_workspace());


-- ── Task Dependencies ─────────────────────────────────────────

DROP POLICY IF EXISTS "Task dependencies are isolated by workspace" ON task_dependencies;
CREATE POLICY "Task dependencies are isolated by workspace"
  ON task_dependencies FOR ALL
  USING (workspace_id = current_workspace())
  WITH CHECK (workspace_id = current_workspace());


-- ── Comments ──────────────────────────────────────────────────

DROP POLICY IF EXISTS "Comments are isolated by workspace" ON comments;
CREATE POLICY "Comments are isolated by workspace"
  ON comments FOR ALL
  USING (workspace_id = current_workspace())
  WITH CHECK (workspace_id = current_workspace());


-- ── Files ─────────────────────────────────────────────────────

DROP POLICY IF EXISTS "Files are isolated by workspace" ON files;
CREATE POLICY "Files are isolated by workspace"
  ON files FOR ALL
  USING (workspace_id = current_workspace())
  WITH CHECK (workspace_id = current_workspace());


-- ── Notifications ─────────────────────────────────────────────

DROP POLICY IF EXISTS "Notifications are isolated by workspace" ON notifications;
CREATE POLICY "Notifications are isolated by workspace"
  ON notifications FOR ALL
  USING (workspace_id = current_workspace())
  WITH CHECK (workspace_id = current_workspace());


-- ── Activity Logs ─────────────────────────────────────────────

DROP POLICY IF EXISTS "Activity logs are isolated by workspace" ON activity_logs;
CREATE POLICY "Activity logs are isolated by workspace"
  ON activity_logs FOR ALL
  USING (workspace_id = current_workspace())
  WITH CHECK (workspace_id = current_workspace());


-- ── Attendance ────────────────────────────────────────────────

DROP POLICY IF EXISTS "Attendance is isolated by workspace" ON attendance;
CREATE POLICY "Attendance is isolated by workspace"
  ON attendance FOR ALL
  USING (workspace_id = current_workspace())
  WITH CHECK (workspace_id = current_workspace());


-- ── Salaries ──────────────────────────────────────────────────

DROP POLICY IF EXISTS "Salaries are isolated by workspace" ON salaries;
CREATE POLICY "Salaries are isolated by workspace"
  ON salaries FOR ALL
  USING (workspace_id = current_workspace())
  WITH CHECK (workspace_id = current_workspace());


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

DROP POLICY IF EXISTS "Workspace holidays are isolated by workspace" ON workspace_holidays;
CREATE POLICY "Workspace holidays are isolated by workspace"
  ON workspace_holidays FOR ALL
  USING (workspace_id = current_workspace())
  WITH CHECK (workspace_id = current_workspace());


-- ── Team Events ───────────────────────────────────────────────

DROP POLICY IF EXISTS "Team events are isolated by team" ON team_events;
CREATE POLICY "Team events are isolated by team"
  ON team_events FOR ALL
  USING  (team_id IN (SELECT id FROM teams WHERE workspace_id = current_workspace()))
  WITH CHECK (team_id IN (SELECT id FROM teams WHERE workspace_id = current_workspace()));


-- ── Personal Leave ────────────────────────────────────────────

DROP POLICY IF EXISTS "Personal leaves are isolated by user workspace" ON personal_leave;
CREATE POLICY "Personal leaves are isolated by user workspace"
  ON personal_leave FOR ALL
  USING  (user_id IN (SELECT id FROM users WHERE workspace_id = current_workspace()))
  WITH CHECK (user_id IN (SELECT id FROM users WHERE workspace_id = current_workspace()));


-- ── Workspace Settings ────────────────────────────────────────

DROP POLICY IF EXISTS "Workspace settings are isolated by workspace" ON workspace_settings;
CREATE POLICY "Workspace settings are isolated by workspace"
  ON workspace_settings FOR ALL
  USING (workspace_id = current_workspace())
  WITH CHECK (workspace_id = current_workspace());


-- ── System Audit Ledger ───────────────────────────────────────

DROP POLICY IF EXISTS "System audit ledger is viewable by workspace admins" ON system_audit_ledger;
CREATE POLICY "System audit ledger is viewable by workspace admins"
  ON system_audit_ledger FOR SELECT
  USING (
    workspace_id = current_workspace()
    AND EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
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


COMMIT;
