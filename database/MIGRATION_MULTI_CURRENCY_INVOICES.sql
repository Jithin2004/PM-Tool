-- Multi-Currency Invoices Extension
ALTER TABLE public.invoices
ADD COLUMN IF NOT EXISTS invoice_currency text NOT NULL DEFAULT 'USD',
ADD COLUMN IF NOT EXISTS converted_amount numeric,
ADD COLUMN IF NOT EXISTS exchange_rate numeric,
ADD COLUMN IF NOT EXISTS conversion_date timestamptz;

-- Audit logging for exchange rate changes if needed later can be added, but for now we store the state on the invoice.

