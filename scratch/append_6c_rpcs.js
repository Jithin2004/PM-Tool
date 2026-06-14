const fs = require('fs');
const path = require('path');

const filePath = path.resolve('C:/Users/jithi/OneDrive/Desktop/Resolve PM/Resolve PM/database/production/RESOLVE_PM_V1_3_INSTALL.sql');
let content = fs.readFileSync(filePath, 'utf8');

const rpcScript = `
-- ==========================================
-- BATCH 6C: SCALE ARCHITECTURE RPCS
-- ==========================================

CREATE OR REPLACE FUNCTION public.search_workspace_users(
    p_workspace_id UUID,
    p_search_text TEXT,
    p_limit INT DEFAULT 20
)
RETURNS TABLE (
    id UUID,
    name TEXT,
    avatar TEXT,
    role TEXT
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        u.id, 
        (u.first_name || ' ' || u.last_name) AS name,
        u.avatar_url AS avatar, 
        u.role
    FROM public.users u
    WHERE u.workspace_id = p_workspace_id
      AND u.status = 'active'
      AND (
          u.first_name ILIKE '%' || p_search_text || '%' OR
          u.last_name ILIKE '%' || p_search_text || '%' OR
          u.email ILIKE '%' || p_search_text || '%'
      )
    ORDER BY u.first_name ASC, u.last_name ASC
    LIMIT p_limit;
END;
$$ LANGUAGE plpgsql SECURITY INVOKER SET search_path = '';

CREATE OR REPLACE FUNCTION public.get_my_daily_command(
    p_user_id UUID,
    p_workspace_id UUID,
    p_role TEXT
)
RETURNS JSON AS $$
DECLARE
    v_today_tasks INT := 0;
    v_blockers INT := 0;
    v_approvals INT := 0;
    v_mentions INT := 0;
    v_recent_changes INT := 0;
    v_waiting_on_me INT := 0;
BEGIN
    IF p_role IN ('developer', 'viewer') THEN
        SELECT COUNT(*) INTO v_today_tasks FROM public.tasks 
        WHERE workspace_id = p_workspace_id AND assignee_id = p_user_id 
          AND status NOT IN ('done', 'archived') AND deleted_at IS NULL;
          
        SELECT COUNT(*) INTO v_blockers FROM public.tasks
        WHERE workspace_id = p_workspace_id AND assignee_id = p_user_id 
          AND (status = 'blocked' OR (blockers IS NOT NULL AND blockers != '')) 
          AND deleted_at IS NULL;

        SELECT COUNT(*) INTO v_recent_changes FROM public.tasks
        WHERE workspace_id = p_workspace_id AND assignee_id = p_user_id
          AND updated_at >= NOW() - INTERVAL '1 day' AND deleted_at IS NULL;

        SELECT COUNT(*) INTO v_waiting_on_me FROM public.wait_states
        WHERE workspace_id = p_workspace_id AND owner_id = p_user_id
          AND status = 'active';

    ELSIF p_role = 'pm' THEN
        SELECT COUNT(*) INTO v_today_tasks FROM public.projects
        WHERE workspace_id = p_workspace_id AND owner_id = p_user_id AND status != 'archived' AND deleted_at IS NULL;
        
        SELECT COUNT(*) INTO v_blockers FROM public.projects
        WHERE workspace_id = p_workspace_id AND owner_id = p_user_id AND (risk = 'high' OR delay_drift_days > 0) AND deleted_at IS NULL;

        SELECT COUNT(*) INTO v_approvals FROM public.universal_approvals
        WHERE workspace_id = p_workspace_id AND status = 'pending';
        
    ELSE
        SELECT COUNT(*) INTO v_today_tasks FROM public.projects WHERE workspace_id = p_workspace_id AND status = 'active' AND deleted_at IS NULL;
        SELECT COUNT(*) INTO v_blockers FROM public.tasks WHERE workspace_id = p_workspace_id AND status = 'blocked' AND deleted_at IS NULL;
        SELECT COUNT(*) INTO v_approvals FROM public.invoices WHERE workspace_id = p_workspace_id AND status = 'draft';
    END IF;

    RETURN json_build_object(
        'today_tasks', v_today_tasks,
        'blockers', v_blockers,
        'approvals', v_approvals,
        'mentions', v_mentions,
        'recent_changes', v_recent_changes,
        'waiting_on_me', v_waiting_on_me
    );
END;
$$ LANGUAGE plpgsql SECURITY INVOKER SET search_path = '';
`;

if(!content.includes('search_workspace_users')) {
    fs.appendFileSync(filePath, rpcScript);
    console.log('Appended Batch 6C RPCs successfully.');
} else {
    console.log('Batch 6C RPCs already present.');
}
