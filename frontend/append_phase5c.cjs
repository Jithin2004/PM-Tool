const fs = require('fs');
const path = require('path');

const installSqlPath = path.join(__dirname, '../database/production/RESOLVE_PM_V1_3_INSTALL.sql');

const sqlToAppend = `
-- =============================================================================
-- Phase 5C: Document & Knowledge Management Engine
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.documents (
  id uuid NOT NULL DEFAULT uuid_generate_v4() PRIMARY KEY,
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  title text NOT NULL,
  description text,
  document_type text NOT NULL, -- requirement, specification, contract, proposal, meeting_note, design, policy, general
  entity_type text, -- project, task, epic, story, client, employee
  entity_id uuid,
  status text NOT NULL DEFAULT 'draft', -- draft, review, approved, archived
  current_version_id uuid, -- Reference to document_versions, added later or dynamically
  owner_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  visibility text NOT NULL DEFAULT 'workspace', -- workspace, team, restricted
  metadata jsonb DEFAULT '{}'::jsonb,
  archived_at timestamptz,
  archived_by uuid REFERENCES public.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.document_versions (
  id uuid NOT NULL DEFAULT uuid_generate_v4() PRIMARY KEY,
  document_id uuid NOT NULL REFERENCES public.documents(id) ON DELETE CASCADE,
  version_number integer NOT NULL,
  content text NOT NULL,
  file_metadata jsonb DEFAULT '{}'::jsonb,
  created_by uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  change_summary text,
  is_locked boolean DEFAULT false,
  approved_at timestamptz,
  approved_by uuid REFERENCES public.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Add foreign key constraint for current_version_id now that document_versions exists
ALTER TABLE public.documents ADD CONSTRAINT fk_documents_current_version FOREIGN KEY (current_version_id) REFERENCES public.document_versions(id) ON DELETE SET NULL;

CREATE TABLE IF NOT EXISTS public.document_access (
  document_id uuid NOT NULL REFERENCES public.documents(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  permission text NOT NULL, -- view, comment, edit, approve
  PRIMARY KEY (document_id, user_id)
);

CREATE TABLE IF NOT EXISTS public.document_chunks (
  id uuid NOT NULL DEFAULT uuid_generate_v4() PRIMARY KEY,
  document_id uuid NOT NULL REFERENCES public.documents(id) ON DELETE CASCADE,
  version_id uuid NOT NULL REFERENCES public.document_versions(id) ON DELETE CASCADE,
  chunk_index integer NOT NULL,
  content text NOT NULL,
  metadata jsonb DEFAULT '{}'::jsonb,
  embedding_status text NOT NULL DEFAULT 'pending', -- pending, processed
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Triggers for updated_at
CREATE TRIGGER update_documents_modtime
  BEFORE UPDATE ON public.documents
  FOR EACH ROW EXECUTE FUNCTION public.trigger_set_timestamp();

-- RLS Policies
ALTER TABLE public.documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.document_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.document_access ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.document_chunks ENABLE ROW LEVEL SECURITY;

-- Hybrid visibility function for documents
CREATE OR REPLACE FUNCTION public.can_view_document(doc_id uuid, check_user_id uuid)
RETURNS boolean AS $$
DECLARE
  v_workspace_id uuid;
  v_visibility text;
  v_owner_id uuid;
  v_entity_type text;
  v_entity_id uuid;
  v_user_role text;
  v_has_access boolean;
BEGIN
  -- Get document details
  SELECT workspace_id, visibility, owner_id, entity_type, entity_id INTO v_workspace_id, v_visibility, v_owner_id, v_entity_type, v_entity_id
  FROM public.documents WHERE id = doc_id AND archived_at IS NULL;

  IF NOT FOUND THEN RETURN false; END IF;

  -- Owner always has access
  IF v_owner_id = check_user_id THEN RETURN true; END IF;

  -- Get user role
  SELECT role INTO v_user_role FROM public.users WHERE id = check_user_id AND workspace_id = v_workspace_id;

  -- Super admins/owners have full access
  IF v_user_role IN ('super_admin', 'owner', 'admin') THEN RETURN true; END IF;

  -- Check explicit document_access
  SELECT true INTO v_has_access FROM public.document_access WHERE document_id = doc_id AND user_id = check_user_id LIMIT 1;
  IF v_has_access THEN RETURN true; END IF;

  -- Restricted documents require explicit access or owner/admin role (which we already checked)
  IF v_visibility = 'restricted' THEN RETURN false; END IF;

  -- If tied to an entity, defer to entity visibility
  IF v_entity_type = 'project' THEN
    SELECT true INTO v_has_access FROM public.project_members WHERE project_id = v_entity_id AND user_id = check_user_id LIMIT 1;
    IF v_has_access THEN RETURN true; END IF;
    IF v_user_role IN ('project_manager') THEN RETURN true; END IF;
    RETURN false;
  END IF;

  IF v_entity_type = 'task' THEN
    -- Check task access (assignee or project member)
    SELECT true INTO v_has_access FROM public.tasks t
    LEFT JOIN public.project_members pm ON t.project_id = pm.project_id AND pm.user_id = check_user_id
    WHERE t.id = v_entity_id AND (t.assignee_id = check_user_id OR pm.user_id IS NOT NULL);
    IF v_has_access THEN RETURN true; END IF;
    RETURN false;
  END IF;

  -- Finance/HR role boundaries
  IF v_entity_type IN ('invoice', 'client') AND v_user_role NOT IN ('finance', 'project_manager') THEN RETURN false; END IF;
  IF v_entity_type IN ('employee') AND v_user_role NOT IN ('hr') THEN RETURN false; END IF;

  -- Workspace visibility
  IF v_visibility = 'workspace' THEN
    RETURN public.is_active_workspace_member_custom(check_user_id, v_workspace_id);
  END IF;

  RETURN false;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Need a helper for checking active workspace member with explicit user id
CREATE OR REPLACE FUNCTION public.is_active_workspace_member_custom(check_user_id uuid, check_workspace_id uuid)
RETURNS boolean AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.users u
    WHERE u.id = check_user_id
      AND u.workspace_id = check_workspace_id
      AND u.role != 'uninvited'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- Document RLS
CREATE POLICY "View documents" ON public.documents FOR SELECT USING (public.can_view_document(id, auth.uid()));
CREATE POLICY "Insert documents" ON public.documents FOR INSERT WITH CHECK (workspace_id = public.current_workspace() AND public.is_active_workspace_member());
CREATE POLICY "Update documents" ON public.documents FOR UPDATE USING (owner_id = auth.uid() OR public.has_role_in_workspace(auth.uid(), workspace_id, 'admin') OR EXISTS(SELECT 1 FROM public.document_access WHERE document_id = id AND user_id = auth.uid() AND permission IN ('edit', 'approve')));

-- Document Versions RLS
CREATE POLICY "View document versions" ON public.document_versions FOR SELECT USING (public.can_view_document(document_id, auth.uid()));
CREATE POLICY "Insert document versions" ON public.document_versions FOR INSERT WITH CHECK (EXISTS(SELECT 1 FROM public.documents WHERE id = document_id AND (owner_id = auth.uid() OR public.has_role_in_workspace(auth.uid(), workspace_id, 'admin') OR EXISTS(SELECT 1 FROM public.document_access WHERE document_id = id AND user_id = auth.uid() AND permission IN ('edit', 'approve')))));

-- Document Access RLS
CREATE POLICY "View document access" ON public.document_access FOR SELECT USING (public.can_view_document(document_id, auth.uid()));
CREATE POLICY "Manage document access" ON public.document_access FOR ALL USING (EXISTS(SELECT 1 FROM public.documents WHERE id = document_id AND (owner_id = auth.uid() OR public.has_role_in_workspace(auth.uid(), workspace_id, 'admin'))));

-- Document Chunks RLS
CREATE POLICY "View document chunks" ON public.document_chunks FOR SELECT USING (public.can_view_document(document_id, auth.uid()));
CREATE POLICY "Manage document chunks" ON public.document_chunks FOR ALL USING (EXISTS(SELECT 1 FROM public.documents WHERE id = document_id AND (owner_id = auth.uid() OR public.has_role_in_workspace(auth.uid(), workspace_id, 'admin') OR EXISTS(SELECT 1 FROM public.document_access WHERE document_id = id AND user_id = auth.uid() AND permission IN ('edit', 'approve')))));

-- Indexes
CREATE INDEX IF NOT EXISTS idx_documents_workspace_entity ON public.documents(workspace_id, entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_document_versions_doc_id ON public.document_versions(document_id);
CREATE INDEX IF NOT EXISTS idx_document_access_doc_id ON public.document_access(document_id);

`;

let sqlText = fs.readFileSync(installSqlPath, 'utf8');
if (!sqlText.includes('Phase 5C: Document & Knowledge Management Engine')) {
    fs.writeFileSync(installSqlPath, sqlText + '\n\n' + sqlToAppend, 'utf8');
    console.log('Appended Phase 5C successfully.');
} else {
    console.log('Phase 5C already exists, skipping append.');
}
