import type { Project, Task, Team, Stats } from '../../types';
import { calculateExpectedTime } from '../../utils/timeUtils';
import { buildVisibilityContext, filterVisibleProjects, filterVisibleTasks, getVisibleProjectIds } from '../../utils/visibilityFilter';
import type { UserRole } from '../../types';
import type { OperationalDerivedState } from './types';
import { buildLogisticsSystemData } from './systemData';
import type { AttendanceRow, SalaryRow } from './types';

export function aggregateProjectPert(projects: Project[], tasks: Task[]): Project[] {
  return projects.map(project => {
    const projectTasks = tasks.filter(t => t.project_id === project.id);
    if (projectTasks.length === 0) return project;

    const tasksWithExplicitPERT = projectTasks.filter(
      t => Number(t.pert_best) > 0 && Number(t.pert_likely) > 0 && Number(t.pert_worst) > 0,
    );

    if (tasksWithExplicitPERT.length === 0) return project;

    let totalExpected = 0;
    let totalVariance = 0;

    tasksWithExplicitPERT.forEach(task => {
      const best = Number(task.pert_best);
      const likely = Number(task.pert_likely);
      const worst = Number(task.pert_worst);
      const expected = (best + 4 * likely + worst) / 6;
      const variance = Math.pow((worst - best) / 6, 2);
      totalExpected += expected;
      totalVariance += variance;
    });

    const stdDev = Math.sqrt(totalVariance);
    return {
      ...project,
      pert_best: Number(Math.max(0, totalExpected - 2 * stdDev).toFixed(1)),
      pert_likely: Number(totalExpected.toFixed(1)),
      pert_worst: Number((totalExpected + 2 * stdDev).toFixed(1)),
    };
  });
}

export function computeDeliveryConfidence(activeProjects: Project[]): number {
  let totalDecayHours = 0;
  activeProjects.forEach(p => {
    const expected = calculateExpectedTime(p.pert_best, p.pert_likely, p.pert_worst);
    if (p.pert_worst > expected) {
      totalDecayHours += p.pert_worst - expected;
    }
  });
  return Number(Math.max(0, 100 - totalDecayHours * 0.5).toFixed(1));
}

export function computeTeamBandwidth(activeProjects: Project[], activeTeams: Team[]): number {
  const teamsWithProjects = new Set(activeProjects.filter(p => p.team_id).map(p => p.team_id));
  return activeTeams.length > 0
    ? Number(((teamsWithProjects.size / activeTeams.length) * 100).toFixed(1))
    : 0;
}

/** 0–100: higher = more execution pressure from overdue PERT spread + active load. */
export function computeExecutionPressure(activeProjects: Project[], tasks: Task[]): number {
  if (activeProjects.length === 0) return 0;

  let pressureScore = 0;
  activeProjects.forEach(p => {
    const expected = calculateExpectedTime(p.pert_best, p.pert_likely, p.pert_worst);
    const spread = Math.max(0, p.pert_worst - p.pert_best);
    pressureScore += spread > 0 ? (spread / Math.max(expected, 1)) * 10 : 0;
  });

  const blockedTasks = tasks.filter(t => t.status === 'blocked').length;
  const activeTaskCount = tasks.filter(t => t.status !== 'done').length;
  if (activeTaskCount > 0) {
    pressureScore += (blockedTasks / activeTaskCount) * 40;
  }

  return Number(Math.min(100, pressureScore).toFixed(1));
}

/** 0–100: higher = elevated delivery risk. */
export function computeRiskForecast(
  deliveryConfidence: number,
  executionPressure: number,
  dailyFatigue: number,
): number {
  const confidenceRisk = 100 - deliveryConfidence;
  const fatigueRisk = Math.min(100, dailyFatigue * 2);
  return Number(
    Math.min(100, confidenceRisk * 0.45 + executionPressure * 0.35 + fatigueRisk * 0.2).toFixed(1),
  );
}

export function computeOperationalStats(
  projectsWithPert: Project[],
  activeTeams: Team[],
): Stats {
  const activeProjects = projectsWithPert.filter(p => p.status !== 'deployed');
  const activeWorkflows = activeProjects.filter(p => p.execution_mode !== 'SCRUM');
  const deliveryConfidence = computeDeliveryConfidence(activeProjects);
  const teamBandwidth = computeTeamBandwidth(activeProjects, activeTeams);

  let totalDecayHours = 0;
  activeProjects.forEach(p => {
    const expected = calculateExpectedTime(p.pert_best, p.pert_likely, p.pert_worst);
    if (p.pert_worst > expected) totalDecayHours += p.pert_worst - expected;
  });

  return {
    totalProjects: activeWorkflows.length,
    deliveryConfidence,
    teamBandwidth,
    dailyFatigue: Number(totalDecayHours.toFixed(1)),
  };
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
}

export function computeOperationalDerived(input: ComputeDerivedInput): OperationalDerivedState {
  const activeTeams = input.teams.filter(t => t.name !== 'SYSTEM_SETTINGS');
  const projectsWithPert = aggregateProjectPert(input.projects, input.tasks);

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

  const stats = computeOperationalStats(projectsWithPert, activeTeams);
  const activeProjects = projectsWithPert.filter(p => p.status !== 'deployed');
  const executionPressure = computeExecutionPressure(activeProjects, input.tasks);
  const riskForecast = computeRiskForecast(
    stats.deliveryConfidence,
    executionPressure,
    stats.dailyFatigue,
  );

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
    executionPressure,
    riskForecast,
    systemData,
    userCustomRoles: (systemData.userCustomRoles as Record<string, string>) || {},
    customRoles: (systemData.customRoles as string[]) || ['Developer', 'Designer', 'QA Engineer', 'Viewer'],
    activeTeams,
  };
}
