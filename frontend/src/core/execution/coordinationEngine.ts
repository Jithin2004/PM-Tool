import { IsoDateTime } from '../types/temporal';

export interface ApprovalChain {
  id: string;
  steps: {
    role: 'pm' | 'developer' | 'super_admin' | 'viewer';
    approverId?: string;
    approverName?: string;
    status: 'pending' | 'approved' | 'rejected';
    timestamp?: IsoDateTime;
    notes?: string;
  }[];
  currentStepIndex: number;
}

export interface EscalationFlow {
  id: string;
  escalatedById: string;
  escalatedByName: string;
  escalatedToRole: 'pm' | 'super_admin';
  timestamp: IsoDateTime;
  status: 'active' | 'resolved';
  notes?: string;
  resolvedAt?: IsoDateTime;
}

export interface MitigationAction {
  id: string;
  ownerId: string;
  ownerName: string;
  description: string;
  expectedResolution: IsoDateTime;
  actualResolution?: IsoDateTime;
  status: 'identified' | 'in_progress' | 'completed' | 'failed';
}

export interface OwnershipTransition {
  id: string;
  taskId: string;
  previousOwnerId: string;
  previousOwnerName: string;
  newOwnerId: string;
  newOwnerName: string;
  reason: string;
  timestamp: IsoDateTime;
}

export interface ReleaseDecision {
  id: string;
  version: string;
  status: 'pending' | 'approved' | 'rejected' | 'deployed';
  releasedAt?: IsoDateTime;
  approvedById?: string;
  approvedByName?: string;
  infrastructureStatus: 'pending' | 'passed' | 'failed';
  qaVerificationStatus: 'pending' | 'passed' | 'failed';
  releaseWindow: string; // e.g. UTC Sun 02:00
}

export interface OperationalIntervention {
  id: string;
  intervenedById: string;
  intervenedByName: string;
  actionTaken: string;
  impactScore: number; // -10 to +10
  timestamp: IsoDateTime;
  rationale: string;
}

export interface OperationalDecision {
  id: string;
  workspaceId: string;
  title: string;
  type: 'design_change' | 'scope_adjustment' | 'timeline_recalibration' | 'resource_reallocation' | 'escalation_resolution' | 'infra_approval' | 'release_authorization';
  ownerId: string;
  ownerName: string;
  ownerRole: string;
  affectedProjectIds: string[];
  affectedExecutionStreamIds?: string[];
  relatedBlockerIds?: string[];
  relatedDependencyIds?: string[];
  rationale: string;
  approvalStatus: 'draft' | 'pending_approval' | 'approved' | 'rejected' | 'escalated';
  approvalChain?: ApprovalChain;
  escalationHistory?: EscalationFlow[];
  mitigationActions?: MitigationAction[];
  ownershipTransitions?: OwnershipTransition[];
  releaseDecisions?: ReleaseDecision[];
  operationalInterventions?: OperationalIntervention[];
  notes?: string;
  createdAt: IsoDateTime;
  updatedAt: IsoDateTime;
  participants: string[]; // usernames/emails
  downstreamImpactDesc?: string;
}

export interface CoordinationEvent {
  id: string;
  workspaceId: string;
  title: string;
  eventType: 'triage' | 'escalation' | 'approval_review' | 'mitigation_sync' | 'release_gate' | 'intervention';
  timestamp: IsoDateTime;
  durationMinutes: number;
  participants: string[];
  decisionIds: string[];
  blockerIds: string[];
  notes: string;
  latencyHours?: number; // latency from blocker created to coordination meeting
  operationalOutcome: string;
}

export interface CoordinationAnalytics {
  coordinationOverheadMinutes: number;
  averageApprovalLatencyHours: number;
  escalationFrequencyRatio: number;
  mitigationEffectivenessRatio: number;
  ownershipChurnCount: number;
  releaseCoordinationComplexityScore: number;
  averageInterventionImpact: number;
}

/**
 * Computes analytics from coordination datasets.
 */
export function calculateCoordinationAnalytics(
  decisions: OperationalDecision[],
  events: CoordinationEvent[],
  blockerCount: number
): CoordinationAnalytics {
  const coordinationOverheadMinutes = events.reduce((sum, e) => sum + e.durationMinutes, 0);

  // Average approval latency in hours
  let totalLatency = 0;
  let approvalCount = 0;
  decisions.forEach(d => {
    if (d.approvalChain?.steps) {
      d.approvalChain.steps.forEach(step => {
        if (step.timestamp) {
          const latency = (new Date(step.timestamp).getTime() - new Date(d.createdAt).getTime()) / 3600000;
          totalLatency += Math.max(0.1, latency);
          approvalCount++;
        }
      });
    }
  });
  const averageApprovalLatencyHours = approvalCount > 0 ? Number((totalLatency / approvalCount).toFixed(1)) : 0;

  // Escalation Frequency
  const escalatedCount = decisions.filter(d => d.approvalStatus === 'escalated' || (d.escalationHistory && d.escalationHistory.length > 0)).length;
  const escalationFrequencyRatio = blockerCount > 0 ? Number((escalatedCount / blockerCount).toFixed(2)) : 0;

  // Mitigation Effectiveness
  let totalMitigations = 0;
  let completedMitigations = 0;
  decisions.forEach(d => {
    if (d.mitigationActions) {
      d.mitigationActions.forEach(m => {
        totalMitigations++;
        if (m.status === 'completed') {
          completedMitigations++;
        }
      });
    }
  });
  const mitigationEffectivenessRatio = totalMitigations > 0 ? Number((completedMitigations / totalMitigations).toFixed(2)) : 1.0;

  // Ownership Churn
  let ownershipChurnCount = 0;
  decisions.forEach(d => {
    if (d.ownershipTransitions) {
      ownershipChurnCount += d.ownershipTransitions.length;
    }
  });

  // Release Coordination Complexity (based on release window, verification checks, status)
  let totalReleaseChecks = 0;
  let failedReleaseChecks = 0;
  decisions.forEach(d => {
    if (d.releaseDecisions) {
      d.releaseDecisions.forEach(r => {
        totalReleaseChecks += 2; // QA & Infra
        if (r.infrastructureStatus === 'failed') failedReleaseChecks++;
        if (r.qaVerificationStatus === 'failed') failedReleaseChecks++;
      });
    }
  });
  const releaseCoordinationComplexityScore = totalReleaseChecks > 0 ? Math.round((failedReleaseChecks / totalReleaseChecks) * 100) : 0;

  // Average Intervention Impact
  let totalImpact = 0;
  let interventionCount = 0;
  decisions.forEach(d => {
    if (d.operationalInterventions) {
      d.operationalInterventions.forEach(i => {
        totalImpact += i.impactScore;
        interventionCount++;
      });
    }
  });
  const averageInterventionImpact = interventionCount > 0 ? Number((totalImpact / interventionCount).toFixed(1)) : 0;

  return {
    coordinationOverheadMinutes,
    averageApprovalLatencyHours,
    escalationFrequencyRatio,
    mitigationEffectivenessRatio,
    ownershipChurnCount,
    releaseCoordinationComplexityScore,
    averageInterventionImpact
  };
}
