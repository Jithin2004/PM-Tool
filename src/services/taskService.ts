import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { activityLogService } from './activityLogService';

export interface CreateTaskInput {
  workspace_id: string;
  project_id: string;
  epic_id?: string;
  name: string;
  status?: string;
  priority?: string;
  estimated_hours?: number;
  story_points?: number;
  assignee_id?: string;
  synthetic?: boolean;
  runId?: string;
}

export async function createTask(input: CreateTaskInput): Promise<{ id: string } | null> {
  if (!isSupabaseConfigured) return null;
  try {
    const { data, error } = await supabase
      .from('tasks')
      .insert({
        workspace_id: input.workspace_id,
        project_id: input.project_id,
        epic_id: input.epic_id || null,
        name: input.name,
        status: input.status || 'backlog',
        priority: input.priority || 'medium',
        estimated_hours: input.estimated_hours ?? 0,
        story_points: input.story_points ?? 0,
        assignee_id: input.assignee_id || null,
      })
      .select('id')
      .maybeSingle();
    if (error) return null;
    if (data) {
      await activityLogService.appendLog({
        workspace_id: input.workspace_id,
        action: 'task_created',
        metadata: { task_id: data.id, project_id: input.project_id, name: input.name, synthetic: input.synthetic, run_id: input.runId },
      });
      return data;
    }
  } catch { /* ignore */ }
  return null;
}

export async function createTaskDependency(input: {
  workspace_id: string;
  task_id: string;
  depends_on_task_id: string;
}): Promise<boolean> {
  if (!isSupabaseConfigured) return false;
  try {
    const { error } = await supabase
      .from('task_dependencies')
      .upsert({
        workspace_id: input.workspace_id,
        task_id: input.task_id,
        depends_on_task_id: input.depends_on_task_id,
      }, { onConflict: 'workspace_id,task_id,depends_on_task_id' });
    return !error;
  } catch { return false; }
}
