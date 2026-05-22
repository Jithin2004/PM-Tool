-- Queue persistence: integration_sync_jobs survives refresh, crash, browser restart
create table if not exists integration_sync_jobs (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  service text not null,
  payload jsonb not null default '{}'::jsonb,
  status text not null default 'queued',
  attempts int not null default 0,
  max_attempts int not null default 3,
  created_at timestamptz not null default now(),
  started_at timestamptz,
  completed_at timestamptz,
  next_retry_at timestamptz,
  last_error text,
  created_by uuid references users(id) on delete set null
);
alter table integration_sync_jobs enable row level security;
drop policy if exists "Sync jobs are workspace-scoped" on integration_sync_jobs;
create policy "Sync jobs are workspace-scoped" on integration_sync_jobs for all
  using (workspace_id = current_workspace())
  with check (workspace_id = current_workspace());

create index if not exists idx_sync_jobs_status on integration_sync_jobs (status);
create index if not exists idx_sync_jobs_retry on integration_sync_jobs (status, next_retry_at);
create index if not exists idx_sync_jobs_workspace on integration_sync_jobs (workspace_id, status);
