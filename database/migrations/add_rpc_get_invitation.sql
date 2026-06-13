-- Create a secure RPC function to allow unauthenticated users to validate their invite token
-- without exposing the entire invitations table.

CREATE OR REPLACE FUNCTION get_invitation_by_token(p_token text)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER -- Bypasses RLS to perform the check securely
AS $$
DECLARE
  v_inv record;
  v_workspace_name text;
BEGIN
  -- Find the pending invitation matching the token
  SELECT id, email, role, status, expires_at, workspace_id 
  INTO v_inv
  FROM invitations
  WHERE token = p_token AND status = 'pending';

  -- If not found, return null
  IF NOT FOUND THEN
    RETURN NULL;
  END IF;

  -- Get the workspace name for UI display
  SELECT name INTO v_workspace_name
  FROM workspaces
  WHERE id = v_inv.workspace_id;

  -- Return a JSON object with the required details
  RETURN json_build_object(
    'id', v_inv.id,
    'email', v_inv.email,
    'role', v_inv.role,
    'status', v_inv.status,
    'expires_at', v_inv.expires_at,
    'workspace_id', v_inv.workspace_id,
    'workspace_name', v_workspace_name
  );
END;
$$;

-- Grant execute access to anonymous users (public)
GRANT EXECUTE ON FUNCTION get_invitation_by_token(text) TO public;
GRANT EXECUTE ON FUNCTION get_invitation_by_token(text) TO anon;
GRANT EXECUTE ON FUNCTION get_invitation_by_token(text) TO authenticated;

-- Reload schema cache to make the RPC available via PostgREST
NOTIFY pgrst, 'reload schema';
