import { useEffect } from 'react';
import { AppProviders } from './app/providers';
import { ResolveRouter } from './app/router';

declare global {
  interface Window {
    resolveDebug?: {
      runStressTest: (options?: any) => Promise<any>;
      cleanupStress: (runId: string, wsId?: string) => Promise<any>;
    };
  }
}

export default function App() {
  useEffect(() => {
    if (import.meta.env.DEV || localStorage.getItem('resolve-debug') === 'true') {
      import('./services/syntheticStressTest').then(m => {
        window.resolveDebug = {
          runStressTest: m.runSyntheticStressTest,
          cleanupStress: m.cleanupSyntheticRun,
        };
      });
    }
  }, []);

  return (
    <AppProviders>
      <ResolveRouter />
    </AppProviders>
  );
}
