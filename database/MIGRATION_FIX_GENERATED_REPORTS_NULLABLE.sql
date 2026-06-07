-- ==============================================================================
-- RESOLVE PM — DATABASE MIGRATION: FIX GENERATED REPORTS NULLABLE CONSTRAINT
-- ==============================================================================
-- Resolves user deletion failures (violating NOT NULL constraint on generated_by).
-- Drops the accidental NOT NULL constraint on public.generated_reports.generated_by 
-- to allow ON DELETE SET NULL to function correctly when a user is deleted.
-- ==============================================================================

-- 1. Alter the generated_by column to drop the NOT NULL constraint
ALTER TABLE public.generated_reports 
ALTER COLUMN generated_by DROP NOT NULL;

-- 2. Verify check constraints and foreign keys if necessary
-- The foreign key is already configured to ON DELETE SET NULL:
-- FOREIGN KEY (generated_by) REFERENCES public.users(id) ON DELETE SET NULL
