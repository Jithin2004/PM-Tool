import type { Meeting } from '../types';

export function calculateEffectiveAvailability(
  baseAvailabilityFactor: number,
  meetingHours: number,
  workHoursPerDay: number
): number {
  if (workHoursPerDay <= 0) return 0;
  const meetingDeduction = Math.min(meetingHours, workHoursPerDay) / workHoursPerDay;
  const effective = baseAvailabilityFactor * (1 - meetingDeduction);
  return Math.max(0, Math.min(1, effective));
}

export function getUserMeetingHoursForDate(
  meetings: Meeting[],
  userId: string,
  date: string
): number {
  const dateStart = new Date(`${date}T00:00:00`).getTime();
  const dateEnd = new Date(`${date}T23:59:59`).getTime();
  return meetings
    .filter(m => {
      const mStart = new Date(m.start_time).getTime();
      return mStart >= dateStart && mStart <= dateEnd;
    })
    .reduce((total, m) => {
      const duration = (new Date(m.end_time).getTime() - new Date(m.start_time).getTime()) / (1000 * 60 * 60);
      return total + Math.max(0, duration);
    }, 0);
}

export function calculateTeamCapacity(
  teamMembers: Array<{ id: string; availability_factor: number }>,
  meetings: Meeting[],
  date: string,
  workHoursPerDay: number
): number {
  return teamMembers.reduce((total, member) => {
    const meetingHours = getUserMeetingHoursForDate(meetings, member.id, date);
    const effective = calculateEffectiveAvailability(member.availability_factor, meetingHours, workHoursPerDay);
    return total + effective * workHoursPerDay;
  }, 0);
}
