import { IsoDateTime } from '../types/temporal';
import { Task, TaskDependency } from '../types/execution';

export interface TimelineCheckpoint {
  id: string;
  timestamp: IsoDateTime;
  type: 'state_change' | 'blocker_added' | 'blocker_resolved' | 'drift_detected' | 'propagation_trigger' | 'decision_made' | 'coordination_sync' | 'escalation_logged' | 'intervention_triggered';
  fieldName?: string;
  oldValue?: string;
  newValue?: string;
  actorName?: string;
  notes?: string;
}

export interface ExecutionWindow {
  start: IsoDateTime;
  end?: IsoDateTime;
  durationHours: number;
  state: string;
}

export interface WaitDuration {
  start: IsoDateTime;
  end?: IsoDateTime;
  durationHours: number;
  reason: string;
  category: 'client' | 'infrastructure' | 'approval' | 'vendor' | 'access' | 'dependency';
  blockedByUserId?: string;
}

export interface OperationalDrift {
  taskId: string;
  taskName: string;
  estimatedDays: number;
  actualActiveDays: number;
  driftDays: number;
  riskLevel: 'low' | 'medium' | 'high';
}

export interface DependencyPropagation {
  id: string;
  upstreamTaskId: string;
  upstreamTaskName: string;
  downstreamTaskId: string;
  downstreamTaskName: string;
  delayDays: number;
  propagationPath: string[];
}

export interface ExecutionFlow {
  taskId: string;
  taskName: string;
  status: string;
  checkpoints: TimelineCheckpoint[];
  windows: ExecutionWindow[];
  waits: WaitDuration[];
  drift: OperationalDrift;
  continuityScore: number; // 0 - 100
  interruptionCount: number;
}

export interface DeliveryTimeline {
  projectId: string;
  projectName: string;
  startedAt?: IsoDateTime;
  targetDeadline?: IsoDateTime;
  estimatedDurationDays: number;
  actualElapsedDays: number;
  totalWaitHours: number;
  totalActiveHours: number;
  driftDays: number;
  flows: ExecutionFlow[];
  propagations: DependencyPropagation[];
}

/**
 * Reconstructs detailed execution flows and timelines from historical logs and blockers.
 */
