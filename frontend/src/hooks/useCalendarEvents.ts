import { useState, useEffect, useCallback } from 'react';
import { supabase, isSupabaseConfigured, createRealtimeChannel } from '../lib/supabase';
import type { CalendarEvent, CalendarEventType } from '../types';

export function useCalendarEvents(workspaceId?: string) {
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchEvents = useCallback(async () => {
    if (!workspaceId || !isSupabaseConfigured) { setEvents([]); setLoading(false); return; }
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('calendar_events')
        .select('*')
        .eq('workspace_id', workspaceId)
        .order('start_date', { ascending: true });
      if (!error && data) setEvents(data as CalendarEvent[]);
    } catch (e) {
      console.error('useCalendarEvents: fetch failed:', e);
    } finally {
      setLoading(false);
    }
  }, [workspaceId]);

  const getEventsInRange = useCallback((startDate: string, endDate: string, eventType?: CalendarEventType): CalendarEvent[] => {
    return events.filter(e => {
      if (eventType && e.event_type !== eventType) return false;
      return e.start_date <= endDate && e.end_date >= startDate;
    });
  }, [events]);

  const getEffectiveCapacity = useCallback((
    startDate: string,
    endDate: string,
    baseHoursPerDay: number,
    workingDays: number[],
    userId?: string,
    workStart?: string,
    workEnd?: string
  ): { totalCapacity: number; deductedHours: number; events: CalendarEvent[] } => {
    const filtered = userId
      ? events.filter(e => !e.participants || e.participants.length === 0 || e.participants.includes(userId))
      : events;

    const rangeEvents = filtered.filter(e => e.start_date <= endDate && e.end_date >= startDate);

    const start = new Date(startDate);
    const end = new Date(endDate);
    let totalDays = 0;
    const d = new Date(start);
    while (d <= end) {
      if (workingDays.includes(d.getDay())) totalDays++;
      d.setDate(d.getDate() + 1);
    }

    const workStartMin = workStart ? (() => { const [h, m] = workStart.split(':').map(Number); return h * 60 + m; })() : 0;
    const workEndMin = workEnd ? (() => { const [h, m] = workEnd.split(':').map(Number); return h * 60 + m; })() : 24 * 60;

    let totalDeduction = 0;
    for (const event of rangeEvents) {
      const es = new Date(event.start_date);
      const ee = new Date(event.end_date);

      if (event.event_type === 'holiday' || event.event_type === 'festival') {
        const holidayDays = Math.max(1, Math.ceil((ee.getTime() - es.getTime()) / 86400000));
        totalDeduction += baseHoursPerDay * holidayDays;
        continue;
      }

      const eventStartMidnight = new Date(es);
      eventStartMidnight.setHours(0, 0, 0, 0);
      const eventEndMidnight = new Date(ee);
      eventEndMidnight.setHours(0, 0, 0, 0);
      const eventDayCount = Math.max(1, Math.ceil((eventEndMidnight.getTime() - eventStartMidnight.getTime()) / 86400000));

      for (let dayOffset = 0; dayOffset < eventDayCount; dayOffset++) {
        const dayDate = new Date(eventStartMidnight);
        dayDate.setDate(dayDate.getDate() + dayOffset);
        if (!workingDays.includes(dayDate.getDay())) continue;

        const workDayStart = new Date(dayDate);
        workDayStart.setHours(Math.floor(workStartMin / 60), workStartMin % 60, 0, 0);
        const workDayEnd = new Date(dayDate);
        workDayEnd.setHours(Math.floor(workEndMin / 60), workEndMin % 60, 0, 0);

        const overlapStart = es > workDayStart ? es : workDayStart;
        const overlapEnd = ee < workDayEnd ? ee : workDayEnd;
        if (overlapStart >= overlapEnd) continue;

        const overlapHours = (overlapEnd.getTime() - overlapStart.getTime()) / 3600000;
        const impact = event.capacity_impact * (event.capacity_modifier ?? 1);
        totalDeduction += overlapHours * impact;
      }
    }

    return {
      totalCapacity: Math.max(0, totalDays * baseHoursPerDay - totalDeduction),
      deductedHours: totalDeduction,
      events: rangeEvents
    };
  }, [events]);

  useEffect(() => {
    fetchEvents();
    if (workspaceId && isSupabaseConfigured) {
      const channel = createRealtimeChannel(`calendar-events-${workspaceId}`)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'calendar_events', filter: `workspace_id=eq.${workspaceId}` }, (payload) => {
          if (payload.eventType === 'INSERT') setEvents(prev => [payload.new as CalendarEvent, ...prev]);
          else if (payload.eventType === 'UPDATE') setEvents(prev => prev.map(e => e.id === payload.new.id ? { ...e, ...payload.new } : e));
          else if (payload.eventType === 'DELETE') setEvents(prev => prev.filter(e => e.id !== payload.old.id));
        })
        .subscribe();
      return () => { supabase.removeChannel(channel); };
    }
  }, [fetchEvents, workspaceId]);

  return { events, loading, fetchEvents, getEventsInRange, getEffectiveCapacity };
}
