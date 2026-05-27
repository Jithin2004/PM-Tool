import { supabase } from '../lib/supabase';
import { calendarEventService } from './calendarEventService';
import { getHolidaysForRegion, DerivedHoliday } from '../utils/holidays';
import { sha256 } from '../utils/cryptoUtils';
import { NagerDateProvider } from './nagerDateProvider';
import { hasCapability } from '../core/auth/permissions';
import type { UserRole } from '../types';
import {
  HOLIDAY_PROVIDER_SOURCE_TABLE,
  buildHolidaySourceId,
  findExistingHolidayRecord,
  indexExistingHolidayEvents,
} from '../core/sync/holidayReconciliation';

export interface HolidayProvider {
  name: string;
  supportsCountry(country: string): boolean;
  getHolidays(country: string, region: string, year: number): Promise<DerivedHoliday[]>;
}

export interface SyncLogEntry {
  id?: string;
  workspace_id: string;
  provider: string;
  country: string;
  region?: string;
  year: number;
  holidays_found: number;
  holidays_imported: number;
  status: 'success' | 'partial' | 'failed';
  error_message?: string;
  previous_hash?: string;
  hash?: string;
  created_at?: string;
}

class LocalHolidayProvider implements HolidayProvider {
  name = 'local-builtin';

  supportsCountry(country: string): boolean {
    const n = country.trim().toLowerCase();
    return ['india', 'in', 'united states', 'us', 'usa'].some(c => n === c);
  }

  async getHolidays(country: string, region: string, year: number): Promise<DerivedHoliday[]> {
    return getHolidaysForRegion(country, region, year);
  }
}

class HolidaySourceService {
  private providers: HolidayProvider[] = [];

  constructor() {
    this.providers.push(new LocalHolidayProvider());
    this.registerProvider(new NagerDateProvider());
  }

  registerProvider(provider: HolidayProvider) {
    this.providers.push(provider);
  }

  private resolveProvider(country: string): HolidayProvider | null {
    for (const p of this.providers) {
      if (p.supportsCountry(country)) return p;
    }
    return null;
  }

  async fetchHolidays(country: string, region: string, year: number): Promise<DerivedHoliday[]> {
    const provider = this.resolveProvider(country);
    if (!provider) return [];
    return provider.getHolidays(country, region, year);
  }

