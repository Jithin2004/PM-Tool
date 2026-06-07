-- ==============================================================================
-- RESOLVE PM — SPRINT 9: ENTERPRISE SECURITY AUDIT FIX PACK
-- ==============================================================================
-- RUN THIS SCRIPT IN SUPABASE SQL EDITOR
-- Addresses all Critical Launch Blockers from External Security Audit
-- ==============================================================================

-- ##############################################################################
-- SECTION 1: RLS POLICIES FOR UNPROTECTED TABLES
-- ##############################################################################

-- ── wait_states ───────────────────────────────────────────────
-- Has workspace_id column

DROP POLICY IF EXISTS "Wait states visible to workspace" ON wait_states;
CREATE POLICY "Wait states visible to workspace"
  ON wait_states FOR SELECT
  USING (workspace_id = public.current_workspace());

DROP POLICY IF EXISTS "Wait states managed by PMs and Admins" ON wait_states;
CREATE POLICY "Wait states managed by PMs and Admins"
  ON wait_states FOR ALL
  USING (
    workspace_id = public.current_workspace() AND
    EXISTS (SELECT 1 FROM public.users me WHERE me.id = auth.uid() AND me.workspace_id = public.current_workspace() AND me.role IN ('super_admin', 'pm'))
  )
  WITH CHECK (
    workspace_id = public.current_workspace() AND
    EXISTS (SELECT 1 FROM public.users me WHERE me.id = auth.uid() AND me.workspace_id = public.current_workspace() AND me.role IN ('super_admin', 'pm'))
  );


-- ── project_signoffs ─────────────────────────────────────────
-- Has workspace_id column

DROP POLICY IF EXISTS "Signoffs visible to workspace" ON project_signoffs;
CREATE POLICY "Signoffs visible to workspace"
  ON project_signoffs FOR SELECT
  USING (workspace_id = public.current_workspace());

DROP POLICY IF EXISTS "Signoffs managed by PMs and Admins" ON project_signoffs;
CREATE POLICY "Signoffs managed by PMs and Admins"
  ON project_signoffs FOR ALL
  USING (
    workspace_id = public.current_workspace() AND
    EXISTS (SELECT 1 FROM public.users me WHERE me.id = auth.uid() AND me.workspace_id = public.current_workspace() AND me.role IN ('super_admin', 'pm'))
  )
  WITH CHECK (
    workspace_id = public.current_workspace() AND
    EXISTS (SELECT 1 FROM public.users me WHERE me.id = auth.uid() AND me.workspace_id = public.current_workspace() AND me.role IN ('super_admin', 'pm'))
  );


-- ── project_allocations ──────────────────────────────────────
-- Has workspace_id column

DROP POLICY IF EXISTS "Allocations visible to workspace" ON project_allocations;
CREATE POLICY "Allocations visible to workspace"
  ON project_allocations FOR SELECT
  USING (workspace_id = public.current_workspace());

DROP POLICY IF EXISTS "Allocations managed by PMs and Admins" ON project_allocations;
CREATE POLICY "Allocations managed by PMs and Admins"
  ON project_allocations FOR ALL
  USING (
    workspace_id = public.current_workspace() AND
    EXISTS (SELECT 1 FROM public.users me WHERE me.id = auth.uid() AND me.workspace_id = public.current_workspace() AND me.role IN ('super_admin', 'pm'))
  )
  WITH CHECK (
    workspace_id = public.current_workspace() AND
    EXISTS (SELECT 1 FROM public.users me WHERE me.id = auth.uid() AND me.workspace_id = public.current_workspace() AND me.role IN ('super_admin', 'pm'))
  );


-- ── allocation_periods ───────────────────────────────────────
-- Has workspace_id column

DROP POLICY IF EXISTS "Allocation periods visible to workspace" ON allocation_periods;
CREATE POLICY "Allocation periods visible to workspace"
  ON allocation_periods FOR SELECT
  USING (workspace_id = public.current_workspace());

DROP POLICY IF EXISTS "Allocation periods managed by PMs and Admins" ON allocation_periods;
CREATE POLICY "Allocation periods managed by PMs and Admins"
  ON allocation_periods FOR ALL
  USING (
    workspace_id = public.current_workspace() AND
    EXISTS (SELECT 1 FROM public.users me WHERE me.id = auth.uid() AND me.workspace_id = public.current_workspace() AND me.role IN ('super_admin', 'pm'))
  )
  WITH CHECK (
    workspace_id = public.current_workspace() AND
    EXISTS (SELECT 1 FROM public.users me WHERE me.id = auth.uid() AND me.workspace_id = public.current_workspace() AND me.role IN ('super_admin', 'pm'))
  );


