-- Add template and execution mode columns to workspaces table.
-- Run in Supabase SQL Editor.

alter table workspaces add column if not exists template_id text;
alter table workspaces add column if not exists execution_mode text not null default 'KANBAN' check (execution_mode in ('KANBAN', 'SCRUM', 'SDLC', 'CUSTOM'));
alter table workspaces add column if not exists default_lanes integer not null default 5;
alter table workspaces add column if not exists workflow_rules jsonb default '{}'::jsonb;
