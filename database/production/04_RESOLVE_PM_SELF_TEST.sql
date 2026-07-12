-- =========================================================================================
-- RESOLVE PM ENTERPRISE INSTALLER
-- 04_RESOLVE_PM_SELF_TEST.sql
-- Description: Post-installation self-test to verify the integrity of the Resolve PM
-- database schema, constraints, functions, RLS, and storage setup.
-- =========================================================================================

DO $$
DECLARE
  v_pass BOOLEAN := true;
  v_report TEXT := E'\n--- RESOLVE PM SELF TEST REPORT ---\n';
  
  -- Check variables
  v_count INT;
  v_func_path TEXT;
  v_missing_tables TEXT[] := '{}';
  v_missing_buckets TEXT[] := '{}';
  v_req_tables TEXT[] := ARRAY['users', 'workspaces', 'workspace_license', 'teams', 'team_members', 'projects', 'tasks', 'workspace_files'];
  v_req_buckets TEXT[] := ARRAY['workspace_files', 'attachments', 'exports', 'avatars', 'project-files'];
  
  t TEXT;
  b TEXT;
BEGIN
  -- 1. Verify Required Tables Exist
  FOR i IN 1 .. array_length(v_req_tables, 1) LOOP
    t := v_req_tables[i];
    SELECT count(*) INTO v_count FROM pg_class c JOIN pg_namespace n ON c.relnamespace = n.oid 
    WHERE n.nspname = 'public' AND c.relname = t;
    IF v_count = 0 THEN
      v_pass := false;
      v_report := v_report || 'FAIL: Missing required table: ' || t || E'\n';
    END IF;
  END LOOP;
  IF v_pass THEN v_report := v_report || 'PASS: All required tables exist.' || E'\n'; END IF;

  -- 2. Verify onboard_workspace_transaction exists
  SELECT count(*) INTO v_count FROM pg_proc p JOIN pg_namespace n ON p.pronamespace = n.oid 
  WHERE n.nspname = 'public' AND p.proname = 'onboard_workspace_transaction';
  IF v_count = 0 THEN
    v_pass := false;
    v_report := v_report || 'FAIL: Function onboard_workspace_transaction is missing.' || E'\n';
  ELSE
    v_report := v_report || 'PASS: Function onboard_workspace_transaction exists.' || E'\n';
  END IF;

  -- 3. Verify SECURITY DEFINER functions have SET search_path
  -- Check if any SECURITY DEFINER function in public lacks search_path configuration
  SELECT count(*) INTO v_count
  FROM pg_proc p 
  JOIN pg_namespace n ON p.pronamespace = n.oid 
  WHERE n.nspname = 'public' 
    AND p.prosecdef = true 
    AND (p.proconfig IS NULL OR NOT (array_to_string(p.proconfig, ',') LIKE '%search_path%'));
  
  IF v_count > 0 THEN
    v_pass := false;
    v_report := v_report || 'FAIL: ' || v_count || ' SECURITY DEFINER functions are missing SET search_path.' || E'\n';
  ELSE
    v_report := v_report || 'PASS: All SECURITY DEFINER functions have search_path configured.' || E'\n';
  END IF;

  -- 4. Verify workspace_license constraints
  SELECT count(*) INTO v_count FROM pg_constraint c JOIN pg_class t ON c.conrelid = t.oid 
  WHERE t.relname = 'workspace_license' AND c.contype = 'c'; -- 'c' is check constraint
  IF v_count = 0 THEN
    v_pass := false;
    v_report := v_report || 'FAIL: workspace_license missing CHECK constraints.' || E'\n';
  ELSE
    v_report := v_report || 'PASS: workspace_license constraints verified.' || E'\n';
  END IF;

  -- 5. Verify RLS policies exist
  SELECT count(*) INTO v_count FROM pg_policy pol JOIN pg_class c ON pol.polrelid = c.oid JOIN pg_namespace n ON c.relnamespace = n.oid WHERE n.nspname = 'public';
  IF v_count = 0 THEN
    v_pass := false;
    v_report := v_report || 'FAIL: No RLS policies found in public schema.' || E'\n';
  ELSE
    v_report := v_report || 'PASS: RLS policies exist (' || v_count || ' found).' || E'\n';
  END IF;

  -- 6. Verify Foreign Keys
  SELECT count(*) INTO v_count FROM pg_constraint c JOIN pg_namespace n ON c.connamespace = n.oid WHERE n.nspname = 'public' AND c.contype = 'f';
  IF v_count = 0 THEN
    v_pass := false;
    v_report := v_report || 'FAIL: No foreign keys found in public schema.' || E'\n';
  ELSE
    v_report := v_report || 'PASS: Foreign keys exist (' || v_count || ' found).' || E'\n';
  END IF;

  -- 7. Verify Triggers
  SELECT count(*) INTO v_count FROM pg_trigger t JOIN pg_class c ON t.tgrelid = c.oid JOIN pg_namespace n ON c.relnamespace = n.oid WHERE n.nspname = 'public' AND t.tgisinternal = false;
  IF v_count = 0 THEN
    v_pass := false;
    v_report := v_report || 'FAIL: No custom triggers found in public schema.' || E'\n';
  ELSE
    v_report := v_report || 'PASS: Custom triggers exist (' || v_count || ' found).' || E'\n';
  END IF;

  -- 8. Verify Storage Buckets
  FOR i IN 1 .. array_length(v_req_buckets, 1) LOOP
    b := v_req_buckets[i];
    SELECT count(*) INTO v_count FROM storage.buckets WHERE id = b;
    IF v_count = 0 THEN
      v_pass := false;
      v_report := v_report || 'FAIL: Missing required storage bucket: ' || b || E'\n';
    END IF;
  END LOOP;
  IF v_pass THEN v_report := v_report || 'PASS: All required storage buckets exist.' || E'\n'; END IF;

  -- FINAL OUTPUT
  RAISE NOTICE '%', v_report;
  
  IF v_pass THEN
    RAISE NOTICE '==================================================';
    RAISE NOTICE '✅ SELF TEST PASSED: Database is healthy.';
    RAISE NOTICE '==================================================';
  ELSE
    RAISE NOTICE '==================================================';
    RAISE NOTICE '❌ SELF TEST FAILED: See report for missing dependencies.';
    RAISE NOTICE '==================================================';
  END IF;
END $$;
