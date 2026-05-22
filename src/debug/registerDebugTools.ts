import { debugActivityLogContext, verifyActivityLogAccess, setForensicDebug, getForensicAggregates } from '../services/activityLogService';

declare global {
  interface Window {
    resolveDebug?: any;
  }
}

export async function registerDebugTools(): Promise<void> {
  const enabled = localStorage.getItem('resolve-debug') === 'true';
  if (!enabled) return;

  const stress = await import('../services/syntheticStressTest');

  window.resolveDebug = {
    ...(window.resolveDebug || {}),
    runStressTest: async (config?: any) => stress.runSyntheticStressTest(config),
    cleanupStress: async (runId: string, wsId?: string) => stress.cleanupSyntheticRun(runId, wsId),
    cleanupAudit: async (runId?: string) => stress.cleanupAudit(runId),
    cleanupAllSyntheticRuns: async () => stress.cleanupAllSyntheticRuns(),
    verifyActivityLogAccess: async (workspaceId: string) => verifyActivityLogAccess(workspaceId),
    debugActivityLogContext: async () => debugActivityLogContext(),
    getLastStressReport: () => stress.getLastStressReport(),
    clearLastStressReport: () => stress.clearLastStressReport(),
    isStressRunActive: () => stress.isStressRunActive(),
    forceUnlockStressRun: () => stress.forceUnlockStressRun(),
    broadcastSyntheticCleanup: () => stress.broadcastSyntheticCleanup(),
    toggleForensics: (enabled: boolean) => setForensicDebug(enabled),
    getForensicAggregates: () => getForensicAggregates(),
    getForensicBuffer: () => stress.getForensicBuffer(),
    clearForensicBuffer: () => stress.clearForensicBuffer(),
    validateStressReport: (report: any) => stress.validateStressReport(report),
    peekStressStorage: () => stress.peekStressStorage(),
    lastStressRunState: () => stress.lastStressRunState(),
  };

  console.log('[resolveDebug registered]', Object.keys(window.resolveDebug));
}
