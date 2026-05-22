interface ActivityEntry {
  id: string;
  actor_id?: string;
  action: string;
  target_type?: string;
  target_id?: string;
  metadata?: Record<string, any>;
  created_at: string;
  actor_name?: string;
}

interface GroupedActivity {
  id: string;
  actor_id?: string;
  actor_name?: string;
  action: string;
  target_type?: string;
  count: number;
  created_at: string;
  entries: ActivityEntry[];
}

const GROUP_WINDOW_MS = 120_000;
const NORMALIZE_ACTION = (a: string) =>
  a.replace(/_\d+$/, '').replace(/-\d+$/, '').replace(/\.\d+$/, '');

export function groupActivityEntries(entries: ActivityEntry[]): GroupedActivity[] {
  if (entries.length === 0) return [];

  const sorted = [...entries].sort(
    (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  );

  const groups: GroupedActivity[] = [];
  let current: GroupedActivity | null = null;

  for (const entry of sorted) {
    const normalizedAction = NORMALIZE_ACTION(entry.action);

    if (
      current &&
      current.actor_id === entry.actor_id &&
      current.action === normalizedAction &&
      current.target_type === entry.target_type &&
      new Date(current.created_at).getTime() - new Date(entry.created_at).getTime() < GROUP_WINDOW_MS
    ) {
      current.entries.push(entry);
      current.count = current.entries.length;
      if (current.entries.length === 2) {
        current.id = `${entry.actor_id || 'anon'}-${normalizedAction}-${current.entries.length}`;
      }
    } else {
      current = {
        id: entry.id,
        actor_id: entry.actor_id,
        actor_name: entry.actor_name,
        action: normalizedAction,
        target_type: entry.target_type,
        count: 1,
        created_at: entry.created_at,
        entries: [entry],
      };
      groups.push(current);
    }
  }

  return groups;
}
