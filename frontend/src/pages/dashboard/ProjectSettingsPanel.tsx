import React, { useEffect, useState } from 'react';
import {
  fetchIntegrationConfigs, saveIntegrationConfig, updateIntegrationConfig,
  enqueueSync, fetchIntegrationHealth, getCooldownRemaining, formatCooldown,
  IntegrationConfig, IntegrationHealth,
} from '../../services/integrationService';
import { useWorkspace } from '../../context/WorkspaceContext';

interface Props {
  projectId: string;
  onClose: () => void;
}

const INTEGRATIONS = [
  { key: 'github', label: 'GitHub', fields: ['repo_url', 'branch'] },
  { key: 'gitlab', label: 'GitLab', fields: ['repo_url', 'branch'] },
  { key: 'figma', label: 'Figma', fields: ['frame_url'] },
  { key: 'google_drive', label: 'Google Drive', fields: [] },
];

export default function ProjectSettingsPanel({ projectId, onClose }: Props) {
  const { workspace } = useWorkspace();
  const wsId = workspace?.id || '';
  const [tab] = useState<'integrations'>('integrations');
  const [configs, setConfigs] = useState<IntegrationConfig[]>([]);
  const [editing, setEditing] = useState<Record<string, any>>({});
  const [messages, setMessages] = useState<Record<string, string>>({});
  const [syncing, setSyncing] = useState<Record<string, boolean>>({});
  const [figmaPreview, setFigmaPreview] = useState<string | null>(null);
  const [health, setHealth] = useState<Record<string, IntegrationHealth>>({});

  useEffect(() => {
    (async () => {
      const [cfg, h] = await Promise.all([
        fetchIntegrationConfigs(wsId, projectId),
        fetchIntegrationHealth(wsId),
      ]);
      setConfigs(cfg);
      const edit: Record<string, any> = {};
      for (const c of cfg) edit[c.service] = c.config;
      setEditing(edit);
      const hmap: Record<string, IntegrationHealth> = {};
      for (const item of h) hmap[item.service] = item;
      setHealth(hmap);
    })();
  }, [wsId, projectId]);

  const handleSaveConfig = async (service: string, config: Record<string, any>) => {
    const existing = configs.find(c => c.service === service && c.project_id === projectId);
    if (existing) {
      await updateIntegrationConfig(existing.id, { config });
    } else {
      await saveIntegrationConfig({
        workspace_id: wsId, project_id: projectId, service, config, enabled: true,
      });
    }
    setMessages(prev => ({ ...prev, [`${service}_cfg`]: 'Saved' }));
  };

  const handleSync = async (service: string) => {
    const cd = getCooldownRemaining(health[service]);
    if (cd > 0) return;
    const msgKey = `${service}_sync`;
    setSyncing(prev => ({ ...prev, [service]: true }));
    setMessages(prev => ({ ...prev, [msgKey]: 'Queued...' }));
    const cfg = editing[service] || {};
    const payload: Record<string, any> = {};
    if (cfg.repo_url) payload.repo_url = cfg.repo_url;
    if (cfg.branch) payload.branch = cfg.branch;
    if (cfg.frame_url) payload.frame_url = cfg.frame_url;
    const result = await enqueueSync(wsId, service, payload);
    if (service === 'figma' && result.itemsSynced && (result as any).frameId) {
      setFigmaPreview(`https://www.figma.com/embed?embed_host=resolve&url=${encodeURIComponent(cfg.frame_url || '')}`);
    }
    setSyncing(prev => ({ ...prev, [service]: false }));
    setMessages(prev => ({ ...prev, [msgKey]: result.message }));
    const h = await fetchIntegrationHealth(wsId);
    const hmap: Record<string, IntegrationHealth> = {};
    for (const item of h) hmap[item.service] = item;
    setHealth(hmap);
  };

  const handleFieldChange = (service: string, field: string, value: string) => {
    setEditing(prev => ({
      ...prev,
      [service]: { ...(prev[service] || {}), [field]: value },
    }));
  };

  return (
    <div className="fixed inset-0 z-[100] bg-bg flex items-center justify-center p-4" onClick={onClose}>
      <div className="w-full max-w-2xl bg-surface-3/50 backdrop-blur-xl border border-border/50 rounded-2xl p-8 max-h-[90vh] overflow-y-auto shadow-2xl" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-6">
          <span className="text-xs font-mono text-text-secondary">Project Settings</span>
          <button onClick={onClose} className="text-text-quaternary hover:text-text-secondary text-[10px] font-medium">Close</button>
        </div>
        <div className="flex gap-4 mb-6 border-b border-border pb-3">
          <span className={`text-[10px] font-mono uppercase tracking-wider text-text-primary border-b-2 border-[var(--border-soft)] pb-3`}>Integrations</span>
        </div>
        <div className="space-y-4">
          {INTEGRATIONS.map(svc => {
            const isSyncing = syncing[svc.key];
            const cfg = editing[svc.key] || {};
            const msg = messages[`${svc.key}_sync`];
            const cd = getCooldownRemaining(health[svc.key]);
            return (
              <div key={svc.key} className="border border-border/50 bg-surface/40 backdrop-blur-md rounded-xl p-5 shadow-sm hover:shadow-md transition-shadow">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-xs font-mono text-text-secondary">{svc.label}</span>
                  {isSyncing && <span className="text-[10px] font-mono text-cyan-400 transition-opacity duration-300">Syncing...</span>}
                </div>
                {svc.fields.map(field => (
                  <div key={field} className="mb-2">
                    <label className="block text-[8px] font-mono uppercase tracking-wider text-text-quaternary mb-1">
                      {field.replace(/_/g, ' ')}
                    </label>
                    <input type="text" value={cfg[field] || ''}
                      onChange={e => handleFieldChange(svc.key, field, e.target.value)}
                      placeholder={`Enter ${field.replace(/_/g, ' ')}`}
                      className="w-full bg-surface-3/50 border border-border/50 rounded-lg p-2.5 text-[11px] font-mono text-text-primary placeholder-white/20 focus:border-accent-primary/50 focus:outline-none transition-colors" />
                  </div>
                ))}
                <div className="flex items-center gap-2 mt-3">
                  <button onClick={() => handleSaveConfig(svc.key, cfg)}
                    className="px-4 py-2 bg-surface-3/50 border border-border/50 rounded-lg text-signal-info text-[9px] font-mono uppercase tracking-wider hover:bg-surface-3 hover:border-signal-info/30 transition-colors shadow-sm">
                    Save Config
                  </button>
                  <button onClick={() => handleSync(svc.key)}
                    disabled={isSyncing || cd > 0}
                    className="px-4 py-2 bg-cyan-500/10 border border-cyan-500/30 rounded-lg text-cyan-400 text-[9px] font-mono uppercase tracking-wider hover:bg-cyan-500/20 transition-colors disabled:opacity-30 shadow-sm">
                    {cd > 0 ? formatCooldown(cd) : 'Sync Now'}
                  </button>
                </div>
                {msg && <div className="mt-2 text-[9px] font-mono text-text-quaternary">{msg}</div>}
                {messages[`${svc.key}_cfg`] && (
                  <div className="mt-1 text-[9px] font-mono text-emerald-400">{messages[`${svc.key}_cfg`]}</div>
                )}
                {svc.key === 'figma' && figmaPreview && (
                  <div className="mt-3 border border-border bg-bg p-2">
                    <iframe src={figmaPreview} title="Figma Preview" className="w-full h-48 border-0" allowFullScreen />
                  </div>
                )}
                {(svc.key === 'github' || svc.key === 'gitlab') && cfg.repo_url && (
                  <div className="mt-4 border border-border/50 rounded-xl bg-surface-3/30 p-4 shadow-inner">
                    <div className="text-[9px] font-mono text-text-quaternary uppercase tracking-wider mb-1">Repository</div>
                    <div className="text-[10px] font-mono text-text-tertiary">
                      {cfg.repo_url}<br />
                      Branch: {cfg.branch || 'main'}
                    </div>
                    {msg && <div className="text-[9px] font-mono text-text-quaternary mt-1">{msg}</div>}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
