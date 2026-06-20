import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { activityLogService } from './activityLogService';
import { activityEventService } from './activityEventService';
import { logServiceFailure } from '../utils/supabaseError';
import { Epic } from '../core/types/cycle';

export interface CreateEpicInput {
  workspace_id: string;
  project_id: string;
  name: string;
  uid_code?: string;
  description?: string;
  status?: string;
  priority?: string;
  synthetic?: boolean;
  runId?: string;
  actorId?: string;
}

export async function getProjectEpics(projectId: string): Promise<Epic[]> {
  if (!isSupabaseConfigured) return [];
  const { data, error } = await supabase
    .from('epics')
    .select('*')
    .eq('project_id', projectId)
    .is('deleted_at', null)
    .order('created_at', { ascending: true });
    
  if (error) {
    console.error('[getProjectEpics] error', error);
    return [];
  }
  return data || [];
}

export async function createEpic(input: CreateEpicInput): Promise<{ id: string } | null> {
  if (!isSupabaseConfigured) return null;
  try {
    const { data, error } = await supabase
      .from('epics')
      .insert({
        workspace_id: input.workspace_id,
        project_id: input.project_id,
        name: input.name,
        uid_code: input.uid_code,
        description: input.description || '',
        status: input.status || 'backlog',
        priority: input.priority || 'medium',
      })
      .select('id')
      .maybeSingle();
      
    if (error) { logServiceFailure('createEpic', input, error); return null; }
    
    if (data) {
      // Legacy activity log
      await activityLogService.appendLog({
        workspace_id: input.workspace_id,
        action_type: 'epic_created',
        metadata: { epic_id: data.id, project_id: input.project_id, name: input.name, synthetic: input.synthetic, run_id: input.runId },
      });
      // V2 Activity Event
      await activityEventService.recordActivity({
        workspace_id: input.workspace_id,
        actor_id: input.actorId,
        entity_type: 'epic',
        entity_id: data.id,
        action_type: 'epic_created',
        after_value: { name: input.name, uid_code: input.uid_code }
      });
      return data;
    }
  } catch (err) { logServiceFailure('createEpic', input, err); }
  return null;
}

export async function deleteEpic(epicId: string, workspaceId: string, performedBy: string): Promise<boolean> {
  if (!isSupabaseConfigured) return false;
  try {
    const { error } = await supabase
      .from('epics')
      .update({ deleted_at: new Date().toISOString(), deleted_by: performedBy })
      .eq('id', epicId)
      .eq('workspace_id', workspaceId);
      
    if (error) { logServiceFailure('deleteEpic', { epicId }, error); return false; }
    
    await activityLogService.appendLog({
      workspace_id: workspaceId,
      action_type: 'epic_deleted',
      metadata: { epic_id: epicId, performed_by: performedBy },
    });
    return true;
  } catch (err) { logServiceFailure('deleteEpic', { epicId }, err); return false; }
}

export async function restoreEpic(epicId: string, workspaceId: string, performedBy: string): Promise<boolean> {
  if (!isSupabaseConfigured) return false;
  try {
    const { error } = await supabase
      .from('epics')
      .update({ deleted_at: null, deleted_by: null })
      .eq('id', epicId)
      .eq('workspace_id', workspaceId);
      
    if (error) { logServiceFailure('restoreEpic', { epicId }, error); return false; }
    
    await activityLogService.appendLog({
      workspace_id: workspaceId,
      action_type: 'epic_restored',
      metadata: { epic_id: epicId, performed_by: performedBy },
    });
    return true;
  } catch (err) { logServiceFailure('restoreEpic', { epicId }, err); return false; }
}
