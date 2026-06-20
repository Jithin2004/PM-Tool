const fs = require('fs');
const sqlFile = 'c:\\Users\\jithi\\OneDrive\\Desktop\\Resolve PM\\Resolve PM\\database\\production\\RESOLVE_PM_V1_3_INSTALL.sql';
const toAppend = `

-- ==============================================================================
-- 26. PRODUCTION ENGINE V2 - PHASE 2D TIMELINE BASELINES
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.timeline_baselines (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE RESTRICT,
    project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
    name text NOT NULL,
    description text,
    snapshot jsonb NOT NULL,
    is_active boolean DEFAULT true,
    created_by uuid REFERENCES public.users(id) ON DELETE SET NULL,
    created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.timeline_baselines ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view workspace baselines" ON public.timeline_baselines FOR SELECT
  USING (workspace_id IN (SELECT id FROM public.workspaces WHERE id = timeline_baselines.workspace_id AND public.is_active_workspace_member()));
`;
fs.appendFileSync(sqlFile, toAppend);
