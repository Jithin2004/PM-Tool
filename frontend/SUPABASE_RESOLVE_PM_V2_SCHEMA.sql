-- Resolve PM v2 workspace-scoped schema draft.
-- Run in Supabase SQL Editor after backing up existing data.

-- Drop old tables to prevent foreign key and column type conflicts
drop table if exists task_history_logs cascade;
drop table if exists tactical_tasks cascade;
drop table if exists task_dependencies cascade;
drop table if exists tasks cascade;
drop table if exists comments cascade;
drop table if exists files cascade;
drop table if exists activity_logs cascade;
drop table if exists notifications cascade;
drop table if exists team_members cascade;
drop table if exists teams cascade;
drop table if exists attendance cascade;
drop table if exists salaries cascade;
drop table if exists change_logs cascade;
drop table if exists projects cascade;
drop table if exists users cascade;
drop table if exists workspaces cascade;
drop table if exists profiles cascade;

create extension if not exists pgcrypto;

create table if not exists workspaces (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  owner_id uuid not null references auth.users(id) on delete cascade,
  business_type text not null default 'Software',
  work_start time not null default '09:00',
  work_end time not null default '17:00',
  lunch_duration integer not null default 60,
  workdays integer[] not null default array[1,2,3,4,5],
  timezone text not null default 'UTC',
  attendance_enabled boolean not null default true,
  payroll_enabled boolean not null default false,
  productivity_factor numeric not null default 0.8,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists users (
  id uuid primary key references auth.users(id) on delete cascade,
  workspace_id uuid references workspaces(id) on delete cascade,
  email text not null,
  full_name text,
  phone text,
  avatar_url text,
  role text not null default 'viewer' check (role in ('super_admin', 'pm', 'developer', 'viewer', 'pending-workspace-setup')),
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
  client_deadline timestamptz,
  proposed_start_date timestamptz,
  pert_best numeric default 0,
  pert_likely numeric default 0,
  pert_worst numeric default 0,
  efficiency numeric default 1.0,
  tags text[] default '{}',
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

drop policy if exists "Workspace members can view their workspace" on workspaces;
create policy "Workspace members can view their workspace"
on workspaces for select
using (id = current_workspace() or owner_id = auth.uid());

drop policy if exists "Workspace owner can update workspace" on workspaces;
create policy "Workspace owner can update workspace"
on workspaces for update
using (owner_id = auth.uid());

drop policy if exists "Workspace owner can create workspace" on workspaces;
create policy "Workspace owner can create workspace"
on workspaces for insert
with check (owner_id = auth.uid());

drop policy if exists "Users are isolated by workspace" on users;
create policy "Users are isolated by workspace"
on users for select
using (auth.uid() is not null);

drop policy if exists "Workspace owner can create first super admin user" on users;
create policy "Workspace owner can create first super admin user"
on users for insert
with check (
  id = auth.uid()
  and role = 'super_admin'
  and exists (
    select 1 from workspaces
    where workspaces.id = users.workspace_id
      and workspaces.owner_id = auth.uid()
  )
);

drop policy if exists "Workspace admins can update users" on users;
create policy "Workspace admins can update users"
on users for update
using (
  exists (
    select 1 from users me
    where me.id = auth.uid()
      and me.workspace_id = users.workspace_id
      and me.role in ('super_admin', 'pm')
  )
);

drop policy if exists "Workspace admins can delete users" on users;
create policy "Workspace admins can delete users"
on users for delete
using (
  exists (
    select 1 from users me
    where me.id = auth.uid()
      and me.workspace_id = users.workspace_id
      and me.role in ('super_admin', 'pm')
  )
);

drop policy if exists "Workspace admins can insert users" on users;
create policy "Workspace admins can insert users"
on users for insert
with check (
  exists (
    select 1 from users me
    where me.id = auth.uid()
      and me.workspace_id = users.workspace_id
      and me.role in ('super_admin', 'pm')
  )
);

drop policy if exists "Users can insert their own pending user row" on users;
create policy "Users can insert their own pending user row"
on users for insert
with check (
  id = auth.uid()
  and role = 'pending-workspace-setup'
  and workspace_id is null
);

drop policy if exists "Invited users can bootstrap their own user row" on users;
create policy "Invited users can bootstrap their own user row"
on users for insert
with check (
  id = auth.uid()
  and lower(email) = lower(auth.email())
  and exists (
    select 1 from invitations
    where lower(invitations.email) = lower(auth.email())
      and invitations.workspace_id = users.workspace_id
      and invitations.role = users.role
      and invitations.status = 'pending'
  )
);

drop policy if exists "Users can update their own user row" on users;
create policy "Users can update their own user row"
on users for update
using (id = auth.uid())
with check (id = auth.uid());

drop policy if exists "Teams are isolated by workspace" on teams;
create policy "Teams are isolated by workspace"
on teams for all
using (workspace_id = current_workspace())
with check (workspace_id = current_workspace());

drop policy if exists "Team members are isolated by workspace" on team_members;
create policy "Team members are isolated by workspace"
on team_members for all
using (workspace_id = current_workspace())
with check (workspace_id = current_workspace());

drop policy if exists "Projects are isolated by workspace" on projects;
create policy "Projects are isolated by workspace"
on projects for all
using (workspace_id = current_workspace())
with check (workspace_id = current_workspace());

drop policy if exists "Tasks are isolated by workspace" on tasks;
create policy "Tasks are isolated by workspace"
on tasks for all
using (workspace_id = current_workspace())
with check (workspace_id = current_workspace());

drop policy if exists "Task dependencies are isolated by workspace" on task_dependencies;
create policy "Task dependencies are isolated by workspace"
on task_dependencies for all
using (workspace_id = current_workspace())
with check (workspace_id = current_workspace());

drop policy if exists "Comments are isolated by workspace" on comments;
create policy "Comments are isolated by workspace"
on comments for all
using (workspace_id = current_workspace())
with check (workspace_id = current_workspace());

drop policy if exists "Files are isolated by workspace" on files;
create policy "Files are isolated by workspace"
on files for all
using (workspace_id = current_workspace())
with check (workspace_id = current_workspace());

drop policy if exists "Notifications are isolated by workspace" on notifications;
create policy "Notifications are isolated by workspace"
on notifications for all
using (workspace_id = current_workspace())
with check (workspace_id = current_workspace());

drop policy if exists "Activity logs are isolated by workspace" on activity_logs;
create policy "Activity logs are isolated by workspace"
on activity_logs for all
using (workspace_id = current_workspace())
with check (workspace_id = current_workspace());

drop policy if exists "Attendance is isolated by workspace" on attendance;
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

-- -------------------------------------------------------------
-- Resolve Scheduling Intelligence Engine Additions
-- -------------------------------------------------------------

-- Alter workspaces table to support regional calendars
alter table workspaces add column if not exists country text;
alter table workspaces add column if not exists region text;

-- Create workspace_holidays table (Layer 2)
create table if not exists workspace_holidays (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  date date not null,
  name text not null,
  type text not null check (type in ('public', 'regional', 'festival', 'company')),
  unique(workspace_id, date)
);

-- Enable RLS for workspace_holidays
alter table workspace_holidays enable row level security;
drop policy if exists "Workspace holidays are isolated by workspace" on workspace_holidays;
create policy "Workspace holidays are isolated by workspace"
on workspace_holidays for all
using (workspace_id = current_workspace())
with check (workspace_id = current_workspace());

-- Create team_events table (Layer 3)
create table if not exists team_events (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references teams(id) on delete cascade,
  title text not null,
  start_date timestamptz not null,
  end_date timestamptz not null,
  availability_factor numeric not null default 1,
  check (start_date <= end_date)
);

-- Enable RLS for team_events
alter table team_events enable row level security;
drop policy if exists "Team events are isolated by team" on team_events;
create policy "Team events are isolated by team"
on team_events for all
using (team_id in (select id from teams where workspace_id = current_workspace()))
with check (team_id in (select id from teams where workspace_id = current_workspace()));

-- Create personal_leave table (Layer 4)
create table if not exists personal_leave (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  leave_type text not null,
  start_date timestamptz not null,
  end_date timestamptz not null,
  availability_factor numeric not null default 0,
  check (start_date <= end_date)
);

-- Enable RLS for personal_leave
alter table personal_leave enable row level security;
drop policy if exists "Personal leaves are isolated by user workspace" on personal_leave;
create policy "Personal leaves are isolated by user workspace"
on personal_leave for all
using (user_id in (select id from users where workspace_id = current_workspace()))
with check (user_id in (select id from users where workspace_id = current_workspace()));

-- Create workspace_settings table
create table if not exists workspace_settings (
  workspace_id uuid primary key references workspaces(id) on delete cascade,
  working_hours numeric default 8,
  working_time_from text default '09:00',
  working_time_to text default '17:00',
  lunch_duration_minutes integer default 60,
  settings_blob jsonb default '{}'::jsonb,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Enable RLS for workspace_settings
alter table workspace_settings enable row level security;
drop policy if exists "Workspace settings are isolated by workspace" on workspace_settings;
create policy "Workspace settings are isolated by workspace"
on workspace_settings for all
using (workspace_id = current_workspace())
with check (workspace_id = current_workspace());

-- Create salaries table
create table if not exists salaries (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  user_id uuid not null references users(id) on delete cascade,
  base_salary numeric not null default 3000,
  created_at timestamptz default now(),
  unique(workspace_id, user_id)
);

-- Enable RLS for salaries
alter table salaries enable row level security;
drop policy if exists "Salaries are isolated by workspace" on salaries;
create policy "Salaries are isolated by workspace"
on salaries for all
using (workspace_id = current_workspace())
with check (workspace_id = current_workspace());

-- Create invitations table
create table if not exists invitations (
  id uuid primary key default gen_random_uuid(),
  email text not null,
  workspace_id uuid not null references workspaces(id) on delete cascade,
  role text not null check (role in ('super_admin', 'pm', 'developer', 'viewer')),
  status text not null default 'pending' check (status in ('pending', 'accepted', 'revoked')),
  invited_by uuid references users(id) on delete set null,
  expires_at timestamptz not null,
  created_at timestamptz not null default now(),
  unique(workspace_id, email)
);

-- Enable RLS for invitations
alter table invitations enable row level security;

drop policy if exists "Invitations are readable by the invited email or workspace members" on invitations;
create policy "Invitations are readable by the invited email or workspace members"
on invitations for select
using (
  lower(email) = lower(auth.email())
  or workspace_id = current_workspace()
);

drop policy if exists "Workspace super admins can manage invitations" on invitations;
create policy "Workspace super admins can manage invitations"
on invitations for all
using (
  workspace_id = current_workspace()
  and exists (
    select 1 from users
    where users.id = auth.uid()
    and users.role = 'super_admin'
  )
)
with check (
  workspace_id = current_workspace()
  and exists (
    select 1 from users
    where users.id = auth.uid()
    and users.role = 'super_admin'
  )
);

drop policy if exists "Invited users can accept their own invitation" on invitations;
create policy "Invited users can accept their own invitation"
on invitations for update
using (lower(email) = lower(auth.email()) and status = 'pending')
with check (lower(email) = lower(auth.email()) and status = 'accepted');

