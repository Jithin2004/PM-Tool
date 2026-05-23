import type { OperationalPresence, CollaborationSignal } from './types';
import { describeIntent, intentToSignalType } from './operationalIntent';

export function deriveSignals(
  visiblePresences: OperationalPresence[],
  contextFilter?: { projectId?: string; sprintId?: string; epicId?: string },
): CollaborationSignal[] {
  const now = new Date().toISOString();
  const signals: CollaborationSignal[] = [];

  for (const p of visiblePresences) {
    if (p.idle || p.state === 'away' || p.state === 'idle') continue;

    const ctx = p.context;
    if (contextFilter?.projectId && ctx.projectId !== contextFilter.projectId) continue;
    if (contextFilter?.sprintId && ctx.sprintId !== contextFilter.sprintId) continue;
    if (contextFilter?.epicId && ctx.epicId !== contextFilter.epicId) continue;

    signals.push({
      userId: p.userId,
      username: p.username,
      type: intentToSignalType(p.intent),
      context: ctx,
      intent: p.intent,
      timestamp: now,
    });
  }

  return signals;
}

export function summarizePresences(
  presences: OperationalPresence[],
): { total: number; editing: number; reviewing: number; planning: number; blocked: number } {
  const active = presences.filter(p => !p.idle && p.state !== 'away');
  return {
    total: active.length,
    editing: active.filter(p => p.intent === 'editing_task' || p.intent === 'editing_dependencies' || p.intent === 'creating_stories' || p.intent === 'refining_epics').length,
    reviewing: active.filter(p => p.state === 'reviewing' || p.intent === 'reviewing_blockers' || p.intent === 'reviewing_execution' || p.intent === 'reviewing_dependencies' || p.intent === 'reviewing_risk').length,
    planning: active.filter(p => p.state === 'planning' || p.state === 'in_backlog' || p.state === 'in_sprint').length,
    blocked: active.filter(p => p.intent === 'blocker_discussion').length,
  };
}
