import { supabase, isSupabaseConfigured } from '../lib/supabase';
import type { WaitState, WaitStateTargetType, WaitStateCategory, WaitStateOwner } from '../core/types/collaboration';
import { activityLogService } from './activityLogService';

export interface CreateWaitStateParams {
  workspaceId: string;
  targetType: WaitStateTargetType;
  targetId: string;
  category: WaitStateCategory;
  waitingOn: WaitStateOwner;
  reason?: string;
  userId?: string;
}

export interface ResolveWaitStateParams {
  waitStateId: string;
  workspaceId: string;
  userId?: string;
}

export const EXTERNAL_WAIT_OWNERS: WaitStateOwner[] = ['client', 'vendor', 'compliance', 'external_partner'];
export const INTERNAL_WAIT_OWNERS: WaitStateOwner[] = ['internal_team', 'pm', 'infrastructure'];

export const waitStateEngine = {
  async fetchWaitStates(workspaceId: string, targetType?: WaitStateTargetType, targetId?: string): Promise<WaitState[]> {
    if (!isSupabaseConfigured) return [];
    try {
      let query = supabase.from('wait_states').select('*').eq('workspace_id', workspaceId).is('deleted_at', null);
      if (targetType) query = query.eq('target_type', targetType);
      if (targetId) query = query.eq('target_id', targetId);
      
      const { data } = await query;
      return (data as WaitState[]) || [];
    } catch {
      return [];
    }
  },

  async createWaitState(params: CreateWaitStateParams): Promise<WaitState | null> {
    if (!isSupabaseConfigured) return null;
    try {
      const { data } = await supabase.from('wait_states').insert({
        workspace_id: params.workspaceId,
        target_type: params.targetType,
        target_id: params.targetId,
        category: params.category,
        waiting_on: params.waitingOn,
        reason: params.reason,
        status: 'active',
        started_at: new Date().toISOString()
      }).select().single();

      if (data) {
        await activityLogService.appendLog({
          workspace_id: params.workspaceId,
          actor_id: params.userId,
          action: 'wait_state_created',
          metadata: { wait_state_id: data.id, target_type: params.targetType, target_id: params.targetId, category: params.category }
        });
        return data as WaitState;
      }
    } catch (e) {
      console.error('Failed to create wait state', e);
    }
    return null;
  },

  async resolveWaitState(params: ResolveWaitStateParams): Promise<boolean> {
    if (!isSupabaseConfigured) return false;
    try {
      const now = new Date();
      
      // Fetch current to calculate duration
      const { data: current } = await supabase.from('wait_states').select('*').eq('id', params.waitStateId).single();
      if (!current) return false;

      const startedAt = new Date(current.started_at);
      // Simplified duration calculation (in a real app, this would use the work window logic)
      const durationHours = Math.max(0.1, (now.getTime() - startedAt.getTime()) / 3600000);

      const { error } = await supabase.from('wait_states').update({
        status: 'resolved',
        resolved_at: now.toISOString(),
        duration_hours: durationHours
      }).eq('id', params.waitStateId);

      if (!error) {
        await activityLogService.appendLog({
          workspace_id: params.workspaceId,
          actor_id: params.userId,
          action: 'wait_state_resolved',
          metadata: { wait_state_id: params.waitStateId, duration_hours: durationHours }
        });
        
        // Update task wait time if it's a task
        if (current.target_type === 'task') {
          // This would ideally be a secure RPC or trigger
          const { data: task } = await supabase.from('tasks').select('wait_time_hours, cycle_time_hours').eq('id', current.target_id).single();
          if (task) {
            await supabase.from('tasks').update({
              wait_time_hours: (task.wait_time_hours || 0) + durationHours,
              cycle_time_hours: (task.cycle_time_hours || 0) + durationHours
            }).eq('id', current.target_id);
          }
        }
        return true;
      }
    } catch (e) {
      console.error('Failed to resolve wait state', e);
    }
    return false;
  },

  async archiveWaitState(waitStateId: string, workspaceId: string, actorId: string): Promise<boolean> {
    if (!isSupabaseConfigured) return false;
    try {
      const { error } = await supabase.from('wait_states').update({
        status: 'archived',
        deleted_at: new Date().toISOString()
      }).eq('id', waitStateId);

      if (!error) {
        await activityLogService.appendLog({
          workspace_id: workspaceId,
          actor_id: actorId,
          action: 'wait_state_archived',
          metadata: { wait_state_id: waitStateId }
        });
        return true;
      }
    } catch (e) {
      console.error('Failed to archive wait state', e);
    }
    return false;
  },

  calculateExecutionEfficiency(workTimeHours: number, waitTimeHours: number): number {
    const cycleTime = workTimeHours + waitTimeHours;
    if (cycleTime === 0) return 1.0; // Perfect efficiency if no time spent
    return workTimeHours / cycleTime;
  },

  getEfficiencyClassification(efficiency: number): 'Healthy' | 'Constrained' | 'Waiting Dominated' {
    if (efficiency >= 0.75) return 'Healthy';
    if (efficiency >= 0.40) return 'Constrained';
    return 'Waiting Dominated';
  },

  classifyDelays(waitStates: WaitState[]): { internalDelay: number; externalDelay: number; topDelaySource: string | null } {
    let internalDelay = 0;
    let externalDelay = 0;
    const sources: Record<string, number> = {};

    waitStates.forEach(ws => {
      const duration = ws.duration_hours || 0;
      if (EXTERNAL_WAIT_OWNERS.includes(ws.waiting_on)) {
        externalDelay += duration;
      } else {
        internalDelay += duration;
      }
      
      const sourceKey = `${ws.category}:${ws.waiting_on}`;
      sources[sourceKey] = (sources[sourceKey] || 0) + duration;
    });

    let topDelaySource = null;
    let maxDuration = 0;
    Object.entries(sources).forEach(([source, duration]) => {
      if (duration > maxDuration) {
        maxDuration = duration;
        topDelaySource = source;
      }
    });

    return { internalDelay, externalDelay, topDelaySource };
  }
};
