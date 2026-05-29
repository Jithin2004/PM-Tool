import { Task, Project, Team, Profile } from '../../types';
import { OperationalDecision, CoordinationEvent } from './coordinationEngine';
import { IsoDateTime } from '../types/temporal';

export interface DependencyInstability {
  dependencyType: string;
  failureRate: number; // percentage of blockers in this category
  averageLatencyHours: number;
  totalDelaysCount: number;
}

export interface CoordinationInefficiency {
  streamName: string;
  meetingFrequencyCount: number;
  totalCoordinationMinutes: number;
  overheadRatio: number; // minutes spent in coordination / active execution hours
}

export interface ApprovalBottleneck {
  role: string;
  averageLatencyHours: number;
  slowdownFactor: number;
  pendingApprovalsCount: number;
}

export interface InfrastructureReliabilityTrend {
  area: string;
  instabilityFrequency: number;
  totalDowntimeHours: number;
  trend: 'improving' | 'stable' | 'worsening';
}

export interface ExecutionReliabilityProfile {
  teamId: string;
  teamName: string;
  deliveryReliabilityScore: number; // 0 - 100
  activeDriftDays: number;
  blockerPauseFrequency: number; // average pauses per task
  infrastructureFailuresCount: number;
  continuityStabilityIndex: number; // 0 - 100
}

export interface DeliveryRiskTrend {
  date: string;
  riskScore: number;
  activeBlockersCount: number;
  driftDaysCount: number;
}

export interface OperationalPattern {
  id: string;
  title: string;
  patternType: 'bottleneck' | 'inefficiency' | 'instability' | 'drift' | 'success';
  description: string;
  severity: 'low' | 'medium' | 'high';
  recommendation: string;
  affectedStreamsCount: number;
}

export interface OrganizationalInsight {
  id: string;
  category: 'systemic_bottleneck' | 'dependency_instability' | 'coordination_overhead' | 'infrastructure_reliability' | 'approval_flow';
  title: string;
  details: string;
  impactScore: number; // -10 to +10
  actionPlan: string;
  timestamp: IsoDateTime;
}

export interface OrganizationalIntelligence {
  insights: OrganizationalInsight[];
  patterns: OperationalPattern[];
  riskTrends: DeliveryRiskTrend[];
  dependencyInstabilities: DependencyInstability[];
  coordinationInefficiencies: CoordinationInefficiency[];
  approvalBottlenecks: ApprovalBottleneck[];
  infraReliability: InfrastructureReliabilityTrend[];
  teamProfiles: ExecutionReliabilityProfile[];
}

/**
 * Reconstructs global organizational intelligence analytics from cross-project/cross-team data.
 */
