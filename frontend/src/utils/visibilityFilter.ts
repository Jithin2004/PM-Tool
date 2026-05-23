// Delegates to the canonical permission engine (single authority).
// This file exists for backward compatibility — all new code should
// import directly from core/permissions/.

import { Task, Project, UserRole } from '../types';
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
): PermissionContext {
  const ownerProjectIds = projects
    .filter(p => p.owner_id === userId)
    .map(p => p.id);
  return buildPermissionContext(userId, role, ownerProjectIds);
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
