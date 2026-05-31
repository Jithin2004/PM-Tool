import type { CollaborationSignal } from '../../core/presence/types';

interface CollaborationHeatmapProps {
  signals: CollaborationSignal[];
}

type TimeBucket = 'morning' | 'midday' | 'afternoon' | 'evening';

const TIME_BUCKETS: TimeBucket[] = ['morning', 'midday', 'afternoon', 'evening'];

const BUCKET_RANGES: Record<TimeBucket, string> = {
  morning: '06:00–12:00',
  midday: '12:00–14:00',
  afternoon: '14:00–18:00',
  evening: '18:00–22:00',
};

function getTimeBucket(date: Date): TimeBucket {
  const h = date.getHours();
  if (h < 12) return 'morning';
  if (h < 14) return 'midday';
  if (h < 18) return 'afternoon';
  return 'evening';
}

interface ZoneActivity {
  label: string;
  editing: number;
  reviewing: number;
  planning: number;
  blocked: number;
  total: number;
}

function groupByOperationalZone(signals: CollaborationSignal[]): ZoneActivity[] {
  const zones = new Map<string, ZoneActivity>();

  for (const s of signals) {
    const ctx = s.context;
    let label = ctx.section.replace('_', ' ');

    if (ctx.epicId) {
      label = `epic ${ctx.epicId.slice(0, 8)}`;
    } else if (ctx.sprintId) {
      label = `sprint ${ctx.sprintId.slice(0, 8)}`;
    } else if (ctx.taskId) {
      label = `task ${ctx.taskId.slice(0, 8)}`;
    }

    const existing = zones.get(label) || {
      label,
      editing: 0,
      reviewing: 0,
      planning: 0,
      blocked: 0,
      total: 0,
    };

    existing.total++;
    if (s.type === 'editing') existing.editing++;
    else if (s.type === 'reviewing') existing.reviewing++;
    else if (s.type === 'planning') existing.planning++;
    else if (s.type === 'blocker') existing.blocked++;

    zones.set(label, existing);
  }

  return [...zones.values()].sort((a, b) => b.total - a.total);
}

function getZoneIntensity(total: number, maxTotal: number): string {
  if (maxTotal === 0) return 'bg-surface-2';
  const ratio = total / maxTotal;
  if (ratio > 0.66) return 'bg-indigo-100';
  if (ratio > 0.33) return 'bg-indigo-50';
  return 'bg-[var(--pm-surface)]';
}

export function CollaborationHeatmap({ signals }: CollaborationHeatmapProps) {
  const now = Date.now();
  const dayStart = new Date(now);
  dayStart.setHours(0, 0, 0, 0);

  const todaySignals = signals.filter(s => new Date(s.timestamp).getTime() > dayStart.getTime());

  if (todaySignals.length === 0) return null;

  const timeBuckets: Record<TimeBucket, CollaborationSignal[]> = {
    morning: [],
    midday: [],
    afternoon: [],
    evening: [],
  };

  for (const s of todaySignals) {
    const bucket = getTimeBucket(new Date(s.timestamp));
    timeBuckets[bucket].push(s);
  }

  const zonesByBucket = TIME_BUCKETS.reduce(
    (acc, bucket) => {
      acc[bucket] = groupByOperationalZone(timeBuckets[bucket]);
      return acc;
    },
    {} as Record<TimeBucket, ZoneActivity[]>,
  );

  const allZones = new Set<string>();
  for (const bucket of TIME_BUCKETS) {
    for (const zone of zonesByBucket[bucket]) {
      allZones.add(zone.label);
    }
  }

  const zoneList = [...allZones];
  if (zoneList.length === 0) return null;

  return (
    <div className="space-y-1.5">
      <div className="text-[10px] text-[var(--pm-text-secondary)] dark:text-[var(--pm-text-secondary)] uppercase tracking-wider font-semibold pb-1 border-b border-[var(--pm-border)]">
        collaboration activity
      </div>

      <div className="grid grid-cols-[auto_repeat(4,_1fr)] gap-px">
        <div className="text-[9px] text-[var(--pm-text-secondary)] dark:text-[var(--pm-text-secondary)] pr-2" />
        {TIME_BUCKETS.map(b => (
          <div key={b} className="text-[9px] text-[var(--pm-text-secondary)] dark:text-[var(--pm-text-secondary)] text-center" title={BUCKET_RANGES[b]}>
            {b.slice(0, 3)}
          </div>
        ))}

        {zoneList.map(zone => {
          const maxInZone = Math.max(
            ...TIME_BUCKETS.map(b => zonesByBucket[b].find(z => z.label === zone)?.total || 0),
          );

          return (
            <>
              <div key={`label-${zone}`} className="text-[10px] text-[var(--pm-text-secondary)] pr-2 truncate">{zone}</div>
              {TIME_BUCKETS.map(b => {
                const z = zonesByBucket[b].find(z => z.label === zone);
                const total = z?.total || 0;
                const hasBlocker = (z?.blocked || 0) > 0;

                return (
                  <div
                    key={`${zone}-${b}`}
                    className={`h-5 rounded-sm flex items-center justify-center ${getZoneIntensity(total, maxInZone || 1)} ${hasBlocker ? 'ring-1 ring-amber-200' : ''}`}
                    title={`${zone} — ${z ? `${z.total} signals (${z.editing}e/${z.reviewing}r/${z.planning}p${z.blocked ? `/${z.blocked}b` : ''})` : 'no activity'} in ${BUCKET_RANGES[b]}`}
                  >
                    {total > 0 && (
                      <span className="text-[9px] text-[var(--pm-text-secondary)] font-mono">{total}</span>
                    )}
                  </div>
                );
              })}
            </>
          );
        })}
      </div>
    </div>
  );
}
