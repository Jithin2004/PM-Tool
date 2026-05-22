const STORAGE_PREFIX = 'resolve-feature-';

export type FeatureFlag =
  | 'command-center'
  | 'command-palette'
  | 'realtime'
  | 'ai-insights'
  | 'mobile-shell'
  | 'smart-notifications'
  | 'ux-polish';

const DEFAULT_STATE: Record<FeatureFlag, boolean> = {
  'command-center': false,
  'command-palette': false,
  'realtime': false,
  'ai-insights': false,
  'mobile-shell': false,
  'smart-notifications': false,
  'ux-polish': false,
};

export function isFeatureEnabled(flag: FeatureFlag): boolean {
  try {
    const stored = localStorage.getItem(`${STORAGE_PREFIX}${flag}`);
    if (stored !== null) return stored === 'true';
    return DEFAULT_STATE[flag];
  } catch {
    return DEFAULT_STATE[flag];
  }
}

export function setFeatureEnabled(flag: FeatureFlag, enabled: boolean): void {
  try {
    localStorage.setItem(`${STORAGE_PREFIX}${flag}`, String(enabled));
    window.dispatchEvent(new CustomEvent('feature-flag-changed', { detail: { flag, enabled } }));
  } catch { /* ignore */ }
}

export function toggleFeature(flag: FeatureFlag): boolean {
  const next = !isFeatureEnabled(flag);
  setFeatureEnabled(flag, next);
  return next;
}

export function getAllFeatureStates(): Record<FeatureFlag, boolean> {
  const result = { ...DEFAULT_STATE };
  for (const flag of Object.keys(DEFAULT_STATE) as FeatureFlag[]) {
    result[flag] = isFeatureEnabled(flag);
  }
  return result;
}

export function resetAllFeatures(): void {
  for (const flag of Object.keys(DEFAULT_STATE) as FeatureFlag[]) {
    try { localStorage.removeItem(`${STORAGE_PREFIX}${flag}`); } catch { /* ignore */ }
  }
  window.dispatchEvent(new CustomEvent('feature-flag-changed', { detail: { reset: true } }));
}
