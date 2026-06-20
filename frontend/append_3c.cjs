const fs = require('fs');
const sqlFile = 'c:\\Users\\jithi\\OneDrive\\Desktop\\Resolve PM\\Resolve PM\\database\\production\\RESOLVE_PM_V1_3_INSTALL.sql';
const toAppend = `

-- ==============================================================================
-- 29. PRODUCTION ENGINE V2 - PHASE 3C FINANCE & ACCOUNTING ENGINE
-- ==============================================================================

CREATE TABLE IF NOT EXISTS public.finance_accounts (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
    name text NOT NULL,
    type text NOT NULL,
    currency text NOT NULL DEFAULT 'USD',
    opening_balance numeric NOT NULL DEFAULT 0,
    created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.finance_categories (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
    type text NOT NULL CHECK (type IN ('income', 'expense')),
    name text NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now(),
    UNIQUE(workspace_id, type, name)
);

CREATE TABLE IF NOT EXISTS public.finance_settings (
    workspace_id uuid PRIMARY KEY REFERENCES public.workspaces(id) ON DELETE CASCADE,
    settings jsonb NOT NULL DEFAULT '{"currency":"USD", "expense_approval_threshold":50000, "low_runway_months":3, "payroll_day":1}'::jsonb,
    updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.ledger_transactions (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
    account_id uuid REFERENCES public.finance_accounts(id) ON DELETE RESTRICT,
    transaction_type text NOT NULL CHECK (transaction_type IN ('income', 'expense', 'adjustment', 'transfer')),
    status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'posted', 'void')),
    amount numeric NOT NULL,
    currency text NOT NULL,
    category_id uuid REFERENCES public.finance_categories(id) ON DELETE SET NULL,
    linked_entity_type text,
    linked_entity_id uuid,
    transaction_date timestamptz NOT NULL DEFAULT now(),
    metadata jsonb DEFAULT '{}'::jsonb,
    created_by uuid REFERENCES public.users(id) ON DELETE SET NULL,
    created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.finance_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.finance_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.finance_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ledger_transactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Workspace members view finance accounts" ON public.finance_accounts FOR SELECT
  USING (workspace_id IN (SELECT id FROM public.workspaces WHERE id = finance_accounts.workspace_id AND public.is_active_workspace_member()));

CREATE POLICY "Workspace members view finance categories" ON public.finance_categories FOR SELECT
  USING (workspace_id IN (SELECT id FROM public.workspaces WHERE id = finance_categories.workspace_id AND public.is_active_workspace_member()));

CREATE POLICY "Workspace members view finance settings" ON public.finance_settings FOR SELECT
  USING (workspace_id IN (SELECT id FROM public.workspaces WHERE id = finance_settings.workspace_id AND public.is_active_workspace_member()));

CREATE POLICY "Workspace members view ledger transactions" ON public.ledger_transactions FOR SELECT
  USING (workspace_id IN (SELECT id FROM public.workspaces WHERE id = ledger_transactions.workspace_id AND public.is_active_workspace_member()));

`;
fs.appendFileSync(sqlFile, toAppend);
