// projectTimeEngine.ts
// Calculates age and ETA metrics for projects, accounting for working days.

export interface ProjectTimeStats {
  startedAtFormatted: string;
  calendarAgeDays: number;
  workingAgeDays: number;
  estimatedTotalDays: number;
  remainingDays: number;
  overEtaDays: number;
  isDelayed: boolean;
}

export function getCalendarAge(createdAt: string | Date): number {
  const start = new Date(createdAt);
  const now = new Date();
  
  // Set to midnight to avoid partial day calculations
  start.setHours(0, 0, 0, 0);
  now.setHours(0, 0, 0, 0);
  
  const diffTime = Math.abs(now.getTime() - start.getTime());
  return Math.floor(diffTime / (1000 * 60 * 60 * 24));
}

// Basic working days calculation (Mon-Fri)
// Assumes standard 5 day work week without holidays. Can be enhanced to read from workspaceSettings.
export function getWorkingAge(createdAt: string | Date): number {
  const start = new Date(createdAt);
  const end = new Date();
  
  start.setHours(0, 0, 0, 0);
  end.setHours(0, 0, 0, 0);

  let count = 0;
  const current = new Date(start);

  while (current <= end) {
    const dayOfWeek = current.getDay();
    if (dayOfWeek !== 0 && dayOfWeek !== 6) { // 0 = Sunday, 6 = Saturday
      count++;
    }
    current.setDate(current.getDate() + 1);
  }

  return count;
}

export function calculateProjectTimeMetrics(
  createdAt: string,
  endDateEstimate?: string, // The original estimated end date or ETA
  estimatedHoursTotal?: number // If end date is missing, we can fallback to working hours estimate
): ProjectTimeStats {
  const start = new Date(createdAt);
  
  const calendarAgeDays = getCalendarAge(start);
  const workingAgeDays = getWorkingAge(start);

  let estimatedTotalDays = 0;

  if (endDateEstimate) {
    const endEst = new Date(endDateEstimate);
    endEst.setHours(0,0,0,0);
    // Estimated days from start to estimated end
    const totalDiff = endEst.getTime() - start.getTime();
    estimatedTotalDays = Math.floor(totalDiff / (1000 * 60 * 60 * 24));
  } else if (estimatedHoursTotal) {
    // Fallback: assume 8 hours = 1 working day
    estimatedTotalDays = Math.ceil(estimatedHoursTotal / 8);
  }

  // Calculate remaining or delayed based on today
  const remainingDays = estimatedTotalDays - calendarAgeDays;
  const isDelayed = remainingDays < 0;
  const overEtaDays = isDelayed ? Math.abs(remainingDays) : 0;

  return {
    startedAtFormatted: start.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
    calendarAgeDays,
    workingAgeDays,
    estimatedTotalDays,
    remainingDays: isDelayed ? 0 : remainingDays,
    overEtaDays,
    isDelayed
  };
}