-- ── billing_milestones ───────────────────────────────────────
-- Has workspace_id column

DROP POLICY IF EXISTS "Billing milestones visible to workspace admins" ON public.billing_milestones;
CREATE POLICY "Billing milestones visible to workspace admins"
  ON public.billing_milestones FOR SELECT
  USING (
    workspace_id = public.current_workspace() AND
    EXISTS (SELECT 1 FROM public.users me WHERE me.id = auth.uid() AND me.workspace_id = public.current_workspace() AND me.role IN ('super_admin', 'pm'))
  );

DROP POLICY IF EXISTS "Billing milestones managed by admins" ON public.billing_milestones;
CREATE POLICY "Billing milestones managed by admins"
  ON public.billing_milestones FOR ALL
  USING (
    workspace_id = public.current_workspace() AND
    EXISTS (SELECT 1 FROM public.users me WHERE me.id = auth.uid() AND me.workspace_id = public.current_workspace() AND me.role IN ('super_admin', 'pm'))
  )
  WITH CHECK (
    workspace_id = public.current_workspace() AND
    EXISTS (SELECT 1 FROM public.users me WHERE me.id = auth.uid() AND me.workspace_id = public.current_workspace() AND me.role IN ('super_admin', 'pm'))
  );


-- ── client_credits ───────────────────────────────────────────
-- Has workspace_id column

DROP POLICY IF EXISTS "Client credits visible to workspace admins" ON public.client_credits;
CREATE POLICY "Client credits visible to workspace admins"
  ON public.client_credits FOR SELECT
  USING (
    workspace_id = public.current_workspace() AND
    EXISTS (SELECT 1 FROM public.users me WHERE me.id = auth.uid() AND me.workspace_id = public.current_workspace() AND me.role IN ('super_admin', 'pm'))
  );

DROP POLICY IF EXISTS "Client credits managed by admins" ON public.client_credits;
CREATE POLICY "Client credits managed by admins"
  ON public.client_credits FOR ALL
  USING (
    workspace_id = public.current_workspace() AND
    EXISTS (SELECT 1 FROM public.users me WHERE me.id = auth.uid() AND me.workspace_id = public.current_workspace() AND me.role IN ('super_admin', 'pm'))
  )
  WITH CHECK (
    workspace_id = public.current_workspace() AND
    EXISTS (SELECT 1 FROM public.users me WHERE me.id = auth.uid() AND me.workspace_id = public.current_workspace() AND me.role IN ('super_admin', 'pm'))
  );


-- ── invoice_audit_logs ───────────────────────────────────────
-- Has workspace_id column. Read: admin only. Insert: workspace members (to log actions).

DROP POLICY IF EXISTS "Invoice audit logs visible to admins" ON public.invoice_audit_logs;
CREATE POLICY "Invoice audit logs visible to admins"
  ON public.invoice_audit_logs FOR SELECT
  USING (
    workspace_id = public.current_workspace() AND
    EXISTS (SELECT 1 FROM public.users me WHERE me.id = auth.uid() AND me.workspace_id = public.current_workspace() AND me.role IN ('super_admin', 'pm'))
  );

DROP POLICY IF EXISTS "Invoice audit logs insertable by workspace" ON public.invoice_audit_logs;
CREATE POLICY "Invoice audit logs insertable by workspace"
  ON public.invoice_audit_logs FOR INSERT
  WITH CHECK (workspace_id = public.current_workspace());

-- WORM: No update or delete on invoice audit logs
DROP POLICY IF EXISTS "Invoice audit logs are immutable" ON public.invoice_audit_logs;
-- (No UPDATE/DELETE policies = blocked by RLS default deny)


-- ── capability_change_logs ───────────────────────────────────
-- Has user_id but needs workspace join

DROP POLICY IF EXISTS "Capability logs visible to admins" ON capability_change_logs;
CREATE POLICY "Capability logs visible to admins"
  ON capability_change_logs FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.users me 
      WHERE me.id = auth.uid() 
        AND me.workspace_id = public.current_workspace() 
        AND me.role = 'super_admin'
    )
  );

