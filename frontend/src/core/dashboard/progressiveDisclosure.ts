export type DisclosureLevel = 'surface' | 'expand' | 'reveal';

export interface DisclosureState {
  level: DisclosureLevel;
  label: string;
  description: string;
}

const DISCLOSURE_HIERARCHY: Record<DisclosureLevel, DisclosureState> = {
  surface: { level: 'surface', label: 'Summary', description: 'Operational essentials only' },
  expand: { level: 'expand', label: 'Details', description: 'Supporting telemetry visible' },
  reveal: { level: 'reveal', label: 'Full Context', description: 'Complete operational intelligence' },
};

export function getDisclosureState(level: DisclosureLevel): DisclosureState {
  return DISCLOSURE_HIERARCHY[level];
}

export function shouldTruncate(
  currentLevel: DisclosureLevel,
  targetLevel: DisclosureLevel
): boolean {
  const order: DisclosureLevel[] = ['surface', 'expand', 'reveal'];
  return order.indexOf(currentLevel) < order.indexOf(targetLevel);
}
