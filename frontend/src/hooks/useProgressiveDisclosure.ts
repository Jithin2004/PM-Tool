import { useMemo } from 'react';
import {
  getLockedNavItems,
  isNavItemDisclosed,
  isRouteDisclosed,
  resolveDisclosureState,
  shouldApplyProgressiveDisclosure,
  type DisclosureLevel,
  type DisclosureState,
} from '../core/dashboard/progressiveDisclosure';
import type { SidebarNavItem } from '../app/routeRegistry';
import type { UserRole } from '../types';

export interface UseProgressiveDisclosureInput {
  workspaceId?: string;
  role?: UserRole;
  profileCreatedAt?: string;
  projectCount: number;
  taskCount: number;
}

export interface UseProgressiveDisclosureResult extends DisclosureState {
  active: boolean;
  isNavVisible: (item: SidebarNavItem) => boolean;
  isRouteVisible: (pathname: string) => boolean;
  lockedCount: number;
}

export function useProgressiveDisclosure(
  input: UseProgressiveDisclosureInput,
): UseProgressiveDisclosureResult {
  return useMemo(() => {
    const state = resolveDisclosureState(input);
    const active = shouldApplyProgressiveDisclosure(input.role);
    const locked = getLockedNavItems(state.level, input.role);

    return {
      ...state,
      active,
      lockedCount: locked.length,
      isNavVisible: (item: SidebarNavItem) =>
        isNavItemDisclosed(item, state.level, input.role),
      isRouteVisible: (pathname: string) =>
        isRouteDisclosed(pathname, state.level, input.role),
    };
  }, [
    input.workspaceId,
    input.role,
    input.profileCreatedAt,
    input.projectCount,
    input.taskCount,
  ]);
}

export type { DisclosureLevel };
