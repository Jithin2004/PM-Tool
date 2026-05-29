import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { activityLogService } from './activityLogService';
import { logServiceFailure } from '../utils/supabaseError';

const EXECUTION_MODES = ['KANBAN', 'SCRUM', 'HYBRID', 'SDLC', 'CUSTOM'] as const;

export interface CreateProjectInput {
  workspace_id: string;
  name: string;
  description?: string;
  status?: string;
  execution_mode?: string;
  synthetic?: boolean;
  runId?: string;
}

export async function createProject(input: CreateProjectInput): Promise<{ id: string } | null> {
  if (!isSupabaseConfigured) return null;
  try {
    const { data, error } = await supabase
      .from('projects')
      .insert({
        workspace_id: input.workspace_id,
        name: input.name,
        description: input.description || '',
        status: input.status || 'active',
        execution_mode: input.execution_mode || EXECUTION_MODES[0],
      })
      .select('id')
      .maybeSingle();
    if (error) { logServiceFailure('createProject', input, error); return null; }
    if (data) {
      await activityLogService.appendLog({
        workspace_id: input.workspace_id,
        action: 'project_created',
        metadata: { project_id: data.id, name: input.name, synthetic: input.synthetic, run_id: input.runId },
      });
      return data;
    }
  } catch (err) { logServiceFailure('createProject', input, err); }
  return null;
}

export async function archiveProject(projectId: string, workspaceId: string, actorId: string): Promise<boolean> {
  if (!isSupabaseConfigured) return false;
  try {
    const now = new Date().toISOString();

    // 1. Archive the project itself
    await supabase.from('projects').update({ status: 'archived', deleted_at: now }).eq('id', projectId);

    // 2. Cascade to Tasks
    await supabase.from('tasks').update({ status: 'archived', deleted_at: now }).eq('project_id', projectId).is('deleted_at', null);

    // 3. Cascade to Wait States (Targeting Project)
    await supabase.from('wait_states').update({ status: 'archived', deleted_at: now }).eq('target_type', 'project').eq('target_id', projectId).is('deleted_at', null);

    // 4. Cascade to Signoffs
    await supabase.from('project_signoffs').update({ status: 'archived', deleted_at: now }).eq('project_id', projectId).is('deleted_at', null);

    // 5. Cascade to Allocation Periods (Phase 2B)
    await supabase.from('allocation_periods').update({ deleted_at: now }).eq('project_id', projectId).is('deleted_at', null);

    // Audit the action
    await activityLogService.appendLog({
      workspace_id: workspaceId,
      actor_id: actorId,
      action: 'project_archived',
      metadata: { project_id: projectId, cascade_triggered: true },
    });

    return true;
  } catch (err) { 
    logServiceFailure('archiveProject', { projectId }, err); 
    return false;
  }
}
