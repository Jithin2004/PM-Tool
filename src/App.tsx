import { useEffect } from 'react';
import { AppProviders } from './app/providers';
import { ResolveRouter } from './app/router';

declare global {
  interface Window {
    resolveDebug?: {
      runStressTest: (config?: any) => Promise<any>;
      cleanupStress: (runId: string) => Promise<any>;
    };
  }
}

const enableDebug = localStorage.getItem('resolve-debug') === 'true';

export default function App() {
  useEffect(() => {
    if (enableDebug) {
      window.resolveDebug = {
        runStressTest: async (config = {}) => {
          const mod = await import('./services/syntheticStressTest');
          return mod.runSyntheticStressTest(config);
        },
        cleanupStress: async (runId: string) => {
          const mod = await import('./services/syntheticStressTest');
          return mod.cleanupSyntheticRun(runId);
        },
      };
      console.log('[Resolve Debug Enabled]');
    }
  }, []);

  return (
    <AppProviders>
      <ResolveRouter />
    </AppProviders>
  );
}
