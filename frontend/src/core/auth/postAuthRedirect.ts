import { canAccessRoute } from './permissions';
import { isRegisteredPath, normalizePath } from '../../app/routeRegistry';
import type { UserRole } from '../../types';

const STORAGE_KEY = 'resolve.redirect.after.auth';
const DEFAULT_ENTRY = '/overview';

export function setRedirectToAfterAuth(path: string): void {
  const normalized = normalizePath(path.split('?')[0] || '/');
  if (!normalized || normalized === '/' || normalized === '/login') return;
  try {
    sessionStorage.setItem(STORAGE_KEY, normalized);
  } catch {
    /* ignore quota / private mode */
  }
}

export function peekRedirectToAfterAuth(): string | null {
  try {
    return sessionStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
}

export function consumeRedirectToAfterAuth(): string | null {
  const value = peekRedirectToAfterAuth();
  if (value) {
    try {
      sessionStorage.removeItem(STORAGE_KEY);
    } catch {
      /* ignore */
    }
  }
  return value;
}

export function captureRedirectFromLocation(): void {
  if (typeof window === 'undefined') return;
  setRedirectToAfterAuth(window.location.pathname + window.location.search);
}

/** OAuth callback URL — router + auth reconciliation run on this path. */
export function buildOAuthRedirectUrl(): string {
  return `${window.location.origin}${DEFAULT_ENTRY}`;
}

export function resolvePostAuthEntryPath(role: UserRole | undefined): string {
  if (role === 'pending-workspace-setup') return '/onboarding/workspace';
  if (role === 'uninvited') return '/login?error=uninvited';
  const { getAuthorityRank } = require('./permissions');
  const rank = getAuthorityRank(role);

  if (rank >= getAuthorityRank('admin')) return '/control';
  if (rank === getAuthorityRank('manager')) return '/overview';
  if (rank === getAuthorityRank('member')) return '/execution';
  if (rank <= getAuthorityRank('viewer')) return '/workspace/portfolio';
  return DEFAULT_ENTRY;
}

export function resolveAuthenticatedDestination(
  role: UserRole | undefined,
  hasWorkspace: boolean,
  storedRedirect?: string | null,
): string {
  if (role === 'uninvited') return '/login?error=uninvited';
  
  if (!hasWorkspace) {
    if (role === 'pending-workspace-setup') {
      return '/onboarding/workspace';
    }
    return '/login?error=access_denied';
  }

  const candidate = storedRedirect ? normalizePath(storedRedirect) : null;
  
  if (candidate === '/onboarding/workspace' && role !== 'pending-workspace-setup') {
    return resolvePostAuthEntryPath(role);
  }

  if (candidate && candidate !== '/' && isRegisteredPath(candidate) && canAccessRoute(role, candidate)) {
    return candidate;
  }

  return resolvePostAuthEntryPath(role);
}

export function navigateTo(path: string, replace = true): void {
  if (typeof window === 'undefined') return;
  if (replace) {
    window.history.replaceState(null, '', path);
  } else {
    window.history.pushState(null, '', path);
  }
  window.dispatchEvent(new Event('popstate'));
}
