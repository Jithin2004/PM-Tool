-- Resolve PM Execution Model Expansion
-- Run in Supabase SQL Editor. Back up data first.

-- ── 1. Extend projects with execution_mode ──────────────────────────────────
alter table projects add column if not exists execution_mode text not null default 'KANBAN'
  check (execution_mode in ('KANBAN', 'SCRUM', 'SDLC', 'CUSTOM'));

-- ── 2. Extend task status to support KANBAN "ready" ─────────────────────────
alter table tasks drop constraint if exists tasks_status_check;
alter table tasks add constraint tasks_status_check
  check (status in ('backlog', 'ready', 'in_progress', 'review', 'done'));

-- ── 3. Epics table (SCRUM / SDLC) ──────────────────────────────────────────
create table if not exists epics (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  project_id uuid not null references projects(id) on delete cascade,
  name text not null,
  description text,
  status text not null default 'backlog' check (status in ('backlog', 'in_progress', 'review', 'done')),
  priority text not null default 'medium' check (priority in ('low', 'medium', 'high', 'urgent')),
  start_date timestamptz,
  deadline timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ── 4. Sprints table (SCRUM) ───────────────────────────────────────────────
create table if not exists sprints (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  project_id uuid not null references projects(id) on delete cascade,
  name text not null,
  goal text,
  start_date timestamptz not null,
  end_date timestamptz not null,
  status text not null default 'planned' check (status in ('planned', 'active', 'completed', 'cancelled')),
  velocity_committed numeric default 0,
  velocity_completed numeric default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (start_date <= end_date)
);

-- ── 5. Extend tasks with SCRUM fields (after sprints table exists) ──────────
alter table tasks add column if not exists story_points numeric default 0;
alter table tasks add column if not exists epic_id uuid references epics(id) on delete set null;
alter table tasks add column if not exists sprint_id uuid references sprints(id) on delete set null;
alter table tasks add column if not exists definition_of_done text;
alter table tasks add column if not exists acceptance_criteria text;

-- ── 6. Meetings table (SDLC / all modes) ───────────────────────────────────
create table if not exists meetings (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  project_id uuid references projects(id) on delete cascade,
  title text not null,
  description text,
  meeting_type text not null default 'sync' check (meeting_type in ('sync', 'planning', 'review', 'retrospective', 'standup', 'design', 'qa', 'release', 'post-mortem', 'custom')),
  start_time timestamptz not null,
  end_time timestamptz not null,
  organizer_id uuid references users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (start_time <= end_time)
);

-- Meeting attendees junction
create table if not exists meeting_attendees (
  meeting_id uuid not null references meetings(id) on delete cascade,
  user_id uuid not null references users(id) on delete cascade,
  attended boolean default false,
  primary key (meeting_id, user_id)
);

-- ── 7. Milestones table (SDLC / all modes) ─────────────────────────────────
create table if not exists milestones (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  project_id uuid not null references projects(id) on delete cascade,
  sprint_id uuid references sprints(id) on delete set null,
  title text not null,
  description text,
  target_date timestamptz not null,
  status text not null default 'pending' check (status in ('pending', 'achieved', 'missed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ── 8. Approvals table (SDLC) ──────────────────────────────────────────────
create table if not exists approvals (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  project_id uuid not null references projects(id) on delete cascade,
  milestone_id uuid references milestones(id) on delete set null,
  task_id uuid references tasks(id) on delete set null,
  phase text not null,
  approver_id uuid references users(id) on delete set null,
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  comment text,
  reviewed_at timestamptz,
  created_at timestamptz not null default now()
);

-- ── 9. Activity logs with hash chain (immutable audit trail) ────────────────
-- Drop old activity_logs and recreate with hash chain support
drop table if exists activity_logs cascade;

create table activity_logs (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  actor_id uuid references users(id) on delete set null,
  project_id uuid references projects(id) on delete cascade,
  task_id uuid references tasks(id) on delete cascade,
  action text not null,
  metadata jsonb not null default '{}'::jsonb,
  previous_hash text not null default 'GENESIS_BLOCK',
  hash text not null,
  created_at timestamptz not null default now()
);

-- ── 10. Enable RLS on all new tables ────────────────────────────────────────
alter table epics enable row level security;
alter table sprints enable row level security;
alter table meetings enable row level security;
alter table meeting_attendees enable row level security;
alter table milestones enable row level security;
alter table approvals enable row level security;
alter table activity_logs enable row level security;

-- ── 11. RLS Policies ────────────────────────────────────────────────────────

-- Epics
drop policy if exists "Epics are isolated by workspace" on epics;
create policy "Epics are isolated by workspace"
on epics for all
using (workspace_id = current_workspace())
with check (workspace_id = current_workspace());

-- Sprints
drop policy if exists "Sprints are isolated by workspace" on sprints;
create policy "Sprints are isolated by workspace"
on sprints for all
using (workspace_id = current_workspace())
with check (workspace_id = current_workspace());

-- Meetings
drop policy if exists "Meetings are isolated by workspace" on meetings;
create policy "Meetings are isolated by workspace"
on meetings for all
using (workspace_id = current_workspace())
with check (workspace_id = current_workspace());

-- Meeting attendees
drop policy if exists "Meeting attendees are isolated by workspace" on meeting_attendees;
create policy "Meeting attendees are isolated by workspace"
on meeting_attendees for all
using (
  meeting_id in (select id from meetings where workspace_id = current_workspace())
)
with check (
  meeting_id in (select id from meetings where workspace_id = current_workspace())
);

-- Milestones
drop policy if exists "Milestones are isolated by workspace" on milestones;
create policy "Milestones are isolated by workspace"
on milestones for all
using (workspace_id = current_workspace())
with check (workspace_id = current_workspace());

-- Approvals
drop policy if exists "Approvals are isolated by workspace" on approvals;
create policy "Approvals are isolated by workspace"
on approvals for all
using (workspace_id = current_workspace())
with check (workspace_id = current_workspace());

-- Activity logs (append-only after insert)
drop policy if exists "Activity logs are isolated by workspace" on activity_logs;
create policy "Activity logs are isolated by workspace"
on activity_logs for select
using (workspace_id = current_workspace());

drop policy if exists "Activity logs can be inserted by workspace members" on activity_logs;
create policy "Activity logs can be inserted by workspace members"
on activity_logs for insert
with check (workspace_id = current_workspace());

-- No update or delete allowed on activity_logs (immutable)
-- Explicitly deny by not creating update/delete policies

-- ── 12. Real-time replication for Supabase subscriptions ────────────────────
alter publication supabase_realtime add table epics;
alter publication supabase_realtime add table sprints;
alter publication supabase_realtime add table meetings;
alter publication supabase_realtime add table meeting_attendees;
alter publication supabase_realtime add table milestones;
alter publication supabase_realtime add table approvals;
alter publication supabase_realtime add table activity_logs;
