-- SQL Migration: Allow Invited Users to Accept Their Own Invitations
-- Run this in your Supabase SQL Editor to apply this fix.

drop policy if exists "Invited users can accept their own invitation" on invitations;
create policy "Invited users can accept their own invitation"
on invitations for update
using (email = auth.email() and status = 'pending')
with check (email = auth.email() and status = 'accepted');
