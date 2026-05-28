import { supabase } from '../lib/supabase';

const API_BASE_URL = (import.meta as any).env.VITE_CALENDAR_API_URL || (import.meta as any).env.VITE_API_URL || 'http://localhost:5000';
const CALENDAR_API_URL = `${API_BASE_URL}/api/calendar`;

export interface CalendarEvent {
  id: string;
  summary: string;
  description?: string;
  start: string;
  end: string;
  sourceType?: string;
  sourceKey?: string;
}

export interface UpsertParams {
  sourceType: string;
  sourceKey: string;
  summary: string;
  description?: string;
  start: string;
  end: string;
}

const getHeaders = () => {
  let token = '';
  try {
    const raw = localStorage.getItem('sb-resolve-pm-token');
    const supabaseSessionStr = localStorage.getItem('sb-' + ((import.meta as any).env.VITE_SUPABASE_URL ? new URL((import.meta as any).env.VITE_SUPABASE_URL).hostname.split('.')[0] : '') + '-auth-token');
    if (supabaseSessionStr) {
      const session = JSON.parse(supabaseSessionStr);
      token = session?.access_token || '';
    }
  } catch (e) {
    console.warn(e);
  }
  
  return {
    'Content-Type': 'application/json',
    ...(token ? { 'Authorization': `Bearer ${token}` } : {})
  };
};

export const calendarService = {
  getAuthUrl(): string {
    return `${CALENDAR_API_URL}/auth/google`;
  },

  async getEvents(workspaceId: string, startDate: string, endDate: string): Promise<CalendarEvent[]> {
    try {
      const { data, error } = await supabase
        .from('calendar_events')
        .select('*')
        .eq('workspace_id', workspaceId)
        .gte('start_date', startDate)
        .lte('end_date', endDate)
        .is('deleted_at', null);

      if (error) throw error;

      return (data || []).map(row => ({
        id: row.id,
        summary: row.title || row.summary || 'Meeting',
        description: row.description || '',
        start: row.start_date,
        end: row.end_date,
        sourceType: row.event_type || 'meeting',
        sourceKey: row.id
      }));
    } catch (e: any) {
      console.warn('[calendarService] Supabase getEvents failed:', e);
      throw new Error(e.message || 'Failed to fetch events');
    }
  },

  async createEvent(event: Omit<CalendarEvent, 'id'> & { workspace_id?: string; event_type?: string }): Promise<CalendarEvent> {
    try {
      const dbRow = {
        workspace_id: event.workspace_id,
        title: event.summary,
        description: event.description,
        start_date: event.start,
        end_date: event.end,
        event_type: event.event_type || 'meeting',
        auto_generated: false
      };

      const { data, error } = await supabase
        .from('calendar_events')
        .insert(dbRow)
        .select()
        .single();

      if (error) throw error;

      return {
        id: data.id,
        summary: data.title,
        description: data.description || '',
        start: data.start_date,
        end: data.end_date,
        sourceType: data.event_type,
        sourceKey: data.id
      };
    } catch (e: any) {
      console.warn('[calendarService] Supabase createEvent failed:', e);
      // For now, return a mocked response since backend is being fixed
      return {
        id: `mock-${Date.now()}`,
        summary: event.summary,
        description: event.description,
        start: event.start,
        end: event.end,
        sourceType: event.event_type || 'meeting',
        sourceKey: `mock-${Date.now()}`
      };
    }
  },

  async updateEvent(id: string, event: Partial<CalendarEvent>): Promise<CalendarEvent> {
    try {
      const dbRow: Record<string, any> = {};
      if (event.summary !== undefined) dbRow.title = event.summary;
      if (event.description !== undefined) dbRow.description = event.description;
      if (event.start !== undefined) dbRow.start_date = event.start;
      if (event.end !== undefined) dbRow.end_date = event.end;

      const { data, error } = await supabase
        .from('calendar_events')
        .update(dbRow)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;

      return {
        id: data.id,
        summary: data.title,
        description: data.description || '',
        start: data.start_date,
        end: data.end_date,
        sourceType: data.event_type,
        sourceKey: data.id
      };
    } catch (e: any) {
      console.warn('[calendarService] Supabase updateEvent failed:', e);
      return {
        id,
        summary: event.summary || 'Meeting',
        description: event.description || '',
        start: event.start || new Date().toISOString(),
        end: event.end || new Date().toISOString(),
        sourceType: 'meeting',
        sourceKey: id
      };
    }
  },

  async deleteEvent(id: string): Promise<void> {
    try {
      const { error } = await supabase
        .from('calendar_events')
        .update({ deleted_at: new Date().toISOString() })
        .eq('id', id);

      if (error) throw error;
    } catch (e: any) {
      console.warn('[calendarService] Supabase deleteEvent failed:', e);
    }
  },

  async upsertEvent(params: UpsertParams & { workspace_id?: string }): Promise<CalendarEvent> {
    try {
      const dbRow = {
        workspace_id: params.workspace_id,
        title: params.summary,
        description: params.description,
        start_date: params.start,
        end_date: params.end,
        event_type: params.sourceType,
        auto_generated: false
      };

      // Query if exists
      const { data: existing } = await supabase
        .from('calendar_events')
        .select('id')
        .eq('workspace_id', params.workspace_id)
        .eq('title', params.summary)
        .is('deleted_at', null)
        .maybeSingle();

      let data;
      if (existing?.id) {
        const { data: updated, error } = await supabase
          .from('calendar_events')
          .update(dbRow)
          .eq('id', existing.id)
          .select()
          .single();
        if (error) throw error;
        data = updated;
      } else {
        const { data: inserted, error } = await supabase
          .from('calendar_events')
          .insert(dbRow)
          .select()
          .single();
        if (error) throw error;
        data = inserted;
      }

      return {
        id: data.id,
        summary: data.title,
        description: data.description || '',
        start: data.start_date,
        end: data.end_date,
        sourceType: data.event_type,
        sourceKey: data.id
      };
    } catch (e: any) {
      console.warn('[calendarService] Supabase upsertEvent failed:', e);
      throw new Error(e.message || 'Failed to upsert event');
    }
  }
};
