/** ISO-8601 instant or date string used across the platform. */
export type IsoDateTime = string;

/**
 * Coalesce legacy date fields to a single canonical value (first non-empty wins).
 */
export function coalesceIsoDate(...candidates: (string | null | undefined)[]): IsoDateTime | undefined {
  for (const value of candidates) {
    if (value != null && String(value).trim() !== '') {
      return value;
    }
  }
  return undefined;
}

/** Canonical task end date — reads `deadline` then legacy `due_date`. */
export function getTaskDeadline(task: {
  deadline?: string | null;
  due_date?: string | null;
}): IsoDateTime | undefined {
  return coalesceIsoDate(task.deadline, task.due_date);
}

/** Canonical project client delivery date. */
export function getProjectClientDeadline(project: {
  client_deadline?: string | null;
  deadline?: string | null;
}): IsoDateTime | undefined {
  return coalesceIsoDate(project.client_deadline, project.deadline);
}

/** Write patch for tasks table (supports both column names during migration). */
export function taskDeadlineToDbPatch(deadline: string | null | undefined): Record<string, string | null> {
  if (deadline === undefined) return {};
  const value = deadline ?? null;
  return { deadline: value, due_date: value };
}

/** Write patch for projects table client delivery date. */
export function projectClientDeadlineToDbPatch(
  clientDeadline: string | null | undefined,
): Record<string, string | null> {
  if (clientDeadline === undefined) return {};
  const value = clientDeadline ?? null;
  return { client_deadline: value, deadline: value };
}
