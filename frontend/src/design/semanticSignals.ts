export type SignalType = 'blocker' | 'risk' | 'pressure' | 'vitality' | 'instability' | 'coordination' | 'neutral';

export interface SemanticSignal {
  type: SignalType;
  color: string;
  bg: string;
  icon: string;
}

export const SIGNAL_MAP: Record<SignalType, SemanticSignal> = {
  blocker:       { type: 'blocker',       color: 'var(--signal-critical)', bg: 'var(--signal-critical-bg)', icon: '◆' },
  risk:          { type: 'risk',          color: 'var(--signal-warning)',  bg: 'var(--signal-warning-bg)',  icon: '◈' },
  pressure:      { type: 'pressure',      color: 'var(--signal-warning)',  bg: 'var(--signal-warning-bg)',  icon: '△' },
  vitality:      { type: 'vitality',      color: 'var(--signal-safe)',    bg: 'var(--signal-safe-bg)',    icon: '○' },
  instability:   { type: 'instability',   color: 'var(--signal-critical)', bg: 'var(--signal-critical-bg)', icon: '◇' },
  coordination:  { type: 'coordination',  color: 'var(--signal-info)',    bg: 'var(--signal-info-bg)',    icon: '◎' },
  neutral:       { type: 'neutral',       color: 'var(--text-tertiary)',  bg: 'transparent',              icon: '·' },
};

export function getSignal(type: SignalType): SemanticSignal {
  return SIGNAL_MAP[type];
}
