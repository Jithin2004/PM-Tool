const fs = require('fs');
const path = require('path');

const filePath = path.resolve('C:/Users/jithi/OneDrive/Desktop/Resolve PM/Resolve PM/database/production/RESOLVE_PM_V1_3_INSTALL.sql');
let content = fs.readFileSync(filePath, 'utf8');

// 1. Add `is_active_workspace_member()`
const target1 = `  SELECT workspace_id FROM users WHERE id = auth.uid() LIMIT 1
$$;`;
const replacement1 = `  SELECT workspace_id FROM users WHERE id = auth.uid() LIMIT 1
$$;

-- Returns true if the currently authenticated user is an active workspace member.
CREATE OR REPLACE FUNCTION public.is_active_workspace_member()
RETURNS boolean AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 
    FROM public.users 
    WHERE id = auth.uid() 
      AND workspace_id = current_workspace() 
      AND status = 'active'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = '';`;
content = content.replace(target1, replacement1);

// 2. Add `is_internal` to `files` schema
const target2 = `  mime_type     text,
  size_bytes    bigint,`;
const replacement2 = `  mime_type     text,
  size_bytes    bigint,
  is_internal   boolean     NOT NULL DEFAULT true,`;
content = content.replace(target2, replacement2);

// 3. Harden Projects RLS
const targetProjects1 = `CREATE POLICY "Projects are visible to workspace"
  ON projects FOR SELECT
  USING (workspace_id = current_workspace() AND deleted_at IS NULL);`;
const replacementProjects1 = `CREATE POLICY "Projects are visible to workspace"
  ON projects FOR SELECT
  USING (workspace_id = current_workspace() AND deleted_at IS NULL AND public.is_active_workspace_member());`;

const targetProjects2 = `  USING (
    workspace_id = current_workspace() AND
    EXISTS (SELECT 1 FROM public.users me WHERE me.id = auth.uid() AND me.workspace_id = current_workspace() AND me.role IN ('super_admin', 'pm'))
  )
  WITH CHECK (
    workspace_id = current_workspace() AND
    EXISTS (SELECT 1 FROM public.users me WHERE me.id = auth.uid() AND me.workspace_id = current_workspace() AND me.role IN ('super_admin', 'pm'))
  );`;
// Note: Since targetProjects2 pattern matches multiple tables (projects, tasks, comments, files etc), we must be careful or just use string replace loop.
// Wait, projects has this EXACT block. Let's do a more precise replace.
content = content.replace(targetProjects1, replacementProjects1);

content = content.replace(`CREATE POLICY "Projects can be mutated by PMs and Admins"
  ON projects FOR ALL
  USING (
    workspace_id = current_workspace() AND
    EXISTS (SELECT 1 FROM public.users me WHERE me.id = auth.uid() AND me.workspace_id = current_workspace() AND me.role IN ('super_admin', 'pm'))
  )
  WITH CHECK (
    workspace_id = current_workspace() AND
    EXISTS (SELECT 1 FROM public.users me WHERE me.id = auth.uid() AND me.workspace_id = current_workspace() AND me.role IN ('super_admin', 'pm'))
  );`, `CREATE POLICY "Projects can be mutated by PMs and Admins"
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
  );`);

// 4. Harden Tasks RLS
content = content.replace(`CREATE POLICY "Tasks are visible to workspace"
  ON tasks FOR SELECT
  USING (workspace_id = current_workspace() AND deleted_at IS NULL);`, `CREATE POLICY "Tasks are visible to workspace"
  ON tasks FOR SELECT
  USING (workspace_id = current_workspace() AND deleted_at IS NULL AND public.is_active_workspace_member());`);

content = content.replace(`CREATE POLICY "Tasks can be created by PMs and Admins"
  ON tasks FOR INSERT
  WITH CHECK (
    workspace_id = current_workspace() AND
    EXISTS (SELECT 1 FROM public.users me WHERE me.id = auth.uid() AND me.workspace_id = current_workspace() AND me.role IN ('super_admin', 'pm'))
  );`, `CREATE POLICY "Tasks can be created by PMs and Admins"
  ON tasks FOR INSERT
  WITH CHECK (
    workspace_id = current_workspace() AND
    public.is_active_workspace_member() AND
    EXISTS (SELECT 1 FROM public.users me WHERE me.id = auth.uid() AND me.workspace_id = current_workspace() AND me.role IN ('super_admin', 'pm'))
  );`);

content = content.replace(`CREATE POLICY "Tasks can be fully updated by PMs and Admins"
  ON tasks FOR UPDATE
  USING (
    workspace_id = current_workspace() AND
    EXISTS (SELECT 1 FROM public.users me WHERE me.id = auth.uid() AND me.workspace_id = current_workspace() AND me.role IN ('super_admin', 'pm'))
  );`, `CREATE POLICY "Tasks can be fully updated by PMs and Admins"
  ON tasks FOR UPDATE
  USING (
    workspace_id = current_workspace() AND
    public.is_active_workspace_member() AND
    EXISTS (SELECT 1 FROM public.users me WHERE me.id = auth.uid() AND me.workspace_id = current_workspace() AND me.role IN ('super_admin', 'pm'))
  );`);

