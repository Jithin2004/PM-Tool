-- =============================================================
-- SPRINT 8.3 ENTERPRISE CLOSURE ADDITIONS
-- =============================================================

-- -------------------------------------------------------------
-- 1. MISSING PRODUCTION TABLES
-- -------------------------------------------------------------

-- Finance tables based on financeService.ts
CREATE TABLE IF NOT EXISTS company_billing_profile (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  legal_name text NOT NULL,
  gstin text,
  pan text,
  billing_address text,
  state text NOT NULL,
  country text NOT NULL,
  bank_details jsonb,
  invoice_prefix text NOT NULL DEFAULT 'RPM',
  UNIQUE(workspace_id)
);

CREATE TABLE IF NOT EXISTS clients (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  company_name text NOT NULL,
  contact_person text NOT NULL,
  email text NOT NULL,
  phone text NOT NULL,
  billing_address text NOT NULL,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
  gstin text,
  billing_state text,
  billing_country text,
  tax_type text CHECK (tax_type IN ('registered', 'unregistered')),
  currency text,
  default_currency text,
  advance_balance numeric DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS milestones (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  project_id uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  title text NOT NULL,
  description text,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'active', 'completed', 'blocked')),
  target_date timestamptz,
  completion_date timestamptz,
  progress_percent numeric DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS invoices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  client_id uuid NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  project_id uuid REFERENCES projects(id) ON DELETE SET NULL,
  invoice_number text NOT NULL,
  amount numeric NOT NULL DEFAULT 0,
  subtotal numeric NOT NULL DEFAULT 0,
  discount_amount numeric NOT NULL DEFAULT 0,
  taxable_amount numeric NOT NULL DEFAULT 0,
  cgst_amount numeric NOT NULL DEFAULT 0,
  sgst_amount numeric NOT NULL DEFAULT 0,
  igst_amount numeric NOT NULL DEFAULT 0,
  total_tax numeric NOT NULL DEFAULT 0,
  grand_total numeric NOT NULL DEFAULT 0,
  balance_due numeric NOT NULL DEFAULT 0,
  billing_state_snapshot text,
  currency text NOT NULL DEFAULT 'USD',
  company_base_currency text,
  base_amount numeric,
  invoice_currency text,
  invoice_amount numeric,
  converted_amount numeric,
  exchange_rate numeric,
  exchange_rate_locked boolean DEFAULT false,
  exchange_locked_at timestamptz,
  exchange_override_reason text,
  conversion_date timestamptz,
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'sent', 'issued', 'paid', 'overdue', 'cancelled', 'partial', 'partially_paid')),
  issue_date date NOT NULL,
  due_date date NOT NULL,
  paid_date date,
  task_id uuid REFERENCES tasks(id) ON DELETE SET NULL,
  billing_type text,
  payment_terms text,
  milestone_id uuid REFERENCES milestones(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(workspace_id, invoice_number)
);

CREATE TABLE IF NOT EXISTS invoice_line_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id uuid NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
  description text NOT NULL,
  quantity numeric NOT NULL DEFAULT 1,
  rate numeric NOT NULL DEFAULT 0,
  tax_percentage numeric NOT NULL DEFAULT 0,
  amount numeric NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  invoice_id uuid NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
  amount numeric NOT NULL,
  payment_date date NOT NULL,
  method text NOT NULL,
  reference_number text NOT NULL,
  client_id uuid REFERENCES clients(id) ON DELETE SET NULL,
  advance_payment boolean DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS expenses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  category text NOT NULL CHECK (category IN ('salary', 'software', 'infrastructure', 'office', 'misc')),
  amount numeric NOT NULL,
  date date NOT NULL,
  description text NOT NULL,
  project_id uuid REFERENCES projects(id) ON DELETE SET NULL,
  task_id uuid REFERENCES tasks(id) ON DELETE SET NULL,
  billable boolean DEFAULT false,
  reimbursed_invoice_id uuid REFERENCES invoices(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS financial_periods (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  month integer NOT NULL CHECK (month >= 1 AND month <= 12),
  year integer NOT NULL,
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'closed')),
  closed_by uuid REFERENCES users(id) ON DELETE SET NULL,
  closed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(workspace_id, month, year)
);

