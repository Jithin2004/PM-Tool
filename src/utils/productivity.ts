export interface WorkWindow {
  workStart: string;
  workEnd: string;
  lunchDurationMinutes: number;
  workingDays: number[];
  productivityFactor: number;
}

export function calculateHoursFromTimeRange(from: string, to: string): number {
  if (!from || !to) return 8;

  const [fromH, fromM] = from.split(':').map(Number);
  const [toH, toM] = to.split(':').map(Number);
  let diffMin = (toH * 60 + toM) - (fromH * 60 + fromM);

  if (diffMin < 0) {
    diffMin += 24 * 60;
  }

  return Math.max(0.1, Number((diffMin / 60).toFixed(2)));
}

export function calculateDailyProductiveHours(window: WorkWindow): number {
  const grossHours = calculateHoursFromTimeRange(window.workStart, window.workEnd);
  const lunchHours = Math.max(0, window.lunchDurationMinutes) / 60;
  const netHours = Math.max(0.1, grossHours - lunchHours);
  return Number((netHours * window.productivityFactor).toFixed(2));
}

export function isWorkingDay(date: Date, workingDays: number[]): boolean {
  return workingDays.includes(date.getDay());
}

export function addWorkingHours(start: Date, hours: number, window: WorkWindow): Date {
  const result = new Date(start);
  let remaining = Math.max(0, hours);
  const dailyHours = calculateDailyProductiveHours(window);

  while (remaining > 0) {
    if (isWorkingDay(result, window.workingDays)) {
      remaining -= Math.min(remaining, dailyHours);
    }

    if (remaining > 0) {
      result.setDate(result.getDate() + 1);
      result.setHours(0, 0, 0, 0);
    }
  }

  return result;
}
