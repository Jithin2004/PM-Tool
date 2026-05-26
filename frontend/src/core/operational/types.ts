import type { Project, Profile, Task, TaskDependency, Team, Stats } from '../../types';

/** Canonical raw operational entities — persisted / fetched state only. */
export interface OperationalRawState {
  projects: Project[];
  tasks: Task[];
  dependencies: TaskDependency[];
  teams: Team[];
  profiles: Profile[];
  attendanceRows: AttendanceRow[];
  salaryRows: SalaryRow[];
  workspaceSettingsBlob: Record<string, unknown>;
}

export interface AttendanceRow {
  id?: string;
  workspace_id: string;
  user_id: string;
  date: string;
  status: string;
  leave_type?: string | null;
  is_paid_half_day?: boolean;
  availability_factor?: number;
}

export interface SalaryRow {
  id?: string;
  workspace_id?: string;
  user_id: string;
  base_salary: number;
}

/** Derived intelligence — recomputable from raw state; never persisted as source of truth. */
export interface OperationalDerivedState {
  projectsWithPert: Project[];
  visibleProjects: Project[];
  visibleTasks: Task[];
  stats: Stats;
  deliveryConfidence: number;
  teamBandwidth: number;
  dailyFatigue: number;
  executionPressure: number;
  riskForecast: number;
  systemData: Record<string, unknown>;
  userCustomRoles: Record<string, string>;
  customRoles: string[];
  activeTeams: Team[];
}
