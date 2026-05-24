export type TransitionType = 'navigation' | 'data-load' | 'mutation' | 'error-recovery';

export interface TransitionFeedback {
  type: TransitionType;
  durationMs: number;
  showSkeleton: boolean;
}

export function getTransitionConfig(type: TransitionType): TransitionFeedback {
  const map: Record<TransitionType, TransitionFeedback> = {
    navigation:     { type: 'navigation',     durationMs: 200, showSkeleton: false },
    'data-load':    { type: 'data-load',      durationMs: 400, showSkeleton: true },
    mutation:       { type: 'mutation',       durationMs: 150, showSkeleton: false },
    'error-recovery':{ type: 'error-recovery', durationMs: 300, showSkeleton: true },
  };
  return map[type];
}
