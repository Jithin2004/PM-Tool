import type { DensityMode } from '../core/ui/densityCalibration';
import { getDensityConfig } from '../core/ui/densityCalibration';
import { SPACING } from './spacingSystem';

export interface DensityTokens {
  panel: string;
  gap: string;
  element: string;
  sectionGap: string;
}

export function getDensityTokens(mode: DensityMode): DensityTokens {
  const config = getDensityConfig(mode);
  const s = SPACING;

  switch (mode) {
    case 'compact':
      return {
        panel: `${config.panelPadding}px`,
        gap: s.sm,
        element: s.xs,
        sectionGap: s.lg,
      };
    case 'standard':
      return {
        panel: `${config.panelPadding}px`,
        gap: s.md,
        element: s.sm,
        sectionGap: s.xl,
      };
    case 'focus':
      return {
        panel: `${config.panelPadding}px`,
        gap: s.lg,
        element: s.md,
        sectionGap: s.xxl,
      };
  }
}
