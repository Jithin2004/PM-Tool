-- Migration: Add RLS INSERT policy for system_events table
-- Purpose: Allow authenticated users to insert telemetry and observability data into system_events
-- This resolves HTTP 403 errors: "new row violates row-level security policy for table "system_events""

-- Enable RLS if not already enabled
ALTER TABLE public.system_events ENABLE ROW LEVEL SECURITY;

-- Create policy to allow authenticated users to INSERT records
CREATE POLICY "Allow authenticated inserts to system_events" 
  ON public.system_events 
  FOR INSERT 
  TO authenticated 
  WITH CHECK (true);

-- Ensure workspace_id-based read access for current user
-- Allow users to SELECT records from their own workspace
CREATE POLICY "Allow users to read system_events from their workspace"
  ON public.system_events
  FOR SELECT
  TO authenticated
  USING (
    workspace_id IN (
      SELECT workspace_id FROM public.users 
      WHERE id = auth.uid()
    )
  );

-- Allow workspace admins to DELETE system_events records (for maintenance/cleanup)
CREATE POLICY "Allow admins to manage system_events"
  ON public.system_events
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.users 
      WHERE id = auth.uid() 
      AND workspace_id = system_events.workspace_id 
      AND role IN ('owner', 'super_admin')
    )
  );
