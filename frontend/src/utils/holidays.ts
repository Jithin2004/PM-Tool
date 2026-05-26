export interface DerivedHoliday {
  date: string;
  name: string;
  type: 'public' | 'regional' | 'festival' | 'company';
  source?: string;
  /** Provider-native id when available; otherwise derived as date:title-slug */
  externalId?: string;
}

export function getHolidaysForRegion(country: string, region: string, year: number): DerivedHoliday[] {
  const holidays: DerivedHoliday[] = [];

  const normCountry = country.trim().toLowerCase();
  const normRegion = region.trim().toLowerCase();

  // India standard public holidays
  if (normCountry === 'india' || normCountry === 'in') {
    holidays.push(
      { date: `${year}-01-26`, name: 'Republic Day', type: 'public' },
      { date: `${year}-08-15`, name: 'Independence Day', type: 'public' },
      { date: `${year}-10-02`, name: 'Gandhi Jayanti', type: 'public' },
      { date: `${year}-12-25`, name: 'Christmas Day', type: 'public' }
    );

    if (normRegion === 'kerala' || normRegion === 'kl') {
      holidays.push(
        { date: `${year}-11-01`, name: 'Kerala Piravi', type: 'regional' },
        // Simple fixed dates for Onam & Vishu
        { date: `${year}-04-14`, name: 'Vishu', type: 'festival' },
        { date: `${year}-08-28`, name: 'First Onam', type: 'festival' },
        { date: `${year}-08-29`, name: 'Thiruvonam', type: 'festival' }
      );
    } else if (normRegion === 'tamil nadu' || normRegion === 'tn') {
      holidays.push(
        { date: `${year}-01-14`, name: 'Pongal', type: 'festival' },
        { date: `${year}-04-14`, name: 'Tamil New Year', type: 'regional' }
      );
    }
  } else if (normCountry === 'united states' || normCountry === 'us' || normCountry === 'usa') {
    holidays.push(
      { date: `${year}-01-01`, name: 'New Year\'s Day', type: 'public' },
      { date: `${year}-07-04`, name: 'Independence Day', type: 'public' },
      { date: `${year}-11-26`, name: 'Thanksgiving', type: 'public' },
      { date: `${year}-12-25`, name: 'Christmas Day', type: 'public' }
    );
  }

  return holidays;
}
