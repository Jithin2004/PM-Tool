import { useEffect } from 'react';
import { AppProviders } from './app/providers';
import { ResolveRouter } from './app/router';
import { registerDebugTools } from './debug/registerDebugTools';

export default function App() {
  useEffect(() => {
    registerDebugTools();

    import('./services/syntheticStressTest').then(m => {
      m.recoverAbandonedStressRuns().then(r => {
        if (r.recovered) {
          console.log('[Stress Recovery] Abandoned synthetic runs cleaned up:', r.details);
        }
      });
    });
  }, []);

  return (
    <AppProviders>
      <ResolveRouter />
    </AppProviders>
  );
}
