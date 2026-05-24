import type { VisualPriority } from '../core/ui/hierarchySystem';
import { TYPESCALE } from './typographyScale';
import type { TypeSpec } from './typographyScale';

export interface TextRole {
  role: string;
  typeSpec: TypeSpec;
  color: string;
  transform?: 'uppercase' | 'capitalize' | 'none';
}

const PRIORITY_TEXT_MAP: Record<VisualPriority, TextRole> = {
  primary: {
    role: 'execution-title',
    typeSpec: TYPESCALE.heading2,
    color: 'var(--text-primary)',
  },
  secondary: {
    role: 'coordination-label',
    typeSpec: TYPESCALE.body,
    color: 'var(--text-secondary)',
  },
  tertiary: {
    role: 'telemetry-label',
    typeSpec: TYPESCALE.telemetry,
    color: 'var(--text-tertiary)',
    transform: 'uppercase',
  },
  passive: {
    role: 'passive-label',
    typeSpec: TYPESCALE.caption,
    color: 'var(--text-quaternary)',
  },
};

export function getTextRole(priority: VisualPriority): TextRole {
  return PRIORITY_TEXT_MAP[priority];
}

export function styleForRole(role: TextRole): React.CSSProperties {
  return {
    fontSize: role.typeSpec.size,
    lineHeight: role.typeSpec.lineHeight,
    fontWeight: role.typeSpec.weight,
    letterSpacing: role.typeSpec.letterSpacing,
    color: role.color,
    textTransform: role.transform ?? 'none',
  };
}
