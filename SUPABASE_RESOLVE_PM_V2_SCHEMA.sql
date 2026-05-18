-- Resolve PM v2 workspace-scoped schema draft.
-- Run in Supabase SQL Editor after backing up existing data.

create extension if not exists pgcrypto;

create table if not exists workspaces (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  owner_id uuid not null references auth.users(id) on delete cascade,
  business_type text not null default 'Software',
  work_start time not null default '09:00',
  work_end time not null default '17:00',
  lunch_duration_minutes integer not null default 60,
  working_days integer[] not null default array[1,2,3,4,5],
  timezone text not null default 'UTC',
  attendance_enabled boolean not null default true,
  payroll_enabled boolean not null default false,
  productivity_factor numeric not null default 0.8,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists users (
  id uuid primary key references auth.users(id) on delete cascade,
  workspace_id uuid not null references workspaces(id) on delete cascade,
  email text not null,
  full_name text,
  phone text,
  avatar_url text,
  role text not null default 'viewer' check (role in ('super_admin', 'pm', 'developer', 'viewer')),
  availability_factor numeric not null default 1,
  created_at timestamptz not null default now(),
  unique(workspace_id, email)
);

create table if not exists teams (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  name text not null,
  capacity_hours_per_week numeric,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists team_members (
  workspace_id uuid not null references workspaces(id) on delete cascade,
  team_id uuid not null references teams(id) on delete cascade,
  user_id uuid not null references users(id) on delete cascade,
  member_role text,
  primary key (team_id, user_id)
);

create table if not exists projects (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  team_id uuid references teams(id) on delete set null,
  owner_id uuid references users(id) on delete set null,
  name text not null,
  description text,
  status text not null default 'planning' check (status in ('planning', 'active', 'review', 'done', 'archived')),
  priority text not null default 'medium' check (priority in ('low', 'medium', 'high', 'urgent')),
  template text not null default 'Blank',
  deadline timestamptz,
  predicted_completion timestamptz,
  confidence integer,
  risk text check (risk in ('low', 'medium', 'high')),
  delay_drift_days integer default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists tasks (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  project_id uuid not null references projects(id) on delete cascade,
  assignee_id uuid references users(id) on delete set null,
  name text not null,
  description text,
  status text not null default 'backlog' check (status in ('backlog', 'in_progress', 'review', 'done')),
  priority text not null default 'medium' check (priority in ('low', 'medium', 'high', 'urgent')),
  start_date timestamptz,
  deadline timestamptz,
  estimated_hours numeric not null default 0,
  pert_best numeric,
  pert_likely numeric,
  pert_worst numeric,
  predicted_completion timestamptz,
  confidence integer,
  risk text check (risk in ('low', 'medium', 'high')),
  delay_drift_days integer default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists task_dependencies (
  workspace_id uuid not null references workspaces(id) on delete cascade,
  task_id uuid not null references tasks(id) on delete cascade,
  depends_on_task_id uuid not null references tasks(id) on delete cascade,
  primary key (task_id, depends_on_task_id),
  check (task_id <> depends_on_task_id)
);

create table if not exists comments (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  task_id uuid references tasks(id) on delete cascade,
  project_id uuid references projects(id) on delete cascade,
  author_id uuid references users(id) on delete set null,
  body text not null,
  created_at timestamptz not null default now()
);

create table if not exists files (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  project_id uuid references projects(id) on delete cascade,
  task_id uuid references tasks(id) on delete cascade,
  uploaded_by uuid references users(id) on delete set null,
  bucket text not null,
  path text not null,
  name text not null,
  mime_type text,
  size_bytes bigint,
  created_at timestamptz not null default now()
);

create table if not exists notifications (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  user_id uuid references users(id) on delete cascade,
  category text not null check (category in ('assignments', 'deadlines', 'risk', 'attendance', 'system')),
  title text not null,
  body text,
  read_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists activity_logs (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  actor_id uuid references users(id) on delete set null,
  project_id uuid references projects(id) on delete cascade,
  task_id uuid references tasks(id) on delete cascade,
  action text not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists attendance (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  user_id uuid not null references users(id) on delete cascade,
  date date not null,
  status text not null check (status in ('present', 'half_day', 'absent')),
  leave_type text check (leave_type in ('casual', 'medical', 'unexcused')),
  availability_factor numeric not null default 1,
  created_at timestamptz not null default now(),
  unique(workspace_id, user_id, date)
);

create or replace function current_workspace()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select workspace_id from users where id = auth.uid() limit 1
$$;

alter table workspaces enable row level security;
alter table users enable row level security;
alter table teams enable row level security;
alter table team_members enable row level security;
alter table projects enable row level security;
alter table tasks enable row level security;
alter table task_dependencies enable row level security;
alter table comments enable row level security;
alter table files enable row level security;
alter table notifications enable row level security;
alter table activity_logs enable row level security;
alter table attendance enable row level security;

create policy "Workspace members can view their workspace"
on workspaces for select
using (id = current_workspace() or owner_id = auth.uid());

create policy "Workspace owner can update workspace"
on workspaces for update
using (owner_id = auth.uid());

create policy "Workspace owner can create workspace"
on workspaces for insert
with check (owner_id = auth.uid());

create policy "Users are isolated by workspace"
on users for select
using (workspace_id = current_workspace() or id = auth.uid());

create policy "Workspace admins can manage users"
on users for all
using (
  exists (
    select 1 from users me
    where me.id = auth.uid()
      and me.workspace_id = users.workspace_id
      and me.role in ('super_admin', 'pm')
  )
);

create policy "Teams are isolated by workspace"
on teams for all
using (workspace_id = current_workspace())
with check (workspace_id = current_workspace());

create policy "Team members are isolated by workspace"
on team_members for all
using (workspace_id = current_workspace())
with check (workspace_id = current_workspace());

create policy "Projects are isolated by workspace"
on projects for all
using (workspace_id = current_workspace())
with check (workspace_id = current_workspace());

create policy "Tasks are isolated by workspace"
on tasks for all
using (workspace_id = current_workspace())
with check (workspace_id = current_workspace());

create policy "Task dependencies are isolated by workspace"
on task_dependencies for all
using (workspace_id = current_workspace())
with check (workspace_id = current_workspace());

create policy "Comments are isolated by workspace"
on comments for all
using (workspace_id = current_workspace())
with check (workspace_id = current_workspace());

create policy "Files are isolated by workspace"
on files for all
using (workspace_id = current_workspace())
with check (workspace_id = current_workspace());

create policy "Notifications are isolated by workspace"
on notifications for all
using (workspace_id = current_workspace())
with check (workspace_id = current_workspace());

create policy "Activity logs are isolated by workspace"
on activity_logs for all
using (workspace_id = current_workspace())
with check (workspace_id = current_workspace());

create policy "Attendance is isolated by workspace"
on attendance for all
using (workspace_id = current_workspace())
with check (workspace_id = current_workspace());

insert into storage.buckets (id, name, public)
values
  ('avatars', 'avatars', true),
  ('attachments', 'attachments', false),
  ('project-files', 'project-files', false),
  ('exports', 'exports', false)
on conflict (id) do nothing;
