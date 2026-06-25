import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { useWorkspace } from '../../context/WorkspaceContext';
import { Icon } from '../ui/Icon';
import { HardDrive, Server, FileDigit, Database } from 'lucide-react';

export function StorageSettingsPanel() {
  const { workspace } = useWorkspace();
  const [settings, setSettings] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [usageStats, setUsageStats] = useState({ documents: 0, files: 0, totalBytes: 0 });

  // Default limit 100GB
  const defaultLimitGb = 100;
  // Default max file size 100MB
  const defaultMaxMb = 100;

  useEffect(() => {
    fetchData();
  }, [workspace?.id]);

  const fetchData = async () => {
    if (!workspace?.id) return;
    setLoading(true);
    
    // Fetch Settings
    const { data: settingsData } = await supabase
      .from('workspace_storage_settings')
      .select('*')
      .eq('workspace_id', workspace.id)
      .maybeSingle();
      
    if (settingsData) {
      setSettings(settingsData);
    } else {
      setSettings({
        max_file_size_mb: defaultMaxMb,
        storage_limit_gb: defaultLimitGb,
        allowed_file_types: ['image/jpeg', 'image/png', 'application/pdf', 'text/plain', 'text/csv']
      });
    }

    // Fetch Usage
    let docSize = 0;
    let fileSize = 0;
    
    const { data: docData } = await supabase.from('documents').select('file_size_bytes').eq('workspace_id', workspace.id);
    if (docData) {
      docSize = docData.reduce((acc, curr) => acc + (Number(curr.file_size_bytes) || 0), 0);
    }
    
    const { data: fileData } = await supabase.from('workspace_files').select('file_size_bytes').eq('workspace_id', workspace.id);
    if (fileData) {
      fileSize = fileData.reduce((acc, curr) => acc + (Number(curr.file_size_bytes) || 0), 0);
    }
    
    setUsageStats({
      documents: docSize,
      files: fileSize,
      totalBytes: docSize + fileSize
    });

    setLoading(false);
  };

  const formatBytes = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const { data: existing } = await supabase.from('workspace_storage_settings').select('id').eq('workspace_id', workspace!.id).maybeSingle();
      
      if (existing) {
        await supabase.from('workspace_storage_settings').update({
          max_file_size_mb: settings.max_file_size_mb,
          storage_limit_gb: settings.storage_limit_gb,
          allowed_file_types: settings.allowed_file_types,
          updated_at: new Date().toISOString()
        }).eq('id', existing.id);
      } else {
        await supabase.from('workspace_storage_settings').insert({
          workspace_id: workspace!.id,
          max_file_size_mb: settings.max_file_size_mb,
          storage_limit_gb: settings.storage_limit_gb,
          allowed_file_types: settings.allowed_file_types
        });
      }
      window.dispatchEvent(new CustomEvent('notify-toast', { detail: { message: 'Storage settings saved successfully.', type: 'success' }}));
    } catch (err: any) {
      window.dispatchEvent(new CustomEvent('notify-toast', { detail: { message: `Failed to save storage settings: ${err.message}`, type: 'error' }}));
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <div className="p-8 text-center animate-pulse text-[var(--pm-text-tertiary)] text-sm">Loading storage details...</div>;
  }

  const limitBytes = (settings?.storage_limit_gb || defaultLimitGb) * 1024 * 1024 * 1024;
  const usagePct = limitBytes > 0 ? (usageStats.totalBytes / limitBytes) * 100 : 0;

  return (
    <div className="flex flex-col gap-6 font-geist max-w-4xl">
      {/* Usage Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-[var(--pm-surface)] border border-[var(--pm-border)] rounded-xl p-5 shadow-sm">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-8 h-8 rounded-lg bg-indigo-500/10 flex items-center justify-center text-indigo-500">
              <Database className="w-4 h-4" />
            </div>
            <h3 className="text-sm font-semibold text-[var(--pm-text)]">Total Usage</h3>
          </div>
          <div className="text-2xl font-bold text-[var(--pm-text)] mb-1">
            {formatBytes(usageStats.totalBytes)}
          </div>
          <p className="text-xs text-[var(--pm-text-secondary)]">
            of {formatBytes(limitBytes)} allowed
          </p>
          <div className="w-full bg-[var(--pm-surface-elevated)] rounded-full h-1.5 mt-3 overflow-hidden">
            <div className="bg-indigo-500 h-1.5 rounded-full" style={{ width: `${Math.min(usagePct, 100)}%` }} />
          </div>
        </div>

        <div className="bg-[var(--pm-surface)] border border-[var(--pm-border)] rounded-xl p-5 shadow-sm">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-8 h-8 rounded-lg bg-emerald-500/10 flex items-center justify-center text-emerald-500">
              <FileDigit className="w-4 h-4" />
            </div>
            <h3 className="text-sm font-semibold text-[var(--pm-text)]">Documents</h3>
          </div>
          <div className="text-2xl font-bold text-[var(--pm-text)] mb-1">
            {formatBytes(usageStats.documents)}
          </div>
          <p className="text-xs text-[var(--pm-text-secondary)]">Raw content & rich text</p>
        </div>

        <div className="bg-[var(--pm-surface)] border border-[var(--pm-border)] rounded-xl p-5 shadow-sm">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-8 h-8 rounded-lg bg-amber-500/10 flex items-center justify-center text-amber-500">
              <HardDrive className="w-4 h-4" />
            </div>
            <h3 className="text-sm font-semibold text-[var(--pm-text)]">Attachments</h3>
          </div>
          <div className="text-2xl font-bold text-[var(--pm-text)] mb-1">
            {formatBytes(usageStats.files)}
          </div>
          <p className="text-xs text-[var(--pm-text-secondary)]">Workspace physical files</p>
        </div>
      </div>

      {/* Settings Form */}
      <div className="bg-[var(--pm-surface)] border border-[var(--pm-border)] rounded-xl shadow-sm">
        <div className="p-5 border-b border-[var(--pm-border)] bg-[var(--pm-surface-high)] rounded-t-xl">
          <h3 className="font-semibold text-[var(--pm-text)] flex items-center gap-2">
            <Server className="w-4 h-4" />
            Storage Policies
          </h3>
          <p className="text-xs text-[var(--pm-text-secondary)] mt-1">Configure limits and allowed types for this workspace.</p>
        </div>
        
        <form onSubmit={handleSave} className="p-6 space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-xs font-semibold text-[var(--pm-text)] mb-2 uppercase tracking-wider font-mono">Workspace Quota (GB)</label>
              <input 
                type="number"
                required
                min="1"
                value={settings.storage_limit_gb}
                onChange={e => setSettings({ ...settings, storage_limit_gb: parseInt(e.target.value) || 0 })}
                className="w-full bg-[var(--pm-surface-lowest)] border border-[var(--pm-border)] rounded-lg h-10 px-3 text-sm text-[var(--pm-text)] outline-none focus:border-indigo-500 transition-colors"
              />
              <p className="text-[10px] text-[var(--pm-text-tertiary)] mt-1">Total physical storage allowed across all modules.</p>
            </div>
            
            <div>
              <label className="block text-xs font-semibold text-[var(--pm-text)] mb-2 uppercase tracking-wider font-mono">Max Upload Size (MB)</label>
              <input 
                type="number"
                required
                min="1"
                value={settings.max_file_size_mb}
                onChange={e => setSettings({ ...settings, max_file_size_mb: parseInt(e.target.value) || 0 })}
                className="w-full bg-[var(--pm-surface-lowest)] border border-[var(--pm-border)] rounded-lg h-10 px-3 text-sm text-[var(--pm-text)] outline-none focus:border-indigo-500 transition-colors"
              />
              <p className="text-[10px] text-[var(--pm-text-tertiary)] mt-1">Maximum size per individual file upload.</p>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-[var(--pm-text)] mb-2 uppercase tracking-wider font-mono">Allowed MIME Types</label>
            <textarea 
              value={settings.allowed_file_types?.join(', ') || ''}
              onChange={e => setSettings({ ...settings, allowed_file_types: e.target.value.split(',').map(s => s.trim()).filter(Boolean) })}
              className="w-full bg-[var(--pm-surface-lowest)] border border-[var(--pm-border)] rounded-lg px-3 py-2 text-sm text-[var(--pm-text)] font-mono outline-none focus:border-indigo-500 transition-colors min-h-[80px]"
              placeholder="image/jpeg, application/pdf..."
            />
            <p className="text-[10px] text-[var(--pm-text-tertiary)] mt-1">Comma-separated list of allowed MIME types. Leave empty to allow all types.</p>
          </div>

          <div className="flex justify-end pt-4 border-t border-[var(--pm-border)]">
            <button 
              type="submit" 
              disabled={saving}
              className="px-6 py-2 bg-indigo-500 hover:bg-indigo-600 text-white rounded-lg text-sm font-medium transition-colors disabled:opacity-50 flex items-center gap-2"
            >
              {saving ? 'Saving...' : 'Save Policies'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