  async syncForWorkspace(
    workspaceId: string,
    country: string,
    region: string,
    actorId?: string,
  ): Promise<{ imported: number; skipped: number; status: string }> {
    if (!country) return { imported: 0, skipped: 0, status: 'skipped' };

    // Only workspace owner or super_admin may sync
    if (actorId) {
      const { data: actor } = await supabase
        .from('users')
        .select('id, role, workspace_id')
        .eq('id', actorId)
        .maybeSingle();
      if (!actor || actor.workspace_id !== workspaceId) {
        console.log('[Calendar Sync] skipped: non-member');
        return { imported: 0, skipped: 0, status: 'skipped' };
      }
      if (!hasCapability(actor.role as UserRole, 'manage_settings')) {
        console.log('[Calendar Sync] skipped: non-owner');
        return { imported: 0, skipped: 0, status: 'skipped' };
      }
    }

    const currentYear = new Date().getFullYear();
    const provider = this.resolveProvider(country);
    if (!provider) return { imported: 0, skipped: 0, status: 'unsupported' };

    let allHolidays: DerivedHoliday[] = [];
    let lastError: string | null = null;

    try {
      const thisYear = await provider.getHolidays(country, region, currentYear);
      const nextYear = await provider.getHolidays(country, region, currentYear + 1);
      allHolidays = [...thisYear, ...nextYear];
    } catch (err: any) {
      lastError = err?.message || 'Provider fetch failed';
    }

    if (allHolidays.length === 0) {
      await this.appendLog(workspaceId, provider.name, country, region, currentYear, 0, 0, 'success');
      return { imported: 0, skipped: 0, status: 'success' };
    }

    let imported = 0;
    let skipped = 0;
    try {
      const startDate = `${currentYear}-01-01T00:00:00Z`;
      const endDate = `${currentYear + 2}-01-01T00:00:00Z`;
      const allEvents = await calendarEventService.getEventsInRange(workspaceId, startDate, endDate);
      const existingRows = allEvents.filter((e: any) => e.auto_generated && ['holiday', 'festival', 'regional'].includes(e.event_type));

      const index = indexExistingHolidayEvents(existingRows || []);
      const seenIncoming = new Set<string>();

      for (const h of allHolidays) {
        const sourceId = buildHolidaySourceId(provider.name, h);
        if (seenIncoming.has(sourceId)) {
          skipped++;
          continue;
        }
        seenIncoming.add(sourceId);

        const existing = findExistingHolidayRecord(index, provider.name, h);
        if (existing) {
          if (existing.legacy) {
            await calendarEventService.upsertBySourceKey({
              workspace_id: workspaceId,
              event_type: h.type === 'festival' ? 'festival' : h.type === 'regional' ? 'regional' : 'holiday',
              title: h.name,
              start_date: `${h.date}T00:00:00Z`,
              end_date: `${h.date}T23:59:59Z`,
              capacity_impact: 1,
              is_recurring: true,
              recurrence_rule: 'FREQ=YEARLY',
              auto_generated: true,
              source_table: HOLIDAY_PROVIDER_SOURCE_TABLE,
              source_id: sourceId,
              timezone: 'UTC',
            }, actorId);
            imported++;
            continue;
          } else if (existing.deleted_at) {
            await calendarEventService.upsertBySourceKey(
              {
                workspace_id: workspaceId,
                event_type: h.type === 'festival' ? 'festival' : h.type === 'regional' ? 'regional' : 'holiday',
                title: h.name,
                start_date: `${h.date}T00:00:00Z`,
                end_date: `${h.date}T23:59:59Z`,
                capacity_impact: 1,
                is_recurring: true,
                recurrence_rule: 'FREQ=YEARLY',
                auto_generated: true,
                source_table: HOLIDAY_PROVIDER_SOURCE_TABLE,
                source_id: sourceId,
                timezone: 'UTC',
              },
              actorId,
            );
          }
          skipped++;
          continue;
        }

        const { created } = await calendarEventService.upsertBySourceKey(
          {
            workspace_id: workspaceId,
            event_type: h.type === 'festival' ? 'festival' : h.type === 'regional' ? 'regional' : 'holiday',
            title: h.name,
            start_date: `${h.date}T00:00:00Z`,
            end_date: `${h.date}T23:59:59Z`,
            capacity_impact: 1,
            is_recurring: true,
            recurrence_rule: 'FREQ=YEARLY',
            auto_generated: true,
            source_table: HOLIDAY_PROVIDER_SOURCE_TABLE,
            source_id: sourceId,
            timezone: 'UTC',
          },
          actorId,
        );

        if (created) {
          imported++;
          index.bySourceId.set(sourceId, { id: 'pending', deleted_at: null });
        } else {
          skipped++;
        }
      }

      const status = lastError ? 'partial' : 'success';
      await this.appendLog(
        workspaceId,
        provider.name,
        country,
        region,
        currentYear,
        allHolidays.length,
        imported,
        status,
        lastError || (skipped > 0 ? `skipped_existing=${skipped}` : undefined),
      );
      return { imported, skipped, status };
    } catch (err: any) {
      const msg = err?.message || 'Write failed';
      await this.appendLog(workspaceId, provider.name, country, region, currentYear, allHolidays.length, imported, 'failed', msg);
      return { imported, skipped, status: 'failed' };
    }
  }

