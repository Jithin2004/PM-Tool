-- Run this in your Supabase SQL Editor to fix the 400 Bad Request on UPSERT

-- The handle_new_user trigger pre-creates the user row as 'viewer'.
-- This causes the client-side upsert to become an UPDATE, which violates 
-- the prevent_role_escalation trigger and the RLS UPDATE policies, throwing a 400 error.
-- Dropping this trigger allows the client to securely INSERT the row during reconciliation.

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP FUNCTION IF EXISTS public.handle_new_user();

-- Since the trigger might have already created rows in your DB with the 'viewer' role,
-- you should clean up any orphaned or incorrect rows if this is a test environment:
-- DELETE FROM public.users WHERE role = 'viewer' AND workspace_id IS NULL;
