import React, { lazy, Suspense, useEffect, useRef, useState } from 'react';
import { useWorkspace } from '../context/WorkspaceContext';
import { useAuth } from '../context/AuthContext';
import { canAccessRoute } from '../core/auth/permissions';
import type { UserRole } from '../types';
import {
  consumeRedirectToAfterAuth,
  resolveAuthenticatedDestination,
} from '../core/auth/postAuthRedirect';
import { AuthPage } from '../pages/auth/AuthPage';
import DashboardLayout from '../pages/dashboard/DashboardLayout';
import { AdminPanel } from '../pages/dashboard/AdminPanel';
import { LogisticsPanel } from '../pages/dashboard/LogisticsPanel';
import { WorkspaceSetupPage } from '../pages/onboarding/WorkspaceSetupPage';
import { ProjectCreatePage } from '../pages/project/ProjectCreatePage';
import { LandingPage } from '../landing/LandingPage';
import { Login } from '../components/auth/Login';
import { ProductKeyGate } from '../components/auth/ProductKeyGate';
import { isProductKeyVerified } from '../lib/productKey';
import { normalizePath, parseProjectRoute, isRegisteredPath } from './routeRegistry';

// ── Lazy-loaded route pages ──

const OverviewPage = lazy(() => import('../pages/dashboard/OverviewPage'));
const ProjectsPage = lazy(() => import('../pages/workspace/ProjectsPage'));
const PortfolioPage = lazy(() => import('../pages/workspace/PortfolioPage'));
const KnowledgePage = lazy(() => import('../pages/workspace/KnowledgePage'));
const DecisionsPage = lazy(() => import('../pages/workspace/DecisionsPage'));

const BoardPage = lazy(() => import('../pages/execution/BoardPage'));
const TimelinePage = lazy(() => import('../pages/execution/TimelinePage'));
const GanttPage = lazy(() => import('../pages/execution/GanttPage'));
const SprintPage = lazy(() => import('../pages/execution/SprintPage'));

const TeamsPage = lazy(() => import('../pages/resources/TeamsPage'));
const CapacityPage = lazy(() => import('../pages/resources/CapacityPage'));
const WorkLogsPage = lazy(() => import('../pages/resources/WorkLogsPage'));

const AnalyticsPage = lazy(() => import('../pages/control/AnalyticsPage'));
const AuditPage = lazy(() => import('../pages/control/AuditPage'));
const SettingsPage = lazy(() => import('../pages/control/SettingsPage'));

const DocumentView = lazy(() => import('../pages/dashboard/DocumentView'));
const AutomationsPanel = lazy(() => import('../pages/dashboard/AutomationsPanel'));
const ConnectionsPanel = lazy(() => import('../pages/dashboard/ConnectionsPanel'));
const NotificationSettings = lazy(() => import('../pages/dashboard/NotificationSettings'));
const ModeSettings = lazy(() => import('../pages/dashboard/ModeSettings'));
const MissionControlPage = lazy(() => import('../pages/mission-control/MissionControlPage'));

const ExecutionSetupPage = lazy(() => import('../pages/setup/ExecutionSetupPage'));
const BacklogPage = lazy(() => import('../pages/backlog/BacklogPage'));
const ProjectBoardPage = lazy(() => import('../pages/board/ProjectBoardPage'));
const ProjectSprintPage = lazy(() => import('../pages/sprints/ProjectSprintPage'));
const ProjectTimelinePage = lazy(() => import('../pages/timeline/ProjectTimelinePage'));

const DEFAULT_AUTH_REDIRECT = '/overview';