content = content.replace(`CREATE POLICY "Developers can update their assigned tasks"
  ON tasks FOR UPDATE
  USING (
    workspace_id = current_workspace() AND
    assignee_id = auth.uid() AND
    EXISTS (SELECT 1 FROM public.users me WHERE me.id = auth.uid() AND me.workspace_id = current_workspace() AND me.role = 'developer')
  );`, `CREATE POLICY "Developers can update their assigned tasks"
  ON tasks FOR UPDATE
  USING (
    workspace_id = current_workspace() AND
    assignee_id = auth.uid() AND
    public.is_active_workspace_member() AND
    EXISTS (SELECT 1 FROM public.users me WHERE me.id = auth.uid() AND me.workspace_id = current_workspace() AND me.role = 'developer')
  );`);

content = content.replace(`CREATE POLICY "Tasks can be deleted by PMs and Admins"
  ON tasks FOR DELETE
  USING (
    workspace_id = current_workspace() AND
    EXISTS (SELECT 1 FROM public.users me WHERE me.id = auth.uid() AND me.workspace_id = current_workspace() AND me.role IN ('super_admin', 'pm'))
  );`, `CREATE POLICY "Tasks can be deleted by PMs and Admins"
  ON tasks FOR DELETE
  USING (
    workspace_id = current_workspace() AND
    public.is_active_workspace_member() AND
    EXISTS (SELECT 1 FROM public.users me WHERE me.id = auth.uid() AND me.workspace_id = current_workspace() AND me.role IN ('super_admin', 'pm'))
  );`);


// 5. Comments
content = content.replace(`CREATE POLICY "Comments are visible to workspace"
  ON comments FOR SELECT
  USING (workspace_id = current_workspace());`, `CREATE POLICY "Comments are visible to workspace"
  ON comments FOR SELECT
  USING (workspace_id = current_workspace() AND public.is_active_workspace_member());`);

content = content.replace(`CREATE POLICY "Comments can be created by authenticated users"
  ON comments FOR INSERT
  WITH CHECK (
    workspace_id = current_workspace() AND
    author_id = auth.uid()
  );`, `CREATE POLICY "Comments can be created by authenticated users"
  ON comments FOR INSERT
  WITH CHECK (
    workspace_id = current_workspace() AND
    author_id = auth.uid() AND
    public.is_active_workspace_member()
  );`);

content = content.replace(`CREATE POLICY "Comments can be moderated by PMs and Admins"
  ON comments FOR ALL
  USING (
    workspace_id = current_workspace() AND
    EXISTS (SELECT 1 FROM public.users me WHERE me.id = auth.uid() AND me.workspace_id = current_workspace() AND me.role IN ('super_admin', 'pm'))
  )
  WITH CHECK (
    workspace_id = current_workspace() AND
    EXISTS (SELECT 1 FROM public.users me WHERE me.id = auth.uid() AND me.workspace_id = current_workspace() AND me.role IN ('super_admin', 'pm'))
  );`, `CREATE POLICY "Comments can be moderated by PMs and Admins"
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
  );`);

content = content.replace(`CREATE POLICY "Users can edit their own comments"
  ON comments FOR UPDATE
  USING (workspace_id = current_workspace() AND author_id = auth.uid());`, `CREATE POLICY "Users can edit their own comments"
  ON comments FOR UPDATE
  USING (workspace_id = current_workspace() AND author_id = auth.uid() AND public.is_active_workspace_member());`);

content = content.replace(`CREATE POLICY "Users can delete their own comments"
  ON comments FOR DELETE
  USING (workspace_id = current_workspace() AND author_id = auth.uid());`, `CREATE POLICY "Users can delete their own comments"
  ON comments FOR DELETE
  USING (workspace_id = current_workspace() AND author_id = auth.uid() AND public.is_active_workspace_member());`);

// 6. Files
content = content.replace(`CREATE POLICY "Files are visible to workspace"
  ON files FOR SELECT
  USING (workspace_id = current_workspace());`, `CREATE POLICY "Files are visible to workspace"
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
  );`);

content = content.replace(`CREATE POLICY "Files can be uploaded by authenticated users"
  ON files FOR INSERT
  WITH CHECK (
    workspace_id = current_workspace() AND
    uploaded_by = auth.uid()
  );`, `CREATE POLICY "Files can be uploaded by authenticated users"
  ON files FOR INSERT
  WITH CHECK (
    workspace_id = current_workspace() AND
    uploaded_by = auth.uid() AND
    public.is_active_workspace_member()
  );`);

content = content.replace(`CREATE POLICY "Files can be managed by PMs and Admins"
  ON files FOR ALL
  USING (
    workspace_id = current_workspace() AND
    EXISTS (SELECT 1 FROM public.users me WHERE me.id = auth.uid() AND me.workspace_id = current_workspace() AND me.role IN ('super_admin', 'pm'))
  )
  WITH CHECK (
    workspace_id = current_workspace() AND
    EXISTS (SELECT 1 FROM public.users me WHERE me.id = auth.uid() AND me.workspace_id = current_workspace() AND me.role IN ('super_admin', 'pm'))
  );`, `CREATE POLICY "Files can be managed by PMs and Admins"
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
  );`);

fs.writeFileSync(filePath, content);
console.log('Successfully patched RESOLVE_PM_V1_3_INSTALL.sql');
