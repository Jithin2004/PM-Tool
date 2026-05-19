-- Migration to extract SYSTEM_SETTINGS from the teams table blob
CREATE TABLE IF NOT EXISTS workspace_settings (
  workspace_id UUID PRIMARY KEY REFERENCES workspaces(id) ON DELETE CASCADE,
  working_hours NUMERIC DEFAULT 8,
  working_time_from TEXT DEFAULT '09:00',
  working_time_to TEXT DEFAULT '17:00',
  lunch_duration_minutes INTEGER DEFAULT 60,
  settings_blob JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE workspace_settings ENABLE ROW LEVEL SECURITY;

-- Allow users to read their own workspace settings
CREATE POLICY "Users can read workspace settings"
  ON workspace_settings FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.workspace_id = workspace_settings.workspace_id
      AND users.id = auth.uid()
    )
  );

-- Allow admins to insert/update workspace settings
CREATE POLICY "Admins can update workspace settings"
  ON workspace_settings FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.workspace_id = workspace_settings.workspace_id
      AND users.id = auth.uid()
      AND users.role = 'super_admin'
    )
  );