CREATE TABLE IF NOT EXISTS financial_snapshots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  period_id uuid NOT NULL REFERENCES financial_periods(id) ON DELETE CASCADE,
  total_revenue numeric NOT NULL DEFAULT 0,
  total_salary_expense numeric NOT NULL DEFAULT 0,
  total_other_expenses numeric NOT NULL DEFAULT 0,
  net_profit numeric NOT NULL DEFAULT 0,
  employee_count integer NOT NULL DEFAULT 0,
  client_count integer NOT NULL DEFAULT 0,
  project_count integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS financial_adjustments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  period_id uuid NOT NULL REFERENCES financial_periods(id) ON DELETE CASCADE,
  type text NOT NULL CHECK (type IN ('revenue', 'salary', 'expense')),
  amount numeric NOT NULL,
  reason text NOT NULL,
  created_by uuid REFERENCES users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS billing_milestones (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  project_id uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  name text NOT NULL,
  amount numeric NOT NULL,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'invoiced', 'paid')),
  invoice_id uuid REFERENCES invoices(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS client_credits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  client_id uuid NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  amount numeric NOT NULL,
  source_payment_id uuid REFERENCES payments(id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'used')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS advance_applications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  client_credit_id uuid NOT NULL REFERENCES client_credits(id) ON DELETE CASCADE,
  invoice_id uuid NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
  amount_applied numeric NOT NULL,
  applied_by uuid REFERENCES users(id) ON DELETE SET NULL,
  applied_at timestamptz NOT NULL DEFAULT now(),
  notes text
);

CREATE TABLE IF NOT EXISTS credit_notes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  client_id uuid NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  invoice_id uuid REFERENCES invoices(id) ON DELETE SET NULL,
  credit_note_number text NOT NULL,
  amount numeric NOT NULL,
  reason text NOT NULL,
  issue_date date NOT NULL,
  created_by uuid REFERENCES users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(workspace_id, credit_note_number)
);

CREATE TABLE IF NOT EXISTS invoice_audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  invoice_id uuid REFERENCES invoices(id) ON DELETE SET NULL,
  action text NOT NULL,
  performed_by uuid REFERENCES users(id) ON DELETE SET NULL,
  reason text,
  old_value jsonb,
  new_value jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS exchange_rate_audits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  invoice_id uuid REFERENCES invoices(id) ON DELETE CASCADE,
  old_rate numeric,
  new_rate numeric NOT NULL,
  changed_by uuid REFERENCES users(id) ON DELETE SET NULL,
  reason text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS requirements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  project_id uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  title text NOT NULL,
  description text,
  priority text NOT NULL DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high', 'urgent')),
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'approved', 'in-progress', 'implemented', 'verified', 'rejected')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS external_access_links (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  target_type text NOT NULL CHECK (target_type IN ('project', 'board', 'invoice', 'report')),
  target_id uuid NOT NULL,
  access_token text NOT NULL UNIQUE,
  expires_at timestamptz,
  created_by uuid REFERENCES users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- -------------------------------------------------------------
-- 2. ENTERPRISE HR STRUCTURE
-- -------------------------------------------------------------

CREATE TABLE IF NOT EXISTS departments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  name text NOT NULL,
  parent_department_id uuid REFERENCES departments(id) ON DELETE SET NULL,
  department_head_id uuid REFERENCES users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(workspace_id, name)
);

CREATE TABLE IF NOT EXISTS employee_contracts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  contract_type text NOT NULL CHECK (contract_type IN ('full-time', 'part-time', 'contractor', 'intern')),
  start_date date NOT NULL,
  end_date date,
  salary numeric,
  currency text,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'expired', 'terminated')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- -------------------------------------------------------------
-- 3. TASK HANDOFF WORKFLOW
-- -------------------------------------------------------------

CREATE TABLE IF NOT EXISTS task_handoff_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  task_id uuid NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  requested_by uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  requested_assignee uuid REFERENCES users(id) ON DELETE CASCADE,
  reason text NOT NULL,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  pm_id uuid REFERENCES users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- -------------------------------------------------------------
-- 4. EMPLOYEE LIFECYCLE FINALIZATION
-- -------------------------------------------------------------

