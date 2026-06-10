import { supabase } from '../../lib/supabase';

export interface TestDataIssue {
  id: string;
  severity: 'info' | 'warning' | 'error' | 'critical';
  entityType: 'workspace' | 'user' | 'project' | 'task' | 'email' | 'other';
  entityName: string;
  reason: string;
  recommendedAction: string;
  metadata?: any;
}

export class TestDataGuardian {
  static async scan(): Promise<TestDataIssue[]> {
    const issues: TestDataIssue[] = [];

    try {
      // 1. Scan Workspaces
      const { data: workspaces, error: wsError } = await supabase
        .from('workspaces')
        .select('*');

      if (!wsError && workspaces) {
        for (const ws of workspaces) {
          const wsMetadata = ws.metadata || {};
          const isDemo = ws.name?.toLowerCase().includes('demo') || ws.is_demo;
          const isSimulation = ws.name?.toLowerCase().includes('simulation') || 
                               wsMetadata.environment === 'simulation' || 
                               wsMetadata.safe_to_purge === true ||
                               ws.status === 'sandbox';

          if (isDemo || isSimulation) {
            issues.push({
              id: ws.id,
              severity: isSimulation ? 'warning' : 'info',
              entityType: 'workspace',
              entityName: ws.name || 'Unnamed Workspace',
              reason: isSimulation ? 'Created from Sprint 19 simulation.' : 'Demo workspace detected.',
              recommendedAction: isSimulation ? 'Archive permanently' : 'Convert to sandbox',
              metadata: { status: ws.status, metadata: wsMetadata }
            });
          }

          // Check for zero activity: no tasks and no activity in last 30 days
          const { count: taskCount, error: taskCountError } = await supabase
            .from('tasks')
            .select('*', { count: 'exact', head: true })
            .eq('workspace_id', ws.id);

          const { data: recentLogs } = await supabase
            .from('activity_logs')
            .select('created_at')
            .eq('workspace_id', ws.id)
            .order('created_at', { ascending: false })
            .limit(1);

          const lastActivity = recentLogs && recentLogs[0] ? new Date(recentLogs[0].created_at) : new Date(ws.created_at);
          const daysSinceActivity = (Date.now() - lastActivity.getTime()) / (1000 * 3600 * 24);

          if ((taskCount === 0 || taskCount === null) && daysSinceActivity > 14) {
            issues.push({
              id: ws.id,
              severity: 'warning',
              entityType: 'workspace',
              entityName: ws.name || 'Unnamed Workspace',
              reason: `Workspace has 0 tasks and no activity for ${Math.round(daysSinceActivity)} days.`,
              recommendedAction: 'Archive workspace',
              metadata: { lastActivity }
            });
          }
        }
      }

      // 2. Scan Users (emails check)
      const { data: users, error: userError } = await supabase
        .from('users')
        .select('*');

      if (!userError && users) {
        for (const u of users) {
          const email = (u.email || '').toLowerCase();
          const isFake = email.includes('test@') || 
                         email.includes('demo@') || 
                         email.includes('example.com') || 
                         email.includes('resolveinternal.com');

          if (isFake) {
            issues.push({
              id: u.id,
              severity: 'warning',
              entityType: 'email',
              entityName: u.full_name || u.email || 'Unknown User',
              reason: `Fake/test email pattern detected: ${u.email}`,
              recommendedAction: 'Archive permanently',
              metadata: { email: u.email }
            });
          }
        }
      }

      // 3. Scan Orphan Projects
      const { data: projects, error: projError } = await supabase
        .from('projects')
        .select('id, name, workspace_id, team_id, owner_id');

      if (!projError && projects) {
        // Build set of workspace IDs for fast lookup
        const wsIds = new Set((workspaces || []).map(w => w.id));
        for (const p of projects) {
          const isOrphan = p.workspace_id && !wsIds.has(p.workspace_id);
          
          if (isOrphan) {
            issues.push({
              id: p.id,
              severity: 'error',
              entityType: 'project',
              entityName: p.name || 'Unnamed Project',
              reason: 'Orphan project pointing to a deleted or non-existent workspace.',
              recommendedAction: 'Archive permanently',
              metadata: { workspace_id: p.workspace_id }
            });
          } else {
            // Check if project is abandoned (has no tasks and no team)
            const { count: taskCount } = await supabase
              .from('tasks')
              .select('*', { count: 'exact', head: true })
              .eq('project_id', p.id);

            if (!p.team_id && (taskCount === 0 || taskCount === null)) {
              issues.push({
                id: p.id,
                severity: 'info',
                entityType: 'project',
                entityName: p.name || 'Unnamed Project',
                reason: 'Abandoned project with no associated team and zero tasks.',
                recommendedAction: 'Archive permanently',
                metadata: {}
              });
            }
          }
        }
      }

    } catch (err) {
      console.error('TestDataGuardian scan failure:', err);
    }

    return issues;
  }
}
