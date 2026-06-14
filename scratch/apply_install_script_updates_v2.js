const fs = require('fs');
const path = require('path');

const filePath = path.resolve('C:/Users/jithi/OneDrive/Desktop/Resolve PM/Resolve PM/database/production/RESOLVE_PM_V1_3_INSTALL.sql');
let content = fs.readFileSync(filePath, 'utf8');

// Normalize line endings for replacement
content = content.replace(/\r\n/g, '\n');

// 1. Add `is_active_workspace_member()`
const target1 = `  SELECT workspace_id FROM users WHERE id = auth.uid() LIMIT 1\n$$;`;
const replacement1 = `  SELECT workspace_id FROM users WHERE id = auth.uid() LIMIT 1\n$$;\n\n-- Returns true if the currently authenticated user is an active workspace member.\nCREATE OR REPLACE FUNCTION public.is_active_workspace_member()\nRETURNS boolean AS $$\nBEGIN\n  RETURN EXISTS (\n    SELECT 1 \n    FROM public.users \n    WHERE id = auth.uid() \n      AND workspace_id = current_workspace() \n      AND status = 'active'\n  );\nEND;\n$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = '';`;
if(content.includes(target1)) {
    content = content.replace(target1, replacement1);
    console.log('Patched is_active_workspace_member');
} else {
    console.log('Failed is_active_workspace_member');
}

// 2. Add `is_internal` to `files` schema
const target2 = `  mime_type     text,\n  size_bytes    bigint,`;
const replacement2 = `  mime_type     text,\n  size_bytes    bigint,\n  is_internal   boolean     NOT NULL DEFAULT true,`;
if(content.includes(target2)) {
    content = content.replace(target2, replacement2);
    console.log('Patched files schema');
} else {
    console.log('Failed files schema');
}

// 3. Harden Projects RLS
const targetProjects1 = `CREATE POLICY "Projects are visible to workspace"
  ON projects FOR SELECT
  USING (workspace_id = current_workspace() AND deleted_at IS NULL);`;
const replacementProjects1 = `CREATE POLICY "Projects are visible to workspace"
  ON projects FOR SELECT
  USING (workspace_id = current_workspace() AND deleted_at IS NULL AND public.is_active_workspace_member());`;

if (content.includes(targetProjects1)) {
    content = content.replace(targetProjects1, replacementProjects1);
    console.log('Patched projects select');
} else {
    console.log('Failed projects select');
}

const targetProjects2 = `CREATE POLICY "Projects can be mutated by PMs and Admins"
  ON projects FOR ALL
  USING (
    workspace_id = current_workspace() AND
    EXISTS (SELECT 1 FROM public.users me WHERE me.id = auth.uid() AND me.workspace_id = current_workspace() AND me.role IN ('super_admin', 'pm'))
  )
  WITH CHECK (
    workspace_id = current_workspace() AND
    EXISTS (SELECT 1 FROM public.users me WHERE me.id = auth.uid() AND me.workspace_id = current_workspace() AND me.role IN ('super_admin', 'pm'))
  );`;
const replacementProjects2 = `CREATE POLICY "Projects can be mutated by PMs and Admins"
  ON projects FOR ALL
  USING (
    workspace_id = current_workspace() AND
    public.is_active_workspace_member() AND
    EXISTS (SELECT 1 FROM public.users me WHERE me.id = auth.uid() AND me.workspace_id = current_workspace() AND me.role IN ('super_admin', 'pm'))
  )
  WITH CHECK (
    workspace_id = current_workspace() AND
    public.is_active_workspace_member() AND
    EXISTS (SELECT 1 FROM public.users me WHERE me.id = auth.uid() AND me.workspace_id = current_workspace() AND me.role IN ('super_admin', 'pm'))
  );`;

if(content.includes(targetProjects2)) {
    content = content.replace(targetProjects2, replacementProjects2);
    console.log('Patched projects mutate');
} else {
    console.log('Failed projects mutate');
}

