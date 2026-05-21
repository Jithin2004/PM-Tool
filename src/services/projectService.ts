import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { activityLogService } from './activityLogService';

const EXECUTION_MODES = ['KANBAN', 'SCRUM', 'SDLC', 'HYBRID'] as const;

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
    if (error) return null;
    if (data) {
      await activityLogService.appendLog({
        workspace_id: input.workspace_id,
        action: 'project_created',
        metadata: { project_id: data.id, name: input.name, synthetic: input.synthetic, run_id: input.runId },
      });
      return data;
    }
  } catch { /* ignore */ }
  return null;
}
