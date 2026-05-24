export type PressureLevel = 'none' | 'low' | 'moderate' | 'high' | 'critical';

export interface PressureIndicator {
  level: PressureLevel;
  color: string;
  pulse: boolean;
  label: string;
}

const PRESSURE_MAP: Record<PressureLevel, PressureIndicator> = {
  none:     { level: 'none',     color: 'var(--text-quaternary)', pulse: false, label: 'Stable' },
  low:      { level: 'low',      color: 'var(--signal-safe)',     pulse: false, label: 'Low Pressure' },
  moderate: { level: 'moderate', color: 'var(--signal-info)',     pulse: false, label: 'Moderate' },
  high:     { level: 'high',     color: 'var(--signal-warning)',  pulse: true,  label: 'High Pressure' },
  critical: { level: 'critical', color: 'var(--signal-critical)', pulse: true,  label: 'Critical Pressure' },
};

export function getPressure(level: PressureLevel): PressureIndicator {
  return PRESSURE_MAP[level];
}

export function determinePressureLevel(value: number): PressureLevel {
  if (value >= 0.9) return 'critical';
  if (value >= 0.7) return 'high';
  if (value >= 0.4) return 'moderate';
  if (value >= 0.2) return 'low';
  return 'none';
}
