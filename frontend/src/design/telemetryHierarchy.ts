import type { VisualPriority } from '../core/ui/hierarchySystem';
import { TYPESCALE } from './typographyScale';

export interface TelemetryDisplay {
  priority: VisualPriority;
  metricFont: typeof TYPESCALE.heading2;
  labelFont: typeof TYPESCALE.caption;
  contrast: number;
}

export function getTelemetryDisplay(priority: VisualPriority): TelemetryDisplay {
  const map: Record<VisualPriority, TelemetryDisplay> = {
    primary: { priority: 'primary', metricFont: TYPESCALE.heading1, labelFont: TYPESCALE.caption, contrast: 1 },
    secondary: { priority: 'secondary', metricFont: TYPESCALE.heading2, labelFont: TYPESCALE.caption, contrast: 0.85 },
    tertiary: { priority: 'tertiary', metricFont: TYPESCALE.body, labelFont: TYPESCALE.telemetry, contrast: 0.7 },
    passive: { priority: 'passive', metricFont: TYPESCALE.bodySmall, labelFont: TYPESCALE.telemetry, contrast: 0.5 },
  };
  return map[priority];
}
