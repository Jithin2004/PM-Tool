import { normalizePath } from '../../app/routePaths';
import type { DisclosureTier, SidebarNavItem } from '../../app/routeRegistry';
import { SIDEBAR_NAV } from '../../app/routeRegistry';
import type { UserRole } from '../../types';
import { hasCapability, isOperationalReadOnly as isReadOnlyRole } from '../auth/permissions';

export type { DisclosureTier } from '../../app/routeRegistry';

/** 0 = essentials only → 3 = full enterprise surface. */
export type DisclosureLevel = 0 | 1 | 2 | 3;

const TIER_ORDER: DisclosureTier[] = ['essential', 'operational', 'intelligence', 'platform'];

export interface DisclosureMaturity {
  projectCount: number;
  taskCount: number;
  daysSinceProfile: number;
  tourCompleted: boolean;
  forceFull: boolean;
}

export interface DisclosureState {
  level: DisclosureLevel;
  maturity: DisclosureMaturity;
  nextUnlock: { level: DisclosureLevel; message: string } | null;
}

const STORAGE_PREFIX = 'resolve-disclosure';

function storageKey(workspaceId: string): string {
  return `${STORAGE_PREFIX}:${workspaceId}`;
}

export function loadDisclosurePrefs(workspaceId: string): { forceFull: boolean } {
  try {
    const raw = localStorage.getItem(storageKey(workspaceId));
    if (!raw) return { forceFull: false };
    const parsed = JSON.parse(raw) as { forceFull?: boolean };
    return { forceFull: !!parsed.forceFull };
  } catch {
    return { forceFull: false };
  }
}

export function enableFullDisclosure(workspaceId: string): void {
  try {
    localStorage.setItem(storageKey(workspaceId), JSON.stringify({ forceFull: true }));
  } catch {
    /* ignore */
  }
}

// tourCompleted is now passed explicitly

export function daysSince(isoDate: string | undefined): number {
  if (!isoDate) return 0;
  const created = new Date(isoDate).getTime();
  if (Number.isNaN(created)) return 0;
  return Math.floor((Date.now() - created) / (24 * 60 * 60 * 1000));
}

export function buildDisclosureMaturity(input: {
  workspaceId?: string;
  profileCreatedAt?: string;
  projectCount: number;
  taskCount: number;
  tourCompleted?: boolean;
}): DisclosureMaturity {
  const forceFull = input.workspaceId ? loadDisclosurePrefs(input.workspaceId).forceFull : false;
  return {
    projectCount: input.projectCount,
    taskCount: input.taskCount,
    daysSinceProfile: daysSince(input.profileCreatedAt),
    tourCompleted: !!input.tourCompleted,
    forceFull,
  };
}

/** Roles that bypass progressive limits (full surface when permitted by RBAC). */
export function bypassesProgressiveDisclosure(role: UserRole | undefined): boolean {
  return hasCapability(role, 'workspace.update');
}

export function shouldApplyProgressiveDisclosure(role: UserRole | undefined): boolean {
  if (!role || !hasCapability(role, 'project.view')) return false;
  return !bypassesProgressiveDisclosure(role);
}

export function resolveDisclosureLevel(
  maturity: DisclosureMaturity,
  role: UserRole | undefined,
): DisclosureLevel {
  if (!shouldApplyProgressiveDisclosure(role)) return 3;
  if (maturity.forceFull) return 3;

  if (hasCapability(role, 'task.update') && !hasCapability(role, 'project.update')) {
    if (maturity.taskCount >= 5 || maturity.projectCount >= 2) return 2;
    if (maturity.taskCount >= 1 || maturity.projectCount >= 1) return 1;
    return 0;
  }

  if (isReadOnlyRole(role)) {
    if (maturity.tourCompleted || maturity.daysSinceProfile >= 2) return 2;
    if (maturity.projectCount >= 1) return 1;
    return 0;
  }

  // PM — progressive trust curve
  let level: DisclosureLevel = 0;

  if (maturity.projectCount >= 1 || maturity.taskCount >= 2) {
    level = 1;
  }
  if (
    (maturity.projectCount >= 2 && maturity.taskCount >= 5) ||
    maturity.tourCompleted ||
    maturity.daysSinceProfile >= 3
  ) {
    level = 2;
  }
  if (
    (maturity.projectCount >= 3 && maturity.taskCount >= 10) ||
    (maturity.tourCompleted && maturity.daysSinceProfile >= 1) ||
    maturity.daysSinceProfile >= 7
  ) {
    level = 3;
  }

  return level;
}

