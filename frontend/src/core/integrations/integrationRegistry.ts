import { useState, useCallback } from 'react';
import type { OperationalChannel, ChannelState } from './operationalChannels';
import { OPERATIONAL_CHANNELS } from './operationalChannels';
import { transitionOAuthState, describeChannelState } from './oauthStateMachine';

interface UseIntegrationRegistryOptions {
  onStateChange?: (channel: string, from: ChannelState, to: ChannelState) => void;
}

export function useIntegrationRegistry(options: UseIntegrationRegistryOptions = {}) {
  const [channels, setChannels] = useState<OperationalChannel[]>(OPERATIONAL_CHANNELS);

  const transitionChannel = useCallback((channelKey: string, event: 'initiate' | 'callback' | 'token_refresh' | 'token_expire' | 'error' | 'retry') => {
    setChannels(prev => prev.map(ch => {
      if (ch.key !== channelKey) return ch;
      const from = ch.state;
      const to = transitionOAuthState(from, event);
      if (from !== to) {
        options.onStateChange?.(channelKey, from, to);
      }
      return { ...ch, state: to };
    }));
  }, [options.onStateChange]);

  const getChannelState = useCallback((channelKey: string): { label: string; color: string } => {
    const channel = channels.find(c => c.key === channelKey);
    if (!channel) return { label: 'unknown', color: 'text-gray-500' };
    return describeChannelState(channel.state);
  }, [channels]);

  const initiateConnection = useCallback((channelKey: string) => {
    transitionChannel(channelKey, 'initiate');
  }, [transitionChannel]);

  const completeOAuth = useCallback((channelKey: string) => {
    transitionChannel(channelKey, 'callback');
  }, [transitionChannel]);

  const markError = useCallback((channelKey: string) => {
    transitionChannel(channelKey, 'error');
  }, [transitionChannel]);

  return {
    channels,
    transitionChannel,
    getChannelState,
    initiateConnection,
    completeOAuth,
    markError,
  };
}
