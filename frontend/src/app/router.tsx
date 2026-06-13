import React, { useEffect, useRef, useState } from 'react';
import { useWorkspace } from '../context/WorkspaceContext';
import { useAuth } from '../context/AuthContext';
import { useOperationalData } from '../context/OperationalDataContext';
import { canAccessRoute } from '../core/auth/permissions';
import type { UserRole } from '../types';
import {
  consumeRedirectToAfterAuth,
  resolveAuthenticatedDestination,
} from '../core/auth/postAuthRedirect';
// AuthPage removed — unified to Login component (Bug 6 fix)
import DashboardLayout from '../pages/dashboard/DashboardLayout';
import { Login } from '../components/auth/Login';
import { PasswordSetup } from '../components/auth/PasswordSetup';
import { PasswordSetup } from '../components/auth/PasswordSetup';
import { ProductKeyGate } from '../components/auth/ProductKeyGate';
import { isProductKeyVerified } from '../lib/productKey';
import { normalizePath, parseProjectRoute, isRegisteredPath } from './routeRegistry';

// ── Lazy-loaded route pages ──

const withRetry = (componentImport: () => Promise<any>) => {
  return lazy(async () => {
    const importStr = componentImport.toString();
    const chunkNameMatch = importStr.match(/import\(['"]([^'"]+)['"]\)/);
    const chunkName = chunkNameMatch ? chunkNameMatch[1] : 'unknown chunk';

    console.log(`[lazy] importing: ${chunkName}`);

    try {
      const module = await componentImport();
      console.log(`[lazy] resolved: ${chunkName}`);
      sessionStorage.removeItem('chunk_reload_count');
      return module;
    } catch (error: any) {
      console.error(`[withRetry] error:`, error);
      if (error?.message?.includes('Failed to fetch dynamically imported module')) {
        const reloadCount = parseInt(sessionStorage.getItem('chunk_reload_count') || '0', 10);
        if (reloadCount < 2) {
          sessionStorage.setItem('chunk_reload_count', (reloadCount + 1).toString());
          window.location.reload();
          return { default: () => <RouteFallback /> };
        }
      }
      return { default: () => <div className="flex items-center justify-center min-h-[50vh] p-8 text-center text-rose-400/80 font-mono text-sm tracking-tight border border-rose-500/10 rounded-lg bg-rose-500/5 max-w-md mx-auto mt-20">System partition failed to load. Please verify connection and refresh.</div> };
    }
  });
};

import { WorkspaceSetupWizard } from '../pages/onboarding/WorkspaceSetupWizard';
import { AcceptInvitePage } from '../pages/onboarding/AcceptInvitePage';
import { LandingPage } from '../landing/LandingPage';
import { PrivacyPage } from '../landing/PrivacyPage';
import { TermsPage } from '../landing/TermsPage';
import { CompliancePage } from '../landing/CompliancePage';
import { SecurityPage } from '../landing/SecurityPage';

import { DailyCommandCenter } from '../components/overview/DailyCommandCenter';

import { AdminPanel } from '../pages/dashboard/AdminPanel';
import { LogisticsPanel } from '../pages/dashboard/LogisticsPanel';
import ProjectsPage from '../pages/workspace/ProjectsPage';
import PortfolioPage from '../pages/workspace/PortfolioPage';
import KnowledgePage from '../pages/workspace/KnowledgePage';
import DecisionsPage from '../pages/workspace/DecisionsPage';
import MeetingsPage from '../pages/workspace/MeetingsPage';
import RequirementsPage from '../pages/workspace/RequirementsPage';
import DocumentsPage from '../pages/workspace/DocumentsPage';
import ApprovalsPage from '../pages/workspace/ApprovalsPage';
import { EmployeeStartCenter } from '../components/onboarding/EmployeeStartCenter';


import { ProductAdoptionDashboard } from '../pages/workspace/ProductAdoptionDashboard';
import ReportsCenter from '../pages/workspace/ReportsCenter';

import BoardPage from '../pages/execution/BoardPage';
import TimelinePage from '../pages/execution/TimelinePage';
import GanttPage from '../pages/execution/GanttPage';
import SprintPage from '../pages/execution/SprintPage';

