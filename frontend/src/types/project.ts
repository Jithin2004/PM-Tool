import type { PROJECT_TEMPLATES, TASK_STATUSES } from '../constants/product';
import type { ExecutionState, TaskPriority } from '../core/types';

export type ProjectTemplate = typeof PROJECT_TEMPLATES[number];
export type TaskStatus = typeof TASK_STATUSES[number];
export type Priority = TaskPriority;

export interface ProjectDraft {
  name: string;
  description: string;
  priority: Priority;
  deadline: string;
  teamId?: string;
  template: ProjectTemplate;
}

export interface TaskDraft {
  name: string;
  description: string;
  assigneeId?: string;
  priority: Priority;
  startDate?: string;
  deadline?: string;
  dependencyIds: string[];
  estimatedHours: number;
  attachments: File[];
  pertBest?: number;
  pertLikely?: number;
  pertWorst?: number;
}

/** Draft / form model for tasks — maps to domain Task at persistence. */
export interface ResolveTask {
  id: string;
  workspaceId: string;
  projectId: string;
  name: string;
  description?: string;
  status: TaskStatus;
  assigneeId?: string;
  priority: Priority;
  startDate?: string;
  /** Canonical end date (not dueDate). */
  deadline?: string;
  dependencyIds: string[];
  estimatedHours: number;
  pertBest?: number;
  pertLikely?: number;
  pertWorst?: number;
  createdAt: string;
  updatedAt?: string;
}
