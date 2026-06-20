const fs = require('fs');
const path = require('path');

const installFile = path.join(__dirname, 'src', '..', '..', 'database', 'production', 'RESOLVE_PM_V1_3_INSTALL.sql');

const rc2_5_recovery_sql = `

-- =====================================================================================
-- RC2.5 DATABASE CANONICALIZATION RECOVERY PATCH
-- Resolving Drift across Phases 1A - 3D + Phase 5D
-- =====================================================================================

-- ==========================================
-- Execution Foundation
-- ==========================================
CREATE TABLE IF NOT EXISTS public.uid_sequences (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    entity_prefix text NOT NULL,
    current_value integer NOT NULL DEFAULT 0,
    UNIQUE(workspace_id, entity_prefix)
);

CREATE TABLE IF NOT EXISTS public.entity_links (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    source_type text NOT NULL,
    source_id uuid NOT NULL,
    target_type text NOT NULL,
    target_id uuid NOT NULL,
    link_type text NOT NULL DEFAULT 'relates_to',
    created_at timestamptz DEFAULT now(),
    created_by uuid REFERENCES users(id) ON DELETE SET NULL,
    UNIQUE(source_type, source_id, target_type, target_id, link_type)
);

CREATE TABLE IF NOT EXISTS public.activity_events (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    actor_id uuid REFERENCES users(id) ON DELETE SET NULL,
    entity_type text NOT NULL,
    entity_id uuid NOT NULL,
    action_type text NOT NULL,
    before_value jsonb,
    after_value jsonb,
    metadata jsonb DEFAULT '{}'::jsonb,
    created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_activity_events_entity ON public.activity_events(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_activity_events_workspace ON public.activity_events(workspace_id, created_at DESC);

-- ==========================================
-- Workflow System
-- ==========================================
CREATE TABLE IF NOT EXISTS public.workflow_templates (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    name text NOT NULL,
    description text,
    is_default boolean DEFAULT false,
    created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.workflow_states (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    template_id uuid NOT NULL REFERENCES workflow_templates(id) ON DELETE CASCADE,
    name text NOT NULL,
    category text NOT NULL, -- 'todo', 'in_progress', 'done', etc.
    position_order integer NOT NULL DEFAULT 0,
    color text
);

CREATE TABLE IF NOT EXISTS public.workflow_transitions (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    template_id uuid NOT NULL REFERENCES workflow_templates(id) ON DELETE CASCADE,
    from_state_id uuid REFERENCES workflow_states(id) ON DELETE CASCADE,
    to_state_id uuid NOT NULL REFERENCES workflow_states(id) ON DELETE CASCADE,
    requires_approval boolean DEFAULT false
);

CREATE TABLE IF NOT EXISTS public.board_preferences (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    entity_type text NOT NULL,
    entity_id uuid NOT NULL,
    layout_preferences jsonb DEFAULT '{}'::jsonb,
    UNIQUE(user_id, entity_type, entity_id)
);

ALTER TABLE public.projects ADD COLUMN IF NOT EXISTS workflow_template_id uuid REFERENCES workflow_templates(id) ON DELETE SET NULL;
ALTER TABLE public.tasks ADD COLUMN IF NOT EXISTS workflow_state_id uuid REFERENCES workflow_states(id) ON DELETE SET NULL;

-- ==========================================
-- Backlog / Sprint Engine
-- ==========================================
CREATE TABLE IF NOT EXISTS public.stories (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    project_id uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    epic_id uuid REFERENCES epics(id) ON DELETE SET NULL,
    title text NOT NULL,
    description text,
    status text DEFAULT 'backlog',
    story_points integer,
    created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.sprint_snapshots (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    sprint_id uuid NOT NULL REFERENCES sprints(id) ON DELETE CASCADE,
    snapshot_date timestamptz DEFAULT now(),
    metrics jsonb NOT NULL
);

ALTER TABLE public.projects ADD COLUMN IF NOT EXISTS project_code text;
ALTER TABLE public.tasks ADD COLUMN IF NOT EXISTS uid text;
ALTER TABLE public.tasks ADD COLUMN IF NOT EXISTS story_id uuid REFERENCES stories(id) ON DELETE SET NULL;
ALTER TABLE public.tasks ADD COLUMN IF NOT EXISTS sprint_id uuid REFERENCES sprints(id) ON DELETE SET NULL;
ALTER TABLE public.sprints ADD COLUMN IF NOT EXISTS goal text;
ALTER TABLE public.sprints ADD COLUMN IF NOT EXISTS created_by uuid REFERENCES users(id) ON DELETE SET NULL;

-- ==========================================
-- Timeline Intelligence
-- ==========================================
CREATE TABLE IF NOT EXISTS public.timeline_baselines (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    project_id uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    name text NOT NULL,
    baseline_data jsonb NOT NULL,
    created_at timestamptz DEFAULT now(),
    created_by uuid REFERENCES users(id) ON DELETE SET NULL
);

-- ==========================================
-- Reporting Intelligence
-- ==========================================
CREATE TABLE IF NOT EXISTS public.report_templates (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    name text NOT NULL,
    configuration jsonb NOT NULL,
    created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.report_snapshots (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    report_type text NOT NULL,
    entity_type text NOT NULL,
    entity_id uuid NOT NULL,
    snapshot jsonb NOT NULL,
    generated_by_snapshot jsonb,
    created_at timestamptz DEFAULT now(),
    created_by uuid REFERENCES users(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS public.workspace_intelligence_settings (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE UNIQUE,
    settings jsonb NOT NULL DEFAULT '{}'::jsonb
);

-- ==========================================
-- HR Operations
-- ==========================================
CREATE TABLE IF NOT EXISTS public.attendance_policies (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    name text NOT NULL,
    rules jsonb NOT NULL
);

CREATE TABLE IF NOT EXISTS public.leave_balances (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    leave_type text NOT NULL,
    balance_days numeric NOT NULL DEFAULT 0,
    year integer NOT NULL,
    UNIQUE(user_id, leave_type, year)
);

CREATE TABLE IF NOT EXISTS public.clock_events (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    event_type text NOT NULL, -- 'clock_in', 'clock_out'
    timestamp timestamptz NOT NULL DEFAULT now(),
    metadata jsonb
);

ALTER TABLE public.personal_leave ADD COLUMN IF NOT EXISTS workspace_id uuid REFERENCES workspaces(id) ON DELETE CASCADE;
ALTER TABLE public.personal_leave ADD COLUMN IF NOT EXISTS status text DEFAULT 'pending';
ALTER TABLE public.personal_leave ADD COLUMN IF NOT EXISTS manager_id uuid REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE public.personal_leave ADD COLUMN IF NOT EXISTS approval_id uuid; -- links to universal_approvals if used

-- ==========================================
-- Finance Intelligence
-- ==========================================
CREATE TABLE IF NOT EXISTS public.finance_categories (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    name text NOT NULL,
    type text NOT NULL -- 'income', 'expense'
);

CREATE TABLE IF NOT EXISTS public.finance_accounts (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    name text NOT NULL,
    currency text NOT NULL DEFAULT 'USD',
    current_balance numeric NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS public.ledger_transactions (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    account_id uuid NOT NULL REFERENCES finance_accounts(id) ON DELETE CASCADE,
    category_id uuid REFERENCES finance_categories(id) ON DELETE SET NULL,
    amount numeric NOT NULL,
    transaction_date timestamptz NOT NULL DEFAULT now(),
    description text,
    reference_type text,
    reference_id uuid,
    created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.finance_settings (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE UNIQUE,
    settings jsonb NOT NULL DEFAULT '{}'::jsonb
);

-- ==========================================
-- Notification Engine
-- ==========================================
CREATE TABLE IF NOT EXISTS public.notification_events (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    event_type text NOT NULL,
    title text NOT NULL,
    body text,
    is_read boolean DEFAULT false,
    action_link text,
    created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.notification_preferences (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE UNIQUE,
    preferences jsonb NOT NULL DEFAULT '{}'::jsonb
);

-- ==========================================
-- ROW LEVEL SECURITY FOR RESTORED TABLES
-- ==========================================
ALTER TABLE public.uid_sequences ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.entity_links ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.activity_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workflow_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workflow_states ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workflow_transitions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.board_preferences ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sprint_snapshots ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.timeline_baselines ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.report_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.report_snapshots ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workspace_intelligence_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.attendance_policies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.leave_balances ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.clock_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.finance_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.finance_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ledger_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.finance_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notification_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notification_preferences ENABLE ROW LEVEL SECURITY;

-- Creating a generic workspace isolation policy function
CREATE OR REPLACE FUNCTION public.apply_workspace_isolation() RETURNS void AS $$
DECLARE
    t text;
BEGIN
    FOR t IN 
        SELECT table_name 
        FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name IN (
            'uid_sequences', 'entity_links', 'activity_events', 'workflow_templates', 
            'workflow_states', 'workflow_transitions', 'board_preferences', 'stories', 
            'sprint_snapshots', 'timeline_baselines', 'report_templates', 'report_snapshots', 
            'workspace_intelligence_settings', 'attendance_policies', 'leave_balances', 
            'clock_events', 'finance_categories', 'finance_accounts', 'ledger_transactions', 
            'finance_settings', 'notification_events'
        )
    LOOP
        EXECUTE format('DROP POLICY IF EXISTS "Workspace isolation %I" ON public.%I', t, t);
        
        -- Special cases where template_id or sprint_id references a parent that has workspace_id
        IF t = 'workflow_states' OR t = 'workflow_transitions' THEN
            EXECUTE format('CREATE POLICY "Workspace isolation %I" ON public.%I FOR ALL USING (
                EXISTS (
                    SELECT 1 FROM workflow_templates wt
                    JOIN workspace_members wm ON wm.workspace_id = wt.workspace_id
                    WHERE wt.id = %I.template_id AND wm.user_id = auth.uid()
                )
            )', t, t, t);
        ELSIF t = 'sprint_snapshots' THEN
            EXECUTE format('CREATE POLICY "Workspace isolation %I" ON public.%I FOR ALL USING (
                EXISTS (
                    SELECT 1 FROM sprints s
                    JOIN workspace_members wm ON wm.workspace_id = s.workspace_id
                    WHERE s.id = %I.sprint_id AND wm.user_id = auth.uid()
                )
            )', t, t, t);
        ELSE
            EXECUTE format('CREATE POLICY "Workspace isolation %I" ON public.%I FOR ALL USING (
                workspace_id IN (
                    SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid()
                )
            )', t, t);
        END IF;
    END LOOP;
END;
$$ LANGUAGE plpgsql;

SELECT public.apply_workspace_isolation();

-- Special case for notification_preferences (user isolated)
DROP POLICY IF EXISTS "User isolation notification_preferences" ON public.notification_preferences;
CREATE POLICY "User isolation notification_preferences" ON public.notification_preferences FOR ALL USING (user_id = auth.uid());

-- =====================================================================================
-- PHASE 5D AUTOMATION & RULES ENGINE (If not fully applied previously)
-- =====================================================================================
ALTER TABLE public.automation_rules ADD COLUMN IF NOT EXISTS name text;
ALTER TABLE public.automation_rules ADD COLUMN IF NOT EXISTS description text;
ALTER TABLE public.automation_rules ADD COLUMN IF NOT EXISTS conditions jsonb DEFAULT '{}'::jsonb;
ALTER TABLE public.automation_rules ADD COLUMN IF NOT EXISTS actions jsonb DEFAULT '[]'::jsonb;
ALTER TABLE public.automation_rules ADD COLUMN IF NOT EXISTS enabled boolean DEFAULT true;
ALTER TABLE public.automation_rules ADD COLUMN IF NOT EXISTS created_by uuid REFERENCES public.users(id) ON DELETE SET NULL;
ALTER TABLE public.automation_rules ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT now();

CREATE TABLE IF NOT EXISTS public.automation_runs (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    rule_id uuid NOT NULL REFERENCES public.automation_rules(id) ON DELETE CASCADE,
    workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
    automation_context_id text,
    execution_depth integer DEFAULT 1,
    trigger_payload jsonb NOT NULL DEFAULT '{}'::jsonb,
    execution_result jsonb,
    status text NOT NULL DEFAULT 'success',
    executed_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_automation_runs_workspace ON public.automation_runs(workspace_id, executed_at DESC);
CREATE INDEX IF NOT EXISTS idx_automation_rules_trigger_enabled ON public.automation_rules(workspace_id, trigger_type, enabled);

ALTER TABLE public.automation_runs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Automation runs visibility" ON public.automation_runs;
CREATE POLICY "Automation runs visibility" ON public.automation_runs FOR ALL USING (
    workspace_id IN (
        SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid()
    )
);

`;

try {
  let content = fs.readFileSync(installFile, 'utf8');
  if (!content.includes('RC2.5 DATABASE CANONICALIZATION RECOVERY PATCH')) {
    fs.appendFileSync(installFile, rc2_5_recovery_sql);
    console.log('RC2.5 Recovery SQL + Phase 5D successfully appended to RESOLVE_PM_V1_3_INSTALL.sql');
  } else {
    console.log('RC2.5 Recovery SQL already exists in RESOLVE_PM_V1_3_INSTALL.sql');
  }
} catch (err) {
  console.error('Error appending RC2.5 Recovery SQL:', err);
}
