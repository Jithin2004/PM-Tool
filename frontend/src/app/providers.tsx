import React from 'react';
import { WorkspaceProvider } from '../context/WorkspaceContext';
import { AuthProvider } from '../context/AuthContext';
import { ThemeProvider } from '../context/ThemeContext';
import { ObservabilityProvider } from '../core/observability/ObservabilityProvider';
import { GlobalDialogs } from '../components/common/Dialogs';
import { OperationalDataProvider } from '../context/OperationalDataContext';
import { RealtimeProvider } from '../context/RealtimeProvider';
import { BootstrapOrchestrator } from '../core/lifecycle/BootstrapOrchestrator';

interface AppProvidersProps {
  children: React.ReactNode;
}

export function AppProviders({ children }: AppProvidersProps) {
  return (
    <ThemeProvider>
      <ObservabilityProvider>
        <AuthProvider>
          <WorkspaceProvider>
            <OperationalDataProvider>
              <BootstrapOrchestrator>
                <RealtimeProvider>
                  {children}
                  <GlobalDialogs />
                </RealtimeProvider>
              </BootstrapOrchestrator>
            </OperationalDataProvider>
          </WorkspaceProvider>
        </AuthProvider>
      </ObservabilityProvider>
    </ThemeProvider>
  );
}
