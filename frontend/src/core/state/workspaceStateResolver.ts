import type { Project, Task, Team } from '../../types';
import type { WorkspaceMetrics, ExecutionTopology } from './types';

function calculateExpectedTime(best: number, likely: number, worst: number): number {
  return (best + 4 * likely + worst) / 6;
}

export function resolveWorkspaceMetrics(
  projects: Project[],
  tasks: Task[],
  activeTeams: Team[],
): WorkspaceMetrics {
  const activeProjects = projects.filter(p => p.status !== 'deployed');

  const activeWorkflows = activeProjects.filter(
    p => p.execution_mode !== 'SCRUM',
  ).length;

  const allTasks = tasks;
  const activeTasks = allTasks.filter(t => t.status !== 'done');

  let totalDecayHours = 0;
  activeProjects.forEach(p => {
    const expected = calculateExpectedTime(p.pert_best, p.pert_likely, p.pert_worst);
    if (p.pert_worst > expected) {
      totalDecayHours += (p.pert_worst - expected);
    }
  });

  const deliveryConfidence = Math.max(0, 100 - (totalDecayHours * 0.5));

  const teamsWithProjects = new Set(activeProjects.filter(p => p.team_id).map(p => p.team_id));
  const teamBandwidth = activeTeams.length > 0
    ? (teamsWithProjects.size / activeTeams.length) * 100
    : 0;

  const blockerCount = tasks.filter(t => t.status === 'review').length;
  const reassignCount = 0;
  const instabilityScore = Math.min(100, (blockerCount * 15) + (reassignCount * 10));

  return {
    totalProjects: projects.length,
    visibleProjects: projects.length,
    activeWorkflows,
    totalTasks: allTasks.length,
    activeTasks: activeTasks.length,
    deliveryConfidence: Number(deliveryConfidence.toFixed(1)),
    teamBandwidth: Number(teamBandwidth.toFixed(1)),
    dailyFatigue: Number(totalDecayHours.toFixed(1)),
    instabilityScore,
  };
}
