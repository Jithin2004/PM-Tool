import { normalizePath } from '../../app/routePaths';
import type { UserRole } from '../../types';

/**
 * Canonical capabilities — single source of operational authority.
 */
export type Capability =
  | 'view_projects'
  | 'manage_projects'
  | 'view_tasks'
  | 'manage_tasks'
  | 'view_scheduling'
  | 'manage_scheduling'
  | 'view_analytics'
  | 'view_decision_center'
  | 'view_reports'
  | 'manage_logistics'
  | 'view_teams'
  | 'manage_teams'
  | 'view_stakeholders'
  | 'view_audit_log'
  | 'manage_settings'
  | 'manage_integrations'
  | 'manage_automations'
  | 'platform_governance'
  | 'platform_security'
  | 'view_mission_control';

const VIEW_CAPABILITIES: Capability[] = [
  'view_projects',
  'view_tasks',
  'view_scheduling',
  'view_analytics',
  'view_decision_center',
  'view_reports',
  'view_teams',
  'view_stakeholders',
  'view_audit_log',
];

/**
 * Role → capability matrix (canonical).
 *
 * PM: operational leadership — settings, integrations, logistics, analytics, delivery systems.
 * Developer: execution / sprint / task delivery focus.
 * Viewer: read-only operational visibility.
 * Super Admin: full platform including governance & security.
 */
const ROLE_CAPABILITIES: Record<UserRole, Capability[]> = {
  super_admin: [
    'view_projects',
    'manage_projects',
    'view_tasks',
    'manage_tasks',
    'view_scheduling',
    'manage_scheduling',
    'view_analytics',
    'view_decision_center',
    'view_reports',
    'manage_logistics',
    'view_teams',
    'manage_teams',
    'view_stakeholders',
    'view_audit_log',
    'manage_settings',
    'manage_integrations',
    'manage_automations',
    'platform_governance',
    'platform_security',
    'view_mission_control',
  ],
  pm: [
    'view_projects',
    'manage_projects',
    'view_tasks',
    'manage_tasks',
    'view_scheduling',
    'manage_scheduling',
    'view_analytics',
    'view_decision_center',
    'view_reports',
    'manage_logistics',
    'view_teams',
    'manage_teams',
    'view_stakeholders',
    'manage_settings',
    'manage_integrations',
    'manage_automations',
  ],
  developer: [
    'view_projects',
    'view_tasks',
    'manage_tasks',
    'view_scheduling',
    'view_teams',
  ],
  viewer: [...VIEW_CAPABILITIES],
  uninvited: [],
  'pending-workspace-setup': [],
};

/** Route path → required capability (after normalizePath). */
export const ROUTE_CAPABILITY_MAP: Record<string, Capability | 'auth'> = {
  '/overview': 'auth',
  '/workspace': 'view_projects',
  '/workspace/portfolio': 'view_stakeholders',
  '/workspace/knowledge': 'view_projects',
  '/workspace/decisions': 'view_decision_center',
  '/execution': 'view_tasks',
  '/execution/board': 'view_tasks',
  '/execution/timeline': 'view_scheduling',
  '/execution/gantt': 'view_scheduling',
  '/execution/sprints': 'view_scheduling',
  '/resources': 'manage_logistics',
  '/resources/teams': 'view_teams',
  '/resources/capacity': 'view_reports',
  '/resources/work-logs': 'view_reports',
  '/control': 'platform_governance',
  '/control/identity': 'platform_governance',
  '/control/analytics': 'view_analytics',
  '/control/audit': 'view_audit_log',
  '/control/automations': 'manage_automations',
  '/control/connections': 'manage_integrations',
  '/control/settings': 'manage_settings',
  '/control/settings/notifications': 'manage_settings',
  '/control/settings/modes': 'manage_settings',
  '/control/mission-control': 'view_mission_control',
  '/projects/new': 'manage_projects',
};

export function hasCapability(role: UserRole | undefined, capability: Capability): boolean {
  if (!role) return false;
  return ROLE_CAPABILITIES[role]?.includes(capability) ?? false;
}

export function hasAnyCapability(role: UserRole | undefined, capabilities: Capability[]): boolean {
  return capabilities.some(c => hasCapability(role, c));
}

export function isOperationalReadOnly(role: UserRole | undefined): boolean {
  return role === 'viewer';
}

export function canWriteOperationally(role: UserRole | undefined): boolean {
  if (!role || role === 'uninvited' || role === 'pending-workspace-setup') return false;
  return !isOperationalReadOnly(role);
}

export function getCapabilities(role: UserRole | undefined): Capability[] {
  if (!role) return [];
  return ROLE_CAPABILITIES[role] ?? [];
}

export function canAccessRoute(role: UserRole | undefined, pathname: string): boolean {
  if (!role || role === 'uninvited' || role === 'pending-workspace-setup') return false;

  const path = normalizePath(pathname);
  const required = ROUTE_CAPABILITY_MAP[path];

  if (required === 'auth') return true;
  if (!required) {
    if (path.startsWith('/projects/')) {
      return hasCapability(role, 'view_tasks');
    }
    if (path.startsWith('/workspace/knowledge/')) {
      return hasCapability(role, 'view_projects');
    }
    return false;
  }

  return hasCapability(role, required);
}

export function guardCapability(
  role: UserRole | undefined,
  capability: Capability,
  operationName?: string,
): void {
  if (!hasCapability(role, capability)) {
    const msg = `Unauthorized: capability "${capability}" required${operationName ? ` for ${operationName}` : ''}.`;
    console.error(`[Guard] ${msg}`);
    throw new Error(msg);
  }
}
