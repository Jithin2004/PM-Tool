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

  const stats: Stats = {
    totalProjects: activeWorkflows.length,
    deliveryConfidence: input.serverMetrics?.deliveryConfidence ?? 0,
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
  };
}
