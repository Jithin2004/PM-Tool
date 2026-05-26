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

-- Repair legacy rows that used provider name only as source_id (e.g. many rows with 'local-builtin')
UPDATE calendar_events ce
SET
  source_id = concat(
    CASE
      WHEN ce.source_id IS NULL OR ce.source_id = '' THEN 'local-builtin'
      WHEN position(':' IN ce.source_id) = 0 THEN ce.source_id
      ELSE split_part(ce.source_id, ':', 1)
    END,
    ':',
    to_char(ce.start_date::date, 'YYYY-MM-DD'),
    ':',
    trim(both '-' from regexp_replace(lower(trim(coalesce(ce.title, 'holiday'))), '[^a-z0-9]+', '-', 'g'))
  ),
  updated_at = NOW()
WHERE ce.source_table = 'holiday_provider'
  AND ce.deleted_at IS NULL
  AND (
    ce.source_id IS NULL
    OR ce.source_id = ''
    OR position(':' IN ce.source_id) = 0
    OR ce.source_id IN ('local-builtin', 'nager-date', 'nager_date')
  );

WITH ranked AS (
  SELECT
    id,
    ROW_NUMBER() OVER (
      PARTITION BY workspace_id, source_table, source_id
      ORDER BY updated_at DESC NULLS LAST, created_at DESC NULLS LAST, id
    ) AS rn
  FROM calendar_events
  WHERE source_table = 'holiday_provider'
    AND source_id IS NOT NULL
    AND deleted_at IS NULL
)
UPDATE calendar_events ce
SET deleted_at = NOW(), updated_at = NOW()
FROM ranked r
WHERE ce.id = r.id
  AND r.rn > 1;

-- Idempotent holiday sync: one active row per provider reconciliation key
CREATE UNIQUE INDEX IF NOT EXISTS idx_calendar_events_holiday_provider_key
  ON calendar_events (workspace_id, source_table, source_id)
  WHERE source_table = 'holiday_provider'
    AND source_id IS NOT NULL
    AND deleted_at IS NULL;
