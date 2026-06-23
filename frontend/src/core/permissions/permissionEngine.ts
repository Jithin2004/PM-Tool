import type { Task, Project, Epic, Sprint, Comment, FileAsset, ActivityLog, TaskDependency } from '../../types';
import { hasCapability, isOperationalReadOnly as isReadOnlyRole } from '../auth/permissions';
import type { PermissionContext, EntityVisibility, ExecutionOwnershipType } from './types';

function hasPlatformGovernance(ctx: PermissionContext): boolean {
  return hasCapability(ctx.role, 'workspace.update');
}

function isProjectOwner(projectId: string, ctx: PermissionContext): boolean {
  return ctx.ownerProjectIds.has(projectId);
}

export function resolveExecutionOwnerships(
  task: Task,
  ctx: PermissionContext,
): ExecutionOwnershipType[] {
  const roles: ExecutionOwnershipType[] = [];

  // 1. TaskAssignee
  if (task.assignee_id === ctx.userId) {
    roles.push('TaskAssignee');
  }

  // 2. ProjectOwner / ExecutionLead
  if (ctx.ownerProjectIds.has(task.project_id)) {
    roles.push('ProjectOwner');
    roles.push('ExecutionLead');
  }

  // 3. BlockerOwner
  if (ctx.blockers) {
    const isBlockerOwner = ctx.blockers.some(
      b => b.task_id === task.id && b.owner_id === ctx.userId && !b.resolved
    );
    if (isBlockerOwner) {
      roles.push('BlockerOwner');
    }
  }

  // 4. DependencyOwner
  if (ctx.dependencies && ctx.tasks) {
    const myAssignedTaskIds = new Set(
      ctx.tasks.filter(t => t.assignee_id === ctx.userId).map(t => t.id)
    );
    const isDepOwner = ctx.dependencies.some(d => {
      if (d.task_id === task.id && myAssignedTaskIds.has(d.depends_on_task_id)) return true;
      if (d.depends_on_task_id === task.id && myAssignedTaskIds.has(d.task_id)) return true;
      return false;
    });
    if (isDepOwner) {
      roles.push('DependencyOwner');
    }
  }

  // 5. Reviewer
  if (ctx.workspaceSettingsBlob) {
    const reviewers = ctx.workspaceSettingsBlob.task_reviewers?.[task.id] || [];
    if (reviewers.includes(ctx.userId)) {
      roles.push('Reviewer');
    }
  }

  // 6. Stakeholder
  if (ctx.workspaceSettingsBlob) {
    const stakeholders = ctx.workspaceSettingsBlob.project_stakeholders?.[task.project_id] || [];
    if (stakeholders.includes(ctx.userId)) {
      roles.push('Stakeholder');
    }
  }

  // 7. Watcher
  if (ctx.workspaceSettingsBlob) {
    const watchers = ctx.workspaceSettingsBlob.task_watchers?.[task.id] || [];
    if (watchers.includes(ctx.userId)) {
      roles.push('Watcher');
    }
  }

  return roles;
}

export function getDependencyChain(
  userId: string,
  tasks: Task[],
  dependencies: TaskDependency[],
): Set<string> {
  const assignedTaskIds = new Set(tasks.filter(t => t.assignee_id === userId).map(t => t.id));
  const chainIds = new Set<string>();

  const findUpstream = (taskId: string) => {
    if (chainIds.has(taskId)) return;
    chainIds.add(taskId);
    const parents = dependencies
      .filter(d => d.task_id === taskId)
      .map(d => d.depends_on_task_id);
    parents.forEach(p => findUpstream(p));
  };

  const findDownstream = (taskId: string) => {
    if (chainIds.has(taskId)) return;
    chainIds.add(taskId);
    const children = dependencies
      .filter(d => d.depends_on_task_id === taskId)
      .map(d => d.task_id);
    children.forEach(c => findDownstream(c));
  };

  assignedTaskIds.forEach(id => {
    findUpstream(id);
    findDownstream(id);
  });

  return chainIds;
}

