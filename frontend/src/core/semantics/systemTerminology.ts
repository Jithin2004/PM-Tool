export const FORBIDDEN_TERMS = [
  'productivity score',
  'worker activity',
  'employee monitoring',
  'sync spam',
  'plugin marketplace',
  'task monitoring',
  'app marketplace',
];

export const PREFERRED_TERMS: Record<string, string> = {
  'productivity': 'execution throughput',
  'monitoring': 'operational awareness',
  'tracking': 'coordination telemetry',
  'sync': 'signal ingestion',
  'queue': 'delivery pipeline',
  'plugin': 'operational channel',
  'integration': 'coordination source',
  'connected app': 'external signal channel',
  'service': 'coordination provider',
  'workspace service': 'workspace channel',
  'project service': 'project signal source',
  'connector': 'ingestion pipeline',
  'webhook': 'event subscription',
  'oauth': 'authorization handshake',
};

export function normalizeTerminology(text: string): string {
  let normalized = text;
  for (const [forbidden, preferred] of Object.entries(PREFERRED_TERMS)) {
    const regex = new RegExp(forbidden, 'gi');
    normalized = normalized.replace(regex, preferred);
  }
  return normalized;
}

export function containsForbiddenTerms(text: string): boolean {
  const lower = text.toLowerCase();
  return FORBIDDEN_TERMS.some(term => lower.includes(term));
}
