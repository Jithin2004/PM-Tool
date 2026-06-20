const fs = require('fs');
const sqlFile = 'c:\\Users\\jithi\\OneDrive\\Desktop\\Resolve PM\\Resolve PM\\database\\production\\RESOLVE_PM_V1_3_INSTALL.sql';
const toAppend = `

-- ==============================================================================
-- 30. PRODUCTION ENGINE V2 - PHASE 3D NOTIFICATION & COMMUNICATION ENGINE
-- ==============================================================================

CREATE TABLE IF NOT EXISTS public.notification_events (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
    recipient_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    source_event_id uuid REFERENCES public.activity_events(id) ON DELETE SET NULL,
    entity_type text,
    entity_id uuid,
    priority text NOT NULL DEFAULT 'normal' CHECK (priority IN ('low', 'normal', 'high', 'critical')),
    category text NOT NULL CHECK (category IN ('task', 'approval', 'risk', 'finance', 'hr', 'system')),
    title text NOT NULL,
    message text,
    action_url text,
    metadata jsonb DEFAULT '{}'::jsonb,
    read_at timestamptz,
    created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.notification_preferences (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
    user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    settings jsonb NOT NULL DEFAULT '{"task_updates":true, "finance_alerts":true, "daily_digest":true, "mention_alerts":true, "sound_enabled":false, "sound_level":"important", "quiet_hours":{"enabled":false,"start":"22:00","end":"07:00"}, "category_sound":{"task":true,"approval":true,"risk":true,"finance":true,"hr":false,"system":true}, "focus_mode":false}'::jsonb,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    UNIQUE(workspace_id, user_id)
);

ALTER TABLE public.notification_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notification_preferences ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own notifications" ON public.notification_events FOR SELECT
  USING (recipient_id = auth.uid());

CREATE POLICY "Users update own notifications" ON public.notification_events FOR UPDATE
  USING (recipient_id = auth.uid());

CREATE POLICY "Users view own preferences" ON public.notification_preferences FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "Users update own preferences" ON public.notification_preferences FOR UPDATE
  USING (user_id = auth.uid());

CREATE POLICY "Users insert own preferences" ON public.notification_preferences FOR INSERT
  WITH CHECK (user_id = auth.uid());

-- Triggers for realtime
alter publication supabase_realtime add table notification_events;

`;
fs.appendFileSync(sqlFile, toAppend);
