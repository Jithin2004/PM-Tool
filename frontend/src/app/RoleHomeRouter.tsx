import React, { Suspense, lazy } from 'react';
import { useAuth } from '../context/AuthContext';
import { useWorkspace } from '../context/WorkspaceContext';

// We lazy load the different control centers to keep the initial bundle small
const SuperAdminGovernanceSurface = lazy(() => import('../pages/dashboard/FounderTodayCommandCenter'));
const PMDailyControlCenter = lazy(() => import('../pages/dashboard/PMDailyControlCenter'));
const DeveloperMyWorkToday = lazy(() => import('../pages/dashboard/DeveloperMyWorkToday'));

const ClientDeliveryPortal = lazy(() => import('../pages/dashboard/ClientDeliveryPortal').then(m => ({ default: m.ClientDeliveryPortal })));

function RouteFallback() {
  return (
    <div className="flex min-h-[60vh] items-center justify-center font-geist text-[10px] uppercase tracking-widest text-text-tertiary">
      <div className="flex items-center gap-3">
        <div className="h-4 w-4 animate-spin rounded-full border-2 border-indigo-500/30 border-t-indigo-400" />
        Loading workspace environment...
      </div>
    </div>
  );
}

export function RoleHomeRouter() {
  const { profile } = useAuth();
  const { workspace } = useWorkspace();
  const role = profile?.role;

  if (!workspace || !role) {
    return <RouteFallback />;
  }

  return (
    <Suspense fallback={<RouteFallback />}>
      {role === 'super_admin' && <SuperAdminGovernanceSurface />}
      {role === 'pm' && <PMDailyControlCenter />}
      {(role === 'developer' || role === 'viewer') && <DeveloperMyWorkToday />}

      {role === 'client' && <ClientDeliveryPortal />}
    </Suspense>
  );
}
