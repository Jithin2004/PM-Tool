-- MIGRATION: Finance + Reporting Accuracy Hardening Patch

-- 1. Client Currency Inheritance
ALTER TABLE public.clients
ADD COLUMN IF NOT EXISTS default_currency text;

-- 2. Project Currency Inheritance
ALTER TABLE public.projects
ADD COLUMN IF NOT EXISTS billing_currency text;

-- 3. Invoices Multi-Currency Accounting Hardening
ALTER TABLE public.invoices
ADD COLUMN IF NOT EXISTS company_base_currency text,
ADD COLUMN IF NOT EXISTS base_amount numeric,
ADD COLUMN IF NOT EXISTS exchange_rate_locked boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS exchange_locked_at timestamptz,
ADD COLUMN IF NOT EXISTS exchange_override_reason text;

-- 4. Exchange Rate Audits Table
CREATE TABLE IF NOT EXISTS public.exchange_rate_audits (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    invoice_id uuid NOT NULL REFERENCES public.invoices(id) ON DELETE CASCADE,
    workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
    old_rate numeric,
    new_rate numeric NOT NULL,
    changed_by uuid NOT NULL REFERENCES auth.users(id),
    timestamp timestamptz DEFAULT now() NOT NULL,
    reason text NOT NULL
);

-- Index for fast lookup by invoice
CREATE INDEX IF NOT EXISTS idx_exchange_rate_audits_invoice_id ON public.exchange_rate_audits(invoice_id);

-- 5. Financial Report Snapshots Table
CREATE TABLE IF NOT EXISTS public.financial_report_snapshots (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
    report_type text NOT NULL,
    snapshot_data jsonb NOT NULL,
    created_at timestamptz DEFAULT now() NOT NULL,
    created_by uuid NOT NULL REFERENCES auth.users(id)
);

-- Index for fetching historical reports by workspace and type
CREATE INDEX IF NOT EXISTS idx_financial_report_snapshots_workspace_type ON public.financial_report_snapshots(workspace_id, report_type);

-- Apply RLS to new tables
ALTER TABLE public.exchange_rate_audits ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.financial_report_snapshots ENABLE ROW LEVEL SECURITY;

-- RLS Policies for exchange_rate_audits
CREATE POLICY "Users can view exchange rate audits for their workspace" 
ON public.exchange_rate_audits FOR SELECT 
USING (
  workspace_id IN (
    SELECT workspace_id FROM users WHERE id = auth.uid()
  )
);

CREATE POLICY "Users can insert exchange rate audits for their workspace" 
ON public.exchange_rate_audits FOR INSERT 
WITH CHECK (
  workspace_id IN (
    SELECT workspace_id FROM users WHERE id = auth.uid()
  )
);

-- RLS Policies for financial_report_snapshots
CREATE POLICY "Users can view financial report snapshots for their workspace" 
ON public.financial_report_snapshots FOR SELECT 
USING (
  workspace_id IN (
    SELECT workspace_id FROM users WHERE id = auth.uid()
  )
);

CREATE POLICY "Users can insert financial report snapshots for their workspace" 
ON public.financial_report_snapshots FOR INSERT 
WITH CHECK (
  workspace_id IN (
    SELECT workspace_id FROM users WHERE id = auth.uid()
  )
);
