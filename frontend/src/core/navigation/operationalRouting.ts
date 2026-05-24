export type RouteTier = 'execution' | 'coordination' | 'control' | 'archival';

export interface RouteDefinition {
  path: string;
  tier: RouteTier;
  label: string;
  priority: number;
}

export const ROUTE_TIER_ORDER: RouteTier[] = ['execution', 'coordination', 'control', 'archival'];

export const ROUTE_REGISTRY: RouteDefinition[] = [
  { path: '/',                     tier: 'execution',   label: 'Dashboard',          priority: 100 },
  { path: '/projects/:id/board',   tier: 'execution',   label: 'Board',              priority: 95 },
  { path: '/projects/:id/sprints', tier: 'execution',   label: 'Sprint',             priority: 90 },
  { path: '/projects/:id/backlog', tier: 'execution',   label: 'Backlog',            priority: 85 },
  { path: '/projects/:id/timeline',tier: 'execution',   label: 'Timeline',           priority: 80 },
  { path: '/control/mission-control',tier:'coordination',label:'Mission Control',    priority: 70 },
  { path: '/control/audit',        tier: 'control',     label: 'Audit',              priority: 40 },
  { path: '/settings',             tier: 'control',     label: 'Settings',           priority: 30 },
  { path: '/archive',              tier: 'archival',    label: 'Archive',            priority: 10 },
];

export function getRoutesByTier(tier: RouteTier): RouteDefinition[] {
  return ROUTE_REGISTRY.filter(r => r.tier === tier).sort((a, b) => b.priority - a.priority);
}
