import React, { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';
import { useWorkspace } from '../../context/WorkspaceContext';
import { notificationEngine } from '../../core/engines/notificationEngine';
import { Bell, Check, AlertCircle, Briefcase, FileText, Activity, Shield, Users, Search, Volume2, VolumeX, Moon } from 'lucide-react';
import { notificationSoundService } from '../../services/notificationSoundService';
import { PageShell, PageHeader, PageContent, Button } from '../../components/core';

export default function NotificationInbox() {
  const { profile } = useAuth();
  const { workspace } = useWorkspace();
  const [notifications, setNotifications] = useState<any[]>([]);
  const [settings, setSettings] = useState<any>(null);
  
  // Filters
  const [filterPriority, setFilterPriority] = useState<string>('all');
  const [filterCategory, setFilterCategory] = useState<string>('all');
  const [search, setSearch] = useState('');

  useEffect(() => {
    if (workspace?.id && profile?.id) {
      loadData();
    }
  }, [workspace?.id, profile?.id]);

  const loadData = async () => {
    const [notifRes, prefsRes] = await Promise.all([
      supabase.from('notification_events').select('*').eq('workspace_id', workspace!.id).eq('recipient_id', profile!.id).order('created_at', { ascending: false }).limit(200),
      supabase.from('notification_preferences').select('settings').eq('workspace_id', workspace!.id).eq('user_id', profile!.id).maybeSingle()
    ]);
    
    if (notifRes.data) setNotifications(notifRes.data);
    if (prefsRes.data) setSettings(prefsRes.data.settings);
  };

  const toggleSound = async () => {
    const newSettings = { ...settings, sound_enabled: !settings?.sound_enabled };
    setSettings(newSettings);
    await notificationSoundService.updatePreferences(workspace!.id, profile!.id, newSettings);
  };
  
  const toggleFocus = async () => {
    const newSettings = { ...settings, focus_mode: !settings?.focus_mode };
    setSettings(newSettings);
    await notificationSoundService.updatePreferences(workspace!.id, profile!.id, newSettings);
  };

  const filtered = notifications.filter(n => {
    if (filterPriority !== 'all' && n.priority !== filterPriority) return false;
    if (filterCategory !== 'all' && n.category !== filterCategory) return false;
    if (search && !n.title.toLowerCase().includes(search.toLowerCase()) && !n.message.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  const getIcon = (category: string) => {
    switch (category) {
      case 'task': return <Briefcase className="w-5 h-5 text-blue-400" />;
      case 'approval': return <Check className="w-5 h-5 text-indigo-400" />;
      case 'risk': return <AlertCircle className="w-5 h-5 text-rose-400" />;
      case 'finance': return <Activity className="w-5 h-5 text-emerald-400" />;
      case 'hr': return <Users className="w-5 h-5 text-amber-400" />;
      default: return <Shield className="w-5 h-5 text-slate-400" />;
    }
  };

  return (
    <PageShell maxWidth="full" className="px-6 py-6 flex flex-col">
      <PageHeader
        title="Notification Inbox"
        overline="Workspace Notifications & Audit Log"
        description="Global communication audit log and preference center."
        actions={
          <div className="flex gap-4">
            <Button 
              onClick={toggleSound}
              variant={settings?.sound_enabled ? 'primary' : 'secondary'}
              size="sm"
            >
              {settings?.sound_enabled ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
              {settings?.sound_enabled ? 'Sound On' : 'Sound Off'}
            </Button>
            
            <Button 
              onClick={toggleFocus}
              variant={settings?.focus_mode ? 'primary' : 'secondary'}
              size="sm"
            >
              <Moon className="w-4 h-4" />
              {settings?.focus_mode ? 'Focus Mode Active' : 'Focus Mode Off'}
            </Button>
          </div>
        }
      />
      <PageContent>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        <div className="lg:col-span-1 space-y-6">
          {/* Filters Sidebar */}
          <div className="glass-panel p-6 rounded-xl bg-surface-2 border border-border">
            <h2 className="text-lg font-bold mb-4 text-text-primary">Filters</h2>
            
            <div className="space-y-4">
              <div>
                <label className="text-xs font-bold uppercase tracking-widest text-text-tertiary mb-2 block">Search</label>
                <div className="relative">
                  <Search className="w-4 h-4 absolute left-3 top-3 text-text-tertiary" />
                  <input 
                    type="text" 
                    placeholder="Search history..." 
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="w-full input-premium pl-10 p-2 text-sm"
                  />
                </div>
              </div>
              
              <div>
                <label className="text-xs font-bold uppercase tracking-widest text-text-tertiary mb-2 block">Priority</label>
                <select value={filterPriority} onChange={(e) => setFilterPriority(e.target.value)} className="w-full input-premium p-2 text-sm">
                  <option value="all">All Priorities</option>
                  <option value="normal">Normal</option>
                  <option value="high">High</option>
                  <option value="critical">Critical</option>
                </select>
              </div>

              <div>
                <label className="text-xs font-bold uppercase tracking-widest text-text-tertiary mb-2 block">Category</label>
                <select value={filterCategory} onChange={(e) => setFilterCategory(e.target.value)} className="w-full input-premium p-2 text-sm">
                  <option value="all">All Categories</option>
                  <option value="task">Tasks</option>
                  <option value="risk">Risks</option>
                  <option value="finance">Finance</option>
                  <option value="approval">Approvals</option>
                  <option value="hr">HR</option>
                  <option value="system">System</option>
                </select>
              </div>
            </div>
          </div>
        </div>

        <div className="lg:col-span-3">
          <div className="glass-panel rounded-xl bg-surface-2 border border-border overflow-hidden">
            <div className="divide-y divide-border/50">
              {filtered.length === 0 ? (
                <div className="p-12 text-center text-text-tertiary">No notifications match your filters.</div>
              ) : (
                filtered.map(n => (
                  <div key={n.id} className={`p-5 flex gap-4 hover:bg-surface-highest transition-colors ${n.read_at ? 'opacity-70' : ''}`}>
                    <div className="shrink-0 mt-1">{getIcon(n.category)}</div>
                    <div className="flex-1">
                      <div className="flex justify-between items-start mb-1">
                        <div className="flex items-center gap-2">
                          <h3 className="font-bold text-text-primary">{n.title}</h3>
                          {n.priority === 'critical' && <span className="text-[10px] uppercase font-bold px-2 py-0.5 rounded bg-rose-500/20 text-rose-400">Critical</span>}
                          {n.priority === 'high' && <span className="text-[10px] uppercase font-bold px-2 py-0.5 rounded bg-amber-500/20 text-amber-400">High</span>}
                        </div>
                        <span className="text-xs text-text-tertiary font-mono">{new Date(n.created_at).toLocaleString()}</span>
                      </div>
                      <p className="text-sm text-text-secondary">{n.message}</p>
                      
                      {n.action_url && (
                        <div className="mt-3">
                           <a href={n.action_url} className="text-xs font-bold text-accent-primary hover:underline">View Source Entity →</a>
                        </div>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    </PageContent>
  </PageShell>
);
}
