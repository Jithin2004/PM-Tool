import React from 'react';
import { WorkspaceProvider } from '../context/WorkspaceContext';
import { AuthProvider } from '../context/AuthContext';
import { ThemeProvider } from '../context/ThemeContext';
const ObservabilityProvider = React.lazy(() => import('../core/observability/ObservabilityProvider').then(m => ({ default: m.ObservabilityProvider })));

interface AppProvidersProps {
  children: React.ReactNode;
}

export function AppProviders({ children }: AppProvidersProps) {
  return (
    <React.Suspense fallback={<div className="flex h-screen w-screen bg-[#0b0c12]"></div>}>
      <ThemeProvider>
        <ObservabilityProvider>
          <AuthProvider>
            <WorkspaceProvider>{children}</WorkspaceProvider>
          </AuthProvider>
        </ObservabilityProvider>
      </ThemeProvider>
    </React.Suspense>
  );
}
