-- SQL Migration: Case-Insensitive Invitation Read Access
-- Run this in your Supabase SQL Editor to apply this fix.

drop policy if exists "Invitations are readable by the invited email or workspace members" on invitations;
create policy "Invitations are readable by the invited email or workspace members"
on invitations for select
using (
  lower(email) = lower(auth.email())
  or workspace_id = current_workspace()
);
