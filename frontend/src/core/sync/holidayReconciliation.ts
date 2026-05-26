import type { DerivedHoliday } from '../../utils/holidays';

/** Stored in calendar_events.source_table for provider-imported holidays */
export const HOLIDAY_PROVIDER_SOURCE_TABLE = 'holiday_provider';

/**
 * Normalize holiday title for stable provider+date+title keys.
 */
export function normalizeHolidayTitle(title: string): string {
  return title
    .trim()
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/**
 * Provider-native or derived external id (date + title slug).
 */
export function buildHolidayExternalId(holiday: DerivedHoliday): string {
  if (holiday.externalId) {
    return holiday.externalId.trim();
  }
  return `${holiday.date}:${normalizeHolidayTitle(holiday.name)}`;
}

/**
 * Canonical reconciliation key stored in calendar_events.source_id.
 * Format: {provider}:{external_id}
 */
export function buildHolidaySourceId(provider: string, holiday: DerivedHoliday): string {
  return `${provider}:${buildHolidayExternalId(holiday)}`;
}

/**
 * Legacy fallback when older rows used provider name only as source_id.
 */
export function buildDateTitleKey(date: string, title: string): string {
  return `${date}:${normalizeHolidayTitle(title)}`;
}

export function parseEventDate(isoDate: string | undefined): string {
  if (!isoDate) return '';
  return isoDate.split('T')[0];
}

export interface HolidaySyncReconciliationIndex {
  bySourceId: Map<string, { id: string; deleted_at: string | null }>;
  byDateTitle: Map<string, { id: string; deleted_at: string | null; source_id?: string | null }>;
}

export function indexExistingHolidayEvents(
  rows: Array<{
    id: string;
    source_id?: string | null;
    source_table?: string | null;
    title?: string | null;
    start_date?: string | null;
    deleted_at?: string | null;
  }>,
): HolidaySyncReconciliationIndex {
  const bySourceId = new Map<string, { id: string; deleted_at: string | null }>();
  const byDateTitle = new Map<string, { id: string; deleted_at: string | null; source_id?: string | null }>();

  for (const row of rows) {
    const deleted_at = row.deleted_at ?? null;
    const entry = { id: row.id, deleted_at };

    // Canonical keys are `{provider}:{date}:{slug}` — bare provider names are legacy duplicates.
    if (
      row.source_table === HOLIDAY_PROVIDER_SOURCE_TABLE
      && row.source_id
      && row.source_id.includes(':')
    ) {
      bySourceId.set(row.source_id, entry);
    }

    const date = parseEventDate(row.start_date ?? undefined);
    const title = row.title ?? '';
    if (date && title) {
      const dateTitleKey = buildDateTitleKey(date, title);
      if (!byDateTitle.has(dateTitleKey)) {
        byDateTitle.set(dateTitleKey, { ...entry, source_id: row.source_id });
      }
    }
  }

  return { bySourceId, byDateTitle };
}

export function findExistingHolidayRecord(
  index: HolidaySyncReconciliationIndex,
  provider: string,
  holiday: DerivedHoliday,
): { id: string; deleted_at: string | null; legacy?: boolean } | null {
  const sourceId = buildHolidaySourceId(provider, holiday);
  const byKey = index.bySourceId.get(sourceId);
  if (byKey) return byKey;

  const dateTitleKey = buildDateTitleKey(holiday.date, holiday.name);
  const byDateTitle = index.byDateTitle.get(dateTitleKey);
  if (byDateTitle) return { ...byDateTitle, legacy: true };

  return null;
}