export function calculateOrganizationalIntelligence(
  projects: Project[],
  tasks: Task[],
  teams: Team[],
  decisions: OperationalDecision[],
  events: CoordinationEvent[],
  blockers: any[]
): OrganizationalIntelligence {
  // 1. Calculate Team Execution Reliability Profiles
  const teamProfiles: ExecutionReliabilityProfile[] = teams
    .filter(t => t.name !== 'SYSTEM_SETTINGS')
    .map(team => {
      const pmId = (team.data as any)?.pm_id;
      const devIds = (team.data as any)?.developer_ids || [];
      const allRosterIds = [pmId, ...devIds].filter(Boolean);

      // Filter tasks assigned to team members
      const teamTasks = tasks.filter(t => t.assignee_id && allRosterIds.includes(t.assignee_id));
      
      let deliveryReliabilityScore = 85; // baseline
      let activeDriftDays = 0;

      teamTasks.forEach(task => {
        if (task.status === 'done') {
          deliveryReliabilityScore += 1;
        } else {
          deliveryReliabilityScore -= 2;
        }
      });
      deliveryReliabilityScore = Math.max(30, Math.min(100, deliveryReliabilityScore));

      const teamBlockers = blockers.filter(b => teamTasks.some(t => t.id === b.task_id));
      const infrastructureFailuresCount = teamBlockers.filter(b => b.category === 'infrastructure').length;
      const blockerPauseFrequency = teamTasks.length > 0 ? Number((teamBlockers.length / teamTasks.length).toFixed(1)) : 0;

      let continuityStabilityIndex = 100;
      if (teamBlockers.length > 0) {
        continuityStabilityIndex -= teamBlockers.length * 12;
      }
      continuityStabilityIndex = Math.max(20, Math.min(100, continuityStabilityIndex));

      return {
        teamId: team.id,
        teamName: team.name,
        deliveryReliabilityScore,
        activeDriftDays: Number(activeDriftDays.toFixed(1)),
        blockerPauseFrequency,
        infrastructureFailuresCount,
        continuityStabilityIndex
      };
    });

  // 2. Calculate Dependency Instabilities
  const dependencyInstabilities: DependencyInstability[] = ['client', 'data', 'infrastructure', 'approval', 'dependency', 'access']
    .map(cat => {
      const catBlockers = blockers.filter(b => b.category === cat);
      const totalDelaysCount = catBlockers.length;
      const failureRate = blockers.length > 0 ? Math.round((totalDelaysCount / blockers.length) * 100) : 0;

      let totalLatencyMs = 0;
      catBlockers.forEach(b => {
        const start = new Date(b.created_at).getTime();
        const end = b.resolved_at ? new Date(b.resolved_at).getTime() : Date.now();
        totalLatencyMs += (end - start);
      });
      const averageLatencyHours = totalDelaysCount > 0 ? Number((totalLatencyMs / (totalDelaysCount * 3600000)).toFixed(1)) : 0;

      return {
        dependencyType: cat.toUpperCase(),
        failureRate,
        averageLatencyHours,
        totalDelaysCount
      };
    })
    .filter(d => d.totalDelaysCount > 0);

  // 3. Coordination Inefficiencies
  const coordinationInefficiencies: CoordinationInefficiency[] = projects.map(p => {
    const projTasks = tasks.filter(t => t.project_id === p.id);
    const projEvents = events.filter(e => e.blockerIds?.some(bid => blockers.some(b => b.id === bid && projTasks.some(pt => pt.id === b.task_id))));
    const totalCoordinationMinutes = projEvents.reduce((sum, e) => sum + e.durationMinutes, 0);
    
    return {
      streamName: p.name,
      meetingFrequencyCount: projEvents.length,
      totalCoordinationMinutes,
      overheadRatio: projTasks.length > 0 ? Number((totalCoordinationMinutes / (projTasks.length * 8)).toFixed(2)) : 0
    };
  }).filter(c => c.meetingFrequencyCount > 0);

  // 4. Approval Bottlenecks
  const approvalBottlenecks: ApprovalBottleneck[] = ['pm', 'developer', 'super_admin']
    .map(role => {
      let totalLatency = 0;
      let count = 0;
      let pending = 0;

      decisions.forEach(d => {
        if (d.approvalChain?.steps) {
          d.approvalChain.steps.forEach(step => {
            if (step.role === role) {
              if (step.status === 'pending') {
                pending++;
              } else if (step.timestamp) {
                const diff = (new Date(step.timestamp).getTime() - new Date(d.createdAt).getTime()) / 3600000;
                totalLatency += diff;
                count++;
              }
            }
          });
        }
      });

      const averageLatencyHours = count > 0 ? Number((totalLatency / count).toFixed(1)) : 0;

      return {
        role: role.toUpperCase(),
        averageLatencyHours,
        slowdownFactor: averageLatencyHours > 12 ? 2.5 : averageLatencyHours > 4 ? 1.5 : 1.0,
        pendingApprovalsCount: pending
      };
    })
    .filter(b => b.pendingApprovalsCount > 0 || b.averageLatencyHours > 0);

  // 5. Infrastructure Reliability Trends
  const infraReliability: InfrastructureReliabilityTrend[] = ['AWS Cluster', 'Database Server', 'CI/CD Pipeline', 'Security Gateway']
    .map((area) => {
      const relatedBlockers = blockers.filter(b => b.category === 'infrastructure' && b.description.toLowerCase().includes(area.toLowerCase().split(' ')[0]));
      const instabilityFrequency = relatedBlockers.length;
      const totalDowntimeHours = relatedBlockers.reduce((sum, b) => {
        const start = new Date(b.created_at).getTime();
        const end = b.resolved_at ? new Date(b.resolved_at).getTime() : Date.now();
        return sum + (end - start) / 3600000;
      }, 0);

      return {
        area,
        instabilityFrequency,
        totalDowntimeHours: Number(totalDowntimeHours.toFixed(1)),
        trend: instabilityFrequency > 3 ? 'worsening' : instabilityFrequency > 1 ? 'stable' : 'improving'
      };
    });

  // 6. Generate Systemic Patterns
  const patterns: OperationalPattern[] = [];
  if (blockers.length > 5) {
    patterns.push({
      id: 'pat-1',
      title: 'Chronic Dependency Squeeze Pattern',
      patternType: 'bottleneck',
      description: 'Upstream access and data handoffs frequently stall down-stream delivery tracks.',
      severity: 'high',
      recommendation: 'Pre-authorize API tokens and environment configs 48 hours prior to developer assignment.',
      affectedStreamsCount: Math.round(projects.length * 0.6)
    });
  }
  if (coordinationInefficiencies.some(c => c.overheadRatio > 0.15)) {
    patterns.push({
      id: 'pat-2',
      title: 'High-Density Sync Meeting Fatigue',
      patternType: 'inefficiency',
      description: 'Projects spend excessive time in triage syncs rather than executing.',
      severity: 'medium',
      recommendation: 'Transition status reporting to automated blocker registers and async escalation threads.',
      affectedStreamsCount: coordinationInefficiencies.filter(c => c.overheadRatio > 0.15).length
    });
  }
  if (infraReliability.some(i => i.instabilityFrequency > 2)) {
    patterns.push({
      id: 'pat-3',
      title: 'Infrastructure Node Volatility',
      patternType: 'instability',
      description: 'Frequent environment disruptions degrade execution continuity scores.',
      severity: 'high',
      recommendation: 'Implement auto-scaling fallbacks and isolated local testing setups.',
      affectedStreamsCount: 2
    });
  }

  // 7. Generate Organizational Insights
  const insights: OrganizationalInsight[] = [];
  let insIdx = 1;

  if (dependencyInstabilities.some(d => d.failureRate > 30)) {
    const worst = dependencyInstabilities.find(d => d.failureRate > 30);
    insights.push({
      id: `ins-${insIdx++}`,
      category: 'dependency_instability',
      title: `Systemic Instability: ${worst?.dependencyType} Blocks Delivery`,
      details: `${worst?.dependencyType} delays account for ${worst?.failureRate}% of total execution pause events organization-wide.`,
      impactScore: -6,
      actionPlan: 'Enforce pre-sprint capability definition templates to check data availability.',
      timestamp: new Date().toISOString()
    });
  }

  if (approvalBottlenecks.some(b => b.averageLatencyHours > 24)) {
    const worst = approvalBottlenecks.find(b => b.averageLatencyHours > 24);
    insights.push({
      id: `ins-${insIdx++}`,
      category: 'approval_flow',
      title: `Approval Bottleneck: ${worst?.role} Slowdown`,
      details: `Approval latency for ${worst?.role} averages ${worst?.averageLatencyHours} hours, introducing timeline drift cascades.`,
      impactScore: -5,
      actionPlan: 'Establish a 12-hour auto-escalation policy to route pending approvals directly to super-admins.',
      timestamp: new Date().toISOString()
    });
  }

  if (infraReliability.some(i => i.instabilityFrequency > 2)) {
    const worst = infraReliability.find(i => i.instabilityFrequency > 2);
    insights.push({
      id: `ins-${insIdx++}`,
      category: 'infrastructure_reliability',
      title: `Environment Risk: Systemic ${worst?.area} Instability`,
      details: `${worst?.area} encountered ${worst?.instabilityFrequency} disruptions, leading to ${worst?.totalDowntimeHours} cumulative downtime hours.`,
      impactScore: -8,
      actionPlan: 'Allocate dedicated site reliability engineer resources to stabilize container builds.',
      timestamp: new Date().toISOString()
    });
  }

  if (insights.length === 0) {
    insights.push({
      id: `ins-${insIdx++}`,
      category: 'systemic_bottleneck',
      title: 'Nominal Organizational Execution Behavior',
      details: 'All execution tracks are progressing within stable parameters. Systemic friction points are below threshold values.',
      impactScore: 10,
      actionPlan: 'Maintain existing sprint scopes and approval thresholds.',
      timestamp: new Date().toISOString()
    });
  }

  // 8. Risk Trends (historical timeline simulation for charting)
  const riskTrends: DeliveryRiskTrend[] = Array.from({ length: 7 }).map((_, i) => {
    const date = new Date(Date.now() - (6 - i) * 86400000).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
    const factor = (i + 1) / 7;
    return {
      date,
      riskScore: Math.round(40 + (blockers.length * 5) * (1 - factor * 0.2)),
      activeBlockersCount: Math.round(blockers.length * (1 - factor * 0.3)),
      driftDaysCount: Math.round(projects.reduce((sum, p) => sum + (p.delay_drift_days || 0), 0) * (0.8 + factor * 0.2))
    };
  });

  return {
    insights,
    patterns,
    riskTrends,
    dependencyInstabilities,
    coordinationInefficiencies,
    approvalBottlenecks,
    infraReliability,
    teamProfiles
  };
}
