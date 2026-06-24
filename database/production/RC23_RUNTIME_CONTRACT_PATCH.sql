-- RC23_RUNTIME_CONTRACT_PATCH.sql

-- 1. Files Soft Delete
ALTER TABLE public.files ADD COLUMN IF NOT EXISTS archived_at timestamptz;
ALTER TABLE public.files ADD COLUMN IF NOT EXISTS archived_by uuid REFERENCES public.users(id);

-- 2. Connected Accounts
ALTER TABLE public.connected_accounts ADD COLUMN IF NOT EXISTS connected_at timestamptz DEFAULT now();

-- 3. Integration Health
CREATE TABLE IF NOT EXISTS public.integration_health (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  workspace_id uuid REFERENCES public.workspaces(id) ON DELETE CASCADE,
  provider text NOT NULL,
  status text NOT NULL,
  last_checked_at timestamptz,
  last_error text,
  retry_count integer default 0,
  metadata jsonb default '{}',
  created_at timestamptz,
  updated_at timestamptz
);

-- 4. Automation Templates
CREATE TABLE IF NOT EXISTS public.automation_templates (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  name text NOT NULL,
  description text,
  category text NOT NULL,
  trigger_event text NOT NULL,
  actions jsonb NOT NULL,
  icon text NOT NULL,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now()
);

-- 5. Storage Usage View
CREATE OR REPLACE VIEW public.workspace_storage_usage AS
SELECT workspace_id, COALESCE(sum(file_size), 0) as used_bytes
FROM public.files
WHERE archived_at IS NULL
GROUP BY workspace_id;
