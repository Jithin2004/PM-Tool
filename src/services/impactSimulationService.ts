import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { sha256 } from '../utils/cryptoUtils';
import { computeImpact, type ImpactInput, type ImpactResult, type AffectedEntity } from './timelineImpactEngine';
import { activityLogService } from './activityLogService';
import { aiRecommendationService } from './aiRecommendationService';
import type { Task, TaskDependency } from '../types';

export interface AIMitigation {
  type: 'split_task' | 'reassign' | 'increase_capacity' | 'move_milestone' | 'reduce_scope' | 'compress_timeline';
  label: string;
  description: string;
  predictedEtaImprovement: number;
  riskDelta: number;
  confidenceDelta: number;
  status: 'pending' | 'accepted' | 'rejected';
}

export type SimulationStatus = 'pending' | 'accepted' | 'dismissed' | 'expired';
export type SimulationSeverity = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';

export interface ImpactSimulation {
  id: string;
  workspace_id: string;
  trigger_type: string;
  trigger_id: string | null;
  trigger_fingerprint: string | null;
  affected_entities: AffectedEntity[];
  eta_delta: number;
  risk_delta: number;
  confidence_delta: number;
  capacity_delta: number;
  release_delta: number;
  mitigations: AIMitigation[];
  severity: SimulationSeverity;
  status: SimulationStatus;
  stale: boolean;
  stale_reason?: string;
  trigger_snapshot?: Record<string, any>;
  created_by: string | null;
  created_at: string;
  expires_at: string;
}

interface SimulationRow {
  id: string;
  workspace_id: string;
  trigger_type: string;
  trigger_id: string | null;
  trigger_fingerprint: string | null;
  affected_entities: any;
  eta_delta: number;
  risk_delta: number;
  confidence_delta: number;
  capacity_delta: number;
  release_delta: number;
  mitigations: any;
  severity: string;
  status: string;
  stale: boolean;
  stale_reason?: string;
  trigger_snapshot?: any;
  created_by: string | null;
  created_at: string;
  expires_at: string;
}

function rowToSimulation(row: SimulationRow): ImpactSimulation {
  return {
    id: row.id,
    workspace_id: row.workspace_id,
    trigger_type: row.trigger_type,
    trigger_id: row.trigger_id,
    trigger_fingerprint: row.trigger_fingerprint,
    affected_entities: (row.affected_entities || []) as AffectedEntity[],
    eta_delta: Number(row.eta_delta),
    risk_delta: Number(row.risk_delta),
    confidence_delta: Number(row.confidence_delta),
    capacity_delta: Number(row.capacity_delta),
    release_delta: Number(row.release_delta),
    mitigations: (row.mitigations || []) as AIMitigation[],
    severity: row.severity as SimulationSeverity,
    status: row.status as SimulationStatus,
    stale: row.stale,
    stale_reason: row.stale_reason,
    trigger_snapshot: row.trigger_snapshot,
    created_by: row.created_by,
    created_at: row.created_at,
    expires_at: row.expires_at
  };
}

function computeSeverity(releaseDelta: number, result: ImpactResult): SimulationSeverity {
  if (releaseDelta > 14 || result.riskDelta > 3) return 'CRITICAL';
  if (releaseDelta > 7 || result.riskDelta > 0) return 'HIGH';
  if (result.etaDelta > 0) return 'MEDIUM';
  return 'LOW';
}

function computeReleaseDelta(entities: AffectedEntity[]): number {
  return entities.reduce((max, e) => Math.max(max, e.deltaDays), 0);
}

