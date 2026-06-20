const fs = require('fs');
const sqlFile = 'c:\\Users\\jithi\\OneDrive\\Desktop\\Resolve PM\\Resolve PM\\database\\production\\RESOLVE_PM_V1_3_INSTALL.sql';
const toAppend = `

-- ==============================================================================
-- 27. PRODUCTION ENGINE V2 - PHASE 3A SMART REPORTING ENGINE
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.report_snapshots (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
    report_type text NOT NULL, -- e.g. 'project', 'sprint', 'user', 'executive'
    entity_type text NOT NULL, -- e.g. 'project', 'sprint', 'user'
    entity_id uuid NOT NULL,
    snapshot jsonb NOT NULL,
    generated_by_snapshot jsonb NOT NULL, -- { id, name, role }
    created_by uuid REFERENCES public.users(id) ON DELETE SET NULL,
    created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.report_templates (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id uuid REFERENCES public.workspaces(id) ON DELETE CASCADE, -- null means system default
    name text NOT NULL,
    type text NOT NULL,
    configuration jsonb NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.workspace_intelligence_settings (
    workspace_id uuid PRIMARY KEY REFERENCES public.workspaces(id) ON DELETE CASCADE,
    settings jsonb NOT NULL DEFAULT '{"blocker_warning_days":2, "blocker_critical_days":5, "capacity_warning":90}'::jsonb,
    updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.report_snapshots ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.report_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workspace_intelligence_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view workspace reports" ON public.report_snapshots FOR SELECT
  USING (workspace_id IN (SELECT id FROM public.workspaces WHERE id = report_snapshots.workspace_id AND public.is_active_workspace_member()));

CREATE POLICY "Users can view templates" ON public.report_templates FOR SELECT
  USING (workspace_id IS NULL OR workspace_id IN (SELECT id FROM public.workspaces WHERE id = report_templates.workspace_id AND public.is_active_workspace_member()));

CREATE POLICY "Users can view workspace intelligence settings" ON public.workspace_intelligence_settings FOR SELECT
  USING (workspace_id IN (SELECT id FROM public.workspaces WHERE id = workspace_intelligence_settings.workspace_id AND public.is_active_workspace_member()));

-- Seed Default Templates
INSERT INTO public.report_templates (name, type, configuration) VALUES 
('Executive Report', 'executive', '{"sections":["health", "finance", "risks", "timeline"]}'),
('PM Report', 'pm', '{"sections":["sprint", "velocity", "tasks", "blockers"]}'),
('Developer Report', 'developer', '{"sections":["completed", "pending", "contributions"]}'),
('Client Report', 'client', '{"sections":["milestones", "delivery", "timeline"]}')
ON CONFLICT DO NOTHING;
`;
fs.appendFileSync(sqlFile, toAppend);
