-- Fix for onboard_workspace_transaction failing due to missing extensions schema in search_path

CREATE OR REPLACE FUNCTION public.onboard_workspace_transaction(
  p_workspace_id   UUID,
  p_workspace_name TEXT,
  p_user_id        UUID,
  p_user_email     TEXT,
  p_user_name      TEXT,
  p_license_key    TEXT,
  p_plan           TEXT DEFAULT 'standard',
  p_seats          INT  DEFAULT 10
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
-- Adding extensions to search_path so pgcrypto's digest function resolves correctly
SET search_path = public, extensions
AS $$
DECLARE
  v_license_key_hash TEXT;
BEGIN

  -- Input validation
  IF p_workspace_id   IS NULL THEN RAISE EXCEPTION 'p_workspace_id is required';  END IF;
  IF p_workspace_name IS NULL OR trim(p_workspace_name) = '' THEN RAISE EXCEPTION 'p_workspace_name is required'; END IF;
  IF p_user_id        IS NULL THEN RAISE EXCEPTION 'p_user_id is required';       END IF;
  IF p_user_email     IS NULL OR trim(p_user_email)     = '' THEN RAISE EXCEPTION 'p_user_email is required';    END IF;
  IF p_license_key    IS NULL OR trim(p_license_key)    = '' THEN RAISE EXCEPTION 'p_license_key is required';   END IF;

  v_license_key_hash := encode(digest(trim(p_license_key), 'sha256'), 'hex');

  -- Step 1: Create Workspace (idempotent)
  INSERT INTO public.workspaces (
    id, name, created_by_id, business_type, work_start, work_end,
    lunch_duration, workdays, timezone, attendance_enabled, payroll_enabled,
    productivity_factor, status, initialized, created_at
  )
  VALUES (
    p_workspace_id,
    trim(p_workspace_name),
    p_user_id,
    'Software',
    '09:00', '17:00',
    60,
    ARRAY[1,2,3,4,5],
    'UTC',
    true, false,
    0.8,
    'licensed',  -- workspace is licensed but not yet initialized
    false,       -- owner must complete /workspace-init
    NOW()
  )
  ON CONFLICT (id) DO NOTHING;

  -- Step 2: Sync License (idempotent)
  INSERT INTO public.workspace_license (
    workspace_id, license_key_hash, license_type, max_seats, activation_date, support_until
  )
  VALUES (
    p_workspace_id,
    v_license_key_hash,
    p_plan,
    p_seats,
    NOW(),
    NOW() + INTERVAL '1 year'
  )
  ON CONFLICT (workspace_id) DO UPDATE SET
    license_key_hash = EXCLUDED.license_key_hash,
    license_type     = EXCLUDED.license_type,
    max_seats        = EXCLUDED.max_seats,
    activation_date  = COALESCE(public.workspace_license.activation_date, EXCLUDED.activation_date),
    support_until    = EXCLUDED.support_until;

  -- Step 3: Create/Update User Profile (idempotent)
  INSERT INTO public.users (
    id, email, full_name, workspace_id, role, availability_factor, status
  )
  VALUES (
    p_user_id,
    trim(p_user_email),
    COALESCE(trim(p_user_name), split_part(trim(p_user_email), '@', 1)),
    p_workspace_id,
    'super_admin',
    1,
    'active'
  )
  ON CONFLICT (id) DO UPDATE SET
    full_name      = EXCLUDED.full_name,
    workspace_id   = EXCLUDED.workspace_id,
    role = CASE
      WHEN public.users.workspace_id IS NULL THEN 'super_admin'
      ELSE public.users.role
    END,
    status         = 'active';

END;
$$;
