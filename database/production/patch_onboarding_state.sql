-- ==========================================
-- PATCH: Grant permissions for workspace_onboarding_state
-- ==========================================
GRANT SELECT, INSERT, UPDATE, DELETE ON public.workspace_onboarding_state TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.workspace_onboarding_state TO service_role;

-- Reload schema cache to resolve PostgREST 404s
NOTIFY pgrst, 'reload schema';
