import React, { useEffect, useState } from 'react';
import {
  fetchIntegrationConfigs, saveIntegrationConfig, updateIntegrationConfig,
  syncGitHubRepo, syncGitLabRepo, syncFigmaFrame, syncGoogleDrive,
  enqueueSync, fetchIntegrationHealth, getCooldownRemaining, formatCooldown,
  IntegrationConfig, SyncResult, IntegrationHealth,
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
    const fn = async (): Promise<SyncResult> => {
      switch (service) {
        case 'github': return syncGitHubRepo(wsId, cfg.repo_url || '', cfg.branch || 'main');
        case 'gitlab': return syncGitLabRepo(wsId, cfg.repo_url || '', cfg.branch || 'main');
        case 'figma': {
          const r = await syncFigmaFrame(wsId, cfg.frame_url || '');
          if (r.frameId) setFigmaPreview(`https://www.figma.com/embed?embed_host=resolve&url=${encodeURIComponent(cfg.frame_url || '')}`);
          return r;
        }
        default: return { success: false, message: 'Sync unavailable' };
      }
    };
    const result = await enqueueSync(wsId, service, fn);
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
    <div className="fixed inset-0 z-[100] bg-black/60 flex items-center justify-center p-4" onClick={onClose}>
      <div className="w-full max-w-2xl bg-[#0c0c0c] border border-white/15 p-6 max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-6">
          <span className="text-xs font-mono text-white/80">Project Settings</span>
          <button onClick={onClose} className="text-white/30 hover:text-white/70 text-[10px] font-mono">Close</button>
        </div>
        <div className="flex gap-4 mb-6 border-b border-white/10 pb-3">
          <span className={`text-[10px] font-mono uppercase tracking-wider text-white border-b-2 border-white/40 pb-3`}>Integrations</span>
        </div>
        <div className="space-y-4">
          {INTEGRATIONS.map(svc => {
            const isSyncing = syncing[svc.key];
            const cfg = editing[svc.key] || {};
            const msg = messages[`${svc.key}_sync`];
            const cd = getCooldownRemaining(health[svc.key]);
            return (
              <div key={svc.key} className="border border-white/10 bg-white/[0.02] p-4">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-xs font-mono text-white/70">{svc.label}</span>
                  {isSyncing && <span className="text-[10px] font-mono text-cyan-400 animate-pulse">Syncing...</span>}
                </div>
                {svc.fields.map(field => (
                  <div key={field} className="mb-2">
                    <label className="block text-[8px] font-mono uppercase tracking-wider text-white/30 mb-1">
                      {field.replace(/_/g, ' ')}
                    </label>
                    <input type="text" value={cfg[field] || ''}
                      onChange={e => handleFieldChange(svc.key, field, e.target.value)}
                      placeholder={`Enter ${field.replace(/_/g, ' ')}`}
                      className="w-full bg-black border border-white/10 p-2 text-[11px] font-mono text-white placeholder-white/20 focus:border-blue-500 focus:outline-none transition-colors" />
                  </div>
                ))}
                <div className="flex items-center gap-2 mt-3">
                  <button onClick={() => handleSaveConfig(svc.key, cfg)}
                    className="px-3 py-1.5 bg-blue-600/20 border border-blue-500/30 text-blue-400 text-[9px] font-mono uppercase tracking-wider hover:bg-blue-600/30 transition-colors">
                    Save Config
                  </button>
                  <button onClick={() => handleSync(svc.key)}
                    disabled={isSyncing || cd > 0}
                    className="px-3 py-1.5 bg-cyan-600/20 border border-cyan-500/30 text-cyan-400 text-[9px] font-mono uppercase tracking-wider hover:bg-cyan-600/30 transition-colors disabled:opacity-30">
                    {cd > 0 ? formatCooldown(cd) : 'Sync Now'}
                  </button>
                </div>
                {msg && <div className="mt-2 text-[9px] font-mono text-white/40">{msg}</div>}
                {messages[`${svc.key}_cfg`] && (
                  <div className="mt-1 text-[9px] font-mono text-emerald-400">{messages[`${svc.key}_cfg`]}</div>
                )}
                {svc.key === 'figma' && figmaPreview && (
                  <div className="mt-3 border border-white/10 bg-black/50 p-2">
                    <iframe src={figmaPreview} title="Figma Preview" className="w-full h-48 border-0" allowFullScreen />
                  </div>
                )}
                {(svc.key === 'github' || svc.key === 'gitlab') && cfg.repo_url && (
                  <div className="mt-3 border border-white/5 bg-white/[0.01] p-3">
                    <div className="text-[9px] font-mono text-white/30 uppercase tracking-wider mb-1">Repository</div>
                    <div className="text-[10px] font-mono text-white/50">
                      {cfg.repo_url}<br />
                      Branch: {cfg.branch || 'main'}
                    </div>
                    {msg && <div className="text-[9px] font-mono text-white/40 mt-1">{msg}</div>}
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
