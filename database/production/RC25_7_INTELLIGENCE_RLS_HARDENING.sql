-- RC25_7_INTELLIGENCE_RLS_HARDENING.sql
-- Description: Hardens RLS policies for stories and timeline_baselines to restrict access to enterprise levels.

-- Drop broad policies on stories
DROP POLICY IF EXISTS "Enable all operations for workspace users" ON public.stories;

-- Stories: SELECT
DROP POLICY IF EXISTS "Enable read for workspace members" ON public.stories;
CREATE POLICY "Enable read for workspace members" ON public.stories FOR SELECT 
USING (
  workspace_id = (auth.jwt() -> 'app_metadata' ->> 'workspace_id')::uuid 
  AND (auth.jwt() -> 'app_metadata' ->> 'role') IN ('super_admin', 'admin', 'project_manager', 'team_lead', 'developer', 'employee', 'hr', 'finance', 'client')
);

-- Stories: INSERT
DROP POLICY IF EXISTS "Enable insert for elevated roles" ON public.stories;
CREATE POLICY "Enable insert for elevated roles" ON public.stories FOR INSERT 
WITH CHECK (
  workspace_id = (auth.jwt() -> 'app_metadata' ->> 'workspace_id')::uuid 
  AND (auth.jwt() -> 'app_metadata' ->> 'role') IN ('super_admin', 'admin', 'project_manager', 'team_lead', 'developer')
);

-- Stories: UPDATE
DROP POLICY IF EXISTS "Enable update for elevated roles and assignee" ON public.stories;
CREATE POLICY "Enable update for elevated roles and assignee" ON public.stories FOR UPDATE 
USING (
  workspace_id = (auth.jwt() -> 'app_metadata' ->> 'workspace_id')::uuid 
  AND (
    (auth.jwt() -> 'app_metadata' ->> 'role') IN ('super_admin', 'admin', 'project_manager', 'team_lead')
    OR assigned_to = auth.uid()
  )
);

-- Stories: DELETE
DROP POLICY IF EXISTS "Enable delete for admins and pms" ON public.stories;
CREATE POLICY "Enable delete for admins and pms" ON public.stories FOR DELETE 
USING (
  workspace_id = (auth.jwt() -> 'app_metadata' ->> 'workspace_id')::uuid 
  AND (auth.jwt() -> 'app_metadata' ->> 'role') IN ('super_admin', 'admin', 'project_manager')
);


-- Drop broad policies on timeline_baselines
DROP POLICY IF EXISTS "Enable all operations for workspace users" ON public.timeline_baselines;

-- Timeline_baselines: SELECT
DROP POLICY IF EXISTS "Enable read for workspace members" ON public.timeline_baselines;
CREATE POLICY "Enable read for workspace members" ON public.timeline_baselines FOR SELECT 
USING (
  workspace_id = (auth.jwt() -> 'app_metadata' ->> 'workspace_id')::uuid 
  AND (auth.jwt() -> 'app_metadata' ->> 'role') IN ('super_admin', 'admin', 'project_manager', 'team_lead', 'developer', 'employee', 'hr', 'finance', 'client')
);

-- Timeline_baselines: INSERT
DROP POLICY IF EXISTS "Enable insert for system and admins" ON public.timeline_baselines;
CREATE POLICY "Enable insert for system and admins" ON public.timeline_baselines FOR INSERT 
WITH CHECK (
  workspace_id = (auth.jwt() -> 'app_metadata' ->> 'workspace_id')::uuid 
  AND (auth.jwt() -> 'app_metadata' ->> 'role') IN ('super_admin', 'admin', 'project_manager', 'system', 'service_role')
);

-- Timeline_baselines: UPDATE
DROP POLICY IF EXISTS "Enable update for system and admins" ON public.timeline_baselines;
CREATE POLICY "Enable update for system and admins" ON public.timeline_baselines FOR UPDATE 
USING (
  workspace_id = (auth.jwt() -> 'app_metadata' ->> 'workspace_id')::uuid 
  AND (auth.jwt() -> 'app_metadata' ->> 'role') IN ('super_admin', 'admin', 'system', 'service_role')
);

-- Timeline_baselines: DELETE
DROP POLICY IF EXISTS "Enable delete for super_admin" ON public.timeline_baselines;
CREATE POLICY "Enable delete for super_admin" ON public.timeline_baselines FOR DELETE 
USING (
  workspace_id = (auth.jwt() -> 'app_metadata' ->> 'workspace_id')::uuid 
  AND (auth.jwt() -> 'app_metadata' ->> 'role') IN ('super_admin')
);
