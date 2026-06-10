import { trackSupabaseOperation } from '../core/observability/telemetry';
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
  
  client_id?: string;
  department_id?: string;
  owner_id?: string;
  priority?: string;
  proposed_start_date?: string;
  client_deadline?: string;
  billing_model?: string;
  budget?: number;
  billing_currency?: string;
  approval_workflow?: string;
  pert_enabled?: boolean;

  allocations?: { user_id: string; allocation_percent?: number }[];
  initialRequirements?: { title: string; description?: string; acceptance_criteria?: string; client_visible?: boolean }[];
  initialMilestones?: { name: string; target_date?: string }[];
  initialTasks?: { name: string; description?: string; milestone_index?: number; assignee_id?: string; estimated_hours?: number; priority?: string }[];
}

export async function createProject(input: CreateProjectInput): Promise<{ id: string } | null> {
  if (!isSupabaseConfigured) return null;
  try {
    const { data, error } = await trackSupabaseOperation('supabase_from_projects', () => supabase
      .from('projects')
      .insert({
        workspace_id: input.workspace_id,
        name: input.name,
        description: input.description || '',
        status: input.status || 'active',
        execution_mode: input.execution_mode || EXECUTION_MODES[0],
        client_id: input.client_id || null,
        department_id: input.department_id || null,
        owner_id: input.owner_id || null,
        priority: input.priority || 'medium',
        proposed_start_date: input.proposed_start_date || null,
        client_deadline: input.client_deadline || null,
        billing_model: input.billing_model || 'Fixed Price',
        budget: input.budget || 0,
        billing_currency: input.billing_currency || 'USD',
        approval_workflow: input.approval_workflow || 'standard',
        pert_enabled: input.pert_enabled !== undefined ? input.pert_enabled : true
      })
      .select('id')
      .maybeSingle());
    if (error) { logServiceFailure('createProject', input, error); return null; }
    if (data) {
      const projectId = data.id;
      
      // Insert Allocations
      if (input.allocations && input.allocations.length > 0) {
        await trackSupabaseOperation('supabase_from_project_allocations', () => supabase.from('project_allocations').insert(
          input.allocations.map(a => ({
            workspace_id: input.workspace_id,
            project_id: projectId,
            user_id: a.user_id,
            allocation_percent: a.allocation_percent || 100
          }))
        ));
      }

      // Insert Requirements
      if (input.initialRequirements && input.initialRequirements.length > 0) {
        await trackSupabaseOperation('supabase_from_requirements', () => supabase.from('requirements').insert(
          input.initialRequirements.map(r => ({
            workspace_id: input.workspace_id,
            project_id: projectId,
            title: r.title,
            description: r.description,
            acceptance_criteria: r.acceptance_criteria,
            client_visible: r.client_visible || false
          }))
        ));
      }

      // Insert Milestones
      let insertedMilestones: any[] = [];
      if (input.initialMilestones && input.initialMilestones.length > 0) {
        const { data: msData } = await trackSupabaseOperation('supabase_from_milestones', () => supabase.from('milestones').insert(
          input.initialMilestones.map(m => ({
            workspace_id: input.workspace_id,
            project_id: projectId,
            name: m.name,
            target_date: m.target_date || null
          }))
        ).select('id'));
        if (msData) insertedMilestones = msData;
      }

      // Insert Initial Tasks
      if (input.initialTasks && input.initialTasks.length > 0) {
        await trackSupabaseOperation('supabase_from_tasks', () => supabase.from('tasks').insert(
          input.initialTasks.map((t) => {
            const msId = (t.milestone_index !== undefined && insertedMilestones[t.milestone_index]) 
              ? insertedMilestones[t.milestone_index].id 
              : null;
            return {
              workspace_id: input.workspace_id,
              project_id: projectId,
              name: t.name,
              description: t.description || '',
              assignee_id: t.assignee_id || null,
              estimated_hours: t.estimated_hours || 0,
              priority: t.priority || 'medium',
              status: 'backlog',
              milestone_id: msId
            };
          })
        ));
      }

      await activityLogService.appendLog({
        workspace_id: input.workspace_id,
        action: 'project_created',
        metadata: { project_id: projectId, name: input.name, synthetic: input.synthetic, run_id: input.runId },
      });
      return data;
    }
  } catch (err) { logServiceFailure('createProject', input, err); }
  return null;
}

export async function updateProject(
  projectId: string,
  updates: Record<string, any>,
  userRole: string,
  workspaceId: string
): Promise<boolean> {
  if (!isSupabaseConfigured) return false;
  
  if (userRole === 'developer') {
    const restrictedFields = ['deadline', 'budget', 'priority', 'status', 'eta_override', 'assigned_team', 'client_deadline'];
    const attemptedRestricted = restrictedFields.some(field => field in updates);
    if (attemptedRestricted) {
      throw new Error("Developers are not permitted to modify project-level constraints (deadline, budget, priority, status, etc.).");
    }
  }

  try {
    const { error } = await trackSupabaseOperation('supabase_from_projects', () => supabase
      .from('projects')
      .update(updates)
      .eq('id', projectId)
      .eq('workspace_id', workspaceId));
      
    if (error) throw error;
    
    await activityLogService.appendLog({
      workspace_id: workspaceId,
      action: 'project_updated',
      metadata: { project_id: projectId, updates },
    });
    return true;
  } catch (err) {
    logServiceFailure('updateProject', { projectId, updates }, err);
    throw err;
  }
}

export async function archiveProject(projectId: string, workspaceId: string, actorId: string): Promise<boolean> {
  if (!isSupabaseConfigured) return false;
  try {
    const now = new Date().toISOString();

    // 1. Archive the project itself
    await trackSupabaseOperation('supabase_from_projects', () => supabase.from('projects').update({ status: 'archived', deleted_at: now }).eq('id', projectId));

    // 2. Cascade to Tasks
    await trackSupabaseOperation('supabase_from_tasks', () => supabase.from('tasks').update({ status: 'archived', deleted_at: now }).eq('project_id', projectId).is('deleted_at', null));

    // 3. Cascade to Wait States (Targeting Project)
    await trackSupabaseOperation('supabase_from_wait_states', () => supabase.from('wait_states').update({ status: 'archived', deleted_at: now }).eq('target_type', 'project').eq('target_id', projectId).is('deleted_at', null));

    // 4. Cascade to Signoffs
    await trackSupabaseOperation('supabase_from_project_signoffs', () => supabase.from('project_signoffs').update({ status: 'archived', deleted_at: now }).eq('project_id', projectId).is('deleted_at', null));

    // 5. Cascade to Allocation Periods (Phase 2B)
    await trackSupabaseOperation('supabase_from_allocation_periods', () => supabase.from('allocation_periods').update({ deleted_at: now }).eq('project_id', projectId).is('deleted_at', null));

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
