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
