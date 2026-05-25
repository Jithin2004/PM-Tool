import React, { useEffect, useState, useCallback } from 'react';
import {
  fetchConnectedAccounts, fetchIntegrationHealth, updateIntegrationHealth,
  disconnectService,
  ConnectedAccount, IntegrationHealth,
} from '../../services/integrationService';
import { useWorkspace } from '../../context/WorkspaceContext';
import { useAuth } from '../../context/AuthContext';
import { useIntegrationRegistry } from '../../core/integrations/integrationRegistry';
import { describeChannelState } from '../../core/integrations/oauthStateMachine';
import type { ChannelState } from '../../core/integrations/operationalChannels';
import { OPERATIONAL_CHANNELS } from '../../core/integrations/operationalChannels';

function timeAgo(dateStr?: string): string {
  if (!dateStr) return '—';
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

export default function ConnectionsPanel() {
  const { workspace } = useWorkspace();
  const { profile } = useAuth();
  const wsId = workspace?.id || '';
  const [health, setHealth] = useState<Record<string, IntegrationHealth>>({});
  const [accounts, setAccounts] = useState<Record<string, ConnectedAccount>>({});
  const [loading, setLoading] = useState(true);

  const registry = useIntegrationRegistry();

  const loadData = useCallback(async () => {
    if (!wsId) return;
    const [h, a] = await Promise.all([fetchIntegrationHealth(wsId), fetchConnectedAccounts(wsId)]);
    const hmap: Record<string, IntegrationHealth> = {};
    for (const item of h) hmap[item.service] = item;
    const amap: Record<string, ConnectedAccount> = {};
    for (const item of a) amap[item.service] = item;
    setHealth(hmap);
    setAccounts(amap);
    setLoading(false);
  }, [wsId]);

  useEffect(() => { loadData(); }, [loadData]);

  const handleConnect = async (service: string) => {
    registry.initiateConnection(service);
    await updateIntegrationHealth(wsId, service, 'disconnected', 'OAuth authorization required');
    await loadData();
  };

  const handleDisconnect = async (service: string) => {
    const acct = accounts[service];
    if (acct) await disconnectService(acct.id, wsId, service);
    await loadData();
  };

  if (loading) return (
    <div className="p-6">
      <div className="flex items-center gap-3 mb-6">
        <span className="text-[10px] font-mono uppercase tracking-wide text-text-quaternary">CONTROL</span>
        <span className="text-text-quaternary">/</span>
        <span className="text-xs font-mono text-text-secondary">Operational Channels</span>
      </div>
      <div className="text-[11px] font-mono text-text-quaternary">Loading channel configuration...</div>
    </div>
  );

  function renderChannel(ch: { key: string; label: string; description: string; scope: string }) {
    const h = health[ch.key];
    const acct = accounts[ch.key];
    const hasAccount = !!acct;
    const hasIntegration = !!h;

    let state: ChannelState = 'awaiting_oauth';
    if (hasIntegration && h?.status === 'connected') state = 'connected';
    else if (hasIntegration && h?.status === 'failed') state = 'webhook_error';
    else if (h?.status === 'disconnected') state = 'awaiting_oauth';
    else if (!hasIntegration) state = 'unavailable';

    const display = describeChannelState(state);

    return (
      <div key={ch.key} className="border border-border bg-surface-3 px-4 py-3">
        <div className="flex items-center justify-between mb-1">
          <div className="flex items-center gap-3">
            <span className="text-xs font-mono text-text-secondary">{ch.label}</span>
            <span className="text-[8px] font-mono uppercase text-text-quaternary bg-white/5 px-1.5 py-0.5">{ch.scope}</span>
          </div>
          <span className={`text-[10px] font-mono ${display.color}`}>{display.label}</span>
        </div>
        <p className="text-[9px] font-mono text-text-quaternary mb-3">{ch.description}</p>
        <div className="flex items-center gap-4 text-[10px] font-mono text-text-quaternary mb-3">
          <span>Last signal: {timeAgo(h?.last_sync)}</span>
          <span>Checked: {timeAgo(h?.integration_last_checked)}</span>
        </div>
        <div className="flex items-center gap-2">
          {!hasAccount ? (
            <button onClick={() => handleConnect(ch.key)}
              className="px-3 py-1.5 bg-emerald-600/20 border border-emerald-500/30 text-emerald-400 text-[9px] font-mono uppercase tracking-wider hover:bg-emerald-600/30 transition-colors">
              Authorize
            </button>
          ) : (
            <button onClick={() => handleDisconnect(ch.key)}
              className="px-3 py-1.5 bg-signal-critical-bg border border-red-500/30 text-signal-critical text-[9px] font-mono uppercase tracking-wider hover:bg-signal-critical-bg transition-colors">
              Disconnect
            </button>
          )}
        </div>
        {!hasAccount && state === 'awaiting_oauth' && (
          <div className="mt-2 text-[9px] font-mono text-signal-warning/60">
            OAuth provider configuration pending
          </div>
        )}
      </div>
    );
  }

  const workspaceChannels = OPERATIONAL_CHANNELS.filter(c => c.scope === 'workspace');
  const projectChannels = OPERATIONAL_CHANNELS.filter(c => c.scope === 'project');

  return (
    <div className="p-6">
      <div className="mb-6">
        <div className="flex items-center gap-3 mb-2">
          <span className="text-[10px] font-mono uppercase tracking-wide text-text-quaternary">CONTROL</span>
          <span className="text-text-quaternary">/</span>
          <span className="text-xs font-mono text-text-secondary">Operational Channels</span>
        </div>
        <p className="text-[10px] font-mono text-text-quaternary">
          External coordination signal ingestion pipelines
        </p>
      </div>

      <div className="text-[9px] font-mono text-text-quaternary mb-4 uppercase tracking-wider">Coordination Sources</div>
      <div className="space-y-2 mb-8">
        {workspaceChannels.map(renderChannel)}
      </div>

      <div className="text-[9px] font-mono text-text-quaternary mb-4 uppercase tracking-wider">Project Signal Channels</div>
      <div className="space-y-2">
        {projectChannels.map(renderChannel)}
      </div>
    </div>
  );
}