// 4. Harden Tasks RLS
const targetTasks1 = `CREATE POLICY "Tasks are visible to workspace"
  ON tasks FOR SELECT
  USING (workspace_id = current_workspace() AND deleted_at IS NULL);`;
const replacementTasks1 = `CREATE POLICY "Tasks are visible to workspace"
  ON tasks FOR SELECT
  USING (workspace_id = current_workspace() AND deleted_at IS NULL AND public.is_active_workspace_member());`;

if(content.includes(targetTasks1)) {
    content = content.replace(targetTasks1, replacementTasks1);
    console.log('Patched tasks select');
} else {
    console.log('Failed tasks select');
}

const targetTasks2 = `CREATE POLICY "Tasks can be created by PMs and Admins"
  ON tasks FOR INSERT
  WITH CHECK (
    workspace_id = current_workspace() AND
    EXISTS (SELECT 1 FROM public.users me WHERE me.id = auth.uid() AND me.workspace_id = current_workspace() AND me.role IN ('super_admin', 'pm'))
  );`;
const replacementTasks2 = `CREATE POLICY "Tasks can be created by PMs and Admins"
  ON tasks FOR INSERT
  WITH CHECK (
    workspace_id = current_workspace() AND
    public.is_active_workspace_member() AND
    EXISTS (SELECT 1 FROM public.users me WHERE me.id = auth.uid() AND me.workspace_id = current_workspace() AND me.role IN ('super_admin', 'pm'))
  );`;

if(content.includes(targetTasks2)) {
    content = content.replace(targetTasks2, replacementTasks2);
    console.log('Patched tasks create');
} else {
    console.log('Failed tasks create');
}

const targetTasks3 = `CREATE POLICY "Tasks can be fully updated by PMs and Admins"
  ON tasks FOR UPDATE
  USING (
    workspace_id = current_workspace() AND
    EXISTS (SELECT 1 FROM public.users me WHERE me.id = auth.uid() AND me.workspace_id = current_workspace() AND me.role IN ('super_admin', 'pm'))
  );`;
const replacementTasks3 = `CREATE POLICY "Tasks can be fully updated by PMs and Admins"
  ON tasks FOR UPDATE
  USING (
    workspace_id = current_workspace() AND
    public.is_active_workspace_member() AND
    EXISTS (SELECT 1 FROM public.users me WHERE me.id = auth.uid() AND me.workspace_id = current_workspace() AND me.role IN ('super_admin', 'pm'))
  );`;

if(content.includes(targetTasks3)) {
    content = content.replace(targetTasks3, replacementTasks3);
    console.log('Patched tasks update PM');
} else {
    console.log('Failed tasks update PM');
}

const targetTasks4 = `CREATE POLICY "Developers can update their assigned tasks"
  ON tasks FOR UPDATE
  USING (
    workspace_id = current_workspace() AND
    assignee_id = auth.uid() AND
    EXISTS (SELECT 1 FROM public.users me WHERE me.id = auth.uid() AND me.workspace_id = current_workspace() AND me.role = 'developer')
  );`;
const replacementTasks4 = `CREATE POLICY "Developers can update their assigned tasks"
  ON tasks FOR UPDATE
  USING (
    workspace_id = current_workspace() AND
    assignee_id = auth.uid() AND
    public.is_active_workspace_member() AND
    EXISTS (SELECT 1 FROM public.users me WHERE me.id = auth.uid() AND me.workspace_id = current_workspace() AND me.role = 'developer')
  );`;

if(content.includes(targetTasks4)) {
    content = content.replace(targetTasks4, replacementTasks4);
    console.log('Patched tasks update Dev');
} else {
    console.log('Failed tasks update Dev');
}

const targetTasks5 = `CREATE POLICY "Tasks can be deleted by PMs and Admins"
  ON tasks FOR DELETE
  USING (
    workspace_id = current_workspace() AND
    EXISTS (SELECT 1 FROM public.users me WHERE me.id = auth.uid() AND me.workspace_id = current_workspace() AND me.role IN ('super_admin', 'pm'))
  );`;
