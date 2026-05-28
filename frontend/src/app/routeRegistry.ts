import type { Capability } from '../core/auth/permissions';
import { normalizePath } from './routePaths';

export { normalizePath, ROUTE_ALIASES } from './routePaths';

export type SidebarGroup = 'core' | 'intelligence' | 'operations' | 'system';

/** Progressive disclosure surface tier (simple → enterprise). */
export type DisclosureTier = 'essential' | 'operational' | 'intelligence' | 'platform';

export interface SidebarNavItem {
  id: string;
  label: string;
  path: string;
  group: SidebarGroup;
  capability?: Capability;
  /** Progressive disclosure tier — defaults to essential when omitted. */
  disclosureTier: DisclosureTier;
}

/**
 * Canonical sidebar targets — every path MUST exist in EXACT_APP_PATHS or PROJECT_SUBROUTES.
 */
export const SIDEBAR_NAV: SidebarNavItem[] = [
  { id: 'overview', label: 'Overview', path: '/overview', group: 'core', capability: 'view_projects', disclosureTier: 'essential' },
  { id: 'projects', label: 'Projects', path: '/workspace', group: 'core', capability: 'view_projects', disclosureTier: 'essential' },
  { id: 'board', label: 'Tasks', path: '/execution', group: 'core', capability: 'view_tasks', disclosureTier: 'essential' },
  { id: 'scheduling', label: 'Scheduling', path: '/execution/timeline', group: 'core', capability: 'view_scheduling', disclosureTier: 'operational' },
  { id: 'analytics', label: 'Analytics', path: '/control/analytics', group: 'intelligence', capability: 'view_analytics', disclosureTier: 'intelligence' },
  { id: 'decisions', label: 'Decision Center', path: '/workspace/decisions', group: 'intelligence', capability: 'view_decision_center', disclosureTier: 'intelligence' },
  { id: 'work-logs', label: 'Work Logs', path: '/resources/work-logs', group: 'operations', capability: 'view_reports', disclosureTier: 'operational' },
  { id: 'logistics', label: 'Logistics', path: '/resources', group: 'operations', capability: 'manage_logistics', disclosureTier: 'operational' },
  { id: 'teams', label: 'Team Roster', path: '/resources/teams', group: 'operations', capability: 'view_teams', disclosureTier: 'operational' },
  { id: 'portfolio', label: 'Project Sponsors', path: '/workspace/portfolio', group: 'operations', capability: 'view_stakeholders', disclosureTier: 'intelligence' },
  { id: 'audit', label: 'Audit Log', path: '/control/audit', group: 'operations', capability: 'view_audit_log', disclosureTier: 'platform' },
  { id: 'identity', label: 'Admin & Identity', path: '/control/identity', group: 'system', capability: 'platform_governance', disclosureTier: 'platform' },
  { id: 'automations', label: 'Automations', path: '/control/automations', group: 'system', capability: 'manage_automations', disclosureTier: 'platform' },
  { id: 'mission-control', label: 'Mission Control', path: '/control/mission-control', group: 'system', capability: 'view_mission_control', disclosureTier: 'platform' },
  { id: 'settings', label: 'Settings', path: '/control/settings', group: 'system', capability: 'manage_settings', disclosureTier: 'operational' },
  { id: 'integrations', label: 'Integrations', path: '/control/connections', group: 'system', capability: 'manage_integrations', disclosureTier: 'platform' },
];

/** Exact paths handled by ResolveRouter (excluding dynamic /projects/:id/*) */
export const EXACT_APP_PATHS = new Set([
  '/',
  '/activate',
  '/login',
  '/onboarding/workspace',
  '/overview',
  '/workspace',
  '/workspace/portfolio',
  '/workspace/knowledge',
  '/workspace/decisions',
  '/execution',
  '/execution/board',
  '/execution/timeline',
  '/execution/gantt',
  '/execution/sprints',
  '/resources',
  '/resources/teams',
  '/resources/capacity',
  '/resources/work-logs',
  '/control',
  '/control/identity',
  '/control/analytics',
  '/control/audit',
  '/control/automations',
  '/control/connections',
  '/control/settings',
  '/control/settings/notifications',
  '/control/settings/modes',
  '/control/mission-control',
  '/projects/new',
]);

export const PROJECT_SUBROUTES = new Set([
  'setup',
  'backlog',
  'board',
  'sprints',
  'timeline',
]);

export function parseProjectRoute(pathname: string): {
  projectId: string;
  subRoute: string | null;
  segments: string[];
} | null {
  if (!pathname.startsWith('/projects/')) return null;
  const segments = pathname.split('/').filter(Boolean);
  if (segments.length < 2 || segments[0] !== 'projects') return null;
  const projectId = segments[1];
  const subRoute = segments[2] ?? null;
  return { projectId, subRoute, segments };
}

export function isRegisteredPath(pathname: string): boolean {
  const path = normalizePath(pathname);

  if (EXACT_APP_PATHS.has(path)) return true;

  if (path.startsWith('/workspace/knowledge/') && path.length > '/workspace/knowledge'.length + 1) {
    return true;
  }
  if (path.startsWith('/control/automations/') || path.startsWith('/control/connections/')) {
    return true;
  }

  const project = parseProjectRoute(path);
  if (!project?.projectId) return false;
  if (!project.subRoute) return true;
  if (project.subRoute === 'setup') {
    return project.segments[3] === 'execution';
  }
  return PROJECT_SUBROUTES.has(project.subRoute);
}

function validateSidebarRegistry(): void {
  if (!import.meta.env.DEV) return;
  for (const item of SIDEBAR_NAV) {
    const canonical = normalizePath(item.path);
    if (!EXACT_APP_PATHS.has(canonical)) {
      console.error(`[routeRegistry] Sidebar path not registered: ${item.path} → ${canonical}`);
    }
  }
}

validateSidebarRegistry();