export function canViewTask(
  task: Task,
  ctx: PermissionContext,
): EntityVisibility {
  if (hasPlatformGovernance(ctx)) {
    return { visible: true, reason: 'role' };
  }

  // PMs have full visibility in projects they manage
  if (hasCapability(ctx.role, 'project.update') && ctx.ownerProjectIds.has(task.project_id)) {
    return { visible: true, reason: 'direct' };
  }

  const ownerships = resolveExecutionOwnerships(task, ctx);

  // Sensitive & Management-only check:
  // If the task name/description/priority contains sensitive markers, developers have NO ACCESS
  // unless they are ProjectOwner/ExecutionLead or directly assigned.
  const isSensitive = 
    task.name?.toLowerCase().includes('[sensitive]') || 
    task.description?.toLowerCase().includes('[sensitive]') ||
    task.name?.toLowerCase().includes('[management]') ||
    task.description?.toLowerCase().includes('[management]');

  if (isSensitive) {
    const isDirectlyAllowed = ownerships.includes('TaskAssignee') || ownerships.includes('ProjectOwner') || ownerships.includes('ExecutionLead');
    if (!isDirectlyAllowed) {
      return { visible: false, reason: 'denied' };
    }
  }

  // Developers have FULL ACCESS to assigned tasks
  if (ownerships.includes('TaskAssignee')) {
    return { visible: true, reason: 'direct' };
  }

  // ProjectOwners and ExecutionLeads have full view access
  if (ownerships.includes('ProjectOwner') || ownerships.includes('ExecutionLead')) {
    return { visible: true, reason: 'direct' };
  }

  // Reviewers, Stakeholders, Watchers have inherited/role-based view access
  if (
    ownerships.includes('Reviewer') ||
    ownerships.includes('Stakeholder') ||
    ownerships.includes('Watcher')
  ) {
    return { visible: true, reason: 'inherited' };
  }

  // Developer visibility restrictions:
  if (hasCapability(ctx.role, 'task.update') && !hasCapability(ctx.role, 'project.update')) {
    // Check if task is in the dependency chain (upstream/downstream) of their assigned tasks
    if (ctx.tasks && ctx.dependencies) {
      const chain = getDependencyChain(ctx.userId, ctx.tasks, ctx.dependencies);
      if (chain.has(task.id)) {
        return { visible: true, reason: 'inherited' }; // LIMITED VISIBILITY
      }
    }

    // Check if it's a neighboring dependency task or blocker-related task
    if (ownerships.includes('DependencyOwner') || ownerships.includes('BlockerOwner')) {
      return { visible: true, reason: 'inherited' }; // LIMITED VISIBILITY
    }

    // NO ACCESS to unrelated tasks/streams
    return { visible: false, reason: 'denied' };
  }

  if (hasCapability(ctx.role, 'task.view') && isReadOnlyRole(ctx.role)) {
    return { visible: true, reason: 'direct' };
  }
  return { visible: false, reason: 'denied' };
}

export function canEditTask(
  task: Task,
  ctx: PermissionContext,
): EntityVisibility {
  if (!hasCapability(ctx.role, 'task.update')) {
    return { visible: false, reason: 'denied' };
  }
  if (hasPlatformGovernance(ctx)) {
    return { visible: true, reason: 'role' };
  }

  const ownerships = resolveExecutionOwnerships(task, ctx);

  if (
    (hasCapability(ctx.role, 'project.update') && ctx.ownerProjectIds.has(task.project_id)) ||
    ownerships.includes('ProjectOwner') ||
    ownerships.includes('ExecutionLead')
  ) {
    return { visible: true, reason: 'direct' };
  }

  // Developers can ONLY edit their assigned tasks
  if (hasCapability(ctx.role, 'task.update') && !hasCapability(ctx.role, 'project.update')) {
    if (ownerships.includes('TaskAssignee')) {
      return { visible: true, reason: 'direct' };
    }
    return { visible: false, reason: 'denied' };
  }

  if (ownerships.includes('TaskAssignee')) {
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
  if (hasCapability(ctx.role, 'task.update') && !hasCapability(ctx.role, 'project.update')) {
    if (ctx.assignedTeamProjectIds.has(project.id)) {
      return { visible: true, reason: 'direct' };
    }
    return { visible: false, reason: 'denied' };
  }
  if (!hasCapability(ctx.role, 'project.view')) {
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
  if (!hasCapability(ctx.role, 'project.update')) {
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
  if (!hasCapability(ctx.role, 'task.view')) {
    return { visible: false, reason: 'denied' };
  }
  if (hasPlatformGovernance(ctx)) {
    return { visible: true, reason: 'role' };
  }
  if (hasCapability(ctx.role, 'project.update') && isProjectOwner(project.id, ctx)) {
    return { visible: true, reason: 'direct' };
  }
  if (hasCapability(ctx.role, 'task.update')) {
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
  
  if (hasCapability(ctx.role, 'task.update') && !hasCapability(ctx.role, 'project.update')) {
    return projects.filter(p => 
      ctx.assignedTeamProjectIds.has(p.id) || 
      (visibleTaskProjectIds && visibleTaskProjectIds.has(p.id))
    );
  }

  if (hasCapability(ctx.role, 'project.update')) {
    return projects.filter(p => ctx.ownerProjectIds.has(p.id));
  }
  
  const own = projects.filter(p => ctx.ownerProjectIds.has(p.id));
  if (visibleTaskProjectIds) {
    const fromTasks = projects.filter(p => visibleTaskProjectIds.has(p.id));
    return [...new Map([...own, ...fromTasks].map(p => [p.id, p])).values()];
  }
  if (isReadOnlyRole(ctx.role) && hasCapability(ctx.role, 'project.view')) {
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

