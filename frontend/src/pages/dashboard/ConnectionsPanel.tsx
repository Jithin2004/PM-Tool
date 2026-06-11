import React, { useEffect, useState, useCallback } from 'react';
import {
  fetchConnectedAccounts, fetchIntegrationHealth, updateIntegrationHealth,
  disconnectService,
  ConnectedAccount, IntegrationHealth,
} from '../../services/integrationService';
import { Network, Link2, Unplug, AlertTriangle, ShieldCheck, Activity } from 'lucide-react';
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
    try {
      const [h, a] = await Promise.all([fetchIntegrationHealth(wsId), fetchConnectedAccounts(wsId)]);
      const hmap: Record<string, IntegrationHealth> = {};
      for (const item of h) hmap[item.service] = item;
      const amap: Record<string, ConnectedAccount> = {};
      for (const item of a) amap[item.service] = item;
      setHealth(hmap);
      setAccounts(amap);
    } finally {
      setLoading(false);
    }
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
    <div className="p-8 animate-fade-in flex flex-col items-center justify-center h-[50vh]">
      <div className="w-10 h-10 border-2 border-accent-primary border-t-transparent rounded-full animate-spin mb-4" />
      <div className="text-xs font-bold uppercase tracking-widest text-text-tertiary">Connecting to Channel Registry...</div>
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
      <div key={ch.key} className="group relative pm-card glass-panel p-5 border-transparent hover:border-[var(--pm-primary)] transition-all duration-300 shadow-sm hover:shadow-accent-primary/5">
        <div className="absolute inset-0 bg-gradient-to-r from-white/[0.02] to-transparent rounded-2xl pointer-events-none" />
        
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex-1">
            <div className="flex items-center gap-3 mb-2">
              <div className={`p-1.5 rounded-lg ${hasAccount ? 'bg-signal-safe/10 text-signal-safe' : 'bg-surface-3 text-text-tertiary'}`}>
                {hasAccount ? <Link2 className="w-4 h-4" /> : <Unplug className="w-4 h-4" />}
              </div>
              <span className="text-sm font-bold text-text-secondary group-hover:text-text-primary transition-colors">{ch.label}</span>
              <span className="text-[9px] font-bold uppercase tracking-wider text-text-tertiary bg-surface-3 border border-border/50 px-2 py-0.5 rounded-md">{ch.scope}</span>
              <span className={`text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md border ${display.color.replace('text-', 'bg-').replace(' ', ' bg-opacity-10 border-').replace('text-', '')} text-${display.color.split(' ')[0].replace('text-', '')}`}>
                {display.label}
              </span>
            </div>
            <p className="text-[11px] text-text-tertiary mb-3 ml-11">{ch.description}</p>
            
            <div className="flex items-center gap-4 text-[10px] font-mono text-text-tertiary ml-11">
              <span className="flex items-center gap-1.5"><Activity className="w-3 h-3 text-text-quaternary" /> Last signal: {timeAgo(h?.last_sync)}</span>
              <span className="flex items-center gap-1.5"><ShieldCheck className="w-3 h-3 text-text-quaternary" /> Checked: {timeAgo(h?.integration_last_checked)}</span>
            </div>
          </div>
          
          <div className="flex flex-col items-end gap-2 shrink-0">
            {!hasAccount ? (
              <button onClick={() => handleConnect(ch.key)}
                className="px-6 py-2 bg-accent-primary/10 border border-accent-primary/30 text-accent-primary text-[10px] font-bold uppercase tracking-wider hover:bg-accent-primary hover:text-[var(--pm-text)] text-[var(--text-primary)] rounded-lg transition-all active:scale-95 shadow-sm">
                Authorize
              </button>
            ) : (
              <button onClick={() => handleDisconnect(ch.key)}
                className="px-6 py-2 bg-signal-critical/10 border border-signal-critical/30 text-signal-critical text-[10px] font-bold uppercase tracking-wider hover:bg-signal-critical hover:text-[var(--pm-text)] text-[var(--text-primary)] rounded-lg transition-all active:scale-95 shadow-sm">
                Disconnect
              </button>
            )}
            
            {!hasAccount && state === 'awaiting_oauth' && (
              <div className="text-[9px] font-bold uppercase tracking-wider text-signal-warning flex items-center gap-1">
                <AlertTriangle className="w-3 h-3" /> OAuth pending
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  const workspaceChannels = OPERATIONAL_CHANNELS.filter(c => c.scope === 'workspace');
  const projectChannels = OPERATIONAL_CHANNELS.filter(c => c.scope === 'project');

  return (
    <div className="space-y-8 pb-16 font-geist text-[var(--pm-primary)] max-w-7xl mx-auto px-4" style={{ color: 'var(--pm-on-surface)' }}>
      {/* Header */}
      <div className="flex items-end justify-between px-1 pt-2 pb-6 border-b border-border/50 mb-8">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight" style={{ color: 'var(--pm-on-surface)' }}>
            Integration Channels
          </h1>
          <p className="text-sm mt-1" style={{ color: 'var(--pm-on-surface-variant)' }}>
            External coordination signal ingestion pipelines and automated data synchronizations
          </p>
        </div>
        <div className="flex items-center gap-3 px-4 py-1.5 rounded-full border border-border bg-surface-2"
          style={{ background: 'var(--pm-surface-highest)', borderColor: 'rgba(70,69,84,0.3)' }}>
          <span className="w-1.5 h-1.5 rounded-full bg-indigo-400 operational-pulse" style={{ boxShadow: '0 0 8px rgba(129,140,248,0.5)' }} />
          <span className="font-mono-pm text-xs uppercase tracking-widest text-[var(--pm-on-surface-variant)]" style={{ color: 'var(--pm-on-surface-variant)' }}>
             DATA SYNC
          </span>
        </div>
      </div>

      <div className="space-y-12">
        <div>
          <h3 className="text-xs font-bold tracking-widest uppercase text-text-tertiary mb-4 flex items-center gap-2 border-b border-border/50 pb-2">
            <span className="w-1.5 h-1.5 rounded-full bg-indigo-400" />
            Workspace Coordination Sources
          </h3>
          <div className="space-y-4">
            {workspaceChannels.map(renderChannel)}
          </div>
        </div>

        <div>
          <h3 className="text-xs font-bold tracking-widest uppercase text-text-tertiary mb-4 flex items-center gap-2 border-b border-border/50 pb-2">
            <span className="w-1.5 h-1.5 rounded-full bg-purple-400" />
            Project Signal Channels
          </h3>
          <div className="space-y-4">
            {projectChannels.map(renderChannel)}
          </div>
        </div>
      </div>
    </div>
  );
}
