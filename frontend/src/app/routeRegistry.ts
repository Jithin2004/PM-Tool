import React from 'react';
import type { Capability } from '../core/auth/permissions';
import { RouteIcon } from '../components/ui/RouteIcon';

export type SidebarGroup = 'core' | 'intelligence' | 'resources' | 'system';
export type DisclosureTier = 'essential' | 'operational' | 'intelligence' | 'platform';

export interface AppRoute {
  id: string;
  path: string;
  label: string;
  iconName: string;
  capability?: Capability;
  group?: SidebarGroup;
  disclosureTier: DisclosureTier;
  isPublic?: boolean;
}

export interface SidebarNavItem {
  id: string;
  label: string;
  path: string;
  group: SidebarGroup;
  capability?: Capability;
  disclosureTier: DisclosureTier;
  iconName: string;
}

// Canonical routes registry
export const CANONICAL_ROUTES: AppRoute[] = [
  // Core routes
  { id: 'overview', path: '/overview', label: 'Overview', iconName: 'Radar', capability: 'dashboard.view', group: 'core', disclosureTier: 'essential' },
  { id: 'activity', path: '/overview/activity', label: 'Activity Feed', iconName: 'Activity', capability: 'dashboard.view', group: 'core', disclosureTier: 'essential' },
  { id: 'projects', path: '/workspace', label: 'Projects', iconName: 'TreeStructure', capability: 'project.view', group: 'core', disclosureTier: 'essential' },
  { id: 'execution-board', path: '/execution/board', label: 'Tasks', iconName: 'Kanban', capability: 'task.view', group: 'core', disclosureTier: 'essential' },
  { id: 'execution-sprints', path: '/execution/sprints', label: 'Sprint Center', iconName: 'GitFork', capability: 'sprint.manage', group: 'core', disclosureTier: 'operational' },
  { id: 'execution-schedule', path: '/execution/schedule', label: 'Scheduling', iconName: 'Timeline', capability: 'timeline.view', group: 'core', disclosureTier: 'operational' },
  { id: 'meetings', path: '/workspace/meetings', label: 'Meetings', iconName: 'Users', capability: 'meeting.view', group: 'core', disclosureTier: 'essential' },
  { id: 'requirements', path: '/workspace/requirements', label: 'Requirements', iconName: 'FileText', capability: 'project.view', group: 'core', disclosureTier: 'essential' },
  { id: 'documents', path: '/workspace/documents', label: 'Documents', iconName: 'FolderOpen', capability: 'document.view', group: 'core', disclosureTier: 'essential' },
  { id: 'approvals', path: '/workspace/approvals', label: 'Approvals', iconName: 'CheckCircle', capability: 'approval.view', group: 'core', disclosureTier: 'essential' },
  { id: 'files', path: '/workspace/files', label: 'File Center', iconName: 'FolderOpen', capability: 'file.view', group: 'core', disclosureTier: 'operational' },
  { id: 'employee-onboarding', path: '/workspace/onboarding', label: 'Onboarding Center', iconName: 'Compass', capability: 'workspace.view', group: 'core', disclosureTier: 'essential' },
  
  // Extra core (legacy/other)
  { id: 'knowledge', path: '/workspace/knowledge', label: 'Knowledge Hub', iconName: 'ArchiveBox', capability: 'document.view', group: 'core', disclosureTier: 'essential' },
  { id: 'scheduling', path: '/execution/schedule', label: 'Scheduling', iconName: 'Timeline', capability: 'timeline.view', group: 'core', disclosureTier: 'operational' },
  
  // Reports routes
  { id: 'analytics', path: '/admin/analytics', label: 'Analytics', iconName: 'ChartLineUp', capability: 'reports.view', group: 'intelligence', disclosureTier: 'intelligence' },
  { id: 'decisions', path: '/workspace/decisions', label: 'Decision Center', iconName: 'Compass', capability: 'decision.view', group: 'intelligence', disclosureTier: 'intelligence' },
  
  // Resources routes
  { id: 'work-logs', path: '/company/work-logs', label: 'Work Logs', iconName: 'Notebook', capability: 'reports.view', group: 'resources', disclosureTier: 'operational' },
  { id: 'logistics', path: '/company', label: 'Attendance & Leave', iconName: 'UserCog', capability: 'people.view', group: 'resources', disclosureTier: 'operational' },
  { id: 'finance', path: '/finance', label: 'Accounts & Finance', iconName: 'Landmark', capability: 'finance.view', group: 'resources', disclosureTier: 'platform' },
  { id: 'teams', path: '/company/teams', label: 'Employees & Departments', iconName: 'UsersThree', capability: 'people.view', group: 'resources', disclosureTier: 'operational' },
  { id: 'capacity', path: '/company/capacity', label: 'Capacity Forecast', iconName: 'BarChart3', capability: 'reports.view', group: 'resources', disclosureTier: 'operational' },
  { id: 'portfolio', path: '/workspace/portfolio', label: 'Client Profiles', iconName: 'Building2', capability: 'project.view', group: 'resources', disclosureTier: 'intelligence' },
  { id: 'audit', path: '/admin/audit', label: 'Audit Log', iconName: 'Activity', capability: 'audit.view', group: 'resources', disclosureTier: 'platform' },
  
  // System routes
  { id: 'document-templates', path: '/admin/document-templates', label: 'Document Templates', iconName: 'FileText', capability: 'settings.manage', group: 'system', disclosureTier: 'platform' },
  { id: 'identity', path: '/admin/identity', label: 'Access Control', iconName: 'Shield', capability: 'user.manage', group: 'system', disclosureTier: 'platform' },
  { id: 'connections', path: '/admin/connections', label: 'Integrations', iconName: 'Link', capability: 'integration.manage', group: 'system', disclosureTier: 'platform' },
  { id: 'automations', path: '/admin/automations', label: 'Automations', iconName: 'Zap', capability: 'automation.manage', group: 'system', disclosureTier: 'platform' },
  { id: 'mission-control', path: '/admin/mission-control', label: 'Dashboard', iconName: 'LayoutDashboard', capability: 'dashboard.view', group: 'intelligence', disclosureTier: 'platform' },
  { id: 'system-health', path: '/admin/system-health', label: 'System Health', iconName: 'Activity', capability: 'audit.view', group: 'system', disclosureTier: 'platform' },
  { id: 'settings', path: '/admin/settings', label: 'Settings', iconName: 'Settings', capability: 'settings.manage', group: 'system', disclosureTier: 'operational' },

  // Executive routes
  { id: 'executive', path: '/workspace/executive', label: 'Executive Overview', iconName: 'Binoculars', capability: 'reports.view', group: 'intelligence', disclosureTier: 'intelligence' },
  { id: 'reports', path: '/workspace/reports', label: 'Reports Center', iconName: 'Files', capability: 'reports.view', group: 'intelligence', disclosureTier: 'intelligence' },


  // Non-sidebar / helper routes
  { id: 'landing', path: '/', label: 'Home', iconName: 'LayoutDashboard', isPublic: true, disclosureTier: 'essential' },
  { id: 'privacy', path: '/privacy', label: 'Privacy Policy', iconName: 'FileText', isPublic: true, disclosureTier: 'essential' },
  { id: 'terms', path: '/terms', label: 'Terms of Service', iconName: 'FileText', isPublic: true, disclosureTier: 'essential' },
  { id: 'compliance', path: '/compliance', label: 'Compliance', iconName: 'FileText', isPublic: true, disclosureTier: 'essential' },
  { id: 'security', path: '/security', label: 'Security', iconName: 'FileText', isPublic: true, disclosureTier: 'essential' },
  { id: 'activate', path: '/activate-license', label: 'Activate', iconName: 'Key', isPublic: true, disclosureTier: 'essential' },
  { id: 'login', path: '/login', label: 'Login', iconName: 'Lock', isPublic: true, disclosureTier: 'essential' },
  { id: 'onboarding', path: '/onboarding/workspace', label: 'Workspace Setup', iconName: 'Building2', disclosureTier: 'essential' },
  { id: 'project-new', path: '/projects/new', label: 'Create Project', iconName: 'PlusCircle', capability: 'project.create', disclosureTier: 'essential' },
  { id: 'control-root', path: '/admin', label: 'Control', iconName: 'Shield', capability: 'settings.manage', disclosureTier: 'platform' },
  { id: 'settings-notifications', path: '/admin/settings/notifications', label: 'Notification Settings', iconName: 'Bell', capability: 'settings.manage', disclosureTier: 'operational' },
  { id: 'settings-modes', path: '/admin/settings/modes', label: 'Mode Settings', iconName: 'Sliders', capability: 'settings.manage', disclosureTier: 'operational' }
];

