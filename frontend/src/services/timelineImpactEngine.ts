import { predictEta, getSchedulingContext } from './etaService';
import { type Task, type TaskDependency, type CalendarEvent, type Milestone, type Project } from '../types';
import type { WorkspaceSettings } from '../types/workspace';
import type { WorkWindow } from '../utils/productivity';
import type { WaitState } from '../core/types/collaboration';

export interface EntityDependency {
  source_id: string;
  source_type: 'task' | 'milestone' | 'project';
  target_id: string;
  target_type: 'task' | 'milestone' | 'project';
}

export interface ImpactInput {
  workspaceId: string;
  triggerEntityId?: string;
  triggerEntityType: 'task' | 'milestone' | 'project' | 'meeting' | 'leave' | 'holiday' | 'dependency' | 'approval' | 'wait_state';
  triggerAction: 'created' | 'updated' | 'deleted' | 'rescheduled' | 'approved' | 'rejected' | 'resolved';
  actorId?: string;
  tasks: Task[];
  milestones?: Milestone[];
  projects?: Project[];
  waitStates?: WaitState[];
  dependencies: (TaskDependency | EntityDependency)[];
  calendarEvents: CalendarEvent[];
  workspaceSettings: WorkspaceSettings;
}

export interface AffectedEntity {
  taskId: string;
  taskName: string;
  originalEta: string | null;
  newEta: string | null;
  originalRisk: string;
  newRisk: string;
  originalConfidence: number;
  newConfidence: number;
  deltaDays: number;
  suggestedStartDate: string | null;
  suggestedDeadline: string | null;
}

export interface ImpactResult {
  affectedEntities: AffectedEntity[];
  capacityDelta: number;
  etaDelta: number;
  riskDelta: number;
  confidenceDelta: number;
  propagatedFrom: string | null;
  triggerEntityType: string;
  triggerAction: string;
}

function buildReverseGraph(dependencies: (TaskDependency | EntityDependency)[], tasks: Task[], milestones?: Milestone[]): Map<string, string[]> {
  const graph = new Map<string, string[]>();
  for (const dep of dependencies) {
    const source = 'task_id' in dep ? dep.task_id : dep.source_id;
    const target = 'depends_on_task_id' in dep ? dep.depends_on_task_id : dep.target_id;
    
    // Archival-Aware Governance: Ignore ghost edges where either node is missing (archived)
    const sourceExists = tasks.some(t => t.id === source) || milestones?.some(m => m.id === source);
    const targetExists = tasks.some(t => t.id === target) || milestones?.some(m => m.id === target);
    if (!sourceExists || !targetExists) continue;

    const dependents = graph.get(target) || [];
    dependents.push(source);
    graph.set(target, dependents);
  }
  
  // Implicit hierarchy edges: A milestone implicitly depends on its tasks. A task implicitly depends on its project/milestone wait states.
  if (milestones) {
    for (const t of tasks) {
      if (t.milestone_id) {
        const dependents = graph.get(t.id) || [];
        if (!dependents.includes(t.milestone_id)) dependents.push(t.milestone_id);
        graph.set(t.id, dependents);
      }
    }
  }
  return graph;
}

function buildForwardGraph(dependencies: (TaskDependency | EntityDependency)[], tasks: Task[], milestones?: Milestone[]): Map<string, string[]> {
  const graph = new Map<string, string[]>();
  for (const dep of dependencies) {
    const source = 'task_id' in dep ? dep.task_id : dep.source_id;
    const target = 'depends_on_task_id' in dep ? dep.depends_on_task_id : dep.target_id;
    
    // Archival-Aware Governance: Ignore ghost edges where either node is missing (archived)
    const sourceExists = tasks.some(t => t.id === source) || milestones?.some(m => m.id === source);
    const targetExists = tasks.some(t => t.id === target) || milestones?.some(m => m.id === target);
    if (!sourceExists || !targetExists) continue;

    const deps = graph.get(source) || [];
    deps.push(target);
    graph.set(source, deps);
  }
  
  if (milestones) {
    for (const t of tasks) {
      if (t.milestone_id) {
        const deps = graph.get(t.milestone_id) || [];
        if (!deps.includes(t.id)) deps.push(t.id);
        graph.set(t.milestone_id, deps);
      }
    }
  }
  return graph;
}

