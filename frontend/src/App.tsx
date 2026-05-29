import { useEffect } from 'react';
import { AppProviders } from './app/providers';
import { ResolveRouter } from './app/router';
import { registerDebugTools } from './debug/registerDebugTools';
import { CommandPalette } from './components/navigation/CommandPalette';

export default function App() {
  useEffect(() => {
    // Wave 8: Global Error Tracking Governance
    const handleError = (e: ErrorEvent) => {
      import('./core/observability/ObservabilityEngine').then(({ ObservabilityEngine }) => {
        ObservabilityEngine.reportIncident('api', 'warning', 'Unhandled Frontend Exception', e.message, {
          filename: e.filename,
          lineno: e.lineno
        });
      });
    };
    
    const handleRejection = (e: PromiseRejectionEvent) => {
      import('./core/observability/ObservabilityEngine').then(({ ObservabilityEngine }) => {
        const msg = e.reason?.message || String(e.reason);
        ObservabilityEngine.reportIncident('api', 'warning', 'Unhandled Promise Rejection', msg);
      });
    };

    window.addEventListener('error', handleError);
    window.addEventListener('unhandledrejection', handleRejection);

    registerDebugTools().then(() => {
      import('./services/syntheticStressTest').then(m => {
        m.recoverAbandonedStressRuns().then(r => {
          if (r.recovered) {
            console.log('[Stress Recovery] Abandoned synthetic runs cleaned up:', r.details);
          }
        });
      });
    });

    return () => {
      window.removeEventListener('error', handleError);
      window.removeEventListener('unhandledrejection', handleRejection);
    };
  }, []);

  return (
    <AppProviders>
      <CommandPalette />
      <ResolveRouter />
    </AppProviders>
  );
}
