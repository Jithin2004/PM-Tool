-- ==============================================================================
-- RESOLVE PM — SPRINT 8.2: ENTERPRISE SECURITY LOCKDOWN & TRUST HARDENING
-- ==============================================================================
-- RUN THIS SCRIPT IN SUPABASE SQL EDITOR AS `postgres` USER
-- Addresses DB-backed capabilities, strict RLS enforcement, employee revocation
-- ==============================================================================

BEGIN;

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


COMMIT;
