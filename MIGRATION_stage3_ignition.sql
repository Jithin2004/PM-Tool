-- Stage 3 Ignition: API keys + webhook delivery logging
create table if not exists api_keys (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  name text not null,
  key_hash text not null,
  key_prefix text not null,
  permissions text[] not null default '{read}',
  created_by uuid references users(id) on delete set null,
  last_used_at timestamptz,
  expires_at timestamptz,
  revoked boolean default false,
  created_at timestamptz not null default now()
);
alter table api_keys enable row level security;
drop policy if exists "API keys are workspace-scoped" on api_keys;
create policy "API keys are workspace-scoped" on api_keys for all
  using (workspace_id = current_workspace())
  with check (workspace_id = current_workspace());

create index if not exists idx_api_keys_workspace on api_keys (workspace_id);
create index if not exists idx_api_keys_prefix on api_keys (key_prefix);

-- Add execution_id to automation_rules for tracking
alter table automation_rules add column if not exists last_executed_at timestamptz;
alter table automation_rules add column if not exists execution_count int default 0;
