import { useEffect } from 'react';
import { AppProviders } from './app/providers';
import { ResolveRouter } from './app/router';
import { registerDebugTools } from './debug/registerDebugTools';
import { CommandPalette } from './components/navigation/CommandPalette';
import { PremiumAppShell } from './components/layout/PremiumAppShell';

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

    const handleOffline = () => {
      window.dispatchEvent(new CustomEvent('notify-toast', {
        detail: { message: 'You are offline. Changes will be saved locally and synced when you reconnect.', type: 'warning' },
      }));
    };

    const handleOnline = () => {
      window.dispatchEvent(new CustomEvent('notify-toast', {
        detail: { message: 'Connection restored. Syncing changes...', type: 'success' },
      }));
    };

    window.addEventListener('offline', handleOffline);
    window.addEventListener('online', handleOnline);

    registerDebugTools().then(() => {
      import('./services/syntheticStressTest').then(m => {
        m.recoverAbandonedStressRuns().then(r => {
          if (r.recovered) {
          }
        });
      });
    });

    return () => {
      window.removeEventListener('error', handleError);
      window.removeEventListener('unhandledrejection', handleRejection);
      window.removeEventListener('offline', handleOffline);
      window.removeEventListener('online', handleOnline);
    };
  }, []);

  return (
    <AppProviders>
      <PremiumAppShell>
        <CommandPalette />
        <ResolveRouter />
      </PremiumAppShell>
    </AppProviders>
  );
}
