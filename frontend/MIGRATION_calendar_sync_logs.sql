CREATE TABLE IF NOT EXISTS calendar_sync_logs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  provider TEXT NOT NULL,
  country TEXT NOT NULL,
  region TEXT,
  year INTEGER NOT NULL,
  holidays_found INTEGER NOT NULL DEFAULT 0,
  holidays_imported INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL CHECK (status IN ('success', 'partial', 'failed', 'skipped', 'unsupported')),
  error_message TEXT,
  previous_hash TEXT NOT NULL DEFAULT 'GENESIS_BLOCK',
  hash TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE calendar_sync_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Sync logs are isolated by workspace" ON calendar_sync_logs;
CREATE POLICY "Sync logs are isolated by workspace"
  ON calendar_sync_logs FOR ALL
  USING (workspace_id = current_workspace())
  WITH CHECK (workspace_id = current_workspace());

CREATE INDEX IF NOT EXISTS idx_calendar_sync_logs_workspace ON calendar_sync_logs (workspace_id);
CREATE INDEX IF NOT EXISTS idx_calendar_sync_logs_created ON calendar_sync_logs (workspace_id, created_at DESC);

ALTER TABLE calendar_events ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;
ALTER TABLE calendar_events ADD COLUMN IF NOT EXISTS source_id TEXT;
ALTER TABLE calendar_events ADD COLUMN IF NOT EXISTS source_table TEXT;

CREATE INDEX IF NOT EXISTS idx_calendar_events_source ON calendar_events (source_table, source_id);
CREATE INDEX IF NOT EXISTS idx_calendar_events_deleted ON calendar_events (deleted_at) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_calendar_events_auto_gen ON calendar_events (auto_generated) WHERE auto_generated = TRUE;
