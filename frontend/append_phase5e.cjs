const fs = require('fs');
const path = require('path');

const installFile = path.join(__dirname, 'src', '..', '..', 'database', 'production', 'RESOLVE_PM_V1_3_INSTALL.sql');

const phase5e_sql = `

-- =====================================================================================
-- PHASE 5E: FILE & ASSET MANAGEMENT ENGINE
-- =====================================================================================

CREATE TABLE IF NOT EXISTS public.workspace_storage_usage (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE UNIQUE,
    used_bytes bigint NOT NULL DEFAULT 0,
    quota_bytes bigint NOT NULL DEFAULT 5368709120, -- 5GB default
    updated_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.files (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    uploaded_by uuid REFERENCES users(id) ON DELETE SET NULL,
    storage_provider text NOT NULL DEFAULT 'supabase',
    storage_path text NOT NULL,
    original_name text NOT NULL,
    mime_type text,
    file_size bigint NOT NULL DEFAULT 0,
    checksum text,
    metadata jsonb DEFAULT '{}'::jsonb,
    created_at timestamptz DEFAULT now(),
    archived_at timestamptz
);

CREATE TABLE IF NOT EXISTS public.file_versions (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    file_id uuid NOT NULL REFERENCES files(id) ON DELETE CASCADE,
    version_number integer NOT NULL DEFAULT 1,
    storage_path text NOT NULL,
    uploaded_by uuid REFERENCES users(id) ON DELETE SET NULL,
    checksum text,
    size bigint NOT NULL DEFAULT 0,
    created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.file_links (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    file_id uuid NOT NULL REFERENCES files(id) ON DELETE CASCADE,
    entity_type text NOT NULL,
    entity_id uuid NOT NULL,
    relationship text DEFAULT 'attachment',
    created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.file_access (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    file_id uuid NOT NULL REFERENCES files(id) ON DELETE CASCADE,
    user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    permission text NOT NULL DEFAULT 'view', -- view, download, edit, manage
    created_at timestamptz DEFAULT now(),
    UNIQUE(file_id, user_id)
);

CREATE TABLE IF NOT EXISTS public.file_events (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    file_id uuid NOT NULL REFERENCES files(id) ON DELETE CASCADE,
    action text NOT NULL, -- uploaded, downloaded, shared, version_created, deleted, restored
    actor_id uuid REFERENCES users(id) ON DELETE SET NULL,
    metadata jsonb DEFAULT '{}'::jsonb,
    created_at timestamptz DEFAULT now()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_files_workspace ON public.files(workspace_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_file_versions_file ON public.file_versions(file_id, version_number DESC);
CREATE INDEX IF NOT EXISTS idx_file_links_entity ON public.file_links(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_file_events_file ON public.file_events(file_id, created_at DESC);

-- RLS
ALTER TABLE public.workspace_storage_usage ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.files ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.file_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.file_links ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.file_access ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.file_events ENABLE ROW LEVEL SECURITY;

-- Basic Workspace Isolation Policies
CREATE OR REPLACE FUNCTION public.apply_file_engine_isolation() RETURNS void AS $$
DECLARE
    t text;
BEGIN
    FOR t IN 
        SELECT table_name 
        FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name IN (
            'workspace_storage_usage', 'files', 'file_links', 'file_events'
        )
    LOOP
        EXECUTE format('DROP POLICY IF EXISTS "Workspace isolation %I" ON public.%I', t, t);
        EXECUTE format('CREATE POLICY "Workspace isolation %I" ON public.%I FOR ALL USING (
            workspace_id IN (
                SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid()
            )
        )', t, t);
    END LOOP;
END;
$$ LANGUAGE plpgsql;

SELECT public.apply_file_engine_isolation();

-- Special Isolation for file_versions and file_access
DROP POLICY IF EXISTS "Workspace isolation file_versions" ON public.file_versions;
CREATE POLICY "Workspace isolation file_versions" ON public.file_versions FOR ALL USING (
    EXISTS (
        SELECT 1 FROM files f 
        JOIN workspace_members wm ON wm.workspace_id = f.workspace_id
        WHERE f.id = file_versions.file_id AND wm.user_id = auth.uid()
    )
);

DROP POLICY IF EXISTS "Workspace isolation file_access" ON public.file_access;
CREATE POLICY "Workspace isolation file_access" ON public.file_access FOR ALL USING (
    EXISTS (
        SELECT 1 FROM files f 
        JOIN workspace_members wm ON wm.workspace_id = f.workspace_id
        WHERE f.id = file_access.file_id AND wm.user_id = auth.uid()
    )
);

`;

try {
  let content = fs.readFileSync(installFile, 'utf8');
  if (!content.includes('PHASE 5E: FILE & ASSET MANAGEMENT ENGINE')) {
    fs.appendFileSync(installFile, phase5e_sql);
    console.log('Phase 5E SQL successfully appended to RESOLVE_PM_V1_3_INSTALL.sql');
  } else {
    console.log('Phase 5E SQL already exists in RESOLVE_PM_V1_3_INSTALL.sql');
  }
} catch (err) {
  console.error('Error appending Phase 5E SQL:', err);
}
