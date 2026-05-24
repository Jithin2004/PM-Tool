import type { RouteDefinition, RouteTier } from './operationalRouting';
import { ROUTE_REGISTRY } from './operationalRouting';

export interface NavigationGroup {
  tier: RouteTier;
  label: string;
  routes: RouteDefinition[];
}

const TIER_LABELS: Record<RouteTier, string> = {
  execution: 'Execution',
  coordination: 'Coordination',
  control: 'Control',
  archival: 'Archival',
};

export function buildNavigationGroups(): NavigationGroup[] {
  const groups = new Map<RouteTier, RouteDefinition[]>();

  for (const route of ROUTE_REGISTRY) {
    const existing = groups.get(route.tier) ?? [];
    existing.push(route);
    groups.set(route.tier, existing);
  }

  const tierOrder: RouteTier[] = ['execution', 'coordination', 'control', 'archival'];

  return tierOrder
    .filter(tier => groups.has(tier))
    .map(tier => ({
      tier,
      label: TIER_LABELS[tier],
      routes: groups.get(tier)!.sort((a, b) => b.priority - a.priority),
    }));
}

export function isRouteActive(currentPath: string, routePath: string): boolean {
  if (routePath.includes(':id')) {
    const pattern = routePath.replace(/:id/g, '[^/]+');
    return new RegExp(`^${pattern}$`).test(currentPath);
  }
  return currentPath === routePath;
}
