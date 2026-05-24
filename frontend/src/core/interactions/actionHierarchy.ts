export type ActionWeight = 'primary' | 'secondary' | 'telemetry' | 'destructive';

export interface ActionConfig {
  weight: ActionWeight;
  visual: 'filled' | 'outline' | 'ghost' | 'text';
  motion: 'strong' | 'subtle' | 'none';
}

const ACTION_MAP: Record<ActionWeight, ActionConfig> = {
  primary:    { weight: 'primary',    visual: 'filled', motion: 'strong' },
  secondary:  { weight: 'secondary',  visual: 'outline', motion: 'subtle' },
  telemetry:  { weight: 'telemetry',  visual: 'ghost', motion: 'none' },
  destructive:{ weight: 'destructive',visual: 'outline', motion: 'subtle' },
};

export function getActionConfig(weight: ActionWeight): ActionConfig {
  return ACTION_MAP[weight];
}
