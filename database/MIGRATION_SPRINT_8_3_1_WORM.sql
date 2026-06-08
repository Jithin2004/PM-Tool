-- Migration: Complete Audit WORM Immutability for activity_logs

-- 1. Create the unified trigger function returning the exact requested message
CREATE OR REPLACE FUNCTION enforce_audit_logs_immutable()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  RAISE EXCEPTION 'Audit logs are immutable';
  RETURN NULL;
END;
$$;

-- 2. Drop the old partial implementations
DROP TRIGGER IF EXISTS worm_activity_logs_no_update ON public.activity_logs;
DROP TRIGGER IF EXISTS worm_protect_activity_logs_update ON public.activity_logs;
DROP TRIGGER IF EXISTS worm_protect_activity_logs_delete ON public.activity_logs;

-- 3. Create the new unified trigger
DROP TRIGGER IF EXISTS worm_activity_logs_immutable ON public.activity_logs;
CREATE TRIGGER worm_activity_logs_immutable
  BEFORE UPDATE OR DELETE ON public.activity_logs
  FOR EACH ROW EXECUTE FUNCTION enforce_audit_logs_immutable();
