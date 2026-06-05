import type { CalendarEvent } from '../types';

export function calculateEffectiveAvailability(
  baseAvailabilityFactor: number,
  eventDeductionHours: number,
  workHoursPerDay: number
): number {
  if (workHoursPerDay <= 0) return 0;
  const deductionFraction = Math.min(eventDeductionHours, workHoursPerDay) / workHoursPerDay;
  const effective = baseAvailabilityFactor * (1 - deductionFraction);
  return Math.max(0, Math.min(1, effective));
}

export function getEventHoursForDate(
  events: CalendarEvent[],
  userId: string,
  date: string
): number {
  const dateStart = new Date(`${date}T00:00:00`).getTime();
  const dateEnd = new Date(`${date}T23:59:59`).getTime();
  return events
    .filter(e => {
      if (e.participants && e.participants.length > 0 && !e.participants.includes(userId)) return false;
      const eStart = new Date(e.start_date).getTime();
      const eEnd = new Date(e.end_date).getTime();
      return eStart <= dateEnd && eEnd >= dateStart;
    })
    .reduce((total, e) => {
      const eStart = Math.max(new Date(e.start_date).getTime(), dateStart);
      const eEnd = Math.min(new Date(e.end_date).getTime(), dateEnd);
      const hours = (eEnd - eStart) / (1000 * 60 * 60);
      const modifier = e.capacity_modifier ?? 1;
      const effectiveImpact = e.capacity_impact * modifier;
      const impactHours = hours * (1 - effectiveImpact);
      return total + Math.max(0, impactHours);
    }, 0);
}

export function calculateTeamCapacity(
  teamMembers: Array<{ id: string; availability_factor: number }>,
  events: CalendarEvent[],
  date: string,
  workHoursPerDay: number
): number {
  return teamMembers.reduce((total, member) => {
    const eventHours = getEventHoursForDate(events, member.id, date);
    const effective = calculateEffectiveAvailability(member.availability_factor, eventHours, workHoursPerDay);
    return total + effective * workHoursPerDay;
  }, 0);
}

export function isUserAvailableOnDate(
  events: CalendarEvent[],
  userId: string,
  date: string
): { available: boolean; blockingEvents: CalendarEvent[] } {
  const dateStart = `${date}T00:00:00`;
  const dateEnd = `${date}T23:59:59`;
  const blocking = events.filter(e => {
    if (e.participants && e.participants.length > 0 && !e.participants.includes(userId)) return false;
    const modifier = e.capacity_modifier ?? 1;
    const effectiveImpact = e.capacity_impact * modifier;
    return e.start_date <= dateEnd && e.end_date >= dateStart && effectiveImpact >= 0.8;
  });
  return { available: blocking.length === 0, blockingEvents: blocking };
}
