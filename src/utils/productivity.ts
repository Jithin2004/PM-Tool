export interface WorkWindow {
  workStart: string;
  workEnd: string;
  lunchDuration: number;
  workingDays: number[];
  productivityFactor: number;
  saturdayRule?: 'all' | 'off' | '2nd_4th' | '1st_3rd' | 'custom';
  holidays?: string[];
  shutdowns?: Array<{ start: string; end: string; name: string }>;
  teamEvents?: Array<{ start: Date; end: Date; availabilityFactor: number }>;
  personalLeaves?: Array<{ start: Date; end: Date; availabilityFactor: number }>;
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

export function getDailyCapacity(date: Date, window: WorkWindow): number {
  // 1. Weekend rules + Saturday patterns
  if (!isWorkingDay(date, window.workingDays, window.saturdayRule)) {
    return 0;
  }

  // Format date as YYYY-MM-DD (local time-safe)
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const yyyymmdd = `${year}-${month}-${day}`;

  // 2. Workspace holidays (exclude completely)
  if (window.holidays && window.holidays.includes(yyyymmdd)) {
    return 0;
  }

  // 3. Workspace shutdown dates (exclude completely)
  if (window.shutdowns) {
    const isShutdown = window.shutdowns.some(s => {
      return yyyymmdd >= s.start && yyyymmdd <= s.end;
    });
    if (isShutdown) return 0;
  }

  // Base daily hours (working hours + lunch windows + productivity factor)
  let dayCapacity = calculateDailyProductiveHours(window);

  // Normalize date range matching to ignore hours/minutes/seconds
  const dateAtMidnight = new Date(date);
  dateAtMidnight.setHours(0, 0, 0, 0);
  const timeMidnight = dateAtMidnight.getTime();

  // 4. Team events (reduce capacity)
  if (window.teamEvents && window.teamEvents.length > 0) {
    let teamFactor = 1;
    window.teamEvents.forEach(e => {
      const startMidnight = new Date(e.start);
      startMidnight.setHours(0, 0, 0, 0);
      const endMidnight = new Date(e.end);
      endMidnight.setHours(0, 0, 0, 0);

      if (timeMidnight >= startMidnight.getTime() && timeMidnight <= endMidnight.getTime()) {
        teamFactor = Math.min(teamFactor, Number(e.availabilityFactor ?? 1));
      }
    });
    dayCapacity *= teamFactor;
  }

  // 5. Personal leaves (reduce capacity)
  if (window.personalLeaves && window.personalLeaves.length > 0) {
    let leaveFactor = 1;
    window.personalLeaves.forEach(l => {
      const startMidnight = new Date(l.start);
      startMidnight.setHours(0, 0, 0, 0);
      const endMidnight = new Date(l.end);
      endMidnight.setHours(0, 0, 0, 0);

      if (timeMidnight >= startMidnight.getTime() && timeMidnight <= endMidnight.getTime()) {
        leaveFactor = Math.min(leaveFactor, Number(l.availabilityFactor ?? 0));
      }
    });
    dayCapacity *= leaveFactor;
  }

  return Number(dayCapacity.toFixed(2));
}

export function addWorkingHours(start: Date, hours: number, window: WorkWindow): Date {
  const result = new Date(start);
  let remaining = Math.max(0, hours);

  while (remaining > 0) {
    const dailyCap = getDailyCapacity(result, window);
    if (dailyCap > 0) {
      remaining -= Math.min(remaining, dailyCap);
    }

    if (remaining > 0) {
      result.setDate(result.getDate() + 1);
      result.setHours(0, 0, 0, 0);
    }
  }

  return result;
}
