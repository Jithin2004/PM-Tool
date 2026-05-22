-- Fix projects_status_check constraint to match all status values used by the frontend
-- Run in Supabase SQL Editor

alter table projects drop constraint if exists projects_status_check;
alter table projects add constraint projects_status_check
  check (status in ('planning', 'active', 'review', 'done', 'archived', 'deployed', 'in-progress'));
