import { normalizePath } from '../../app/routePaths';
import type { AuthorityRole, FunctionalAccess, UserRole } from '../../types';

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
  | 'manage_compensation'
  | 'platform_governance'
  | 'platform_security'
  | 'manage_finance'
  | 'view_mission_control'
  // Sprint 1 HR & Finance Capabilities
  | 'manage_employees'
  | 'manage_attendance'
  | 'manage_employment_records'
  | 'manage_payroll'
  | 'manage_invoice'
  | 'manage_expenses'
  | 'approve_work'
  | 'assign_tasks'
  | 'manage_meetings'
  | 'manage_workspace'
  | 'manage_roles';

const VIEW_CAPABILITIES: Capability[] = [
  'view_projects',
  'view_tasks',
  'view_analytics',
  'view_decision_center',
  'view_reports',
  'view_teams',
  'view_stakeholders',
  'view_audit_log',
];

const FUNCTION_CAPABILITIES: Record<FunctionalAccess, Capability[]> = {
  Projects: ['manage_projects', 'manage_tasks', 'view_projects', 'view_tasks', 'view_scheduling', 'manage_scheduling', 'view_teams'],
  Engineering: ['view_projects', 'view_tasks', 'manage_tasks', 'view_scheduling', 'view_teams'],
  Finance: ['view_projects', 'manage_payroll', 'manage_invoice', 'manage_expenses', 'manage_finance', 'view_reports'],
  PeopleOperations: ['view_projects', 'view_teams', 'manage_employees', 'manage_attendance', 'manage_employment_records', 'view_analytics', 'manage_compensation'],
  Clients: ['view_projects', 'view_tasks', 'view_stakeholders'],
  Documents: ['view_projects'],
  Operations: ['view_projects', 'view_reports', 'manage_logistics', 'view_analytics']
};

const AUTHORITY_CAPABILITIES: Record<AuthorityRole, Capability[]> = {
  owner: [
    'view_projects', 'manage_projects', 'view_tasks', 'manage_tasks', 'view_scheduling', 'manage_scheduling', 'view_analytics', 'view_decision_center', 'view_reports', 'manage_logistics', 'view_teams', 'manage_teams', 'view_stakeholders', 'view_audit_log', 'manage_settings', 'manage_integrations', 'manage_automations', 'manage_compensation', 'manage_finance', 'platform_governance', 'platform_security', 'view_mission_control', 'manage_roles', 'manage_workspace', 'manage_employees', 'manage_attendance', 'manage_employment_records', 'manage_payroll', 'manage_invoice', 'manage_expenses', 'approve_work', 'assign_tasks', 'manage_meetings'
  ],
  admin: [
    'view_projects', 'manage_projects', 'view_tasks', 'manage_tasks', 'view_scheduling', 'manage_scheduling', 'view_analytics', 'view_decision_center', 'view_reports', 'manage_logistics', 'view_teams', 'manage_teams', 'view_stakeholders', 'view_audit_log', 'manage_settings', 'manage_integrations', 'manage_automations', 'manage_finance', 'view_mission_control', 'manage_workspace', 'manage_employees', 'manage_attendance', 'manage_employment_records', 'manage_payroll', 'manage_invoice', 'manage_expenses', 'approve_work', 'assign_tasks', 'manage_meetings'
  ],
  manager: [
    'view_projects', 'manage_projects', 'view_tasks', 'manage_tasks', 'view_scheduling', 'manage_scheduling', 'view_analytics', 'view_decision_center', 'view_reports', 'manage_logistics', 'view_teams', 'manage_teams', 'view_stakeholders', 'approve_work', 'assign_tasks', 'manage_meetings'
  ],
  member: [
    'view_projects', 'view_tasks', 'manage_tasks', 'view_scheduling', 'view_teams'
  ],
  external: [
    'view_projects', 'view_tasks', 'view_stakeholders'
  ],
  'pending-workspace-setup': [],
  uninvited: []
};

import { ROUTE_CAPABILITY_MAP } from '../../app/routeRegistry';

export function getAuthorityRank(role: AuthorityRole | string | undefined): number {
  switch (role) {
    case 'owner': return 50;
    case 'super_admin': return 50; // Legacy mapping fallback
    case 'admin': return 40;
    case 'manager': return 30;
    case 'pm': return 30; // Legacy mapping fallback
    case 'member': return 20;
    case 'developer': return 20; // Legacy mapping fallback
    case 'hr': return 20; // Legacy fallback
    case 'finance': return 20; // Legacy fallback
    case 'external': return 10;
    case 'client': return 10; // Legacy mapping fallback
    case 'viewer': return 10;
    default: return 0;
  }
}

