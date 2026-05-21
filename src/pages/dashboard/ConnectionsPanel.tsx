import React, { useEffect, useState, useCallback, useRef } from 'react';
import {
  fetchConnectedAccounts, fetchIntegrationHealth, updateIntegrationHealth,
  disconnectService, syncGoogleCalendar, syncGoogleDrive,
  enqueueSync, getHealthDisplay, getHealthTrend, getCooldownRemaining, formatCooldown,
  ConnectedAccount, IntegrationHealth, SyncResult, getQueueStats,
} from '../../services/integrationService';
import { useWorkspace } from '../../context/WorkspaceContext';
import { useAuth } from '../../context/AuthContext';

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

const WORKSPACE_SERVICES = [
  { key: 'google_calendar', label: 'Google Calendar', scope: 'Workspace' },
];
const PROJECT_SERVICES = [
  { key: 'github', label: 'GitHub', scope: 'Project' },
  { key: 'gitlab', label: 'GitLab', scope: 'Project' },
  { key: 'figma', label: 'Figma', scope: 'Project' },
  { key: 'google_drive', label: 'Google Drive', scope: 'Project' },
];

export default function ConnectionsPanel() {
  const { workspace } = useWorkspace();
  const { profile } = useAuth();
  const wsId = workspace?.id || '';
  const [health, setHealth] = useState<Record<string, IntegrationHealth>>({});
  const [accounts, setAccounts] = useState<Record<string, ConnectedAccount>>({});
  const [syncing, setSyncing] = useState<Record<string, boolean>>({});
  const [messages, setMessages] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [cooldowns, setCooldowns] = useState<Record<string, number>>({});
  const [showQueue, setShowQueue] = useState(false);
  const cooldownRef = useRef<Record<string, number>>({});
  const tickRef = useRef<ReturnType<typeof setInterval> | null>(null);

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

  // Cooldown ticker
  useEffect(() => {
    tickRef.current = setInterval(() => {
      const updated: Record<string, number> = {};
      for (const key of Object.keys(cooldownRef.current)) {
        const remaining = getCooldownRemaining(health[key]);
        if (remaining > 0) updated[key] = remaining;
      }
      cooldownRef.current = updated;
      setCooldowns({ ...updated });
    }, 1000);
    return () => { if (tickRef.current) clearInterval(tickRef.current); };
  }, [health]);

  const handleConnect = async (service: string) => {
    setMessages(prev => ({ ...prev, [`${service}_msg`]: 'Connect pending — OAuth setup required' }));
    await updateIntegrationHealth(wsId, service, 'disconnected', 'Connect pending');
    await loadData();
  };

  const handleDisconnect = async (service: string) => {
    const acct = accounts[service];
    if (acct) await disconnectService(acct.id, wsId, service);
    await loadData();
  };

  const handleSync = async (service: string) => {
    const msgKey = `${service}_msg`;
    const cd = getCooldownRemaining(health[service]);
    if (cd > 0) return;
    setSyncing(prev => ({ ...prev, [service]: true }));
    setMessages(prev => ({ ...prev, [msgKey]: 'Queued...' }));
    const acct = accounts[service];
    let syncFn: () => Promise<SyncResult>;
    switch (service) {
      case 'google_calendar':
        syncFn = () => syncGoogleCalendar(wsId, acct?.access_token);
        break;
      case 'google_drive':
        syncFn = () => syncGoogleDrive(wsId, acct?.access_token);
        break;
      default:
        syncFn = async () => ({ success: false, message: 'Sync unavailable for this service' });
    }
    const result = await enqueueSync(wsId, service, syncFn);
    setSyncing(prev => ({ ...prev, [service]: false }));
    setMessages(prev => ({ ...prev, [msgKey]: result.message }));
    await loadData();
  };

  if (loading) return (
    <div className="p-6">
      <div className="flex items-center gap-3 mb-6">
        <span className="text-[10px] font-mono uppercase tracking-widest text-white/40">CONTROL</span>
        <span className="text-white/20">/</span>
        <span className="text-xs font-mono text-white/80">Connections</span>
      </div>
      <div className="text-[11px] font-mono text-white/30">Loading connections...</div>
    </div>
  );

  const renderCard = (svc: { key: string; label: string; scope: string }) => {
    const h = health[svc.key];
    const display = getHealthDisplay(h?.status || 'disconnected');
    const trend = h ? getHealthTrend(h.retry_count) : null;
    const acct = accounts[svc.key];
    const isSyncing = syncing[svc.key];
    const cd = getCooldownRemaining(h);
    const cdText = formatCooldown(cd);
    const msg = messages[`${svc.key}_msg`];
    return (
      <div key={svc.key} className="border border-white/10 bg-white/[0.02] px-4 py-3">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-3">
            <span className="text-xs font-mono text-white/70">{svc.label}</span>
            <span className="text-[8px] font-mono uppercase text-white/20 bg-white/5 px-1.5 py-0.5">{svc.scope}</span>
            {isSyncing && <span className="text-[10px] font-mono text-cyan-400 animate-pulse">Syncing...</span>}
          </div>
          <div className="flex items-center gap-2">
            {trend && <span className={`text-[9px] font-mono ${trend.color}`}>{trend.label}</span>}
            <span className={`text-[10px] font-mono ${display.color}`}>{display.label}</span>
          </div>
        </div>
        <div className="flex items-center gap-4 text-[10px] font-mono text-white/30 mb-3">
          <span>Sync: {timeAgo(h?.last_sync)}</span>
          <span>Checked: {timeAgo(h?.integration_last_checked)}</span>
        </div>
        <div className="flex items-center gap-2">
          {!acct ? (
            <button onClick={() => handleConnect(svc.key)}
              className="px-3 py-1.5 bg-emerald-600/20 border border-emerald-500/30 text-emerald-400 text-[9px] font-mono uppercase tracking-wider hover:bg-emerald-600/30 transition-colors">
              Connect
            </button>
          ) : (
            <>
              <button onClick={() => handleSync(svc.key)}
                disabled={isSyncing || cd > 0}
                className="px-3 py-1.5 bg-cyan-600/20 border border-cyan-500/30 text-cyan-400 text-[9px] font-mono uppercase tracking-wider hover:bg-cyan-600/30 transition-colors disabled:opacity-30">
                {cd > 0 ? formatCooldown(cd) : 'Sync Now'}
              </button>
              <button onClick={() => handleDisconnect(svc.key)}
                className="px-3 py-1.5 bg-red-600/20 border border-red-500/30 text-red-400 text-[9px] font-mono uppercase tracking-wider hover:bg-red-600/30 transition-colors">
                Disconnect
              </button>
            </>
          )}
        </div>
        {msg && <div className="mt-2 text-[9px] font-mono text-white/40">{msg}</div>}
      </div>
    );
  };

  const stats = getQueueStats();

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <span className="text-[10px] font-mono uppercase tracking-widest text-white/40">CONTROL</span>
          <span className="text-white/20">/</span>
          <span className="text-xs font-mono text-white/80">Connections</span>
        </div>
        {/* Queue observability toggle */}
        <button onClick={() => setShowQueue(!showQueue)}
          className="text-[9px] font-mono text-white/30 hover:text-white/60 border border-white/10 px-2 py-1">
          Queue {stats.length > 0 ? `(${stats.pending + stats.active})` : ''}
        </button>
      </div>

      {/* Queue observability */}
      {showQueue && (
        <div className="border border-white/10 bg-white/[0.02] p-3 mb-4">
          <div className="text-[9px] font-mono text-white/30 uppercase tracking-wider mb-2">Sync Queue</div>
          <div className="flex gap-4 text-[10px] font-mono">
            <span className="text-white/50">Total: {stats.length}</span>
            <span className="text-cyan-400">Pending: {stats.pending}</span>
            <span className="text-amber-400">Active: {stats.active}</span>
            <span className="text-red-400">Failed: {stats.failed}</span>
          </div>
          {stats.items.length > 0 && (
            <div className="mt-2 space-y-1">
              {stats.items.map(item => (
                <div key={item.id} className="text-[8px] font-mono text-white/30 flex gap-2">
                  <span>{item.service}</span>
                  <span className={
                    item.state === 'queued' ? 'text-cyan-400' :
                    item.state === 'processing' ? 'text-amber-400' :
                    item.state === 'success' ? 'text-emerald-400' :
                    item.state === 'retrying' ? 'text-purple-400' : 'text-red-400'
                  }>{item.state}</span>
                  {item.attempt > 0 && <span className="text-white/20">attempt {item.attempt}</span>}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      <div className="text-[9px] font-mono text-white/30 mb-4 uppercase tracking-wider">Workspace Services</div>
      <div className="space-y-2 mb-6">
        {WORKSPACE_SERVICES.map(renderCard)}
      </div>
      <div className="text-[9px] font-mono text-white/30 mb-4 uppercase tracking-wider">Project Services</div>
      <div className="space-y-2">
        {PROJECT_SERVICES.map(renderCard)}
      </div>
    </div>
  );
}
