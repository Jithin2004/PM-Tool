const fs = require('fs');
const sqlFile = 'c:\\Users\\jithi\\OneDrive\\Desktop\\Resolve PM\\Resolve PM\\database\\production\\RESOLVE_PM_V1_3_INSTALL.sql';
const toAppend = `

-- ==============================================================================
-- 28. PRODUCTION ENGINE V2 - PHASE 3B HR OPERATIONS ENGINE
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.clock_events (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
    user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    event_type text NOT NULL CHECK (event_type IN ('CLOCK_IN', 'CLOCK_OUT')),
    timestamp timestamptz NOT NULL,
    approval_status text DEFAULT 'approved', -- 'approved', 'pending_correction', 'rejected'
    metadata jsonb DEFAULT '{}'::jsonb,
    created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.attendance_policies (
    workspace_id uuid PRIMARY KEY REFERENCES public.workspaces(id) ON DELETE CASCADE,
    settings jsonb NOT NULL DEFAULT '{"shifts":[{"name":"General","start":"09:00","end":"17:00","grace_minutes":20}], "weekly_hours":40}'::jsonb,
    updated_at timestamptz NOT NULL DEFAULT now()
);

-- ADDITIVE Migration to personal_leave table
ALTER TABLE public.personal_leave ADD COLUMN IF NOT EXISTS workspace_id uuid REFERENCES public.workspaces(id) ON DELETE CASCADE;
ALTER TABLE public.personal_leave ADD COLUMN IF NOT EXISTS status text DEFAULT 'pending';
ALTER TABLE public.personal_leave ADD COLUMN IF NOT EXISTS leave_type text DEFAULT 'Casual';
ALTER TABLE public.personal_leave ADD COLUMN IF NOT EXISTS manager_id uuid REFERENCES public.users(id) ON DELETE SET NULL;
ALTER TABLE public.personal_leave ADD COLUMN IF NOT EXISTS approval_id uuid REFERENCES public.universal_approvals(id) ON DELETE SET NULL;

CREATE TABLE IF NOT EXISTS public.leave_balances (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
    user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    leave_type text NOT NULL,
    allocated numeric NOT NULL DEFAULT 0,
    used numeric NOT NULL DEFAULT 0,
    remaining numeric NOT NULL DEFAULT 0,
    cycle_start date NOT NULL,
    cycle_end date NOT NULL,
    UNIQUE(workspace_id, user_id, leave_type, cycle_start)
);

ALTER TABLE public.clock_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.attendance_policies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.leave_balances ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own clock events" ON public.clock_events FOR SELECT
  USING (user_id = auth.uid() OR public.is_workspace_admin(workspace_id));

CREATE POLICY "Users insert own clock events" ON public.clock_events FOR INSERT
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users view attendance policies" ON public.attendance_policies FOR SELECT
  USING (workspace_id IN (SELECT id FROM public.workspaces WHERE id = attendance_policies.workspace_id AND public.is_active_workspace_member()));

CREATE POLICY "Users view own leave balances" ON public.leave_balances FOR SELECT
  USING (user_id = auth.uid() OR public.is_workspace_admin(workspace_id));
`;
fs.appendFileSync(sqlFile, toAppend);
