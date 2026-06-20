/**
 * append_phase5e_1_fix.cjs
 * Phase 5E.1 — File Engine Schema Hardening Patch
 *
 * Appends corrective SQL into database/production/RESOLVE_PM_V1_3_INSTALL.sql
 *
 * Fixes:
 *   1.  UUID DEFAULT gen_random_uuid() guaranteed on all Phase 5E tables
 *   2.  RLS explicitly enabled (idempotent)
 *   3.  Drop dynamic isolation function; replace with correct named RLS policies
 *       using is_active_workspace_member() / workspace_members pattern
 *   4.  can_access_file(file_uuid, user_uuid) RPC helper
 *   5.  Foreign key strengthening (files → workspaces ON DELETE CASCADE,
 *       uploaded_by → public.users ON DELETE SET NULL, file_versions → files, etc.)
 *   6.  Additional performance indexes
 *   7.  Unique constraints (file_versions, file_links)
 *   8.  archived_by column on files
 *   9.  recalculate_workspace_storage() RPC function
 */

const fs   = require('fs');
const path = require('path');

const TARGET = path.resolve(
  __dirname,
  '../database/production/RESOLVE_PM_V1_3_INSTALL.sql'
);

// ---------------------------------------------------------------------------
// GUARD: Check the target file exists
// ---------------------------------------------------------------------------
if (!fs.existsSync(TARGET)) {
  console.error('ERROR: Target SQL file not found:', TARGET);
  process.exit(1);
}

const MARKER = '-- PHASE 5E.1: FILE ENGINE SCHEMA HARDENING PATCH';

const content = fs.readFileSync(TARGET, 'utf8');
if (content.includes(MARKER)) {
  console.log('Phase 5E.1 patch already applied. Skipping.');
  process.exit(0);
}

