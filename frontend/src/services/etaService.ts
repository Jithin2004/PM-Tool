import { calculateExpectedEffort, calculatePertStandardDeviation, normalizePertInput } from '../utils/pert';
import { addWorkingHours, calculateDailyProductiveHours, findNextWorkingSlot, type WorkWindow } from '../utils/productivity';
import { calendarEventService } from './calendarEventService';
import { effectivenessMultiplier, teamOutput } from './resourceProfileService';
import { confidenceCalibrationService } from './confidenceCalibrationService';
import { contextPredictionService, inferTaskCategory } from './contextPredictionService';
import type { WorkspaceSettings } from '../types/workspace';
import type { CalendarEvent, Task, ResourceProfile } from '../types';

export interface EtaInput {
  best?: number;
  likely?: number;
  worst?: number;
  estimatedHours?: number;
  startDate?: Date;
  deadline?: Date | null;
  workWindow: WorkWindow;
  attendanceFactor?: number;
  availabilityFactor?: number;
  teamLoadFactor?: number;
  interruptionHours?: number;
  workspaceId?: string;
  assigneeId?: string;
  taskName?: string;
  projectId?: string;
  taskTags?: string[];
  resourceProfiles?: ResourceProfile[];
  engineerCount?: number;
  allocationPercent?: number; // Project Allocation % (0-100)
  totalUtilizationPercent?: number; // Total User Capacity % (0-X)
  allocationPeriods?: any[]; // Phase 2A.1: Array of AllocationPeriod
}

export async function getSchedulingContext(
  workspaceSettings: WorkspaceSettings,
  workspaceId: string,
  assigneeId?: string | null,
  teamId?: string | null
): Promise<WorkWindow & { calendarEvents?: CalendarEvent[] }> {
  const window: WorkWindow = {
    ...workspaceSettings,
    holidays: [],
    teamEvents: [],
    personalLeaves: []
  };

  const farFuture = new Date();
  farFuture.setFullYear(farFuture.getFullYear() + 1);
  const rangeStart = new Date().toISOString().split('T')[0];
  const rangeEnd = farFuture.toISOString().split('T')[0];

  try {
    const events = await calendarEventService.getEventsInRange(workspaceId, rangeStart, rangeEnd);

    window.holidays = events
      .filter(e => e.event_type === 'holiday' || e.event_type === 'festival')
      .map(e => e.start_date.split('T')[0]);

    if (teamId) {
      window.teamEvents = events
        .filter(e => (e.event_type === 'company' || e.event_type === 'sprint' || e.event_type === 'meeting') && (!e.participants || e.participants.length === 0))
        .map(e => ({
          start: new Date(e.start_date),
          end: new Date(e.end_date),
          availabilityFactor: 1 - (e.capacity_impact * (e.capacity_modifier ?? 1))
        }));
    }

    if (assigneeId) {
      window.personalLeaves = events
        .filter(e => e.event_type === 'leave' || (e.event_type === 'meeting' && e.participants?.includes(assigneeId)))
        .map(e => ({
          start: new Date(e.start_date),
          end: new Date(e.end_date),
          availabilityFactor: e.event_type === 'leave' ? 1 - (e.capacity_impact * (e.capacity_modifier ?? 1)) : 0
        }));
    }

    const orgShutdowns = events
      .filter(e => e.source_table === 'organization' && e.event_type === 'company' && (e.capacity_impact ?? 1) >= 1)
      .map(e => ({
        start: e.start_date.split('T')[0],
        end: e.end_date.split('T')[0],
        name: e.title || 'Company event'
      }));

    window.shutdowns = [...(window.shutdowns || []), ...orgShutdowns];

    (window as any).calendarEvents = events;
  } catch (err) {
    (window as any).calendarEvents = [];
  }

  return window;
}

export interface EtaResult {
  estimatedEffortHours: number;
  adjustedEffortHours: number;
  predictedCompletion: Date;
  confidence: number;
  risk: 'low' | 'medium' | 'high';
  delayDriftDays: number;
  dailyCapacityHours: number;
  resourceMultiplier?: number;
  engineerCount?: number;
}

export interface CountdownResult {
  text: string;
  color: string;
  pulse: string;
}

function computeRawConfidence(
  uncertaintyHours: number,
  delayDriftDays: number,
  teamLoadFactor: number
): number {
  return Math.max(
    5,
    Math.min(99, Math.round(100 - uncertaintyHours * 3 - Math.max(0, delayDriftDays) * 8 - (teamLoadFactor - 1) * 20))
  );
}

