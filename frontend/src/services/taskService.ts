import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { activityLogService } from './activityLogService';
import { logServiceFailure } from '../utils/supabaseError';
import { enterpriseEventPublisher } from './enterpriseEventPublisher';


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
  recurrence_type?: string;
  recurrence_rule?: any;
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
    if (error) { logServiceFailure('createTask', input, error); return null; }
    if (data) {
      // If recurring, setup the template
      if (input.recurrence_type && input.recurrence_type !== 'none') {
        const nextRun = new Date();
        if (input.recurrence_type === 'daily') nextRun.setDate(nextRun.getDate() + 1);
        else if (input.recurrence_type === 'weekly') nextRun.setDate(nextRun.getDate() + 7);
        else if (input.recurrence_type === 'monthly') nextRun.setMonth(nextRun.getMonth() + 1);
        else if (input.recurrence_type === 'yearly') nextRun.setFullYear(nextRun.getFullYear() + 1);
        else nextRun.setDate(nextRun.getDate() + 7); // custom default

        const { data: userData } = await supabase.auth.getUser();
        
        const { data: template } = await supabase.from('recurring_task_templates').insert({
          workspace_id: input.workspace_id,
          project_id: input.project_id,
          title: input.name,
          description: null,
          created_by: userData.user?.id,
          assigned_to: input.assignee_id || null,
          recurrence_type: input.recurrence_type,
          recurrence_rule: input.recurrence_rule || null,
          next_run_at: nextRun.toISOString()
        }).select('id').maybeSingle();

        if (template) {
          await supabase.from('recurring_task_history').insert({
            template_id: template.id,
            generated_task_id: data.id
          });
        }
      }

      try {
        await enterpriseEventPublisher.publish({
          workspace_id: input.workspace_id,
          user_id: input.assignee_id, // Or current session, which publisher automatically falls back to if omitted
          entity_type: 'task',
          entity_id: data.id,
          verb: 'created',
          title: 'Task Created',
          description: `Task "${input.name}" was created.`,
          severity: 'low',
          importance: 'normal',
          icon_key: 'task',
          visibility: 'public',
          module: 'projects',
          metadata: { task_id: data.id, project_id: input.project_id, name: input.name }
        });
      } catch (e) {
        console.error('Failed to log task_created event:', e);
      }

      await activityLogService.appendLog({
        workspace_id: input.workspace_id,
        action_type: 'task_created',
        metadata: { task_id: data.id, project_id: input.project_id, name: input.name, synthetic: input.synthetic, run_id: input.runId },
      });
      return data;
    }
  } catch (err) { logServiceFailure('createTask', input, err); }
  return null;
}

export async function updateTaskWithLock(
  taskId: string,
  updates: Record<string, any>,
  expectedUpdatedAt: string | null
): Promise<{ success: boolean; error?: string }> {
  if (!isSupabaseConfigured) return { success: false, error: 'Supabase not configured' };
  
  try {
    // 1. Fetch current task to check version
    const { data: currentTask, error: fetchError } = await supabase
      .from('tasks')
      .select('updated_at')
      .eq('id', taskId)
      .maybeSingle();

    if (fetchError || !currentTask) {
      return { success: false, error: 'Task not found or fetch failed' };
    }

    // 2. Compare updated_at
    // If expectedUpdatedAt is provided, it must match the current DB state exactly.
    if (expectedUpdatedAt && currentTask.updated_at && currentTask.updated_at !== expectedUpdatedAt) {
      return { success: false, error: 'VERSION_CONFLICT' };
    }

    // 3. Perform update, stamping new updated_at
    const now = new Date().toISOString();
    const { error: updateError } = await supabase
      .from('tasks')
      .update({ ...updates, updated_at: now })
      .eq('id', taskId);

    if (updateError) {
      return { success: false, error: updateError.message };
    }

    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
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
    if (error) { logServiceFailure('createTaskDependency', input, error); return false; }
    return true;
  } catch (err) { logServiceFailure('createTaskDependency', input, err); return false; }
}

export async function archiveTask(taskId: string, workspaceId: string, actorId: string): Promise<boolean> {
  if (!isSupabaseConfigured) return false;
  try {
    const now = new Date().toISOString();

    // 1. Archive the task
    await supabase.from('tasks').update({ status: 'archived', deleted_at: now }).eq('id', taskId);

    // 2. Archive associated wait states
    await supabase.from('wait_states').update({ status: 'archived', deleted_at: now }).eq('target_type', 'task').eq('target_id', taskId).is('deleted_at', null);

    // 3. Deactivate (delete) related dependency edges to prevent ghost dependencies
    await supabase.from('task_dependencies').delete().eq('task_id', taskId);
    await supabase.from('task_dependencies').delete().eq('depends_on_task_id', taskId);

    // Audit
    try {
      const { data: tData } = await supabase.from('tasks').select('name').eq('id', taskId).maybeSingle();
      await enterpriseEventPublisher.publish({
        workspace_id: workspaceId,
        user_id: actorId,
        entity_type: 'task',
        entity_id: taskId,
        verb: 'archived',
        title: 'Task Archived',
        description: `Task "${tData?.name || 'Task'}" was archived.`,
        severity: 'low',
        importance: 'normal',
        icon_key: 'task',
        visibility: 'public',
        module: 'projects',
        metadata: { task_id: taskId }
      });
    } catch (e) {
      console.error('Failed to log task_archived event:', e);
    }

    await activityLogService.appendLog({
      workspace_id: workspaceId,
      actor_id: actorId,
      action_type: 'task_archived',
      metadata: { task_id: taskId, cascade_triggered: true, dependencies_pruned: true },
    });

    return true;
  } catch (err) { 
    logServiceFailure('archiveTask', { taskId }, err); 
    return false;
  }
}
