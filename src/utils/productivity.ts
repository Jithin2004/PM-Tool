export interface WorkWindow {
  workStart: string;
  workEnd: string;
  lunchDuration: number;
  workingDays: number[];
  productivityFactor: number;
  saturdayRule?: 'all' | 'off' | '2nd_4th' | '1st_3rd' | 'custom';
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
  const lunchHours = Math.max(0, window.lunchDuration) / 60;
  const netHours = Math.max(0.1, grossHours - lunchHours);
  return Number((netHours * window.productivityFactor).toFixed(2));
}

export function isWorkingDay(date: Date, workingDays: number[], saturdayRule?: string): boolean {
  const dayOfWeek = date.getDay(); // 0: Sun, 1: Mon, ..., 6: Sat

  if (dayOfWeek === 6) {
    if (!workingDays.includes(6)) {
      return false;
    }
    const rule = saturdayRule || 'off';
    if (rule === 'all') return true;
    if (rule === 'off') return false;

    const satIndex = Math.ceil(date.getDate() / 7);
    if (rule === '2nd_4th') {
      return satIndex !== 2 && satIndex !== 4;
    }
    if (rule === '1st_3rd') {
      return satIndex !== 1 && satIndex !== 3;
    }
    if (rule === 'custom') {
      return true;
    }
    return false;
  }

  return workingDays.includes(dayOfWeek);
}

export function addWorkingHours(start: Date, hours: number, window: WorkWindow): Date {
  const result = new Date(start);
  let remaining = Math.max(0, hours);
  const dailyHours = calculateDailyProductiveHours(window);

  while (remaining > 0) {
    if (isWorkingDay(result, window.workingDays, window.saturdayRule)) {
      remaining -= Math.min(remaining, dailyHours);
    }

    if (remaining > 0) {
      result.setDate(result.getDate() + 1);
      result.setHours(0, 0, 0, 0);
    }
  }

  return result;
}
