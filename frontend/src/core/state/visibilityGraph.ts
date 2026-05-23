import type { Project, Task } from '../../types';
import type { PermissionContext } from '../permissions/types';
import { filterProjectsByVisibility } from '../permissions/permissionEngine';

export interface VisibilityGraph {
  visibleProjects: Project[];
  visibleProjectIds: Set<string>;
  visibleTaskIds: Set<string>;
  hiddenProjectCount: number;
  totalProjectCount: number;
}

export function resolveVisibilityGraph(
  projects: Project[],
  tasks: Task[],
  ctx: PermissionContext,
): VisibilityGraph {
  const totalProjectCount = projects.length;

  const visibleProjects = filterProjectsByVisibility(projects, ctx);

  const visibleProjectIds = new Set(visibleProjects.map(p => p.id));

  const visibleTaskIds = new Set(
    tasks
      .filter(t => visibleProjectIds.has(t.project_id))
      .map(t => t.id),
  );

  const hiddenProjectCount = totalProjectCount - visibleProjects.length;

  return {
    visibleProjects,
    visibleProjectIds,
    visibleTaskIds,
    hiddenProjectCount,
    totalProjectCount,
  };
}
