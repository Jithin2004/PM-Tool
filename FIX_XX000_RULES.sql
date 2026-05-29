-- Run this in your Supabase SQL Editor to fix ERROR: XX000
-- This removes the WORM (Write Once Read Many) rules that were breaking referential integrity cascades.

DROP RULE IF EXISTS activity_logs_no_update ON activity_logs;
DROP RULE IF EXISTS activity_logs_no_delete ON activity_logs;
DROP RULE IF EXISTS system_audit_ledger_no_update ON system_audit_ledger;
DROP RULE IF EXISTS system_audit_ledger_no_delete ON system_audit_ledger;

-- Note: The rules have also been removed from the RESOLVE_PM_PRODUCTION_MASTER_SCHEMA.sql 
-- so they won't be recreated if you rebuild the database.
