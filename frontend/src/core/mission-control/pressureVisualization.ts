import type { PressureLevel } from '../../design/pressureIndicators';

export interface PressureZone {
  id: string;
  label: string;
  pressure: PressureLevel;
  value: number;
}

export type VisualizationType = 'flow' | 'zone' | 'topology';

export const VISUALIZATION_PRIORITY: Record<VisualizationType, number> = {
  flow: 100,
  zone: 80,
  topology: 60,
};

export function shouldVisualize(
  type: VisualizationType,
  activeView: string
): boolean {
  if (type === 'flow' || type === 'zone') return true;
  if (type === 'topology' && activeView === 'strategic') return true;
  return false;
}
