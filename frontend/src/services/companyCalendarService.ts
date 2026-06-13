import { supabase } from '../lib/supabase';
import { getHolidaysForRegion } from '../utils/holidays';
import { NagerDateProvider } from './nagerDateProvider';

export interface CompanyCalendarEvent {
  id?: string;
  workspace_id: string;
  name: string;
  date: string;
  event_type: 'holiday' | 'festival' | 'regional' | 'company' | 'meeting' | 'event' | 'maintenance' | 'custom';
  source: 'sync' | 'manual_import' | 'manual';
  year: number;
  created_at?: string;
}

export interface WorkspaceCalendarSettings {
  workspace_id: string;
  working_days: number[]; // 0=Sun, 1=Mon...
  saturday_policy: 'all_working' | 'all_off' | '1st_3rd_off' | '2nd_4th_off';
  timezone: string;
}

const nagerProvider = new NagerDateProvider();

export const companyCalendarService = {
  async getSettings(workspaceId: string): Promise<WorkspaceCalendarSettings | null> {
    const { data, error } = await supabase
      .from('workspace_calendar_settings')
      .select('*')
      .eq('workspace_id', workspaceId)
      .maybeSingle();
      
    if (error || !data) return null;
    return data as WorkspaceCalendarSettings;
  },

  async updateSettings(workspaceId: string, updates: Partial<WorkspaceCalendarSettings>): Promise<boolean> {
    const { error } = await supabase
      .from('workspace_calendar_settings')
      .update(updates)
      .eq('workspace_id', workspaceId);
    return !error;
  },

  async getEvents(workspaceId: string, year: number): Promise<CompanyCalendarEvent[]> {
    const { data, error } = await supabase
      .from('company_calendar_events')
      .select('*')
      .eq('workspace_id', workspaceId)
      .eq('year', year)
      .order('date', { ascending: true });
      
    if (error || !data) return [];
    return data as CompanyCalendarEvent[];
  },

  async createEvent(event: CompanyCalendarEvent): Promise<CompanyCalendarEvent | null> {
    const { data, error } = await supabase
      .from('company_calendar_events')
      .insert([event])
      .select()
      .single();
      
    if (error) {
      console.error('Error creating event:', error);
      return null;
    }
    return data;
  },

  async deleteEvent(eventId: string): Promise<boolean> {
    const { error } = await supabase
      .from('company_calendar_events')
      .delete()
      .eq('id', eventId);
    return !error;
  },

  async syncHolidays(workspaceId: string, country: string, region: string): Promise<{ imported: number; status: string; totalFound: number }> {
    const currentYear = new Date().getFullYear();
    let holidays = [];
    
    try {
      if (['india', 'in', 'united states', 'us', 'usa'].includes(country.toLowerCase())) {
        const thisYear = await getHolidaysForRegion(country, region, currentYear);
        const nextYear = await getHolidaysForRegion(country, region, currentYear + 1);
        holidays = [...thisYear, ...nextYear];
      } else if (nagerProvider.supportsCountry(country)) {
        const thisYear = await nagerProvider.getHolidays(country, region, currentYear);
        const nextYear = await nagerProvider.getHolidays(country, region, currentYear + 1);
        holidays = [...thisYear, ...nextYear];
      } else {
        return { imported: 0, status: 'unsupported', totalFound: 0 };
      }
    } catch (e) {
      return { imported: 0, status: 'failed', totalFound: 0 };
    }

    if (holidays.length === 0) {
      return { imported: 0, status: 'success', totalFound: 0 };
    }

    let imported = 0;
    
    // Insert bypassing duplicates via upsert/ignore
    for (const h of holidays) {
      const year = parseInt(h.date.substring(0, 4), 10);
      const event_type = h.type === 'festival' ? 'festival' : h.type === 'regional' ? 'regional' : 'holiday';
      
      const { error } = await supabase.from('company_calendar_events').insert({
        workspace_id: workspaceId,
        name: h.name,
        date: h.date,
        event_type,
        source: 'sync',
        year
      });
      
      if (!error) imported++;
    }

    // Attempt to log sync (optional)
    try {
      await supabase.from('calendar_sync_logs').insert({
        workspace_id: workspaceId,
        provider: 'Nager/Local',
        country,
        region: region || null,
        year: currentYear,
        holidays_found: holidays.length,
        holidays_imported: imported,
        status: 'success'
      });
    } catch(e) {}

    return { imported, status: 'success', totalFound: holidays.length };
  },

  async bulkImportEvents(workspaceId: string, events: Array<{ name: string; date: string; type: string }>): Promise<number> {
    let imported = 0;
    for (const e of events) {
      const year = parseInt(e.date.substring(0, 4), 10);
      let event_type = e.type.toLowerCase();
      if (!['holiday', 'festival', 'regional', 'company', 'meeting', 'event', 'maintenance', 'custom'].includes(event_type)) {
        event_type = 'custom';
      }
      
      const { error } = await supabase.from('company_calendar_events').insert({
        workspace_id: workspaceId,
        name: e.name,
        date: e.date,
        event_type,
        source: 'manual_import',
        year
      });
      if (!error) imported++;
    }
    return imported;
  }
};