function findDownstreamTasks(
  startTaskId: string,
  reverseGraph: Map<string, string[]>,
  visited: Set<string>
): string[] {
  const result: string[] = [];
  const queue = [startTaskId];
  while (queue.length > 0) {
    const current = queue.shift()!;
    const dependents = reverseGraph.get(current) || [];
    for (const depId of dependents) {
      if (!visited.has(depId)) {
        visited.add(depId);
        result.push(depId);
        queue.push(depId);
      }
    }
  }
  return result;
}

async function recalculateTask(
  task: Task,
  workWindow: WorkWindow,
  workspaceId?: string,
  assigneeId?: string
): Promise<{ eta: string; risk: string; confidence: number }> {
  let effectiveWorkWindow = workWindow;
  if (workspaceId && assigneeId) {
    try {
      const ctx = await getSchedulingContext(
        { workStart: workWindow.workStart, workEnd: workWindow.workEnd, lunchDuration: workWindow.lunchDuration, workingDays: workWindow.workingDays, productivityFactor: workWindow.productivityFactor, saturdayRule: workWindow.saturdayRule, shutdowns: workWindow.shutdowns } as any,
        workspaceId,
        assigneeId
      );
      effectiveWorkWindow = { ...workWindow, ...ctx };
    } catch {}
  }

  const params = {
    best: task.pert_best,
    likely: task.pert_likely,
    worst: task.pert_worst,
    estimatedHours: task.estimated_hours,
    startDate: task.start_date ? new Date(task.start_date) : undefined,
    deadline: task.deadline ? new Date(task.deadline) : null,
    workWindow: effectiveWorkWindow,
    attendanceFactor: 1,
    availabilityFactor: 1,
    teamLoadFactor: 1,
    interruptionHours: 0,
    workspaceId,
    assigneeId: task.assignee_id,
    taskName: task.name,
    taskTags: (task as any).tags
  };
  const result = await predictEta(params);
  return {
    eta: result.predictedCompletion.toISOString().split('T')[0],
    risk: result.risk,
    confidence: result.confidence
  };
}

