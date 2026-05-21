-- Ecosystem Expansion Phase 1 — New tables

-- ── 1. Documents ──────────────────────────────────────────────────────────────
create table if not exists documents (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  project_id uuid references projects(id) on delete cascade,
  author_id uuid references users(id) on delete set null,
  title text not null,
  content text default '',
  doc_type text not null default 'markdown',
  tags text[] default '{}',
  pinned boolean default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table documents enable row level security;
drop policy if exists "Documents are workspace-scoped" on documents;
create policy "Documents are workspace-scoped" on documents for all
  using (workspace_id = current_workspace())
  with check (workspace_id = current_workspace());

create table if not exists doc_versions (
  id uuid primary key default gen_random_uuid(),
  doc_id uuid not null references documents(id) on delete cascade,
  version int not null,
  content text not null,
  author_id uuid references users(id) on delete set null,
  change_summary text,
  hash text not null,
  created_at timestamptz not null default now()
);
alter table doc_versions enable row level security;
drop policy if exists "Doc versions are workspace-scoped" on doc_versions;
create policy "Doc versions are workspace-scoped" on doc_versions for all
  using (doc_id in (select id from documents where workspace_id = current_workspace()))
  with check (doc_id in (select id from documents where workspace_id = current_workspace()));

create table if not exists doc_annotations (
  id uuid primary key default gen_random_uuid(),
  doc_id uuid not null references documents(id) on delete cascade,
  author_id uuid references users(id) on delete set null,
  selection_start int not null,
  selection_end int not null,
  comment text not null,
  resolved boolean default false,
  created_at timestamptz not null default now()
);
alter table doc_annotations enable row level security;
drop policy if exists "Doc annotations are workspace-scoped" on doc_annotations;
create policy "Doc annotations are workspace-scoped" on doc_annotations for all
  using (doc_id in (select id from documents where workspace_id = current_workspace()))
  with check (doc_id in (select id from documents where workspace_id = current_workspace()));

-- ── 2. Integrations ────────────────────────────────────────────────────────────
create table if not exists connected_accounts (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  user_id uuid references users(id) on delete set null,
  service text not null,
  access_token text,
  refresh_token text,
  token_expires_at timestamptz,
  scopes text[] default '{}',
  connected_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table connected_accounts enable row level security;
drop policy if exists "Connected accounts are workspace-scoped" on connected_accounts;
create policy "Connected accounts are workspace-scoped" on connected_accounts for all
  using (workspace_id = current_workspace())
  with check (workspace_id = current_workspace());

create table if not exists integration_configs (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  project_id uuid references projects(id) on delete cascade,
  service text not null,
  config jsonb not null default '{}'::jsonb,
  enabled boolean default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table integration_configs enable row level security;
drop policy if exists "Integration configs are workspace-scoped" on integration_configs;
create policy "Integration configs are workspace-scoped" on integration_configs for all
  using (workspace_id = current_workspace())
  with check (workspace_id = current_workspace());

create table if not exists integration_health (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  service text not null,
  status text not null default 'disconnected',
  last_sync timestamptz,
  last_error text,
  latency_ms int,
  retry_count int default 0,
  checked_at timestamptz not null default now()
);
alter table integration_health enable row level security;
drop policy if exists "Integration health is workspace-scoped" on integration_health;
create policy "Integration health is workspace-scoped" on integration_health for all
  using (workspace_id = current_workspace())
  with check (workspace_id = current_workspace());

create table if not exists webhooks (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  name text not null,
  url text not null,
  secret text,
  events text[] not null default '{}',
  enabled boolean default true,
  last_triggered_at timestamptz,
  created_at timestamptz not null default now()
);
alter table webhooks enable row level security;
drop policy if exists "Webhooks are workspace-scoped" on webhooks;
create policy "Webhooks are workspace-scoped" on webhooks for all
  using (workspace_id = current_workspace())
  with check (workspace_id = current_workspace());

-- ── 3. Approvals ───────────────────────────────────────────────────────────────
create table if not exists approval_chains (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  name text not null,
  trigger_event text,
  trigger_config jsonb default '{}'::jsonb,
  enabled boolean default true,
  created_at timestamptz not null default now()
);
alter table approval_chains enable row level security;
drop policy if exists "Approval chains are workspace-scoped" on approval_chains;
create policy "Approval chains are workspace-scoped" on approval_chains for all
  using (workspace_id = current_workspace())
  with check (workspace_id = current_workspace());

create table if not exists approval_steps (
  id uuid primary key default gen_random_uuid(),
  chain_id uuid not null references approval_chains(id) on delete cascade,
  step_order int not null,
  approver_role text not null,
  approver_id uuid references users(id) on delete set null,
  timeout_hours int default 48,
  created_at timestamptz not null default now()
);
alter table approval_steps enable row level security;
drop policy if exists "Approval steps are workspace-scoped" on approval_steps;
create policy "Approval steps are workspace-scoped" on approval_steps for all
  using (chain_id in (select id from approval_chains where workspace_id = current_workspace()))
  with check (chain_id in (select id from approval_chains where workspace_id = current_workspace()));

create table if not exists approval_instances (
  id uuid primary key default gen_random_uuid(),
  chain_id uuid not null references approval_chains(id) on delete cascade,
  target_type text not null,
  target_id text not null,
  status text not null default 'pending',
  current_step int default 1,
  initiated_by uuid references users(id) on delete set null,
  completed_at timestamptz,
  created_at timestamptz not null default now()
);
alter table approval_instances enable row level security;
drop policy if exists "Approval instances are workspace-scoped" on approval_instances;
create policy "Approval instances are workspace-scoped" on approval_instances for all
  using (chain_id in (select id from approval_chains where workspace_id = current_workspace()))
  with check (chain_id in (select id from approval_chains where workspace_id = current_workspace()));

-- ── 4. Notifications ───────────────────────────────────────────────────────────
create table if not exists notification_channels (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  channel text not null,
  enabled boolean default true,
  config jsonb default '{}'::jsonb,
  created_at timestamptz not null default now()
);
alter table notification_channels enable row level security;
drop policy if exists "Notification channels are workspace-scoped" on notification_channels;
create policy "Notification channels are workspace-scoped" on notification_channels for all
  using (workspace_id = current_workspace())
  with check (workspace_id = current_workspace());

create table if not exists mention_rules (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  keyword text not null,
  notify_roles text[] not null default '{}',
  notify_users uuid[] default '{}',
  channel text not null default 'push',
  created_at timestamptz not null default now()
);
alter table mention_rules enable row level security;
drop policy if exists "Mention rules are workspace-scoped" on mention_rules;
create policy "Mention rules are workspace-scoped" on mention_rules for all
  using (workspace_id = current_workspace())
  with check (workspace_id = current_workspace());

create table if not exists escalation_policies (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  name text not null,
  trigger_condition text not null,
  steps jsonb not null default '[]'::jsonb,
  enabled boolean default true,
  created_at timestamptz not null default now()
);
alter table escalation_policies enable row level security;
drop policy if exists "Escalation policies are workspace-scoped" on escalation_policies;
create policy "Escalation policies are workspace-scoped" on escalation_policies for all
  using (workspace_id = current_workspace())
  with check (workspace_id = current_workspace());

-- ── 5. Automations ─────────────────────────────────────────────────────────────
create table if not exists automation_rules (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  name text not null,
  trigger_event text not null,
  trigger_filters jsonb default '{}'::jsonb,
  actions jsonb not null,
  enabled boolean default true,
  created_at timestamptz not null default now()
);
alter table automation_rules enable row level security;
drop policy if exists "Automation rules are workspace-scoped" on automation_rules;
create policy "Automation rules are workspace-scoped" on automation_rules for all
  using (workspace_id = current_workspace())
  with check (workspace_id = current_workspace());

create table if not exists automation_templates (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text,
  category text not null,
  trigger_event text not null,
  actions jsonb not null,
  icon text default 'zap',
  created_at timestamptz not null default now()
);
alter table automation_templates enable row level security;
drop policy if exists "Automation templates are public" on automation_templates;
create policy "Automation templates are public" on automation_templates for all
  using (true)
  with check (true);

-- Indexes
create index if not exists idx_documents_workspace on documents (workspace_id, updated_at desc);
create index if not exists idx_doc_versions_doc on doc_versions (doc_id, version desc);
create index if not exists idx_connected_accounts_service on connected_accounts (workspace_id, service);
create index if not exists idx_integration_configs_project on integration_configs (workspace_id, project_id);
create index if not exists idx_integration_health_service on integration_health (workspace_id, service);
create index if not exists idx_approval_instances_status on approval_instances (chain_id, status);
create index if not exists idx_automation_rules_event on automation_rules (workspace_id, trigger_event);
