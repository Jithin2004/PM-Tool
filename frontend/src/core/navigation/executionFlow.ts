export interface FlowStep {
  id: string;
  label: string;
  route: string;
  isActive: boolean;
  isComplete: boolean;
}

export type ExecutionPhase = 'backlog' | 'active' | 'review' | 'complete';

export const PHASE_SEQUENCE: ExecutionPhase[] = ['backlog', 'active', 'review', 'complete'];

export function getPhaseIndex(phase: ExecutionPhase): number {
  return PHASE_SEQUENCE.indexOf(phase);
}

export function getExecutionFlow(currentPhase: ExecutionPhase, projectId: string): FlowStep[] {
  const steps: Record<ExecutionPhase, FlowStep> = {
    backlog: { id: 'backlog', label: 'Backlog', route: `/projects/${projectId}/backlog`, isActive: false, isComplete: false },
    active:  { id: 'active',  label: 'Active',  route: `/projects/${projectId}/board`,   isActive: false, isComplete: false },
    review:  { id: 'review',  label: 'Review',  route: `/projects/${projectId}/sprints`, isActive: false, isComplete: false },
    complete:{ id: 'complete',label: 'Done',    route: `/projects/${projectId}/timeline`,isActive: false, isComplete: false },
  };

  const currentIdx = getPhaseIndex(currentPhase);

  return PHASE_SEQUENCE.map((phase, idx) => ({
    ...steps[phase],
    isActive: idx === currentIdx,
    isComplete: idx < currentIdx,
  }));
}