const replacementTasks5 = `CREATE POLICY "Tasks can be deleted by PMs and Admins"
  ON tasks FOR DELETE
  USING (
    workspace_id = current_workspace() AND
    public.is_active_workspace_member() AND
    EXISTS (SELECT 1 FROM public.users me WHERE me.id = auth.uid() AND me.workspace_id = current_workspace() AND me.role IN ('super_admin', 'pm'))
  );`;

if(content.includes(targetTasks5)) {
    content = content.replace(targetTasks5, replacementTasks5);
    console.log('Patched tasks delete');
} else {
    console.log('Failed tasks delete');
}

// 5. Comments
const targetComments1 = `CREATE POLICY "Comments are visible to workspace"
  ON comments FOR SELECT
  USING (workspace_id = current_workspace());`;
const replacementComments1 = `CREATE POLICY "Comments are visible to workspace"
  ON comments FOR SELECT
  USING (workspace_id = current_workspace() AND public.is_active_workspace_member());`;

if(content.includes(targetComments1)) {
    content = content.replace(targetComments1, replacementComments1);
    console.log('Patched comments select');
} else {
    console.log('Failed comments select');
}

const targetComments2 = `CREATE POLICY "Comments can be created by authenticated users"
  ON comments FOR INSERT
  WITH CHECK (
    workspace_id = current_workspace() AND
    author_id = auth.uid()
  );`;
const replacementComments2 = `CREATE POLICY "Comments can be created by authenticated users"
  ON comments FOR INSERT
  WITH CHECK (
    workspace_id = current_workspace() AND
    author_id = auth.uid() AND
    public.is_active_workspace_member()
  );`;

if(content.includes(targetComments2)) {
    content = content.replace(targetComments2, replacementComments2);
    console.log('Patched comments create');
} else {
    console.log('Failed comments create');
}

const targetComments3 = `CREATE POLICY "Comments can be moderated by PMs and Admins"
  ON comments FOR ALL
  USING (
    workspace_id = current_workspace() AND
    EXISTS (SELECT 1 FROM public.users me WHERE me.id = auth.uid() AND me.workspace_id = current_workspace() AND me.role IN ('super_admin', 'pm'))
  )
  WITH CHECK (
    workspace_id = current_workspace() AND
    EXISTS (SELECT 1 FROM public.users me WHERE me.id = auth.uid() AND me.workspace_id = current_workspace() AND me.role IN ('super_admin', 'pm'))
  );`;
const replacementComments3 = `CREATE POLICY "Comments can be moderated by PMs and Admins"
  ON comments FOR ALL
  USING (
    workspace_id = current_workspace() AND
    public.is_active_workspace_member() AND
    EXISTS (SELECT 1 FROM public.users me WHERE me.id = auth.uid() AND me.workspace_id = current_workspace() AND me.role IN ('super_admin', 'pm'))
  )
  WITH CHECK (
    workspace_id = current_workspace() AND
    public.is_active_workspace_member() AND
    EXISTS (SELECT 1 FROM public.users me WHERE me.id = auth.uid() AND me.workspace_id = current_workspace() AND me.role IN ('super_admin', 'pm'))
  );`;

if(content.includes(targetComments3)) {
    content = content.replace(targetComments3, replacementComments3);
    console.log('Patched comments moderate');
} else {
    console.log('Failed comments moderate');
}

const targetComments4 = `CREATE POLICY "Users can edit their own comments"
  ON comments FOR UPDATE
  USING (workspace_id = current_workspace() AND author_id = auth.uid());`;
const replacementComments4 = `CREATE POLICY "Users can edit their own comments"
  ON comments FOR UPDATE
  USING (workspace_id = current_workspace() AND author_id = auth.uid() AND public.is_active_workspace_member());`;

