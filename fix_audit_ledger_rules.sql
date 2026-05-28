-- Fix for XX000 referential integrity error on system_audit_ledger

-- 1. Drop the problematic rules that rewrite queries and break foreign key constraints
DROP RULE IF EXISTS system_audit_ledger_no_update ON system_audit_ledger;
DROP RULE IF EXISTS system_audit_ledger_no_delete ON system_audit_ledger;

-- Note: Row Level Security (RLS) is already enabled on this table.
-- Since there are no UPDATE or DELETE policies defined for system_audit_ledger, 
-- normal authenticated users and admins already cannot modify or delete audit logs.
-- By dropping these rules, we allow PostgreSQL's internal referential integrity 
-- checks (like ON DELETE SET NULL and ON DELETE CASCADE) to work properly 
-- when deleting users, tasks, projects, or workspaces.

-- (Optional) If you want to completely decouple the audit log from the users table 
-- so that the actor_id is preserved even after a user is deleted (instead of becoming NULL):
-- ALTER TABLE system_audit_ledger DROP CONSTRAINT IF EXISTS system_audit_ledger_actor_id_fkey;
