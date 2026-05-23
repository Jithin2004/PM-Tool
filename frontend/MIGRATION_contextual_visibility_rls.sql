-- Resolve PM: Contextual Visibility Inheritance RLS
-- Expands RLS to epics, sprints, files, user_stories, subtasks
-- Ensures inheritance-compatible policies consistent with the permission engine.

-- Epics: visible by project ownership, assignment, or super_admin
drop policy if exists "Epics visible by ownership or inheritance" on epics;
create policy "Epics visible by ownership or inheritance"
on epics for select
using (
  workspace_id IN (SELECT workspace_id FROM users WHERE id = auth.uid())
  AND (
    EXISTS (
      SELECT 1 FROM users WHERE users.id = auth.uid() AND users.role = 'super_admin'
    )
    OR EXISTS (
      SELECT 1 FROM projects
      WHERE projects.id = epics.project_id
      AND projects.owner_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM tasks
      WHERE tasks.epic_id = epics.id
      AND tasks.assignee_id = auth.uid()
    )
  )
);

drop policy if exists "Epics manageable by super admin or project owner" on epics;
create policy "Epics manageable by super admin or project owner"
on epics for insert
with check (
  workspace_id IN (SELECT workspace_id FROM users WHERE id = auth.uid())
  AND EXISTS (
    SELECT 1 FROM users WHERE users.id = auth.uid() AND users.role IN ('super_admin', 'pm')
  )
);

drop policy if exists "Epics updatable by super admin or project owner" on epics;
create policy "Epics updatable by super admin or project owner"
on epics for update
using (
  workspace_id IN (SELECT workspace_id FROM users WHERE id = auth.uid())
  AND (
    EXISTS (
      SELECT 1 FROM users WHERE users.id = auth.uid() AND users.role = 'super_admin'
    )
    OR EXISTS (
      SELECT 1 FROM projects
      WHERE projects.id = epics.project_id
      AND projects.owner_id = auth.uid()
    )
  )
);

-- Sprints: visible by project ownership, task assignment within sprint, or super_admin
drop policy if exists "Sprints visible by ownership or inheritance" on sprints;
create policy "Sprints visible by ownership or inheritance"
on sprints for select
using (
  workspace_id IN (SELECT workspace_id FROM users WHERE id = auth.uid())
  AND (
    EXISTS (
      SELECT 1 FROM users WHERE users.id = auth.uid() AND users.role = 'super_admin'
    )
    OR EXISTS (
      SELECT 1 FROM projects
      WHERE projects.id = sprints.project_id
      AND projects.owner_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM tasks
      WHERE tasks.sprint_id = sprints.id
      AND tasks.assignee_id = auth.uid()
    )
  )
);

-- Files: inherit visibility from parent task or project
drop policy if exists "Files visible by parent task or project inheritance" on files;
create policy "Files visible by parent task or project inheritance"
on files for select
using (
  workspace_id IN (SELECT workspace_id FROM users WHERE id = auth.uid())
  AND (
    EXISTS (
      SELECT 1 FROM users WHERE users.id = auth.uid() AND users.role = 'super_admin'
    )
    OR (
      task_id IS NOT NULL
      AND EXISTS (
        SELECT 1 FROM tasks
        WHERE tasks.id = files.task_id
        AND (
          tasks.assignee_id = auth.uid()
          OR EXISTS (
            SELECT 1 FROM projects
            WHERE projects.id = tasks.project_id
            AND projects.owner_id = auth.uid()
          )
        )
      )
    )
    OR (
      task_id IS NULL AND project_id IS NOT NULL
      AND EXISTS (
        SELECT 1 FROM projects
        WHERE projects.id = files.project_id
        AND projects.owner_id = auth.uid()
      )
    )
    OR uploaded_by = auth.uid()
  )
);

-- User stories: inherit from epic visibility or assignment
-- Note: user_stories table is used in ScrumBootstrap, may not exist in all deployments
do $$
begin
  if exists (select from information_schema.tables where table_name = 'user_stories') then
    drop policy if exists "User stories visible by inheritance" on user_stories;
    create policy "User stories visible by inheritance"
    on user_stories for select
    using (
      workspace_id IN (SELECT workspace_id FROM users WHERE id = auth.uid())
      AND (
        EXISTS (
          SELECT 1 FROM users WHERE users.id = auth.uid() AND users.role = 'super_admin'
        )
        OR EXISTS (
          SELECT 1 FROM epics
          WHERE epics.id = user_stories.epic_id
          AND (
            EXISTS (
              SELECT 1 FROM projects
              WHERE projects.id = epics.project_id
              AND projects.owner_id = auth.uid()
            )
            OR EXISTS (
              SELECT 1 FROM tasks
              WHERE tasks.epic_id = epics.id
              AND tasks.assignee_id = auth.uid()
            )
          )
        )
        OR assignee_id = auth.uid()
      )
    );
  end if;
end
$$;

-- Subtasks: inherit from parent task visibility
do $$
begin
  if exists (select from information_schema.tables where table_name = 'subtasks') then
    drop policy if exists "Subtasks visible by parent task inheritance" on subtasks;
    create policy "Subtasks visible by parent task inheritance"
    on subtasks for select
    using (
      workspace_id IN (SELECT workspace_id FROM users WHERE id = auth.uid())
      AND (
        EXISTS (
          SELECT 1 FROM users WHERE users.id = auth.uid() AND users.role = 'super_admin'
        )
        OR EXISTS (
          SELECT 1 FROM tasks
          WHERE tasks.id = subtasks.task_id
          AND (
            tasks.assignee_id = auth.uid()
            OR EXISTS (
              SELECT 1 FROM projects
              WHERE projects.id = tasks.project_id
              AND projects.owner_id = auth.uid()
            )
          )
        )
      )
    );
  end if;
end
$$;
