-- Fixes the 400 Bad Request when an orphaned workspace owner tries to log in.
-- This updates the role escalation trigger and RLS to allow the workspace owner 
-- to reclaim their super_admin role and workspace_id.

CREATE OR REPLACE FUNCTION prevent_role_escalation()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = ''
AS $$
BEGIN
  -- Allow users to reclaim their workspace if they are the true owner
  IF EXISTS (SELECT 1 FROM workspaces WHERE id = NEW.workspace_id AND owner_id = NEW.id) THEN
    RETURN NEW;
  END IF;

  -- Prevent changing workspace_id after it has been set
  IF OLD.workspace_id IS NOT NULL AND NEW.workspace_id IS DISTINCT FROM OLD.workspace_id THEN
    RAISE EXCEPTION 'Unauthorized: Cannot migrate workspaces.';
  END IF;

  -- Prevent role escalation unless performed by a super_admin of the same workspace
  IF OLD.role IS NOT NULL AND NEW.role IS DISTINCT FROM OLD.role THEN
    IF NOT EXISTS (
      SELECT 1 FROM public.users me 
      WHERE me.id = auth.uid() 
        AND me.workspace_id = OLD.workspace_id 
        AND me.role = 'super_admin'
    ) THEN
      RAISE EXCEPTION 'Unauthorized: Only super_admin can modify roles.';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP POLICY IF EXISTS "Users can update their own safe profile fields" ON users;
CREATE POLICY "Users can update their own safe profile fields"
  ON users FOR UPDATE
  USING (id = auth.uid())
  WITH CHECK (
    id = auth.uid()
    AND (
      (role IS NOT DISTINCT FROM (SELECT role FROM users WHERE id = auth.uid())
       AND workspace_id IS NOT DISTINCT FROM (SELECT workspace_id FROM users WHERE id = auth.uid()))
      OR
      EXISTS (SELECT 1 FROM workspaces WHERE workspaces.id = users.workspace_id AND workspaces.owner_id = auth.uid())
    )
  );
