import type { VisualPriority } from './hierarchySystem';

export interface OperationalSurface {
  id: string;
  priority: VisualPriority;
  label: string;
  contexts: string[];
}

const SURFACE_REGISTRY: OperationalSurface[] = [
  { id: 'execution-flow', priority: 'primary', label: 'Execution Flow', contexts: ['board', 'sprint', 'backlog'] },
  { id: 'active-blockers', priority: 'primary', label: 'Active Blockers', contexts: ['board', 'sprint', 'dashboard'] },
  { id: 'sprint-health', priority: 'primary', label: 'Sprint Health', contexts: ['sprint', 'dashboard'] },
  { id: 'risk-alerts', priority: 'primary', label: 'Operational Risks', contexts: ['mission-control', 'dashboard'] },
  { id: 'coordination-insights', priority: 'secondary', label: 'Coordination Insights', contexts: ['dashboard', 'mission-control'] },
  { id: 'vitality-indicators', priority: 'secondary', label: 'Vitality', contexts: ['mission-control', 'dashboard'] },
  { id: 'dependency-intelligence', priority: 'secondary', label: 'Dependencies', contexts: ['mission-control', 'board'] },
  { id: 'operational-guidance', priority: 'secondary', label: 'Guidance', contexts: ['dashboard', 'sprint'] },
  { id: 'activity-telemetry', priority: 'tertiary', label: 'Activity', contexts: ['dashboard'] },
  { id: 'historical-trends', priority: 'tertiary', label: 'Trends', contexts: ['mission-control'] },
  { id: 'presence-overview', priority: 'tertiary', label: 'Presence', contexts: ['dashboard'] },
  { id: 'audit-log', priority: 'passive', label: 'Audit', contexts: ['control'] },
  { id: 'deep-diagnostics', priority: 'passive', label: 'Diagnostics', contexts: ['control'] },
  { id: 'archived-data', priority: 'passive', label: 'Archived', contexts: ['backlog'] },
];

export function getSurfacesByPriority(priority: VisualPriority): OperationalSurface[] {
  return SURFACE_REGISTRY.filter(s => s.priority === priority);
}

export function getSurfacesForContext(context: string): OperationalSurface[] {
  return SURFACE_REGISTRY.filter(s => s.contexts.includes(context));
}

export function getSurfacePriority(surfaceId: string): VisualPriority | undefined {
  return SURFACE_REGISTRY.find(s => s.id === surfaceId)?.priority;
}
