-- Command Usage Events table
-- Moves telemetry from localStorage to Supabase for trustworthy workflow intelligence

create table if not exists command_usage_events (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  user_id uuid references users(id) on delete set null,
  command_id text not null,
  command_type text not null,
  route text,
  session_id text,
  timestamp timestamptz not null default now(),
  metadata jsonb not null default '{}'::jsonb
);

alter table command_usage_events enable row level security;

drop policy if exists "Command usage is isolated by workspace" on command_usage_events;
create policy "Command usage is isolated by workspace"
on command_usage_events for all
using (workspace_id = current_workspace())
with check (workspace_id = current_workspace());

-- Index for analytics queries
create index if not exists idx_command_usage_workspace_ts
  on command_usage_events (workspace_id, timestamp desc);

create index if not exists idx_command_usage_user
  on command_usage_events (workspace_id, user_id);

create index if not exists idx_command_usage_type
  on command_usage_events (workspace_id, command_type);
