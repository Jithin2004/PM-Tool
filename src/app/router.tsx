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
  const { profile, loading: authLoading } = useAuth();

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