DROP POLICY IF EXISTS "Capability logs insertable by admins" ON capability_change_logs;
CREATE POLICY "Capability logs insertable by admins"
  ON capability_change_logs FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.users me 
      WHERE me.id = auth.uid() 
        AND me.workspace_id = public.current_workspace() 
        AND me.role = 'super_admin'
    )
  );


-- ##############################################################################
-- SECTION 2: SERVER-SIDE WORK SESSION COMPLETION
-- ##############################################################################

-- Secure RPC to compute work session duration on the server.
-- Prevents client-side manipulation of hours.

CREATE OR REPLACE FUNCTION public.complete_work_session(p_session_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_session RECORD;
  v_total_pause_ms BIGINT := 0;
  v_duration_mins INTEGER;
  v_requires_review BOOLEAN := false;
  v_now TIMESTAMPTZ := now();
BEGIN
  -- 1. Fetch the session, verify ownership
  SELECT * INTO v_session FROM work_sessions
    WHERE id = p_session_id
      AND user_id = auth.uid()
      AND status IN ('active', 'paused');

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Session not found, not yours, or already completed.');
  END IF;

  -- 2. Close any open pauses
  UPDATE work_session_pauses
    SET pause_end = v_now
    WHERE session_id = p_session_id AND pause_end IS NULL;

  -- 3. Calculate total paused time
  SELECT COALESCE(SUM(
    EXTRACT(EPOCH FROM (COALESCE(pause_end, v_now) - pause_start)) * 1000
  ), 0)
  INTO v_total_pause_ms
  FROM work_session_pauses
  WHERE session_id = p_session_id;

  -- 4. Calculate net duration in minutes
  v_duration_mins := GREATEST(0, 
    FLOOR(
      (EXTRACT(EPOCH FROM (v_now - v_session.started_at)) * 1000 - v_total_pause_ms) / 60000
    )::INTEGER
  );

  -- 5. Apply 12-hour (720 min) cap
  IF v_duration_mins > 720 THEN
    v_duration_mins := 720;
    v_requires_review := true;
  END IF;

  -- 6. Update the session
  UPDATE work_sessions SET
    status = 'completed',
    ended_at = v_now,
    duration_minutes = v_duration_mins,
    requires_review = v_requires_review,
    updated_at = v_now
  WHERE id = p_session_id;

  -- 7. Log the action
  INSERT INTO activity_logs (workspace_id, actor_id, action, metadata)
  VALUES (
    v_session.workspace_id,
    auth.uid(),
    'work_session_completed',
    jsonb_build_object(
      'session_id', p_session_id,
      'task_id', v_session.task_id,
      'duration_minutes', v_duration_mins,
      'requires_review', v_requires_review,
      'computed_server_side', true
    )
  );

  RETURN jsonb_build_object(
    'success', true,
    'duration_minutes', v_duration_mins,
    'requires_review', v_requires_review
  );
END;
$$;

-- Add requires_review column if missing
ALTER TABLE work_sessions ADD COLUMN IF NOT EXISTS requires_review BOOLEAN DEFAULT false;

-- Restrict direct manipulation of critical work session fields by non-admins
CREATE OR REPLACE FUNCTION enforce_work_session_integrity()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = ''
AS $$
DECLARE
  v_role text;
BEGIN
  SELECT role INTO v_role FROM public.users WHERE id = auth.uid() LIMIT 1;

  -- Admins/PMs can modify anything
  IF v_role IN ('super_admin', 'pm') THEN
    RETURN NEW;
  END IF;

  -- Block direct duration_minutes manipulation
  IF NEW.duration_minutes IS DISTINCT FROM OLD.duration_minutes THEN
    RAISE EXCEPTION 'Unauthorized: Work session duration can only be computed by the server.';
  END IF;

  -- Block started_at backdating
  IF NEW.started_at IS DISTINCT FROM OLD.started_at THEN
    RAISE EXCEPTION 'Unauthorized: Work session start time cannot be modified.';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS check_work_session_integrity ON work_sessions;
CREATE TRIGGER check_work_session_integrity
  BEFORE UPDATE ON work_sessions
  FOR EACH ROW EXECUTE FUNCTION enforce_work_session_integrity();


-- ##############################################################################
-- SECTION 3: WORM PROTECTION FOR AUDIT TABLES
-- ##############################################################################

-- Replace broken RULEs with trigger-based WORM protection.
-- Triggers work correctly with referential integrity (unlike RULEs).

CREATE OR REPLACE FUNCTION prevent_audit_mutation()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  RAISE EXCEPTION 'Audit Integrity Violation: % records are immutable and cannot be modified or deleted.', TG_TABLE_NAME;
  RETURN NULL;
END;
$$;

-- system_audit_ledger: Block UPDATE and DELETE
DROP TRIGGER IF EXISTS worm_audit_ledger_no_update ON system_audit_ledger;
CREATE TRIGGER worm_audit_ledger_no_update
  BEFORE UPDATE ON system_audit_ledger
  FOR EACH ROW EXECUTE FUNCTION prevent_audit_mutation();

DROP TRIGGER IF EXISTS worm_audit_ledger_no_delete ON system_audit_ledger;
CREATE TRIGGER worm_audit_ledger_no_delete
  BEFORE DELETE ON system_audit_ledger
  FOR EACH ROW EXECUTE FUNCTION prevent_audit_mutation();

-- invoice_audit_logs: Block UPDATE and DELETE
DROP TRIGGER IF EXISTS worm_invoice_audit_no_update ON public.invoice_audit_logs;
CREATE TRIGGER worm_invoice_audit_no_update
  BEFORE UPDATE ON public.invoice_audit_logs
  FOR EACH ROW EXECUTE FUNCTION prevent_audit_mutation();

DROP TRIGGER IF EXISTS worm_invoice_audit_no_delete ON public.invoice_audit_logs;
CREATE TRIGGER worm_invoice_audit_no_delete
  BEFORE DELETE ON public.invoice_audit_logs
  FOR EACH ROW EXECUTE FUNCTION prevent_audit_mutation();


-- ##############################################################################
-- SECTION 4: INVOICE DELETION GOVERNANCE
-- ##############################################################################

-- Prevent deletion of any invoice that is not in 'draft' status.
-- This moves the enforcement from frontend JavaScript to the database.

CREATE OR REPLACE FUNCTION prevent_non_draft_invoice_deletion()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF OLD.status != 'draft' THEN
    RAISE EXCEPTION 'Finance Governance: Only draft invoices can be deleted. Cancel or void non-draft invoices instead. Current status: %', OLD.status;
  END IF;
  RETURN OLD;
END;
$$;

DROP TRIGGER IF EXISTS check_invoice_deletion_governance ON public.invoices;
CREATE TRIGGER check_invoice_deletion_governance
  BEFORE DELETE ON public.invoices
  FOR EACH ROW EXECUTE FUNCTION prevent_non_draft_invoice_deletion();

-- Prevent modification of paid/cancelled invoice amounts
CREATE OR REPLACE FUNCTION prevent_finalized_invoice_modification()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF OLD.status IN ('paid', 'cancelled', 'voided') THEN
    IF NEW.total IS DISTINCT FROM OLD.total 
       OR NEW.subtotal IS DISTINCT FROM OLD.subtotal
       OR NEW.tax_amount IS DISTINCT FROM OLD.tax_amount THEN
      RAISE EXCEPTION 'Finance Governance: Cannot modify amounts on a % invoice. Create a credit note instead.', OLD.status;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS check_invoice_modification_governance ON public.invoices;
CREATE TRIGGER check_invoice_modification_governance
  BEFORE UPDATE ON public.invoices
  FOR EACH ROW EXECUTE FUNCTION prevent_finalized_invoice_modification();


-- ##############################################################################
-- SECTION 5: ACTIVITY LOGS — MAKE TRULY APPEND-ONLY
-- ##############################################################################

-- activity_logs should be append-only (no updates, no deletes).
-- The old RULE approach broke CASCADE deletes. Triggers are safer.

DROP TRIGGER IF EXISTS worm_activity_logs_no_update ON activity_logs;
CREATE TRIGGER worm_activity_logs_no_update
  BEFORE UPDATE ON activity_logs
  FOR EACH ROW EXECUTE FUNCTION prevent_audit_mutation();

-- NOTE: We do NOT add a DELETE trigger on activity_logs because CASCADE from
-- workspace/project/task deletion needs to propagate. Only UPDATE is blocked.


-- ##############################################################################
-- END OF MIGRATION
-- ##############################################################################
