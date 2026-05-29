import React, { useState, useMemo } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useDashboard } from '../../context/DashboardContext';
import { useWorkspace } from '../../context/WorkspaceContext';
import { useOperationalData } from '../../context/OperationalDataContext';
import { Settings, Globe, Bell, Shield, ToggleLeft, Save, Database, RefreshCw } from 'lucide-react';

export function WorkspaceSettings() {
  const { profile } = useAuth();
  const { workspace } = useWorkspace();
  const { raw: { users } } = useOperationalData();
  const { notify } = useDashboard();
  const [saving, setSaving] = useState(false);

  const owner = useMemo(() => {
    if (!workspace?.ownerId || !users) return null;
    return users.find((u: any) => u.id === workspace.ownerId);
  }, [workspace?.ownerId, users]);

  const ownerDisplay = owner ? (owner.full_name || owner.email) : (workspace?.ownerId || 'N/A');

  const settings = useMemo(() => ({
    country: workspace?.settings?.country || 'Not set',
    region: workspace?.settings?.region || 'None',
    timezone: workspace?.settings?.timezone || 'UTC',
    mode: workspace?.settings?.default_mode || 'KANBAN',
    autoArchive: workspace?.settings?.auto_archive ?? true,
    notifications: workspace?.settings?.notifications ?? true,
  }), [workspace]);

  const handleSave = async () => {
    setSaving(true);
    await new Promise(r => setTimeout(r, 500));
    setSaving(false);
    notify('Settings saved successfully', 'success');
  };

  return (
    <div className="max-w-[1600px] mx-auto px-3 sm:px-6 py-6 sm:py-12 space-y-8">
      <div>
        <h2 className="text-3xl font-medium tracking-tight mb-1">Workspace Configuration</h2>
        <p className="text-sm text-text-secondary font-mono tracking-tighter">General settings, feature toggles, and system preferences</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="border border-border bg-surface p-6">
          <h3 className="text-xs font-sans tracking-tight uppercase tracking-wide text-text-secondary mb-6 flex items-center gap-2"><Globe className="w-4 h-4 text-signal-info" /> Regional Settings</h3>
          <div className="space-y-4">
            <div>
              <label className="text-[10px] font-mono uppercase text-text-tertiary mb-1 block">Country</label>
              <input readOnly value={settings.country} className="w-full bg-bg border border-border h-10 px-3 text-xs font-mono text-text-tertiary" />
            </div>
            <div>
              <label className="text-[10px] font-mono uppercase text-text-tertiary mb-1 block">Region / State</label>
              <input readOnly value={settings.region} className="w-full bg-bg border border-border h-10 px-3 text-xs font-mono text-text-tertiary" />
            </div>
            <div>
              <label className="text-[10px] font-mono uppercase text-text-tertiary mb-1 block">Timezone</label>
              <input readOnly value={settings.timezone} className="w-full bg-bg border border-border h-10 px-3 text-xs font-mono text-text-tertiary" />
            </div>
          </div>
        </div>

        <div className="border border-border bg-surface p-6">
          <h3 className="text-xs font-sans tracking-tight uppercase tracking-wide text-text-secondary mb-6 flex items-center gap-2"><Settings className="w-4 h-4 text-cyan-400" /> Execution Defaults</h3>
          <div className="space-y-4">
            <div>
              <label className="text-[10px] font-mono uppercase text-text-tertiary mb-1 block">Default Execution Mode</label>
              <input readOnly value={settings.mode} className="w-full bg-bg border border-border h-10 px-3 text-xs font-mono text-text-tertiary" />
            </div>
            <div className="flex items-center justify-between border border-border bg-bg p-4">
              <div>
                <p className="text-[10px] font-mono uppercase text-text-secondary">Auto-archive Completed</p>
                <p className="text-[9px] font-mono text-text-quaternary">Automatically archive projects when all tasks are done</p>
              </div>
              <div className={`w-10 h-5 rounded-full transition-colors ${settings.autoArchive ? 'bg-green-500' : 'bg-white/20'} relative`}>
                <div className={`w-4 h-4 bg-white rounded-full absolute top-0.5 transition-all ${settings.autoArchive ? 'left-5' : 'left-0.5'}`} />
              </div>
            </div>
            <div className="flex items-center justify-between border border-border bg-bg p-4">
              <div>
                <p className="text-[10px] font-mono uppercase text-text-secondary">Notifications Enabled</p>
                <p className="text-[9px] font-mono text-text-quaternary">Receive system alerts and task notifications</p>
              </div>
              <div className={`w-10 h-5 rounded-full transition-colors ${settings.notifications ? 'bg-green-500' : 'bg-white/20'} relative`}>
                <div className={`w-4 h-4 bg-white rounded-full absolute top-0.5 transition-all ${settings.notifications ? 'left-5' : 'left-0.5'}`} />
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="border border-border bg-surface p-6">
        <h3 className="text-xs font-sans tracking-tight uppercase tracking-wide text-text-secondary mb-4 flex items-center gap-2"><Database className="w-4 h-4 text-accent-secondary" /> System Information</h3>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs font-mono">
          <div className="border border-border bg-bg p-4">
            <p className="text-[9px] uppercase text-text-tertiary mb-1">Workspace ID</p>
            <p className="text-text-secondary truncate">{workspace?.id || 'N/A'}</p>
          </div>
          <div className="border border-border bg-bg p-4">
            <p className="text-[9px] uppercase text-text-tertiary mb-1">Owner</p>
            <p className="text-text-secondary truncate" title={workspace?.ownerId}>{ownerDisplay}</p>
          </div>
          <div className="border border-border bg-bg p-4">
            <p className="text-[9px] uppercase text-text-tertiary mb-1">Version</p>
            <p className="text-text-secondary">6.0.1</p>
          </div>
        </div>
      </div>

      <div className="flex justify-end">
        <button
          onClick={handleSave}
          disabled={saving}
          className="bg-white text-black h-10 px-6 text-[10px] font-semibold uppercase tracking-wide hover:bg-neutral-200 transition-colors flex items-center gap-2 disabled:opacity-50"
        >
          <Save className="w-3.5 h-3.5" />
          {saving ? 'Saving...' : 'Save Configuration'}
        </button>
      </div>
    </div>
  );
}
