import type { FocusMode } from '../dashboard/contextualFocus';
import { getFocusConfig } from '../dashboard/contextualFocus';

export type MissionControlView = 'strategic' | 'tactical' | 'diagnostic';

export interface MissionFocus {
  view: MissionControlView;
  label: string;
  focusMode: FocusMode;
}

const VIEW_FOCUS_MAP: Record<MissionControlView, MissionFocus> = {
  strategic:  { view: 'strategic',  label: 'Strategic Overview',  focusMode: 'execution' },
  tactical:   { view: 'tactical',   label: 'Tactical Signals',    focusMode: 'coordination' },
  diagnostic: { view: 'diagnostic', label: 'Deep Diagnostics',   focusMode: 'full' },
};

export function getMissionFocus(view: MissionControlView): MissionFocus {
  return VIEW_FOCUS_MAP[view];
}

export function getMissionFocusConfig(view: MissionControlView) {
  const mf = getMissionFocus(view);
  return getFocusConfig(mf.focusMode);
}
