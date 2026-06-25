-- RC25_5_HOTFIX_FRONTEND_SCHEMA_COMPATIBILITY.sql
-- Description: Restores legacy integration and webhook tables that were dropped 
-- during the v1.3 database rewrite, but are still actively queried by the frontend.
-- This ensures the UI does not crash with 404 Schema Cache errors on these pages.

-- 1. Create legacy integration_connections table
CREATE TABLE IF NOT EXISTS public.integration_connections (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
    provider text NOT NULL,
    status text,
    connected_by uuid REFERENCES public.users(id) ON DELETE SET NULL,
    encrypted_credentials jsonb,
    config jsonb,
    last_sync_at timestamptz,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
);
ALTER TABLE public.integration_connections ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Enable all operations for workspace users" ON public.integration_connections;
CREATE POLICY "Enable all operations for workspace users" ON public.integration_connections FOR ALL USING (workspace_id = public.current_workspace());

-- 2. Create legacy integration_events table
CREATE TABLE IF NOT EXISTS public.integration_events (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
    integration_id uuid REFERENCES public.integration_connections(id) ON DELETE CASCADE,
    direction text,
    event_type text,
    processing_status text,
    error_message text,
    payload jsonb,
    created_at timestamptz DEFAULT now()
);
ALTER TABLE public.integration_events ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Enable all operations for workspace users" ON public.integration_events;
CREATE POLICY "Enable all operations for workspace users" ON public.integration_events FOR ALL USING (workspace_id = public.current_workspace());

-- 3. Create legacy webhook_endpoints table
CREATE TABLE IF NOT EXISTS public.webhook_endpoints (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
    url text NOT NULL,
    secret text,
    events text[],
    created_by uuid REFERENCES public.users(id) ON DELETE SET NULL,
    is_active boolean DEFAULT true,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
);
ALTER TABLE public.webhook_endpoints ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Enable all operations for workspace users" ON public.webhook_endpoints;
CREATE POLICY "Enable all operations for workspace users" ON public.webhook_endpoints FOR ALL USING (workspace_id = public.current_workspace());

-- 4. Create missing workspace_members view for any lingering queries that escaped the patch
CREATE OR REPLACE VIEW public.workspace_members AS
SELECT 
    id as id,
    workspace_id as workspace_id,
    id as user_id,
    role as role,
    created_at as joined_at
FROM public.users
WHERE workspace_id IS NOT NULL;

-- Reload the PostgREST schema cache so the frontend can see the new tables immediately
NOTIFY pgrst, 'reload schema';
