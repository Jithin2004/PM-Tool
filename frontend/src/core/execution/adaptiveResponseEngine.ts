import { Task, Project, Team, Profile } from '../../types';
import { IsoDateTime } from '../types/temporal';
import { hasFunction } from '../auth/permissions';

export interface MitigationStrategy {
  id: string;
  title: string;
  category: 'bypass' | 'reassign' | 'mock' | 'fallback' | 'defer';
  description: string;
  expectedRecoveryHours: number;
}

export interface ExecutionReroute {
  id: string;
  taskId: string;
  taskName: string;
  alternativeTaskId: string;
  alternativeTaskName: string;
  rationale: string;
}

export interface WorkloadRedistribution {
  id: string;
  overloadedOwnerId: string;
  overloadedOwnerName: string;
  availableOwnerId: string;
  availableOwnerName: string;
  taskId: string;
  taskName: string;
  loadDeltaPercentage: number;
}

export interface DependencyMitigation {
  id: string;
  blockedTaskId: string;
  blockedTaskName: string;
  upstreamBlockerTaskId: string;
  upstreamBlockerTaskName: string;
  substitutionStrategy: string;
}

export interface EscalationRecommendation {
  id: string;
  blockerId: string;
  blockerDescription: string;
  escalationTargetRole: 'pm' | 'super_admin';
  reasonForEscalation: string;
}

export interface ContinuityPlan {
  id: string;
  projectId: string;
  projectName: string;
  originalDeadline: IsoDateTime;
  proposedDeadline: IsoDateTime;
  deferredTaskIds: string[];
  deferredTaskNames: string[];
}

export interface OperationalFallback {
  id: string;
  blockerCategory: 'infrastructure' | 'client' | 'access';
  fallbackSteps: string[];
  ownerId?: string;
  ownerName?: string;
}

export interface AdaptiveExecutionResponse {
  id: string;
  workspaceId: string;
  blockerId: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  mitigationStrategy: MitigationStrategy;
  reroute?: ExecutionReroute;
  workloadRedistribution?: WorkloadRedistribution;
  dependencyMitigation?: DependencyMitigation;
  escalationRecommendation?: EscalationRecommendation;
  continuityPlan?: ContinuityPlan;
  operationalFallback?: OperationalFallback;
  status: 'recommended' | 'applied' | 'dismissed';
  createdAt: IsoDateTime;
}

/**
 * Sweeps the operational workspace datasets and generates actionable adaptive execution response recommendations.
 */
