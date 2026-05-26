import type { Project } from './project';
import type { Task } from './execution';
import {
  coalesceIsoDate,
  getProjectClientDeadline,
  getTaskDeadline,
  projectClientDeadlineToDbPatch,
  taskDeadlineToDbPatch,
} from './temporal';
import { toExecutionState } from './collaboration';

export function normalizeTaskFromRow(row: Record<string, unknown>): Task {
  const deadline = getTaskDeadline({
    deadline: row.deadline as string | undefined,
    due_date: row.due_date as string | undefined,
  });

  return {
    ...(row as unknown as Task),
    status: toExecutionState(row.status as string | undefined),
    deadline,
    due_date: deadline,
  };
}

export function normalizeTasksFromRows(rows: Record<string, unknown>[] | null | undefined): Task[] {
  return (rows || []).map(normalizeTaskFromRow);
}

export function normalizeProjectFromRow(row: Record<string, unknown>): Project {
  const clientDeadline = getProjectClientDeadline({
    client_deadline: row.client_deadline as string | undefined,
    deadline: row.deadline as string | undefined,
  });

  return {
    ...(row as unknown as Project),
    client_deadline: clientDeadline,
    deadline: clientDeadline,
  };
}

export function normalizeProjectsFromRows(
  rows: Record<string, unknown>[] | null | undefined,
): Project[] {
  return (rows || []).map(normalizeProjectFromRow);
}

/**
 * Prepare a task patch/insert for Supabase (deadline ↔ due_date).
 */
export function taskToDbRow(
  patch: Partial<Task> & Record<string, unknown>,
): Record<string, unknown> {
  const row: Record<string, unknown> = { ...patch };
  const deadline = coalesceIsoDate(
    patch.deadline as string | undefined,
    patch.due_date as string | undefined,
  );
  if (deadline !== undefined || patch.deadline === null || patch.due_date === null) {
    Object.assign(row, taskDeadlineToDbPatch(deadline ?? null));
  }
  if (patch.status !== undefined) {
    row.status = patch.status;
  }
  return row;
}

/**
 * Prepare a project patch/insert for Supabase (client_deadline ↔ legacy deadline).
 */
export function projectToDbRow(
  patch: Partial<Project> & Record<string, unknown>,
): Record<string, unknown> {
  const row: Record<string, unknown> = { ...patch };
  const clientDeadline = coalesceIsoDate(
    patch.client_deadline as string | undefined,
    patch.deadline as string | undefined,
  );
  if (
    clientDeadline !== undefined ||
    patch.client_deadline === null ||
    patch.deadline === null
  ) {
    Object.assign(row, projectClientDeadlineToDbPatch(clientDeadline ?? null));
  }
  return row;
}