function tierIndex(tier: DisclosureTier): number {
  return TIER_ORDER.indexOf(tier);
}

export function isTierUnlocked(tier: DisclosureTier, level: DisclosureLevel): boolean {
  return level >= tierIndex(tier);
}

export function isNavItemDisclosed(
  item: Pick<SidebarNavItem, 'disclosureTier'>,
  level: DisclosureLevel,
  role: UserRole | undefined,
): boolean {
  if (!shouldApplyProgressiveDisclosure(role)) return true;
  const tier = item.disclosureTier ?? 'essential';
  return isTierUnlocked(tier, level);
}

const ROUTE_TIER_MAP: Record<string, DisclosureTier> = (() => {
  const map: Record<string, DisclosureTier> = {};
  for (const item of SIDEBAR_NAV) {
    map[normalizePath(item.path)] = item.disclosureTier ?? 'essential';
  }
  const extras: Record<string, DisclosureTier> = {
    '/workspace/knowledge': 'operational',
    '/execution/board': 'essential',
    '/execution/gantt': 'operational',
    '/execution/sprints': 'operational',
    '/resources/capacity': 'intelligence',
    '/control': 'platform',
    '/control/identity': 'platform',
    '/projects/new': 'operational',
  };
  return { ...map, ...extras };
})();

export function getRouteDisclosureTier(pathname: string): DisclosureTier {
  const path = normalizePath(pathname);
  if (ROUTE_TIER_MAP[path]) return ROUTE_TIER_MAP[path];
  if (path.startsWith('/projects/')) return 'operational';
  if (path.startsWith('/workspace/knowledge/')) return 'operational';
  if (path.startsWith('/control/')) return 'platform';
  return 'essential';
}

export function isRouteDisclosed(
  pathname: string,
  level: DisclosureLevel,
  role: UserRole | undefined,
): boolean {
  if (!shouldApplyProgressiveDisclosure(role)) return true;
  const tier = getRouteDisclosureTier(pathname);
  return isTierUnlocked(tier, level);
}

export function getNextUnlockHint(
  maturity: DisclosureMaturity,
  level: DisclosureLevel,
  role: UserRole | undefined,
): { level: DisclosureLevel; message: string } | null {
  if (!shouldApplyProgressiveDisclosure(role) || level >= 3) return null;

  if (level === 0) {
    return {
      level: 1,
      message: 'Create your first project or add tasks to unlock scheduling, teams, and logistics.',
    };
  }
  if (level === 1) {
    return {
      level: 2,
      message: 'Add more delivery activity or finish the guided tour to unlock analytics and decision intelligence.',
    };
  }
  return {
    level: 3,
    message: 'Keep building momentum to unlock mission control, automations, and full platform settings.',
  };
}

export function resolveDisclosureState(input: {
  workspaceId?: string;
  role?: UserRole;
  profileCreatedAt?: string;
  projectCount: number;
  taskCount: number;
  tourCompleted?: boolean;
}): DisclosureState {
  const maturity = buildDisclosureMaturity(input);
  const level = resolveDisclosureLevel(maturity, input.role);
  return {
    level,
    maturity,
    nextUnlock: getNextUnlockHint(maturity, level, input.role),
  };
}

export function getLockedNavItems(
  level: DisclosureLevel,
  role: UserRole | undefined,
): SidebarNavItem[] {
  if (!shouldApplyProgressiveDisclosure(role)) return [];
  return SIDEBAR_NAV.filter(item => !isNavItemDisclosed(item, level, role));
}

