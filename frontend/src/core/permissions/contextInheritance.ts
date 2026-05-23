import type { Task, Epic, Sprint, Comment, FileAsset, ActivityLog } from '../../types';
import type { PermissionContext, InheritedContext } from './types';
import { canViewTask, filterTasksByVisibility } from './permissionEngine';

export interface ResolvedTaskContext {
  epic: Epic | null;
  sprint: Sprint | null;
  comments: Comment[];
  files: FileAsset[];
  dependencies: Array<{ taskId: string; dependsOn: string }>;
  activity: ActivityLog[];
}

export function buildInheritedContext(
  ctx: PermissionContext,
  allTasks: Task[],
): InheritedContext {
  const visibleTasks = filterTasksByVisibility(allTasks, ctx);
  const visibleTaskIds = new Set(visibleTasks.map(t => t.id));
  const visibleProjectIds = new Set(visibleTasks.map(t => t.project_id));
  const visibleEpicIds = new Set(
    visibleTasks.filter(t => t.epic_id).map(t => t.epic_id!),
  );
  const visibleSprintIds = new Set(
    visibleTasks.filter(t => t.sprint_id).map(t => t.sprint_id!),
  );

  return {
    userId: ctx.userId,
    role: ctx.role,
    ownerProjectIds: ctx.ownerProjectIds,
    visibleTaskIds,
    visibleProjectIds,
    visibleEpicIds,
    visibleSprintIds,
  };
}

export function resolveTaskContext(
  task: Task | null,
  inherited: InheritedContext,
  epics: Epic[],
  sprints: Sprint[],
  comments: Comment[],
  files: FileAsset[],
  activity: ActivityLog[],
): ResolvedTaskContext {
  if (!task) {
    return { epic: null, sprint: null, comments: [], files: [], dependencies: [], activity: [] };
  }

  // Inherit parent epic if task is visible
  const epic = task.epic_id
    ? epics.find(e => e.id === task.epic_id) || null
    : null;

  // Inherit sprint shell if task is visible
  const sprint = task.sprint_id
    ? sprints.find(s => s.id === task.sprint_id) || null
    : null;

  // Comments on this task inherit visibility
  const taskComments = comments.filter(c => c.task_id === task.id);

  // Files attached to this task inherit visibility
  const taskFiles = files.filter(f => f.task_id === task.id);

  // Activity entries related to this task
  const taskActivity = activity.filter(
    a => a.task_id === task.id || a.project_id === task.project_id,
  );

  return {
    epic,
    sprint,
    comments: taskComments,
    files: taskFiles,
    dependencies: [],
    activity: taskActivity,
  };
}
