import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { trackSupabaseOperation } from '../core/observability/telemetry';
import { activityLogService } from './activityLogService';
import { propagateAndPersist } from './timelineImpactEngine';
import { calendarEventService } from './calendarEventService';

export interface ExitImpactSummary {
  active_tasks: number;
  owned_projects: number;
  pending_approvals: number;
  owned_documents: number;
}

export interface ExitTransferMap {
  taskAssigneeId?: string;
  projectOwnerId?: string;
  approverId?: string;
}

export const fetchExitImpact = async (userId: string, workspaceId: string): Promise<ExitImpactSummary> => {
  if (!isSupabaseConfigured) {
    return { active_tasks: 0, owned_projects: 0, pending_approvals: 0, owned_documents: 0 };
  }

  const { data, error } = await trackSupabaseOperation('supabase_rpc_get_employee_exit_impact', () => 
    supabase.rpc('get_employee_exit_impact', { p_user_id: userId, p_workspace_id: workspaceId })
  );

  if (error) {
    console.error("Failed to fetch exit impact:", error);
    throw new Error("Could not analyze employee impact. Please try again.");
  }

  return data as ExitImpactSummary;
};

export const transferAndArchiveEmployee = async (
  userId: string, 
  workspaceId: string, 
  transferMap: ExitTransferMap, 
  performedBy: string
): Promise<void> => {
  if (!isSupabaseConfigured) return;

  // 1. Lock the user's session by moving them to 'offboarding' state temporarily
  await trackSupabaseOperation('supabase_from_users_offboard_start', () =>
    supabase.from('users')
      .update({ status: 'offboarding' })
      .eq('id', userId)
      .eq('workspace_id', workspaceId)
  );

  // 2. Transfer Tasks
  let transferredTaskIds: string[] = [];
  if (transferMap.taskAssigneeId) {
    // We fetch the task IDs first so we know what was transferred
    const { data: affectedTasks, error: fetchError } = await trackSupabaseOperation('supabase_from_tasks_transfer_select', () =>
      supabase.from('tasks')
        .select('id')
        .eq('assignee_id', userId)
        .eq('workspace_id', workspaceId)
        .not('status', 'in', '("completed","done","archived")')
    );
    if (fetchError) throw fetchError;
    if (affectedTasks) transferredTaskIds = affectedTasks.map(t => t.id);

    const { error } = await trackSupabaseOperation('supabase_from_tasks_transfer', () =>
      supabase.from('tasks')
        .update({ assignee_id: transferMap.taskAssigneeId, updated_at: new Date().toISOString() })
        .in('id', transferredTaskIds)
    );
    if (error) throw error;
  }

  // 3. Transfer Projects
  if (transferMap.projectOwnerId) {
    const { error } = await trackSupabaseOperation('supabase_from_projects_transfer', () =>
      supabase.from('projects')
        .update({ owner_id: transferMap.projectOwnerId, updated_at: new Date().toISOString() })
        .eq('owner_id', userId)
        .eq('workspace_id', workspaceId)
        .not('status', 'in', '("completed","done","archived")')
    );
    if (error) throw error;
  }

  // 4. Transfer Approvals
  if (transferMap.approverId) {
    const { error } = await trackSupabaseOperation('supabase_from_project_signoffs_transfer', () =>
      supabase.from('project_signoffs')
        .update({ user_id: transferMap.approverId, updated_at: new Date().toISOString() })
        .eq('user_id', userId)
        .eq('workspace_id', workspaceId)
        .eq('status', 'pending')
    );
    if (error) throw error;
  }

  // Note: We leave documents untouched as per the design decision to preserve original authorship.

  // 5. Finalize Archive
  await trackSupabaseOperation('supabase_from_users_offboard_complete', () =>
    supabase.from('users')
      .update({ status: 'archived', role: 'uninvited' })
      .eq('id', userId)
      .eq('workspace_id', workspaceId)
  );

  // 6. Audit Trail
  await activityLogService.appendLog({
    workspace_id: workspaceId,
    actor_id: performedBy,
    action_type: 'employee_archived',
    metadata: {
      archived_user_id: userId,
      tasks_transferred_to: transferMap.taskAssigneeId,
      projects_transferred_to: transferMap.projectOwnerId,
      approvals_transferred_to: transferMap.approverId
    }
  });

  // 7. Trigger ETA Recalculation and Capacity Refresh
  if (transferredTaskIds.length > 0) {
    try {
      // Gather context for timeline impact engine
      const [
        { data: allTasks },
        { data: allDeps },
        { data: workspace },
        events
      ] = await Promise.all([
        supabase.from('tasks').select('*').eq('workspace_id', workspaceId).is('deleted_at', null),
        supabase.from('task_dependencies').select('*').eq('workspace_id', workspaceId),
        supabase.from('workspaces').select('settings').eq('id', workspaceId).single(),
        calendarEventService.getEventsInRange(
          workspaceId,
          new Date().toISOString().split('T')[0],
          new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
        )
      ]);

      if (allTasks && workspace) {
        await propagateAndPersist({
          workspaceId,
          triggerEntityType: 'task',
          triggerAction: 'updated',
          actorId: performedBy,
          tasks: allTasks,
          dependencies: allDeps || [],
          calendarEvents: events || [],
          workspaceSettings: workspace.settings
        });
      }
    } catch (etaError) {
      console.error('Failed to trigger ETA recalculation after offboarding', etaError);
    }
  }
};
