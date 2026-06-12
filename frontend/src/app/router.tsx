import React, { lazy, Suspense, useEffect, useRef, useState } from 'react';
import { useWorkspace } from '../context/WorkspaceContext';
import { useAuth } from '../context/AuthContext';
import { canAccessRoute } from '../core/auth/permissions';
import type { UserRole } from '../types';
import {
  consumeRedirectToAfterAuth,
  resolveAuthenticatedDestination,
} from '../core/auth/postAuthRedirect';
// AuthPage removed — unified to Login component (Bug 6 fix)
import DashboardLayout from '../pages/dashboard/DashboardLayout';
import { Login } from '../components/auth/Login';
import { ProductKeyGate } from '../components/auth/ProductKeyGate';
import { isProductKeyVerified } from '../lib/productKey';
import { normalizePath, parseProjectRoute, isRegisteredPath } from './routeRegistry';

// ── Lazy-loaded route pages ──

const withRetry = (componentImport: () => Promise<any>) => {
  return lazy(async () => {
    try {
      const module = await componentImport();
      sessionStorage.removeItem('chunk_reload_count');
      return module;
    } catch (error: any) {
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

const WorkspaceSetupWizard = withRetry(() => import('../pages/onboarding/WorkspaceSetupWizard').then(m => ({ default: m.WorkspaceSetupWizard })));
const LandingPage = withRetry(() => import('../landing/LandingPage').then(m => ({ default: m.LandingPage })));
const PrivacyPage = withRetry(() => import('../landing/PrivacyPage').then(m => ({ default: m.PrivacyPage })));
const TermsPage = withRetry(() => import('../landing/TermsPage').then(m => ({ default: m.TermsPage })));
const CompliancePage = withRetry(() => import('../landing/CompliancePage').then(m => ({ default: m.CompliancePage })));
const SecurityPage = withRetry(() => import('../landing/SecurityPage').then(m => ({ default: m.SecurityPage })));

const DailyCommandCenter = withRetry(() => import('../components/overview/DailyCommandCenter').then(m => ({ default: m.DailyCommandCenter })));

const AdminPanel = withRetry(() => import('../pages/dashboard/AdminPanel').then(m => ({ default: m.AdminPanel })));
const LogisticsPanel = withRetry(() => import('../pages/dashboard/LogisticsPanel').then(m => ({ default: m.LogisticsPanel })));
const ProjectsPage = withRetry(() => import('../pages/workspace/ProjectsPage'));
const PortfolioPage = withRetry(() => import('../pages/workspace/PortfolioPage'));
const KnowledgePage = withRetry(() => import('../pages/workspace/KnowledgePage'));
const DecisionsPage = withRetry(() => import('../pages/workspace/DecisionsPage'));
const MeetingsPage = withRetry(() => import('../pages/workspace/MeetingsPage'));
const RequirementsPage = withRetry(() => import('../pages/workspace/RequirementsPage'));
const DocumentsPage = withRetry(() => import('../pages/workspace/DocumentsPage'));
const ApprovalsPage = withRetry(() => import('../pages/workspace/ApprovalsPage'));
const EmployeeStartCenter = withRetry(() => import('../components/onboarding/EmployeeStartCenter').then(m => ({ default: m.EmployeeStartCenter })));


const ProductAdoptionDashboard = withRetry(() => import('../pages/workspace/ProductAdoptionDashboard').then(m => ({ default: m.ProductAdoptionDashboard })));
const ReportsCenter = withRetry(() => import('../pages/workspace/ReportsCenter'));

const BoardPage = withRetry(() => import('../pages/execution/BoardPage'));
const TimelinePage = withRetry(() => import('../pages/execution/TimelinePage'));
const GanttPage = withRetry(() => import('../pages/execution/GanttPage'));
const SprintPage = withRetry(() => import('../pages/execution/SprintPage'));

const TeamsPage = withRetry(() => import('../pages/resources/TeamsPage'));
const CapacityPage = withRetry(() => import('../pages/resources/CapacityPage'));
const WorkLogsPage = withRetry(() => import('../pages/resources/WorkLogsPage'));
const FinancePage = withRetry(() => import('../pages/resources/FinancePage'));

const AnalyticsPage = withRetry(() => import('../pages/control/AnalyticsPage'));
const AuditPage = withRetry(() => import('../pages/control/AuditPage'));
const DocumentTemplatesPage = withRetry(() => import('../pages/control/DocumentTemplatesPage'));
const ObservabilityPanel = withRetry(() => import('../pages/dashboard/ObservabilityPanel').then(m => ({ default: m.ObservabilityPanel })));
const SettingsPage = withRetry(() => import('../pages/control/SettingsPage'));

const DocumentView = withRetry(() => import('../pages/dashboard/DocumentView'));
const AutomationsPanel = withRetry(() => import('../pages/dashboard/AutomationsPanel'));
const ConnectionsPanel = withRetry(() => import('../pages/dashboard/ConnectionsPanel'));
const NotificationSettings = withRetry(() => import('../pages/dashboard/NotificationSettings'));
const ModeSettings = withRetry(() => import('../pages/dashboard/ModeSettings'));
const MissionControlPage = withRetry(() => import('../pages/mission-control/MissionControlPage'));

const ExecutionSetupPage = withRetry(() => import('../pages/setup/ExecutionSetupPage'));
const BacklogPage = withRetry(() => import('../pages/backlog/BacklogPage'));
const ProjectBoardPage = withRetry(() => import('../pages/board/ProjectBoardPage'));
const ProjectSprintPage = withRetry(() => import('../pages/sprints/ProjectSprintPage'));
const ProjectTimelinePage = withRetry(() => import('../pages/timeline/ProjectTimelinePage'));
const SharedProjectDashboard = withRetry(() => import('../pages/shared/SharedProjectDashboard').then(m => ({ default: m.SharedProjectDashboard })));

const DEFAULT_AUTH_REDIRECT = '/overview';

function RouteFallback() {
  const [show, setShow] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setShow(true), 300);
    return () => clearTimeout(t);
  }, []);

  if (!show) return <div className="min-h-[60vh]" />;

  return (
    <div className="flex min-h-[60vh] items-center justify-center font-geist text-[10px] uppercase tracking-widest text-text-tertiary">
      <div className="flex items-center gap-3">
        <div className="h-4 w-4 animate-spin rounded-full border-2 border-indigo-500/30 border-t-indigo-400" />
        <span className="opacity-70">Loading view...</span>
      </div>
    </div>
  );
}

// Map of prefixes to dynamic import chunks for prefetching
export const prefetchRouteByPath = (path: string) => {
  try {
    if (path.startsWith('/overview')) import('../components/overview/DailyCommandCenter');
    else if (path.startsWith('/execution/board')) import('../pages/execution/BoardPage');
    else if (path.startsWith('/execution/timeline')) import('../pages/execution/TimelinePage');
    else if (path.startsWith('/execution/gantt')) import('../pages/execution/GanttPage');
    else if (path.startsWith('/workspace/portfolio')) import('../pages/workspace/PortfolioPage');
    else if (path.startsWith('/workspace') && !path.includes('/reports') && !path.includes('/decisions')) import('../pages/workspace/ProjectsPage');
    else if (path.startsWith('/resources/teams')) import('../pages/resources/TeamsPage');
    else if (path.startsWith('/workspace/reports')) import('../pages/workspace/ReportsCenter');
    else if (path.startsWith('/workspace/decisions')) import('../pages/workspace/DecisionsPage');
    else if (path.startsWith('/resources/finance')) import('../pages/resources/FinancePage');
    else if (path.startsWith('/control/settings')) import('../pages/control/SettingsPage');
  } catch (e) {
    // Ignore prefetch errors
  }
};

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
      <Suspense fallback={<RouteFallback />}>{children}</Suspense>
    </DashboardLayout>
  );
}

