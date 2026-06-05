import type { BUSINESS_TYPES } from '../constants/product';

export type BusinessType = typeof BUSINESS_TYPES[number];

export interface WorkspaceSettings {
  businessType: BusinessType;
  templateId?: string;
  executionMode?: string;
  defaultLanes?: number;
  workflowRules?: Record<string, any>;
  workStart: string;
  workEnd: string;
  lunchDuration: number;
  workingDays: number[];
  timezone: string;
  attendanceEnabled: boolean;
  payrollEnabled: boolean;
  productivityFactor: number;
  completionPolicy?: 'flexible' | 'controlled' | 'strict' | 'enterprise';
  allowOverallocation?: boolean;
  saturdayRule?: 'all' | 'off' | '2nd_4th' | '1st_3rd' | 'custom';
  country?: string;
  region?: string;
  city?: string;
  shutdowns?: Array<{ start: string; end: string; name: string }>;
  default_mode?: string;
  auto_archive?: boolean;
  notifications?: boolean;
  companyName?: string;
  logoUrl?: string;
  workingTimeFrom?: string;
  workingTimeTo?: string;
  departments?: string[];
  passwordPolicy?: string;
  magicLinkExpiry?: string;
  baseCurrency?: string;
}

export interface Workspace {
  id: string;
  name: string;
  ownerId: string;
  is_demo?: boolean;
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