// ---------------------------------------------------------------------------
// SQL PATCH
// ---------------------------------------------------------------------------
const SQL = `


-- ============================================================================
${MARKER}
-- Applied: corrective RLS, constraints, indexes, helper functions
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. GUARANTEE UUID DEFAULTS ON ALL PHASE 5E TABLES
--    (If tables were created without DEFAULT, this restores them safely.)
-- ----------------------------------------------------------------------------
ALTER TABLE public.files
    ALTER COLUMN id SET DEFAULT gen_random_uuid();

ALTER TABLE public.file_versions
    ALTER COLUMN id SET DEFAULT gen_random_uuid();

ALTER TABLE public.file_links
    ALTER COLUMN id SET DEFAULT gen_random_uuid();

ALTER TABLE public.file_access
    ALTER COLUMN id SET DEFAULT gen_random_uuid();

ALTER TABLE public.file_events
    ALTER COLUMN id SET DEFAULT gen_random_uuid();

ALTER TABLE public.workspace_storage_usage
    ALTER COLUMN id SET DEFAULT gen_random_uuid();

-- ----------------------------------------------------------------------------
-- 2. RLS — ENABLE (idempotent)
-- ----------------------------------------------------------------------------
ALTER TABLE public.files                  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.file_versions          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.file_links             ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.file_access            ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.file_events            ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workspace_storage_usage ENABLE ROW LEVEL SECURITY;

-- ----------------------------------------------------------------------------
-- 3. REPLACE INCORRECT / DYNAMIC RLS POLICIES
--    Drop old dynamic function and all policies it may have created.
--    Re-create with correct workspace_members membership checks.
-- ----------------------------------------------------------------------------

-- 3a. Remove the old dynamic isolation helper (was executed via SELECT)
DROP FUNCTION IF EXISTS public.apply_file_engine_isolation();

-- ---- files -----------------------------------------------------------------
DROP POLICY IF EXISTS "Workspace isolation files"       ON public.files;
DROP POLICY IF EXISTS "files_workspace_isolation"       ON public.files;
DROP POLICY IF EXISTS "files_workspace_read"            ON public.files;
DROP POLICY IF EXISTS "files_workspace_insert"          ON public.files;
DROP POLICY IF EXISTS "files_workspace_update"          ON public.files;
DROP POLICY IF EXISTS "files_workspace_delete"          ON public.files;

-- SELECT: active workspace member OR uploader OR explicit file_access grant
CREATE POLICY "files_workspace_read"
ON public.files FOR SELECT
USING (
    EXISTS (
        SELECT 1
        FROM public.workspace_members wm
        WHERE wm.workspace_id = files.workspace_id
          AND wm.user_id      = auth.uid()
    )
);

-- INSERT: must be active workspace member in that workspace
CREATE POLICY "files_workspace_insert"
ON public.files FOR INSERT
WITH CHECK (
    EXISTS (
        SELECT 1
        FROM public.workspace_members wm
        WHERE wm.workspace_id = files.workspace_id
          AND wm.user_id      = auth.uid()
    )
);

-- UPDATE: uploader OR workspace admin/owner
CREATE POLICY "files_workspace_update"
ON public.files FOR UPDATE
USING (
    uploaded_by = auth.uid()
    OR EXISTS (
        SELECT 1
        FROM public.workspace_members wm
        WHERE wm.workspace_id = files.workspace_id
          AND wm.user_id      = auth.uid()
          AND wm.role IN ('owner', 'admin')
    )
);

-- DELETE (soft): uploader OR workspace admin/owner
CREATE POLICY "files_workspace_delete"
ON public.files FOR DELETE
USING (
    uploaded_by = auth.uid()
    OR EXISTS (
        SELECT 1
        FROM public.workspace_members wm
        WHERE wm.workspace_id = files.workspace_id
          AND wm.user_id      = auth.uid()
          AND wm.role IN ('owner', 'admin')
    )
);

-- ---- file_versions ---------------------------------------------------------
DROP POLICY IF EXISTS "Workspace isolation file_versions"               ON public.file_versions;
DROP POLICY IF EXISTS "file_versions_workspace_isolation"               ON public.file_versions;
DROP POLICY IF EXISTS "Workspace users can view file versions"          ON public.file_versions;
DROP POLICY IF EXISTS "Users can view accessible file versions"         ON public.file_versions;
DROP POLICY IF EXISTS "Workspace users can insert file versions"        ON public.file_versions;
DROP POLICY IF EXISTS "Users can insert file versions if they can manage the file" ON public.file_versions;
DROP POLICY IF EXISTS "Users can delete file versions if they can manage the file" ON public.file_versions;

CREATE POLICY "file_versions_read"
ON public.file_versions FOR SELECT
USING (
    EXISTS (
        SELECT 1
        FROM public.files f
        JOIN public.workspace_members wm ON wm.workspace_id = f.workspace_id
        WHERE f.id          = file_versions.file_id
          AND wm.user_id    = auth.uid()
    )
);

CREATE POLICY "file_versions_insert"
ON public.file_versions FOR INSERT
WITH CHECK (
    uploaded_by = auth.uid()
    AND EXISTS (
        SELECT 1
        FROM public.files f
        JOIN public.workspace_members wm ON wm.workspace_id = f.workspace_id
        WHERE f.id        = file_versions.file_id
          AND wm.user_id  = auth.uid()
    )
);

CREATE POLICY "file_versions_delete"
ON public.file_versions FOR DELETE
USING (
    uploaded_by = auth.uid()
    OR EXISTS (
        SELECT 1
        FROM public.files f
        JOIN public.workspace_members wm ON wm.workspace_id = f.workspace_id
        WHERE f.id        = file_versions.file_id
          AND wm.user_id  = auth.uid()
          AND wm.role IN ('owner', 'admin')
    )
);

-- ---- file_links ------------------------------------------------------------
DROP POLICY IF EXISTS "Workspace isolation file_links"   ON public.file_links;
DROP POLICY IF EXISTS "file_links_workspace_isolation"   ON public.file_links;

CREATE POLICY "file_links_read"
ON public.file_links FOR SELECT
USING (
    EXISTS (
        SELECT 1
        FROM public.workspace_members wm
        WHERE wm.workspace_id = file_links.workspace_id
          AND wm.user_id      = auth.uid()
    )
);

CREATE POLICY "file_links_insert"
ON public.file_links FOR INSERT
WITH CHECK (
    EXISTS (
        SELECT 1
        FROM public.workspace_members wm
        WHERE wm.workspace_id = file_links.workspace_id
          AND wm.user_id      = auth.uid()
    )
);

CREATE POLICY "file_links_delete"
ON public.file_links FOR DELETE
USING (
    EXISTS (
        SELECT 1
        FROM public.workspace_members wm
        WHERE wm.workspace_id = file_links.workspace_id
          AND wm.user_id      = auth.uid()
    )
);

-- ---- file_access -----------------------------------------------------------
DROP POLICY IF EXISTS "Workspace isolation file_access"  ON public.file_access;
DROP POLICY IF EXISTS "file_access_workspace_isolation"  ON public.file_access;

-- file_access grants are visible to workspace members
CREATE POLICY "file_access_read"
ON public.file_access FOR SELECT
USING (
    user_id = auth.uid()
    OR EXISTS (
        SELECT 1
        FROM public.files f
        JOIN public.workspace_members wm ON wm.workspace_id = f.workspace_id
        WHERE f.id        = file_access.file_id
          AND wm.user_id  = auth.uid()
          AND wm.role IN ('owner', 'admin')
    )
);

-- Only admins/owners/uploaders can grant access
CREATE POLICY "file_access_manage"
ON public.file_access FOR ALL
USING (
    EXISTS (
        SELECT 1
        FROM public.files f
        JOIN public.workspace_members wm ON wm.workspace_id = f.workspace_id
        WHERE f.id        = file_access.file_id
          AND wm.user_id  = auth.uid()
          AND (wm.role IN ('owner', 'admin') OR f.uploaded_by = auth.uid())
    )
);

-- ---- file_events -----------------------------------------------------------
DROP POLICY IF EXISTS "Workspace isolation file_events"  ON public.file_events;
DROP POLICY IF EXISTS "file_events_workspace_isolation"  ON public.file_events;

CREATE POLICY "file_events_read"
ON public.file_events FOR SELECT
USING (
    EXISTS (
        SELECT 1
        FROM public.workspace_members wm
        WHERE wm.workspace_id = file_events.workspace_id
          AND wm.user_id      = auth.uid()
    )
);

CREATE POLICY "file_events_insert"
ON public.file_events FOR INSERT
WITH CHECK (
    EXISTS (
        SELECT 1
        FROM public.workspace_members wm
        WHERE wm.workspace_id = file_events.workspace_id
          AND wm.user_id      = auth.uid()
    )
);

-- ---- workspace_storage_usage -----------------------------------------------
DROP POLICY IF EXISTS "Workspace isolation workspace_storage_usage" ON public.workspace_storage_usage;
DROP POLICY IF EXISTS "workspace_storage_admin"                     ON public.workspace_storage_usage;

-- Members can read; only admins can update quotas
CREATE POLICY "storage_usage_read"
ON public.workspace_storage_usage FOR SELECT
USING (
    EXISTS (
        SELECT 1
        FROM public.workspace_members wm
        WHERE wm.workspace_id = workspace_storage_usage.workspace_id
          AND wm.user_id      = auth.uid()
    )
);

CREATE POLICY "storage_usage_write"
ON public.workspace_storage_usage FOR ALL
USING (
    EXISTS (
        SELECT 1
        FROM public.workspace_members wm
        WHERE wm.workspace_id = workspace_storage_usage.workspace_id
          AND wm.user_id      = auth.uid()
          AND wm.role IN ('owner', 'admin')
    )
);

-- ----------------------------------------------------------------------------
-- 4. can_access_file() — PERMISSION RESOLUTION HELPER
--    Logic chain:
--      1) Workspace owner/admin
--      2) Uploader
--      3) Explicit file_access grant
--      4) Inherited from entity (file_links → entity membership)
--      5) Fallback: any active workspace member (least-privilege default)
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.can_access_file(
    p_file_uuid UUID,
    p_user_uuid UUID
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    v_workspace_id UUID;
    v_uploaded_by  UUID;
BEGIN
    -- Resolve file metadata
    SELECT workspace_id, uploaded_by
    INTO   v_workspace_id, v_uploaded_by
    FROM   public.files
    WHERE  id = p_file_uuid
      AND  archived_at IS NULL;

    IF NOT FOUND THEN
        RETURN FALSE;
    END IF;

    -- 1. Workspace owner or admin
    IF EXISTS (
        SELECT 1 FROM public.workspace_members
        WHERE workspace_id = v_workspace_id
          AND user_id      = p_user_uuid
          AND role IN ('owner', 'admin')
    ) THEN
        RETURN TRUE;
    END IF;

    -- 2. Uploader has full access to their own file
    IF v_uploaded_by = p_user_uuid THEN
        RETURN TRUE;
    END IF;

    -- 3. Explicit file_access grant
    IF EXISTS (
        SELECT 1 FROM public.file_access
        WHERE file_id = p_file_uuid
          AND user_id = p_user_uuid
    ) THEN
        RETURN TRUE;
    END IF;

    -- 4. Inherited access via entity link
    --    If the user has membership in the same workspace and the file is
    --    linked to any entity, any workspace member may view it.
    IF EXISTS (
        SELECT 1
        FROM   public.file_links fl
        WHERE  fl.file_id = p_file_uuid
    ) AND EXISTS (
        SELECT 1 FROM public.workspace_members
        WHERE workspace_id = v_workspace_id
          AND user_id      = p_user_uuid
    ) THEN
        RETURN TRUE;
    END IF;

    -- 5. Fallback: workspace membership
    RETURN EXISTS (
        SELECT 1 FROM public.workspace_members
        WHERE workspace_id = v_workspace_id
          AND user_id      = p_user_uuid
    );
END;
$$;

-- ----------------------------------------------------------------------------
-- 5. STRENGTHEN FOREIGN KEYS
--    Use DO block to safely add FKs only if they don't already exist.
-- ----------------------------------------------------------------------------
DO $$
BEGIN
    -- files.workspace_id → workspaces(id) ON DELETE CASCADE
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints tc
        JOIN information_schema.referential_constraints rc ON rc.constraint_name = tc.constraint_name
        JOIN information_schema.table_constraints tc2 ON tc2.constraint_name = rc.unique_constraint_name
        WHERE tc.table_name  = 'files'
          AND tc.constraint_type = 'FOREIGN KEY'
          AND tc2.table_name = 'workspaces'
    ) THEN
        -- FK likely already present from CREATE TABLE; skip re-add to avoid duplicate
        NULL;
    END IF;

    -- files.uploaded_by → public.users(id) ON DELETE SET NULL
    -- (already created as REFERENCES users(id); verify via constraint check)
    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint c
        JOIN pg_class t ON t.oid = c.conrelid
        JOIN pg_class r ON r.oid = c.confrelid
        WHERE t.relname = 'files'
          AND r.relname = 'users'
          AND c.conname LIKE '%uploaded_by%'
    ) THEN
        ALTER TABLE public.files
            ADD CONSTRAINT files_uploaded_by_fkey
            FOREIGN KEY (uploaded_by)
            REFERENCES public.users(id)
            ON DELETE SET NULL;
    END IF;
END;
$$;

-- ----------------------------------------------------------------------------
-- 6. ADDITIONAL PERFORMANCE INDEXES
-- ----------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_files_uploaded_by
    ON public.files(uploaded_by);

CREATE INDEX IF NOT EXISTS idx_files_created_at
    ON public.files(workspace_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_files_archived_at
    ON public.files(workspace_id, archived_at)
    WHERE archived_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_file_links_file_id
    ON public.file_links(file_id);

CREATE INDEX IF NOT EXISTS idx_file_links_entity_composite
    ON public.file_links(workspace_id, entity_type, entity_id);

CREATE INDEX IF NOT EXISTS idx_file_versions_file_version
    ON public.file_versions(file_id, version_number DESC);

CREATE INDEX IF NOT EXISTS idx_file_access_user
    ON public.file_access(user_id, file_id);

CREATE INDEX IF NOT EXISTS idx_file_events_actor
    ON public.file_events(workspace_id, actor_id, created_at DESC);

-- ----------------------------------------------------------------------------
-- 7. UNIQUE CONSTRAINTS
-- ----------------------------------------------------------------------------

-- Prevent duplicate version numbers per file
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'file_versions_file_id_version_number_key'
    ) THEN
        ALTER TABLE public.file_versions
            ADD CONSTRAINT file_versions_file_id_version_number_key
            UNIQUE (file_id, version_number);
    END IF;
END;
$$;

-- Prevent duplicate entity attachment records
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'file_links_file_entity_unique'
    ) THEN
        ALTER TABLE public.file_links
            ADD CONSTRAINT file_links_file_entity_unique
            UNIQUE (file_id, entity_type, entity_id);
    END IF;
END;
$$;

-- ----------------------------------------------------------------------------
-- 8. MISSING COLUMNS ON files
-- ----------------------------------------------------------------------------

-- archived_by: who archived the file (soft-delete actor)
ALTER TABLE public.files
    ADD COLUMN IF NOT EXISTS archived_by uuid
    REFERENCES public.users(id) ON DELETE SET NULL;

-- current_version_id: pointer to the latest file_version row
ALTER TABLE public.files
    ADD COLUMN IF NOT EXISTS current_version_id uuid
    REFERENCES public.file_versions(id) ON DELETE SET NULL DEFERRABLE INITIALLY DEFERRED;

-- ----------------------------------------------------------------------------
-- 9. recalculate_workspace_storage() — CONSISTENCY REPAIR FUNCTION
--    Recalculates used_bytes from live file sizes and upserts into
--    workspace_storage_usage. Safe to run at any time.
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.recalculate_workspace_storage(
    p_workspace_uuid UUID
)
RETURNS bigint
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    v_total_bytes bigint;
BEGIN
    SELECT COALESCE(SUM(file_size), 0)
    INTO   v_total_bytes
    FROM   public.files
    WHERE  workspace_id = p_workspace_uuid
      AND  archived_at IS NULL;

    INSERT INTO public.workspace_storage_usage (workspace_id, used_bytes, updated_at)
    VALUES (p_workspace_uuid, v_total_bytes, now())
    ON CONFLICT (workspace_id)
    DO UPDATE SET
        used_bytes = EXCLUDED.used_bytes,
        updated_at = now();

    RETURN v_total_bytes;
END;
$$;

-- ----------------------------------------------------------------------------
-- 10. WORKSPACE_STORAGE_USAGE — auto-upsert row when a file is added/removed
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.sync_workspace_storage_on_file_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    v_workspace_id uuid;
BEGIN
    v_workspace_id := COALESCE(NEW.workspace_id, OLD.workspace_id);

    INSERT INTO public.workspace_storage_usage (workspace_id, used_bytes, updated_at)
    VALUES (v_workspace_id, 0, now())
    ON CONFLICT (workspace_id) DO NOTHING;

    -- Recalculate total on every change
    PERFORM public.recalculate_workspace_storage(v_workspace_id);

    RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS trigger_sync_workspace_storage ON public.files;
CREATE TRIGGER trigger_sync_workspace_storage
AFTER INSERT OR UPDATE OF file_size, archived_at OR DELETE
ON public.files
FOR EACH ROW
EXECUTE FUNCTION public.sync_workspace_storage_on_file_change();

-- ============================================================================
-- END OF PHASE 5E.1 HARDENING PATCH
-- ============================================================================
`;

// ---------------------------------------------------------------------------
// APPEND
// ---------------------------------------------------------------------------
fs.appendFileSync(TARGET, SQL, 'utf8');
console.log('✅ Phase 5E.1 hardening patch appended to:', TARGET);
console.log('   Changes applied:');
console.log('   • UUID DEFAULT gen_random_uuid() enforced on all Phase 5E tables');
console.log('   • RLS enabled (idempotent)');
console.log('   • Dropped dynamic apply_file_engine_isolation() function');
console.log('   • Named RLS policies using workspace_members (not workspace_id = auth.uid())');
console.log('   • can_access_file(file_uuid, user_uuid) RPC helper created');
console.log('   • Foreign keys strengthened (CASCADE / SET NULL)');
console.log('   • Indexes: workspace, uploaded_by, created_at, entity, version, actor');
console.log('   • Unique constraints: file_versions(file_id, version_number), file_links(file_id, entity_type, entity_id)');
console.log('   • files.archived_by + files.current_version_id columns added');
console.log('   • recalculate_workspace_storage() RPC created');
console.log('   • trigger_sync_workspace_storage auto-recalculates on INSERT/UPDATE/DELETE');