export function hasAuthority(profile: any, required: AuthorityRole): boolean {
  if (!profile) return false;
  const roleStr = typeof profile === 'string' ? profile : (profile.authority || profile.role);
  return getAuthorityRank(roleStr) >= getAuthorityRank(required);
}

export function hasFunction(profile: any, requiredFunc: FunctionalAccess): boolean {
  if (!profile) return false;
  const funcs = profile.functionalAccess || profile.capabilities || [];
  return funcs.includes(requiredFunc);
}

export function hasCapability(roleOrProfile: any, capability: Capability): boolean {
  if (!roleOrProfile) return false;
  
  let roleStr: AuthorityRole | string;
  let customCaps: string[] = [];
  
  if (typeof roleOrProfile === 'string') {
    roleStr = roleOrProfile;
  } else {
    roleStr = roleOrProfile.authority || roleOrProfile.role;
    customCaps = roleOrProfile.capabilities || [];
  }

  // Fallback to legacy super_admin string literal match before evaluating map
  if (roleStr === 'super_admin') return true;
  
  // 1. Check Authority explicitly
  let normalizedRole: AuthorityRole = 'member';
  if (roleStr === 'super_admin' || roleStr === 'owner') normalizedRole = 'owner';
  else if (roleStr === 'admin') normalizedRole = 'admin';
  else if (roleStr === 'pm' || roleStr === 'manager') normalizedRole = 'manager';
  else if (roleStr === 'developer') normalizedRole = 'member';
  else if (roleStr === 'client' || roleStr === 'viewer' || roleStr === 'external') normalizedRole = 'external';

  // 2. Check Role-based static capabilities
  const defaultCaps = AUTHORITY_CAPABILITIES[normalizedRole] || [];
  if (defaultCaps.includes(capability)) return true;
  
  // 3. Look for explicitly granted exact string capabilities
  if (customCaps.includes(capability)) return true;
  
  // 4. Check Functions
  const functionalAccess: FunctionalAccess[] = roleOrProfile?.functionalAccess || [];
  for (const f of functionalAccess) {
    if (FUNCTION_CAPABILITIES[f]?.includes(capability)) return true;
  }
  
  return false;
}

export function isOperationalReadOnly(role: UserRole | undefined): boolean {
  if (!role) return true;
  return hasCapability(role, 'view_projects') && !hasCapability(role, 'manage_tasks') && !hasCapability(role, 'manage_projects');
}

export function hasAnyCapability(role: UserRole | undefined, capabilities: Capability[]): boolean {
  return capabilities.some(c => hasCapability(role, c));
}

export function canWriteOperationally(role: UserRole | undefined): boolean {
  if (!role || !hasCapability(role, 'view_projects')) return false;
  return !isOperationalReadOnly(role);
}

export function getCapabilities(role: UserRole | undefined): Capability[] {
  if (!role) return [];
  return ROLE_CAPABILITIES[role] ?? [];
}

export function canAccessRoute(role: UserRole | undefined, pathname: string): boolean {
  if (!role || !hasCapability(role, 'view_projects')) return false;

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

// Fix 5: Rate Limiting & Abuse Resilience (Frontend mutation governance)
const mutationTimestamps: number[] = [];
const MAX_MUTATIONS_PER_10S = 30;

export function guardCapability(
  role: UserRole | undefined,
  capability: Capability,
  operationName?: string,
): void {
  if (operationName) {
    const now = Date.now();
    mutationTimestamps.push(now);
    
    // Clean up timestamps older than 10 seconds
    while (mutationTimestamps.length > 0 && mutationTimestamps[0] < now - 10000) {
      mutationTimestamps.shift();
    }
    
    if (mutationTimestamps.length > MAX_MUTATIONS_PER_10S) {
      const msg = `Rate Limit Exceeded: Too many operational mutations requested. Please wait before retrying.`;
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('notify-toast', { detail: { message: msg, type: 'error' } }));
      }
      throw new Error(msg);
    }
  }

  if (!hasCapability(role, capability)) {
    const msg = `Unauthorized: capability "${capability}" required${operationName ? ` for ${operationName}` : ''}.`;
    console.error(`[Guard] ${msg}`);
    throw new Error(msg);
  }
}
