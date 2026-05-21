-- Stage 2 Hardening: rate limiting, OAuth sessions, health trend

-- Add last_sync_attempt to integration_health for cooldown tracking
alter table integration_health add column if not exists last_sync_attempt timestamptz;

-- OAuth sessions table for state verification
create table if not exists oauth_sessions (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  provider text not null,
  state_token text not null unique,
  expires_at timestamptz not null,
  used boolean default false,
  created_by uuid references users(id) on delete set null,
  created_at timestamptz not null default now()
);
alter table oauth_sessions enable row level security;
drop policy if exists "OAuth sessions are workspace-scoped" on oauth_sessions;
create policy "OAuth sessions are workspace-scoped" on oauth_sessions for all
  using (workspace_id = current_workspace())
  with check (workspace_id = current_workspace());

create index if not exists idx_oauth_sessions_token on oauth_sessions (state_token);
create index if not exists idx_oauth_sessions_expires on oauth_sessions (expires_at);
