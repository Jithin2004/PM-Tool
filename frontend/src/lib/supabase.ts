import { createClient } from '@supabase/supabase-js';

const supabaseUrl = (import.meta as any).env.VITE_SUPABASE_URL || '';
const supabaseAnonKey = (import.meta as any).env.VITE_SUPABASE_ANON_KEY || '';

if (!supabaseUrl || !supabaseAnonKey || supabaseUrl.includes('your-project-id')) {
}

// Implement custom fetch with a timeout of 15 seconds to prevent indefinite buffering.
// IMPORTANT: We must NOT overwrite any AbortSignal the caller (Supabase client) passes
// in options.signal — doing so breaks auth token refresh and consumer abort controllers.
const fetchWithTimeout = (url: URL | RequestInfo, options?: RequestInit) => {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => {
    console.error(`Supabase request timed out: ${url}`);
    controller.abort();
  }, 15000);

  // Merge: if the caller already provided a signal, abort our controller when theirs fires
  const callerSignal = options?.signal;
  if (callerSignal) {
    if (callerSignal.aborted) {
      controller.abort();
    } else {
      callerSignal.addEventListener('abort', () => controller.abort(), { once: true });
    }
  }

  return fetch(url, {
    ...options,
    signal: controller.signal
  }).finally(() => clearTimeout(timeoutId));
};

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  global: {
    fetch: fetchWithTimeout
  }
});

export function createRealtimeChannel(name: string) {
  const existing = supabase.getChannels().find(c => c.topic === `realtime:${name}`);
  if (existing) {
    supabase.removeChannel(existing);
  }
  return supabase.channel(name);
}

export const isSupabaseConfigured = !!(supabaseUrl && supabaseAnonKey && !supabaseUrl.includes('your-project-id'));
