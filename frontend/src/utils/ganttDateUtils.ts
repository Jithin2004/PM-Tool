import { Task, TaskDependency } from '../types';

export interface GanttTask {
  id: string;
  name: string;
  start: string; // Format: YYYY-MM-DD
  end: string;   // Format: YYYY-MM-DD
  dependencies: string; // Comma-separated parent task IDs
  progress: number; // 0 to 100
}

/**
 * Formats a Date object as a YYYY-MM-DD string
 */
export const formatDateString = (date: Date): string => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

/**
 * Maps task status to an audit-friendly progress percentage
 */
export const mapStatusToProgress = (status: Task['status']): number => {
  switch (status) {
    case 'backlog':
      return 0;
    case 'in_progress':
      return 50;
    case 'review':
      return 85;
    case 'done':
      return 100;
    default:
      return 0;
  }
};

/**
 * Safely normalizes raw task and dependency lists into Gantt-ready structures
 */
export const normalizeTasksForGantt = (
  tasks: Task[],
  dependencies: TaskDependency[]
): GanttTask[] => {
  const defaultBaseDate = new Date();
  
  return tasks.map(task => {
    // 1. Resolve Start Date (Fallback to created_at -> defaultBaseDate)
    let parsedStart = defaultBaseDate;
    if (task.start_date) {
      const d = new Date(task.start_date);
      if (!isNaN(d.getTime())) {
        parsedStart = d;
      }
    } else if (task.created_at) {
      const d = new Date(task.created_at);
      if (!isNaN(d.getTime())) {
        parsedStart = d;
      }
    }

    // 2. Resolve End Date (Fallback to start + estimated_hours -> start + 24 hours)
    let parsedEnd = new Date(parsedStart.getTime() + 24 * 60 * 60 * 1000); // default 1 day
    if (task.deadline) {
      const d = new Date(task.deadline);
      if (!isNaN(d.getTime())) {
        parsedEnd = d;
      }
    } else if (task.estimated_hours && task.estimated_hours > 0) {
      parsedEnd = new Date(parsedStart.getTime() + task.estimated_hours * 60 * 60 * 1000);
    }

    // Safeguard: Ensure end date is not prior to start date
    if (parsedEnd.getTime() < parsedStart.getTime()) {
      parsedEnd = new Date(parsedStart.getTime() + 24 * 60 * 60 * 1000);
    }

    // 3. Resolve dependencies into comma-separated task ID string
    const taskDeps = dependencies
      .filter(dep => dep.task_id === task.id)
      .map(dep => dep.depends_on_task_id);
    
    const dependencyString = taskDeps.join(', ');

    // 4. Resolve progress
    const progress = mapStatusToProgress(task.status);

    return {
      id: task.id,
      name: task.name,
      start: formatDateString(parsedStart),
      end: formatDateString(parsedEnd),
      dependencies: dependencyString,
      progress
    };
  });
};