async function computeTriggerFingerprint(
  triggerTaskId: string | undefined,
  tasks: Task[],
  dependencies: TaskDependency[]
): Promise<string> {
  if (!triggerTaskId) return 'none';
  const task = tasks.find(t => t.id === triggerTaskId);
  if (!task) return 'none';
  const taskDeps = dependencies
    .filter(d => d.task_id === triggerTaskId || d.depends_on_task_id === triggerTaskId)
    .map(d => `${d.task_id}:${d.depends_on_task_id}`)
    .sort()
    .join(',');
  const raw = `${task.id}|${task.status}|${task.start_date || ''}|${task.deadline || ''}|${task.estimated_hours || 0}|${task.pert_best || 0}|${task.pert_likely || 0}|${task.pert_worst || 0}|${task.predicted_completion || ''}|${task.confidence ?? 100}|${task.risk || 'low'}|${task.delay_drift_days || 0}|${task.updated_at || ''}|${taskDeps}`;
  return sha256(raw);
}

function generateMitigationOptions(result: ImpactResult): AIMitigation[] {
  const options: AIMitigation[] = [];
  const hasDelay = result.etaDelta > 0;
  const hasRisk = result.riskDelta > 0;

  if (hasDelay) {
    options.push({
      type: 'split_task',
      label: 'Split largest task',
      description: 'Break the most delayed task into parallel subtasks',
      predictedEtaImprovement: Math.min(result.etaDelta, 3),
      riskDelta: -1,
      confidenceDelta: 5,
      status: 'pending'
    });
    options.push({
      type: 'move_milestone',
      label: 'Move milestone',
      description: `Shift milestone by +${result.etaDelta}d to reflect actual timeline`,
      predictedEtaImprovement: 0,
      riskDelta: 0,
      confidenceDelta: 10,
      status: 'pending'
    });
  }

  if (hasRisk) {
    options.push({
      type: 'reassign',
      label: 'Reassign high-risk tasks',
      description: `Move ${result.riskDelta} high-risk task(s) to available senior developer`,
      predictedEtaImprovement: 2,
      riskDelta: -result.riskDelta,
      confidenceDelta: 10,
      status: 'pending'
    });
    options.push({
      type: 'increase_capacity',
      label: 'Increase team capacity',
      description: 'Add one developer to the affected delivery track',
      predictedEtaImprovement: Math.min(result.etaDelta, 4),
      riskDelta: -1,
      confidenceDelta: 8,
      status: 'pending'
    });
  }

  options.push({
    type: 'reduce_scope',
    label: 'Reduce sprint scope',
    description: `Move ${Math.ceil(result.affectedEntities.length * 0.2)} non-critical task(s) to next sprint`,
    predictedEtaImprovement: Math.min(result.etaDelta, 5),
    riskDelta: -Math.min(result.riskDelta, 1),
    confidenceDelta: 15,
    status: 'pending'
  });

  options.push({
    type: 'compress_timeline',
    label: 'Compress timeline',
    description: 'Increase daily productivity factor from 0.8 to 0.95 for 2 weeks',
    predictedEtaImprovement: Math.min(result.etaDelta, 2),
    riskDelta: 1,
    confidenceDelta: -5,
    status: 'pending'
  });

  return options;
}

