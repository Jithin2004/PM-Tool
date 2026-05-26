-- Repair duplicate holiday_provider keys before unique index creation.
-- Legacy sync stored source_id = 'local-builtin' (provider only) on many rows.
-- Canonical format: {provider}:{YYYY-MM-DD}:{title-slug}  e.g. local-builtin:2025-01-26:republic-day
--
-- Run this in Supabase SQL Editor, then re-run MIGRATION_calendar_sync_logs.sql (index section).

-- 1) Backfill canonical source_id for legacy provider-only keys
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

-- 2) Soft-delete duplicate active rows (keep newest)
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

-- 3) Verify (should return 0 rows)
-- SELECT workspace_id, source_table, source_id, COUNT(*) AS cnt
-- FROM calendar_events
-- WHERE source_table = 'holiday_provider'
--   AND source_id IS NOT NULL
--   AND deleted_at IS NULL
-- GROUP BY 1, 2, 3
-- HAVING COUNT(*) > 1;
