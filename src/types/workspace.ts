import type { BUSINESS_TYPES } from '../constants/product';

export type BusinessType = typeof BUSINESS_TYPES[number];

export interface WorkspaceSettings {
  businessType: BusinessType;
  teamSize: number;
  workStart: string;
  workEnd: string;
  lunchDurationMinutes: number;
  workingDays: number[];
  timezone: string;
  attendanceEnabled: boolean;
  payrollEnabled: boolean;
  productivityFactor: number;
}

export interface Workspace {
  id: string;
  name: string;
  ownerId: string;
  settings: WorkspaceSettings;
  createdAt: string;
  updatedAt?: string;
}

export interface TeamCapacity {
  teamId: string;
  memberCount: number;
  currentLoadHours: number;
  availabilityFactor: number;
}
