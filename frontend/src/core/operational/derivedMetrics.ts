import type { Project, Task, Team, Stats } from '../../types';
import { calculateExpectedTime } from '../../utils/timeUtils';
import { buildVisibilityContext, filterVisibleProjects, filterVisibleTasks, getVisibleProjectIds } from '../../utils/visibilityFilter';
import type { UserRole } from '../../types';
import type { OperationalDerivedState } from './types';
import { buildLogisticsSystemData } from './systemData';
import type { AttendanceRow, SalaryRow } from './types';

export function computeTeamBandwidth(activeProjects: Project[], activeTeams: Team[]): number {
  const teamsWithProjects = new Set(activeProjects.filter(p => p.team_id).map(p => p.team_id));
  return activeTeams.length > 0
    ? Number(((teamsWithProjects.size / activeTeams.length) * 100).toFixed(1))
    : 0;
}

export interface ComputeDerivedInput {
  projects: Project[];
  tasks: Task[];
  teams: Team[];
  profiles: unknown[];
  attendanceRows: AttendanceRow[];
  salaryRows: SalaryRow[];
  workspaceSettingsBlob: Record<string, unknown>;
  userId: string;
  userRole: UserRole;
  serverMetrics?: {
    deliveryConfidence: number;
    executionPressure: number;
    dailyFatigue: number;
    riskForecast: number;
  };
}

export function computeOperationalDerived(input: ComputeDerivedInput): OperationalDerivedState {
  const activeTeams = input.teams.filter(t => t.name !== 'SYSTEM_SETTINGS');
  
  // PERT is now handled mathematically and automatically on the backend via Postgres triggers
  const projectsWithPert = input.projects;

  const visibilityContext = buildVisibilityContext(
    input.userId,
    input.userRole,
    input.projects,
  );

  const visibleTasks = filterVisibleTasks(input.tasks, visibilityContext);
  const visibleProjectIds = getVisibleProjectIds(
    input.projects,
    visibilityContext,
    input.tasks,
  );
  const visibleProjects = filterVisibleProjects(
    input.projects,
    visibilityContext,
    visibleProjectIds,
  );

  const activeProjects = projectsWithPert.filter(p => p.status !== 'deployed' && p.status !== 'done' && p.status !== 'archived');
  const activeWorkflows = activeProjects.filter(p => p.execution_mode !== 'SCRUM');
  const teamBandwidth = computeTeamBandwidth(activeProjects, activeTeams);

  // Read state durations and shift ledger from workspaceSettingsBlob
  const stateDurations = (input.workspaceSettingsBlob?.project_state_durations || {}) as Record<
    string,
    {
      currentState?: 'active' | 'passive_wait' | 'blocked';
      activeDays?: number;
      passiveWaitDays?: number;
      blockedDays?: number;
    }
  >;

  const timelineShiftLedger = (input.workspaceSettingsBlob?.timeline_shift_ledger || []) as any[];

  // 1. Calculate project-level friction metrics
  const projectFrictionMetrics: Record<string, any> = {};
  let totalFrictionImpact = 0;
  let activeProjectCount = 0;
  
  let activeExecutionProjectsCount = 0;
  let passiveWaitingProjectsCount = 0;
  let blockedProjectsCount = 0;

  input.projects.forEach(project => {
    const duration = stateDurations[project.id] || {
      currentState: 'active',
      activeDays: 0,
      passiveWaitDays: 0,
      blockedDays: 0,
    };

    const currentState = (duration.currentState || 'active') as 'active' | 'passive_wait' | 'blocked';
    const activeDays = duration.activeDays || 0;
    const passiveWaitDays = duration.passiveWaitDays || 0;
    const blockedDays = duration.blockedDays || 0;

    if (project.status !== 'deployed' && project.status !== 'done' && project.status !== 'archived') {
      if (currentState === 'active') activeExecutionProjectsCount++;
      else if (currentState === 'passive_wait') passiveWaitingProjectsCount++;
      else if (currentState === 'blocked') blockedProjectsCount++;
    }

    const totalDays = activeDays + passiveWaitDays + blockedDays;
    const liabilityRatio = totalDays > 0 
      ? Number(((passiveWaitDays + blockedDays) / totalDays * 100).toFixed(1))
      : 0;

    projectFrictionMetrics[project.id] = {
      projectId: project.id,
      currentState,
      activeDays,
      passiveWaitDays,
      blockedDays,
      liabilityRatio,
    };

    if (project.status !== 'deployed' && project.status !== 'done' && project.status !== 'archived') {
      if (totalDays > 0) {
        totalFrictionImpact += (passiveWaitDays + blockedDays) / totalDays;
      }
      activeProjectCount++;
    }
  });

  // Calculate global summary
  let totalShiftDays = 0;
  timelineShiftLedger.forEach(event => {
    totalShiftDays += Number(event.deltaDays) || 0;
  });

  const avgFrictionImpact = activeProjectCount > 0 ? (totalFrictionImpact / activeProjectCount) : 0;
  const globalLiabilityRatio = activeProjectCount > 0 
    ? Number((avgFrictionImpact * 100).toFixed(1))
    : 0;

  const globalFrictionSummary = {
    globalLiabilityRatio,
    totalShiftCount: timelineShiftLedger.length,
    totalShiftDays,
    activeExecutionProjects: activeExecutionProjectsCount,
    passiveWaitingProjects: passiveWaitingProjectsCount,
    blockedProjects: blockedProjectsCount,
  };

  // Friction-Adjusted Forecasting: Incorporate wait-state duration latency into delivery confidence
  const baseConfidence = input.serverMetrics?.deliveryConfidence ?? 85;
  // Reduce confidence based on the global liability ratio (friction penalty of up to 30 points)
  const frictionPenalty = (globalLiabilityRatio / 100) * 30;
  const deliveryConfidence = Math.max(0, Math.min(100, Math.round(baseConfidence - frictionPenalty)));

  const stats: Stats = {
    totalProjects: activeWorkflows.length,
    deliveryConfidence,
    teamBandwidth,
    dailyFatigue: input.serverMetrics?.dailyFatigue ?? 0,
  };

  const systemData = buildLogisticsSystemData({
    teams: input.teams,
    attendanceRows: input.attendanceRows,
    salaryRows: input.salaryRows,
    workspaceSettingsBlob: input.workspaceSettingsBlob,
  });

  return {
    projectsWithPert,
    visibleProjects,
    visibleTasks,
    stats,
    deliveryConfidence: stats.deliveryConfidence,
    teamBandwidth: stats.teamBandwidth,
    dailyFatigue: stats.dailyFatigue,
    executionPressure: input.serverMetrics?.executionPressure ?? 0,
    riskForecast: input.serverMetrics?.riskForecast ?? 0,
    systemData,
    userCustomRoles: (systemData.userCustomRoles as Record<string, string>) || {},
    customRoles: (systemData.customRoles as string[]) || ['Developer', 'Designer', 'QA Engineer', 'Viewer'],
    activeTeams,
    projectFrictionMetrics,
    globalFrictionSummary,
    timelineShiftLedger,
  };
}
