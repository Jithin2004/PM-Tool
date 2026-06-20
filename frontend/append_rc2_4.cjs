const fs = require('fs');
const path = require('path');

const installSqlPath = path.join(__dirname, '../database/production/RESOLVE_PM_V1_3_INSTALL.sql');

const sqlToAppend = `
-- =============================================================================
-- RC2.4: Universal Search Production Hardening
-- =============================================================================

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
DECLARE
  caller_role text;
BEGIN
  -- Get caller role
  SELECT role INTO caller_role
  FROM public.users
  WHERE users.id = auth.uid() AND users.workspace_id = search_workspace_id
  LIMIT 1;

  RETURN QUERY
  WITH candidates AS (
    SELECT
      si.id,
      si.entity_type,
      si.entity_id,
      si.title,
      si.content,
      si.metadata,
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
    LIMIT 100 -- Limit CTE for performance
  )
  SELECT c.id, c.entity_type, c.entity_id, c.title, c.content, c.metadata, c.rank FROM candidates c
  WHERE
    caller_role IN ('owner', 'admin', 'super_admin')
    OR (
      -- Branching security
      CASE c.entity_type
        WHEN 'task' THEN
          EXISTS (
            SELECT 1 FROM public.tasks t 
            WHERE t.id = c.entity_id 
              AND (t.assignee_id = auth.uid() 
                   OR EXISTS (
                     SELECT 1 FROM public.project_members pm 
                     WHERE pm.project_id = t.project_id AND pm.user_id = auth.uid()
                   )
                   OR caller_role IN ('project_manager')
              )
          )
        WHEN 'project' THEN
          EXISTS (
            SELECT 1 FROM public.project_members pm 
            WHERE pm.project_id = c.entity_id AND pm.user_id = auth.uid()
          ) OR caller_role IN ('project_manager')
        WHEN 'document' THEN
          EXISTS (
            SELECT 1 FROM public.files f
            LEFT JOIN public.tasks t ON f.task_id = t.id
            LEFT JOIN public.projects p ON t.project_id = p.id
            LEFT JOIN public.project_members pm ON p.id = pm.project_id
            WHERE f.id = c.entity_id 
              AND (pm.user_id = auth.uid() OR t.project_id IS NULL OR caller_role IN ('project_manager'))
          )
        WHEN 'invoice' THEN
          caller_role IN ('finance')
        WHEN 'finance' THEN
          caller_role IN ('finance')
        WHEN 'ledger' THEN
          caller_role IN ('finance')
        WHEN 'employee' THEN
          caller_role IN ('hr')
        WHEN 'user' THEN
          true
        ELSE
          true
      END
    )
  ORDER BY c.rank DESC
  LIMIT limit_count;
END;
$$;

-- Indexes
CREATE INDEX IF NOT EXISTS idx_search_index_workspace_entity
ON public.search_index(
 workspace_id,
 entity_type,
 entity_id
);

CREATE INDEX IF NOT EXISTS idx_search_index_workspace_rank
ON public.search_index(
 workspace_id
);

CREATE INDEX IF NOT EXISTS idx_tasks_visibility
ON public.tasks(
 workspace_id,
 assignee_id,
 project_id
);

CREATE INDEX IF NOT EXISTS idx_project_members_lookup
ON public.project_members(
 project_id,
 user_id
);
`;

let sqlText = fs.readFileSync(installSqlPath, 'utf8');
if (!sqlText.includes('RC2.4: Universal Search Production Hardening')) {
    fs.writeFileSync(installSqlPath, sqlText + '\n\n' + sqlToAppend, 'utf8');
    console.log('Appended RC2.4 successfully.');
} else {
    console.log('RC2.4 already exists, skipping append.');
}
