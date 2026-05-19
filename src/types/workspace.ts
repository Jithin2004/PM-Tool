import type { BUSINESS_TYPES } from '../constants/product';

export type BusinessType = typeof BUSINESS_TYPES[number];

export interface WorkspaceSettings {
  businessType: BusinessType;
  workStart: string;
  workEnd: string;
  lunchDuration: number;
  workingDays: number[];
  timezone: string;
  attendanceEnabled: boolean;
  payrollEnabled: boolean;
  productivityFactor: number;
  saturdayRule?: 'all' | 'off' | '2nd_4th' | '1st_3rd' | 'custom';
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
