import type { IntentSignal, IntentSource, InteractionType } from './types';
import type { OperationalSection } from './types';

const INTENT_MAP: Record<string, IntentSignal> = {
  // Board interactions
  card_drag: { intent: 'moving_cards', source: 'drag', confidence: 0.9 },
  card_drop: { intent: 'moving_cards', source: 'drag', confidence: 0.9 },
  task_status_change: { intent: 'reviewing_execution', source: 'interaction', confidence: 0.85 },

  // Modal/panel contexts
  blocker_discussion: { intent: 'blocker_discussion', source: 'modal', confidence: 0.95 },
  sprint_planning_modal: { intent: 'sprint_planning', source: 'modal', confidence: 0.95 },

  // Edit operations
  task_edit: { intent: 'editing_task', source: 'edit', confidence: 0.9 },
  dependency_edit: { intent: 'editing_dependencies', source: 'edit', confidence: 0.9 },
  story_create: { intent: 'creating_stories', source: 'interaction', confidence: 0.85 },
  epic_edit: { intent: 'refining_epics', source: 'edit', confidence: 0.85 },

  // Sprint actions
  sprint_start: { intent: 'planning_sprint', source: 'interaction', confidence: 0.85 },
  sprint_assign: { intent: 'assigning_workload', source: 'interaction', confidence: 0.8 },

  // Timeline interactions
  milestone_adjust: { intent: 'adjusting_milestones', source: 'interaction', confidence: 0.85 },
  critical_path_view: { intent: 'analyzing_critical_path', source: 'interaction', confidence: 0.75 },
  resource_view: { intent: 'reviewing_resource_allocation', source: 'interaction', confidence: 0.7 },

  // Analytic/review interactions
  velocity_view: { intent: 'reviewing_velocity', source: 'interaction', confidence: 0.7 },
  metrics_view: { intent: 'reviewing_metrics', source: 'interaction', confidence: 0.7 },
  risk_review: { intent: 'reviewing_risk', source: 'interaction', confidence: 0.8 },

  // Backlog interactions
  backlog_prioritize: { intent: 'prioritizing_backlog', source: 'interaction', confidence: 0.85 },
  estimate_edit: { intent: 'validating_estimates', source: 'edit', confidence: 0.8 },
  dependency_view: { intent: 'analyzing_dependencies', source: 'interaction', confidence: 0.75 },
  overdue_view: { intent: 'analyzing_overdue', source: 'interaction', confidence: 0.7 },
  release_coordinate: { intent: 'coordinating_release', source: 'interaction', confidence: 0.85 },

  // Focus/command
  search_focus: { intent: 'general', source: 'focus', confidence: 0.3 },
  filter_change: { intent: 'reviewing_execution', source: 'interaction', confidence: 0.6 },
  sort_change: { intent: 'reviewing_execution', source: 'interaction', confidence: 0.6 },
};

export function resolveInteractionSignal(
  interactionType: InteractionType,
  section: OperationalSection,
): IntentSignal {
  const key = interactionType;
  const resolved = INTENT_MAP[key];
  if (resolved) return resolved;
  return { intent: 'general', source: 'route', confidence: 0.3 };
}

export function resolveModalIntent(modalType: string): IntentSignal | null {
  const key = `${modalType}_modal`;
  const resolved = INTENT_MAP[key];
  if (resolved) return resolved;
  return null;
}

const MUTATION_SELECTORS = [
  '[data-task-editor]',
  '[data-sprint-planner]',
  '[data-dependency-editor]',
  '[data-epic-editor]',
  '[data-backlog-prioritizer]',
  '[data-timeline-editor]',
];

export function detectMutationIntent(target: Element): IntentSignal | null {
  for (const selector of MUTATION_SELECTORS) {
    if (target.closest(selector)) {
      const dataset = (target.closest(selector) as HTMLElement)?.dataset;
      if (dataset?.intent) {
        return {
          intent: dataset.intent as any,
          source: 'mutation',
          confidence: 0.7,
        };
      }
    }
  }
  return null;
}
