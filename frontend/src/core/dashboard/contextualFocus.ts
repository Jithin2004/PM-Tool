export type FocusMode = 'execution' | 'coordination' | 'telemetry' | 'full';

export interface FocusConfig {
  mode: FocusMode;
  showPrimary: boolean;
  showSecondary: boolean;
  showTertiary: boolean;
  showPassive: boolean;
}

const FOCUS_PRESETS: Record<FocusMode, FocusConfig> = {
  execution: { mode: 'execution', showPrimary: true, showSecondary: false, showTertiary: false, showPassive: false },
  coordination: { mode: 'coordination', showPrimary: true, showSecondary: true, showTertiary: false, showPassive: false },
  telemetry: { mode: 'telemetry', showPrimary: true, showSecondary: true, showTertiary: true, showPassive: false },
  full: { mode: 'full', showPrimary: true, showSecondary: true, showTertiary: true, showPassive: true },
};

export function getFocusConfig(mode: FocusMode): FocusConfig {
  return FOCUS_PRESETS[mode];
}

export function isSurfaceVisible(
  surfacePriority: number,
  config: FocusConfig
): boolean {
  if (surfacePriority >= 100) return config.showPrimary;
  if (surfacePriority >= 70) return config.showSecondary;
  if (surfacePriority >= 40) return config.showTertiary;
  return config.showPassive;
}
