export type DensityMode = 'compact' | 'standard' | 'focus';

export interface DensityConfig {
  mode: DensityMode;
  panelPadding: number;
  sectionGap: number;
  elementSpacing: number;
  fontSizeScale: number;
}

const DENSITY_PRESETS: Record<DensityMode, Omit<DensityConfig, 'mode'>> = {
  compact: { panelPadding: 12, sectionGap: 16, elementSpacing: 8, fontSizeScale: 0.875 },
  standard: { panelPadding: 20, sectionGap: 24, elementSpacing: 12, fontSizeScale: 1 },
  focus: { panelPadding: 28, sectionGap: 36, elementSpacing: 20, fontSizeScale: 1.125 },
};

export function getDensityConfig(mode: DensityMode): DensityConfig {
  return { mode, ...DENSITY_PRESETS[mode] };
}

export function resolveDensity(
  surface: 'mission-control' | 'board' | 'dashboard' | 'timeline'
): DensityMode {
  const map: Record<string, DensityMode> = {
    'mission-control': 'focus',
    board: 'compact',
    dashboard: 'standard',
    timeline: 'standard',
  };
  return map[surface] ?? 'standard';
}
