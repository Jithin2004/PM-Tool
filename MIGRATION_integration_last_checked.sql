-- Add integration_last_checked to distinguish last health check from last successful sync
alter table integration_health add column if not exists integration_last_checked timestamptz;
create index if not exists idx_integration_health_checked on integration_health using btree (workspace_id, integration_last_checked);
