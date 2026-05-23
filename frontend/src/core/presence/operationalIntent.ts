import type { OperationalIntent, IntentSignal } from './types';

const INTENT_PRIORITY: Record<OperationalIntent, number> = {
  reviewing_blockers: 100,
  editing_task: 95,
  blocker_discussion: 95,
  editing_dependencies: 90,
  planning_sprint: 85,
  sprint_planning: 85,
  adjusting_timeline: 85,
  adjusting_milestones: 85,
  assigning_workload: 80,
  coordinating_release: 80,
  creating_stories: 75,
  refining_epics: 75,
  prioritizing_backlog: 70,
  analyzing_overdue: 70,
  analyzing_critical_path: 70,
  reviewing_risk: 70,
  validating_estimates: 65,
  reviewing_execution: 60,
  reviewing_dependencies: 60,
  moving_cards: 55,
  analyzing_dependencies: 55,
  reviewing_resource_allocation: 55,
  reviewing_velocity: 50,
  reviewing_metrics: 50,
  general: 10,
};

export function resolveIntent(signals: IntentSignal[]): OperationalIntent {
  if (signals.length === 0) return 'general';

  let highest: { intent: OperationalIntent; confidence: number; priority: number } | null = null;

  for (const signal of signals) {
    const priority = INTENT_PRIORITY[signal.intent] ?? 10;
    const weighted = priority * signal.confidence;

    if (!highest || weighted > highest.confidence) {
      highest = { intent: signal.intent, confidence: weighted, priority };
    }
  }

  return highest?.intent ?? 'general';
}

export function describeIntent(intent: OperationalIntent): string {
  switch (intent) {
    case 'reviewing_blockers': return 'reviewing blockers';
    case 'editing_task': return 'editing task';
    case 'planning_sprint': return 'planning sprint';
    case 'prioritizing_backlog': return 'prioritizing backlog';
    case 'analyzing_dependencies': return 'analyzing dependencies';
    case 'adjusting_timeline': return 'adjusting timeline';
    case 'assigning_workload': return 'assigning workload';
    case 'reviewing_execution': return 'reviewing execution';
    case 'coordinating_release': return 'coordinating release';
    case 'validating_estimates': return 'validating estimates';
    case 'reviewing_risk': return 'reviewing risk';
    case 'moving_cards': return 'moving cards';
    case 'analyzing_overdue': return 'analyzing overdue';
    case 'creating_stories': return 'creating stories';
    case 'refining_epics': return 'refining epics';
    case 'analyzing_critical_path': return 'analyzing critical path';
    case 'reviewing_dependencies': return 'reviewing dependencies';
    case 'adjusting_milestones': return 'adjusting milestones';
    case 'reviewing_resource_allocation': return 'reviewing resource allocation';
    case 'sprint_planning': return 'sprint planning';
    case 'editing_dependencies': return 'editing dependencies';
    case 'blocker_discussion': return 'discussing blocker';
    case 'reviewing_metrics': return 'reviewing metrics';
    case 'reviewing_velocity': return 'reviewing velocity';
    case 'general': return 'active';
  }
}

export function intentToSignalType(intent: OperationalIntent): 'editing' | 'reviewing' | 'viewing' | 'planning' | 'blocker' | 'completed' {
  switch (intent) {
    case 'editing_task':
    case 'editing_dependencies':
    case 'creating_stories':
    case 'refining_epics':
      return 'editing';
    case 'reviewing_blockers':
    case 'reviewing_execution':
    case 'reviewing_dependencies':
    case 'reviewing_risk':
    case 'reviewing_metrics':
    case 'reviewing_velocity':
    case 'reviewing_resource_allocation':
    case 'analyzing_overdue':
    case 'analyzing_critical_path':
    case 'analyzing_dependencies':
    case 'validating_estimates':
      return 'reviewing';
    case 'blocker_discussion':
      return 'blocker';
    case 'planning_sprint':
    case 'sprint_planning':
    case 'prioritizing_backlog':
    case 'assigning_workload':
    case 'coordinating_release':
    case 'adjusting_timeline':
    case 'adjusting_milestones':
      return 'planning';
    default:
      return 'viewing';
  }
}

export function intentToOperationalState(intent: OperationalIntent): 'editing' | 'reviewing' | 'planning' | 'active' {
  const signalType = intentToSignalType(intent);
  if (signalType === 'editing') return 'editing';
  if (signalType === 'reviewing' || signalType === 'blocker') return 'reviewing';
  if (signalType === 'planning') return 'planning';
  return 'active';
}
