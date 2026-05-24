export type VisualPriority = 'primary' | 'secondary' | 'tertiary' | 'passive';

export interface PriorityDefinition {
  level: VisualPriority;
  label: string;
  visualWeight: number;
  motionAllowed: boolean;
}

export const PRIORITY_DEFINITIONS: Record<VisualPriority, PriorityDefinition> = {
  primary: { level: 'primary', label: 'execution-critical', visualWeight: 100, motionAllowed: true },
  secondary: { level: 'secondary', label: 'coordination', visualWeight: 70, motionAllowed: true },
  tertiary: { level: 'tertiary', label: 'telemetry', visualWeight: 40, motionAllowed: false },
  passive: { level: 'passive', label: 'archival', visualWeight: 20, motionAllowed: false },
};

const PRIORITY_ORDER: VisualPriority[] = ['primary', 'secondary', 'tertiary', 'passive'];

export function resolvePriority(priority: VisualPriority): PriorityDefinition {
  return PRIORITY_DEFINITIONS[priority];
}

export function comparePriority(a: VisualPriority, b: VisualPriority): number {
  return PRIORITY_ORDER.indexOf(a) - PRIORITY_ORDER.indexOf(b);
}

export function shouldAnimate(priority: VisualPriority): boolean {
  return PRIORITY_DEFINITIONS[priority]?.motionAllowed ?? false;
}
