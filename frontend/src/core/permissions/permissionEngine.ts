import type { Task, Project, Epic, Sprint, Comment, FileAsset, ActivityLog } from '../../types';
import { hasCapability, isOperationalReadOnly as isReadOnlyRole } from '../auth/permissions';
import type { PermissionContext, EntityVisibility } from './types';

function hasPlatformGovernance(ctx: PermissionContext): boolean {
  return hasCapability(ctx.role, 'platform_governance');
}

function isProjectOwner(projectId: string, ctx: PermissionContext): boolean {
  return ctx.ownerProjectIds.has(projectId);
}

export function canViewTask(
  task: Task,
  ctx: PermissionContext,
): EntityVisibility {
  if (hasPlatformGovernance(ctx)) {
    return { visible: true, reason: 'role' };
  }
  if (task.assignee_id === ctx.userId) {
    return { visible: true, reason: 'direct' };
  }
  if (isProjectOwner(task.project_id, ctx)) {
    return { visible: true, reason: 'direct' };
  }
  if (hasCapability(ctx.role, 'view_tasks') && isReadOnlyRole(ctx.role)) {
    return { visible: true, reason: 'direct' };
  }
  return { visible: false, reason: 'denied' };
}

export function canEditTask(
  task: Task,
  ctx: PermissionContext,
): EntityVisibility {
  if (!hasCapability(ctx.role, 'manage_tasks')) {
    return { visible: false, reason: 'denied' };
  }
  if (hasPlatformGovernance(ctx)) {
    return { visible: true, reason: 'role' };
  }
  if (hasCapability(ctx.role, 'manage_projects') && isProjectOwner(task.project_id, ctx)) {
    return { visible: true, reason: 'direct' };
  }
  if (task.assignee_id === ctx.userId) {
    return { visible: true, reason: 'direct' };
  }
  return { visible: false, reason: 'denied' };
}

export function canViewProject(
  project: Project,
  ctx: PermissionContext,
): EntityVisibility {
  if (hasPlatformGovernance(ctx)) {
    return { visible: true, reason: 'role' };
  }
  if (!hasCapability(ctx.role, 'view_projects')) {
    return { visible: false, reason: 'denied' };
  }
  if (isProjectOwner(project.id, ctx)) {
    return { visible: true, reason: 'direct' };
  }
  if (isReadOnlyRole(ctx.role)) {
    return { visible: true, reason: 'direct' };
  }
  return { visible: false, reason: 'denied' };
}

export function canManageProject(
  project: Project,
  ctx: PermissionContext,
): EntityVisibility {
  if (!hasCapability(ctx.role, 'manage_projects')) {
    return { visible: false, reason: 'denied' };
  }
  if (hasPlatformGovernance(ctx)) {
    return { visible: true, reason: 'role' };
  }
  if (isProjectOwner(project.id, ctx)) {
    return { visible: true, reason: 'direct' };
  }
  return { visible: false, reason: 'denied' };
}

export function canViewEpic(
  epic: Epic,
  ctx: PermissionContext,
  visibleTaskEpicIds?: Set<string>,
): EntityVisibility {
  if (hasPlatformGovernance(ctx)) {
    return { visible: true, reason: 'role' };
  }
  if (isProjectOwner(epic.project_id, ctx)) {
    return { visible: true, reason: 'direct' };
  }
  if (visibleTaskEpicIds?.has(epic.id)) {
    return { visible: true, reason: 'inherited', inheritedFrom: 'task' };
  }
  return { visible: false, reason: 'denied' };
}

export function canViewSprint(
  sprint: Sprint,
  ctx: PermissionContext,
  visibleTaskSprintIds?: Set<string>,
): EntityVisibility {
  if (hasPlatformGovernance(ctx)) {
    return { visible: true, reason: 'role' };
  }
  if (isProjectOwner(sprint.project_id, ctx)) {
    return { visible: true, reason: 'direct' };
  }
  if (visibleTaskSprintIds?.has(sprint.id)) {
    return { visible: true, reason: 'inherited', inheritedFrom: 'task' };
  }
  return { visible: false, reason: 'denied' };
}

