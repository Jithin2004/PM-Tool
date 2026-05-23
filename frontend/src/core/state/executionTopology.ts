import type { Project, Task } from '../../types';
import type { ExecutionTopology, ProjectNode } from './types';

export function buildExecutionTopology(
  projects: Project[],
  tasks: Task[],
): ExecutionTopology {
  const taskDistribution = projects.map(p => {
    const projectTasks = tasks.filter(t => t.project_id === p.id);
    return {
      projectId: p.id,
      total: projectTasks.length,
      active: projectTasks.filter(t => t.status !== 'done').length,
    };
  });

  const sprintActivity = projects
    .filter(p => p.execution_mode === 'SCRUM' || p.execution_mode === 'HYBRID')
    .map(p => ({
      projectId: p.id,
      activeSprints: 0,
    }));

  return {
    projectHierarchy: [],
    taskDistribution,
    sprintActivity,
  };
}

export function buildProjectNode(
  project: Project,
  tasks: Task[],
  children: ProjectNode[] = [],
): ProjectNode {
  return {
    project,
    epics: [],
    sprints: [],
    tasks: tasks.filter(t => t.project_id === project.id),
    children,
  };
}
