-- Phase 2: Create Bootstrap Validator
CREATE OR REPLACE FUNCTION public.is_workspace_bootstrap_transition(
  p_old_workspace_id UUID,
  p_new_workspace_id UUID,
  p_new_role TEXT,
  p_user_id UUID
) RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public, extensions
AS $$
BEGIN
  -- Condition 1: Old workspace is NULL (must be user's first workspace)
  IF p_old_workspace_id IS NOT NULL THEN
    RETURN FALSE;
  END IF;

  -- Condition 2: New workspace exists
  IF p_new_workspace_id IS NULL THEN
    RETURN FALSE;
  END IF;

  -- Condition 3: Requested role is super_admin
  IF p_new_role != 'super_admin' THEN
    RETURN FALSE;
  END IF;

  -- Condition 4: Workspace creator matches the user
  IF NOT EXISTS (
    SELECT 1 FROM public.workspaces w
    WHERE w.id = p_new_workspace_id
    AND w.created_by_id = p_user_id
  ) THEN
    RETURN FALSE;
  END IF;

  -- Condition 5: No super_admin already exists in this workspace
  -- This guarantees the exemption is strictly one-time for the founder
  IF EXISTS (
    SELECT 1 FROM public.users u
    WHERE u.workspace_id = p_new_workspace_id
    AND u.role = 'super_admin'
  ) THEN
    RETURN FALSE;
  END IF;

  RETURN TRUE;
END;
$$;

-- Phase 3: Refactor prevent_role_escalation()
-- Phase 4: Standardize search_path to 'public, extensions'
CREATE OR REPLACE FUNCTION public.prevent_role_escalation()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public, extensions
AS $$
BEGIN
  -- 1. Prevent workspace migration after it has been set, EXCEPT during a soft-delete (workspace_id = NULL)
  IF OLD.workspace_id IS NOT NULL AND NEW.workspace_id IS NOT NULL AND NEW.workspace_id IS DISTINCT FROM OLD.workspace_id THEN
    RAISE EXCEPTION 'Unauthorized: Cannot migrate workspaces.';
  END IF;

  -- Role modification flow
  IF OLD.role IS NOT NULL AND NEW.role IS DISTINCT FROM OLD.role THEN
    
    -- 2. Allow verified bootstrap
    IF public.is_workspace_bootstrap_transition(OLD.workspace_id, NEW.workspace_id, NEW.role, NEW.id) THEN
      RETURN NEW;
    END IF;

    -- 3. Enforce role escalation rules (Requires authenticated user to be super_admin of the same workspace)
    IF NOT EXISTS (
      SELECT 1 FROM public.users me 
      WHERE me.id = auth.uid() 
        AND me.workspace_id = OLD.workspace_id 
        AND public.has_capability(auth.uid(), 'workspace.update')
    ) THEN
      RAISE EXCEPTION 'Unauthorized: Only super_admin can modify roles.';
    END IF;

  END IF;

  -- 4. Return NEW
  RETURN NEW;
END;
$$;
