-- =====================================================================
-- PHASE 5A: Collaboration & Discussion Engine
-- =====================================================================

CREATE TABLE public.entity_comments (
  id uuid NOT NULL DEFAULT uuid_generate_v4() PRIMARY KEY,
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  entity_type text NOT NULL,
  entity_id uuid NOT NULL,
  parent_comment_id uuid REFERENCES public.entity_comments(id) ON DELETE CASCADE,
  author_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  content text NOT NULL,
  mentions jsonb DEFAULT '[]'::jsonb,
  attachments jsonb DEFAULT '[]'::jsonb,
  resolved_at timestamptz,
  resolved_by uuid REFERENCES public.users(id) ON DELETE SET NULL,
  edited_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.comment_versions (
  id uuid NOT NULL DEFAULT uuid_generate_v4() PRIMARY KEY,
  comment_id uuid NOT NULL REFERENCES public.entity_comments(id) ON DELETE CASCADE,
  previous_content text NOT NULL,
  edited_by uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  edited_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.comment_reactions (
  id uuid NOT NULL DEFAULT uuid_generate_v4() PRIMARY KEY,
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  comment_id uuid NOT NULL REFERENCES public.entity_comments(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  emoji text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(comment_id, user_id, emoji)
);

CREATE TABLE public.entity_watchers (
  id uuid NOT NULL DEFAULT uuid_generate_v4() PRIMARY KEY,
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  entity_type text NOT NULL,
  entity_id uuid NOT NULL,
  user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(entity_type, entity_id, user_id)
);

-- RLS
ALTER TABLE public.entity_comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.comment_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.comment_reactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.entity_watchers ENABLE ROW LEVEL SECURITY;

-- Triggers
CREATE TRIGGER update_entity_comments_modtime
  BEFORE UPDATE ON public.entity_comments
  FOR EACH ROW EXECUTE FUNCTION public.trigger_set_timestamp();

-- Comments RLS
CREATE POLICY "Workspace members can view comments" ON public.entity_comments FOR SELECT USING (workspace_id = public.current_workspace() AND public.is_active_workspace_member());
CREATE POLICY "Members can insert comments" ON public.entity_comments FOR INSERT WITH CHECK (workspace_id = public.current_workspace() AND public.is_active_workspace_member() AND author_id = auth.uid());
CREATE POLICY "Authors can update comments" ON public.entity_comments FOR UPDATE USING (author_id = auth.uid() AND public.is_active_workspace_member());
CREATE POLICY "Authors or admins can delete comments" ON public.entity_comments FOR DELETE USING ((author_id = auth.uid() OR public.has_role_in_workspace(auth.uid(), workspace_id, 'admin') OR public.has_role_in_workspace(auth.uid(), workspace_id, 'owner')) AND public.is_active_workspace_member());

-- Versions RLS
CREATE POLICY "Workspace members can view comment versions" ON public.comment_versions FOR SELECT USING (comment_id IN (SELECT id FROM public.entity_comments WHERE workspace_id = public.current_workspace()) AND public.is_active_workspace_member());
CREATE POLICY "Authors can insert comment versions" ON public.comment_versions FOR INSERT WITH CHECK (edited_by = auth.uid() AND public.is_active_workspace_member());

-- Reactions RLS
CREATE POLICY "Workspace members can view reactions" ON public.comment_reactions FOR SELECT USING (workspace_id = public.current_workspace() AND public.is_active_workspace_member());
CREATE POLICY "Members can insert reactions" ON public.comment_reactions FOR INSERT WITH CHECK (workspace_id = public.current_workspace() AND public.is_active_workspace_member() AND user_id = auth.uid());
CREATE POLICY "Users can delete their own reactions" ON public.comment_reactions FOR DELETE USING (user_id = auth.uid() AND public.is_active_workspace_member());

-- Watchers RLS
CREATE POLICY "Workspace members can view watchers" ON public.entity_watchers FOR SELECT USING (workspace_id = public.current_workspace() AND public.is_active_workspace_member());
CREATE POLICY "Members can insert watchers" ON public.entity_watchers FOR INSERT WITH CHECK (workspace_id = public.current_workspace() AND public.is_active_workspace_member() AND user_id = auth.uid());
CREATE POLICY "Users can delete their own watcher status" ON public.entity_watchers FOR DELETE USING (user_id = auth.uid() AND public.is_active_workspace_member());

-- =============================================================================
-- Phase 5B: Universal Search & Command Center
-- =============================================================================

CREATE TABLE public.search_index (
  id uuid NOT NULL DEFAULT uuid_generate_v4() PRIMARY KEY,
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  entity_type text NOT NULL,
  entity_id uuid NOT NULL,
  title text NOT NULL,
  content text,
  keywords jsonb,
  metadata jsonb,
  search_vector tsvector,
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(entity_type, entity_id)
);

-- Trigger to auto-update updated_at
CREATE TRIGGER update_search_index_modtime
  BEFORE UPDATE ON public.search_index
  FOR EACH ROW EXECUTE FUNCTION public.trigger_set_timestamp();

-- Enable GIN Indexing for tsvector
CREATE INDEX search_index_vector_idx ON public.search_index USING GIN (search_vector);
CREATE INDEX search_index_workspace_idx ON public.search_index (workspace_id);
CREATE INDEX search_index_entity_type_idx ON public.search_index (entity_type);

-- RLS
ALTER TABLE public.search_index ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Workspace members can view search_index" ON public.search_index FOR SELECT USING (workspace_id = public.current_workspace() AND public.is_active_workspace_member());
CREATE POLICY "Workspace members can insert search_index" ON public.search_index FOR INSERT WITH CHECK (workspace_id = public.current_workspace() AND public.is_active_workspace_member());
CREATE POLICY "Workspace members can update search_index" ON public.search_index FOR UPDATE USING (workspace_id = public.current_workspace() AND public.is_active_workspace_member());
CREATE POLICY "Workspace members can delete search_index" ON public.search_index FOR DELETE USING (workspace_id = public.current_workspace() AND public.is_active_workspace_member());


CREATE TABLE public.recent_entities (
  id uuid NOT NULL DEFAULT uuid_generate_v4() PRIMARY KEY,
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  entity_type text NOT NULL,
  entity_id uuid NOT NULL,
  opened_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, entity_type, entity_id)
);

CREATE INDEX recent_entities_user_idx ON public.recent_entities(user_id, opened_at DESC);

-- RLS
ALTER TABLE public.recent_entities ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own recent entities" ON public.recent_entities FOR SELECT USING (user_id = auth.uid() AND workspace_id = public.current_workspace() AND public.is_active_workspace_member());
CREATE POLICY "Users can insert own recent entities" ON public.recent_entities FOR INSERT WITH CHECK (user_id = auth.uid() AND workspace_id = public.current_workspace() AND public.is_active_workspace_member());
CREATE POLICY "Users can update own recent entities" ON public.recent_entities FOR UPDATE USING (user_id = auth.uid() AND workspace_id = public.current_workspace() AND public.is_active_workspace_member());
CREATE POLICY "Users can delete own recent entities" ON public.recent_entities FOR DELETE USING (user_id = auth.uid() AND workspace_id = public.current_workspace() AND public.is_active_workspace_member());


-- RPC for Universal Search
CREATE OR REPLACE FUNCTION public.search_workspace(
  query_text text,
  search_workspace_id uuid,
  entity_filters text[],
  limit_count integer DEFAULT 20
)
RETURNS TABLE (
  id uuid,
  entity_type text,
  entity_id uuid,
  title text,
  content text,
  metadata jsonb,
  rank float4
)
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = ''
AS $$
BEGIN
  RETURN QUERY
  SELECT
    si.id,
    si.entity_type,
    si.entity_id,
    si.title,
    si.content,
    si.metadata,
    -- Ranking priority: Exact UID match > Title match > Keyword match > Content match
    -- metadata->>'uid' helps prioritize explicit ID searches
    (
      ts_rank(si.search_vector, plainto_tsquery('english', query_text)) + 
      (similarity(si.title, query_text) * 2.0) +
      (CASE WHEN si.metadata->>'uid' ILIKE '%' || query_text || '%' THEN 5.0 ELSE 0.0 END)
    ) AS rank
  FROM public.search_index si
  WHERE si.workspace_id = search_workspace_id
    AND (array_length(entity_filters, 1) IS NULL OR si.entity_type = ANY(entity_filters))
    AND (
      si.search_vector @@ plainto_tsquery('english', query_text)
      OR si.title ILIKE '%' || query_text || '%'
      OR si.content ILIKE '%' || query_text || '%'
      OR si.metadata->>'uid' ILIKE '%' || query_text || '%'
    )
  ORDER BY rank DESC
  LIMIT limit_count;
END;
$$;
