-- =============================================================================
-- RC24.4 DECISION & APPROVAL CONTRACT REPAIR
-- Adds missing tables and columns requested by application layer.
-- Enforces Enterprise RBAC for security.
-- =============================================================================

-- 1. APPROVAL CHAINS PATCH
ALTER TABLE public.approval_chains ADD COLUMN IF NOT EXISTS trigger_event text;
ALTER TABLE public.approval_chains ADD COLUMN IF NOT EXISTS trigger_config jsonb DEFAULT '{}'::jsonb;
ALTER TABLE public.approval_chains ADD COLUMN IF NOT EXISTS enabled boolean DEFAULT true;

-- 2. APPROVAL INSTANCES PATCH
ALTER TABLE public.approval_instances ADD COLUMN IF NOT EXISTS target_type text;
ALTER TABLE public.approval_instances ADD COLUMN IF NOT EXISTS current_step integer DEFAULT 1;
ALTER TABLE public.approval_instances ADD COLUMN IF NOT EXISTS initiated_by uuid REFERENCES public.users(id) ON DELETE SET NULL;
ALTER TABLE public.approval_instances ADD COLUMN IF NOT EXISTS completed_at timestamptz;

-- Safe conversion from uuid to text
ALTER TABLE public.approval_instances ALTER COLUMN target_id TYPE text USING target_id::text;

-- 3. CREATE APPROVAL STEPS
CREATE TABLE IF NOT EXISTS public.approval_steps (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    chain_id uuid NOT NULL REFERENCES public.approval_chains(id) ON DELETE CASCADE,
    step_order integer NOT NULL,
    approver_role text NOT NULL,
    approver_id uuid REFERENCES public.users(id) ON DELETE SET NULL,
    timeout_hours integer DEFAULT 48,
    created_at timestamptz DEFAULT now()
);

-- 4. CREATE DECISION HISTORY TABLE
CREATE TABLE IF NOT EXISTS public.decision_recommendation_history (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
    insight_id text NOT NULL,
    action_type text NOT NULL,
    detected_problem text,
    recommended_action text,
    predicted_impact jsonb,
    status text DEFAULT 'open',
    executed_at timestamptz,
    created_at timestamptz DEFAULT now()
);

-- 5. ENTERPRISE RLS ENFORCEMENT
ALTER TABLE public.approval_chains ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.approval_instances ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.approval_steps ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.decision_recommendation_history ENABLE ROW LEVEL SECURITY;

-- approval_chains policies
DROP POLICY IF EXISTS "approval_chains_read" ON public.approval_chains;
CREATE POLICY "approval_chains_read" ON public.approval_chains FOR SELECT USING (
    workspace_id = (auth.jwt() -> 'app_metadata' ->> 'workspace_id')::uuid
    AND (auth.jwt() -> 'app_metadata' ->> 'role') IN ('super_admin', 'admin', 'project_manager', 'team_lead', 'developer', 'employee', 'hr', 'finance', 'client')
);

DROP POLICY IF EXISTS "approval_chains_insert" ON public.approval_chains;
CREATE POLICY "approval_chains_insert" ON public.approval_chains FOR INSERT WITH CHECK (
    workspace_id = (auth.jwt() -> 'app_metadata' ->> 'workspace_id')::uuid
    AND (auth.jwt() -> 'app_metadata' ->> 'role') IN ('super_admin', 'admin', 'project_manager', 'team_lead', 'developer', 'employee', 'hr', 'finance')
);

DROP POLICY IF EXISTS "approval_chains_update" ON public.approval_chains;
CREATE POLICY "approval_chains_update" ON public.approval_chains FOR UPDATE USING (
    workspace_id = (auth.jwt() -> 'app_metadata' ->> 'workspace_id')::uuid
    AND (auth.jwt() -> 'app_metadata' ->> 'role') IN ('super_admin', 'admin', 'project_manager', 'team_lead', 'developer', 'employee', 'hr', 'finance')
);

DROP POLICY IF EXISTS "approval_chains_delete" ON public.approval_chains;
CREATE POLICY "approval_chains_delete" ON public.approval_chains FOR DELETE USING (
    workspace_id = (auth.jwt() -> 'app_metadata' ->> 'workspace_id')::uuid
    AND (auth.jwt() -> 'app_metadata' ->> 'role') IN ('super_admin', 'admin', 'project_manager')
);

-- approval_instances policies
DROP POLICY IF EXISTS "approval_instances_read" ON public.approval_instances;
CREATE POLICY "approval_instances_read" ON public.approval_instances FOR SELECT USING (
    workspace_id = (auth.jwt() -> 'app_metadata' ->> 'workspace_id')::uuid
    AND (auth.jwt() -> 'app_metadata' ->> 'role') IN ('super_admin', 'admin', 'project_manager', 'team_lead', 'developer', 'employee', 'hr', 'finance', 'client')
);

DROP POLICY IF EXISTS "approval_instances_insert" ON public.approval_instances;
CREATE POLICY "approval_instances_insert" ON public.approval_instances FOR INSERT WITH CHECK (
    workspace_id = (auth.jwt() -> 'app_metadata' ->> 'workspace_id')::uuid
    AND (auth.jwt() -> 'app_metadata' ->> 'role') IN ('super_admin', 'admin', 'project_manager', 'team_lead', 'developer', 'employee', 'hr', 'finance')
);

