import type { ChannelState } from './operationalChannels';

export interface OAuthSession {
  state: ChannelState;
  provider: string;
  initiatedAt: number | null;
  completedAt: number | null;
  error: string | null;
}

export function createOAuthSession(provider: string): OAuthSession {
  return {
    state: 'awaiting_oauth',
    provider,
    initiatedAt: null,
    completedAt: null,
    error: null,
  };
}

export function transitionOAuthState(
  current: ChannelState,
  event: 'initiate' | 'callback' | 'token_refresh' | 'token_expire' | 'error' | 'retry',
): ChannelState {
  switch (current) {
    case 'awaiting_oauth':
      if (event === 'initiate') return 'connecting';
      return current;
    case 'connecting':
      if (event === 'callback') return 'connected';
      if (event === 'error') return 'awaiting_oauth';
      return current;
    case 'connected':
      if (event === 'token_expire') return 'reconnecting';
      if (event === 'error') return 'degraded';
      return current;
    case 'degraded':
      if (event === 'retry') return 'connecting';
      if (event === 'token_expire') return 'awaiting_oauth';
      return current;
    case 'reconnecting':
      if (event === 'token_refresh') return 'connected';
      if (event === 'error') return 'awaiting_oauth';
      return current;
    default:
      return current;
  }
}

export function describeChannelState(state: ChannelState): { label: string; color: string } {
  switch (state) {
    case 'unavailable': return { label: 'unavailable', color: 'text-gray-500' };
    case 'configuring': return { label: 'configuring', color: 'text-amber-400' };
    case 'awaiting_oauth': return { label: 'awaiting authorization', color: 'text-amber-400' };
    case 'connecting': return { label: 'connecting', color: 'text-cyan-400' };
    case 'connected': return { label: 'connected', color: 'text-emerald-400' };
    case 'degraded': return { label: 'degraded', color: 'text-orange-400' };
    case 'reconnecting': return { label: 'reconnecting', color: 'text-cyan-400' };
    case 'ingestion_paused': return { label: 'ingestion paused', color: 'text-gray-400' };
    case 'webhook_error': return { label: 'delivery error', color: 'text-red-400' };
  }
}
