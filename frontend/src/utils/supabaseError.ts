export interface NormalizedError {
  message: string;
  code: string;
  details: string;
  hint: string;
}

export function normalizeSupabaseError(error: any): NormalizedError {
  if (!error) return { message: 'unknown error', code: 'UNKNOWN', details: '', hint: '' };
  return {
    message: typeof error === 'string' ? error : (error?.message ?? String(error)),
    code: error?.code ?? 'UNKNOWN',
    details: error?.details ?? '',
    hint: error?.hint ?? '',
  };
}

export function validateInsertPayload(table: string, payload: any, knownFields: string[]): void {
  if (typeof process !== 'undefined' && process.env?.NODE_ENV !== 'production') {
    const unknown = Object.keys(payload || {}).filter(k => !knownFields.includes(k));
    if (unknown.length > 0) {
      console.warn(`[validateInsertPayload] ${table}: unknown fields ${unknown.join(', ')} in`, payload);
    }
  }
}

const PROJECT_STATUS_VALUES = ['planning', 'active', 'review', 'done', 'archived'] as const;
export type ProjectStatus = (typeof PROJECT_STATUS_VALUES)[number];

export function validateProjectStatus(status: string): status is ProjectStatus {
  const valid = PROJECT_STATUS_VALUES.includes(status as ProjectStatus);
  if (!valid) {
    console.warn(`[validateProjectStatus] invalid status "${status}" — must be one of ${PROJECT_STATUS_VALUES.join(', ')}`);
  }
  return valid;
}

export { PROJECT_STATUS_VALUES };

export function logServiceFailure(service: string, payload: any, error: any): void {
  const norm = normalizeSupabaseError(error);
  console.log('[service insert failed]', {
    service,
    payload: payload && typeof payload === 'object' ? { ...payload } : payload,
    error: norm.message,
    code: norm.code,
    details: norm.details,
    hint: norm.hint,
  });
}
