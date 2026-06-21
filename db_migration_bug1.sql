-- Bug #1: Add entity_type to activity_logs
ALTER TABLE activity_logs ADD COLUMN IF NOT EXISTS entity_type VARCHAR;