export function reconstructExecutionFlow(
  task: Task,
  historyLogs: any[],
  blockers: any[],
  substate?: string,
  decisions?: any[],
  events?: any[]
): ExecutionFlow {
  const taskLogs = historyLogs
    .filter(log => log.task_id === task.id)
    .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

  const checkpoints: TimelineCheckpoint[] = [];
  const windows: ExecutionWindow[] = [];
  const waits: WaitDuration[] = [];

  // Seed checkpoints from task history logs
  taskLogs.forEach(log => {
    if (log.field_name === 'status' || log.field_name === 'substate') {
      checkpoints.push({
        id: log.id,
        timestamp: log.timestamp,
        type: 'state_change',
        fieldName: log.field_name,
        oldValue: log.old_value,
        newValue: log.new_value,
        actorName: log.author_name || 'System'
      });
    }
  });

  // Inject active blocker logs if present
  const taskBlockers = blockers.filter(b => b.task_id === task.id);
  taskBlockers.forEach((b, idx) => {
    checkpoints.push({
      id: `blocker-start-${task.id}-${idx}`,
      timestamp: b.created_at,
      type: 'blocker_added',
      notes: b.history?.[0]?.notes || 'Roadblock registered',
      actorName: 'Developer'
    });
    if (b.resolved && b.resolved_at) {
      checkpoints.push({
        id: `blocker-end-${task.id}-${idx}`,
        timestamp: b.resolved_at,
        type: 'blocker_resolved',
        notes: b.history?.[b.history.length - 1]?.notes || 'Roadblock resolved'
      });
    }
  });

  // Inject decisions and events related to task blockers
  const taskBlockerIds = taskBlockers.map(b => b.id);
  if (decisions) {
    decisions.forEach(d => {
      const isRelatedBlocker = d.relatedBlockerIds?.some((bid: string) => taskBlockerIds.includes(bid));
      if (isRelatedBlocker) {
        checkpoints.push({
          id: `decision-${d.id}`,
          timestamp: d.createdAt,
          type: 'decision_made',
          notes: `${d.title}: ${d.rationale}`,
          actorName: `${d.ownerName} (${d.ownerRole})`
        });
        
        if (d.escalationHistory) {
          d.escalationHistory.forEach((esc: any) => {
            checkpoints.push({
              id: `esc-${esc.id}`,
              timestamp: esc.timestamp,
              type: 'escalation_logged',
              notes: `Escalated: ${esc.notes || ''}`,
              actorName: esc.escalatedByName
            });
          });
        }

        if (d.operationalInterventions) {
          d.operationalInterventions.forEach((intv: any) => {
            checkpoints.push({
              id: `intv-${intv.id}`,
              timestamp: intv.timestamp,
              type: 'intervention_triggered',
              notes: `Intervention: ${intv.actionTaken} (Impact: ${intv.impactScore})`,
              actorName: intv.intervenedByName
            });
          });
        }
      }
    });
  }

  if (events) {
    events.forEach(e => {
      const isRelatedBlocker = e.blockerIds?.some((bid: string) => taskBlockerIds.includes(bid));
      if (isRelatedBlocker) {
        checkpoints.push({
          id: `event-${e.id}`,
          timestamp: e.timestamp,
          type: 'coordination_sync',
          notes: `Sync (${e.eventType}): ${e.notes}`,
          actorName: 'Participants: ' + e.participants.join(', ')
        });
      }
    });
  }

  // Sort checkpoints chronologically
  checkpoints.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

  // Track windows and wait durations
  let currentActiveStart: IsoDateTime | null = null;
  let currentWaitStart: IsoDateTime | null = null;
  let currentWaitCategory: any = 'client';
  let currentWaitReason = '';

  // Initial state check
  if (task.created_at) {
    if (task.status === 'in_progress') {
      currentActiveStart = task.created_at;
    } else if (task.status === 'ready') {
      currentWaitStart = task.created_at;
      currentWaitReason = 'Awaiting initial sprint activation';
    }
  }

  checkpoints.forEach(cp => {
    const time = cp.timestamp;
    if (cp.type === 'state_change' && cp.fieldName === 'status') {
      const isNowActive = cp.newValue === 'in_progress';
      const isNowStalled = cp.newValue === 'blocked' || cp.newValue === 'ready';

      if (isNowActive) {
        // Close wait if open
        if (currentWaitStart) {
          const durationHours = Math.max(0.1, (new Date(time).getTime() - new Date(currentWaitStart).getTime()) / 3600000);
          waits.push({
            start: currentWaitStart,
            end: time,
            durationHours: Number(durationHours.toFixed(1)),
            reason: currentWaitReason || 'Waiting in flow state',
            category: currentWaitCategory
          });
          currentWaitStart = null;
        }
        if (!currentActiveStart) {
          currentActiveStart = time;
        }
      } else if (isNowStalled) {
        // Close active if open
        if (currentActiveStart) {
          const durationHours = Math.max(0.1, (new Date(time).getTime() - new Date(currentActiveStart).getTime()) / 3600000);
          windows.push({
            start: currentActiveStart,
            end: time,
            durationHours: Number(durationHours.toFixed(1)),
            state: 'EXECUTING'
          });
          currentActiveStart = null;
        }
        if (!currentWaitStart) {
          currentWaitStart = time;
          currentWaitReason = cp.newValue === 'blocked' ? 'Active roadblock blockage' : 'Triage wait-state';
          currentWaitCategory = cp.newValue === 'blocked' ? 'infrastructure' : 'client';
        }
      }
    } else if (cp.type === 'blocker_added') {
      if (currentActiveStart) {
        const durationHours = Math.max(0.1, (new Date(time).getTime() - new Date(currentActiveStart).getTime()) / 3600000);
        windows.push({
          start: currentActiveStart,
          end: time,
          durationHours: Number(durationHours.toFixed(1)),
          state: 'EXECUTING'
        });
        currentActiveStart = null;
      }
      if (!currentWaitStart) {
        currentWaitStart = time;
        currentWaitReason = cp.notes || 'Roadblock reported';
        currentWaitCategory = 'dependency';
      }
    } else if (cp.type === 'blocker_resolved') {
      if (currentWaitStart) {
        const durationHours = Math.max(0.1, (new Date(time).getTime() - new Date(currentWaitStart).getTime()) / 3600000);
        waits.push({
          start: currentWaitStart,
          end: time,
          durationHours: Number(durationHours.toFixed(1)),
          reason: currentWaitReason,
          category: currentWaitCategory
        });
        currentWaitStart = null;
      }
      if (!currentActiveStart) {
        currentActiveStart = time;
      }
    }
  });

  // Project active states to now if still ongoing
  const nowStr = new Date().toISOString();
  if (currentActiveStart) {
    const durationHours = Math.max(0.1, (Date.now() - new Date(currentActiveStart).getTime()) / 3600000);
    windows.push({
      start: currentActiveStart,
      end: nowStr,
      durationHours: Number(durationHours.toFixed(1)),
      state: 'EXECUTING'
    });
  }
  if (currentWaitStart) {
    const durationHours = Math.max(0.1, (Date.now() - new Date(currentWaitStart).getTime()) / 3600000);
    waits.push({
      start: currentWaitStart,
      end: nowStr,
      durationHours: Number(durationHours.toFixed(1)),
      reason: currentWaitReason || 'Continuous wait-state',
      category: currentWaitCategory
    });
  }

  // Calculate Drift
  const estimatedDays = (task.estimated_hours || 0) / 8;
  const totalActiveHours = windows.reduce((sum, w) => sum + w.durationHours, 0);
  const actualActiveDays = totalActiveHours / 8;
  const driftDays = Math.max(0, Number((actualActiveDays - estimatedDays).toFixed(1)));
  const riskLevel = driftDays > 5 ? 'high' : driftDays > 2 ? 'medium' : 'low';

  const drift: OperationalDrift = {
    taskId: task.id,
    taskName: task.name,
    estimatedDays,
    actualActiveDays: Number(actualActiveDays.toFixed(1)),
    driftDays,
    riskLevel
  };

  // Continuity Indexing
  const interruptionCount = waits.length;
  const totalWaitHours = waits.reduce((sum, w) => sum + w.durationHours, 0);
  
  let continuityScore = 100;
  if (interruptionCount > 0) {
    continuityScore -= interruptionCount * 15;
  }
  const totalHours = totalWaitHours + totalActiveHours;
  if (totalHours > 0) {
    const waitRatio = totalWaitHours / totalHours;
    continuityScore -= waitRatio * 35;
  }
  continuityScore = Math.max(0, Math.min(100, Math.round(continuityScore)));

  return {
    taskId: task.id,
    taskName: task.name,
    status: task.status,
    checkpoints,
    windows,
    waits,
    drift,
    continuityScore,
    interruptionCount
  };
}

