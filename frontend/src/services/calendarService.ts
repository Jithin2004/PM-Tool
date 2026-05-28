const API_BASE_URL = (import.meta as any).env.VITE_API_URL || 'http://localhost:5000';
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
  // Try to find the token in localStorage if user is authenticated
  let token = '';
  try {
    const raw = localStorage.getItem('sb-resolve-pm-token'); // fallback check if stored manually or auth
    // Note: the backend uses 'auth' middleware which might expect a Bearer token
    // If supabase session has a token, we might need to get it from there.
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

  async getEvents(timeMin: string, timeMax: string): Promise<CalendarEvent[]> {
    const res = await fetch(`${CALENDAR_API_URL}/events?timeMin=${encodeURIComponent(timeMin)}&timeMax=${encodeURIComponent(timeMax)}`, {
      headers: getHeaders()
    });
    if (!res.ok) {
      throw new Error(`Failed to fetch events: ${res.statusText}`);
    }
    return res.json();
  },

  async createEvent(event: Omit<CalendarEvent, 'id'>): Promise<CalendarEvent> {
    const res = await fetch(`${CALENDAR_API_URL}/events`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify(event)
    });
    if (!res.ok) {
      throw new Error(`Failed to create event: ${res.statusText}`);
    }
    return res.json();
  },

  async updateEvent(id: string, event: Partial<CalendarEvent>): Promise<CalendarEvent> {
    const res = await fetch(`${CALENDAR_API_URL}/events/${id}`, {
      method: 'PUT',
      headers: getHeaders(),
      body: JSON.stringify(event)
    });
    if (!res.ok) {
      throw new Error(`Failed to update event: ${res.statusText}`);
    }
    return res.json();
  },

  async deleteEvent(id: string): Promise<void> {
    const res = await fetch(`${CALENDAR_API_URL}/events/${id}`, {
      method: 'DELETE',
      headers: getHeaders()
    });
    if (!res.ok) {
      throw new Error(`Failed to delete event: ${res.statusText}`);
    }
  },

  async upsertEvent(params: UpsertParams): Promise<CalendarEvent> {
    const res = await fetch(`${CALENDAR_API_URL}/events/upsert`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify(params)
    });
    if (!res.ok) {
      throw new Error(`Failed to upsert event: ${res.statusText}`);
    }
    return res.json();
  }
};
