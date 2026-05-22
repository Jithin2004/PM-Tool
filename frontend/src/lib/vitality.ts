// ── Operational Vitality Engine ──
// Generates a believable-but-sparse activity pulse for development/demo use.
// NOT marketing spam — realistic cadence, contributor diversity, staggered timestamps.

export interface VitalityEvent {
  id: string;
  actor_id: string;
  actor_name: string;
  action: string;
  target_type: string;
  target_id: string;
  metadata?: Record<string, any>;
  created_at: string;
}

const ACTORS = [
  { id: 'vital-alex', name: 'Alex Chen' },
  { id: 'vital-jordan', name: 'Jordan Reyes' },
  { id: 'vital-priya', name: 'Priya Sharma' },
  { id: 'vital-marcus', name: 'Marcus Webb' },
  { id: 'vital-lee', name: 'Lee Nakamura' },
];

const ACTIONS = ['task_updated', 'task_completed', 'sprint_progressed', 'approval_submitted', 'automation_executed', 'integration_synced', 'comment_added'];
const TYPES = ['task', 'sprint', 'approval', 'automation', 'integration'];

let _seq = 0;

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function pickN<T>(arr: T[], n: number): T[] {
  const shuffled = [...arr].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, Math.min(n, arr.length));
}

function staggerTimestamp(base: Date, index: number, total: number): string {
  const offset = Math.random() * 120_000 * (index / Math.max(total, 1));
  return new Date(base.getTime() - offset).toISOString();
}

export function generateVitalityBatch(count: number = 6): VitalityEvent[] {
  const now = new Date();
  const actors = pickN(ACTORS, Math.min(count, ACTORS.length));
  const events: VitalityEvent[] = [];

  for (let i = 0; i < count; i++) {
    _seq++;
    const actor = i < actors.length ? actors[i] : pick(ACTORS);
    const action = pick(ACTIONS);
    const type = pick(TYPES);
    const targetId = `${type}-vital-${Math.floor(Math.random() * 100)}`;

    events.push({
      id: `vital-${_seq}-${Date.now()}`,
      actor_id: actor.id,
      actor_name: actor.name,
      action,
      target_type: type,
      target_id: targetId,
      created_at: staggerTimestamp(now, i, count),
    });
  }

  return events;
}

export function generateVitalityProject(): { name: string; status: string; execution_mode: string; pert_best: number; pert_likely: number; pert_worst: number } {
  const prefix = pick(['Velocity', 'Horizon', 'Quantum', 'Vertex', 'Apex', 'Catalyst']);
  const suffix = pick(['Sync', 'Pipeline', 'Mesh', 'Core', 'Flow', 'Stack']);
  return {
    name: `${prefix} ${suffix}`,
    status: 'active',
    execution_mode: pick(['KANBAN', 'SCRUM']),
    pert_best: Math.round(Math.random() * 20 + 5),
    pert_likely: Math.round(Math.random() * 30 + 15),
    pert_worst: Math.round(Math.random() * 40 + 30),
  };
}

export function generateVitalityMetric(): { riskScore: number; overdueTasks: number; sprintVelocity: number; activeAutomations: number; integrationHealth: number } {
  return {
    riskScore: Math.round(Math.random() * 40 + 10),
    overdueTasks: Math.round(Math.random() * 5),
    sprintVelocity: Math.round(Math.random() * 30 + 15),
    activeAutomations: Math.round(Math.random() * 8 + 2),
    integrationHealth: Math.round(Math.random() * 20 + 75),
  };
}
