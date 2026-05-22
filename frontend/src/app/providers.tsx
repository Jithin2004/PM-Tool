import React from 'react';
import { WorkspaceProvider } from '../context/WorkspaceContext';
import { AuthProvider } from '../context/AuthContext';

interface AppProvidersProps {
  children: React.ReactNode;
}

export function AppProviders({ children }: AppProvidersProps) {
  return (
    <AuthProvider>
      <WorkspaceProvider>{children}</WorkspaceProvider>
    </AuthProvider>
  );
}
