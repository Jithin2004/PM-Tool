// Delegates to the canonical permission engine (single authority).
// This file exists for backward compatibility — all new code should
// import directly from core/permissions/.

import { Task, Project, UserRole, Team } from '../types';
import { buildPermissionContext, PermissionContext } from '../core/permissions/types';
import {
  filterTasksByVisibility,
  filterProjectsByVisibility,
  canViewTask,
} from '../core/permissions/permissionEngine';

export type { PermissionContext as VisibilityContext };

export function buildVisibilityContext(
  userId: string,
  role: UserRole,
  projects: Project[],
  teams: Team[] = [],
): PermissionContext {
  const ownerProjectIds = projects
    .filter(p => p.owner_id === userId)
    .map(p => p.id);
    
  let assignedTeamProjectIds: string[] = [];
  if (role === 'developer') {
    const userTeamIds = teams.filter(t => {
      const data = t.data as any;
      if (!data) return false;
      const devIds = data.developer_ids || [];
      return Array.isArray(devIds) && devIds.includes(userId);
    }).map(t => t.id);
    
    assignedTeamProjectIds = projects
      .filter(p => p.team_id && userTeamIds.includes(p.team_id))
      .map(p => p.id);
  }

  return buildPermissionContext(userId, role, ownerProjectIds, assignedTeamProjectIds);
}

export function isTaskVisibleToUser(
  task: Task,
  context: PermissionContext,
): boolean {
  return canViewTask(task, context).visible;
}

export function filterVisibleTasks(
  tasks: Task[],
  context: PermissionContext,
): Task[] {
  return filterTasksByVisibility(tasks, context);
}

export function filterVisibleProjects(
  projects: Project[],
  context: PermissionContext,
  visibleTaskProjectIds?: Set<string>,
): Project[] {
  return filterProjectsByVisibility(projects, context, visibleTaskProjectIds);
}

export function getVisibleProjectIds(
  projects: Project[],
  context: PermissionContext,
  tasks: Task[],
): Set<string> {
  const visibleTasks = filterTasksByVisibility(tasks, context);
  const taskProjectIds = new Set(visibleTasks.map(t => t.project_id));
  const visibleProjects = filterProjectsByVisibility(projects, context, taskProjectIds);
  return new Set(visibleProjects.map(p => p.id));
}
