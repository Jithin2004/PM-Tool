-- Migration: Patch projects table with missing columns required by the frontend
-- Copy and run this script in your Supabase SQL Editor to resolve the 'client_deadline' column schema cache error.

ALTER TABLE projects DROP COLUMN IF EXISTS pert_best;
ALTER TABLE projects DROP COLUMN IF EXISTS pert_likely;
ALTER TABLE projects DROP COLUMN IF EXISTS pert_worst;

ALTER TABLE projects ADD COLUMN IF NOT EXISTS client_deadline TIMESTAMPTZ;
ALTER TABLE projects ADD COLUMN IF NOT EXISTS proposed_start_date TIMESTAMPTZ;
ALTER TABLE projects ADD COLUMN IF NOT EXISTS efficiency NUMERIC DEFAULT 1.0;
ALTER TABLE projects ADD COLUMN IF NOT EXISTS tags TEXT[] DEFAULT '{}';
ALTER TABLE projects ADD COLUMN IF NOT EXISTS audit_header JSONB DEFAULT '{}'::jsonb;
