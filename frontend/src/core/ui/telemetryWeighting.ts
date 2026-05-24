import type { VisualPriority } from './hierarchySystem';
import { PRIORITY_DEFINITIONS } from './hierarchySystem';

export interface TelemetryWeight {
  priority: VisualPriority;
  maxItems: number;
  expandedByDefault: boolean;
  showLabels: boolean;
}

const WEIGHT_MAP: Record<VisualPriority, TelemetryWeight> = {
  primary: { priority: 'primary', maxItems: 8, expandedByDefault: true, showLabels: true },
  secondary: { priority: 'secondary', maxItems: 5, expandedByDefault: true, showLabels: true },
  tertiary: { priority: 'tertiary', maxItems: 3, expandedByDefault: false, showLabels: false },
  passive: { priority: 'passive', maxItems: 0, expandedByDefault: false, showLabels: false },
};

export function getTelemetryWeight(priority: VisualPriority): TelemetryWeight {
  return WEIGHT_MAP[priority];
}

export function shouldTruncate(priority: VisualPriority, count: number): boolean {
  const weight = getTelemetryWeight(priority);
  return count > weight.maxItems;
}
