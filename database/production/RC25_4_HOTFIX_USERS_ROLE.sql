-- Resolve PM v1.3.0 Release Bugfix
-- Issue: "new row for relation 'users' violates check constraint 'users_role_check'"
-- Cause: The frontend relies on the 'pending-workspace-setup' role during onboarding, but the database constraint did not permit it.

-- 1. Drop the existing constraint
ALTER TABLE public.users DROP CONSTRAINT IF EXISTS users_role_check;

-- 2. Re-create the constraint with the missing frontend roles included
ALTER TABLE public.users ADD CONSTRAINT users_role_check 
CHECK (role IN (
  'super_admin', 
  'admin', 
  'project_manager', 
  'team_lead', 
  'developer', 
  'employee', 
  'hr', 
  'finance', 
  'client', 
  'pending-workspace-setup', 
  'uninvited'
));
