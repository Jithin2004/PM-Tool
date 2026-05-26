import { UserRole } from '../../types';

/**
 * CAPABILITY DEFINITIONS
 * These represent atomic actions or access points within the system.
 */
export type Capability =
  // Project & Task Management
  | 'view_projects'           // Access project lists and basic details
  | 'manage_projects'         // Create, edit, archive projects
  | 'view_tasks'              // Access task board and details
  | 'manage_tasks'            // Create, edit, move tasks
  
  // Advanced Planning & Analytics
  | 'view_scheduling'         // Access timeline and scheduling views
  | 'manage_scheduling'       // Adjust timelines and dependencies
  | 'view_analytics'          // Access performance analytics and metrics
  | 'view_decision_center'    // Access AI-driven strategy recommendations
  | 'view_reports'            // Access work logs and operational reports
  
  // Operations & Resources
  | 'manage_logistics'        // Access and modify attendance and salaries
  | 'view_teams'              // Access team roster
  | 'manage_teams'            // Create, edit teams and assignments
  | 'view_stakeholders'       // Access project sponsors/portfolio
  | 'view_audit_log'          // Access system activity logs
  
  // System & Governance
  | 'manage_settings'         // Modify workspace/project settings
  | 'manage_integrations'     // Configure external connections (Slack, GitHub, etc)
  | 'manage_automations'      // Manage automation workflows
  | 'platform_governance'     // Global user management and role assignment
  | 'platform_security';      // Root security and infrastructure controls

/**
 * ROLE-CAPABILITY MATRIX
 * The canonical source of truth for role-based authority.
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
    'view_audit_log',
    'manage_settings',
    'manage_integrations',
    'manage_automations',
  ],
  developer: [
    'view_projects',
    'view_tasks',
    'manage_tasks',
    'view_scheduling',
    'view_analytics',
    'view_decision_center',
    'view_reports',
    'view_teams',
  ],
  viewer: [
    'view_projects',
    'view_tasks',
    'view_scheduling',
    'view_analytics',
    'view_decision_center',
    'view_reports',
    'view_teams',
  ],
  uninvited: [],
  'pending-workspace-setup': [],
};

/**
 * Checks if a role has a specific capability.
 */
export function hasCapability(role: UserRole | undefined, capability: Capability): boolean {
  if (!role) return false;
  return ROLE_CAPABILITIES[role]?.includes(capability) ?? false;
}

/**
 * Returns all capabilities for a given role.
 */
export function getCapabilities(role: UserRole | undefined): Capability[] {
  if (!role) return [];
  return ROLE_CAPABILITIES[role] ?? [];
}

/**
 * Guards an action by throwing an error if the role lacks the required capability.
 */
export function guardCapability(role: UserRole | undefined, capability: Capability, operationName?: string): void {
  if (!hasCapability(role, capability)) {
    const msg = `Unauthorized: Capability "${capability}" required for operation ${operationName || 'unspecified'}. Role: ${role || 'undefined'}`;
    console.error(`[Guard] ${msg}`);
    throw new Error(msg);
  }
}
