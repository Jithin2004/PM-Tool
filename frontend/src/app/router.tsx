import React, { lazy, Suspense, useEffect, useState } from 'react';
import { useWorkspace } from '../context/WorkspaceContext';
import { useAuth } from '../context/AuthContext';
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
    window.history.replaceState(null, '', '/workspace');
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
          window.history.pushState(null, '', '/workspace');
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

  if (pathname === '/workspace') {
    return <RouteShell><ProjectsPage /></RouteShell>;
  }
  if (pathname === '/workspace/portfolio') {
    return <RouteShell><PortfolioPage /></RouteShell>;
  }
  if (pathname === '/workspace/knowledge' || pathname.startsWith('/workspace/knowledge/')) {
    const subPath = pathname.replace('/workspace/knowledge', '');
    if (subPath.startsWith('/') && subPath.length > 1) {
      return <RouteShell><DocumentView /></RouteShell>;
    }
    return <RouteShell><KnowledgePage /></RouteShell>;
  }
  if (pathname === '/workspace/decisions') {
    return <RouteShell><DecisionsPage /></RouteShell>;
  }

  // ── EXECUTION routes ──

  if (pathname === '/execution' || pathname === '/execution/board') {
    return <RouteShell><BoardPage /></RouteShell>;
  }
  if (pathname === '/execution/timeline') {
    return <RouteShell><TimelinePage /></RouteShell>;
  }
  if (pathname === '/execution/gantt') {
    return <RouteShell><GanttPage /></RouteShell>;
  }
  if (pathname === '/execution/sprints') {
    return <RouteShell><SprintPage /></RouteShell>;
  }

  // ── RESOURCES routes ──

  if (pathname === '/resources' || pathname === '/resources/logistics') {
    if (profile?.role !== 'super_admin' && profile?.role !== 'pm') {
      window.history.replaceState(null, '', '/workspace');
      window.dispatchEvent(new CustomEvent('popstate'));
      return null;
    }
    return <RouteShell><LogisticsPanel /></RouteShell>;
  }
  if (pathname === '/resources/teams') {
    if (profile?.role !== 'super_admin' && profile?.role !== 'pm') {
      window.history.replaceState(null, '', '/workspace');
      window.dispatchEvent(new CustomEvent('popstate'));
      return null;
    }
    return <RouteShell><TeamsPage /></RouteShell>;
  }
  if (pathname === '/resources/capacity') {
    if (profile?.role !== 'super_admin' && profile?.role !== 'pm') {
      window.history.replaceState(null, '', '/workspace');
      window.dispatchEvent(new CustomEvent('popstate'));
      return null;
    }
    return <RouteShell><CapacityPage /></RouteShell>;
  }
  if (pathname === '/resources/work-logs') {
    if (profile?.role !== 'super_admin' && profile?.role !== 'pm') {
      window.history.replaceState(null, '', '/workspace');
      window.dispatchEvent(new CustomEvent('popstate'));
      return null;
    }
    return <RouteShell><WorkLogsPage /></RouteShell>;
  }

  // ── CONTROL routes ──

  if (pathname === '/control' || pathname === '/control/identity') {
    if (profile?.role !== 'super_admin') {
      window.history.replaceState(null, '', '/workspace');
      window.dispatchEvent(new CustomEvent('popstate'));
      return null;
    }
    return <RouteShell><AdminPanel /></RouteShell>;
  }
  if (pathname === '/control/analytics') {
    if (profile?.role !== 'super_admin') {
      window.history.replaceState(null, '', '/workspace');
      window.dispatchEvent(new CustomEvent('popstate'));
      return null;
    }
    return <RouteShell><AnalyticsPage /></RouteShell>;
  }
  if (pathname === '/control/audit') {
    if (profile?.role !== 'super_admin') {
      window.history.replaceState(null, '', '/workspace');
      window.dispatchEvent(new CustomEvent('popstate'));
      return null;
    }
    return <RouteShell><AuditPage /></RouteShell>;
  }
  if (pathname === '/control/automations' || pathname.startsWith('/control/automations/')) {
    if (profile?.role !== 'super_admin') {
      window.history.replaceState(null, '', '/workspace');
      window.dispatchEvent(new CustomEvent('popstate'));
      return null;
    }
    return <RouteShell><AutomationsPanel /></RouteShell>;
  }
  if (pathname === '/control/connections' || pathname.startsWith('/control/connections/')) {
    if (profile?.role !== 'super_admin') {
      window.history.replaceState(null, '', '/workspace');
      window.dispatchEvent(new CustomEvent('popstate'));
      return null;
    }
    return <RouteShell><ConnectionsPanel /></RouteShell>;
  }
  if (pathname === '/control/settings') {
    if (profile?.role !== 'super_admin') {
      window.history.replaceState(null, '', '/workspace');
      window.dispatchEvent(new CustomEvent('popstate'));
      return null;
    }
    return <RouteShell><SettingsPage /></RouteShell>;
  }
  if (pathname === '/control/settings/notifications') {
    if (profile?.role !== 'super_admin') {
      window.history.replaceState(null, '', '/workspace');
      window.dispatchEvent(new CustomEvent('popstate'));
      return null;
    }
    return <RouteShell><NotificationSettings /></RouteShell>;
  }
  if (pathname === '/control/settings/modes') {
    if (profile?.role !== 'super_admin') {
      window.history.replaceState(null, '', '/workspace');
      window.dispatchEvent(new CustomEvent('popstate'));
      return null;
    }
    return <RouteShell><ModeSettings /></RouteShell>;
  }

  // ── Fallback ──
  return <RouteShell><ProjectsPage /></RouteShell>;
}