export function canViewComment(
  comment: Comment,
  ctx: PermissionContext,
  visibleTaskIds: Set<string>,
  visibleProjectIds: Set<string>,
): EntityVisibility {
  if (hasPlatformGovernance(ctx)) {
    return { visible: true, reason: 'role' };
  }
  if (comment.task_id && visibleTaskIds.has(comment.task_id)) {
    return { visible: true, reason: 'inherited', inheritedFrom: 'task' };
  }
  if (comment.project_id && visibleProjectIds.has(comment.project_id)) {
    return { visible: true, reason: 'inherited', inheritedFrom: 'project' };
  }
  return { visible: false, reason: 'denied' };
}

export function canViewFile(
  file: FileAsset,
  ctx: PermissionContext,
  visibleTaskIds: Set<string>,
  visibleProjectIds: Set<string>,
): EntityVisibility {
  if (hasPlatformGovernance(ctx)) {
    return { visible: true, reason: 'role' };
  }
  if (file.task_id && visibleTaskIds.has(file.task_id)) {
    return { visible: true, reason: 'inherited', inheritedFrom: 'task' };
  }
  if (file.project_id && visibleProjectIds.has(file.project_id)) {
    return { visible: true, reason: 'inherited', inheritedFrom: 'project' };
  }
  return { visible: false, reason: 'denied' };
}

export function canViewActivityEntry(
  entry: ActivityLog,
  ctx: PermissionContext,
  visibleTaskIds: Set<string>,
  visibleProjectIds: Set<string>,
): EntityVisibility {
  if (hasPlatformGovernance(ctx)) {
    return { visible: true, reason: 'role' };
  }
  if (entry.actor_id === ctx.userId) {
    return { visible: true, reason: 'direct' };
  }
  if (entry.task_id && visibleTaskIds.has(entry.task_id)) {
    return { visible: true, reason: 'inherited', inheritedFrom: 'task' };
  }
  if (entry.project_id && visibleProjectIds.has(entry.project_id)) {
    return { visible: true, reason: 'inherited', inheritedFrom: 'project' };
  }
  return { visible: false, reason: 'denied' };
}

export function canAccessBacklog(
  ctx: PermissionContext,
  project: Project,
): EntityVisibility {
  if (!hasCapability(ctx.role, 'view_tasks')) {
    return { visible: false, reason: 'denied' };
  }
  if (hasPlatformGovernance(ctx)) {
    return { visible: true, reason: 'role' };
  }
  if (hasCapability(ctx.role, 'manage_projects') && isProjectOwner(project.id, ctx)) {
    return { visible: true, reason: 'direct' };
  }
  if (hasCapability(ctx.role, 'manage_tasks')) {
    return { visible: true, reason: 'direct' };
  }
  if (isReadOnlyRole(ctx.role)) {
    return { visible: true, reason: 'direct' };
  }
  return { visible: false, reason: 'denied' };
}

export function filterTasksByVisibility(
  tasks: Task[],
  ctx: PermissionContext,
): Task[] {
  if (hasPlatformGovernance(ctx)) return tasks;
  return tasks.filter(t => canViewTask(t, ctx).visible);
}

export function filterProjectsByVisibility(
  projects: Project[],
  ctx: PermissionContext,
  visibleTaskProjectIds?: Set<string>,
): Project[] {
  if (hasPlatformGovernance(ctx)) return projects;
  if (hasCapability(ctx.role, 'manage_projects')) {
    return projects.filter(p => ctx.ownerProjectIds.has(p.id));
  }
  const own = projects.filter(p => ctx.ownerProjectIds.has(p.id));
  if (visibleTaskProjectIds) {
    const fromTasks = projects.filter(p => visibleTaskProjectIds.has(p.id));
    return [...new Map([...own, ...fromTasks].map(p => [p.id, p])).values()];
  }
  if (isReadOnlyRole(ctx.role) && hasCapability(ctx.role, 'view_projects')) {
    return projects;
  }
  return own;
}

export function filterEpicsByVisibility(
  epics: Epic[],
  ctx: PermissionContext,
  visibleTaskEpicIds: Set<string>,
): Epic[] {
  if (hasPlatformGovernance(ctx)) return epics;
  return epics.filter(e => canViewEpic(e, ctx, visibleTaskEpicIds).visible);
}

export function filterSprintsByVisibility(
  sprints: Sprint[],
  ctx: PermissionContext,
  visibleTaskSprintIds: Set<string>,
): Sprint[] {
  if (hasPlatformGovernance(ctx)) return sprints;
  return sprints.filter(s => canViewSprint(s, ctx, visibleTaskSprintIds).visible);
}
