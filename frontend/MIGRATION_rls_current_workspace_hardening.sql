-- RLS Hardening: replace current_workspace() with subquery
-- current_workspace() returns NULL when auth.uid() has no users row,
-- causing workspace_id = NULL to silently fail. The subquery returns
-- an empty set when the user has no row, which correctly evaluates to false.
--
-- Run in Supabase SQL Editor.

-- Helper: apply a policy only if the target table exists
do $rls$ begin
  create function _rls_safe_policy(table_name text, policy_name text, policy_ddl text)
  returns void as $body$
  begin
    if exists (select 1 from pg_tables where schemaname = 'public' and tablename = table_name) then
      execute format('drop policy if exists %I on %I', policy_name, table_name);
      execute policy_ddl;
    end if;
  end;
  $body$ language plpgsql;
exception when duplicate_function then null;
end $rls$;

-- The subquery used everywhere:
--   workspace_id in (select workspace_id from users where id = auth.uid())
-- For indirect-FK tables the chain is extended, e.g.:
--   doc_id in (select id from documents where workspace_id in (...))

-- ── 1. V2 Schema Core Tables ──────────────────────────────────────

select _rls_safe_policy('workspaces', 'Workspace members can view their workspace',
  'create policy "Workspace members can view their workspace"
   on workspaces for select
   using (id in (select workspace_id from users where id = auth.uid()) or owner_id = auth.uid())');

select _rls_safe_policy('teams', 'Teams are isolated by workspace',
  'create policy "Teams are isolated by workspace" on teams for all
   using (workspace_id in (select workspace_id from users where id = auth.uid()))
   with check (workspace_id in (select workspace_id from users where id = auth.uid()))');

select _rls_safe_policy('team_members', 'Team members are isolated by workspace',
  'create policy "Team members are isolated by workspace" on team_members for all
   using (workspace_id in (select workspace_id from users where id = auth.uid()))
   with check (workspace_id in (select workspace_id from users where id = auth.uid()))');

select _rls_safe_policy('projects', 'Projects are isolated by workspace',
  'create policy "Projects are isolated by workspace" on projects for all
   using (workspace_id in (select workspace_id from users where id = auth.uid()))
   with check (workspace_id in (select workspace_id from users where id = auth.uid()))');

select _rls_safe_policy('tasks', 'Tasks are isolated by workspace',
  'create policy "Tasks are isolated by workspace" on tasks for all
   using (workspace_id in (select workspace_id from users where id = auth.uid()))
   with check (workspace_id in (select workspace_id from users where id = auth.uid()))');

select _rls_safe_policy('task_dependencies', 'Task dependencies are isolated by workspace',
  'create policy "Task dependencies are isolated by workspace" on task_dependencies for all
   using (workspace_id in (select workspace_id from users where id = auth.uid()))
   with check (workspace_id in (select workspace_id from users where id = auth.uid()))');

select _rls_safe_policy('comments', 'Comments are isolated by workspace',
  'create policy "Comments are isolated by workspace" on comments for all
   using (workspace_id in (select workspace_id from users where id = auth.uid()))
   with check (workspace_id in (select workspace_id from users where id = auth.uid()))');

select _rls_safe_policy('files', 'Files are isolated by workspace',
  'create policy "Files are isolated by workspace" on files for all
   using (workspace_id in (select workspace_id from users where id = auth.uid()))
   with check (workspace_id in (select workspace_id from users where id = auth.uid()))');

select _rls_safe_policy('notifications', 'Notifications are isolated by workspace',
  'create policy "Notifications are isolated by workspace" on notifications for all
   using (workspace_id in (select workspace_id from users where id = auth.uid()))
   with check (workspace_id in (select workspace_id from users where id = auth.uid()))');

select _rls_safe_policy('attendance', 'Attendance is isolated by workspace',
  'create policy "Attendance is isolated by workspace" on attendance for all
   using (workspace_id in (select workspace_id from users where id = auth.uid()))
   with check (workspace_id in (select workspace_id from users where id = auth.uid()))');

-- V2 auxiliary tables (may or may not exist)
select _rls_safe_policy('workspace_holidays', 'Workspace holidays are isolated by workspace',
  'create policy "Workspace holidays are isolated by workspace" on workspace_holidays for all
   using (workspace_id in (select workspace_id from users where id = auth.uid()))
   with check (workspace_id in (select workspace_id from users where id = auth.uid()))');

select _rls_safe_policy('team_events', 'Team events are isolated by team',
  'create policy "Team events are isolated by team" on team_events for all
   using (team_id in (select id from teams where workspace_id in (select workspace_id from users where id = auth.uid())))
   with check (team_id in (select id from teams where workspace_id in (select workspace_id from users where id = auth.uid())))');

select _rls_safe_policy('personal_leave', 'Personal leaves are isolated by user workspace',
  'create policy "Personal leaves are isolated by user workspace" on personal_leave for all
   using (user_id in (select id from users where workspace_id in (select workspace_id from users where id = auth.uid())))
   with check (user_id in (select id from users where workspace_id in (select workspace_id from users where id = auth.uid())))');

select _rls_safe_policy('workspace_settings', 'Workspace settings are isolated by workspace',
  'create policy "Workspace settings are isolated by workspace" on workspace_settings for all
   using (workspace_id in (select workspace_id from users where id = auth.uid()))
   with check (workspace_id in (select workspace_id from users where id = auth.uid()))');

select _rls_safe_policy('salaries', 'Salaries are isolated by workspace',
  'create policy "Salaries are isolated by workspace" on salaries for all
   using (workspace_id in (select workspace_id from users where id = auth.uid()))
   with check (workspace_id in (select workspace_id from users where id = auth.uid()))');

-- ── 2. Execution Modes ────────────────────────────────────────────

select _rls_safe_policy('epics', 'Epics are isolated by workspace',
  'create policy "Epics are isolated by workspace" on epics for all
   using (workspace_id in (select workspace_id from users where id = auth.uid()))
   with check (workspace_id in (select workspace_id from users where id = auth.uid()))');

select _rls_safe_policy('sprints', 'Sprints are isolated by workspace',
  'create policy "Sprints are isolated by workspace" on sprints for all
   using (workspace_id in (select workspace_id from users where id = auth.uid()))
   with check (workspace_id in (select workspace_id from users where id = auth.uid()))');

select _rls_safe_policy('meetings', 'Meetings are isolated by workspace',
  'create policy "Meetings are isolated by workspace" on meetings for all
   using (workspace_id in (select workspace_id from users where id = auth.uid()))
   with check (workspace_id in (select workspace_id from users where id = auth.uid()))');

select _rls_safe_policy('meeting_attendees', 'Meeting attendees are isolated by workspace',
  'create policy "Meeting attendees are isolated by workspace" on meeting_attendees for all
   using (meeting_id in (select id from meetings where workspace_id in (select workspace_id from users where id = auth.uid())))
   with check (meeting_id in (select id from meetings where workspace_id in (select workspace_id from users where id = auth.uid())))');

select _rls_safe_policy('milestones', 'Milestones are isolated by workspace',
  'create policy "Milestones are isolated by workspace" on milestones for all
   using (workspace_id in (select workspace_id from users where id = auth.uid()))
   with check (workspace_id in (select workspace_id from users where id = auth.uid()))');

select _rls_safe_policy('approvals', 'Approvals are isolated by workspace',
  'create policy "Approvals are isolated by workspace" on approvals for all
   using (workspace_id in (select workspace_id from users where id = auth.uid()))
   with check (workspace_id in (select workspace_id from users where id = auth.uid()))');

select _rls_safe_policy('activity_logs', 'Activity logs are isolated by workspace',
  'create policy "Activity logs are isolated by workspace" on activity_logs for select
   using (workspace_id in (select workspace_id from users where id = auth.uid()))');

select _rls_safe_policy('activity_logs', 'Activity logs can be inserted by workspace members',
  'create policy "Activity logs can be inserted by workspace members" on activity_logs for insert
   with check (workspace_id in (select workspace_id from users where id = auth.uid()))');

-- ── 3. Ecosystem Expansion ────────────────────────────────────────

select _rls_safe_policy('documents', 'Documents are workspace-scoped',
  'create policy "Documents are workspace-scoped" on documents for all
   using (workspace_id in (select workspace_id from users where id = auth.uid()))
   with check (workspace_id in (select workspace_id from users where id = auth.uid()))');

select _rls_safe_policy('doc_versions', 'Doc versions are workspace-scoped',
  'create policy "Doc versions are workspace-scoped" on doc_versions for all
   using (doc_id in (select id from documents where workspace_id in (select workspace_id from users where id = auth.uid())))
   with check (doc_id in (select id from documents where workspace_id in (select workspace_id from users where id = auth.uid())))');

select _rls_safe_policy('doc_annotations', 'Doc annotations are workspace-scoped',
  'create policy "Doc annotations are workspace-scoped" on doc_annotations for all
   using (doc_id in (select id from documents where workspace_id in (select workspace_id from users where id = auth.uid())))
   with check (doc_id in (select id from documents where workspace_id in (select workspace_id from users where id = auth.uid())))');

select _rls_safe_policy('connected_accounts', 'Connected accounts are workspace-scoped',
  'create policy "Connected accounts are workspace-scoped" on connected_accounts for all
   using (workspace_id in (select workspace_id from users where id = auth.uid()))
   with check (workspace_id in (select workspace_id from users where id = auth.uid()))');

select _rls_safe_policy('integration_configs', 'Integration configs are workspace-scoped',
  'create policy "Integration configs are workspace-scoped" on integration_configs for all
   using (workspace_id in (select workspace_id from users where id = auth.uid()))
   with check (workspace_id in (select workspace_id from users where id = auth.uid()))');

select _rls_safe_policy('integration_health', 'Integration health is workspace-scoped',
  'create policy "Integration health is workspace-scoped" on integration_health for all
   using (workspace_id in (select workspace_id from users where id = auth.uid()))
   with check (workspace_id in (select workspace_id from users where id = auth.uid()))');

select _rls_safe_policy('webhooks', 'Webhooks are workspace-scoped',
  'create policy "Webhooks are workspace-scoped" on webhooks for all
   using (workspace_id in (select workspace_id from users where id = auth.uid()))
   with check (workspace_id in (select workspace_id from users where id = auth.uid()))');

select _rls_safe_policy('approval_chains', 'Approval chains are workspace-scoped',
  'create policy "Approval chains are workspace-scoped" on approval_chains for all
   using (workspace_id in (select workspace_id from users where id = auth.uid()))
   with check (workspace_id in (select workspace_id from users where id = auth.uid()))');

select _rls_safe_policy('approval_steps', 'Approval steps are workspace-scoped',
  'create policy "Approval steps are workspace-scoped" on approval_steps for all
   using (chain_id in (select id from approval_chains where workspace_id in (select workspace_id from users where id = auth.uid())))
   with check (chain_id in (select id from approval_chains where workspace_id in (select workspace_id from users where id = auth.uid())))');

select _rls_safe_policy('approval_instances', 'Approval instances are workspace-scoped',
  'create policy "Approval instances are workspace-scoped" on approval_instances for all
   using (chain_id in (select id from approval_chains where workspace_id in (select workspace_id from users where id = auth.uid())))
   with check (chain_id in (select id from approval_chains where workspace_id in (select workspace_id from users where id = auth.uid())))');

select _rls_safe_policy('notification_channels', 'Notification channels are workspace-scoped',
  'create policy "Notification channels are workspace-scoped" on notification_channels for all
   using (workspace_id in (select workspace_id from users where id = auth.uid()))
   with check (workspace_id in (select workspace_id from users where id = auth.uid()))');

select _rls_safe_policy('mention_rules', 'Mention rules are workspace-scoped',
  'create policy "Mention rules are workspace-scoped" on mention_rules for all
   using (workspace_id in (select workspace_id from users where id = auth.uid()))
   with check (workspace_id in (select workspace_id from users where id = auth.uid()))');

select _rls_safe_policy('escalation_policies', 'Escalation policies are workspace-scoped',
  'create policy "Escalation policies are workspace-scoped" on escalation_policies for all
   using (workspace_id in (select workspace_id from users where id = auth.uid()))
   with check (workspace_id in (select workspace_id from users where id = auth.uid()))');

select _rls_safe_policy('automation_rules', 'Automation rules are workspace-scoped',
  'create policy "Automation rules are workspace-scoped" on automation_rules for all
   using (workspace_id in (select workspace_id from users where id = auth.uid()))
   with check (workspace_id in (select workspace_id from users where id = auth.uid()))');

-- ── 4. Stage 3 Ignition ───────────────────────────────────────────

select _rls_safe_policy('api_keys', 'API keys are workspace-scoped',
  'create policy "API keys are workspace-scoped" on api_keys for all
   using (workspace_id in (select workspace_id from users where id = auth.uid()))
   with check (workspace_id in (select workspace_id from users where id = auth.uid()))');

-- ── 5. Stage 2 Hardening ─────────────────────────────────────────

select _rls_safe_policy('oauth_sessions', 'OAuth sessions are workspace-scoped',
  'create policy "OAuth sessions are workspace-scoped" on oauth_sessions for all
   using (workspace_id in (select workspace_id from users where id = auth.uid()))
   with check (workspace_id in (select workspace_id from users where id = auth.uid()))');

-- ── 6. Queue Persistence ─────────────────────────────────────────

select _rls_safe_policy('integration_sync_jobs', 'Sync jobs are workspace-scoped',
  'create policy "Sync jobs are workspace-scoped" on integration_sync_jobs for all
   using (workspace_id in (select workspace_id from users where id = auth.uid()))
   with check (workspace_id in (select workspace_id from users where id = auth.uid()))');

-- ── 7. Command Usage Events ─────────────────────────────────────

select _rls_safe_policy('command_usage_events', 'Command usage is isolated by workspace',
  'create policy "Command usage is isolated by workspace" on command_usage_events for all
   using (workspace_id in (select workspace_id from users where id = auth.uid()))
   with check (workspace_id in (select workspace_id from users where id = auth.uid()))');

-- ── 8. Calendar Sync Logs ───────────────────────────────────────

select _rls_safe_policy('calendar_sync_logs', 'Sync logs are isolated by workspace',
  'create policy "Sync logs are isolated by workspace" on calendar_sync_logs for all
   using (workspace_id in (select workspace_id from users where id = auth.uid()))
   with check (workspace_id in (select workspace_id from users where id = auth.uid()))');

-- ── 9. AI Recommendations ───────────────────────────────────────

select _rls_safe_policy('ai_recommendations', 'AI recommendations are isolated by workspace',
  'create policy "AI recommendations are isolated by workspace" on ai_recommendations for all
   using (workspace_id in (select workspace_id from users where id = auth.uid()))
   with check (workspace_id in (select workspace_id from users where id = auth.uid()))');

-- ── 10. Invitations ─────────────────────────────────────────────

select _rls_safe_policy('invitations', 'Invitations are readable by the invited email or workspace members',
  'create policy "Invitations are readable by the invited email or workspace members" on invitations for select
   using (lower(email) = lower(auth.email()) or workspace_id in (select workspace_id from users where id = auth.uid()))');

select _rls_safe_policy('invitations', 'Workspace super admins can manage invitations',
  'create policy "Workspace super admins can manage invitations" on invitations for all
   using (workspace_id in (select workspace_id from users where id = auth.uid())
     and exists (select 1 from users where users.id = auth.uid() and users.role = ''super_admin''))
   with check (workspace_id in (select workspace_id from users where id = auth.uid())
     and exists (select 1 from users where users.id = auth.uid() and users.role = ''super_admin''))');

-- ── 11. Cleanup ──────────────────────────────────────────────────
drop function if exists _rls_safe_policy;
-- Drop current_workspace() after verifying no dependencies remain:
-- drop function if exists current_workspace();