function computeEta(input: EtaInput): Omit<EtaResult, 'confidence'> & { rawConfidence: number } {
  const workWindow = input.workWindow;
  const pert = normalizePertInput(input.best, input.likely ?? input.estimatedHours, input.worst);
  const estimatedEffortHours = input.estimatedHours ?? calculateExpectedEffort(pert);
  const uncertaintyHours = calculatePertStandardDeviation(pert);
  const attendanceFactor = Math.max(0.1, input.attendanceFactor ?? 1);
  
  // Phase 2A: Capacity Engine Integration
  // A 50% allocation means the person is only available half the time, doubling the chronological ETA.
  // Phase 2A.1: If time-bound allocationResolver exists, do not double-count it here.
  const allocationRatio = Math.max(0.01, (input.allocationPercent ?? 100) / 100);
  const availabilityFactor = input.workWindow.allocationResolver 
    ? Math.max(0.1, input.availabilityFactor ?? 1)
    : Math.max(0.1, (input.availabilityFactor ?? 1) * allocationRatio);
  
  const teamLoadFactor = Math.max(1, input.teamLoadFactor ?? 1);
  const interruptionHours = Math.max(0, input.interruptionHours ?? 0);

  let resourceMultiplier = 1;
  if (input.resourceProfiles && input.resourceProfiles.length > 0) {
    const engCount = input.engineerCount ?? input.resourceProfiles.length;
    resourceMultiplier = Math.max(0.1, teamOutput(engCount, input.resourceProfiles));
  }

  const adjustedEffortHours = Number(
    (((estimatedEffortHours + interruptionHours + uncertaintyHours) * teamLoadFactor) / (attendanceFactor * availabilityFactor * resourceMultiplier)).toFixed(2)
  );
  const predictedCompletion = addWorkingHours(input.startDate || new Date(), adjustedEffortHours, workWindow);
  const delayDriftDays = input.deadline
    ? Math.ceil((predictedCompletion.getTime() - input.deadline.getTime()) / 86400000)
    : 0;
  const risk = delayDriftDays > 2 || uncertaintyHours > estimatedEffortHours * 0.35
    ? 'high'
    : delayDriftDays > 0 || uncertaintyHours > estimatedEffortHours * 0.2
      ? 'medium'
      : 'low';
  const rawConfidence = computeRawConfidence(uncertaintyHours, delayDriftDays, teamLoadFactor);

  return {
    estimatedEffortHours,
    adjustedEffortHours,
    predictedCompletion,
    rawConfidence,
    risk,
    delayDriftDays,
    dailyCapacityHours: calculateDailyProductiveHours(workWindow),
    resourceMultiplier,
    engineerCount: input.engineerCount ?? input.resourceProfiles?.length
  };
}

export function predictEtaSync(input: EtaInput): EtaResult {
  if (input.allocationPeriods && input.allocationPeriods.length > 0 && input.projectId) {
    input.workWindow.allocationResolver = (dateStr: string) => {
      const active = input.allocationPeriods!.find(p => p.project_id === input.projectId && p.start_date <= dateStr && p.end_date >= dateStr);
      return active ? active.allocation_percent : (input.allocationPercent ?? 100);
    };
  }
  const base = computeEta(input);
  return {
    ...base,
    confidence: base.rawConfidence
  };
}

export async function predictEta(input: EtaInput): Promise<EtaResult> {
  if (input.allocationPeriods && input.allocationPeriods.length > 0 && input.projectId) {
    input.workWindow.allocationResolver = (dateStr: string) => {
      const active = input.allocationPeriods!.find(p => p.project_id === input.projectId && p.start_date <= dateStr && p.end_date >= dateStr);
      return active ? active.allocation_percent : (input.allocationPercent ?? 100);
    };
  }
  const base = computeEta(input);
  let confidence = base.rawConfidence;
  if (input.workspaceId) {

    const adj = await confidenceCalibrationService.getConfidenceAdjustment(input.workspaceId, base.rawConfidence);
    confidence = adj.adjustedConfidence;

    if (input.assigneeId || input.taskName || input.projectId) {

      const contexts: Array<{ type: 'assignee' | 'task_category' | 'project_type' | 'execution_mode' | 'industry'; value: string }> = [];
      if (input.assigneeId) contexts.push({ type: 'assignee', value: input.assigneeId });
      if (input.taskName) contexts.push({ type: 'task_category', value: inferTaskCategory(input.taskName, input.taskTags) });
      const ctxAdj = await contextPredictionService.getContextAdjustment(input.workspaceId, base.rawConfidence, contexts);
      confidence = ctxAdj.adjustedConfidence;
    }

    if (input.resourceProfiles && input.resourceProfiles.length > 0) {
      const seniorCount = input.resourceProfiles.filter(p => p.skill_level === 'senior' || p.skill_level === 'lead').length;
      const juniorCount = input.resourceProfiles.filter(p => p.skill_level === 'intern' || p.skill_level === 'junior').length;
      const totalEng = input.engineerCount ?? input.resourceProfiles.length;
      if (seniorCount > juniorCount) confidence = Math.min(99, confidence + 3);
      else if (juniorCount > seniorCount) confidence = Math.max(5, confidence - 5);
      if (totalEng > 3) confidence = Math.max(5, confidence - 3);
    }
  }

  // Phase 2A: Capacity Pressure Confidence Correction
  if (input.totalUtilizationPercent) {
    if (input.totalUtilizationPercent > 100) confidence -= 10;
    if (input.totalUtilizationPercent > 150) confidence -= 20;
    if (input.totalUtilizationPercent > 200) confidence -= 35;
  }
  confidence = Math.max(5, Math.min(99, confidence));

  return {
    ...base,
    confidence
  };
}

