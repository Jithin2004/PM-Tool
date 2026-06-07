-- ==============================================================================
-- RESOLVE PM — SPRINT 8.2 PHASE 4.1: EMPLOYEE LIFECYCLE PRESERVATION
-- ==============================================================================
-- RUN THIS SCRIPT IN SUPABASE SQL EDITOR AS `postgres` USER
-- Addresses soft-deletes, blocks hard deletes, replaces CASCADE with RESTRICT
-- ==============================================================================

BEGIN;

-- 1. Ensure `left_at` column exists in `employment_records`
ALTER TABLE public.employment_records ADD COLUMN IF NOT EXISTS left_at timestamptz;

-- 2. Dynamically replace all ON DELETE CASCADE to ON DELETE RESTRICT for foreign keys pointing to users(id)
DO $$
DECLARE
    r RECORD;
    v_sql text;
BEGIN
    FOR r IN (
        SELECT
            tc.table_schema,
            tc.table_name,
            tc.constraint_name,
            kcu.column_name
        FROM information_schema.table_constraints AS tc
        JOIN information_schema.key_column_usage AS kcu
            ON tc.constraint_name = kcu.constraint_name
            AND tc.table_schema = kcu.table_schema
        JOIN information_schema.constraint_column_usage AS ccu
            ON ccu.constraint_name = tc.constraint_name
            AND ccu.table_schema = tc.table_schema
        JOIN information_schema.referential_constraints rc
            ON tc.constraint_name = rc.constraint_name
        WHERE constraint_type = 'FOREIGN KEY'
          AND ccu.table_name = 'users'
          AND ccu.column_name = 'id'
          AND rc.delete_rule = 'CASCADE'
          AND tc.table_schema = 'public'
    ) LOOP
        -- Drop the existing CASCADE constraint
        v_sql := format('ALTER TABLE %I.%I DROP CONSTRAINT %I;', r.table_schema, r.table_name, r.constraint_name);
        EXECUTE v_sql;

        -- Recreate the constraint with RESTRICT
        v_sql := format('ALTER TABLE %I.%I ADD CONSTRAINT %I FOREIGN KEY (%I) REFERENCES public.users(id) ON DELETE RESTRICT;', 
                        r.table_schema, r.table_name, r.constraint_name, r.column_name);
        EXECUTE v_sql;
    END LOOP;
END $$;


-- 2.5 Ensure workspaces have test marker
ALTER TABLE public.workspaces ADD COLUMN IF NOT EXISTS is_test_workspace boolean DEFAULT false;

-- 3. Trigger to prevent hard deletes on `users`
CREATE OR REPLACE FUNCTION public.prevent_user_hard_delete()
RETURNS TRIGGER AS $$
BEGIN
    -- Allow deletion if triggered by the service_role cleanup RPC
    IF current_setting('resolve_pm.is_test_cleanup', true) = 'true' THEN
        RETURN OLD;
    END IF;

    -- Block all other deletions
    RAISE EXCEPTION 'Deleting users is forbidden to preserve historical operational data. Use archive_employee() instead.';
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_prevent_user_hard_delete ON public.users;
CREATE TRIGGER trg_prevent_user_hard_delete
    BEFORE DELETE ON public.users
    FOR EACH ROW
    EXECUTE FUNCTION public.prevent_user_hard_delete();

-- 3.5 Create Test Cleanup RPC (Option A)
CREATE OR REPLACE FUNCTION public.cleanup_test_workspace(p_workspace_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    -- Only allow service_role to execute this destructive operation
    IF current_setting('request.jwt.claim.role', true) != 'service_role' THEN
        RAISE EXCEPTION 'Unauthorized: Only service_role can execute test cleanups.';
    END IF;

    -- Verify it's actually a test workspace
    IF NOT EXISTS (SELECT 1 FROM public.workspaces WHERE id = p_workspace_id AND is_test_workspace = true) THEN
        RAISE EXCEPTION 'Workspace is not marked as a test workspace.';
    END IF;

    -- Set local transaction flag to bypass the user deletion trigger
    PERFORM set_config('resolve_pm.is_test_cleanup', 'true', true);

    -- Delete the workspace (will cascade and delete users)
    DELETE FROM public.workspaces WHERE id = p_workspace_id AND is_test_workspace = true;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.cleanup_test_workspace(uuid) FROM public;
REVOKE EXECUTE ON FUNCTION public.cleanup_test_workspace(uuid) FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.cleanup_test_workspace(uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.cleanup_test_workspace(uuid) TO service_role;


-- 4. Create `archive_employee()` RPC
CREATE OR REPLACE FUNCTION public.archive_employee(p_user_id uuid, p_status text, p_reason text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_workspace_id uuid;
    v_current_status text;
BEGIN
    -- Ensure the target status is a valid archived state
    IF p_status NOT IN ('resigned', 'terminated', 'suspended') THEN
        RAISE EXCEPTION 'Invalid status. Must be resigned, terminated, or suspended.';
    END IF;

    -- Verify the caller has HR capability or is Super Admin
    IF NOT (public.has_capability(auth.uid(), 'manage_employees') OR public.has_capability(auth.uid(), 'platform_governance')) THEN
        RAISE EXCEPTION 'Unauthorized. Only HR managers or Platform Admins can archive employees.';
    END IF;

    -- Get target user workspace and status
    SELECT workspace_id INTO v_workspace_id FROM public.users WHERE id = p_user_id;
    
    IF v_workspace_id IS NULL THEN
        RAISE EXCEPTION 'User not found.';
    END IF;

    -- Caller must be in the same workspace (unless they are platform governance, but current_workspace() enforces this anyway)
    IF v_workspace_id != public.current_workspace() THEN
        RAISE EXCEPTION 'Unauthorized cross-workspace archiving attempt.';
    END IF;

    SELECT employment_status INTO v_current_status FROM public.employment_records WHERE user_id = p_user_id;

    -- If no employment record, just return true (they are effectively inactive)
    IF v_current_status IS NULL THEN
        RETURN true;
    END IF;

    -- Archive them
    UPDATE public.employment_records 
    SET employment_status = p_status, 
        left_at = now() 
    WHERE user_id = p_user_id;

    -- Log it
    INSERT INTO public.employment_change_logs (employee_id, changed_by, field_changed, previous_value, new_value, reason)
    VALUES (p_user_id, auth.uid(), 'employment_status', v_current_status, p_status, p_reason);

    RETURN true;
END;
$$;

COMMIT;