if(content.includes(targetComments4)) {
    content = content.replace(targetComments4, replacementComments4);
    console.log('Patched comments edit');
} else {
    console.log('Failed comments edit');
}

const targetComments5 = `CREATE POLICY "Users can delete their own comments"
  ON comments FOR DELETE
  USING (workspace_id = current_workspace() AND author_id = auth.uid());`;
const replacementComments5 = `CREATE POLICY "Users can delete their own comments"
  ON comments FOR DELETE
  USING (workspace_id = current_workspace() AND author_id = auth.uid() AND public.is_active_workspace_member());`;

if(content.includes(targetComments5)) {
    content = content.replace(targetComments5, replacementComments5);
    console.log('Patched comments delete');
} else {
    console.log('Failed comments delete');
}

// 6. Files
const targetFiles1 = `CREATE POLICY "Files are visible to workspace"
  ON files FOR SELECT
  USING (workspace_id = current_workspace());`;
const replacementFiles1 = `CREATE POLICY "Files are visible to workspace"
  ON files FOR SELECT
  USING (
    workspace_id = current_workspace() 
    AND public.is_active_workspace_member()
    AND (
      EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND workspace_id = current_workspace() AND role != 'client')
      OR
      (
        EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND workspace_id = current_workspace() AND role = 'client')
        AND is_internal = false
        AND EXISTS (
          SELECT 1 FROM projects WHERE projects.id = files.project_id AND projects.owner_id = auth.uid()
        )
      )
    )
  );`;

if(content.includes(targetFiles1)) {
    content = content.replace(targetFiles1, replacementFiles1);
    console.log('Patched files select');
} else {
    console.log('Failed files select');
}

const targetFiles2 = `CREATE POLICY "Files can be uploaded by authenticated users"
  ON files FOR INSERT
  WITH CHECK (
    workspace_id = current_workspace() AND
    uploaded_by = auth.uid()
  );`;
const replacementFiles2 = `CREATE POLICY "Files can be uploaded by authenticated users"
  ON files FOR INSERT
  WITH CHECK (
    workspace_id = current_workspace() AND
    uploaded_by = auth.uid() AND
    public.is_active_workspace_member()
  );`;

if(content.includes(targetFiles2)) {
    content = content.replace(targetFiles2, replacementFiles2);
    console.log('Patched files create');
} else {
    console.log('Failed files create');
}

const targetFiles3 = `CREATE POLICY "Files can be managed by PMs and Admins"
  ON files FOR ALL
  USING (
    workspace_id = current_workspace() AND
    EXISTS (SELECT 1 FROM public.users me WHERE me.id = auth.uid() AND me.workspace_id = current_workspace() AND me.role IN ('super_admin', 'pm'))
  )
  WITH CHECK (
    workspace_id = current_workspace() AND
    EXISTS (SELECT 1 FROM public.users me WHERE me.id = auth.uid() AND me.workspace_id = current_workspace() AND me.role IN ('super_admin', 'pm'))
  );`;
const replacementFiles3 = `CREATE POLICY "Files can be managed by PMs and Admins"
  ON files FOR ALL
  USING (
    workspace_id = current_workspace() AND
    public.is_active_workspace_member() AND
    EXISTS (SELECT 1 FROM public.users me WHERE me.id = auth.uid() AND me.workspace_id = current_workspace() AND me.role IN ('super_admin', 'pm'))
  )
  WITH CHECK (
    workspace_id = current_workspace() AND
    public.is_active_workspace_member() AND
    EXISTS (SELECT 1 FROM public.users me WHERE me.id = auth.uid() AND me.workspace_id = current_workspace() AND me.role IN ('super_admin', 'pm'))
  );`;

if(content.includes(targetFiles3)) {
    content = content.replace(targetFiles3, replacementFiles3);
    console.log('Patched files manage');
} else {
    console.log('Failed files manage');
}

// Convert back to CRLF before writing
content = content.replace(/\n/g, '\r\n');
fs.writeFileSync(filePath, content);
