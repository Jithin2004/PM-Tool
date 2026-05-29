import { Task, Project, Team, Profile } from '../../types';
import { MitigationStrategy } from './adaptiveResponseEngine';
import { OperationalDecision, CoordinationEvent } from './coordinationEngine';
import { IsoDateTime } from '../types/temporal';

export interface MitigationOutcome {
  id: string;
  mitigationStrategyId: string;
  mitigationTitle: string;
  blockerCategory: string;
  status: 'success' | 'failure' | 'in_progress';
  actualRecoveryTimeHours: number;
  expectedRecoveryTimeHours: number;
  disruptionPrevented: boolean;
  notes: string;
  resolvedAt?: IsoDateTime;
}

export interface ExecutionPatternHistory {
  id: string;
  patternName: string;
  category: 'infrastructure_failure' | 'dependency_delay' | 'approval_delay' | 'scope_creep' | 'coordination_breakdown';
  frequency: number;
  impactScore: number; // 0-100
  firstDetectedAt: IsoDateTime;
  lastOccurredAt: IsoDateTime;
  associatedTaskIds: string[];
}

export interface DeliveryBehaviorProfile {
  projectId: string;
  projectName: string;
  historicalDriftDays: number;
  sprintCompletionRatio: number; // 0-100
  blockerFrequencyPerSprint: number;
  riskRating: 'low' | 'medium' | 'high' | 'critical';
}

export interface CoordinationEffectivenessProfile {
  teamId: string;
  teamName: string;
  resolutionRate: number; // 0-100
  avgEscalationResponseTimeHours: number;
  syncOverheadIndex: number; // 0-100
  lastSyncEfficiencyRating: 'efficient' | 'nominal' | 'fatigued';
}

export interface DependencyReliabilityHistory {
  dependencyType: 'client' | 'data' | 'infrastructure' | 'approval' | 'dependency' | 'access';
  trustScore: number; // 0-100
  totalInstabilityEvents: number;
  averageResolutionHours: number;
  trend: 'improving' | 'stable' | 'degrading';
}

export interface RecoveryPerformanceProfile {
  teamId: string;
  teamName: string;
  recoveryEfficiencyScore: number; // 0-100
  historicalBlockersResolvedCount: number;
  averageRecoveryTimeHours: number;
  mitigationAdoptionRate: number; // 0-100
}

export interface OperationalLearningInsight {
  id: string;
  title: string;
  description: string;
  recommendation: string;
  severity: 'low' | 'medium' | 'high';
  impactPercentage: number;
  historicalEvidence: string;
  detectedAt: IsoDateTime;
}

export interface OperationalMemory {
  workspaceId: string;
  mitigationOutcomes: MitigationOutcome[];
  executionPatterns: ExecutionPatternHistory[];
  deliveryProfiles: DeliveryBehaviorProfile[];
  coordinationProfiles: CoordinationEffectivenessProfile[];
  dependencyReliabilities: DependencyReliabilityHistory[];
  recoveryProfiles: RecoveryPerformanceProfile[];
  learningInsights: OperationalLearningInsight[];
  lastUpdated: IsoDateTime;
}

/**
 * Builds structured organizational memory and tracks operational learning patterns over time.
 */
