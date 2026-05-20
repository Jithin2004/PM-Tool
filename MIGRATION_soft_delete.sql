-- Soft delete: add deleted_at columns to all entity tables.
-- Run in Supabase SQL Editor.

alter table projects add column if not exists deleted_at timestamptz;
alter table tasks add column if not exists deleted_at timestamptz;
alter table calendar_events add column if not exists deleted_at timestamptz;
alter table sprints add column if not exists deleted_at timestamptz;
alter table meetings add column if not exists deleted_at timestamptz;
alter table teams add column if not exists deleted_at timestamptz;

-- RLS policies to exclude soft-deleted rows from default queries
drop policy if exists "Exclude soft-deleted projects" on projects;
create policy "Exclude soft-deleted projects" on projects for select using (deleted_at is null);

drop policy if exists "Exclude soft-deleted tasks" on tasks;
create policy "Exclude soft-deleted tasks" on tasks for select using (deleted_at is null);

drop policy if exists "Exclude soft-deleted calendar_events" on calendar_events;
create policy "Exclude soft-deleted calendar_events" on calendar_events for select using (deleted_at is null);

drop policy if exists "Exclude soft-deleted sprints" on sprints;
create policy "Exclude soft-deleted sprints" on sprints for select using (deleted_at is null);

drop policy if exists "Exclude soft-deleted meetings" on meetings;
create policy "Exclude soft-deleted meetings" on meetings for select using (deleted_at is null);

drop policy if exists "Exclude soft-deleted teams" on teams;
create policy "Exclude soft-deleted teams" on teams for select using (deleted_at is null);