/**
 * Builds the canonical DeliveryTimeline for an entire project.
 */
export function reconstructProjectTimeline(
  projectId: string,
  projectName: string,
  projectTasks: Task[],
  dependencies: TaskDependency[],
  historyLogs: any[],
  blockers: any[],
  taskSubstates: Record<string, string>,
  decisions?: any[],
  events?: any[]
): DeliveryTimeline {
  const flows = projectTasks.map(t =>
    reconstructExecutionFlow(t, historyLogs, blockers, taskSubstates[t.id], decisions, events)
  );

  const totalWaitHours = flows.reduce((sum, f) => sum + f.waits.reduce((s, w) => s + w.durationHours, 0), 0);
  const totalActiveHours = flows.reduce((sum, f) => sum + f.windows.reduce((s, w) => s + w.durationHours, 0), 0);

  // Calculate Dependency Propagations
  const propagations: DependencyPropagation[] = [];
  
  dependencies.forEach((d, idx) => {
    const upstream = projectTasks.find(t => t.id === d.depends_on_task_id);
    const downstream = projectTasks.find(t => t.id === d.task_id);

    if (upstream && downstream) {
      const upstreamFlow = flows.find(f => f.taskId === upstream.id);
      const upstreamDrift = upstreamFlow?.drift.driftDays || 0;

      if (upstreamDrift > 0) {
        propagations.push({
          id: `prop-${upstream.id}-${downstream.id}-${idx}`,
          upstreamTaskId: upstream.id,
          upstreamTaskName: upstream.name,
          downstreamTaskId: downstream.id,
          downstreamTaskName: downstream.name,
          delayDays: upstreamDrift,
          propagationPath: [upstream.name, downstream.name]
        });
      }
    }
  });

  const earliestStart = projectTasks.reduce((earliest: string | undefined, t) => {
    if (!t.created_at) return earliest;
    if (!earliest) return t.created_at;
    return new Date(t.created_at).getTime() < new Date(earliest).getTime() ? t.created_at : earliest;
  }, undefined);

  const accumulatedDrift = flows.reduce((sum, f) => sum + f.drift.driftDays, 0);

  return {
    projectId,
    projectName,
    startedAt: earliestStart,
    targetDeadline: projectTasks.reduce((latest: string | undefined, t) => {
      if (!t.deadline) return latest;
      if (!latest) return t.deadline;
      return new Date(t.deadline).getTime() > new Date(latest).getTime() ? t.deadline : latest;
    }, undefined),
    estimatedDurationDays: flows.reduce((sum, f) => sum + f.drift.estimatedDays, 0),
    actualElapsedDays: Number(((totalActiveHours + totalWaitHours) / 8).toFixed(1)),
    totalWaitHours: Number(totalWaitHours.toFixed(1)),
    totalActiveHours: Number(totalActiveHours.toFixed(1)),
    driftDays: Number(accumulatedDrift.toFixed(1)),
    flows,
    propagations
  };
}
