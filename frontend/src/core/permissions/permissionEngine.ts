import type { Task, Project, Epic, Sprint, Comment, FileAsset, ActivityLog } from '../../types';
import type { PermissionContext, EntityVisibility } from './types';

function isSuperAdmin(ctx: PermissionContext): boolean {
  return ctx.role === 'super_admin';
}

function isProjectOwner(projectId: string, ctx: PermissionContext): boolean {
  return ctx.ownerProjectIds.has(projectId);
}

// ── Canonical permission checks ──

export function canViewTask(
  task: Task,
  ctx: PermissionContext,
): EntityVisibility {
  // Super admin sees everything
  if (isSuperAdmin(ctx)) {
    return { visible: true, reason: 'role' };
  }
  // Assigned user sees their tasks
  if (task.assignee_id === ctx.userId) {
    return { visible: true, reason: 'direct' };
  }
  // Project owner sees tasks in their projects
  if (isProjectOwner(task.project_id, ctx)) {
    return { visible: true, reason: 'direct' };
  }
  return { visible: false, reason: 'denied' };
}

export function canEditTask(
  task: Task,
  ctx: PermissionContext,
): EntityVisibility {
  if (isSuperAdmin(ctx)) {
    return { visible: true, reason: 'role' };
  }
  if (ctx.role === 'pm' && isProjectOwner(task.project_id, ctx)) {
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
  if (isSuperAdmin(ctx)) {
    return { visible: true, reason: 'role' };
  }
  if (isProjectOwner(project.id, ctx)) {
    return { visible: true, reason: 'direct' };
  }
  return { visible: false, reason: 'denied' };
}

export function canManageProject(
  project: Project,
  ctx: PermissionContext,
): EntityVisibility {
  if (isSuperAdmin(ctx)) {
    return { visible: true, reason: 'role' };
  }
  if (ctx.role === 'pm' && isProjectOwner(project.id, ctx)) {
    return { visible: true, reason: 'direct' };
  }
  return { visible: false, reason: 'denied' };
}

export function canViewEpic(
  epic: Epic,
  ctx: PermissionContext,
  visibleTaskEpicIds?: Set<string>,
): EntityVisibility {
  if (isSuperAdmin(ctx)) {
    return { visible: true, reason: 'role' };
  }
  if (isProjectOwner(epic.project_id, ctx)) {
    return { visible: true, reason: 'direct' };
  }
  // Inherit from visible tasks
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
  if (isSuperAdmin(ctx)) {
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
  if (isSuperAdmin(ctx)) {
    return { visible: true, reason: 'role' };
  }
  // Inherit from parent task visibility
  if (comment.task_id && visibleTaskIds.has(comment.task_id)) {
    return { visible: true, reason: 'inherited', inheritedFrom: 'task' };
  }
  // Inherit from parent project visibility
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
  if (isSuperAdmin(ctx)) {
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
  if (isSuperAdmin(ctx)) {
    return { visible: true, reason: 'role' };
  }
  // User sees their own activity
  if (entry.actor_id === ctx.userId) {
    return { visible: true, reason: 'direct' };
  }
  // Inherit from related task visibility
  if (entry.task_id && visibleTaskIds.has(entry.task_id)) {
    return { visible: true, reason: 'inherited', inheritedFrom: 'task' };
  }
  // Inherit from related project visibility
  if (entry.project_id && visibleProjectIds.has(entry.project_id)) {
    return { visible: true, reason: 'inherited', inheritedFrom: 'project' };
  }
  return { visible: false, reason: 'denied' };
}

export function canAccessBacklog(
  ctx: PermissionContext,
  project: Project,
): EntityVisibility {
  if (isSuperAdmin(ctx)) {
    return { visible: true, reason: 'role' };
  }
  if (ctx.role === 'pm' && isProjectOwner(project.id, ctx)) {
    return { visible: true, reason: 'direct' };
  }
  return { visible: false, reason: 'denied' };
}

// ── Permission-based filters ──

export function filterTasksByVisibility(
  tasks: Task[],
  ctx: PermissionContext,
): Task[] {
  if (isSuperAdmin(ctx)) return tasks;
  return tasks.filter(t => canViewTask(t, ctx).visible);
}

export function filterProjectsByVisibility(
  projects: Project[],
  ctx: PermissionContext,
  visibleTaskProjectIds?: Set<string>,
): Project[] {
  if (isSuperAdmin(ctx)) return projects;
  if (ctx.role === 'pm') {
    return projects.filter(p => ctx.ownerProjectIds.has(p.id));
  }
  const own = projects.filter(p => ctx.ownerProjectIds.has(p.id));
  if (visibleTaskProjectIds) {
    const fromTasks = projects.filter(p => visibleTaskProjectIds.has(p.id));
    return [...new Map([...own, ...fromTasks].map(p => [p.id, p])).values()];
  }
  return own;
}

export function filterEpicsByVisibility(
  epics: Epic[],
  ctx: PermissionContext,
  visibleTaskEpicIds: Set<string>,
): Epic[] {
  if (isSuperAdmin(ctx)) return epics;
  return epics.filter(e => canViewEpic(e, ctx, visibleTaskEpicIds).visible);
}

export function filterSprintsByVisibility(
  sprints: Sprint[],
  ctx: PermissionContext,
  visibleTaskSprintIds: Set<string>,
): Sprint[] {
  if (isSuperAdmin(ctx)) return sprints;
  return sprints.filter(s => canViewSprint(s, ctx, visibleTaskSprintIds).visible);
}