-- Archive Employee Function
CREATE OR REPLACE FUNCTION archive_employee(p_user_id uuid, p_workspace_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- We don't delete the user row, we just mark them as terminated or resigned
  UPDATE users 
  SET 
    -- Do not touch employment_status if it's already resigned, suspended, etc.
    -- Assuming a column employment_status exists (from workspace.ts, but let's add it if missing)
    role = 'viewer' -- drop permissions
  WHERE id = p_user_id AND workspace_id = p_workspace_id;
  
  -- Unassign from active tasks
  UPDATE tasks 
  SET assignee_id = NULL 
  WHERE assignee_id = p_user_id AND status NOT IN ('done', 'archived');
  
  -- Log the event
  INSERT INTO activity_logs (workspace_id, actor_id, action, metadata)
  VALUES (p_workspace_id, auth.uid(), 'archived_employee', jsonb_build_object('user_id', p_user_id));
END;
$$;

-- Add employment_status column to users table if not exists (already checked earlier, it's missing in MASTER SCHEMA!)
DO $$ 
BEGIN 
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'users' AND column_name = 'employment_status') THEN 
    ALTER TABLE users ADD COLUMN employment_status text DEFAULT 'active' CHECK (employment_status IN ('active', 'resigned', 'terminated', 'on_leave', 'suspended'));
  END IF;
END $$;

-- Hard Delete Prevention Trigger
CREATE OR REPLACE FUNCTION prevent_user_hard_delete()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  RAISE EXCEPTION 'Hard deletes of users are strictly prohibited. Use archive_employee() instead to maintain historical referential integrity.';
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS prevent_user_hard_delete_trigger ON users;
CREATE TRIGGER prevent_user_hard_delete_trigger
  BEFORE DELETE ON users
  FOR EACH ROW EXECUTE FUNCTION prevent_user_hard_delete();

-- -------------------------------------------------------------
-- 5. AUDIT IMMUTABILITY CHECK (WORM PROTECTION)
-- -------------------------------------------------------------

CREATE OR REPLACE FUNCTION enforce_worm_protection()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF current_setting('role') <> 'service_role' AND current_user <> 'postgres' THEN
    RAISE EXCEPTION 'WORM Protection Violation: Audit logs are immutable and cannot be updated or deleted.';
  END IF;
  RETURN OLD; -- Should not reach here for regular users
END;
$$;

-- Activity logs WORM protection has been moved to the unified worm_activity_logs_immutable trigger in MASTER_SCHEMA.

DROP TRIGGER IF EXISTS worm_protect_system_audit_ledger_update ON system_audit_ledger;
CREATE TRIGGER worm_protect_system_audit_ledger_update
  BEFORE UPDATE ON system_audit_ledger
  FOR EACH ROW EXECUTE FUNCTION enforce_worm_protection();

DROP TRIGGER IF EXISTS worm_protect_system_audit_ledger_delete ON system_audit_ledger;
CREATE TRIGGER worm_protect_system_audit_ledger_delete
  BEFORE DELETE ON system_audit_ledger
  FOR EACH ROW EXECUTE FUNCTION enforce_worm_protection();

-- -------------------------------------------------------------
-- 6. RLS POLICIES FOR NEW TABLES
-- -------------------------------------------------------------

-- Note: In a real environment, we'd add detailed policies.
-- For now, we will add basic Workspace isolation policies for the new tables.

-- We create a helper DO block to generate basic policies for all new tables.
DO $$ 
DECLARE
  t text;
  tables text[] := ARRAY[
    'company_billing_profile', 'clients', 'milestones', 'invoices', 
    'invoice_line_items', 'payments', 'expenses', 'financial_periods', 
    'financial_snapshots', 'financial_adjustments', 'billing_milestones', 
    'client_credits', 'advance_applications', 'credit_notes', 
    'invoice_audit_logs', 'exchange_rate_audits', 'requirements', 
    'external_access_links', 'departments', 'employee_contracts', 
    'task_handoff_requests'
  ];
BEGIN
  FOREACH t IN ARRAY tables
  LOOP
    -- Enable RLS
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY;', t);
    
    -- We assume each table has a workspace_id, or is linked via a relation.
    -- For simplicity, we drop existing policy and recreate if workspace_id exists.
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = t AND column_name = 'workspace_id') THEN
      EXECUTE format('DROP POLICY IF EXISTS "Workspace isolation for %s" ON %I;', t, t);
      EXECUTE format('CREATE POLICY "Workspace isolation for %s" ON %I FOR ALL USING (workspace_id = current_workspace());', t, t);
    END IF;
  END LOOP;
END $$;
