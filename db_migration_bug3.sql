-- Bug #3: Missing seed_sandbox RPC for E2E dataset provisioning
-- This RPC is required for deterministic execution of the certification runner datasets.
-- It bypasses PostgREST schema cache limitations on RLS policies for bulk insertions.

CREATE OR REPLACE FUNCTION public.seed_sandbox(p_sandbox_id UUID, p_payload JSONB)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER 
SET search_path = public
SET statement_timeout = '10min'
AS $$
DECLARE
  v_user_id UUID;
  v_team JSONB;
  v_project JSONB;
  v_team_id UUID;
  v_project_id UUID;
  v_milestone_count INT;
  v_task_count INT;
  i INT;
  j INT;
BEGIN
  -- We assume the payload contains:
  -- { "teams": [...], "projects": [{ "name": "...", "status": "...", "milestoneCount": X, "taskCount": Y }, ...] }
  
  -- Idempotent cleanup for existing seeded records
  DELETE FROM tasks WHERE workspace_id = p_sandbox_id AND name LIKE '[SEED]%';
  DELETE FROM milestones WHERE workspace_id = p_sandbox_id AND title LIKE '[SEED]%';
  DELETE FROM projects WHERE workspace_id = p_sandbox_id AND name LIKE '[SEED]%';
  DELETE FROM teams WHERE workspace_id = p_sandbox_id AND name LIKE '[SEED]%';

  -- Get the superadmin user ID for the sandbox to satisfy foreign keys
  SELECT id INTO v_user_id FROM users WHERE workspace_id = p_sandbox_id AND role = 'super_admin' LIMIT 1;

  FOR v_team IN SELECT * FROM jsonb_array_elements(p_payload->'teams')
  LOOP
      INSERT INTO teams (workspace_id, name)
      VALUES (p_sandbox_id, v_team->>'name')
      RETURNING id INTO v_team_id;

      FOR v_project IN SELECT * FROM jsonb_array_elements(p_payload->'projects')
      LOOP
          INSERT INTO projects (workspace_id, team_id, name, status, created_by_id)
          VALUES (p_sandbox_id, v_team_id, v_project->>'name', v_project->>'status', v_user_id)
          RETURNING id INTO v_project_id;

          v_milestone_count := (v_project->>'milestoneCount')::INT;
          FOR i IN 1..v_milestone_count
          LOOP
              INSERT INTO milestones (workspace_id, project_id, title, status, target_date)
              VALUES (
                  p_sandbox_id, 
                  v_project_id, 
                  '[SEED] Milestone ' || i || ' — ' || (v_project->>'name'), 
                  'pending', 
                  (now() + (i * 7 || ' days')::interval)::timestamptz
              );
          END LOOP;

          v_task_count := (v_project->>'taskCount')::INT;
          FOR j IN 1..v_task_count
          LOOP
              INSERT INTO tasks (workspace_id, project_id, name, status, priority, assignee_id, estimated_hours)
              VALUES (
                  p_sandbox_id, 
                  v_project_id, 
                  '[SEED] Task ' || j || ' — ' || (v_project->>'name'), 
                  'assigned', 
                  'medium', 
                  v_user_id, 
                  4
              );
          END LOOP;
      END LOOP;
  END LOOP;
END;
$$;

-- Ensure PostgREST exposes this function to the authenticated role
GRANT EXECUTE ON FUNCTION public.seed_sandbox(UUID, JSONB) TO authenticated;
GRANT EXECUTE ON FUNCTION public.seed_sandbox(UUID, JSONB) TO anon;
GRANT EXECUTE ON FUNCTION public.seed_sandbox(UUID, JSONB) TO service_role;
