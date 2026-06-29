import React, { createContext, useContext, useState } from 'react';
import { useWorkspace } from './WorkspaceContext';
import { useAuth } from './AuthContext';
import { useOperationalData } from './OperationalDataContext';
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

import { OperationalDataContext as ODC_LOCAL } from './OperationalDataContext';
export function RealtimeProvider({ children }: { children: React.ReactNode }) {
  console.log('REALTIME PROVIDER using ODC UID:', (ODC_LOCAL as any)._uid);
  const { workspace } = useWorkspace() as any;
  const { profile } = useAuth();
  const { refreshAll } = useOperationalData() as any;
  // Simplified for RC4: if any is connected, we consider it connected, but orchestrator handles the real state.
  const [isConnected, setIsConnected] = useState(true);

  const wsId = workspace?.id;
  const userId = profile?.id;

  const handleUpdate = () => {
    if (refreshAll) {
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
