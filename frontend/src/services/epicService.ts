import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { activityLogService } from './activityLogService';
import { logServiceFailure } from '../utils/supabaseError';

export interface CreateEpicInput {
  workspace_id: string;
  project_id: string;
  name: string;
  description?: string;
  status?: string;
  priority?: string;
  synthetic?: boolean;
  runId?: string;
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
        description: input.description || '',
        status: input.status || 'backlog',
        priority: input.priority || 'medium',
      })
      .select('id')
      .maybeSingle();
    if (error) { logServiceFailure('createEpic', input, error); return null; }
    if (data) {
      await activityLogService.appendLog({
        workspace_id: input.workspace_id,
        action: 'epic_created',
        metadata: { epic_id: data.id, project_id: input.project_id, name: input.name, synthetic: input.synthetic, run_id: input.runId },
      });
      return data;
    }
  } catch (err) { logServiceFailure('createEpic', input, err); }
  return null;
}
