import { useEffect } from 'react';
import { AppProviders } from './app/providers';
import { ResolveRouter } from './app/router';

declare global {
  interface Window {
    resolveDebug?: {
      runStressTest: (config?: any) => Promise<any>;
      cleanupStress: (runId: string) => Promise<any>;
      cleanupAllSyntheticRuns: () => Promise<any>;
      cleanupAudit: (runId?: string) => Promise<any>;
      debugActivityLogContext: () => Promise<any>;
      verifyActivityLogAccess: (workspaceId: string) => Promise<any>;
      isStressRunActive: () => { active: boolean; runId?: string; ageMinutes?: number };
      forceUnlockStressRun: () => void;
      getLastStressReport: () => Record<string, any> | null;
      clearLastStressReport: () => void;
      broadcastSyntheticCleanup: () => void;
      toggleForensics: (enabled: boolean) => void;
      getForensicAggregates: () => { total: number; success: number; failed: number; queued: number };
      getForensicBuffer: () => Record<string, any>[];
      clearForensicBuffer: () => void;
    };
  }
}

const enableDebug = localStorage.getItem('resolve-debug') === 'true';

export default function App() {
  useEffect(() => {
    (async () => {
      const stressMod = await import('./services/syntheticStressTest');

      if (enableDebug) {
        const logMod = await import('./services/activityLogService');
        window.resolveDebug = {
          runStressTest: async (config = {}) => stressMod.runSyntheticStressTest(config),
          cleanupStress: async (runId: string) => stressMod.cleanupSyntheticRun(runId),
          cleanupAllSyntheticRuns: async () => stressMod.cleanupAllSyntheticRuns(),
          cleanupAudit: async (runId?: string) => stressMod.cleanupAudit(runId),
          debugActivityLogContext: async () => logMod.debugActivityLogContext(),
          verifyActivityLogAccess: async (workspaceId: string) => logMod.verifyActivityLogAccess(workspaceId),
          isStressRunActive: () => stressMod.isStressRunActive(),
          forceUnlockStressRun: () => stressMod.forceUnlockStressRun(),
          getLastStressReport: () => stressMod.getLastStressReport(),
          clearLastStressReport: () => stressMod.clearLastStressReport(),
          broadcastSyntheticCleanup: () => stressMod.broadcastSyntheticCleanup(),
          toggleForensics: (enabled: boolean) => logMod.setForensicDebug(enabled),
          getForensicAggregates: () => logMod.getForensicAggregates(),
          getForensicBuffer: () => stressMod.getForensicBuffer(),
          clearForensicBuffer: () => stressMod.clearForensicBuffer(),
        };
        console.log('[Resolve Debug Enabled]');
      }

      stressMod.recoverAbandonedStressRuns().then(r => {
        if (r.recovered) {
          console.log('[Stress Recovery] Abandoned synthetic runs cleaned up:', r.details);
        }
      });
    })();
  }, []);

  return (
    <AppProviders>
      <ResolveRouter />
    </AppProviders>
  );
}
