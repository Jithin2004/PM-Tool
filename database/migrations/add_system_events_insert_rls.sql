-- Migration: Add RLS Policies for system_events table
-- Description: Grant INSERT for authenticated users, SELECT for workspace scoping, and DELETE for admins

-- Ensure RLS is enabled on the table
ALTER TABLE system_events ENABLE ROW LEVEL SECURITY;

-- 1. INSERT policy for authenticated users (Telemetry writes)
CREATE POLICY "Enable insert for authenticated users" 
ON system_events 
FOR INSERT 
TO authenticated 
WITH CHECK (true);

-- 2. SELECT policy (Workspace-scoped read access)
CREATE POLICY "Enable select based on workspace_id" 
ON system_events 
FOR SELECT 
TO authenticated 
USING (
  workspace_id IN (
    SELECT workspace_id FROM users WHERE id = auth.uid()
  )
);

-- 3. DELETE policy (Admin cleanup)
CREATE POLICY "Enable delete for admins" 
ON system_events 
FOR DELETE 
TO authenticated 
USING (
  EXISTS (
    SELECT 1 FROM users 
    WHERE users.id = auth.uid() AND users.role IN ('super_admin', 'pm')
  )
);
