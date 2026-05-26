import React, { lazy, Suspense, useEffect, useState } from 'react';
import { useWorkspace } from '../context/WorkspaceContext';
import { useAuth } from '../context/AuthContext';
import { hasCapability } from '../core/auth/permissions';
import { AuthPage } from '../pages/auth/AuthPage';
import DashboardLayout from '../pages/dashboard/DashboardLayout';
import { AdminPanel } from '../pages/dashboard/AdminPanel';
import { LogisticsPanel } from '../pages/dashboard/LogisticsPanel';
import { ProjectWorkspace } from '../pages/dashboard/ProjectWorkspace';
import { WorkspaceSetupPage } from '../pages/onboarding/WorkspaceSetupPage';
import { ProjectCreatePage } from '../pages/project/ProjectCreatePage';
import { LandingPage } from '../landing/LandingPage';
import { Login } from '../components/auth/Login';
import { ProductKeyGate } from '../components/auth/ProductKeyGate';
import { isProductKeyVerified } from '../lib/productKey';

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

// ── Loading fallback ──

function RouteFallback() {
  return (
    <div className="flex min-h-[60vh] items-center justify-center">
      <div className="h-8 w-8 animate-spin rounded-full border-2 border-white/15 border-t-white" />
    </div>
  );
}

// ── Route guard helper ──

function routeWithGuard(
  allowedRoles: string[],
  profileRole: string | undefined,
  page: React.ReactNode
): React.ReactNode {
  if (!allowedRoles.includes(profileRole || '')) {
    window.history.replaceState(null, '', '/overview');
    window.dispatchEvent(new CustomEvent('popstate'));
    return null;
  }
  return page;
}

// ── Pathname hook ──

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

// ── Route group wrapper ──

function RouteShell({ children }: { children: React.ReactNode }) {
  return (
    <DashboardLayout>
      <Suspense fallback={<RouteFallback />}>{children}</Suspense>
    </DashboardLayout>
  );
}

export function ResolveRouter() {
  const pathname = usePathname();
  const { user, workspace, loading: workspaceLoading } = useWorkspace();
  const { profile, logout, loading: authLoading, profileResolved, profileHydrating } = useAuth();

  // ── Public routes (no auth, no product key required) ──

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

  if (pathname === '/login') {
    return <Login />;
  }

  // ── Product key gate ──

  if (!isProductKeyVerified()) {
    window.history.replaceState(null, '', '/');
    window.dispatchEvent(new CustomEvent('popstate'));
    return null;
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

  if (profile?.role === 'uninvited') {
    window.history.replaceState(null, '', '/login?error=uninvited');
    window.dispatchEvent(new CustomEvent('popstate'));
    return null;
  }

  if (!workspace) return <WorkspaceSetupPage />;

  // ── Legacy redirects ──

  if (pathname === '/admin' || pathname === '/logistics' || pathname === '/pipeline' || pathname === '/projects/new') {
    const target = pathname === '/admin' ? '/control' : pathname === '/logistics' ? '/resources' : pathname === '/pipeline' ? '/execution' : '/workspace';
    window.history.replaceState(null, '', target);
    window.dispatchEvent(new CustomEvent('popstate'));
    return null;
  }

  if (pathname === '/onboarding/workspace') return <WorkspaceSetupPage />;

  // ── WORKSPACE routes ──

  if (pathname === '/overview') {
    return <RouteShell><OverviewPage /></RouteShell>;
  }
    const subRoute = segments[3]; // After /projects/:id/

    if (subRoute === 'setup' && segments[4] === 'execution') {
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
  }

  // ── Fallback ──
  return <RouteShell><ProjectsPage /></RouteShell>;
}