export const impactSimulationService = {
  async generateSimulation(
    input: ImpactInput,
    staleAfterHours: number = 24
  ): Promise<ImpactSimulation | null> {
    if (!isSupabaseConfigured) return null;

    const result = await computeImpact(input);

    if (result.affectedEntities.length === 0) return null;

    const releaseDelta = computeReleaseDelta(result.affectedEntities);
    const severity = computeSeverity(releaseDelta, result);
    const mitigations = generateMitigationOptions(result);
    const fingerprint = await computeTriggerFingerprint(input.triggerTaskId, input.tasks, input.dependencies);

    const expiresAt = new Date(Date.now() + staleAfterHours * 3600000).toISOString();

    const triggerTask = input.triggerTaskId
      ? input.tasks.find(t => t.id === input.triggerTaskId)
      : null;
    const triggerSnapshot = triggerTask
      ? {
          status: triggerTask.status,
          start_date: triggerTask.start_date,
          deadline: triggerTask.deadline,
          estimated_hours: triggerTask.estimated_hours,
          pert_best: triggerTask.pert_best,
          pert_likely: triggerTask.pert_likely,
          pert_worst: triggerTask.pert_worst,
          predicted_completion: triggerTask.predicted_completion,
          confidence: triggerTask.confidence,
          risk: triggerTask.risk,
          delay_drift_days: triggerTask.delay_drift_days
        }
      : null;

    const { data, error } = await supabase
      .from('impact_simulations')
      .insert({
        workspace_id: input.workspaceId,
        trigger_type: result.triggerEntityType,
        trigger_id: input.triggerTaskId || null,
        trigger_fingerprint: fingerprint,
        trigger_snapshot: triggerSnapshot ? JSON.stringify(triggerSnapshot) : null,
        affected_entities: JSON.stringify(result.affectedEntities),
        eta_delta: result.etaDelta,
        risk_delta: result.riskDelta,
        confidence_delta: result.confidenceDelta,
        capacity_delta: result.capacityDelta,
        release_delta: releaseDelta,
        mitigations: JSON.stringify(mitigations),
        severity,
        status: 'pending',
        stale: false,
        created_by: input.actorId || null,
        expires_at: expiresAt
      })
      .select()
      .single();

    if (error) {
      console.error('impactSimulationService.generateSimulation:', error);
      return null;
    }

    await activityLogService.appendLog({
      workspace_id: input.workspaceId,
      actor_id: input.actorId,
      task_id: input.triggerTaskId,
      action: 'impact_simulation_generated',
      metadata: {
        simulation_id: (data as SimulationRow).id,
        trigger_type: result.triggerEntityType,
        trigger_action: result.triggerAction,
        affected_count: result.affectedEntities.length,
        eta_delta: result.etaDelta,
        risk_delta: result.riskDelta,
        confidence_delta: result.confidenceDelta,
        capacity_delta: result.capacityDelta,
        release_delta: releaseDelta,
        severity,
        propagated_from: result.propagatedFrom
      }
    });

    return rowToSimulation(data as SimulationRow);
  },

  async applySimulation(
    simulationId: string,
    actorId?: string
  ): Promise<boolean> {
    if (!isSupabaseConfigured) return false;

    const { data: row, error: fetchError } = await supabase
      .from('impact_simulations')
      .select('*')
      .eq('id', simulationId)
      .single();

    if (fetchError || !row) {
      console.error('impactSimulationService.applySimulation: not found', fetchError);
      return false;
    }

    const simulation = rowToSimulation(row as SimulationRow);

    if (simulation.status !== 'pending') return false;
    if (simulation.stale) return false;
    if (new Date(simulation.expires_at) < new Date()) {
      await this.expireSimulation(simulationId, actorId);
      return false;
    }

    const { propagateAndPersist } = await import('./timelineImpactEngine');
    const result: ImpactResult = {
      affectedEntities: simulation.affected_entities,
      capacityDelta: simulation.capacity_delta,
      etaDelta: simulation.eta_delta,
      riskDelta: simulation.risk_delta,
      confidenceDelta: simulation.confidence_delta,
      propagatedFrom: simulation.trigger_id,
      triggerEntityType: simulation.trigger_type,
      triggerAction: 'rescheduled'
    };

    const input: ImpactInput = {
      workspaceId: simulation.workspace_id,
      triggerTaskId: simulation.trigger_id || undefined,
      triggerEntityType: simulation.trigger_type as ImpactInput['triggerEntityType'],
      triggerAction: 'rescheduled',
      actorId,
      tasks: [],
      dependencies: [],
      calendarEvents: [],
      workspaceSettings: {} as any
    };

    const persisted = await propagateAndPersist(input, result);
    if (persisted.affectedEntities.length === 0) return false;

    const { error: updateError } = await supabase
      .from('impact_simulations')
      .update({ status: 'accepted', stale: true })
      .eq('id', simulationId);

    if (updateError) console.error('impactSimulationService.applySimulation: status update failed', updateError);

    await activityLogService.appendLog({
      workspace_id: simulation.workspace_id,
      actor_id: actorId,
      task_id: simulation.trigger_id || undefined,
      action: 'impact_simulation_accepted',
      metadata: {
        simulation_id: simulationId,
        trigger_type: simulation.trigger_type,
        affected_count: result.affectedEntities.length,
        eta_delta: result.etaDelta,
        risk_delta: result.riskDelta,
        confidence_delta: result.confidenceDelta,
        capacity_delta: result.capacityDelta
      }
    });

    return true;
  },

  async dismissSimulation(simulationId: string, actorId?: string): Promise<boolean> {
    if (!isSupabaseConfigured) return false;

    const { data: sim } = await supabase
      .from('impact_simulations')
      .select('workspace_id')
      .eq('id', simulationId)
      .single();

    const { error } = await supabase
      .from('impact_simulations')
      .update({ status: 'dismissed', stale: true })
      .eq('id', simulationId)
      .eq('status', 'pending');

    if (error) {
      console.error('impactSimulationService.dismissSimulation:', error);
      return false;
    }

    if (sim) {
      await activityLogService.appendLog({
        workspace_id: (sim as any).workspace_id,
        actor_id: actorId,
        action: 'impact_simulation_rejected',
        metadata: { simulation_id: simulationId }
      });
    }

    return true;
  },

  async expireSimulation(simulationId: string, actorId?: string): Promise<boolean> {
    if (!isSupabaseConfigured) return false;

    const { data: sim } = await supabase
      .from('impact_simulations')
      .select('workspace_id')
      .eq('id', simulationId)
      .single();

    const { error } = await supabase
      .from('impact_simulations')
      .update({ status: 'expired', stale: true })
      .eq('id', simulationId);

    if (error) {
      console.error('impactSimulationService.expireSimulation:', error);
      return false;
    }

    if (sim) {
      await activityLogService.appendLog({
        workspace_id: (sim as any).workspace_id,
        actor_id: actorId,
        action: 'impact_simulation_expired',
        metadata: { simulation_id: simulationId }
      });
    }

    return true;
  },

  async applyMitigation(
    simulationId: string,
    mitigationType: AIMitigation['type'],
    actorId?: string
  ): Promise<boolean> {
    if (!isSupabaseConfigured) return false;

    const { data: row, error: fetchError } = await supabase
      .from('impact_simulations')
      .select('mitigations, workspace_id, trigger_id')
      .eq('id', simulationId)
      .single();

    if (fetchError || !row) return false;

    const mitigations: AIMitigation[] = (row.mitigations || []) as AIMitigation[];
    const mitigation = mitigations.find(m => m.type === mitigationType);
    if (!mitigation) return false;

    mitigation.status = 'accepted';

    const { error: updateError } = await supabase
      .from('impact_simulations')
      .update({ mitigations: JSON.stringify(mitigations) })
      .eq('id', simulationId);

    if (updateError) {
      console.error('impactSimulationService.applyMitigation:', updateError);
      return false;
    }

    const workspaceId = (row as any).workspace_id;

    await activityLogService.appendLog({
      workspace_id: workspaceId,
      actor_id: actorId,
      action: 'mitigation_applied',
      metadata: {
        simulation_id: simulationId,
        mitigation_type: mitigationType,
        mitigation_label: mitigation.label,
        predicted_eta_improvement: mitigation.predictedEtaImprovement,
        risk_delta: mitigation.riskDelta,
        confidence_delta: mitigation.confidenceDelta
      }
    });

    await aiRecommendationService.createRecommendation({
      workspace_id: workspaceId,
      recommendation_type: mitigationType,
      task_id: (row as any).trigger_id || undefined,
      predicted_eta_improvement: mitigation.predictedEtaImprovement,
      risk_delta: mitigation.riskDelta,
      confidence_delta: mitigation.confidenceDelta
    });

    return true;
  },

  async markStale(simulationId: string, reason?: string): Promise<boolean> {
    if (!isSupabaseConfigured) return false;
    const updates: Record<string, any> = { stale: true };
    if (reason) updates.stale_reason = reason;
    const { error } = await supabase
      .from('impact_simulations')
      .update(updates)
      .eq('id', simulationId);
    return !error;
  },

  async getSimulation(id: string): Promise<ImpactSimulation | null> {
    if (!isSupabaseConfigured) return null;
    const { data, error } = await supabase
      .from('impact_simulations')
      .select('*')
      .eq('id', id)
      .single();
    if (error || !data) return null;
    return rowToSimulation(data as SimulationRow);
  },

  async getActiveSimulations(workspaceId: string): Promise<ImpactSimulation[]> {
    if (!isSupabaseConfigured) return [];
    const { data, error } = await supabase
      .from('impact_simulations')
      .select('*')
      .eq('workspace_id', workspaceId)
      .eq('status', 'pending')
      .eq('stale', false)
      .gte('expires_at', new Date().toISOString())
      .order('created_at', { ascending: false });
    if (error || !data) return [];
    return (data as SimulationRow[]).map(rowToSimulation);
  },

  async isSimulationStale(
    simulationId: string,
    tasks: Task[],
    dependencies: TaskDependency[]
  ): Promise<boolean> {
    const sim = await this.getSimulation(simulationId);
    if (!sim || !sim.trigger_id) return false;
    const currentFingerprint = await computeTriggerFingerprint(sim.trigger_id, tasks, dependencies);
    return currentFingerprint !== sim.trigger_fingerprint;
  },

  async reuseOrRegenerate(
    input: ImpactInput,
    staleAfterHours: number = 24
  ): Promise<ImpactSimulation | null> {
    const { data: existing } = await supabase
      .from('impact_simulations')
      .select('*')
      .eq('workspace_id', input.workspaceId)
      .eq('trigger_type', input.triggerEntityType)
      .eq('trigger_id', input.triggerTaskId || '')
      .eq('status', 'pending')
      .eq('stale', false)
      .gte('expires_at', new Date().toISOString())
      .order('created_at', { ascending: false })
      .limit(1);

    if (existing && existing.length > 0) {
      const sim = rowToSimulation(existing[0] as SimulationRow);
      const currentFingerprint = await computeTriggerFingerprint(input.triggerTaskId, input.tasks, input.dependencies);
      if (currentFingerprint === sim.trigger_fingerprint) {
        return sim;
      }
      const staleReason = this.computeStaleReason(sim, input);
      await this.markStale(sim.id, staleReason);
    }

    return this.generateSimulation(input, staleAfterHours);
  },

  computeStaleReason(sim: ImpactSimulation, input: ImpactInput): string {
    if (!input.triggerTaskId) return 'Trigger task no longer available';
    const currentTask = input.tasks.find(t => t.id === input.triggerTaskId);
    if (!currentTask) return 'Trigger task deleted';

    const snapshot = (sim as any).trigger_snapshot as Record<string, any> | null;
    if (!snapshot) return 'No previous snapshot available';

    const changedFields: string[] = [];
    const trackedFields: Array<{ key: string; label: string }> = [
      { key: 'status', label: 'Status' },
      { key: 'start_date', label: 'Start date' },
      { key: 'deadline', label: 'Deadline' },
      { key: 'estimated_hours', label: 'Estimated hours' },
      { key: 'pert_best', label: 'PERT best' },
      { key: 'pert_likely', label: 'PERT likely' },
      { key: 'pert_worst', label: 'PERT worst' },
      { key: 'predicted_completion', label: 'Predicted completion' },
      { key: 'confidence', label: 'Confidence' },
      { key: 'risk', label: 'Risk' },
      { key: 'delay_drift_days', label: 'Delay drift' }
    ];

    for (const field of trackedFields) {
      const oldVal = snapshot[field.key];
      const newVal = (currentTask as any)[field.key];
      if (String(oldVal ?? '') !== String(newVal ?? '')) {
        changedFields.push(`${field.label}: ${oldVal ?? 'none'} → ${newVal ?? 'none'}`);
      }
    }

    if (changedFields.length === 0) return 'Fingerprint mismatch (dependency change)';
    return changedFields.join('; ');
  }
};
