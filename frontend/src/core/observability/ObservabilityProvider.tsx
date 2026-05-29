import React, { createContext, useContext, useEffect, useState } from 'react';
import { ObservabilityEngine } from './ObservabilityEngine';
import { PlatformHealthStatus, RealtimeHealthProfile, AuditIntegrityStatus, ReplayIntegrityProfile, OperationalReliabilityMetrics, IncidentRecord } from './types';

interface ObservabilityContextValue {
  health: PlatformHealthStatus;
  realtime: RealtimeHealthProfile;
  audit: AuditIntegrityStatus;
  replay: ReplayIntegrityProfile;
  metrics: OperationalReliabilityMetrics;
  incidents: IncidentRecord[];
  resolveIncident: (id: string) => void;
}

const ObservabilityContext = createContext<ObservabilityContextValue | null>(null);

export const ObservabilityProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [state, setState] = useState<Omit<ObservabilityContextValue, 'resolveIncident'>>({
    health: ObservabilityEngine.getHealth(),
    realtime: ObservabilityEngine.getRealtime(),
    audit: ObservabilityEngine.getAudit(),
    replay: ObservabilityEngine.getReplay(),
    metrics: ObservabilityEngine.getMetrics(),
    incidents: ObservabilityEngine.getIncidents()
  });

  useEffect(() => {
    const unsubscribe = ObservabilityEngine.subscribe(() => {
      setState({
        health: { ...ObservabilityEngine.getHealth() },
        realtime: { ...ObservabilityEngine.getRealtime() },
        audit: { ...ObservabilityEngine.getAudit() },
        replay: { ...ObservabilityEngine.getReplay() },
        metrics: { ...ObservabilityEngine.getMetrics() },
        incidents: [...ObservabilityEngine.getIncidents()]
      });
    });
    return () => { unsubscribe(); };
  }, []);

  return (
    <ObservabilityContext.Provider value={{ ...state, resolveIncident: ObservabilityEngine.resolveIncident.bind(ObservabilityEngine) }}>
      {children}
    </ObservabilityContext.Provider>
  );
};

export const useObservability = () => {
  const context = useContext(ObservabilityContext);
  if (!context) throw new Error('useObservability must be used within ObservabilityProvider');
  return context;
};
