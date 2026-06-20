import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { calendarEventService } from './calendarEventService';
import { activityLogService } from './activityLogService';
import { calculateDailyProductiveHours } from '../utils/productivity';
import { logServiceFailure } from '../utils/supabaseError';
import type { Sprint } from '../types';

export interface SprintHealth {
  status: 'healthy' | 'warning' | 'critical';
  reasons: string[];
  committed_hours?: number;
  available_hours?: number;
  blockers_count?: number;
}

export const sprintService = {
  async createSprint(sprint: Omit<Sprint, 'id' | 'created_at' | 'updated_at'>, actorId?: string): Promise<Sprint | null> {
    if (!isSupabaseConfigured) return null;
    const { data, error } = await supabase.from('sprints').insert(sprint).select().single();
    if (error) { logServiceFailure('sprintService.createSprint', sprint, error); return null; }
    const created = data as Sprint;
    await activityLogService.appendLog({
      workspace_id: sprint.workspace_id, actor_id: actorId,
      project_id: sprint.project_id, action_type: 'sprint_created',
      metadata: { sprint_id: created.id, sprint_name: sprint.name, start_date: sprint.start_date, end_date: sprint.end_date }
    });
    return created;
  },

  async updateSprint(id: string, updates: Partial<Sprint>, actorId?: string): Promise<boolean> {
    if (!isSupabaseConfigured) return false;
    const { error } = await supabase.from('sprints').update({ ...updates, updated_at: new Date().toISOString() }).eq('id', id);
    if (error) { console.error('sprintService.updateSprint:', error); return false; }
    if (updates.workspace_id) {
      await activityLogService.appendLog({
        workspace_id: updates.workspace_id, actor_id: actorId,
        action_type: 'sprint_updated',
        metadata: { sprint_id: id, updates: Object.keys(updates) }
      });
    }
    return true;
  },

  async deleteSprint(id: string, workspaceId: string, projectId?: string, actorId?: string): Promise<boolean> {
    if (!isSupabaseConfigured) return false;
    const { error } = await supabase.from('sprints').update({ deleted_at: new Date().toISOString() }).eq('id', id).is('deleted_at', null);
    if (error) { console.error('sprintService.deleteSprint:', error); return false; }
    await activityLogService.appendLog({
      workspace_id: workspaceId, actor_id: actorId,
      project_id: projectId, action_type: 'sprint_deleted',
      metadata: { sprint_id: id }
    });
    return true;
  },

  async getSprints(workspaceId: string, projectId?: string): Promise<Sprint[]> {
    if (!isSupabaseConfigured) return [];
    let query = supabase.from('sprints').select('*').eq('workspace_id', workspaceId).is('deleted_at', null).order('start_date', { ascending: false });
    if (projectId) query = query.eq('project_id', projectId);
    const { data, error } = await query;
    if (error) { console.error('sprintService.getSprints:', error); return []; }
    return (data || []) as Sprint[];
  },

  async getActiveSprint(workspaceId: string, projectId: string): Promise<Sprint | null> {
    if (!isSupabaseConfigured) return null;
    const { data, error } = await supabase
      .from('sprints')
      .select('*')
      .eq('workspace_id', workspaceId)
      .eq('project_id', projectId)
      .eq('status', 'active')
      .maybeSingle();
    if (error || !data) return null;
    return data as Sprint;
  },

  async calculateVelocity(sprintId: string): Promise<{ committed: number; completed: number }> {
    if (!isSupabaseConfigured) return { committed: 0, completed: 0 };
    const { data: tasks, error } = await supabase
      .from('tasks')
      .select('story_points, status')
      .eq('sprint_id', sprintId);
    if (error || !tasks) return { committed: 0, completed: 0 };
    const committed = tasks.reduce((sum, t) => sum + (t.story_points || 0), 0);
    const completed = tasks.filter(t => t.status === 'done').reduce((sum, t) => sum + (t.story_points || 0), 0);
    return { committed, completed };
  },

  async calculateConfidence(
    workspaceId: string,
    sprintId: string,
    workStart?: string,
    workEnd?: string
  ): Promise<{ effectiveCapacity: number; deductedHours: number; confidence: number; eventCount: number }> {
    if (!isSupabaseConfigured) return { effectiveCapacity: 0, deductedHours: 0, confidence: 0, eventCount: 0 };
    const { data: sprint } = await supabase.from('sprints').select('*').eq('id', sprintId).single();
    if (!sprint) return { effectiveCapacity: 0, deductedHours: 0, confidence: 0, eventCount: 0 };
    const baseHoursPerDay = 8;
    
    const { companyCalendarService } = await import('./companyCalendarService');
    const calSettings = await companyCalendarService.getSettings(workspaceId);
    const workingDays = calSettings?.working_days || [1, 2, 3, 4, 5, 6];

    const { totalCapacity, deductedHours, events } = await calendarEventService.getEffectiveCapacity(
      workspaceId, sprint.start_date, sprint.end_date, baseHoursPerDay, workingDays, undefined, undefined, workStart, workEnd
    );
    const totalPossible = totalCapacity + deductedHours;
    const confidence = totalPossible > 0 ? Math.round((totalCapacity / totalPossible) * 100) : 0;
    return { effectiveCapacity: totalCapacity, deductedHours, confidence, eventCount: events.length };
  },

  async getBurndownData(
    sprintId: string,
    startDate: string,
    endDate: string,
    workspaceId?: string
  ): Promise<{ date: string; ideal: number; actual: number; effectiveIdeal: number }[]> {
    if (!isSupabaseConfigured) return [];
    const start = new Date(startDate);
    const end = new Date(endDate);
    const totalDays = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
    const { data: tasks } = await supabase.from('tasks').select('story_points, status, updated_at').eq('sprint_id', sprintId);
    if (!tasks) return [];
    const totalPoints = tasks.reduce((sum, t) => sum + (t.story_points || 0), 0);
    const dailyIdeal = totalPoints / Math.max(1, totalDays);

    // Get calendar events for effective ideal line
    const events = workspaceId
      ? await calendarEventService.getEventsInRange(workspaceId, startDate, endDate)
      : [];
    const eventDaysMap = new Map<string, boolean>();
    events.forEach(e => {
      const es = new Date(e.start_date);
      const ee = new Date(e.end_date);
      const d = new Date(es);
      while (d <= ee) {
        eventDaysMap.set(d.toISOString().split('T')[0], true);
        d.setDate(d.getDate() + 1);
      }
    });

    let workingDaysRemaining = totalDays;
    const points = [];
    for (let i = 0; i <= totalDays; i++) {
      const date = new Date(start.getTime() + i * 86400000);
      const dateStr = date.toISOString().split('T')[0];
      const ideal = Math.max(0, totalPoints - dailyIdeal * i);
      const isEventDay = eventDaysMap.has(dateStr);
      if (isEventDay) workingDaysRemaining--;
      const effectiveDailyRate = workingDaysRemaining > 0 ? totalPoints / workingDaysRemaining : totalPoints;
      const effectiveIdeal = Math.max(0, totalPoints - effectiveDailyRate * i);
      const actual = tasks
        .filter(t => t.status === 'done' && t.updated_at && new Date(t.updated_at) <= date)
        .reduce((sum, t) => sum + (t.story_points || 0), 0);
      points.push({ date: dateStr, ideal: Math.round(ideal * 10) / 10, actual: totalPoints - actual, effectiveIdeal: Math.round(effectiveIdeal * 10) / 10 });
    }
    return points;
  },

  async addTaskToSprint(taskId: string, sprintId: string, workspaceId: string, actorId?: string, isSprintActive = false): Promise<boolean> {
    if (!isSupabaseConfigured) return false;
    const { error } = await supabase.from('tasks').update({ sprint_id: sprintId }).eq('id', taskId);
    if (error) { console.error('[sprintService.addTaskToSprint]', error); return false; }
    
    const { activityEventService } = await import('./activityEventService');
    await activityEventService.recordActivity({
      workspace_id: workspaceId, actor_id: actorId, entity_type: 'task', entity_id: taskId,
      action_type: 'task_added_to_sprint', after_value: { sprint_id: sprintId }
    });

    if (isSprintActive) {
      await activityEventService.recordActivity({
        workspace_id: workspaceId, actor_id: actorId, entity_type: 'sprint', entity_id: sprintId,
        action_type: 'scope_changed', after_value: { added_after_start: true, task_id: taskId }
      });
    }
    return true;
  },

  async removeTaskFromSprint(taskId: string, sprintId: string, workspaceId: string, actorId?: string, isSprintActive = false): Promise<boolean> {
    if (!isSupabaseConfigured) return false;
    const { error } = await supabase.from('tasks').update({ sprint_id: null }).eq('id', taskId);
    if (error) { console.error('[sprintService.removeTaskFromSprint]', error); return false; }
    
    const { activityEventService } = await import('./activityEventService');
    await activityEventService.recordActivity({
      workspace_id: workspaceId, actor_id: actorId, entity_type: 'task', entity_id: taskId,
      action_type: 'task_removed_from_sprint', before_value: { sprint_id: sprintId }
    });

    if (isSprintActive) {
      await activityEventService.recordActivity({
        workspace_id: workspaceId, actor_id: actorId, entity_type: 'sprint', entity_id: sprintId,
        action_type: 'scope_changed', after_value: { removed_after_start: true, task_id: taskId }
      });
    }
    return true;
  },

  async startSprint(sprintId: string, workspaceId: string, actorId?: string): Promise<boolean> {
    if (!isSupabaseConfigured) return false;
    const { error } = await supabase.from('sprints').update({ status: 'active' }).eq('id', sprintId);
    if (error) return false;

    const { activityEventService } = await import('./activityEventService');
    await activityEventService.recordActivity({
      workspace_id: workspaceId, actor_id: actorId, entity_type: 'sprint', entity_id: sprintId,
      action_type: 'sprint_started', after_value: { status: 'active' }
    });
    return true;
  },

  async completeSprint(
    sprintId: string,
    workspaceId: string,
    snapshotData: any,
    incompleteTaskIds: string[],
    actionForIncomplete: 'backlog' | 'next_sprint',
    nextSprintId?: string,
    actorId?: string
  ): Promise<boolean> {
    if (!isSupabaseConfigured) return false;

    await supabase.from('sprint_snapshots').insert({
      workspace_id: workspaceId, sprint_id: sprintId, snapshot: snapshotData
    });

    const { error } = await supabase.from('sprints').update({ status: 'completed' }).eq('id', sprintId);
    if (error) return false;

    if (incompleteTaskIds.length > 0) {
      if (actionForIncomplete === 'backlog') {
        await supabase.from('tasks').update({ sprint_id: null }).in('id', incompleteTaskIds);
      } else if (actionForIncomplete === 'next_sprint' && nextSprintId) {
        await supabase.from('tasks').update({ sprint_id: nextSprintId }).in('id', incompleteTaskIds);
      }
    }

    const { activityEventService } = await import('./activityEventService');
    await activityEventService.recordActivity({
      workspace_id: workspaceId, actor_id: actorId, entity_type: 'sprint', entity_id: sprintId,
      action_type: 'sprint_completed', after_value: { snapshot: snapshotData, carried_forward: incompleteTaskIds.length }
    });

    return true;
  },

  async getSprintHealth(sprintTasks: any[], capacityHours: number) {
    const committedHours = sprintTasks.reduce((sum, t) => sum + (Number(t.estimated_hours) || 0), 0);
    const blockersCount = sprintTasks.filter(t => t.status === 'blocked').length;
    
    const reasons: string[] = [];
    let status: 'healthy' | 'warning' | 'critical' = 'healthy';

    if (committedHours > capacityHours) {
      status = 'warning';
      reasons.push(`Sprint overloaded by ${Math.ceil(committedHours - capacityHours)}h`);
      if (committedHours > capacityHours * 1.2) status = 'critical';
    }

    if (blockersCount > 0) {
      reasons.push(`${blockersCount} tasks blocked`);
      if (blockersCount > 2) status = 'critical';
      else if (status === 'healthy') status = 'warning';
    }

    if (reasons.length === 0) reasons.push('Capacity is healthy and no active blockers.');

    return { status, available_hours: capacityHours, committed_hours: committedHours, blockers_count: blockersCount, reasons };
  }
};