export function ResolveRouter() {
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
    return <Suspense fallback={<RouteFallback />}><LandingPage /></Suspense>;
  }

  if (pathname === '/privacy') {
    return <Suspense fallback={<RouteFallback />}><PrivacyPage /></Suspense>;
  }
  if (pathname === '/terms') {
    return <Suspense fallback={<RouteFallback />}><TermsPage /></Suspense>;
  }
  if (pathname === '/compliance') {
    return <Suspense fallback={<RouteFallback />}><CompliancePage /></Suspense>;
  }
  if (pathname === '/security') {
    return <Suspense fallback={<RouteFallback />}><SecurityPage /></Suspense>;
  }

  if (pathname.startsWith('/shared/project/')) {
    return <Suspense fallback={<RouteFallback />}><SharedProjectDashboard /></Suspense>;
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
    const PasswordSetup = lazy(() => import('../components/auth/PasswordSetup').then(m => ({ default: m.PasswordSetup })));
    return <Suspense fallback={<RouteFallback />}><PasswordSetup /></Suspense>;
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

  if (pathname === '/overview') {
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
  if (pathname === '/resources/teams') {
    if (!guardRoute(role, '/resources/teams')) return <RouteShell><AccessRestricted /></RouteShell>;
    return <RouteShell><TeamsPage /></RouteShell>;
  }
  if (pathname === '/resources/capacity') {
    if (!guardRoute(role, '/resources/capacity')) return <RouteShell><AccessRestricted /></RouteShell>;
    return <RouteShell><CapacityPage /></RouteShell>;
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
