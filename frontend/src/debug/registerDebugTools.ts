import { debugActivityLogContext, verifyActivityLogAccess, setForensicDebug, getForensicAggregates } from '../services/activityLogService';

declare global {
  interface Window {
    resolveDebug?: any;
  }
}

export async function registerDebugTools(): Promise<void> {
  const enabled = localStorage.getItem('resolve-debug') === 'true';
  if (!enabled) return;

  window.resolveDebug = {
    ...(window.resolveDebug || {}),
    verifyActivityLogAccess: async (workspaceId: string) => verifyActivityLogAccess(workspaceId),
    debugActivityLogContext: async () => debugActivityLogContext(),
    toggleForensics: (enabled: boolean) => setForensicDebug(enabled),
    getForensicAggregates: () => getForensicAggregates(),
  };

  // Debug tools registered silently
}
