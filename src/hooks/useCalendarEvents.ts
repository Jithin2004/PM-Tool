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
    userId?: string
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

    let totalDeduction = 0;
    for (const event of rangeEvents) {
      const es = new Date(event.start_date);
      const ee = new Date(event.end_date);
      const eventDays = Math.max(1, Math.ceil((ee.getTime() - es.getTime()) / 86400000));
      const dailyImpact = baseHoursPerDay * (1 - event.capacity_impact);
      totalDeduction += dailyImpact * eventDays;
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
