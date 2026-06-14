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
  saturdayRule?: 'ALL_WORKING' | 'ALL_OFF' | 'FIRST_THIRD_OFF' | 'SECOND_FOURTH_OFF' | 'CUSTOM';
  country?: string;
  region?: string;
  city?: string;
  shutdowns?: { start: string; end: string; name: string }[];
  default_mode?: string;
  auto_archive?: boolean;
  notifications?: boolean;
  companyName?: string;
  logoUrl?: string;
  workingTimeFrom?: string;
  workingTimeTo?: string;
  passwordPolicy?: string;
  magicLinkExpiry?: string;
  baseCurrency?: string;
}

export type WorkspaceStatus = 'active' | 'onboarding' | 'inactive' | 'retired' | 'sandbox';

export interface Workspace {
  id: string;
  name: string;
  ownerId: string;
  is_demo?: boolean;
  is_sandbox?: boolean;
  parent_workspace_id?: string;
  status?: WorkspaceStatus;
  metadata?: Record<string, any>;
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
