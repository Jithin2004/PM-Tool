import type { HolidayProvider } from './holidaySourceService';
import type { DerivedHoliday } from '../utils/holidays';
import { normalizeHolidayTitle } from '../core/sync/holidayReconciliation';
import { COUNTRIES } from '../data/countries';

interface NagerHoliday {
  date: string;
  localName: string;
  name: string;
  countryCode: string;
  global: boolean;
  counties: string[] | null;
  launchYear: number | null;
  types: string[];
}

function countryNameToCode(name: string): string | null {
  const norm = name.trim().toLowerCase();
  const match = COUNTRIES.find(c => c.name.toLowerCase() === norm || c.code.toLowerCase() === norm);
  return match ? match.code : null;
}

export class NagerDateProvider implements HolidayProvider {
  name = 'nager-date';

  supportsCountry(country: string): boolean {
    return countryNameToCode(country) !== null;
  }

  async getHolidays(country: string, region: string, year: number): Promise<DerivedHoliday[]> {
    const code = countryNameToCode(country);
    if (!code) return [];

    const url = `https://date.nager.at/api/v3/PublicHolidays/${year}/${code}`;

    let res: Response;
    try {
      res = await fetch(url);
    } catch {
      return [];
    }

    if (!res.ok) return [];

    const data: NagerHoliday[] = await res.json();
    const regionCode = region ? `${code}-${region}` : null;

    const results: DerivedHoliday[] = [];

    for (const h of data) {
      const externalId = `${h.date}:${normalizeHolidayTitle(h.localName)}`;
      const base = { date: h.date, name: h.localName, source: 'nager-date' as const, externalId };
      if (h.global) {
        results.push({ ...base, type: 'public' });
      } else if (regionCode && h.counties?.includes(regionCode)) {
        results.push({ ...base, type: 'regional' });
      }
    }

    return results;
  }
}
