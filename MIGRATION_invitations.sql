-- Migration: Create invitations table for Invitation-Gated Authentication
-- Copy and run this script in your Supabase SQL Editor.

CREATE TABLE IF NOT EXISTS invitations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL,
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('super_admin', 'pm', 'developer', 'viewer')),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'revoked')),
  invited_by UUID REFERENCES users(id) ON DELETE SET NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(workspace_id, email)
);

-- Enable RLS
ALTER TABLE invitations ENABLE ROW LEVEL SECURITY;

-- 1. Read Policy: Users can see their own invitations or super_admins can see invitations in their workspace
DROP POLICY IF EXISTS "Invitations are readable by the invited email or workspace members" ON invitations;
CREATE POLICY "Invitations are readable by the invited email or workspace members"
ON invitations FOR SELECT
USING (
  email = auth.email()
  OR workspace_id = current_workspace()
);

-- 2. Modify Policy: Workspace super_admins can create, update, or delete invitations in their workspace
DROP POLICY IF EXISTS "Workspace super admins can manage invitations" ON invitations;
CREATE POLICY "Workspace super admins can manage invitations"
ON invitations FOR ALL
USING (
  workspace_id = current_workspace()
  AND EXISTS (
    SELECT 1 FROM users
    WHERE users.id = auth.uid()
    AND users.role = 'super_admin'
  )
)
WITH CHECK (
  workspace_id = current_workspace()
  AND EXISTS (
    SELECT 1 FROM users
    WHERE users.id = auth.uid()
    AND users.role = 'super_admin'
  )
);
