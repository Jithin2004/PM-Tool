export const OPERATIONAL_TERMS = {
  // Execution
  project: 'engineering construct',
  task: 'execution unit',
  sprint: 'coordination cycle',
  epic: 'delivery domain',
  backlog: 'execution queue',
  board: 'flow board',
  timeline: 'delivery horizon',

  // Coordination
  presence: 'operational awareness',
  collaborators: 'coordination partners',
  signals: 'coordination telemetry',
  feed: 'operational stream',

  // Health
  vitality: 'execution vitality',
  momentum: 'delivery momentum',
  stability: 'operational stability',
  participation: 'coordination balance',

  // Risks
  bottleneck: 'coordination pressure',
  blocker: 'execution constraint',
  overload: 'capacity pressure',
  instability: 'execution variance',

  // Mode
  scrum: 'sprint execution',
  kanban: 'continuous flow',
  hybrid: 'adaptive execution',
  sdlc: 'phase-gated delivery',

  // Integrations
  connection: 'operational channel',
  sync: 'signal ingestion',
  queue: 'delivery pipeline',
  webhook: 'event subscription',
} as const;

export function operationalize(term: string): string {
  return (OPERATIONAL_TERMS as Record<string, string>)[term.toLowerCase()] || term;
}