function RouteFallback() {
  return (
    <div className="flex min-h-[60vh] items-center justify-center">
      <div className="h-8 w-8 animate-spin rounded-full border-2 border-white/15 border-t-white" />
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

  // ── Public routes ──

  if (pathname === '/') {
    return <LandingPage />;
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

  useEffect(() => {
    console.log("[ResolveRouter START] Current state:", {
      pathname,
      workspaceId: workspace?.id,
      userId: user?.id,
      role,
      workspaceLoading,
      authLoading,
      profileResolved,
      profileHydrating,
      productKeyVerified: isProductKeyVerified()
    });
  }, [pathname, workspace, user, role, workspaceLoading, authLoading, profileResolved, profileHydrating]);

  if (pathname === '/login') {
    console.log("[ResolveRouter] Routing to /login explicitly");
    return <Login />;
  }

  // ── Product key gate ──

  if (!isProductKeyVerified()) {
    console.log("[ResolveRouter] Product key not verified, routing to /");
    return <Redirect to="/" />;
  }

  if (workspaceLoading || authLoading || !profileResolved || profileHydrating) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#0a0a0a] text-white">
        <div className="text-center">
          <div className="mx-auto mb-4 h-10 w-10 animate-spin rounded-full border-2 border-white/15 border-t-white" />
          <p className="font-mono text-xs uppercase tracking-[0.25em] text-white/65">Loading Resolve PM</p>
        </div>
      </div>
    );
  }

  if (!user) return <AuthPage />;

  if (role === 'uninvited') {
    return <Redirect to="/login?error=uninvited" />;
  }

  if (!workspace) return <WorkspaceSetupPage />;

  // ── Alias redirects (canonicalize) ──

  const rawStripped = rawPathname.split('?')[0].replace(/\/+$/, '') || '/';
  if (rawStripped !== pathname) {
    return <Redirect to={pathname} />;
  }

  // ── Legacy redirects ──

  if (rawPathname === '/projects/new' || pathname === '/projects/new') {
    if (!guardRoute(role, '/projects/new')) return <Redirect to={DEFAULT_AUTH_REDIRECT} />;
    return <RouteShell><ProjectCreatePage /></RouteShell>;
  }

  if (pathname === '/onboarding/workspace') {
    return <WorkspaceSetupPage />;
  }

  // ── OVERVIEW ──

  if (pathname === '/overview') {
    return <RouteShell><OverviewPage /></RouteShell>;
  }

  // ── WORKSPACE ──

  if (pathname === '/workspace') {
    return <RouteShell><ProjectsPage /></RouteShell>;
  }
  if (pathname === '/workspace/portfolio') {
    if (!guardRoute(role, '/workspace/portfolio')) return <Redirect to={DEFAULT_AUTH_REDIRECT} />;
    return <RouteShell><PortfolioPage /></RouteShell>;
  }
  if (pathname === '/workspace/knowledge') {
    return <RouteShell><KnowledgePage /></RouteShell>;
  }
  if (pathname.startsWith('/workspace/knowledge/')) {
    return <RouteShell><DocumentView /></RouteShell>;
  }
  if (pathname === '/workspace/decisions') {
    if (!guardRoute(role, '/workspace/decisions')) return <Redirect to={DEFAULT_AUTH_REDIRECT} />;
    return <RouteShell><DecisionsPage /></RouteShell>;
  }

  // ── EXECUTION ──

  if (pathname === '/execution' || pathname === '/execution/board') {
    if (!guardRoute(role, '/execution')) return <Redirect to={DEFAULT_AUTH_REDIRECT} />;
    return <RouteShell><BoardPage /></RouteShell>;
  }
  if (pathname === '/execution/timeline') {
    if (!guardRoute(role, '/execution/timeline')) return <Redirect to={DEFAULT_AUTH_REDIRECT} />;
    return <RouteShell><TimelinePage /></RouteShell>;
  }
  if (pathname === '/execution/gantt') {
    if (!guardRoute(role, '/execution/gantt')) return <Redirect to={DEFAULT_AUTH_REDIRECT} />;
    return <RouteShell><GanttPage /></RouteShell>;
  }
  if (pathname === '/execution/sprints') {
    if (!guardRoute(role, '/execution/sprints')) return <Redirect to={DEFAULT_AUTH_REDIRECT} />;
    return <RouteShell><SprintPage /></RouteShell>;
  }

  // ── RESOURCES ──

  if (pathname === '/resources') {
    if (!guardRoute(role, '/resources')) return <Redirect to={DEFAULT_AUTH_REDIRECT} />;
    return <RouteShell><LogisticsPanel /></RouteShell>;
  }
  if (pathname === '/resources/teams') {
    if (!guardRoute(role, '/resources/teams')) return <Redirect to={DEFAULT_AUTH_REDIRECT} />;
    return <RouteShell><TeamsPage /></RouteShell>;
  }
  if (pathname === '/resources/capacity') {
    if (!guardRoute(role, '/resources/capacity')) return <Redirect to={DEFAULT_AUTH_REDIRECT} />;
    return <RouteShell><CapacityPage /></RouteShell>;
  }
  if (pathname === '/resources/work-logs') {
    if (!guardRoute(role, '/resources/work-logs')) return <Redirect to={DEFAULT_AUTH_REDIRECT} />;
    return <RouteShell><WorkLogsPage /></RouteShell>;
  }

  // ── CONTROL ──

  if (pathname === '/control' || pathname === '/control/identity') {
    if (!guardRoute(role, '/control')) return <Redirect to={DEFAULT_AUTH_REDIRECT} />;
    return <RouteShell><AdminPanel /></RouteShell>;
  }
  if (pathname === '/control/analytics') {
    if (!guardRoute(role, '/control/analytics')) return <Redirect to={DEFAULT_AUTH_REDIRECT} />;
    return <RouteShell><AnalyticsPage /></RouteShell>;
  }
  if (pathname === '/control/audit') {
    if (!guardRoute(role, '/control/audit')) return <Redirect to={DEFAULT_AUTH_REDIRECT} />;
    return <RouteShell><AuditPage /></RouteShell>;
  }
  if (pathname === '/control/automations' || pathname.startsWith('/control/automations/')) {
    if (!guardRoute(role, '/control/automations')) return <Redirect to={DEFAULT_AUTH_REDIRECT} />;
    return <RouteShell><AutomationsPanel /></RouteShell>;
  }
  if (pathname === '/control/connections' || pathname.startsWith('/control/connections/')) {
    if (!guardRoute(role, '/control/connections')) return <Redirect to={DEFAULT_AUTH_REDIRECT} />;
    return <RouteShell><ConnectionsPanel /></RouteShell>;
  }
  if (pathname === '/control/settings') {
    if (!guardRoute(role, '/control/settings')) return <Redirect to={DEFAULT_AUTH_REDIRECT} />;
    return <RouteShell><SettingsPage /></RouteShell>;
  }
  if (pathname === '/control/settings/notifications') {
    if (!guardRoute(role, '/control/settings/notifications')) return <Redirect to={DEFAULT_AUTH_REDIRECT} />;
    return <RouteShell><NotificationSettings /></RouteShell>;
  }
  if (pathname === '/control/settings/modes') {
    if (!guardRoute(role, '/control/settings/modes')) return <Redirect to={DEFAULT_AUTH_REDIRECT} />;
    return <RouteShell><ModeSettings /></RouteShell>;
  }
  if (pathname === '/control/mission-control') {
    if (!guardRoute(role, '/control/mission-control')) return <Redirect to={DEFAULT_AUTH_REDIRECT} />;
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
    console.warn(`[ResolveRouter] Unregistered path, falling back to overview: ${rawPathname}`);
  }
  return <RouteShell><OverviewPage /></RouteShell>;
}