export function generateAdaptiveResponses(
  projects: Project[],
  tasks: Task[],
  teams: Team[],
  blockers: any[],
  dependencies: any[],
  profiles: Profile[]
): AdaptiveExecutionResponse[] {
  const responses: AdaptiveExecutionResponse[] = [];
  const now = new Date().toISOString();

  // Find profiles map
  const pMap = new Map<string, Profile>();
  profiles.forEach(p => pMap.set(p.id, p));

  blockers.forEach((b, index) => {
    if (b.resolved) return;

    const taskObj = tasks.find(t => t.id === b.task_id);
    if (!taskObj) return;

    const projectId = taskObj.project_id;
    const projectObj = projects.find(p => p.id === projectId);
    const projectName = projectObj?.name || 'Project';

    // 1. Alternate Execution Paths / Rerouting
    let reroute: ExecutionReroute | undefined;
    const projectTasks = tasks.filter(t => t.project_id === projectId && t.status !== 'done' && t.id !== taskObj.id);
    const unblockedTasks = projectTasks.filter(pt => !blockers.some(bl => bl.task_id === pt.id && !bl.resolved));
    if (unblockedTasks.length > 0) {
      reroute = {
        id: `rr-${b.id}`,
        taskId: taskObj.id,
        taskName: taskObj.name,
        alternativeTaskId: unblockedTasks[0].id,
        alternativeTaskName: unblockedTasks[0].name,
        rationale: `Reroute flow to ${unblockedTasks[0].name} to sustain active sprint execution continuity while DB resources on ${taskObj.name} are stalled.`
      };
    }

    // 2. Workload Balancing Recommendations
    let workloadRedistribution: WorkloadRedistribution | undefined;
    if (taskObj.assignee_id) {
      const currentAssignee = pMap.get(taskObj.assignee_id);
      const assigneeName = currentAssignee?.full_name || 'Current Developer';
      
      // Find other developers in same team or project with fewer active tasks

      const activeUnassignedDevs = profiles.filter(p => hasFunction(p, 'Engineering') && p.id !== taskObj.assignee_id);
      if (activeUnassignedDevs.length > 0) {
        const altDev = activeUnassignedDevs[0];
        const altDevName = altDev.full_name || altDev.email || 'Alternative Developer';
        
        workloadRedistribution = {
          id: `wr-${b.id}`,
          overloadedOwnerId: taskObj.assignee_id,
          overloadedOwnerName: assigneeName,
          availableOwnerId: altDev.id,
          availableOwnerName: altDevName,
          taskId: taskObj.id,
          taskName: taskObj.name,
          loadDeltaPercentage: 35
        };
      }
    }

    // 3. Dependency Mitigations
    let dependencyMitigation: DependencyMitigation | undefined;
    const taskDeps = dependencies.filter(d => d.task_id === taskObj.id);
    if (taskDeps.length > 0) {
      const depTask = tasks.find(t => t.id === taskDeps[0].depends_on_task_id);
      if (depTask) {
        dependencyMitigation = {
          id: `dm-${b.id}`,
          blockedTaskId: taskObj.id,
          blockedTaskName: taskObj.name,
          upstreamBlockerTaskId: depTask.id,
          upstreamBlockerTaskName: depTask.name,
          substitutionStrategy: `Inject dummy client JSON interfaces to decouple Frontend Integration from database schema dependencies.`
        };
      }
    }

    // 4. Escalation Recommendations
    let escalationRecommendation: EscalationRecommendation | undefined;
    const blockerAgeHours = (Date.now() - new Date(b.created_at).getTime()) / 3600000;
    if (blockerAgeHours > 12) {
      escalationRecommendation = {
        id: `er-${b.id}`,
        blockerId: b.id,
        blockerDescription: b.description,
        escalationTargetRole: b.is_critical ? 'super_admin' : 'pm',
        reasonForEscalation: `Blocker has remained unresolved for ${Math.round(blockerAgeHours)} hours. Requires administrative override to authorize sandbox access.`
      };
    }

    // 5. Operational Fallbacks
    let operationalFallback: OperationalFallback | undefined;
    if (b.category === 'infrastructure') {
      operationalFallback = {
        id: `of-${b.id}`,
        blockerCategory: 'infrastructure',
        fallbackSteps: [
          'De-route test scripts from the shared staging environment cluster.',
          'Instruct developers to stand up localized Docker database containers.',
          'Authorize local unit test overrides to skip CI staging validation.'
        ]
      };
    } else if (b.category === 'access') {
      operationalFallback = {
        id: `of-${b.id}`,
        blockerCategory: 'access',
        fallbackSteps: [
          'Generate temporary client sandbox bypass key.',
          'Re-route QA flows to mock staging endpoint.',
          'Submit emergency override credential request.'
        ]
      };
    }

    // 6. Continuity Plans / Release window shifts
    let continuityPlan: ContinuityPlan | undefined;
    if (projectObj && (projectObj.delay_drift_days || 0) > 3) {
      const originalDeadline = projectObj.deadline || new Date().toISOString();
      const proposedDeadline = new Date(new Date(originalDeadline).getTime() + 4 * 86400000).toISOString();
      
      continuityPlan = {
        id: `cp-${b.id}`,
        projectId: projectObj.id,
        projectName: projectObj.name,
        originalDeadline,
        proposedDeadline,
        deferredTaskIds: [taskObj.id],
        deferredTaskNames: [taskObj.name]
      };
    }

    // Compose Adaptive Response
    responses.push({
      id: `adr-${b.id}-${index}`,
      workspaceId: b.workspace_id || 'ws-default',
      blockerId: b.id,
      severity: b.is_critical ? 'critical' : 'high',
      mitigationStrategy: {
        id: `ms-${b.id}`,
        title: b.category === 'infrastructure' ? 'Environment Fallback Isolation' : b.category === 'dependency' ? 'Dependency Schema Substitution' : 'Ownership Reallocation',
        category: b.category === 'infrastructure' ? 'fallback' : b.category === 'dependency' ? 'mock' : 'reassign',
        description: `Bypasses active ${b.category} roadblock via secondary routing or ownership handoff.`,
        expectedRecoveryHours: 4
      },
      reroute,
      workloadRedistribution,
      dependencyMitigation,
      escalationRecommendation,
      continuityPlan,
      operationalFallback,
      status: 'recommended',
      createdAt: now
    });
  });

  return responses;
}
