export type AuthorityRole = 'super_admin' | 'admin' | 'project_manager' | 'team_lead' | 'developer' | 'employee' | 'hr' | 'finance' | 'client' | 'pending-workspace-setup' | 'uninvited';

// Map legacy DB strings to AuthorityRole for internal type safety where needed
export type LegacyDBRole = 'owner' | 'manager' | 'member' | 'external' | 'pm' | 'viewer';

export type UserRole = AuthorityRole | LegacyDBRole; // Transitional compatibility

export type FunctionalAccess = 
  | 'Projects'
  | 'Engineering'
  | 'Finance'
  | 'PeopleOperations'
  | 'Clients'
  | 'Documents'
  | 'Operations';

export function normalizeLegacyRole(role: string): AuthorityRole {
  if (!role) return 'employee'; // default
  
  const normalized = role.toLowerCase().replace(/\s+/g, '_');
  switch (normalized) {
    case 'owner': return 'super_admin';
    case 'manager':
    case 'pm': return 'project_manager';
    case 'member': return 'employee';
    case 'external':
    case 'viewer': return 'client';
    default: return normalized as AuthorityRole;
  }
}

export function mapAuthorityToLegacyRole(authority: AuthorityRole | string): string {
  // Pass through the new enterprise roles to the database going forward
  return authority;
}

export interface Workspace {
  id: string;
  name: string;
  owner_id: string;
  business_type: string;
  work_start: string;
  work_end: string;
  lunch_duration: number;
  workdays: number[];
  timezone: string;
  attendance_enabled: boolean;
  payroll_enabled: boolean;
  productivity_factor: number;
  created_at: string;
  updated_at: string;
}

export interface Member {
  id: string;
  auth_user_id?: string;
  workspace_id: string;
  email: string;
  full_name?: string;
  phone?: string;
  avatar_url?: string;
  role: UserRole;
  authority?: AuthorityRole;
  capabilities?: string[]; // Used for FunctionalAccess
  functionalAccess?: FunctionalAccess[];
  designation?: string;
  department?: string;
  date_of_joining?: string;
  employee_type?: string;
  metadata?: Record<string, any>;
  preferences?: Record<string, any>;
  contract_start?: string;
  contract_end?: string;
  probation_end?: string;
  employment_status?: 'active' | 'resigned' | 'terminated' | 'on_leave' | 'suspended';
  force_password_change?: boolean;
  availability_factor: number;
  external_access?: boolean;
  visibility_scope?: Record<string, any>;
  notification_preferences?: Record<string, any>;
  created_at: string;
}

/** @deprecated Use Member — kept for existing imports. */
export type User = Member;

/** @deprecated Use Member — kept for existing imports. */
export type Profile = Member;
