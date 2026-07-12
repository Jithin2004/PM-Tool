-- =========================================================================================
-- RESOLVE PM ENTERPRISE INSTALLER
-- 01_RESOLVE_PM_RESET.sql
-- Description: Clean application state reset for Resolve PM while strictly preserving 
-- Supabase infrastructure (auth, storage schemas, realtime, extensions).
-- =========================================================================================

DO $$
DECLARE
  rec RECORD;
  v_table_count INT;
  v_view_count INT;
  v_func_count INT;
  v_trigger_count INT;
  v_policy_count INT;
  v_type_count INT;
  v_bucket_count INT;
BEGIN
  RAISE NOTICE '==================================================';
  RAISE NOTICE 'BEGIN RESET: Resolve PM Enterprise Application';
  RAISE NOTICE '==================================================';

  -- 1. RLS Policies
  RAISE NOTICE 'Phase 1: Dropping RLS Policies...';
  FOR rec IN (
    SELECT pol.polname, c.relname
    FROM pg_policy pol
    JOIN pg_class c ON pol.polrelid = c.oid
    JOIN pg_namespace n ON c.relnamespace = n.oid
    WHERE n.nspname = 'public'
  ) LOOP
    EXECUTE 'DROP POLICY IF EXISTS ' || quote_ident(rec.polname) || ' ON public.' || quote_ident(rec.relname);
  END LOOP;

  -- 2. User Triggers
  RAISE NOTICE 'Phase 2: Dropping Triggers...';
  FOR rec IN (
    SELECT t.tgname, c.relname
    FROM pg_trigger t
    JOIN pg_class c ON t.tgrelid = c.oid
    JOIN pg_namespace n ON c.relnamespace = n.oid
    WHERE n.nspname = 'public' AND t.tgisinternal = false
  ) LOOP
    EXECUTE 'DROP TRIGGER IF EXISTS ' || quote_ident(rec.tgname) || ' ON public.' || quote_ident(rec.relname) || ' CASCADE';
  END LOOP;

  -- 3 & 4. Views and Materialized Views
  RAISE NOTICE 'Phase 3 & 4: Dropping Views and Materialized Views...';
  FOR rec IN (
    SELECT c.relname, c.relkind
    FROM pg_class c
    JOIN pg_namespace n ON c.relnamespace = n.oid
    WHERE n.nspname = 'public' AND c.relkind IN ('v', 'm')
    AND NOT EXISTS (SELECT 1 FROM pg_depend WHERE objid = c.oid AND deptype = 'e')
  ) LOOP
    IF rec.relkind = 'v' THEN
      EXECUTE 'DROP VIEW IF EXISTS public.' || quote_ident(rec.relname) || ' CASCADE';
    ELSE
      EXECUTE 'DROP MATERIALIZED VIEW IF EXISTS public.' || quote_ident(rec.relname) || ' CASCADE';
    END IF;
  END LOOP;

  -- 5. Foreign Keys
  RAISE NOTICE 'Phase 5: Dropping Foreign Keys...';
  FOR rec IN (
    SELECT c.conname, cl.relname
    FROM pg_constraint c
    JOIN pg_class cl ON c.conrelid = cl.oid
    JOIN pg_namespace n ON cl.relnamespace = n.oid
    WHERE n.nspname = 'public' AND c.contype = 'f'
  ) LOOP
    EXECUTE 'ALTER TABLE public.' || quote_ident(rec.relname) || ' DROP CONSTRAINT IF EXISTS ' || quote_ident(rec.conname) || ' CASCADE';
  END LOOP;

  -- 6. Tables
  RAISE NOTICE 'Phase 6: Dropping Tables...';
  FOR rec IN (
    SELECT c.relname
    FROM pg_class c
    JOIN pg_namespace n ON c.relnamespace = n.oid
    WHERE n.nspname = 'public' AND c.relkind = 'r'
    AND NOT EXISTS (SELECT 1 FROM pg_depend WHERE objid = c.oid AND deptype = 'e')
  ) LOOP
    EXECUTE 'DROP TABLE IF EXISTS public.' || quote_ident(rec.relname) || ' CASCADE';
  END LOOP;

  -- 7. Sequences
  RAISE NOTICE 'Phase 7: Dropping Sequences...';
  FOR rec IN (
    SELECT c.relname
    FROM pg_class c
    JOIN pg_namespace n ON c.relnamespace = n.oid
    WHERE n.nspname = 'public' AND c.relkind = 'S'
    AND NOT EXISTS (SELECT 1 FROM pg_depend WHERE objid = c.oid AND deptype = 'e')
  ) LOOP
    EXECUTE 'DROP SEQUENCE IF EXISTS public.' || quote_ident(rec.relname) || ' CASCADE';
  END LOOP;

  -- 8 & 9. Functions and Procedures
  RAISE NOTICE 'Phase 8 & 9: Dropping Functions and Procedures...';
  FOR rec IN (
    SELECT p.proname, pg_get_function_identity_arguments(p.oid) AS args, p.prokind
    FROM pg_proc p
    JOIN pg_namespace n ON p.pronamespace = n.oid
    WHERE n.nspname = 'public'
    AND NOT EXISTS (SELECT 1 FROM pg_depend WHERE objid = p.oid AND deptype = 'e')
  ) LOOP
    IF rec.prokind = 'p' THEN
      EXECUTE 'DROP PROCEDURE IF EXISTS public.' || quote_ident(rec.proname) || '(' || rec.args || ') CASCADE';
    ELSE
      EXECUTE 'DROP FUNCTION IF EXISTS public.' || quote_ident(rec.proname) || '(' || rec.args || ') CASCADE';
    END IF;
  END LOOP;

  -- 10, 11, 12. Domains, Composite Types, Enums
  RAISE NOTICE 'Phase 10, 11, 12: Dropping Types...';
  FOR rec IN (
    SELECT t.typname, t.typtype
    FROM pg_type t
    JOIN pg_namespace n ON t.typnamespace = n.oid
    WHERE n.nspname = 'public' 
    AND t.typtype IN ('c', 'e', 'd') 
    AND NOT EXISTS (SELECT 1 FROM pg_depend WHERE objid = t.oid AND deptype = 'e')
  ) LOOP
    IF rec.typtype = 'd' THEN
      EXECUTE 'DROP DOMAIN IF EXISTS public.' || quote_ident(rec.typname) || ' CASCADE';
    ELSE
      EXECUTE 'DROP TYPE IF EXISTS public.' || quote_ident(rec.typname) || ' CASCADE';
    END IF;
  END LOOP;

  -- Phase 13: Storage Cleanup
  RAISE NOTICE 'Phase 13: Cleaning Resolve PM Storage Buckets...';
  
  BEGIN
    -- Delete Objects first to satisfy FK constraints
    DELETE FROM storage.objects 
    WHERE bucket_id IN ('workspace_files', 'attachments', 'exports', 'Logo', 'avatars', 'project-files');
    
    EXECUTE 'DROP POLICY IF EXISTS "Avatar Upload Policy" ON storage.objects';
    EXECUTE 'DROP POLICY IF EXISTS "Avatar Read Policy" ON storage.objects';
    EXECUTE 'DROP POLICY IF EXISTS "Attachments Select Policy" ON storage.objects';
    EXECUTE 'DROP POLICY IF EXISTS "Attachments Insert Policy" ON storage.objects';
    EXECUTE 'DROP POLICY IF EXISTS "Workspace Files Select Policy" ON storage.objects';
    EXECUTE 'DROP POLICY IF EXISTS "Workspace Files Insert Policy" ON storage.objects';
    EXECUTE 'DROP POLICY IF EXISTS "Export Select Policy" ON storage.objects';
    EXECUTE 'DROP POLICY IF EXISTS "Export Insert Policy" ON storage.objects';

    -- Delete Buckets
    DELETE FROM storage.buckets 
    WHERE id IN ('workspace_files', 'attachments', 'exports', 'Logo', 'avatars', 'project-files');
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'WARNING: Supabase restricts direct SQL deletion of storage objects. (Error: %)', SQLERRM;
    RAISE NOTICE 'Please use the Supabase Storage API or Dashboard to fully clear bucket contents if required.';
  END;

  -- Phase 14: Verification
  RAISE NOTICE 'Phase 14: Verification...';

  SELECT COUNT(*) INTO v_table_count FROM pg_class c JOIN pg_namespace n ON c.relnamespace = n.oid WHERE n.nspname = 'public' AND c.relkind = 'r' AND NOT EXISTS (SELECT 1 FROM pg_depend WHERE objid = c.oid AND deptype = 'e');
  SELECT COUNT(*) INTO v_view_count FROM pg_class c JOIN pg_namespace n ON c.relnamespace = n.oid WHERE n.nspname = 'public' AND c.relkind IN ('v', 'm') AND NOT EXISTS (SELECT 1 FROM pg_depend WHERE objid = c.oid AND deptype = 'e');
  SELECT COUNT(*) INTO v_func_count FROM pg_proc p JOIN pg_namespace n ON p.pronamespace = n.oid WHERE n.nspname = 'public' AND NOT EXISTS (SELECT 1 FROM pg_depend WHERE objid = p.oid AND deptype = 'e');
  SELECT COUNT(*) INTO v_trigger_count FROM pg_trigger t JOIN pg_class c ON t.tgrelid = c.oid JOIN pg_namespace n ON c.relnamespace = n.oid WHERE n.nspname = 'public' AND t.tgisinternal = false;
  SELECT COUNT(*) INTO v_policy_count FROM pg_policy pol JOIN pg_class c ON pol.polrelid = c.oid JOIN pg_namespace n ON c.relnamespace = n.oid WHERE n.nspname = 'public';
  SELECT COUNT(*) INTO v_type_count FROM pg_type t JOIN pg_namespace n ON t.typnamespace = n.oid WHERE n.nspname = 'public' AND t.typtype IN ('c', 'e', 'd') AND NOT EXISTS (SELECT 1 FROM pg_depend WHERE objid = t.oid AND deptype = 'e');
  SELECT COUNT(*) INTO v_bucket_count FROM storage.buckets WHERE id IN ('workspace_files', 'attachments', 'exports', 'Logo', 'avatars', 'project-files');

  RAISE NOTICE '--- Remaining Application Objects ---';
  RAISE NOTICE 'Tables: %', v_table_count;
  RAISE NOTICE 'Views: %', v_view_count;
  RAISE NOTICE 'Functions: %', v_func_count;
  RAISE NOTICE 'Triggers: %', v_trigger_count;
  RAISE NOTICE 'Policies: %', v_policy_count;
  RAISE NOTICE 'Types/Enums: %', v_type_count;
  RAISE NOTICE 'Resolve PM Storage Buckets: %', v_bucket_count;

  RAISE NOTICE '==================================================';
  RAISE NOTICE 'RESET COMPLETE: Environment ready for fresh install.';
  RAISE NOTICE '==================================================';
END $$;
