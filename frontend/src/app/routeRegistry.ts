import type { Capability } from '../core/auth/permissions';
import type { UserRole } from '../types';

/** Legacy / shorthand paths → canonical app paths */
export const ROUTE_ALIASES: Record<string, string> = {
  '/admin': '/control',
  '/logistics': '/resources',
  '/pipeline': '/execution',
  '/control/logistics': '/resources',
  '/resources/logistics': '/resources',
  '/settings': '/control/settings',
  '/integrations': '/control/connections',
  '/integration': '/control/connections',
};

export function normalizePath(pathname: string): string {
  const path = pathname.split('?')[0].replace(/\/+$/, '') || '/';
  return ROUTE_ALIASES[path] ?? path;
}

export type SidebarGroup = 'core' | 'intelligence' | 'operations' | 'system';

export interface SidebarNavItem {
  id: string;
  label: string;
  path: string;
  group: SidebarGroup;
  capability?: Capability;
}

/**
 * Canonical sidebar targets — every path MUST exist in EXACT_APP_PATHS or PROJECT_SUBROUTES.
 */
export const SIDEBAR_NAV: SidebarNavItem[] = [
  { id: 'overview', label: 'Overview', path: '/overview', group: 'core', capability: 'view_projects' },
  { id: 'projects', label: 'Projects', path: '/workspace', group: 'core', capability: 'view_projects' },
  { id: 'board', label: 'Task Board', path: '/execution', group: 'core', capability: 'view_tasks' },
  { id: 'scheduling', label: 'Scheduling', path: '/execution/timeline', group: 'core', capability: 'view_scheduling' },
  { id: 'analytics', label: 'Analytics', path: '/control/analytics', group: 'intelligence', capability: 'view_analytics' },
  { id: 'decisions', label: 'Decision Center', path: '/workspace/decisions', group: 'intelligence', capability: 'view_decision_center' },
  { id: 'reports', label: 'Reports', path: '/resources/work-logs', group: 'intelligence', capability: 'view_reports' },
  { id: 'logistics', label: 'Logistics', path: '/resources', group: 'operations', capability: 'manage_logistics' },
  { id: 'teams', label: 'Team Roster', path: '/resources/teams', group: 'operations', capability: 'view_teams' },
  { id: 'portfolio', label: 'Project Sponsors', path: '/workspace/portfolio', group: 'operations', capability: 'view_stakeholders' },
  { id: 'audit', label: 'Audit Log', path: '/control/audit', group: 'operations', capability: 'view_audit_log' },
  { id: 'settings', label: 'Settings', path: '/control/settings', group: 'system', capability: 'manage_settings' },
  { id: 'integrations', label: 'Integrations', path: '/control/connections', group: 'system', capability: 'manage_integrations' },
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

export type RouteAccess =
  | { kind: 'public' }
  | { kind: 'auth' }
  | { kind: 'capability'; capability: Capability }
  | { kind: 'roles'; roles: UserRole[] };

export interface RouteDefinition {
  path: string;
  access: RouteAccess;
}

export const ROUTE_ACCESS: Record<string, RouteAccess> = {
  '/overview': { kind: 'auth' },
  '/workspace': { kind: 'auth' },
  '/workspace/portfolio': { kind: 'capability', capability: 'view_stakeholders' },
  '/workspace/knowledge': { kind: 'auth' },
  '/workspace/decisions': { kind: 'capability', capability: 'view_decision_center' },
  '/execution': { kind: 'capability', capability: 'view_tasks' },
  '/execution/board': { kind: 'capability', capability: 'view_tasks' },
  '/execution/timeline': { kind: 'capability', capability: 'view_scheduling' },
  '/execution/gantt': { kind: 'capability', capability: 'view_scheduling' },
  '/execution/sprints': { kind: 'capability', capability: 'view_scheduling' },
  '/resources': { kind: 'capability', capability: 'manage_logistics' },
  '/resources/teams': { kind: 'capability', capability: 'view_teams' },
  '/resources/capacity': { kind: 'capability', capability: 'view_reports' },
  '/resources/work-logs': { kind: 'capability', capability: 'view_reports' },
  '/control': { kind: 'capability', capability: 'platform_governance' },
  '/control/identity': { kind: 'capability', capability: 'platform_governance' },
  '/control/analytics': { kind: 'capability', capability: 'view_analytics' },
  '/control/audit': { kind: 'capability', capability: 'view_audit_log' },
  '/control/automations': { kind: 'capability', capability: 'manage_automations' },
  '/control/connections': { kind: 'capability', capability: 'manage_integrations' },
  '/control/settings': { kind: 'capability', capability: 'manage_settings' },
  '/control/settings/notifications': { kind: 'capability', capability: 'manage_settings' },
  '/control/settings/modes': { kind: 'capability', capability: 'manage_settings' },
  '/control/mission-control': { kind: 'roles', roles: ['super_admin'] },
  '/projects/new': { kind: 'capability', capability: 'manage_projects' },
};

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
