import { Project, Task, Team, Profile } from '../../types';
import { generateAdaptiveResponses, AdaptiveExecutionResponse } from './adaptiveResponseEngine';
import { calculateOrganizationalIntelligence, OrganizationalIntelligence } from './intelligenceEngine';
import { generateOperationalMemory, OperationalMemory } from './learningEngine';
import { OperationalDecision, CoordinationEvent } from './coordinationEngine';
import { calculateResilienceSystem } from './resilienceEngine';

export interface ExplainabilityReport {
  whyDeliveryRisk: string;
  whyExecutionDrift: string;
  whyMitigationRecommended: string;
  whyDependencyUnstable: string;
  whyContinuityRiskIncreased: string;
}

export interface GovernanceCache {
  intelligence: OrganizationalIntelligence;
  memory: OperationalMemory;
  adaptiveResponses: AdaptiveExecutionResponse[];
  explainability: Record<string, ExplainabilityReport>;
  resilience: ReturnType<typeof calculateResilienceSystem>;
}

/**
 * Compiles a coherent global platform state once, mapping explainability contexts and eliminating redundant sweeps.
 */
export function compileCoherentPlatformState(
  projects: Project[],
  tasks: Task[],
  teams: Team[],
  profiles: Profile[],
  blockers: any[],
  dependencies: any[],
  decisions: OperationalDecision[],
  events: CoordinationEvent[]
): GovernanceCache {
  // 1. Build rapid indexes for single-sweep lookups
  const taskMap = new Map<string, Task>();
  tasks.forEach(t => taskMap.set(t.id, t));

  const projectMap = new Map<string, Project>();
  projects.forEach(p => projectMap.set(p.id, p));

  // 2. Delegate calculations to specialized engines
  const intel = calculateOrganizationalIntelligence(projects, tasks, teams, decisions, events, blockers);
  const memory = generateOperationalMemory(projects, tasks, teams, profiles, blockers, dependencies, decisions, events);
  const adaptiveResponses = generateAdaptiveResponses(projects, tasks, teams, blockers, dependencies, profiles);
  const resilience = calculateResilienceSystem(projects, tasks, teams, profiles, blockers, dependencies, decisions, events);

  // 3. Generate clear explainability diagnostics
  const explainability: Record<string, ExplainabilityReport> = {};

  const userToTeamMap = new Map<string, Team>();
  teams.forEach(t => {
    const pmId = (t.data as any)?.pm_id;
    const devIds = (t.data as any)?.developer_ids || [];
    if (pmId) userToTeamMap.set(pmId, t);
    devIds.forEach((id: string) => userToTeamMap.set(id, t));
  });

  const cpMap = new Map<string, any>();
  memory.coordinationProfiles.forEach(cp => cpMap.set(cp.teamId, cp));

  const depRelMap = new Map<string, any>();
  memory.dependencyReliabilities.forEach(d => depRelMap.set(d.dependencyType, d));

  adaptiveResponses.forEach(resp => {
    const taskObj = taskMap.get(resp.blockerId);
    const projObj = taskObj ? projectMap.get(taskObj.project_id) : undefined;
    
    // Find team associated with the task assignee in O(1)
    const teamObj = taskObj?.assignee_id ? userToTeamMap.get(taskObj.assignee_id) : undefined;

    const whyDeliveryRisk = taskObj 
      ? `Task "${taskObj.name}" is stalled due to a ${(taskObj as any).execution_state || taskObj.status || 'WAITING'} state, which directly delays task delivery.`
      : 'Active roadblock events are arresting execution progress.';

    const whyExecutionDrift = projObj && (projObj.delay_drift_days || 0) > 0
      ? `Project "${projObj.name}" timeline has drifted by ${projObj.delay_drift_days} days due to downstream blocker duration.`
      : 'Project timelines are aligned; no significant delay drift has accumulated.';

    const whyMitigationRecommended = `Mitigation strategy "${resp.mitigationStrategy.title}" (${resp.mitigationStrategy.category}) is recommended because it provides a verified detour path, saving up to ${resp.mitigationStrategy.expectedRecoveryHours} hours of wait latency.`;

    const depReliability = depRelMap.get(resp.mitigationStrategy.category);
    const whyDependencyUnstable = depReliability 
      ? `The trust score for ${resp.mitigationStrategy.category.toUpperCase()} has degraded to ${depReliability.trustScore}% after ${depReliability.totalInstabilityEvents} disruptions, showing high instability.`
      : 'Dependency channels are performing within stable parameters.';

    const whyContinuityRiskIncreased = teamObj
      ? `Team "${teamObj.name}" continuity stability index has degraded to ${
          cpMap.get(teamObj.id)?.syncOverheadIndex || 0
        }% due to active blockers and sync meeting overhead.`
      : 'Operational continuity ratings are optimal.';

    explainability[resp.id] = {
      whyDeliveryRisk,
      whyExecutionDrift,
      whyMitigationRecommended,
      whyDependencyUnstable,
      whyContinuityRiskIncreased
    };
  });

  return {
    intelligence: intel,
    memory,
    adaptiveResponses,
    explainability,
    resilience
  };
}