  private async appendLog(workspaceId: string, provider: string, country: string, region: string | undefined, year: number, found: number, imported: number, status: string, errorMessage?: string) {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      console.log('[appendLog telemetry]:', { workspaceId, provider, year, authUid: user?.id });

      const { data: logs } = await supabase
        .from('calendar_sync_logs')
        .select('*')
        .eq('workspace_id', workspaceId)
        .eq('year', year)
        .order('created_at', { ascending: false })
        .limit(1);

      const lastLog = logs && logs.length > 0 ? logs[0] : null;
      
      const previousHash = lastLog?.hash || '0000000000000000000000000000000000000000000000000000000000000000';
      const rawString = `${workspaceId}:${provider}:${year}:${found}:${imported}:${status}:${previousHash}`;
      const hash = await sha256(rawString);

      await supabase.from('calendar_sync_logs').insert({
        workspace_id: workspaceId,
        provider,
        country,
        region: region || null,
        year,
        holidays_found: found,
        holidays_imported: imported,
        status,
        error_message: errorMessage || null,
        previous_hash: previousHash,
        hash
      });
    } catch (err) {
      console.warn('Failed to append sync log:', err);
    }
  }

  async getSyncLogs(workspaceId: string, limit = 20): Promise<SyncLogEntry[]> {
    const { data } = await supabase
      .from('calendar_sync_logs')
      .select('*')
      .eq('workspace_id', workspaceId)
      .order('created_at', { ascending: false })
      .limit(limit);

    return (data || []) as SyncLogEntry[];
  }

  async getImportedHolidays(workspaceId: string, year?: number): Promise<any[]> {
    const y = year || new Date().getFullYear();
    const startDate = `${y}-01-01`;
    const endDate = `${y + 2}-01-01`;

    const events = await calendarEventService.getEventsInRange(workspaceId, startDate, endDate);
    return events
      .filter(e => (e.event_type === 'holiday' || e.event_type === 'festival' || e.event_type === 'company') && e.auto_generated)
      .map(e => ({
        ...e,
        date: e.start_date?.split('T')[0] || '',
        name: e.title || '',
        holidayType: e.event_type === 'festival' ? 'festival' : 'public',
        source: e.source_id || 'local-builtin'
      }));
  }

  async checkAndSyncNextYear(workspaceId: string, country: string, region: string, actorId?: string): Promise<boolean> {
    if (actorId) {
      const { data: actor } = await supabase
        .from('users')
        .select('id, role, workspace_id')
        .eq('id', actorId)
        .maybeSingle();
      if (!actor || actor.workspace_id !== workspaceId) {
        console.log('[Calendar Sync] skipped: non-member');
        return false;
      }
      if (!hasCapability(actor.role as UserRole, 'manage_settings')) {
        console.log('[Calendar Sync] skipped: non-owner');
        return false;
      }
    }

    const currentYear = new Date().getFullYear();
    const { data: existing } = await supabase
      .from('calendar_sync_logs')
      .select('id')
      .eq('workspace_id', workspaceId)
      .eq('year', currentYear + 1)
      .maybeSingle();

    if (!existing) {
      await this.syncForWorkspace(workspaceId, country, region, actorId);
      return true;
    }
    return false;
  }

  async getCalendarEvents(workspaceId: string, year: number): Promise<any[]> {
    const startDate = `${year}-01-01`;
    const endDate = `${year + 1}-01-01`;

    const events = await calendarEventService.getEventsInRange(workspaceId, startDate, endDate);
    return events.filter(e => e.event_type === 'holiday' || e.event_type === 'festival' || e.event_type === 'company');
  }

  async toggleHoliday(eventId: string, workspaceId: string, enabled: boolean): Promise<boolean> {
    try {
      if (enabled) {
        return await calendarEventService.updateEvent(eventId, { deleted_at: null });
      } else {
        return await calendarEventService.updateEvent(eventId, { deleted_at: new Date().toISOString() });
      }
    } catch (err) {
      console.warn('Failed to toggle holiday:', err);
      return false;
    }
  }

  async createOrganizationEvent(workspaceId: string, event: {
    title: string;
    start_date: string;
    end_date: string;
    event_type: 'company' | 'holiday';
    capacity_impact: number;
    description?: string;
  }, actorId?: string): Promise<boolean> {
    try {
      await calendarEventService.createEvent({
        workspace_id: workspaceId,
        event_type: event.event_type,
        title: event.title,
        start_date: event.start_date,
        end_date: event.end_date,
        capacity_impact: event.capacity_impact,
        is_recurring: false,
        auto_generated: false,
        source_table: 'organization',
        source_id: 'admin',
        description: event.description || null,
        timezone: 'UTC'
      }, actorId);
      return true;
    } catch (err) {
      console.warn('Failed to create organization event:', err);
      return false;
    }
  }
}

export const holidaySourceService = new HolidaySourceService();
