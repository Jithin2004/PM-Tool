import { createContext, useContext, type ReactNode } from 'react';
import { usePresence } from '../../hooks/usePresence';
import { isFeatureEnabled } from '../../features/flags';

interface PresenceContextValue {
  users: Array<{ user_id: string; username: string; online_at: string; typing: boolean; editing?: string }>;
  onlineCount: number;
  setTyping: (typing: boolean) => void;
  setEditing: (editing: string | undefined) => void;
}

const PresenceContext = createContext<PresenceContextValue>({
  users: [], onlineCount: 0, setTyping: () => {}, setEditing: () => {},
});

export function usePresenceContext() {
  return useContext(PresenceContext);
}

export function PresenceProvider({ wsId, children }: { wsId?: string; children: ReactNode }) {
  const presence = usePresence(isFeatureEnabled('realtime') ? wsId : undefined);

  return (
    <PresenceContext.Provider value={presence}>
      {children}
    </PresenceContext.Provider>
  );
}
