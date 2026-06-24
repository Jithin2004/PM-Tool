import React, { useEffect, useRef, useState, lazy, Suspense } from 'react';
import { AlertCircle } from 'lucide-react';
import { ModuleErrorBoundary } from '../components/error/ModuleErrorBoundary';
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
import { ProductKeyGate } from '../components/auth/ProductKeyGate';
import { isProductKeyVerified, checkLicenseOnline } from '../lib/productKey';
import { ResolveBootScreen } from '../components/common/ResolveBootScreen';
import { normalizePath, parseProjectRoute, isRegisteredPath } from './routeRegistry';

// ── Lazy-loaded route pages ──

const withRetry = (componentImport: () => Promise<any>) => {
  return lazy(async () => {
    const importStr = componentImport.toString();
    const chunkNameMatch = importStr.match(/import\(['"]([^'"]+)['"]\)/);
    const chunkName = chunkNameMatch ? chunkNameMatch[1] : 'unknown chunk';

    

    try {
      const module = await componentImport();
      
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

const WorkspaceSetupWizard = withRetry(() => import('../pages/onboarding/WorkspaceSetupWizard').then(m => ({ default: m.WorkspaceSetupWizard })));
const AcceptInvitePage = withRetry(() => import('../pages/onboarding/AcceptInvitePage').then(m => ({ default: m.AcceptInvitePage })));
import { LandingPage } from '../landing/LandingPage';
import { PrivacyPage } from '../landing/PrivacyPage';
import { TermsPage } from '../landing/TermsPage';
import { CompliancePage } from '../landing/CompliancePage';
import { SecurityPage } from '../landing/SecurityPage';

import { DailyCommandCenter } from '../components/overview/DailyCommandCenter';

const AdminPanel = withRetry(() => import('../pages/dashboard/AdminPanel').then(m => ({ default: m.AdminPanel })));
const PeopleOpsCenter = withRetry(() => import('../pages/resources/PeopleOpsCenter'));
const ProjectsPage = withRetry(() => import('../pages/workspace/ProjectsPage'));
const PortfolioPage = withRetry(() => import('../pages/workspace/PortfolioPage'));
const KnowledgeBase = withRetry(() => import('../pages/workspace/KnowledgeBase'));
const DecisionsPage = withRetry(() => import('../pages/workspace/DecisionsPage'));
const ApprovalsPage = withRetry(() => import('../pages/workspace/ApprovalsPage'));
const MeetingsPage = withRetry(() => import('../pages/workspace/MeetingsPage'));

const AutomationCenter = withRetry(() => import('../pages/workspace/AutomationCenter'));
const FileCenterPage = withRetry(() => import('../pages/workspace/FileCenter'));



const ProductAdoptionDashboard = withRetry(() => import('../pages/workspace/ProductAdoptionDashboard').then(m => ({ default: m.ProductAdoptionDashboard })));
const ReportsCenter = withRetry(() => import('../pages/workspace/ReportsCenter'));

const ExecutionBoardPage = withRetry(() => import('../pages/execution/ExecutionBoardPage'));


const TeamsPage = withRetry(() => import('../pages/resources/TeamsPage'));
const CapacityPage = withRetry(() => import('../pages/resources/CapacityPage'));
const FinancePage = withRetry(() => import('../pages/resources/FinancePage'));


const NotificationInbox = withRetry(() => import('../pages/workspace/NotificationInbox'));

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
const BacklogView = withRetry(() => import('../pages/dashboard/project/BacklogView').then(m => ({ default: m.BacklogView })));

const SprintView = withRetry(() => import('../pages/dashboard/project/SprintView').then(m => ({ default: m.SprintView })));
const ProjectTimelinePage = withRetry(() => import('../pages/timeline/ProjectTimelinePage'));
const SharedProjectDashboard = withRetry(() => import('../pages/shared/SharedProjectDashboard').then(m => ({ default: m.SharedProjectDashboard })));

const DEFAULT_AUTH_REDIRECT = '/overview';

function RouteFallback() {
  
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

function NotFound() {
  return (
    <div className="flex flex-col items-center justify-center h-full w-full bg-surface-1 p-8 text-center animate-in fade-in zoom-in duration-300">
      <div className="bg-surface-2 p-6 rounded-xl border border-white/5 mb-4 max-w-sm w-full mx-auto shadow-2xl">
        <div className="w-12 h-12 bg-rose-500/10 rounded-full flex items-center justify-center mx-auto mb-4 border border-rose-500/20">
          <AlertCircle className="w-6 h-6 text-rose-500" />
        </div>
        <h3 className="text-lg font-bold text-text-primary mb-2 tracking-tight">Page Not Found</h3>
        <p className="text-sm text-text-tertiary">
          The route you are trying to access does not exist or has been moved.
        </p>
      </div>
    </div>
  );
}

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
      <Suspense fallback={<RouteFallback />}>
        {children}
      </Suspense>
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

  // --- Boot sequence readiness hooks ---
  const [fontsReady, setFontsReady] = useState(false);
  const [licenseCheckComplete, setLicenseCheckComplete] = useState(false);
  const [showBootScreen, setShowBootScreen] = useState(true);
  const [fadeBootScreen, setFadeBootScreen] = useState(false);

  // 1. Font/icon readiness control
  useEffect(() => {
    let active = true;
    Promise.all([
      document.fonts.load("16px 'Geist'"),
      document.fonts.load("16px 'Inter'"),
      document.fonts.load("16px 'JetBrains Mono'"),
      document.fonts.load("24px 'Material Symbols Outlined'")
    ]).then(() => {
      return document.fonts.ready;
    }).then(() => {
      if (active) {
        setFontsReady(true);
        document.documentElement.classList.add('fonts-loaded');
        document.body.classList.add('fonts-loaded');
      }
    }).catch(err => {
      console.warn("Font loading check encountered an issue:", err);
      if (active) {
        setFontsReady(true);
        document.documentElement.classList.add('fonts-loaded');
        document.body.classList.add('fonts-loaded');
      }
    });

    return () => {
      active = false;
    };
  }, []);

  // 2. License check complete control
  useEffect(() => {
    let active = true;

    const runLicenseCheck = async () => {
      // Wait until auth initialization is complete
      if (authLoading || !profileResolved || profileHydrating) return;

      // If user is not authenticated or does not have a workspace yet,
      // license check is immediately considered complete for the boot gate.
      if (!user || !profile?.workspace_id) {
        setLicenseCheckComplete(true);
        return;
      }

      try {
        const res = await checkLicenseOnline();
        if (active) {
          setLicenseCheckComplete(true);
        }
      } catch (err) {
        console.error("License check error during boot sequence:", err);
        if (active) {
          setLicenseCheckComplete(true);
        }
      }
    };

    runLicenseCheck();

    return () => {
      active = false;
    };
  }, [user, profile?.workspace_id, authLoading, profileResolved, profileHydrating]);

  const isGateResolved = !authLoading && !workspaceLoading && profileResolved && !profileHydrating && fontsReady && licenseCheckComplete;

  useEffect(() => {
    if (isGateResolved) {
      setFadeBootScreen(true);
    }
  }, [isGateResolved]);

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

  // Routing render logic helper to render target pages
  function renderRouteContent() {
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

    if (pathname === '/activate-license') {
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
    if (!user) return <Login />;

    if (profile?.employment_status && ['terminated', 'resigned', 'suspended'].includes(profile.employment_status)) {
      return <Redirect to="/login?error=access_denied" />;
    }

    if ((profile as any)?.status && ['archived', 'offboarding', 'disabled'].includes((profile as any).status)) {
      return <Redirect to="/login?error=access_denied" />;
    }

    if (role === 'pending-workspace-setup' && !isProductKeyVerified() && pathname !== '/activate-license') {
      return <Redirect to="/activate-license" />;
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

    // 🚫 Legacy redirects 🚫

    if (pathname === '/onboarding/workspace') {
      return <Redirect to="/overview" />;
    }

    // ── MISSION CONTROL ──

    if (pathname === '/overview') {
      return <RouteShell><MissionControlPage /></RouteShell>;
    }
    if (pathname === '/overview/executive') {
      return <RouteShell><DailyCommandCenter /></RouteShell>;
    }
    if (pathname === '/overview/activity') {
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
      return <RouteShell><ModuleErrorBoundary module="ReportsCenter"><ReportsCenter /></ModuleErrorBoundary></RouteShell>;
    }
    if (pathname === '/workspace/employee') {
      return <RouteShell><ModuleErrorBoundary module="PeopleOpsCenter"><PeopleOpsCenter /></ModuleErrorBoundary></RouteShell>;
    }

    if (pathname === '/workspace/notifications') {
      return <RouteShell><NotificationInbox /></RouteShell>;
    }
    if (pathname === '/workspace/knowledge') {
      return <RouteShell><ModuleErrorBoundary module="KnowledgeBase"><KnowledgeBase /></ModuleErrorBoundary></RouteShell>;
    }
    if (pathname.startsWith('/workspace/knowledge/')) {
      return <RouteShell><ModuleErrorBoundary module="DocumentView"><DocumentView /></ModuleErrorBoundary></RouteShell>;
    }
    if (pathname === '/workspace/decisions') {
      if (!guardRoute(role, '/workspace/decisions')) return <RouteShell><AccessRestricted /></RouteShell>;
      return <RouteShell><DecisionsPage /></RouteShell>;
    }
    if (pathname === '/workspace/approvals') {
      if (!guardRoute(role, '/workspace/approvals')) return <RouteShell><AccessRestricted /></RouteShell>;
      return <RouteShell><ApprovalsPage /></RouteShell>;
    }
    if (pathname === '/workspace/meetings') {
      if (!guardRoute(role, '/workspace/meetings')) return <RouteShell><AccessRestricted /></RouteShell>;
      return <RouteShell><MeetingsPage /></RouteShell>;
    }
    if (pathname === '/workspace/onboarding') {
      if (!guardRoute(role, '/workspace/onboarding')) return <RouteShell><AccessRestricted /></RouteShell>;
      return <RouteShell><PeopleOpsCenter /></RouteShell>;
    }
    if (pathname === '/workspace/automation') {
      if (!guardRoute(role, '/workspace/automation')) return <RouteShell><AccessRestricted /></RouteShell>;
      return <RouteShell><ModuleErrorBoundary module="AutomationCenter"><AutomationCenter /></ModuleErrorBoundary></RouteShell>;
    }
    if (pathname === '/workspace/files') {
      if (!guardRoute(role, '/workspace/files')) return <RouteShell><AccessRestricted /></RouteShell>;
      return <RouteShell><FileCenterPage /></RouteShell>;
    }

    // ── EXECUTION ──

    if (pathname === '/execution' || pathname === '/execution/board') {
      if (!guardRoute(role, '/execution/board')) return <RouteShell><AccessRestricted /></RouteShell>;
      return <RouteShell><ExecutionBoardPage /></RouteShell>;
    }
    if (pathname === '/execution/schedule') {
      return <RouteShell><ProjectTimelinePage /></RouteShell>;
    }
    if (pathname === '/execution/timeline' || pathname === '/execution/gantt') {
      return <Redirect to="/execution/schedule" />;
    }
    if (pathname === '/execution/sprints') {
      if (!guardRoute(role, '/execution/sprints')) return <RouteShell><AccessRestricted /></RouteShell>;
      return <RouteShell><SprintView /></RouteShell>;
    }

    // ── COMPANY (Legacy: RESOURCES) ──

    // Aliasing/Redirects for legacy paths
    if (pathname.startsWith('/resources/finance')) {
      return <Redirect to={pathname.replace('/resources/finance', '/finance')} />;
    }
    if (pathname.startsWith('/resources')) {
      return <Redirect to={pathname.replace('/resources', '/company')} />;
    }

    if (pathname === '/company' || pathname === '/company/attendance' || pathname === '/company/payroll') {
      if (!guardRoute(role, '/company')) return <RouteShell><AccessRestricted /></RouteShell>;
      return <RouteShell><PeopleOpsCenter /></RouteShell>;
    }
    if (pathname === '/company/teams' || pathname === '/company/capacity' || pathname === '/company/teams/departments' || pathname === '/company/teams/skills') {
      if (!guardRoute(role, '/company/teams')) return <RouteShell><AccessRestricted /></RouteShell>;
      return <RouteShell><ModuleErrorBoundary module="TeamsPage"><TeamsPage /></ModuleErrorBoundary></RouteShell>;
    }
    if (pathname === '/finance') {
      if (!guardRoute(role, '/finance')) return <RouteShell><AccessRestricted /></RouteShell>;
      return <RouteShell><ModuleErrorBoundary module="FinancePage"><FinancePage /></ModuleErrorBoundary></RouteShell>;
    }

    // ── ADMIN (Legacy: CONTROL) ──

    // Aliasing/Redirects for legacy paths
    if (pathname.startsWith('/control')) {
      return <Redirect to={pathname.replace('/control', '/admin')} />;
    }

    if (pathname === '/admin' || pathname === '/admin/identity') {
      if (!guardRoute(role, '/admin/identity')) return <RouteShell><AccessRestricted /></RouteShell>;
      return <RouteShell><AdminPanel /></RouteShell>;
    }
    if (pathname === '/admin/analytics') {
      if (!guardRoute(role, '/admin/analytics')) return <RouteShell><AccessRestricted /></RouteShell>;
      return <RouteShell><ModuleErrorBoundary module="AnalyticsPage"><AnalyticsPage /></ModuleErrorBoundary></RouteShell>;
    }
    if (pathname === '/admin/audit') {
      if (!guardRoute(role, '/admin/audit')) return <RouteShell><AccessRestricted /></RouteShell>;
      return <RouteShell><AuditPage /></RouteShell>;
    }
    if (pathname === '/admin/document-templates') {
      if (!guardRoute(role, '/admin/document-templates')) return <RouteShell><AccessRestricted /></RouteShell>;
      return <RouteShell><DocumentTemplatesPage /></RouteShell>;
    }
    if (pathname === '/admin/connections') {
      if (!guardRoute(role, '/admin/connections')) return <RouteShell><AccessRestricted /></RouteShell>;
      return <RouteShell><ConnectionsPanel /></RouteShell>;
    }
    if (pathname === '/admin/system-health') {
      if (!guardRoute(role, '/admin/system-health')) return <RouteShell><AccessRestricted /></RouteShell>;
      return <RouteShell><ObservabilityPanel /></RouteShell>;
    }
    if (pathname === '/admin/automations' || pathname.startsWith('/admin/automations/')) {
      if (!guardRoute(role, '/admin/automations')) return <RouteShell><AccessRestricted /></RouteShell>;
      return <RouteShell><ModuleErrorBoundary module="AutomationsPanel"><AutomationsPanel /></ModuleErrorBoundary></RouteShell>;
    }
    if (pathname === '/admin/settings') {
      if (!guardRoute(role, '/admin/settings')) return <RouteShell><AccessRestricted /></RouteShell>;
      return <RouteShell><SettingsPage /></RouteShell>;
    }
    if (pathname === '/admin/settings/notifications') {
      if (!guardRoute(role, '/admin/settings/notifications')) return <RouteShell><AccessRestricted /></RouteShell>;
      return <RouteShell><NotificationSettings /></RouteShell>;
    }
    if (pathname === '/admin/settings/modes') {
      if (!guardRoute(role, '/admin/settings/modes')) return <RouteShell><AccessRestricted /></RouteShell>;
      return <RouteShell><ModeSettings /></RouteShell>;
    }
    if (pathname === '/admin/mission-control') {
      if (!guardRoute(role, '/admin/mission-control')) return <RouteShell><AccessRestricted /></RouteShell>;
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
        return <RouteShell><BacklogView /></RouteShell>;
      }
      if (subRoute === 'board') {
        return <RouteShell><ExecutionBoardPage /></RouteShell>;
      }
      if (subRoute === 'sprints') {
        return <RouteShell><SprintView /></RouteShell>;
      }
      if (subRoute === 'schedule' || subRoute === 'timeline') {
        return <Redirect to={`/projects/${projectRoute.projectId}/board?view=timeline`} />;
      }

      return <Redirect to={`/projects/${projectRoute.projectId}/board`} />;
    }

    // 🚫 Fallback: unknown paths -> NotFound 🚫
    if (import.meta.env.DEV && !isRegisteredPath(pathname)) {
      console.warn(`[Router] Unregistered path hit fallback: ${pathname}`);
    }
    return <RouteShell><NotFound /></RouteShell>;
  }

  const appContent = renderRouteContent();

  if (showBootScreen) {
    return (
      <>
        {fadeBootScreen && appContent}
        <ResolveBootScreen
          fadeOut={fadeBootScreen}
          onFadeComplete={() => setShowBootScreen(false)}
        />
      </>
    );
  }

  return appContent;
}
