-- SQL Migration: Invited User Bootstrap RLS Policy
-- Run this in your Supabase SQL Editor to apply the RLS fix.

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
