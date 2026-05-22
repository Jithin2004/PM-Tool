import { runSyntheticStressTest, cleanupSyntheticRun, cleanupAllSyntheticRuns, cleanupAudit, isStressRunActive, forceUnlockStressRun, getLastStressReport, clearLastStressReport, broadcastSyntheticCleanup, getForensicBuffer, clearForensicBuffer } from '../services/syntheticStressTest';
import { debugActivityLogContext, verifyActivityLogAccess, setForensicDebug, getForensicAggregates } from '../services/activityLogService';

declare global {
  interface Window {
    resolveDebug?: any;
  }
}

const debugRegistry = {
  runStressTest: async (config?: any) => runSyntheticStressTest(config),
  cleanupStress: async (runId: string, wsId?: string) => cleanupSyntheticRun(runId, wsId),
  cleanupAudit: async (runId?: string) => cleanupAudit(runId),
  cleanupAllSyntheticRuns: async () => cleanupAllSyntheticRuns(),
  verifyActivityLogAccess: async (workspaceId: string) => verifyActivityLogAccess(workspaceId),
  debugActivityLogContext: async () => debugActivityLogContext(),
  getLastStressReport: () => getLastStressReport(),
  clearLastStressReport: () => clearLastStressReport(),
  isStressRunActive: () => isStressRunActive(),
  forceUnlockStressRun: () => forceUnlockStressRun(),
  broadcastSyntheticCleanup: () => broadcastSyntheticCleanup(),
  toggleForensics: (enabled: boolean) => setForensicDebug(enabled),
  getForensicAggregates: () => getForensicAggregates(),
  getForensicBuffer: () => getForensicBuffer(),
  clearForensicBuffer: () => clearForensicBuffer(),
};

export function registerDebugTools(): void {
  const enabled = localStorage.getItem('resolve-debug') === 'true';
  if (!enabled) return;

  window.resolveDebug = {
    ...(window.resolveDebug || {}),
    ...debugRegistry,
  };

  console.log('[resolveDebug registered]', Object.keys(window.resolveDebug));
}
