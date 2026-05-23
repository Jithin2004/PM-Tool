-- Resolve PM: Task Visibility Governance
-- Adds user-scoped RLS policies on top of existing workspace-scoped policies.
-- Users should only see tasks that are relevant to them.

-- Tasks: user-scoped SELECT policy
drop policy if exists "Tasks are visible by assignment or ownership" on tasks;
create policy "Tasks are visible by assignment or ownership"
on tasks for select
using (
  workspace_id IN (SELECT workspace_id FROM users WHERE id = auth.uid())
  AND (
    assignee_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role = 'super_admin'
    )
    OR EXISTS (
      SELECT 1 FROM projects
      WHERE projects.id = tasks.project_id
      AND projects.owner_id = auth.uid()
    )
  )
);

-- Tasks: owner/manager can insert/update/delete
-- Super admin and project owners can manage tasks in their projects
drop policy if exists "Tasks can be managed by super admin or project owner" on tasks;
create policy "Tasks can be managed by super admin or project owner"
on tasks for insert
with check (
  workspace_id IN (SELECT workspace_id FROM users WHERE id = auth.uid())
  AND (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role IN ('super_admin', 'pm')
    )
    OR EXISTS (
      SELECT 1 FROM projects
      WHERE projects.id = tasks.project_id
      AND projects.owner_id = auth.uid()
    )
  )
);

drop policy if exists "Tasks can be updated by super admin or project owner" on tasks;
create policy "Tasks can be updated by super admin or project owner"
on tasks for update
using (
  workspace_id IN (SELECT workspace_id FROM users WHERE id = auth.uid())
  AND (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role IN ('super_admin', 'pm')
    )
    OR EXISTS (
      SELECT 1 FROM projects
      WHERE projects.id = tasks.project_id
      AND projects.owner_id = auth.uid()
    )
  )
);

drop policy if exists "Tasks can be deleted by super admin only" on tasks;
create policy "Tasks can be deleted by super admin only"
on tasks for delete
using (
  workspace_id IN (SELECT workspace_id FROM users WHERE id = auth.uid())
  AND EXISTS (
    SELECT 1 FROM users
    WHERE users.id = auth.uid()
    AND users.role = 'super_admin'
  )
);

-- Task dependencies: inherit task visibility
drop policy if exists "Task dependencies visible by task association" on task_dependencies;
create policy "Task dependencies visible by task association"
on task_dependencies for select
using (
  workspace_id IN (SELECT workspace_id FROM users WHERE id = auth.uid())
  AND (
    EXISTS (
      SELECT 1 FROM tasks
      WHERE tasks.id = task_dependencies.task_id
      AND (
        tasks.assignee_id = auth.uid()
        OR EXISTS (
          SELECT 1 FROM users WHERE users.id = auth.uid() AND users.role = 'super_admin'
        )
        OR EXISTS (
          SELECT 1 FROM projects
          WHERE projects.id = tasks.project_id AND projects.owner_id = auth.uid()
        )
      )
    )
    OR EXISTS (
      SELECT 1 FROM tasks
      WHERE tasks.id = task_dependencies.depends_on_task_id
      AND (
        tasks.assignee_id = auth.uid()
        OR EXISTS (
          SELECT 1 FROM users WHERE users.id = auth.uid() AND users.role = 'super_admin'
        )
        OR EXISTS (
          SELECT 1 FROM projects
          WHERE projects.id = tasks.project_id AND projects.owner_id = auth.uid()
        )
      )
    )
  )
);

-- Notifications: user-scoped (reinforcing existing behavior)
drop policy if exists "Notifications are user-scoped" on notifications;
create policy "Notifications are user-scoped"
on notifications for select
using (
  workspace_id IN (SELECT workspace_id FROM users WHERE id = auth.uid())
  AND (
    user_id = auth.uid()
    OR user_id IS NULL
    OR EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role = 'super_admin'
    )
  )
);

-- Activity logs: scoped to user's projects and tasks
drop policy if exists "Activity logs are visible by user relevance" on activity_logs;
create policy "Activity logs are visible by user relevance"
on activity_logs for select
using (
  workspace_id IN (SELECT workspace_id FROM users WHERE id = auth.uid())
  AND (
    actor_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role = 'super_admin'
    )
    OR EXISTS (
      SELECT 1 FROM projects
      WHERE projects.id = activity_logs.project_id
      AND projects.owner_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM tasks
      WHERE tasks.id = activity_logs.task_id
      AND tasks.assignee_id = auth.uid()
    )
  )
);

-- Comments: visible if user can see the associated task/project
drop policy if exists "Comments are visible by task association" on comments;
create policy "Comments are visible by task association"
on comments for select
using (
  workspace_id IN (SELECT workspace_id FROM users WHERE id = auth.uid())
  AND (
    author_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role = 'super_admin'
    )
    OR (
      task_id IS NOT NULL
      AND EXISTS (
        SELECT 1 FROM tasks
        WHERE tasks.id = comments.task_id
        AND (
          tasks.assignee_id = auth.uid()
          OR EXISTS (
            SELECT 1 FROM projects
            WHERE projects.id = tasks.project_id AND projects.owner_id = auth.uid()
          )
        )
      )
    )
    OR (
      task_id IS NULL AND project_id IS NOT NULL
      AND EXISTS (
        SELECT 1 FROM projects
        WHERE projects.id = comments.project_id
        AND projects.owner_id = auth.uid()
      )
    )
  )
);
