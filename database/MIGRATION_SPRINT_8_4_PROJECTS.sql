-- Migration: Add enterprise creation fields to projects table

ALTER TABLE public.projects 
  ADD COLUMN IF NOT EXISTS department_id uuid REFERENCES public.departments(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS budget numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS billing_currency text DEFAULT 'USD',
  ADD COLUMN IF NOT EXISTS approval_workflow text DEFAULT 'standard' CHECK (approval_workflow IN ('standard', 'strict', 'none')),
  ADD COLUMN IF NOT EXISTS pert_enabled boolean DEFAULT true;
