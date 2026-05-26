/**
 * Canonical domain vocabulary — use these terms in product copy and new code.
 * Legacy aliases are supported via normalize.* and type aliases only.
 */
export const DOMAIN_GLOSSARY = {
  /** Task target end (ISO). DB may store `due_date`; domain field is `deadline`. */
  taskDeadline: 'deadline',
  /** Contractual project delivery date. DB column: `client_deadline`. */
  projectClientDeadline: 'client_deadline',
  /** Work item in a project. Not "execution" (execution = delivery surface/module). */
  task: 'task',
  /** Portfolio initiative. Not workspaceProject. */
  project: 'project',
  /** Time-boxed delivery iteration. `cycle` is a UI alias only. */
  sprint: 'sprint',
  /** Workflow column for tasks/sprints/epics. Prefer `executionState` in domain logic. */
  executionState: 'executionState',
  /** Persistence column name on rows — maps to executionState at boundaries. */
  statusColumn: 'status',
} as const;
