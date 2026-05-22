-- activity_logs RLS Hotfix
-- Root cause: current_workspace() returns NULL when auth.uid() has
-- no users row or users.workspace_id is NULL. The WITH CHECK clause
-- evaluates workspace_id = NULL which is UNKNOWN (not TRUE), so every
-- INSERT is rejected with 42501.
--
-- Fix: replace current_workspace() with a subquery that returns
-- empty set (correctly FALSE) instead of NULL (propagates as UNKNOWN).
--
-- Run this in Supabase SQL Editor.

-- Drop the old FOR ALL policy (from V2 schema)
drop policy if exists "Activity logs are isolated by workspace" on activity_logs;

-- Drop the split SELECT/INSERT policies (from execution_modes migration)
drop policy if exists "Activity logs can be inserted by workspace members" on activity_logs;

-- Recreate SELECT policy with subquery
create policy "Activity logs are isolated by workspace"
on activity_logs for select
using (workspace_id in (select workspace_id from users where id = auth.uid()));

-- Recreate INSERT policy with subquery
create policy "Activity logs can be inserted by workspace members"
on activity_logs for insert
with check (workspace_id in (select workspace_id from users where id = auth.uid()));

-- Recreate DELETE policy with subquery (was missing — FOR ALL was dropped but no DELETE policy created)
drop policy if exists "Activity logs can be deleted by workspace members" on activity_logs;
create policy "Activity logs can be deleted by workspace members"
on activity_logs for delete
using (workspace_id in (select workspace_id from users where id = auth.uid()));

-- Verify
select schemaname, tablename, policyname, permissive, roles, cmd, qual, with_check
from pg_policies
where tablename = 'activity_logs'
order by policyname;
