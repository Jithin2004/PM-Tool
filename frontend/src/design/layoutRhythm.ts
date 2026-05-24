export type Rhythm = 'tight' | 'standard' | 'relaxed';

export const RHYTHM_MAP: Record<Rhythm, { sectionGap: string; panelGap: string }> = {
  tight:   { sectionGap: '16px', panelGap: '12px' },
  standard:{ sectionGap: '24px', panelGap: '16px' },
  relaxed: { sectionGap: '36px', panelGap: '24px' },
};

export function getRhythm(rhythm: Rhythm) {
  return RHYTHM_MAP[rhythm];
}

export const LAYOUT_MAX_WIDTHS = {
  dashboard: '1280px',
  'mission-control': '1440px',
  board: '100%',
};
