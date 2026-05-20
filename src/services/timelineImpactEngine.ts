import { predictEta } from './etaService';
import { type Task, type TaskDependency, type CalendarEvent } from '../types';
import type { WorkspaceSettings } from '../types/workspace';
import type { WorkWindow } from '../utils/productivity';

export interface ImpactInput {
  workspaceId: string;
  triggerTaskId?: string;
  triggerEntityType: 'task' | 'meeting' | 'leave' | 'holiday' | 'dependency' | 'approval';
  triggerAction: 'created' | 'updated' | 'deleted' | 'rescheduled' | 'approved' | 'rejected';
  actorId?: string;
  tasks: Task[];
  dependencies: TaskDependency[];
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

function buildReverseGraph(dependencies: TaskDependency[]): Map<string, string[]> {
  const graph = new Map<string, string[]>();
  for (const dep of dependencies) {
    const dependents = graph.get(dep.depends_on_task_id) || [];
    dependents.push(dep.task_id);
    graph.set(dep.depends_on_task_id, dependents);
  }
  return graph;
}

function buildForwardGraph(dependencies: TaskDependency[]): Map<string, string[]> {
  const graph = new Map<string, string[]>();
  for (const dep of dependencies) {
    const deps = graph.get(dep.task_id) || [];
    deps.push(dep.depends_on_task_id);
    graph.set(dep.task_id, deps);
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
  workspaceId?: string
): Promise<{ eta: string; risk: string; confidence: number }> {
  const params = {
    best: task.pert_best,
    likely: task.pert_likely,
    worst: task.pert_worst,
    estimatedHours: task.estimated_hours,
    startDate: task.start_date ? new Date(task.start_date) : undefined,
    deadline: task.deadline ? new Date(task.deadline) : null,
    workWindow,
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

export async function computeImpact(input: ImpactInput): Promise<ImpactResult> {
  const {
    workspaceId, triggerTaskId, triggerEntityType, triggerAction,
    tasks, dependencies, calendarEvents, workspaceSettings, actorId
  } = input;

  const reverseGraph = buildReverseGraph(dependencies);
  const forwardGraph = buildForwardGraph(dependencies);
  const taskMap = new Map(tasks.map(t => [t.id, t]));

  const workWindow: WorkWindow = {
    workStart: workspaceSettings.workStart,
    workEnd: workspaceSettings.workEnd,
    lunchDuration: workspaceSettings.lunchDuration,
    workingDays: workspaceSettings.workingDays,
    productivityFactor: workspaceSettings.productivityFactor,
    saturdayRule: workspaceSettings.saturdayRule,
    holidays: calendarEvents.filter(e => e.event_type === 'holiday' || e.event_type === 'festival').map(e => e.start_date.split('T')[0]),
    shutdowns: workspaceSettings.shutdowns,
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
  let affectedTaskIds: string[] = [];

  if (triggerTaskId && taskMap.has(triggerTaskId)) {
    visited.add(triggerTaskId);
    affectedTaskIds = findDownstreamTasks(triggerTaskId, reverseGraph, visited);
  } else if (triggerEntityType === 'meeting' || triggerEntityType === 'leave' || triggerEntityType === 'holiday') {
    affectedTaskIds = tasks
      .filter(t => t.status !== 'done' && t.start_date)
      .map(t => t.id);
  } else if (triggerEntityType === 'approval' && triggerTaskId) {
    visited.add(triggerTaskId);
    affectedTaskIds = findDownstreamTasks(triggerTaskId, reverseGraph, visited);
  }

  const affectedEntities: AffectedEntity[] = [];
  let totalCapacityDelta = 0;
  let totalRiskDelta = 0;
  let totalConfidenceDelta = 0;

  for (const taskId of affectedTaskIds) {
    const task = taskMap.get(taskId);
    if (!task || task.status === 'done') continue;

    const originalEta = task.predicted_completion || task.deadline || null;
    const originalRisk = task.risk || 'low';
    const originalConfidence = task.confidence ?? 100;

    const predecessorIds = forwardGraph.get(taskId) || [];
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
      const candidateStart = new Date(latestPredecessorEnd.getTime() + 86400000);
      shiftedStartDate = candidateStart.toISOString().split('T')[0];
    }

    const shiftedTask = shiftedStartDate
      ? { ...task, start_date: shiftedStartDate }
      : task;

    const { eta, risk, confidence } = await recalculateTask(shiftedTask, workWindow, workspaceId);

    const deltaDays = originalEta
      ? Math.round((new Date(eta).getTime() - new Date(originalEta).getTime()) / 86400000)
      : 0;

    if (risk !== originalRisk && (risk === 'high' || originalRisk === 'low')) {
      totalRiskDelta++;
    }

    totalConfidenceDelta += confidence - originalConfidence;
    totalCapacityDelta += Math.max(0, deltaDays) * 8;

    affectedEntities.push({
      taskId,
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
    propagatedFrom: triggerTaskId || null,
    triggerEntityType,
    triggerAction
  };
}

export async function propagateAndPersist(
  input: ImpactInput,
  existingResult?: ImpactResult
): Promise<ImpactResult> {
  const { supabase } = await import('../lib/supabase');
  const { activityLogService } = await import('./activityLogService');
  const { sendNotification } = await import('./notificationService');

  const result = existingResult || await computeImpact(input);

  for (const entity of result.affectedEntities) {
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

      await activityLogService.appendLog({
        workspace_id: input.workspaceId,
        actor_id: input.actorId,
        task_id: entity.taskId,
        action: 'timeline_impact_propagated',
        metadata: {
          trigger_type: input.triggerEntityType,
          trigger_action: input.triggerAction,
          delta_days: entity.deltaDays,
          risk_delta: entity.newRisk !== entity.originalRisk ? `${entity.originalRisk}→${entity.newRisk}` : 'none',
          confidence_delta: entity.newConfidence - entity.originalConfidence,
          propagated_from: input.triggerTaskId
        }
      });

      if (Math.abs(entity.deltaDays) >= 2 || entity.newRisk === 'high') {
        await sendNotification(
          input.workspaceId,
          'risk',
          'Timeline Impact Cascade',
          `"${entity.taskName}" ${entity.deltaDays > 0 ? `delayed +${entity.deltaDays}d` : `accelerated ${entity.deltaDays}d`} due to ${input.triggerEntityType} change`,
          undefined
        );
      }
    }
  }

  if (result.affectedEntities.length > 0) {
    await activityLogService.appendLog({
      workspace_id: input.workspaceId,
      actor_id: input.actorId,
      task_id: input.triggerTaskId,
      action: 'timeline_impact_cascade',
      metadata: {
        trigger_type: input.triggerEntityType,
        trigger_action: input.triggerAction,
        affected_count: result.affectedEntities.length,
        total_eta_delta_days: result.etaDelta,
        capacity_delta_hours: result.capacityDelta,
        risk_delta_count: result.riskDelta,
        avg_confidence_delta: result.confidenceDelta,
        affected_task_ids: result.affectedEntities.map(e => e.taskId)
      }
    });
  }

  return result;
}
