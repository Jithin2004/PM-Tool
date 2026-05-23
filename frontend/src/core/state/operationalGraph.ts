import { useMemo } from 'react';
import type { Project, Task, Epic, Sprint, Team, Profile } from '../../types';
import type { PermissionContext } from '../permissions/types';
import type { OperationalGraph, WorkspaceMetrics } from './types';
import { resolveVisibilityGraph, type VisibilityGraph } from './visibilityGraph';
import { buildExecutionTopology } from './executionTopology';
import { resolveWorkspaceMetrics } from './workspaceStateResolver';

interface UseOperationalGraphInput {
  workspaceId: string;
  projects: Project[];
  tasks: Task[];
  epics: Epic[];
  sprints: Sprint[];
  teams: Team[];
  profiles: Profile[];
  permissionContext: PermissionContext;
}

export function useOperationalGraph(input: UseOperationalGraphInput): OperationalGraph {
  return useMemo(() => {
    const visibility = resolveVisibilityGraph(
      input.projects,
      input.tasks,
      input.permissionContext,
    );

    const visibleProjects = input.projects.filter(p =>
      visibility.visibleProjectIds.has(p.id),
    );

    const topology = buildExecutionTopology(visibleProjects, input.tasks);

    const activeTeams = input.teams.filter(t => t.name !== 'SYSTEM_SETTINGS');

    const metrics = resolveWorkspaceMetrics(
      visibleProjects,
      input.tasks,
      activeTeams,
    );

    return {
      workspaceId: input.workspaceId,
      projects: visibleProjects,
      tasks: input.tasks.filter(t => visibility.visibleTaskIds.has(t.id)),
      epics: input.epics,
      sprints: input.sprints,
      teams: input.teams,
      profiles: input.profiles,
      visibility: {
        visibleProjectIds: visibility.visibleProjectIds,
        visibleTaskIds: visibility.visibleTaskIds,
        visibleEpicIds: new Set(),
        visibleSprintIds: new Set(),
      },
      topology,
      metrics,
      timestamp: Date.now(),
    };
  }, [
    input.workspaceId,
    input.projects,
    input.tasks,
    input.epics,
    input.sprints,
    input.teams,
    input.profiles,
    input.permissionContext,
  ]);
}

export function useGraphMetrics(graph: OperationalGraph): WorkspaceMetrics {
  return graph.metrics;
}

export function useGraphStats(graph: OperationalGraph): {
  totalProjects: number;
  activeWorkflows: number;
  deliveryConfidence: number;
  teamBandwidth: number;
  dailyFatigue: number;
  instabilityScore: number;
} {
  return useMemo(() => ({
    totalProjects: graph.metrics.totalProjects,
    activeWorkflows: graph.metrics.activeWorkflows,
    deliveryConfidence: graph.metrics.deliveryConfidence,
    teamBandwidth: graph.metrics.teamBandwidth,
    dailyFatigue: graph.metrics.dailyFatigue,
    instabilityScore: graph.metrics.instabilityScore,
  }), [graph.metrics]);
}
