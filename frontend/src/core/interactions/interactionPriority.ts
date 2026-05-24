import type { ActionWeight } from './actionHierarchy';
import type { VisualPriority } from '../ui/hierarchySystem';
import { PRIORITY_DEFINITIONS } from '../ui/hierarchySystem';

export interface InteractionRule {
  actionWeight: ActionWeight;
  surfacePriority: VisualPriority;
  clickable: boolean;
  hoverFeedback: boolean;
}

export function resolveInteraction(
  actionWeight: ActionWeight,
  surfacePriority: VisualPriority
): InteractionRule {
  return {
    actionWeight,
    surfacePriority,
    clickable: actionWeight !== 'telemetry',
    hoverFeedback: surfacePriority !== 'passive',
  };
}

export function getInteractionPriority(
  surfacePriority: VisualPriority
): number {
  return PRIORITY_DEFINITIONS[surfacePriority].visualWeight;
}
