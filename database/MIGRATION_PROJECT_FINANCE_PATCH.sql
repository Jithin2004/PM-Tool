-- Run this in Supabase SQL Editor to fix the 400 error on payments table
BEGIN;

ALTER TABLE public.payments
ADD COLUMN IF NOT EXISTS workspace_id uuid REFERENCES public.workspaces(id) ON DELETE CASCADE;

-- Also fix invoice_id to be nullable if it isn't
ALTER TABLE public.payments ALTER COLUMN invoice_id DROP NOT NULL;

COMMIT;
