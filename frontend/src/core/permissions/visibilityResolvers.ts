import type { Task, Project, Epic, Sprint, Comment, FileAsset, ActivityLog } from '../../types';
import type { PermissionContext, InheritedContext, EntityVisibility } from './types';
import {
  canViewTask,
  canViewProject,
  canViewEpic,
  canViewSprint,
  canViewComment,
  canViewFile,
  canViewActivityEntry,
} from './permissionEngine';
import { buildInheritedContext } from './contextInheritance';

export interface VisibilityResolution {
  visibleTasks: Task[];
  visibleProjects: Project[];
  visibleEpics: Epic[];
  visibleSprints: Sprint[];
  visibleComments: Comment[];
  visibleFiles: FileAsset[];
  visibleActivity: ActivityLog[];
  inherited: InheritedContext;
  taskVisibility: Map<string, EntityVisibility>;
  projectVisibility: Map<string, EntityVisibility>;
}

export function resolveAllVisibility(
  ctx: PermissionContext,
  allTasks: Task[],
  allProjects: Project[],
  allEpics: Epic[],
  allSprints: Sprint[],
  allComments: Comment[],
  allFiles: FileAsset[],
  allActivity: ActivityLog[],
): VisibilityResolution {
  const inherited = buildInheritedContext(ctx, allTasks);

  const visibleTasks = allTasks.filter(t => canViewTask(t, ctx).visible);
  const taskVisibility = new Map(visibleTasks.map(t => [t.id, canViewTask(t, ctx)]));

  const visibleTaskProjectIds = new Set(visibleTasks.map(t => t.project_id));
  const visibleProjects = allProjects.filter(p => {
    const v = canViewProject(p, ctx);
    if (v.visible) return true;
    return visibleTaskProjectIds.has(p.id);
  });
  const projectVisibility = new Map(visibleProjects.map(p => [p.id, canViewProject(p, ctx)]));

  const visibleEpicIds = new Set(visibleTasks.filter(t => t.epic_id).map(t => t.epic_id!));
  const visibleEpics = allEpics.filter(e => canViewEpic(e, ctx, visibleEpicIds).visible);

  const visibleSprintIds = new Set(visibleTasks.filter(t => t.sprint_id).map(t => t.sprint_id!));
  const visibleSprints = allSprints.filter(s => canViewSprint(s, ctx, visibleSprintIds).visible);

  const visibleTaskIds = new Set(visibleTasks.map(t => t.id));
  const visibleProjectIdSet = new Set(visibleProjects.map(p => p.id));
  const visibleComments = allComments.filter(c => canViewComment(c, ctx, visibleTaskIds, visibleProjectIdSet).visible);
  const visibleFiles = allFiles.filter(f => canViewFile(f, ctx, visibleTaskIds, visibleProjectIdSet).visible);
  const visibleActivity = allActivity.filter(a => canViewActivityEntry(a, ctx, visibleTaskIds, visibleProjectIdSet).visible);

  return {
    visibleTasks,
    visibleProjects,
    visibleEpics,
    visibleSprints,
    visibleComments,
    visibleFiles,
    visibleActivity,
    inherited,
    taskVisibility,
    projectVisibility,
  };
}

export function resolveProjectVisibility(
  ctx: PermissionContext,
  project: Project,
  allTasks: Task[],
  allEpics: Epic[],
  allSprints: Sprint[],
): {
  visibleTasks: Task[];
  visibleEpics: Epic[];
  visibleSprints: Sprint[];
} {
  const projectTasks = allTasks.filter(t => t.project_id === project.id);
  const visibleTasks = projectTasks.filter(t => canViewTask(t, ctx).visible);

  const visibleEpicIds = new Set(visibleTasks.filter(t => t.epic_id).map(t => t.epic_id!));
  const projectEpics = allEpics.filter(e => e.project_id === project.id);
  const visibleEpics = projectEpics.filter(e => canViewEpic(e, ctx, visibleEpicIds).visible);

  const visibleSprintIds = new Set(visibleTasks.filter(t => t.sprint_id).map(t => t.sprint_id!));
  const projectSprints = allSprints.filter(s => s.project_id === project.id);
  const visibleSprints = projectSprints.filter(s => canViewSprint(s, ctx, visibleSprintIds).visible);

  return { visibleTasks, visibleEpics, visibleSprints };
}
