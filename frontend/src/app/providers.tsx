import React from 'react';
import { WorkspaceProvider } from '../context/WorkspaceContext';
import { AuthProvider } from '../context/AuthContext';
const ObservabilityProvider = React.lazy(() => import('../core/observability/ObservabilityProvider').then(m => ({ default: m.ObservabilityProvider })));

interface AppProvidersProps {
  children: React.ReactNode;
}

export function AppProviders({ children }: AppProvidersProps) {
  return (
    <React.Suspense fallback={<div className="flex h-screen w-screen items-center justify-center bg-surface"><div className="w-8 h-8 border-2 border-accent-primary border-t-transparent rounded-full animate-spin" /></div>}>
      <ObservabilityProvider>
        <AuthProvider>
          <WorkspaceProvider>{children}</WorkspaceProvider>
        </AuthProvider>
      </ObservabilityProvider>
    </React.Suspense>
  );
}
