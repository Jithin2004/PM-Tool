import React from 'react';
import { WorkspaceProvider } from '../context/WorkspaceContext';
import { AuthProvider } from '../context/AuthContext';
const ObservabilityProvider = React.lazy(() => import('../core/observability/ObservabilityProvider').then(m => ({ default: m.ObservabilityProvider })));

interface AppProvidersProps {
  children: React.ReactNode;
}

export function AppProviders({ children }: AppProvidersProps) {
  return (
    <React.Suspense fallback={<>{children}</>}>
      <ObservabilityProvider>
        <AuthProvider>
          <WorkspaceProvider>{children}</WorkspaceProvider>
        </AuthProvider>
      </ObservabilityProvider>
    </React.Suspense>
  );
}
