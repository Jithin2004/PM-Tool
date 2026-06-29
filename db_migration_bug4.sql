-- Bug #4: Missing current_workspace() function
-- This function is required for Row Level Security (RLS) on projects and other workspace-bound entities.

CREATE OR REPLACE FUNCTION public.current_workspace()
RETURNS uuid
LANGUAGE plpgsql
STABLE
SECURITY DEFINER SET search_path = ''
AS $$
BEGIN
  RETURN (SELECT workspace_id FROM public.users WHERE id = auth.uid() LIMIT 1);
END;
$$;

-- Ensure PostgREST exposes this function to the correct roles
GRANT EXECUTE ON FUNCTION public.current_workspace() TO authenticated;
GRANT EXECUTE ON FUNCTION public.current_workspace() TO anon;
GRANT EXECUTE ON FUNCTION public.current_workspace() TO service_role;
