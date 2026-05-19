-- Migration script to create ai_recommendations audit table
create table if not exists ai_recommendations (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  recommendation_type text not null,
  task_id uuid references tasks(id) on delete set null,
  original_assignee_id uuid references users(id) on delete set null,
  suggested_assignee_id uuid references users(id) on delete set null,
  predicted_eta_improvement numeric,
  risk_delta integer,
  confidence_delta numeric,
  status text not null default 'pending' check (status in ('pending', 'accepted', 'rejected')),
  created_at timestamptz not null default now()
);

-- Enable RLS and create isolation policy
alter table ai_recommendations enable row level security;

create policy "AI recommendations are isolated by workspace"
on ai_recommendations for all
using (workspace_id = current_workspace())
with check (workspace_id = current_workspace());