export async function computeImpactLocal(input: ImpactInput): Promise<ImpactResult> {
  const {
    workspaceId, triggerEntityId, triggerEntityType, triggerAction,
    tasks, milestones, waitStates, dependencies, calendarEvents, workspaceSettings, actorId
  } = input;

  const reverseGraph = buildReverseGraph(dependencies, tasks, milestones);
  const forwardGraph = buildForwardGraph(dependencies, tasks, milestones);
  const taskMap = new Map(tasks.map(t => [t.id, t]));

  const workWindow: WorkWindow = {
    workStart: workspaceSettings.workStart,
    workEnd: workspaceSettings.workEnd,
    lunchDuration: workspaceSettings.lunchDuration,
    workingDays: workspaceSettings.workingDays,
    productivityFactor: workspaceSettings.productivityFactor,
    saturdayRule: workspaceSettings.saturdayRule,
    holidays: calendarEvents.filter(e => e.event_type === 'holiday' || e.event_type === 'festival').map(e => e.start_date.split('T')[0]),
    shutdowns: [...(workspaceSettings.shutdowns || []), ...calendarEvents.filter(e => e.source_table === 'organization' && e.event_type === 'company' && (e.capacity_impact ?? 1) >= 1).map(e => ({ start: e.start_date.split('T')[0], end: e.end_date.split('T')[0], name: e.title || 'Company event' }))],
    teamEvents: calendarEvents.filter(e => e.event_type === 'company' || e.event_type === 'sprint').map(e => ({
      start: new Date(e.start_date),
      end: new Date(e.end_date),
      availabilityFactor: 1 - (e.capacity_impact * (e.capacity_modifier ?? 1))
    })),
    personalLeaves: calendarEvents.filter(e => e.event_type === 'leave').map(e => ({
      start: new Date(e.start_date),
      end: new Date(e.end_date),
      availabilityFactor: 1 - (e.capacity_impact * (e.capacity_modifier ?? 1))
    }))
  };

  const visited = new Set<string>();
  let affectedEntityIds: string[] = [];

  // Halt propagation if a Project-level wait state is active
  const projectWaitStateActive = waitStates?.some(ws => ws.target_type === 'project' && ws.status === 'active');
  
  if (!projectWaitStateActive) {
    if (triggerEntityId && (taskMap.has(triggerEntityId) || milestones?.some(m => m.id === triggerEntityId))) {
      visited.add(triggerEntityId);
      affectedEntityIds = findDownstreamTasks(triggerEntityId, reverseGraph, visited);
    } else if (triggerEntityType === 'meeting' || triggerEntityType === 'leave' || triggerEntityType === 'holiday') {
      affectedEntityIds = tasks.filter(t => t.status !== 'done' && t.start_date).map(t => t.id);
    } else if (triggerEntityType === 'approval' && triggerEntityId) {
      visited.add(triggerEntityId);
      affectedEntityIds = findDownstreamTasks(triggerEntityId, reverseGraph, visited);
    }
  }

  const affectedEntities: AffectedEntity[] = [];
  let totalCapacityDelta = 0;
  let totalRiskDelta = 0;
  let totalConfidenceDelta = 0;

  for (const entityId of affectedEntityIds) {
    const task = taskMap.get(entityId);
    if (!task || task.status === 'done') {
      // It's a milestone. If it's a milestone, we aggregate its children dates in the persistence step.
      continue; 
    }

    // Task wait state check to avoid duplicate shifting
    const activeWaitState = waitStates?.find(ws => ws.target_type === 'task' && ws.target_id === entityId && ws.status === 'active');
    if (activeWaitState) continue; // Task is paused independently.

    const milestoneWaitState = task.milestone_id ? waitStates?.find(ws => ws.target_type === 'milestone' && ws.target_id === task.milestone_id && ws.status === 'active') : undefined;
    if (milestoneWaitState) continue; // Paused by parent.

    const originalEta = task.predicted_completion || task.deadline || null;
    const originalRisk = task.risk || 'low';
    const originalConfidence = task.confidence ?? 100;

    const predecessorIds = forwardGraph.get(entityId) || [];
    const predecessorDates = predecessorIds
      .map(id => taskMap.get(id))
      .filter((t): t is Task => !!t)
      .map(t => t.deadline || t.predicted_completion || '')
      .filter(Boolean);

    let shiftedStartDate: string | null = null;
    if (predecessorDates.length > 0) {
      const latestPredecessorEnd = predecessorDates.reduce((latest, d) => {
        const parsed = new Date(d);
        return parsed > latest ? parsed : latest;
      }, new Date(0));
      const candidateStart = new Date(latestPredecessorEnd);
      const { addWorkingHours } = await import('../utils/productivity');
      const nextSlot = addWorkingHours(candidateStart, 0, workWindow);
      shiftedStartDate = nextSlot.toISOString().split('T')[0];
    }

    const shiftedTask = shiftedStartDate
      ? { ...task, start_date: shiftedStartDate }
      : task;

    const { eta, risk, confidence } = await recalculateTask(shiftedTask, workWindow, workspaceId, task.assignee_id);

    const deltaDays = originalEta
      ? Math.round((new Date(eta).getTime() - new Date(originalEta).getTime()) / 86400000)
      : 0;

    if (risk !== originalRisk && (risk === 'high' || originalRisk === 'low')) {
      totalRiskDelta++;
    }

    totalConfidenceDelta += confidence - originalConfidence;
    totalCapacityDelta += Math.max(0, deltaDays) * 8;

    affectedEntities.push({
      taskId: entityId,
      taskName: task.name,
      originalEta,
      newEta: eta,
      originalRisk,
      newRisk: risk,
      originalConfidence,
      newConfidence: confidence,
      deltaDays,
      suggestedStartDate: shiftedStartDate,
      suggestedDeadline: eta
    });
  }

  const avgConfidenceDelta = affectedEntities.length > 0
    ? Math.round(totalConfidenceDelta / affectedEntities.length)
    : 0;

  return {
    affectedEntities,
    capacityDelta: totalCapacityDelta,
    etaDelta: affectedEntities.reduce((sum, e) => sum + Math.max(0, e.deltaDays), 0),
    riskDelta: totalRiskDelta,
    confidenceDelta: avgConfidenceDelta,
    propagatedFrom: triggerEntityId || null,
    triggerEntityType,
    triggerAction
  };
}

import { supabase } from '../lib/supabase';
import { activityLogService } from './activityLogService';
import { activityEventService } from './activityEventService';
import { cascadeQueueEngine } from '../core/engines/cascadeQueueEngine';

