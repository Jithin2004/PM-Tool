import { normalizePath } from '../../app/routePaths';
import { AuthorityRole, UserRole, normalizeLegacyRole } from '../types/workspace';
import { ROUTE_CAPABILITY_MAP } from '../../app/routeRegistry';

export type Capability =
  | 'dashboard.view'
  | 'workspace.view' | 'workspace.update' | 'workspace.delete' | 'ownership.transfer' | 'license.manage'
  | 'user.invite' | 'user.manage'
  | 'project.view' | 'project.create' | 'project.update' | 'project.archive' | 'project.delete'
  | 'task.view' | 'task.create' | 'task.update' | 'task.delete' | 'task.assign'
  | 'sprint.manage'
  | 'timeline.view' | 'timeline.manage'
  | 'document.view' | 'document.manage'
  | 'file.view' | 'file.manage'
  | 'meeting.view' | 'meeting.manage'
  | 'decision.view' | 'decision.manage'
  | 'approval.view' | 'approval.manage'
  | 'people.view' | 'people.manage'
  | 'attendance.manage' | 'leave.manage'
  | 'hr.private_records'
  | 'finance.view' | 'finance.manage'
  | 'invoice.manage' | 'expense.manage'
  | 'automation.manage'
  | 'integration.manage'
  | 'settings.manage'
  | 'audit.view' | 'audit.security'
  | 'reports.view'
  | 'project.view' | 'client.project.view' | 'client.document.view' | 'client.meeting.view'
  | 'sandbox.manage' | 'sandbox.clone' | 'sandbox.reset' | 'sandbox.restore' | 'sandbox.delete' | 'sandbox.run_tests';

const ALL_CAPABILITIES: Capability[] = [
  'dashboard.view', 'workspace.view', 'workspace.update', 'workspace.delete', 'ownership.transfer', 'license.manage',
  'user.invite', 'user.manage', 'project.view', 'project.create', 'project.update', 'project.archive', 'project.delete',
  'task.view', 'task.create', 'task.update', 'task.delete', 'task.assign', 'sprint.manage', 'timeline.view', 'timeline.manage',
  'document.view', 'document.manage', 'file.view', 'file.manage', 'meeting.view', 'meeting.manage', 'decision.view', 'decision.manage', 'approval.view', 'approval.manage',
  'people.view', 'people.manage', 'attendance.manage', 'leave.manage', 'hr.private_records',
  'finance.view', 'finance.manage', 'invoice.manage', 'expense.manage',
  'automation.manage', 'integration.manage', 'settings.manage', 'audit.view', 'audit.security', 'reports.view',
  'sandbox.manage', 'sandbox.clone', 'sandbox.reset', 'sandbox.restore', 'sandbox.delete', 'sandbox.run_tests'
];

// Based on User Corrections
const ADMIN_CAPABILITIES: Capability[] = [
  'dashboard.view',
  'workspace.view', 'workspace.update',
  'user.invite', 'user.manage',
  'project.view', 'project.create', 'project.update', 'project.archive',
  'task.view', 'task.create', 'task.update', 'task.delete', 'task.assign',
  'sprint.manage', 'timeline.view', 'timeline.manage',
  'document.view', 'document.manage',
  'file.view', 'file.manage',
  'meeting.view', 'meeting.manage',
  'decision.view', 'decision.manage', 'approval.view', 'approval.manage',
  'people.view',
  'automation.manage', 'integration.manage',
  'reports.view', 'settings.manage', 'audit.view',
  'sandbox.manage', 'sandbox.clone', 'sandbox.reset', 'sandbox.restore', 'sandbox.delete', 'sandbox.run_tests'
];

const PM_CAPABILITIES: Capability[] = [
  'dashboard.view', 'workspace.view',
  'project.view', 'project.create', 'project.update', 'project.archive',
  'task.view', 'task.create', 'task.update', 'task.delete', 'task.assign',
  'sprint.manage', 'timeline.view', 'timeline.manage',
  'document.view', 'document.manage', 'file.view', 'file.manage',
  'meeting.view', 'meeting.manage', 'decision.view', 'decision.manage', 'approval.view', 'approval.manage',
  'people.view', 'reports.view'
];

const TEAM_LEAD_CAPABILITIES: Capability[] = [
  'dashboard.view', 'workspace.view', 'project.view',
  'task.view', 'task.create', 'task.update', 'task.assign',
  'sprint.manage',
  'document.view', 'document.manage', 'file.view', 'file.manage',
  'meeting.view', 'decision.view', 'approval.view', 'people.view', 'timeline.view'
];

const DEVELOPER_CAPABILITIES: Capability[] = [
  'dashboard.view', 'workspace.view', 'project.view',
  'task.view', 'task.update',
  'document.view', 'file.view', 'meeting.view', 'people.view', 'timeline.view'
];

const EMPLOYEE_CAPABILITIES: Capability[] = [
  'dashboard.view', 'workspace.view', 'project.view', 'people.view'
];

