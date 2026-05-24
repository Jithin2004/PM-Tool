export interface SpacingScale {
  xs: string;
  sm: string;
  md: string;
  lg: string;
  xl: string;
  xxl: string;
  section: string;
}

export const SPACING: SpacingScale = {
  xs: '4px',
  sm: '8px',
  md: '12px',
  lg: '16px',
  xl: '20px',
  xxl: '28px',
  section: '36px',
};

export const SECTION_RHYTHM = {
  tight: SPACING.lg,
  normal: SPACING.xxl,
  relaxed: SPACING.section,
};

export function gap(modifier: keyof SpacingScale): string {
  return SPACING[modifier];
}
