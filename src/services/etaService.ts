import { calculateExpectedEffort, calculatePertStandardDeviation, normalizePertInput } from '../utils/pert';
import { addWorkingHours, calculateDailyProductiveHours, type WorkWindow } from '../utils/productivity';

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
}

export interface EtaResult {
  estimatedEffortHours: number;
  adjustedEffortHours: number;
  predictedCompletion: Date;
  confidence: number;
  risk: 'low' | 'medium' | 'high';
  delayDriftDays: number;
  dailyCapacityHours: number;
}

export interface CountdownResult {
  text: string;
  color: string;
  pulse: string;
}

const DEFAULT_WORK_WINDOW: WorkWindow = {
  workStart: '09:00',
  workEnd: '17:00',
  lunchDurationMinutes: 60,
  workingDays: [1, 2, 3, 4, 5],
  productivityFactor: 0.8
};

export function predictEta(input: EtaInput): EtaResult {
  const workWindow = input.workWindow || DEFAULT_WORK_WINDOW;
  const pert = normalizePertInput(input.best, input.likely ?? input.estimatedHours, input.worst);
  const estimatedEffortHours = input.estimatedHours ?? calculateExpectedEffort(pert);
  const uncertaintyHours = calculatePertStandardDeviation(pert);
  const attendanceFactor = Math.max(0.1, input.attendanceFactor ?? 1);
  const availabilityFactor = Math.max(0.1, input.availabilityFactor ?? 1);
  const teamLoadFactor = Math.max(1, input.teamLoadFactor ?? 1);
  const interruptionHours = Math.max(0, input.interruptionHours ?? 0);
  const adjustedEffortHours = Number(
    (((estimatedEffortHours + interruptionHours + uncertaintyHours) * teamLoadFactor) / (attendanceFactor * availabilityFactor)).toFixed(2)
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
  const confidence = Math.max(
    5,
    Math.min(99, Math.round(100 - uncertaintyHours * 3 - Math.max(0, delayDriftDays) * 8 - (teamLoadFactor - 1) * 20))
  );

  return {
    estimatedEffortHours,
    adjustedEffortHours,
    predictedCompletion,
    confidence,
    risk,
    delayDriftDays,
    dailyCapacityHours: calculateDailyProductiveHours(workWindow)
  };
}

export function calculateTaskCountdown(createdAt: string | undefined, weightHours: number, status: string): CountdownResult {
  if (status === 'validation' || status === 'merged' || status === 'done') {
    return { text: 'DONE', color: 'text-emerald-500', pulse: 'bg-emerald-500' };
  }

  const now = Date.now();
  const createdTime = new Date(createdAt || new Date()).getTime();
  const targetTime = createdTime + Math.max(0.1, weightHours || 5) * 60 * 60 * 1000;
  const remainingMs = targetTime - now;

  if (remainingMs <= 0) {
    return { text: 'OVERDUE', color: 'text-rose-500 font-bold', pulse: 'bg-rose-500 animate-ping' };
  }

  const hours = Math.floor(remainingMs / 3600000);
  const mins = Math.floor((remainingMs % 3600000) / 60000);
  const secs = Math.floor((remainingMs % 60000) / 1000);
  const text = `${String(hours).padStart(2, '0')}:${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;

  if (hours < 2) {
    return { text, color: 'text-amber-500 font-mono font-medium', pulse: 'bg-amber-500 animate-pulse' };
  }

  return { text, color: 'text-cyan-400 font-mono', pulse: 'bg-cyan-500 animate-pulse' };
}
