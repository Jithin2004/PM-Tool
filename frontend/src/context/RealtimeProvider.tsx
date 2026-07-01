import React, { createContext, useState } from 'react';
import { useWorkspace } from './WorkspaceContext';
import { useAuth } from './AuthContext';
import { useOperationalData } from './OperationalDataContext';
import { useBootstrap } from '../core/lifecycle/BootstrapOrchestrator';
import { BootstrapState } from '../core/lifecycle/types';
import { 
  useTasksRealtime,
  useApprovalsRealtime,
  useNotificationsRealtime,
  useCommentsRealtime,
  useDocumentsRealtime,
  useFileEventsRealtime,
  useIntegrationEventsRealtime,
  useActivityRealtime
} from '../hooks/useRealtime';

interface RealtimeContextType {
  isConnected: boolean;
}

const RealtimeContext = createContext<RealtimeContextType>({ isConnected: false });

export function RealtimeProvider({ children }: { children: React.ReactNode }) {
  const { workspace } = useWorkspace() as any;
  const { profile } = useAuth();
  const { refreshAll } = useOperationalData() as any;
  const { bootstrapState } = useBootstrap();
  
  const [isConnected, setIsConnected] = useState(true);

  // Only enable realtime engines when the application is fully READY
  const isReady = bootstrapState === BootstrapState.READY;
  
  // Realtime hooks should be designed to accept undefined/null to stay dormant,
  // or we pass a conditional flag. Our current hooks check for wsId, so we can nullify it.
  const wsId = isReady ? workspace?.id : null;
  const userId = isReady ? profile?.id : null;

  const handleUpdate = () => {
    if (refreshAll && isReady) {
      refreshAll();
    }
  };

  useTasksRealtime(wsId, handleUpdate);
  useApprovalsRealtime(wsId, handleUpdate);
  useNotificationsRealtime(wsId, userId, handleUpdate);
  useCommentsRealtime(wsId, handleUpdate);
  useDocumentsRealtime(wsId, handleUpdate);
  useFileEventsRealtime(wsId, handleUpdate);
  useIntegrationEventsRealtime(wsId, handleUpdate);
  useActivityRealtime(wsId, handleUpdate);

  return (
    <RealtimeContext.Provider value={{ isConnected }}>
      {children}
    </RealtimeContext.Provider>
  );
}

export const useRealtimeContext = () => useContext(RealtimeContext);