import TeamsPage from '../pages/resources/TeamsPage';
import CapacityPage from '../pages/resources/CapacityPage';
import WorkLogsPage from '../pages/resources/WorkLogsPage';
import FinancePage from '../pages/resources/FinancePage';

import AnalyticsPage from '../pages/control/AnalyticsPage';
import AuditPage from '../pages/control/AuditPage';
import DocumentTemplatesPage from '../pages/control/DocumentTemplatesPage';
import { ObservabilityPanel } from '../pages/dashboard/ObservabilityPanel';
import SettingsPage from '../pages/control/SettingsPage';

import DocumentView from '../pages/dashboard/DocumentView';
import AutomationsPanel from '../pages/dashboard/AutomationsPanel';
import ConnectionsPanel from '../pages/dashboard/ConnectionsPanel';
import NotificationSettings from '../pages/dashboard/NotificationSettings';
import ModeSettings from '../pages/dashboard/ModeSettings';
import MissionControlPage from '../pages/mission-control/MissionControlPage';

import ExecutionSetupPage from '../pages/setup/ExecutionSetupPage';
import BacklogPage from '../pages/backlog/BacklogPage';
import ProjectBoardPage from '../pages/board/ProjectBoardPage';
import ProjectSprintPage from '../pages/sprints/ProjectSprintPage';
import ProjectTimelinePage from '../pages/timeline/ProjectTimelinePage';
import { SharedProjectDashboard } from '../pages/shared/SharedProjectDashboard';

const DEFAULT_AUTH_REDIRECT = '/overview';

function RouteFallback() {
  console.log('[RouteFallback] Rendering "Loading workspace..." fallback');
  return (
    <div className="flex min-h-[60vh] items-center justify-center font-geist text-[10px] uppercase tracking-widest text-text-tertiary">
      <div className="flex items-center gap-3">
        <div className="h-4 w-4 animate-spin rounded-full border-2 border-indigo-500/30 border-t-indigo-400" />
        Loading workspace...
      </div>
    </div>
  );
}

const FALLBACK = <RouteFallback />;

function AccessRestricted() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] font-geist text-center px-4" style={{ color: 'var(--pm-on-surface)' }}>
      <div className="w-16 h-16 rounded-full mb-6 flex items-center justify-center bg-red-500/10">
        <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-red-400">
          <rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect>
          <path d="M7 11V7a5 5 0 0 1 10 0v4"></path>
        </svg>
      </div>
      <h2 className="text-2xl font-bold mb-3 tracking-tight text-white">Access Restricted</h2>
      <p className="text-sm max-w-md mx-auto mb-8 leading-relaxed text-[var(--text-secondary)]">
        You don't have permission to view this area.<br/><br/>
        If you believe you need access, contact your workspace administrator.
      </p>
      <div className="flex items-center gap-4">
        <button onClick={() => window.history.back()} className="px-5 py-2.5 rounded-lg text-sm font-medium transition-colors border border-[var(--border-soft)] bg-[var(--surface-glass)] hover:bg-[var(--surface-hover)] text-white">
          Go Back
        </button>
        <button onClick={() => redirectTo('/overview')} className="px-5 py-2.5 rounded-lg text-sm font-semibold transition-colors bg-indigo-500 hover:bg-indigo-600 text-white">
          Return to Dashboard
        </button>
      </div>
    </div>
  );
}

function usePathname() {
  const [pathname, setPathname] = useState(window.location.pathname);

  useEffect(() => {
    const update = () => setPathname(window.location.pathname);
    window.addEventListener('popstate', update);

    const originalPushState = window.history.pushState;
    window.history.pushState = function pushState(...args) {
      originalPushState.apply(window.history, args);
      update();
    };

    return () => {
      window.removeEventListener('popstate', update);
      window.history.pushState = originalPushState;
    };
  }, []);

  return pathname;
}

function redirectTo(target: string): void {
  window.history.replaceState(null, '', target);
  window.dispatchEvent(new CustomEvent('popstate'));
}

function Redirect({ to }: { to: string }) {
  useEffect(() => {
    redirectTo(to);
  }, [to]);
  return null;
}

function guardRoute(role: UserRole | undefined, path: string): boolean {
  return canAccessRoute(role, path);
}

function RouteShell({ children }: { children: React.ReactNode }) {
  return (
    <DashboardLayout>
      {children}
    </DashboardLayout>
  );
}


