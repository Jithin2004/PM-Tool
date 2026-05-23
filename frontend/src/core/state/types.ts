import type { Project, Task, Epic, Sprint, Team, Profile } from '../../types';

export interface OperationalGraph {
  workspaceId: string;
  projects: Project[];
  tasks: Task[];
  epics: Epic[];
  sprints: Sprint[];
  teams: Team[];
  profiles: Profile[];
  visibility: {
    visibleProjectIds: Set<string>;
    visibleTaskIds: Set<string>;
    visibleEpicIds: Set<string>;
    visibleSprintIds: Set<string>;
  };
  topology: ExecutionTopology;
  metrics: WorkspaceMetrics;
  timestamp: number;
}

export interface ExecutionTopology {
  projectHierarchy: ProjectNode[];
  taskDistribution: { projectId: string; total: number; active: number }[];
  sprintActivity: { projectId: string; activeSprints: number }[];
}

export interface ProjectNode {
  project: Project;
  epics: Epic[];
  sprints: Sprint[];
  tasks: Task[];
  children: ProjectNode[];
}

export interface WorkspaceMetrics {
  totalProjects: number;
  visibleProjects: number;
  activeWorkflows: number;
  totalTasks: number;
  activeTasks: number;
  deliveryConfidence: number;
  teamBandwidth: number;
  dailyFatigue: number;
  instabilityScore: number;
}