export async function persistBatch(
  input: ImpactInput,
  result: ImpactResult,
  entitiesChunk: AffectedEntity[]
): Promise<void> {
  const isLargeCascade = result.affectedEntities.length >= 50;

  for (const entity of entitiesChunk) {
    if (entity.deltaDays !== 0 || entity.newRisk !== entity.originalRisk) {
      const updates: Record<string, any> = {
        predicted_completion: entity.newEta,
        risk: entity.newRisk,
        confidence: entity.newConfidence,
        updated_at: new Date().toISOString()
      };
      if (entity.suggestedStartDate) {
        updates.start_date = entity.suggestedStartDate;
      }
      if (entity.suggestedDeadline) {
        updates.deadline = entity.suggestedDeadline;
      }

      await supabase
        .from('tasks')
        .update(updates)
        .eq('id', entity.taskId);

      if (!isLargeCascade) {
        await activityEventService.recordActivity({
          workspace_id: input.workspaceId,
          actor_id: input.actorId || 'system',
          entity_type: 'task',
          entity_id: entity.taskId,
          action_type: 'timeline_impact_propagated',
          metadata: {
            trigger_type: input.triggerEntityType,
            delta_days: entity.deltaDays,
            risk_delta: entity.newRisk !== entity.originalRisk ? `${entity.originalRisk}→${entity.newRisk}` : 'none'
          }
        });
      }
    }
  }
}

export async function propagateAndPersist(
  input: ImpactInput,
  existingResult?: ImpactResult,
  onProgress?: (processed: number, total: number) => void
): Promise<ImpactResult> {

  const result = existingResult || await computeImpact(input);

  // Route through Cascade Queue Engine
  await cascadeQueueEngine.queueCascadeImpact(input, result, persistBatch, onProgress);

  // Aggregated mass event for large cascades
  if (result.affectedEntities.length >= 50) {
    await activityEventService.recordActivity({
      workspace_id: input.workspaceId,
      actor_id: input.actorId || 'system',
      entity_type: input.triggerEntityType,
      entity_id: input.triggerEntityId || 'global',
      action_type: 'timeline_mass_recalculation',
      metadata: {
        affected_count: result.affectedEntities.length,
        total_eta_delta_days: result.etaDelta,
        message: `Timeline recalculation updated ${result.affectedEntities.length} linked items`
      }
    });
  } else if (result.affectedEntities.length > 0) {
    await activityLogService.appendLog({
      workspace_id: input.workspaceId,
      actor_id: input.actorId,
      task_id: input.triggerEntityId,
      action: 'timeline_impact_cascade',
      metadata: {
        trigger_type: input.triggerEntityType,
        affected_count: result.affectedEntities.length
      }
    });
  }

  return result;
}

export async function computeImpact(input: ImpactInput): Promise<ImpactResult> {
  const startMs = performance.now();
  let result: ImpactResult;
  let executionLocation = 'main_thread';

  try {
    if (window.Worker) {
      result = await new Promise<ImpactResult>((resolve, reject) => {
        const worker = new Worker(new URL('./timelineImpactWorker.ts', import.meta.url), { type: 'module' });
        
        const timeout = setTimeout(() => {
          worker.terminate();
          reject(new Error('Worker timeout'));
        }, 15000);

        worker.onmessage = (e) => {
          clearTimeout(timeout);
          worker.terminate();
          if (e.data.type === 'success') resolve(e.data.result);
          else reject(new Error(e.data.error));
        };

        worker.onerror = (err) => {
          clearTimeout(timeout);
          worker.terminate();
          reject(err);
        };

        worker.postMessage(input);
      });
      executionLocation = 'worker';
    } else {
      throw new Error('Web Workers not supported');
    }
  } catch (err) {
    result = await computeImpactLocal(input);
  }

  const durationMs = performance.now() - startMs;
  if (input.tasks.length >= 500) {
    import('./activityLogService').then(({ activityLogService }) => {
      activityLogService.appendLog({
        workspace_id: input.workspaceId,
        action: 'timeline_impact_computed',
        metadata: {
          task_count: input.tasks.length,
          duration_ms: durationMs,
          location: executionLocation,
          affected_count: result.affectedEntities.length
        }
      }).catch(() => {});
    });
  }

  return result;
}
