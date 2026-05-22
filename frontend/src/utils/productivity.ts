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

function timeToMinutes(time: string): number {
  const [h, m] = time.split(':').map(Number);
  return h * 60 + (m || 0);
}

function minutesToTime(minutes: number): string {
  const h = Math.floor(minutes / 60) % 24;
  const m = Math.round(minutes % 60);
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

export function calculateHoursFromTimeRange(from: string, to: string): number {
  if (!from || !to) return 8;
  const [fromH, fromM] = from.split(':').map(Number);
  const [toH, toM] = to.split(':').map(Number);
  let diffMin = (toH * 60 + toM) - (fromH * 60 + fromM);
  if (diffMin < 0) diffMin += 24 * 60;
  return Math.max(0.1, Number((diffMin / 60).toFixed(2)));
}

export function calculateDailyProductiveHours(window: WorkWindow): number {
  const grossHours = calculateHoursFromTimeRange(window.workStart, window.workEnd);
  const lunchHours = Math.max(0, window.lunchDuration) / 60;
  const netHours = Math.max(0.1, grossHours - lunchHours);
  return Number((netHours * window.productivityFactor).toFixed(2));
}

export function isWorkingDay(date: Date, workingDays: number[], saturdayRule?: string): boolean {
  const dayOfWeek = date.getDay();
  if (dayOfWeek === 6) {
    if (!workingDays.includes(6)) return false;
    const rule = saturdayRule || 'off';
    if (rule === 'all') return true;
    if (rule === 'off') return false;
    const satIndex = Math.ceil(date.getDate() / 7);
    if (rule === '2nd_4th') return satIndex !== 2 && satIndex !== 4;
    if (rule === '1st_3rd') return satIndex !== 1 && satIndex !== 3;
    if (rule === 'custom') return true;
    return false;
  }
  return workingDays.includes(dayOfWeek);
}

export function getDailyCapacity(date: Date, window: WorkWindow): number {
  if (!isWorkingDay(date, window.workingDays, window.saturdayRule)) return 0;

  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const yyyymmdd = `${year}-${month}-${day}`;

  if (window.holidays && window.holidays.includes(yyyymmdd)) return 0;
  if (window.shutdowns) {
    const isShutdown = window.shutdowns.some(s => yyyymmdd >= s.start && yyyymmdd <= s.end);
    if (isShutdown) return 0;
  }

  let dayCapacity = calculateDailyProductiveHours(window);
  const dateAtMidnight = new Date(date);
  dateAtMidnight.setHours(0, 0, 0, 0);
  const timeMidnight = dateAtMidnight.getTime();

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
  if (remaining === 0) return result;

  const workStartMin = timeToMinutes(window.workStart);
  const workEndMin = timeToMinutes(window.workEnd);
  const grossDayMin = workEndMin - workStartMin;
  const lunchMin = Math.max(0, window.lunchDuration);
  const netDayMin = grossDayMin - lunchMin;

  const startMin = result.getHours() * 60 + result.getMinutes();

  if (startMin < workStartMin) {
    result.setHours(Math.floor(workStartMin / 60), workStartMin % 60, 0, 0);
  } else if (startMin >= workEndMin) {
    result.setDate(result.getDate() + 1);
    result.setHours(Math.floor(workStartMin / 60), workStartMin % 60, 0, 0);
  }

  while (remaining > 0) {
    const dailyCap = getDailyCapacity(result, window);
    if (dailyCap <= 0) {
      result.setDate(result.getDate() + 1);
      result.setHours(Math.floor(workStartMin / 60), workStartMin % 60, 0, 0);
      continue;
    }

    const elapsedToday = Math.max(0, (result.getHours() * 60 + result.getMinutes()) - workStartMin);
    const productiveToday = (dailyCap / calculateDailyProductiveHours(window)) * netDayMin;
    const remainingTodayMin = Math.max(0, productiveToday - elapsedToday);
    const remainingTodayHours = remainingTodayMin / 60;

    if (remainingTodayHours <= 0) {
      result.setDate(result.getDate() + 1);
      result.setHours(Math.floor(workStartMin / 60), workStartMin % 60, 0, 0);
      continue;
    }

    const consume = Math.min(remaining, Number(remainingTodayHours.toFixed(4)));
    remaining -= consume;

    if (remaining > 0) {
      result.setDate(result.getDate() + 1);
      result.setHours(Math.floor(workStartMin / 60), workStartMin % 60, 0, 0);
    } else {
      const usedMin = Math.round(consume * 60);
      const finalMin = Math.min(workEndMin, result.getHours() * 60 + result.getMinutes() + usedMin);
      result.setHours(Math.floor(finalMin / 60), finalMin % 60, 0, 0);
    }
  }

  return result;
}

export function findNextWorkingSlot(
  from: Date,
  window: WorkWindow
): Date | null {
  const result = new Date(from);
  const workStartMin = timeToMinutes(window.workStart);
  const fromMin = result.getHours() * 60 + result.getMinutes();

  if (fromMin < workStartMin) {
    result.setHours(Math.floor(workStartMin / 60), workStartMin % 60, 0, 0);
  } else if (fromMin >= timeToMinutes(window.workEnd)) {
    result.setDate(result.getDate() + 1);
    result.setHours(Math.floor(workStartMin / 60), workStartMin % 60, 0, 0);
  }

  for (let i = 0; i < 365; i++) {
    const dailyCap = getDailyCapacity(result, window);
    if (dailyCap > 0) {
      const remainingToday = dailyCap - Math.max(0, (result.getHours() * 60 + result.getMinutes() - workStartMin) / 60);
      if (remainingToday > 0) return result;
    }
    result.setDate(result.getDate() + 1);
    result.setHours(Math.floor(workStartMin / 60), workStartMin % 60, 0, 0);
  }

  return null;
}

export function getSchedulingReason(
  target: Date,
  window: WorkWindow
): string[] {
  const reasons: string[] = [];
  const yyyymmdd = `${target.getFullYear()}-${String(target.getMonth() + 1).padStart(2, '0')}-${String(target.getDate()).padStart(2, '0')}`;
  const dayOfWeek = target.getDay();

  if (!isWorkingDay(target, window.workingDays, window.saturdayRule)) {
    const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    reasons.push(`${dayNames[dayOfWeek]} — non-working day`);
  }

  if (window.holidays && window.holidays.includes(yyyymmdd)) {
    reasons.push(`${yyyymmdd} is a holiday`);
  }

  if (window.shutdowns) {
    const shutdown = window.shutdowns.find(s => yyyymmdd >= s.start && yyyymmdd <= s.end);
    if (shutdown) reasons.push(`Company shutdown: ${shutdown.name}`);
  }

  if (window.teamEvents && window.teamEvents.length > 0) {
    const targetMs = new Date(yyyymmdd + 'T00:00:00').getTime();
    for (const e of window.teamEvents) {
      const eStart = new Date(e.start);
      eStart.setHours(0, 0, 0, 0);
      const eEnd = new Date(e.end);
      eEnd.setHours(0, 0, 0, 0);
      if (targetMs >= eStart.getTime() && targetMs <= eEnd.getTime()) {
        if (e.availabilityFactor <= 0) reasons.push('Team-wide unavailability');
        else if (e.availabilityFactor < 1) reasons.push(`Team event (${Math.round((1 - e.availabilityFactor) * 100)}% capacity)`);
      }
    }
  }

  if (window.personalLeaves && window.personalLeaves.length > 0) {
    const targetMs = new Date(yyyymmdd + 'T00:00:00').getTime();
    for (const l of window.personalLeaves) {
      const lStart = new Date(l.start);
      lStart.setHours(0, 0, 0, 0);
      const lEnd = new Date(l.end);
      lEnd.setHours(0, 0, 0, 0);
      if (targetMs >= lStart.getTime() && targetMs <= lEnd.getTime()) {
        if (l.availabilityFactor <= 0) reasons.push('Personal leave');
        else reasons.push(`Partial leave (${Math.round((1 - l.availabilityFactor) * 100)}% capacity)`);
      }
    }
  }

  const targetMin = target.getHours() * 60 + target.getMinutes();
  const workStartMin = (() => { const [h, m] = window.workStart.split(':').map(Number); return h * 60 + m; })();
  const workEndMin = (() => { const [h, m] = window.workEnd.split(':').map(Number); return h * 60 + m; })();
  if (targetMin < workStartMin) reasons.push(`Before work hours (${window.workStart})`);
  if (targetMin >= workEndMin) reasons.push(`After work hours (${window.workEnd})`);

  return reasons.length > 0 ? reasons : ['Available slot'];
}
