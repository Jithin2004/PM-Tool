-- Migration: Add Company Calendar tables

CREATE TABLE IF NOT EXISTS public.workspace_calendar_settings (
  workspace_id uuid PRIMARY KEY REFERENCES public.workspaces(id) ON DELETE CASCADE,
  working_days jsonb NOT NULL DEFAULT '[1,2,3,4,5,6]'::jsonb, -- 0=Sun, 1=Mon, ..., 6=Sat
  saturday_policy text NOT NULL DEFAULT 'all_working' CHECK (saturday_policy IN ('all_working', 'all_off', '1st_3rd_off', '2nd_4th_off')),
  timezone text NOT NULL DEFAULT 'UTC',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Note: We recreate company_calendar_events to match the precise enterprise rules 
-- (merging sync and manual/import without pm-tool-server).
CREATE TABLE IF NOT EXISTS public.company_calendar_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  name text NOT NULL,
  date date NOT NULL,
  event_type text NOT NULL CHECK (event_type IN ('holiday', 'festival', 'regional', 'company', 'meeting', 'event', 'maintenance', 'custom')),
  source text NOT NULL DEFAULT 'manual', -- 'sync', 'manual_import', 'manual'
  year int NOT NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(workspace_id, date, name)
);

-- Trigger to create default calendar settings when a new workspace is created
CREATE OR REPLACE FUNCTION public.create_default_calendar_settings()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.workspace_calendar_settings (workspace_id, working_days, saturday_policy, timezone)
  VALUES (NEW.id, '[1,2,3,4,5,6]'::jsonb, 'all_working', 'UTC')
  ON CONFLICT DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_workspace_created_calendar ON public.workspaces;
CREATE TRIGGER on_workspace_created_calendar
  AFTER INSERT ON public.workspaces
  FOR EACH ROW EXECUTE FUNCTION public.create_default_calendar_settings();