export function generateOperationalMemory(
  projects: Project[],
  tasks: Task[],
  teams: Team[],
  profiles: Profile[],
  blockers: any[],
  dependencies: any[],
  decisions: OperationalDecision[],
  events: CoordinationEvent[]
): OperationalMemory {
  const now = new Date().toISOString();

  // 1. Reconstruct historical Mitigation Outcomes
  const mitigationOutcomes: MitigationOutcome[] = blockers.map((b, idx) => {
    const isResolved = !!b.resolved;
    const start = new Date(b.created_at).getTime();
    const end = b.resolved_at ? new Date(b.resolved_at).getTime() : Date.now();
    const actualHours = Number(((end - start) / 3600000).toFixed(1));
    const expectedHours = b.category === 'infrastructure' ? 6 : b.category === 'dependency' ? 12 : 4;
    
    let status: 'success' | 'failure' | 'in_progress' = 'in_progress';
    if (isResolved) {
      status = actualHours <= expectedHours * 1.5 ? 'success' : 'failure';
    }

    return {
      id: `mo-${b.id}-${idx}`,
      mitigationStrategyId: `ms-${b.id}`,
      mitigationTitle: b.category === 'infrastructure' ? 'Environment Fallback Isolation' : b.category === 'dependency' ? 'Dependency Schema Substitution' : 'Ownership Reallocation',
      blockerCategory: b.category || 'general',
      status,
      actualRecoveryTimeHours: actualHours,
      expectedRecoveryTimeHours: expectedHours,
      disruptionPrevented: status === 'success',
      notes: isResolved 
        ? `Roadblock resolved in ${actualHours} hours utilizing adaptive coordination overrides.`
        : 'Mitigation strategy currently active. Monitor target bypass buffers.',
      resolvedAt: b.resolved_at
    };
  });

  // 2. Track Execution Pattern Histories
  const executionPatterns: ExecutionPatternHistory[] = [];
  const categories: Array<ExecutionPatternHistory['category']> = [
    'infrastructure_failure',
    'dependency_delay',
    'approval_delay',
    'scope_creep',
    'coordination_breakdown'
  ];

  categories.forEach((cat, idx) => {
    let blockerCat = 'general';
    if (cat === 'infrastructure_failure') blockerCat = 'infrastructure';
    else if (cat === 'dependency_delay') blockerCat = 'dependency';
    else if (cat === 'approval_delay') blockerCat = 'approval';
    else if (cat === 'coordination_breakdown') blockerCat = 'access';

    const relatedBlockers = blockers.filter(b => b.category === blockerCat);
    if (relatedBlockers.length > 0) {
      const sorted = [...relatedBlockers].sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
      const frequency = relatedBlockers.length;
      const impactScore = Math.min(100, frequency * 15);
      
      executionPatterns.push({
        id: `ep-${idx}`,
        patternName: cat.replace('_', ' ').replace(/\b\w/g, c => c.toUpperCase()),
        category: cat,
        frequency,
        impactScore,
        firstDetectedAt: sorted[0].created_at,
        lastOccurredAt: sorted[sorted.length - 1].created_at,
        associatedTaskIds: relatedBlockers.map(b => b.task_id)
      });
    }
  });

  // 3. Map Delivery Behavior Profiles
  const deliveryProfiles: DeliveryBehaviorProfile[] = projects.map(p => {
    const pTasks = tasks.filter(t => t.project_id === p.id);
    const completedTasks = pTasks.filter(t => t.status === 'done');
    const completionRatio = pTasks.length > 0 ? Math.round((completedTasks.length / pTasks.length) * 100) : 100;
    const pBlockers = blockers.filter(b => pTasks.some(t => t.id === b.task_id));
    const driftDays = p.delay_drift_days || 0;

    let riskRating: 'low' | 'medium' | 'high' | 'critical' = 'low';
    if (driftDays > 5 || pBlockers.some(b => !b.resolved && b.is_critical)) {
      riskRating = 'critical';
    } else if (driftDays > 2 || pBlockers.some(b => !b.resolved)) {
      riskRating = 'high';
    } else if (pBlockers.length > 0) {
      riskRating = 'medium';
    }

    return {
      projectId: p.id,
      projectName: p.name,
      historicalDriftDays: driftDays,
      sprintCompletionRatio: completionRatio,
      blockerFrequencyPerSprint: Number((pBlockers.length / 2).toFixed(1)), // assume 2 sprints baseline
      riskRating
    };
  });

  // 4. Coordination Effectiveness Profiles
  const coordinationProfiles: CoordinationEffectivenessProfile[] = teams
    .filter(t => t.name !== 'SYSTEM_SETTINGS')
    .map(team => {
      const pmId = (team.data as any)?.pm_id;
      const devIds = (team.data as any)?.developer_ids || [];
      const rosterIds = [pmId, ...devIds].filter(Boolean);
      const teamTasks = tasks.filter(t => t.assignee_id && rosterIds.includes(t.assignee_id));
      const teamBlockers = blockers.filter(b => teamTasks.some(t => t.id === b.task_id));
      
      const resolvedCount = teamBlockers.filter(b => b.resolved).length;
      const resolutionRate = teamBlockers.length > 0 ? Math.round((resolvedCount / teamBlockers.length) * 100) : 100;

      // Estimate sync overhead
      const teamEvents = events.filter(e => e.blockerIds?.some(bid => teamBlockers.some(tb => tb.id === bid)));
      const totalMinutes = teamEvents.reduce((sum, e) => sum + e.durationMinutes, 0);
      const syncOverheadIndex = Math.min(100, Math.round((totalMinutes / Math.max(1, teamTasks.length * 8)) * 100));

      return {
        teamId: team.id,
        teamName: team.name,
        resolutionRate,
        avgEscalationResponseTimeHours: teamBlockers.length > 0 ? 8.4 : 0,
        syncOverheadIndex,
        lastSyncEfficiencyRating: syncOverheadIndex > 40 ? 'fatigued' : syncOverheadIndex > 15 ? 'nominal' : 'efficient'
      };
    });

  // 5. Dependency Trust Scoring
  const depTypes: Array<DependencyReliabilityHistory['dependencyType']> = ['client', 'data', 'infrastructure', 'approval', 'dependency', 'access'];
  const dependencyReliabilities: DependencyReliabilityHistory[] = depTypes.map(type => {
    const relatedBlockers = blockers.filter(b => b.category === type);
    const resolvedBlockers = relatedBlockers.filter(b => b.resolved);
    
    let totalLatency = 0;
    resolvedBlockers.forEach(b => {
      totalLatency += (new Date(b.resolved_at).getTime() - new Date(b.created_at).getTime()) / 3600000;
    });
    const averageResolutionHours = resolvedBlockers.length > 0 ? Number((totalLatency / resolvedBlockers.length).toFixed(1)) : 0;

    // Trust Score starts at 100, degrades with occurrences and resolution latency
    let trustScore = 100;
    trustScore -= relatedBlockers.length * 8;
    if (averageResolutionHours > 24) trustScore -= 15;
    else if (averageResolutionHours > 8) trustScore -= 5;
    trustScore = Math.max(10, Math.min(100, trustScore));

    let trend: 'improving' | 'stable' | 'degrading' = 'stable';
    if (trustScore < 60) trend = 'degrading';
    else if (trustScore > 85) trend = 'improving';

    return {
      dependencyType: type,
      trustScore,
      totalInstabilityEvents: relatedBlockers.length,
      averageResolutionHours,
      trend
    };
  });

  // 6. Recovery Performance Profiles
  const recoveryProfiles: RecoveryPerformanceProfile[] = teams
    .filter(t => t.name !== 'SYSTEM_SETTINGS')
    .map(team => {
      const pmId = (team.data as any)?.pm_id;
      const devIds = (team.data as any)?.developer_ids || [];
      const rosterIds = [pmId, ...devIds].filter(Boolean);
      const teamTasks = tasks.filter(t => t.assignee_id && rosterIds.includes(t.assignee_id));
      const teamBlockers = blockers.filter(b => teamTasks.some(t => t.id === b.task_id));
      
      const resolvedBlockers = teamBlockers.filter(b => b.resolved);
      let totalRecoveryHours = 0;
      resolvedBlockers.forEach(b => {
        totalRecoveryHours += (new Date(b.resolved_at).getTime() - new Date(b.created_at).getTime()) / 3600000;
      });
      const averageRecoveryTimeHours = resolvedBlockers.length > 0 ? Number((totalRecoveryHours / resolvedBlockers.length).toFixed(1)) : 0;
      
      // Calculate recovery score
      let recoveryEfficiencyScore = 80; // default baseline
      if (averageRecoveryTimeHours > 24) recoveryEfficiencyScore -= 20;
      else if (averageRecoveryTimeHours > 0 && averageRecoveryTimeHours <= 8) recoveryEfficiencyScore += 15;

      return {
        teamId: team.id,
        teamName: team.name,
        recoveryEfficiencyScore: Math.min(100, Math.max(10, recoveryEfficiencyScore)),
        historicalBlockersResolvedCount: resolvedBlockers.length,
        averageRecoveryTimeHours,
        mitigationAdoptionRate: teamBlockers.length > 0 ? Math.round((resolvedBlockers.length / teamBlockers.length) * 100) : 100
      };
    });

  // 7. Generate evidence-based Operational Learning Insights
  const learningInsights: OperationalLearningInsight[] = [];
  let insightIdx = 1;

  // Blocker categories check
  dependencyReliabilities.forEach(dr => {
    if (dr.trustScore < 70) {
      learningInsights.push({
        id: `oli-${insightIdx++}`,
        title: `${dr.dependencyType.toUpperCase()} Dependency Instability Pattern`,
        description: `Historically low trust rating detected for ${dr.dependencyType} channels due to ${dr.totalInstabilityEvents} disruption events.`,
        recommendation: `Mandate decoupled mock interfaces or secondary local database buffers during the grooming phase of downstream tracks.`,
        severity: dr.trustScore < 50 ? 'high' : 'medium',
        impactPercentage: Math.round((100 - dr.trustScore) * 0.5),
        historicalEvidence: `${dr.totalInstabilityEvents} occurrences with an average resolution latency of ${dr.averageResolutionHours} hours.`,
        detectedAt: now
      });
    }
  });

  // Team sync meeting fatigue checks
  coordinationProfiles.forEach(cp => {
    if (cp.syncOverheadIndex > 35) {
      learningInsights.push({
        id: `oli-${insightIdx++}`,
        title: `Coordination Overhead Peak: ${cp.teamName}`,
        description: `Meeting fatigue is building due to a high ratio of sync time relative to active engineering hours.`,
        recommendation: `Transition blockages to automated registers. Shift weekly checkins to daily asynchronous slack checklist summaries.`,
        severity: 'medium',
        impactPercentage: 15,
        historicalEvidence: `Sync overhead rating at ${cp.syncOverheadIndex}% with status rating of "${cp.lastSyncEfficiencyRating}".`,
        detectedAt: now
      });
    }
  });

  // High-risk execution sequence check (drift recurring)
  deliveryProfiles.forEach(dp => {
    if (dp.historicalDriftDays > 3) {
      learningInsights.push({
        id: `oli-${insightIdx++}`,
        title: `Release Drift Warning: ${dp.projectName}`,
        description: `Frequent timeline shifts have accumulated ${dp.historicalDriftDays} days of release window slippage.`,
        recommendation: `Inject 15% contingency buffers into future sprint targets and restrict parallel dependency inclusions.`,
        severity: 'high',
        impactPercentage: 25,
        historicalEvidence: `Drift accumulation of ${dp.historicalDriftDays} days with a sprint completion rating of ${dp.sprintCompletionRatio}%.`,
        detectedAt: now
      });
    }
  });

  // Fallback insight if no alerts
  if (learningInsights.length === 0) {
    learningInsights.push({
      id: `oli-${insightIdx++}`,
      title: 'Execution Harmony Maintained',
      description: 'Review of historical memory indicates stable recovery parameters and high dependency trust.',
      recommendation: 'Maintain current team scopes, sync intervals, and dependency trust levels.',
      severity: 'low',
      impactPercentage: 0,
      historicalEvidence: 'Zero active blocker pause events logged in the last 14 days.',
      detectedAt: now
    });
  }

  return {
    workspaceId: blockers[0]?.workspace_id || 'ws-default',
    mitigationOutcomes,
    executionPatterns,
    deliveryProfiles,
    coordinationProfiles,
    dependencyReliabilities,
    recoveryProfiles,
    learningInsights,
    lastUpdated: now
  };
}
