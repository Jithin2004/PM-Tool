export type LoadingPhase = 'initial' | 'skeleton' | 'streaming' | 'complete';

export interface LoadingState {
  phase: LoadingPhase;
  label: string;
  duration: 'instant' | 'brief' | 'sustained';
}

export function getLoadingState(phase: LoadingPhase): LoadingState {
  const map: Record<LoadingPhase, LoadingState> = {
    initial:   { phase: 'initial',   label: 'Loading',        duration: 'instant' },
    skeleton:  { phase: 'skeleton',  label: 'Preparing',      duration: 'brief' },
    streaming: { phase: 'streaming', label: 'Syncing',        duration: 'sustained' },
    complete:  { phase: 'complete',  label: 'Operational',    duration: 'instant' },
  };
  return map[phase];
}

export const MIN_SKELETON_DISPLAY_MS = 400;
export const LOADING_STALL_MS = 4000;