export const EXACT_APP_PATHS = new Set(CANONICAL_ROUTES.map(r => r.path));

export const SIDEBAR_NAV: SidebarNavItem[] = CANONICAL_ROUTES
  .filter(r => r.group !== undefined)
  .map(r => ({
    id: r.id,
    label: r.label,
    path: r.path,
    group: r.group!,
    capability: r.capability,
    disclosureTier: r.disclosureTier,
    iconName: r.iconName
  }));

export const ROUTE_CAPABILITY_MAP: Record<string, Capability | 'auth'> = CANONICAL_ROUTES.reduce((map, r) => {
  map[r.path] = r.capability || 'auth';
  return map;
}, {} as Record<string, Capability | 'auth'>);

export const PROJECT_SUBROUTES = new Set([
  'setup',
  'backlog',
  'board',
  'sprints',
  'timeline',
]);

export function renderRouteIcon(name: string, className = "w-[15px] h-[15px] shrink-0"): React.ReactNode {
  return React.createElement(RouteIcon, { name, className });
}

import { normalizePath } from './routePaths';
export { normalizePath, ROUTE_ALIASES } from './routePaths';

export function parseProjectRoute(pathname: string): {
  projectId: string;
  subRoute: string | null;
  segments: string[];
} | null {
  if (!pathname.startsWith('/projects/')) return null;
  const segments = pathname.split('/').filter(Boolean);
  if (segments.length < 2 || segments[0] !== 'projects') return null;
  const projectId = segments[1];
  const subRoute = segments[2] ?? null;
  return { projectId, subRoute, segments };
}

export function isRegisteredPath(pathname: string): boolean {
  const path = normalizePath(pathname);

  if (EXACT_APP_PATHS.has(path)) return true;

  if (path.startsWith('/workspace/knowledge/') && path.length > '/workspace/knowledge'.length + 1) {
    return true;
  }
  if (path.startsWith('/accept-invite/')) {
    return true;
  }
  if (path.startsWith('/admin/automations/') || path.startsWith('/admin/connections/')) {
    return true;
  }

  const project = parseProjectRoute(path);
  if (!project?.projectId) return false;
  if (!project.subRoute) return true;
  if (project.subRoute === 'setup') {
    return project.segments[3] === 'execution';
  }
  return PROJECT_SUBROUTES.has(project.subRoute);
}

function validateSidebarRegistry(): void {
  if (!import.meta.env.DEV) return;
  for (const item of SIDEBAR_NAV) {
    const canonical = normalizePath(item.path);
    if (!EXACT_APP_PATHS.has(canonical)) {
      console.error(`[routeRegistry] Sidebar path not registered: ${item.path} → ${canonical}`);
    }
  }
}

validateSidebarRegistry();
