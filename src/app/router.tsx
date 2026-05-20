import React, { useEffect, useState } from 'react';
import { useWorkspace } from '../context/WorkspaceContext';
import { useAuth } from '../context/AuthContext';
import { AuthPage } from '../pages/auth/AuthPage';
import DashboardLayout from '../pages/dashboard/DashboardLayout';
import { AdminPanel } from '../pages/dashboard/AdminPanel';
import { LogisticsPanel } from '../pages/dashboard/LogisticsPanel';
import { PipelinePanel } from '../pages/dashboard/PipelinePanel';
import { ProjectWorkspace } from '../pages/dashboard/ProjectWorkspace';
import { WorkspaceSetupPage } from '../pages/onboarding/WorkspaceSetupPage';
import { ProjectCreatePage } from '../pages/project/ProjectCreatePage';

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

export function ResolveRouter() {
  const pathname = usePathname();
  const { user, workspace, loading: workspaceLoading } = useWorkspace();
  const { profile, logout, loading: authLoading } = useAuth();

  console.log(
    "[ResolveRouter RENDER]:",
    "\n- pathname:", pathname,
    "\n- user (WorkspaceContext):", user?.email,
    "\n- profile (AuthContext):", profile?.email,
    "\n- workspace:", workspace?.name,
    "\n- workspaceLoading:", workspaceLoading,
    "\n- authLoading:", authLoading
  );

  if (workspaceLoading || authLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#0a0a0a] text-white">
        <div className="text-center">
          <div className="mx-auto mb-4 h-10 w-10 animate-spin rounded-full border-2 border-white/15 border-t-white" />
          <p className="font-mono text-xs uppercase tracking-[0.25em] text-white/65">Loading Resolve PM</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return <AuthPage />;
  }

  if (profile?.role === 'uninvited') {
    console.log(profile);
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#0a0a0a] text-white p-6">
        <div className="max-w-md w-full border border-red-500/25 bg-red-500/5 p-8 text-center rounded">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center bg-red-500/10 text-red-400 rounded-full">
            <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </div>
          <h2 className="text-xl font-semibold mb-2">Access Restrained</h2>
          <p className="text-sm text-white/60 mb-6 font-mono">
            You haven't been invited to an organization yet.
          </p>
          <button
            onClick={() => logout()}
            className="w-full border border-white/10 bg-white/5 py-2.5 text-sm font-medium hover:bg-white/10 transition-colors font-mono uppercase tracking-wider"
          >
            Sign Out
          </button>
        </div>
      </div>
    );
  }

  if (!workspace) {
    return <WorkspaceSetupPage />;
  }

  if (pathname === '/onboarding/workspace') {
    return <WorkspaceSetupPage />;
  }

  if (pathname === '/projects/new') {
    return <ProjectCreatePage />;
  }

  if (pathname === '/admin') {
    if (profile?.role !== 'super_admin') {
      window.history.replaceState(null, '', '/');
      return (
        <DashboardLayout>
          <ProjectWorkspace />
        </DashboardLayout>
      );
    }
    return (
      <DashboardLayout>
        <AdminPanel />
      </DashboardLayout>
    );
  }

  if (pathname === '/logistics') {
    if (profile?.role !== 'super_admin' && profile?.role !== 'pm') {
      window.history.replaceState(null, '', '/');
      return (
        <DashboardLayout>
          <ProjectWorkspace />
        </DashboardLayout>
      );
    }
    return (
      <DashboardLayout>
        <LogisticsPanel />
      </DashboardLayout>
    );
  }

  if (pathname === '/pipeline') {
    return (
      <DashboardLayout>
        <PipelinePanel />
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <ProjectWorkspace />
    </DashboardLayout>
  );
}
