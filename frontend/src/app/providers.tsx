import React from 'react';
import { WorkspaceProvider } from '../context/WorkspaceContext';
import { AuthProvider } from '../context/AuthContext';
import { ThemeProvider } from '../context/ThemeContext';
import { ObservabilityProvider } from '../core/observability/ObservabilityProvider';
import { GlobalDialogs } from '../components/common/Dialogs';
import { OperationalDataProvider } from '../context/OperationalDataContext';
import { RealtimeProvider } from '../context/RealtimeProvider';

interface AppProvidersProps {
  children: React.ReactNode;
}

const GLOBAL_FALLBACK = <div className="flex h-screen w-screen bg-[#0b0c12]"></div>;

export function AppProviders({ children }: AppProvidersProps) {
  return (
    <ThemeProvider>
      <ObservabilityProvider>
        <AuthProvider>
          <WorkspaceProvider>
            <OperationalDataProvider>
              <RealtimeProvider>
                {children}
                <GlobalDialogs />
              </RealtimeProvider>
            </OperationalDataProvider>
          </WorkspaceProvider>
        </AuthProvider>
      </ObservabilityProvider>
    </ThemeProvider>
  );
}
