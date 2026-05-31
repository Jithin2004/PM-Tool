import React, { useState, useMemo, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useDashboard } from '../../context/DashboardContext';
import { useWorkspace } from '../../context/WorkspaceContext';
import { useOperationalData } from '../../context/OperationalDataContext';
import { Settings, Globe, Bell, Shield, ToggleLeft, Save, Database, RefreshCw, ChevronDown } from 'lucide-react';
import { DemoWorkspaceManager } from '../workspace/DemoWorkspaceManager';
import { PilotReadinessPanel } from '../workspace/PilotReadinessPanel';

export function WorkspaceSettings() {
  const { profile } = useAuth();
  const { workspace, updateWorkspaceSettings } = useWorkspace();
  const { raw: { profiles } } = useOperationalData();
  const { notify } = useDashboard();
  const [saving, setSaving] = useState(false);

  const [formState, setFormState] = useState({
    country: '',
    region: '',
    timezone: 'UTC',
    mode: 'KANBAN',
    autoArchive: true,
    notifications: true,
  });

  useEffect(() => {
    if (workspace?.settings) {
      setFormState({
        country: workspace.settings.country || '',
        region: workspace.settings.region || '',
        timezone: workspace.settings.timezone || 'UTC',
        mode: workspace.settings.default_mode || 'KANBAN',
        autoArchive: workspace.settings.auto_archive ?? true,
        notifications: workspace.settings.notifications ?? true,
      });
    }
  }, [workspace?.settings]);

  const owner = useMemo(() => {
    if (!workspace?.ownerId || !profiles) return null;
    return profiles.find((u: any) => u.id === workspace.ownerId);
  }, [workspace?.ownerId, profiles]);

  const ownerDisplay = owner ? (owner.full_name || owner.email) : (workspace?.ownerId || 'N/A');

  const handleSave = async () => {
    setSaving(true);
    try {
      await updateWorkspaceSettings({
        country: formState.country,
        region: formState.region,
        timezone: formState.timezone,
        default_mode: formState.mode,
        auto_archive: formState.autoArchive,
        notifications: formState.notifications,
      });
      notify('Settings saved successfully', 'success');
    } catch (err: any) {
      notify(err.message || 'Failed to save settings', 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="max-w-[1200px] mx-auto px-4 sm:px-8 py-8 sm:py-12 space-y-8 animate-fade-in">
      <div className="relative">
        <div className="absolute -inset-1 bg-gradient-to-r from-accent-primary/20 via-accent-secondary/20 to-transparent blur-2xl opacity-50 -z-10" />
        <h2 className="text-4xl font-semibold tracking-tight text-text-primary mb-2">Workspace Configuration</h2>
        <p className="text-sm text-text-tertiary tracking-wide max-w-2xl">General settings, feature toggles, and system preferences</p>
      </div>

      <DemoWorkspaceManager />
      <PilotReadinessPanel />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mt-8">
        <div className="group relative bg-surface/40 backdrop-blur-md border border-border/50 hover:border-accent-primary/30 rounded-2xl p-6 sm:p-8 transition-all duration-300 shadow-sm hover:shadow-accent-primary/5">
          <div className="absolute inset-0 bg-gradient-to-b from-white/[0.02] to-transparent rounded-2xl pointer-events-none" />
          <h3 className="text-xs font-bold tracking-widest uppercase text-text-secondary mb-6 flex items-center gap-2.5">
            <div className="p-1.5 rounded-lg bg-signal-info/10 text-signal-info">
              <Globe className="w-4 h-4" />
            </div>
            Regional Settings
          </h3>
          <div className="space-y-5 relative z-10">
            <div className="group/input">
              <label className="text-[10px] font-bold uppercase tracking-widest text-text-tertiary mb-1.5 block group-hover/input:text-text-secondary transition-colors">Country</label>
              <input 
                value={formState.country} 
                onChange={e => setFormState(s => ({ ...s, country: e.target.value }))}
                placeholder="e.g. United States"
                className="w-full bg-surface/50 border border-border/50 focus:border-accent-primary/50 rounded-xl h-11 px-4 text-sm text-text-secondary transition-all outline-none shadow-inner placeholder:text-text-tertiary/50 focus:bg-surface" 
              />
            </div>
            <div className="group/input">
              <label className="text-[10px] font-bold uppercase tracking-widest text-text-tertiary mb-1.5 block group-hover/input:text-text-secondary transition-colors">Region / State</label>
              <input 
                value={formState.region} 
                onChange={e => setFormState(s => ({ ...s, region: e.target.value }))}
                placeholder="e.g. California"
                className="w-full bg-surface/50 border border-border/50 focus:border-accent-primary/50 rounded-xl h-11 px-4 text-sm text-text-secondary transition-all outline-none shadow-inner placeholder:text-text-tertiary/50 focus:bg-surface" 
              />
            </div>
            <div className="group/input">
              <label className="text-[10px] font-bold uppercase tracking-widest text-text-tertiary mb-1.5 block group-hover/input:text-text-secondary transition-colors">Timezone</label>
              <div className="relative">
                <select 
                  value={formState.timezone} 
                  onChange={e => setFormState(s => ({ ...s, timezone: e.target.value }))}
                  className="w-full bg-surface/50 border border-border/50 focus:border-accent-primary/50 rounded-xl h-11 px-4 text-sm text-text-secondary transition-all outline-none shadow-inner appearance-none focus:bg-surface"
                >
                  <option value="UTC">UTC (Universal Coordinated Time)</option>
                  <option value="America/New_York">Eastern Time (US & Canada)</option>
                  <option value="America/Chicago">Central Time (US & Canada)</option>
                  <option value="America/Denver">Mountain Time (US & Canada)</option>
                  <option value="America/Los_Angeles">Pacific Time (US & Canada)</option>
                  <option value="Europe/London">London</option>
                  <option value="Europe/Paris">Central European Time</option>
                  <option value="Asia/Dubai">Dubai</option>
                  <option value="Asia/Kolkata">India Standard Time</option>
                  <option value="Asia/Singapore">Singapore</option>
                  <option value="Asia/Tokyo">Tokyo</option>
                  <option value="Australia/Sydney">Sydney</option>
                </select>
                <ChevronDown className="w-4 h-4 absolute right-4 top-1/2 -translate-y-1/2 text-text-tertiary pointer-events-none" />
              </div>
            </div>
          </div>
        </div>

        <div className="group relative bg-surface/40 backdrop-blur-md border border-border/50 hover:border-cyan-400/30 rounded-2xl p-6 sm:p-8 transition-all duration-300 shadow-sm hover:shadow-cyan-400/5">
          <div className="absolute inset-0 bg-gradient-to-b from-white/[0.02] to-transparent rounded-2xl pointer-events-none" />
          <h3 className="text-xs font-bold tracking-widest uppercase text-text-secondary mb-6 flex items-center gap-2.5">
            <div className="p-1.5 rounded-lg bg-cyan-400/10 text-cyan-400">
              <Settings className="w-4 h-4" />
            </div>
            Execution Defaults
          </h3>
          <div className="space-y-5 relative z-10">
            <div className="group/input">
              <label className="text-[10px] font-bold uppercase tracking-widest text-text-tertiary mb-1.5 block group-hover/input:text-text-secondary transition-colors">Default Execution Mode</label>
              <div className="relative">
                <select 
                  value={formState.mode} 
                  onChange={e => setFormState(s => ({ ...s, mode: e.target.value }))}
                  className="w-full bg-surface/50 border border-border/50 focus:border-cyan-400/50 rounded-xl h-11 px-4 text-sm text-text-secondary transition-all outline-none shadow-inner appearance-none focus:bg-surface"
                >
                  <option value="KANBAN">Kanban</option>
                  <option value="SCRUM">Scrum / Sprint</option>
                  <option value="TIMELINE">Timeline / Gantt</option>
                </select>
                <ChevronDown className="w-4 h-4 absolute right-4 top-1/2 -translate-y-1/2 text-text-tertiary pointer-events-none" />
              </div>
            </div>
            <div 
              className="flex items-center justify-between bg-surface/50 border border-border/50 rounded-xl p-4 sm:p-5 hover:border-border transition-colors cursor-pointer"
              onClick={() => setFormState(s => ({ ...s, autoArchive: !s.autoArchive }))}
            >
              <div>
                <p className="text-[11px] font-bold uppercase tracking-wider text-text-secondary mb-1">Auto-archive Completed</p>
                <p className="text-[10px] text-text-tertiary">Automatically archive projects when all tasks are done</p>
              </div>
              <div className={`w-11 h-6 rounded-full transition-colors ${formState.autoArchive ? 'bg-signal-safe shadow-[0_0_10px_rgba(16,185,129,0.3)]' : 'bg-surface-3'} relative shrink-0`}>
                <div className={`w-4 h-4 bg-[var(--pm-primary)] rounded-full absolute top-1 transition-all ${formState.autoArchive ? 'left-6' : 'left-1'}`} />
              </div>
            </div>
            <div 
              className="flex items-center justify-between bg-surface/50 border border-border/50 rounded-xl p-4 sm:p-5 hover:border-border transition-colors cursor-pointer"
              onClick={() => setFormState(s => ({ ...s, notifications: !s.notifications }))}
            >
              <div>
                <p className="text-[11px] font-bold uppercase tracking-wider text-text-secondary mb-1">Notifications Enabled</p>
                <p className="text-[10px] text-text-tertiary">Receive system alerts and task notifications</p>
              </div>
              <div className={`w-11 h-6 rounded-full transition-colors ${formState.notifications ? 'bg-signal-safe shadow-[0_0_10px_rgba(16,185,129,0.3)]' : 'bg-surface-3'} relative shrink-0`}>
                <div className={`w-4 h-4 bg-[var(--pm-surface)] rounded-full absolute top-1 transition-all ${formState.notifications ? 'left-6' : 'left-1'}`} />
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="relative bg-surface/40 backdrop-blur-md border border-border/50 hover:border-accent-secondary/30 rounded-2xl p-6 sm:p-8 transition-all duration-300 shadow-sm">
        <div className="absolute inset-0 bg-gradient-to-b from-white/[0.02] to-transparent rounded-2xl pointer-events-none" />
        <h3 className="text-xs font-bold tracking-widest uppercase text-text-secondary mb-6 flex items-center gap-2.5 relative z-10">
          <div className="p-1.5 rounded-lg bg-accent-secondary/10 text-accent-secondary">
            <Database className="w-4 h-4" />
          </div>
          System Information
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5 relative z-10">
          <div className="bg-surface/50 border border-border/50 rounded-xl p-5 hover:border-border transition-colors">
            <p className="text-[10px] font-bold uppercase tracking-widest text-text-tertiary mb-2">Workspace ID</p>
            <p className="text-sm font-mono text-text-secondary truncate bg-bg/50 px-3 py-1.5 rounded-lg border border-border-subtle">{workspace?.id || 'N/A'}</p>
          </div>
          <div className="bg-surface/50 border border-border/50 rounded-xl p-5 hover:border-border transition-colors">
            <p className="text-[10px] font-bold uppercase tracking-widest text-text-tertiary mb-2">Owner</p>
            <p className="text-sm font-medium text-text-secondary truncate bg-bg/50 px-3 py-1.5 rounded-lg border border-border-subtle" title={workspace?.ownerId}>{ownerDisplay}</p>
          </div>
          <div className="bg-surface/50 border border-border/50 rounded-xl p-5 hover:border-border transition-colors">
            <p className="text-[10px] font-bold uppercase tracking-widest text-text-tertiary mb-2">Version</p>
            <div className="flex items-center gap-2">
              <span className="text-sm font-mono text-text-secondary bg-bg/50 px-3 py-1.5 rounded-lg border border-border-subtle">6.0.1</span>
              <span className="text-[9px] font-bold uppercase tracking-wider text-signal-safe bg-signal-safe/10 border border-signal-safe/20 px-2 py-1 rounded-md">Stable</span>
            </div>
          </div>
        </div>
      </div>

      <div className="flex justify-end pt-4">
        <button
          onClick={handleSave}
          disabled={saving}
          className="relative overflow-hidden group bg-accent-primary hover:bg-accent-primary/90 text-[var(--pm-text)] dark:text-white h-11 px-8 rounded-xl text-[11px] font-bold uppercase tracking-wider transition-all flex items-center gap-2.5 disabled:opacity-50 disabled:cursor-not-allowed shadow-[0_0_20px_rgba(var(--accent-primary-rgb),0.3)] hover:shadow-[0_0_30px_rgba(var(--accent-primary-rgb),0.5)] active:scale-[0.98]"
        >
          <div className="absolute inset-0 bg-gradient-to-r from-white/0 via-white/20 to-white/0 translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-700" />
          <Save className="w-4 h-4 relative z-10" />
          <span className="relative z-10">{saving ? 'Saving Configuration...' : 'Save Configuration'}</span>
        </button>
      </div>
    </div>
  );
}