export function ResolveRouter() {
  console.log('[ResolveRouter] RENDER');
  const rawPathname = usePathname();
  const pathname = normalizePath(rawPathname);
  const { user, workspace, loading: workspaceLoading } = useWorkspace();
  const { profile, loading: authLoading, profileResolved, profileHydrating } = useAuth();
  const role = profile?.role;
  const postAuthRedirectApplied = useRef(false);

  useEffect(() => {
    if (postAuthRedirectApplied.current) return;
    if (workspaceLoading || authLoading || !profileResolved || profileHydrating) return;
    if (!user || !profile || role === 'uninvited') return;

    const stored = consumeRedirectToAfterAuth();
    if (!stored) return;

    postAuthRedirectApplied.current = true;
    const destination = resolveAuthenticatedDestination(role, !!workspace, stored);
    const target = normalizePath(destination);
    if (target !== pathname) {
      redirectTo(target);
    }
  }, [
    workspaceLoading,
    authLoading,
    profileResolved,
    profileHydrating,
    user,
    profile,
    role,
    workspace,
    pathname,
  ]);

  useEffect(() => {
  }, [pathname, workspace, user, role, workspaceLoading, authLoading, profileResolved, profileHydrating]);

  // ── Public routes ──

  if (pathname === '/') {
    return <LandingPage />;
  }

  if (pathname.startsWith('/accept-invite/')) {
    return <AcceptInvitePage />;
  }

  if (pathname === '/privacy') {
    return <PrivacyPage />;
  }
  if (pathname === '/terms') {
    return <TermsPage />;
  }
  if (pathname === '/compliance') {
    return <CompliancePage />;
  }
  if (pathname === '/security') {
    return <SecurityPage />;
  }

  if (pathname.startsWith('/shared/project/')) {
    return <SharedProjectDashboard />;
  }

  if (pathname === '/activate') {
    return (
      <ProductKeyGate
        onVerified={() => {
          window.history.pushState(null, '', '/overview');
          window.dispatchEvent(new Event('popstate'));
        }}
      />
    );
  }

  if (pathname === '/login') {
    return <Login />;
  }

  if (pathname === '/password-setup') {
    // Dynamically load to avoid circular deps, or just mock inline for now
    
    return <PasswordSetup />;
  }

  if (workspaceLoading || authLoading || !profileResolved || profileHydrating) {
    return (
      <div className="flex h-screen w-screen items-center justify-center bg-surface">
        <div className="w-8 h-8 border-2 border-accent-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  // ── Auth Gate ──
  // The system uses a post-auth verification model (Product Key OR Invitation).
  // Unauthenticated users are sent to login, where they will authenticate
  // and then be validated by the reconcileInvitationMembership core logic.

  if (!user) return <Login />;

  if (profile?.employment_status && ['terminated', 'resigned', 'suspended'].includes(profile.employment_status)) {
    return <Redirect to="/login?error=access_denied" />;
  }

  if (role === 'pending-workspace-setup' && !isProductKeyVerified() && pathname !== '/activate') {
    return <Redirect to="/activate" />;
  }

  if (role === 'uninvited' || !role) {
    return <Redirect to="/login?error=uninvited" />;
  }

  if (profile?.force_password_change) {
    if (pathname !== '/password-setup') {
      return <Redirect to="/password-setup" />;
    }
  } else if (pathname === '/password-setup') {
    return <Redirect to="/overview" />;
  }

  if (!workspace && role === 'pending-workspace-setup') {
    return <WorkspaceSetupWizard />;
  }

  if (!workspace) {
    return <Redirect to="/login?error=uninvited" />;
  }

  // ── Alias redirects (canonicalize) ──

  const rawStripped = rawPathname.split('?')[0].replace(/\/+$/, '') || '/';
  if (rawStripped !== pathname) {
    return <Redirect to={pathname} />;
  }

  // ── Legacy redirects ──

  if (rawPathname === '/projects/new' || pathname === '/projects/new') {
    return <Redirect to="/workspace/portfolio" />;
  }

  if (pathname === '/onboarding/workspace') {
    return <WorkspaceSetupWizard />;
  }

  // ── OVERVIEW ──

  if (pathname === '/overview' || pathname === '/overview/executive' || pathname === '/overview/activity') {
    return <RouteShell><DailyCommandCenter /></RouteShell>;
  }

  // ── WORKSPACE ──

  if (pathname === '/workspace') {
    return <RouteShell><ProjectsPage /></RouteShell>;
  }
  if (pathname === '/workspace/portfolio') {
    if (!guardRoute(role, '/workspace/portfolio')) return <RouteShell><AccessRestricted /></RouteShell>;
    return <RouteShell><PortfolioPage /></RouteShell>;
  }

  if (pathname === '/workspace/reports') {
    if (!guardRoute(role, '/workspace/reports')) return <RouteShell><AccessRestricted /></RouteShell>;
    return <RouteShell><ReportsCenter /></RouteShell>;
  }
  if (pathname === '/workspace/knowledge') {
    return <RouteShell><KnowledgePage /></RouteShell>;
  }
  if (pathname.startsWith('/workspace/knowledge/')) {
    return <RouteShell><DocumentView /></RouteShell>;
  }
  if (pathname === '/workspace/decisions') {
    if (!guardRoute(role, '/workspace/decisions')) return <RouteShell><AccessRestricted /></RouteShell>;
    return <RouteShell><DecisionsPage /></RouteShell>;
  }
  if (pathname === '/workspace/meetings') {
    if (!guardRoute(role, '/workspace/meetings')) return <RouteShell><AccessRestricted /></RouteShell>;
    return <RouteShell><MeetingsPage /></RouteShell>;
  }
  if (pathname === '/workspace/requirements') {
    if (!guardRoute(role, '/workspace/requirements')) return <RouteShell><AccessRestricted /></RouteShell>;
    return <RouteShell><RequirementsPage /></RouteShell>;
  }
  if (pathname === '/workspace/documents') {
    if (!guardRoute(role, '/workspace/documents')) return <RouteShell><AccessRestricted /></RouteShell>;
    return <RouteShell><DocumentsPage /></RouteShell>;
  }
  if (pathname === '/workspace/approvals') {
    if (!guardRoute(role, '/workspace/approvals')) return <RouteShell><AccessRestricted /></RouteShell>;
    return <RouteShell><ApprovalsPage /></RouteShell>;
  }
  if (pathname === '/workspace/onboarding') {
    if (!guardRoute(role, '/workspace/onboarding')) return <RouteShell><AccessRestricted /></RouteShell>;
    return <RouteShell><EmployeeStartCenter /></RouteShell>;
  }

  // ── EXECUTION ──

  if (pathname === '/execution' || pathname === '/execution/board') {
    if (!guardRoute(role, '/execution')) return <RouteShell><AccessRestricted /></RouteShell>;
    return <RouteShell><BoardPage /></RouteShell>;
  }
  if (pathname === '/execution/timeline') {
    if (!guardRoute(role, '/execution/timeline')) return <RouteShell><AccessRestricted /></RouteShell>;
    return <RouteShell><TimelinePage /></RouteShell>;
  }
  if (pathname === '/execution/gantt') {
    if (!guardRoute(role, '/execution/gantt')) return <RouteShell><AccessRestricted /></RouteShell>;
    return <RouteShell><GanttPage /></RouteShell>;
  }
  if (pathname === '/execution/sprints') {
    if (!guardRoute(role, '/execution/sprints')) return <RouteShell><AccessRestricted /></RouteShell>;
    return <RouteShell><SprintPage /></RouteShell>;
  }

  // ── RESOURCES ──

  if (pathname === '/resources' || pathname === '/resources/attendance' || pathname === '/resources/payroll') {
    if (!guardRoute(role, '/resources')) return <RouteShell><AccessRestricted /></RouteShell>;
    return <RouteShell><LogisticsPanel /></RouteShell>;
  }
  if (pathname === '/resources/teams' || pathname === '/resources/capacity' || pathname === '/resources/teams/departments' || pathname === '/resources/teams/skills') {
    if (!guardRoute(role, '/resources/teams')) return <RouteShell><AccessRestricted /></RouteShell>;
    return <RouteShell><TeamsPage /></RouteShell>;
  }
  if (pathname === '/resources/work-logs') {
    if (!guardRoute(role, '/resources/work-logs')) return <RouteShell><AccessRestricted /></RouteShell>;
    return <RouteShell><WorkLogsPage /></RouteShell>;
  }
  if (pathname === '/resources/finance') {
    if (!guardRoute(role, '/resources/finance')) return <RouteShell><AccessRestricted /></RouteShell>;
    return <RouteShell><FinancePage /></RouteShell>;
  }

  // ── CONTROL ──

  if (pathname === '/control' || pathname === '/control/identity') {
    if (!guardRoute(role, '/control')) return <RouteShell><AccessRestricted /></RouteShell>;
    return <RouteShell><AdminPanel /></RouteShell>;
  }
  if (pathname === '/control/analytics') {
    if (!guardRoute(role, '/control/analytics')) return <RouteShell><AccessRestricted /></RouteShell>;
    return <RouteShell><AnalyticsPage /></RouteShell>;
  }
  if (pathname === '/control/audit') {
    if (!guardRoute(role, '/control/audit')) return <RouteShell><AccessRestricted /></RouteShell>;
    return <RouteShell><AuditPage /></RouteShell>;
  }
  if (pathname === '/control/document-templates') {
    if (!guardRoute(role, '/control/document-templates')) return <RouteShell><AccessRestricted /></RouteShell>;
    return <RouteShell><DocumentTemplatesPage /></RouteShell>;
  }
  if (pathname === '/control/system-health') {
    if (!guardRoute(role, '/control')) return <RouteShell><AccessRestricted /></RouteShell>;
    return <RouteShell><ObservabilityPanel /></RouteShell>;
  }
  if (pathname === '/control/automations' || pathname.startsWith('/control/automations/')) {
    if (!guardRoute(role, '/control/automations')) return <RouteShell><AccessRestricted /></RouteShell>;
    return <RouteShell><AutomationsPanel /></RouteShell>;
  }
  // if (pathname === '/control/connections' || pathname.startsWith('/control/connections/')) {
  //   if (!guardRoute(role, '/control/connections')) return <RouteShell><AccessRestricted /></RouteShell>;
  //   return <RouteShell><ConnectionsPanel /></RouteShell>;
  // }
  if (pathname === '/control/settings') {
    if (!guardRoute(role, '/control/settings')) return <RouteShell><AccessRestricted /></RouteShell>;
    return <RouteShell><SettingsPage /></RouteShell>;
  }
  if (pathname === '/control/settings/notifications') {
    if (!guardRoute(role, '/control/settings/notifications')) return <RouteShell><AccessRestricted /></RouteShell>;
    return <RouteShell><NotificationSettings /></RouteShell>;
  }
  if (pathname === '/control/settings/modes') {
    if (!guardRoute(role, '/control/settings/modes')) return <RouteShell><AccessRestricted /></RouteShell>;
    return <RouteShell><ModeSettings /></RouteShell>;
  }
  if (pathname === '/control/mission-control') {
    if (!guardRoute(role, '/control/mission-control')) return <RouteShell><AccessRestricted /></RouteShell>;
    return <RouteShell><MissionControlPage /></RouteShell>;
  }

  // ── PROJECT routes (/projects/:id/...) ──

  const projectRoute = parseProjectRoute(pathname);
  if (projectRoute?.projectId) {
    const { subRoute, segments } = projectRoute;

    if (!subRoute) {
      return <Redirect to={`/projects/${projectRoute.projectId}/board`} />;
    }

    if (subRoute === 'setup' && segments[3] === 'execution') {
      return <RouteShell><ExecutionSetupPage /></RouteShell>;
    }
    if (subRoute === 'backlog') {
      return <RouteShell><BacklogPage /></RouteShell>;
    }
    if (subRoute === 'board') {
      return <RouteShell><ProjectBoardPage /></RouteShell>;
    }
    if (subRoute === 'sprints') {
      return <RouteShell><ProjectSprintPage /></RouteShell>;
    }
    if (subRoute === 'timeline') {
      return <RouteShell><ProjectTimelinePage /></RouteShell>;
    }

    return <Redirect to={`/projects/${projectRoute.projectId}/board`} />;
  }

  // ── Fallback: unknown paths → overview (registered 404 behavior) ──
  if (import.meta.env.DEV && !isRegisteredPath(pathname)) {
  }
  return <Redirect to="/overview" />;
}