export function calculateTaskCountdown(
  createdAt: string | undefined,
  weightHours: number,
  status: string,
  workWindow?: WorkWindow
): CountdownResult {
  if (status === 'validation' || status === 'merged' || status === 'done' || status === 'review') {
    return { text: 'DONE', color: 'text-emerald-500', pulse: 'bg-emerald-500' };
  }

  if (status === 'backlog') {
    return { text: 'WAITING', color: 'text-[var(--pm-text)] dark:text-[var(--text-secondary)] font-mono', pulse: 'bg-[var(--pm-surface)]/10' };
  }

  if (status === 'ready' || status === 'todo') {
    return { text: 'READY', color: 'text-cyan-400 font-mono', pulse: 'bg-cyan-500/50' };
  }

  if (!weightHours || weightHours <= 0) {
    return { text: 'No task estimates available', color: 'text-[var(--pm-text)] dark:text-[var(--text-secondary)] font-mono', pulse: 'bg-[var(--pm-surface)]/10' };
  }

  if (!workWindow) {
    const now = Date.now();
    const createdTime = new Date(createdAt || new Date()).getTime();
    const targetTime = createdTime + weightHours * 60 * 60 * 1000;
    const remainingMs = targetTime - now;
    if (remainingMs <= 0) return { text: 'OVERDUE', color: 'text-rose-500 font-bold', pulse: 'bg-rose-500 animate-ping' };
    const hours = Math.floor(remainingMs / 3600000);
    const mins = Math.floor((remainingMs % 3600000) / 60000);
    const secs = Math.floor((remainingMs % 60000) / 1000);
    const text = `${String(hours).padStart(2, '0')}:${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
    if (hours < 2) return { text, color: 'text-amber-500 font-mono font-medium', pulse: 'bg-amber-500 animate-pulse' };
    return { text, color: 'text-cyan-400 font-mono', pulse: 'bg-cyan-500 animate-pulse' };
  }

  const predictedEnd = addWorkingHours(new Date(createdAt || new Date()), weightHours, workWindow);
  const now = new Date();
  if (predictedEnd <= now) return { text: 'OVERDUE', color: 'text-rose-500 font-bold', pulse: 'bg-rose-500 animate-ping' };

  const totalMs = predictedEnd.getTime() - now.getTime();
  const totalHours = totalMs / 3600000;
  if (totalHours > 48) {
    return { text: `${Math.round(totalHours / 24)}d ${Math.round(totalHours % 24)}h`, color: 'text-cyan-400 font-mono', pulse: 'bg-cyan-500 animate-pulse' };
  }
  const hours = Math.floor(totalHours);
  const mins = Math.floor((totalMs % 3600000) / 60000);
  const secs = Math.floor((totalMs % 60000) / 1000);
  const text = `${String(hours).padStart(2, '0')}:${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  if (hours < 2) return { text, color: 'text-amber-500 font-mono font-medium', pulse: 'bg-amber-500 animate-pulse' };
  return { text, color: 'text-cyan-400 font-mono', pulse: 'bg-cyan-500 animate-pulse' };
}

export function getNextAvailableSlot(task: Task, workWindow: WorkWindow): string | null {
  const now = new Date();
  const slot = findNextWorkingSlot(now, workWindow);
  if (!slot) return null;
  return slot.toISOString();
}

export { getSchedulingReason } from '../utils/productivity';