const HR_CAPABILITIES: Capability[] = [
  'dashboard.view', 'workspace.view', 'people.view', 'people.manage',
  'attendance.manage', 'leave.manage', 'hr.private_records', 'reports.view'
];

const FINANCE_CAPABILITIES: Capability[] = [
  'dashboard.view', 'workspace.view', 'people.view',
  'finance.view', 'finance.manage', 'invoice.manage', 'expense.manage', 'reports.view'
];

const CLIENT_CAPABILITIES: Capability[] = [
  'project.view', 'client.project.view', 'client.document.view', 'client.meeting.view'
];

const AUTHORITY_CAPABILITIES: Record<AuthorityRole, Capability[]> = {
  super_admin: ALL_CAPABILITIES,
  admin: ADMIN_CAPABILITIES,
  project_manager: PM_CAPABILITIES,
  team_lead: TEAM_LEAD_CAPABILITIES,
  developer: DEVELOPER_CAPABILITIES,
  employee: EMPLOYEE_CAPABILITIES,
  hr: HR_CAPABILITIES,
  finance: FINANCE_CAPABILITIES,
  client: CLIENT_CAPABILITIES,
  'pending-workspace-setup': [],
  uninvited: []
};

export function hasAuthority(profile: any, required: AuthorityRole): boolean {
  // Legacy function kept for compatibility, but deprecated.
  // We map rank explicitly here to avoid breaking any stray callers.
  const rank = {
    super_admin: 90, admin: 80, project_manager: 70, team_lead: 60,
    hr: 50, finance: 50, developer: 40, employee: 30, client: 10,
    'pending-workspace-setup': 0, uninvited: 0
  };
  
  if (!profile) return false;
  const roleStr = typeof profile === 'string' ? profile : (profile.authority || profile.role);
  const normalized = normalizeLegacyRole(roleStr);
  
  if (normalized === 'super_admin') return true;
  return (rank[normalized] || 0) >= (rank[required] || 0);
}

export function hasCapability(roleOrProfile: any, capability: Capability): boolean {
  if (!roleOrProfile) return false;
  
  let roleStr: string;
  let customCaps: string[] = [];
  
  if (typeof roleOrProfile === 'string') {
    roleStr = roleOrProfile;
  } else {
    roleStr = roleOrProfile.authority || roleOrProfile.role;
    customCaps = roleOrProfile.capabilities || [];
  }

  const normalizedRole = normalizeLegacyRole(roleStr);
  
  if (normalizedRole === 'super_admin') {
    if (ALL_CAPABILITIES.includes(capability)) return true;
  }

  const defaultCaps = AUTHORITY_CAPABILITIES[normalizedRole] || [];
  if (defaultCaps.includes(capability)) return true;
  
  if (customCaps.includes(capability)) return true;
  
  return false;
}

export function hasAnyCapability(role: UserRole | undefined, capabilities: Capability[]): boolean {
  return capabilities.some(c => hasCapability(role, c));
}

export function getCapabilities(role: UserRole | undefined): Capability[] {
  if (!role) return [];
  const normalized = normalizeLegacyRole(role);
  return AUTHORITY_CAPABILITIES[normalized] ?? [];
}

export function canAccessRoute(role: UserRole | undefined, pathname: string): boolean {
  if (!role) return false;
  
  // Clients are locked down
  const normalized = normalizeLegacyRole(role);
  if (normalized === 'client') {
    return hasCapability(role, 'project.view');
  }

  const path = normalizePath(pathname);
  const required = ROUTE_CAPABILITY_MAP[path];

  if (required === 'auth') return true;
  if (!required) {
    if (path.startsWith('/projects/')) {
      return hasCapability(role, 'project.view');
    }
    if (path.startsWith('/workspace/knowledge/')) {
      return hasCapability(role, 'document.view');
    }
    return false;
  }

  return hasCapability(role, required as Capability);
}

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
    
    while (mutationTimestamps.length > 0 && mutationTimestamps[0] < now - 10000) {
      mutationTimestamps.shift();
    }
    
    if (mutationTimestamps.length > MAX_MUTATIONS_PER_10S) {
      const msg = `Rate Limit Exceeded: Too many operational mutations requested.`;
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
export function getAuthorityRank(role: string): number {
  const normalized = normalizeLegacyRole(role);
  const rank: Record<string, number> = {
    super_admin: 90, admin: 80, project_manager: 70, team_lead: 60,
    hr: 50, finance: 50, developer: 40, employee: 30, client: 10,
    'pending-workspace-setup': 0, uninvited: 0, viewer: 10, member: 30, manager: 70, external: 10
  };
  return rank[normalized] ?? 0;
}

export function hasFunction(role: string, funcName: string): boolean {
  return getAuthorityRank(role) >= 90;
}
export function isOperationalReadOnly(role: string): boolean {
  return getAuthorityRank(role) <= 10;
}

