export type MotionIntensity = 'none' | 'subtle' | 'standard' | 'emphatic';

export interface MotionSpec {
  intensity: MotionIntensity;
  durationMs: number;
  easing: string;
  properties: string[];
}

export const MOTION_SPECS: Record<MotionIntensity, MotionSpec> = {
  none:     { intensity: 'none',     durationMs: 0,   easing: 'linear',        properties: [] },
  subtle:   { intensity: 'subtle',   durationMs: 150, easing: 'ease-out',      properties: ['opacity'] },
  standard: { intensity: 'standard', durationMs: 200, easing: 'cubic-bezier(0.4, 0, 0.2, 1)', properties: ['opacity', 'transform'] },
  emphatic: { intensity: 'emphatic', durationMs: 300, easing: 'cubic-bezier(0.34, 1.56, 0.64, 1)', properties: ['opacity', 'transform', 'box-shadow'] },
};

export function getMotion(intensity: MotionIntensity): MotionSpec {
  return MOTION_SPECS[intensity];
}

export const MOTION_REDUCED: MotionSpec = {
  intensity: 'none',
  durationMs: 0,
  easing: 'linear',
  properties: [],
};