DROP POLICY IF EXISTS "approval_instances_update" ON public.approval_instances;
CREATE POLICY "approval_instances_update" ON public.approval_instances FOR UPDATE USING (
    workspace_id = (auth.jwt() -> 'app_metadata' ->> 'workspace_id')::uuid
    AND (auth.jwt() -> 'app_metadata' ->> 'role') IN ('super_admin', 'admin', 'project_manager', 'team_lead', 'developer', 'employee', 'hr', 'finance')
);

DROP POLICY IF EXISTS "approval_instances_delete" ON public.approval_instances;
CREATE POLICY "approval_instances_delete" ON public.approval_instances FOR DELETE USING (
    workspace_id = (auth.jwt() -> 'app_metadata' ->> 'workspace_id')::uuid
    AND (auth.jwt() -> 'app_metadata' ->> 'role') IN ('super_admin', 'admin', 'project_manager')
);

-- approval_steps policies
DROP POLICY IF EXISTS "approval_steps_read" ON public.approval_steps;
CREATE POLICY "approval_steps_read" ON public.approval_steps FOR SELECT USING (
    EXISTS (
        SELECT 1 FROM public.approval_chains ac 
        WHERE ac.id = approval_steps.chain_id 
        AND ac.workspace_id = (auth.jwt() -> 'app_metadata' ->> 'workspace_id')::uuid
    )
    AND (auth.jwt() -> 'app_metadata' ->> 'role') IN ('super_admin', 'admin', 'project_manager', 'team_lead', 'developer', 'employee', 'hr', 'finance', 'client')
);

DROP POLICY IF EXISTS "approval_steps_insert" ON public.approval_steps;
CREATE POLICY "approval_steps_insert" ON public.approval_steps FOR INSERT WITH CHECK (
    EXISTS (
        SELECT 1 FROM public.approval_chains ac 
        WHERE ac.id = approval_steps.chain_id 
        AND ac.workspace_id = (auth.jwt() -> 'app_metadata' ->> 'workspace_id')::uuid
    )
    AND (auth.jwt() -> 'app_metadata' ->> 'role') IN ('super_admin', 'admin', 'project_manager', 'team_lead', 'developer', 'employee', 'hr', 'finance')
);

DROP POLICY IF EXISTS "approval_steps_update" ON public.approval_steps;
CREATE POLICY "approval_steps_update" ON public.approval_steps FOR UPDATE USING (
    EXISTS (
        SELECT 1 FROM public.approval_chains ac 
        WHERE ac.id = approval_steps.chain_id 
        AND ac.workspace_id = (auth.jwt() -> 'app_metadata' ->> 'workspace_id')::uuid
    )
    AND (auth.jwt() -> 'app_metadata' ->> 'role') IN ('super_admin', 'admin', 'project_manager', 'team_lead', 'developer', 'employee', 'hr', 'finance')
);

DROP POLICY IF EXISTS "approval_steps_delete" ON public.approval_steps;
CREATE POLICY "approval_steps_delete" ON public.approval_steps FOR DELETE USING (
    EXISTS (
        SELECT 1 FROM public.approval_chains ac 
        WHERE ac.id = approval_steps.chain_id 
        AND ac.workspace_id = (auth.jwt() -> 'app_metadata' ->> 'workspace_id')::uuid
    )
    AND (auth.jwt() -> 'app_metadata' ->> 'role') IN ('super_admin', 'admin', 'project_manager')
);

-- decision_recommendation_history policies
DROP POLICY IF EXISTS "decision_read" ON public.decision_recommendation_history;
CREATE POLICY "decision_read" ON public.decision_recommendation_history FOR SELECT USING (
    workspace_id = (auth.jwt() -> 'app_metadata' ->> 'workspace_id')::uuid
    AND (auth.jwt() -> 'app_metadata' ->> 'role') IN ('super_admin', 'admin', 'project_manager', 'team_lead', 'developer', 'employee', 'hr', 'finance', 'client')
);

DROP POLICY IF EXISTS "decision_insert" ON public.decision_recommendation_history;
CREATE POLICY "decision_insert" ON public.decision_recommendation_history FOR INSERT WITH CHECK (
    workspace_id = (auth.jwt() -> 'app_metadata' ->> 'workspace_id')::uuid
    AND (auth.jwt() -> 'app_metadata' ->> 'role') IN ('super_admin', 'admin', 'project_manager', 'team_lead', 'developer', 'employee', 'hr', 'finance')
);

DROP POLICY IF EXISTS "decision_update" ON public.decision_recommendation_history;
CREATE POLICY "decision_update" ON public.decision_recommendation_history FOR UPDATE USING (
    workspace_id = (auth.jwt() -> 'app_metadata' ->> 'workspace_id')::uuid
    AND (auth.jwt() -> 'app_metadata' ->> 'role') IN ('super_admin', 'admin', 'project_manager', 'team_lead', 'developer', 'employee', 'hr', 'finance')
);

DROP POLICY IF EXISTS "decision_delete" ON public.decision_recommendation_history;
CREATE POLICY "decision_delete" ON public.decision_recommendation_history FOR DELETE USING (
    workspace_id = (auth.jwt() -> 'app_metadata' ->> 'workspace_id')::uuid
    AND (auth.jwt() -> 'app_metadata' ->> 'role') IN ('super_admin', 'admin', 'project_manager')
);
