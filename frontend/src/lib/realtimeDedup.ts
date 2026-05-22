// ── Realtime Event Dedup Registry ──
// Prevents duplicate event processing from websocket replay,
// reconnect storms, and double optimistic inserts.
// Bounded, memory-safe, reconnect-safe.

const MAX_SIZE = 500;
const TTL_MS = 10_000;

const _registry = new Map<string, number>();

function fingerprint(payload: { table?: string; eventType?: string; new?: any; old?: any }): string {
  const tbl = payload.table || '';
  const evt = payload.eventType || '';
  const id = payload.new?.id || payload.old?.id || '';
  const ts = payload.new?.created_at || payload.old?.updated_at || Date.now();
  return `${tbl}:${evt}:${id}:${ts}`;
}

export function isDuplicate(payload: { table?: string; eventType?: string; new?: any; old?: any }): boolean {
  const fp = fingerprint(payload);
  const now = Date.now();

  // Evict expired entries
  if (_registry.size > MAX_SIZE * 0.8) {
    for (const [key, ts] of _registry) {
      if (now - ts > TTL_MS) _registry.delete(key);
    }
  }

  if (_registry.has(fp)) return true;

  _registry.set(fp, now);

  // Bounded size
  if (_registry.size > MAX_SIZE) {
    const first = _registry.keys().next().value;
    if (first) _registry.delete(first);
  }

  return false;
}

export function clearDedupRegistry(): void {
  _registry.clear();
}

export function dedupPayload<T extends { table?: string; eventType?: string; new?: any; old?: any }>(
  payload: T,
  fn: (p: T) => void
): void {
  if (!isDuplicate(payload)) fn(payload);
}
