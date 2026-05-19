// Canonical Type Definitions mirroring SUPABASE_RESOLVE_PM_V2_SCHEMA.sql
// These types enforce a single source of truth across all views (Board, Gantt, Calendar, etc.)

export type UserRole = 'super_admin' | 'pm' | 'developer' | 'viewer' | 'uninvited' | 'pending-workspace-setup';
export type ProjectStatus = 'planning' | 'active' | 'review' | 'done' | 'archived' | 'deployed' | 'in-progress';
export type ProjectPriority = 'low' | 'medium' | 'high' | 'urgent';
export type RiskLevel = 'low' | 'medium' | 'high';
export type TaskStatus = 'backlog' | 'in_progress' | 'review' | 'done';
export type TaskPriority = 'low' | 'medium' | 'high' | 'urgent';
export type AttendanceStatus = 'present' | 'half_day' | 'absent';
export type LeaveType = 'casual' | 'medical' | 'unexcused';
export type NotificationCategory = 'assignments' | 'deadlines' | 'risk' | 'attendance' | 'system';

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

export interface User {
  id: string;
  auth_user_id?: string;
  workspace_id: string;
  email: string;
  full_name?: string;
  phone?: string;
  avatar_url?: string;
  role: UserRole;
  designation?: string;
  availability_factor: number;
  created_at: string;
}

export interface Team {
  id: string;
  workspace_id: string;
  name: string;
  capacity_hours_per_week?: number;
  data?: any;
  created_at: string;
  updated_at: string;
}

export interface TeamMember {
  workspace_id: string;
  team_id: string;
  user_id: string;
  member_role?: string;
}

export interface Project {
  id: string;
  workspace_id: string;
  team_id?: string;
  owner_id?: string;
  name: string;
  description?: string;
  status: ProjectStatus;
  priority: ProjectPriority;
  template: string;
  deadline?: string;
  predicted_completion?: string;
  confidence?: number;
  risk?: RiskLevel;
  delay_drift_days: number;
  pert_best?: number;
  pert_likely?: number;
  pert_worst?: number;
  efficiency?: number;
  client_deadline?: string;
  proposed_start_date?: string;
  tags?: string[];
  created_at: string;
  updated_at: string;
}

export type Profile = User;

export interface TaskDependency {
  workspace_id: string;
  task_id: string;
  depends_on_task_id: string;
}

export interface Task {
  id: string;
  workspace_id: string;
  project_id: string;
  assignee_id?: string;
  name: string;
  description?: string;
  status: TaskStatus;
  priority: TaskPriority;
  start_date?: string;
  deadline?: string;
  estimated_hours: number;
  pert_best?: number;
  pert_likely?: number;
  pert_worst?: number;
  predicted_completion?: string;
  confidence?: number;
  risk?: RiskLevel;
  delay_drift_days: number;
  created_at: string;
  updated_at: string;
}

export interface TaskDependency {
  workspace_id: string;
  task_id: string;
  depends_on_task_id: string;
}

export interface Comment {
  id: string;
  workspace_id: string;
  task_id?: string;
  project_id?: string;
  author_id?: string;
  body: string;
  created_at: string;
}

export interface FileAsset {
  id: string;
  workspace_id: string;
  project_id?: string;
  task_id?: string;
  uploaded_by?: string;
  bucket: string;
  path: string;
  name: string;
  mime_type?: string;
  size_bytes?: number;
  created_at: string;
}

export interface Notification {
  id: string;
  workspace_id: string;
  user_id?: string;
  category: NotificationCategory;
  title: string;
  body?: string;
  read_at?: string;
  created_at: string;
}

export interface ActivityLog {
  id: string;
  workspace_id: string;
  actor_id?: string;
  project_id?: string;
  task_id?: string;
  action: string;
  metadata: Record<string, any>;
  created_at: string;
}

export interface Attendance {
  id: string;
  workspace_id: string;
  user_id: string;
  date: string;
  status: AttendanceStatus;
  leave_type?: LeaveType;
  availability_factor: number;
  created_at: string;
}

export interface Stats {
  totalProjects: number;
  deliveryConfidence: number;
  teamBandwidth: number;
  dailyFatigue: number;
}
