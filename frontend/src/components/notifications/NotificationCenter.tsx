import React, { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';
import { useWorkspace } from '../../context/WorkspaceContext';
import { notificationSoundService } from '../../services/notificationSoundService';
import { notificationEngine } from '../../core/engines/notificationEngine';
import { Bell, Check, X, AlertCircle, Briefcase, FileText, Activity, Shield, Users } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

export function NotificationCenter() {
  const [isOpen, setIsOpen] = useState(false);
  const { profile } = useAuth();
  const { workspace } = useWorkspace();
  const [notifications, setNotifications] = useState<any[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    if (workspace?.id && profile?.id) {
      loadNotifications();
      notificationSoundService.loadPreferences(workspace.id, profile.id);

      const channel = supabase.channel('notification_realtime')
        .on('postgres_changes', {
          event: 'INSERT',
          schema: 'public',
          table: 'notification_events',
          filter: `recipient_id=eq.${profile.id}`
        }, (payload) => {
          const newNotif = payload.new;
          setNotifications(prev => [newNotif, ...prev]);
          setUnreadCount(prev => prev + 1);
          
          notificationSoundService.playNotificationSound(newNotif.priority, newNotif.category);
        })
        .subscribe();

      return () => { supabase.removeChannel(channel); };
    }
  }, [workspace?.id, profile?.id]);

  const loadNotifications = async () => {
    const { data } = await supabase
      .from('notification_events')
      .select('*')
      .eq('workspace_id', workspace!.id)
      .eq('recipient_id', profile!.id)
      .order('created_at', { ascending: false })
      .limit(50);
      
    if (data) {
      setNotifications(data);
      setUnreadCount(data.filter(d => !d.read_at).length);
    }
  };

  const handleMarkRead = async (id: string) => {
    await notificationEngine.markRead(id, profile!.id);
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, read_at: new Date().toISOString() } : n));
    setUnreadCount(prev => Math.max(0, prev - 1));
  };

  const handleMarkAllRead = async () => {
    await notificationEngine.markAllRead(workspace!.id, profile!.id);
    setNotifications(prev => prev.map(n => ({ ...n, read_at: new Date().toISOString() })));
    setUnreadCount(0);
  };

  const getIcon = (category: string) => {
    switch (category) {
      case 'task': return <Briefcase className="w-4 h-4 text-blue-400" />;
      case 'approval': return <Check className="w-4 h-4 text-indigo-400" />;
      case 'risk': return <AlertCircle className="w-4 h-4 text-rose-400" />;
      case 'finance': return <Activity className="w-4 h-4 text-emerald-400" />;
      case 'hr': return <Users className="w-4 h-4 text-amber-400" />;
      default: return <Shield className="w-4 h-4 text-slate-400" />;
    }
  };

  return (
    <>
      <button 
        onClick={() => {
          notificationSoundService.initialize(); // Initialize on user interaction
          setIsOpen(true);
        }} 
        className="relative p-1.5 border border-[var(--border-soft)] bg-[var(--surface-glass)] hover:bg-[var(--surface-hover)] rounded-md text-[var(--text-secondary)] hover:text-white transition-all shadow-sm"
      >
        <Bell className="w-4 h-4" strokeWidth={2.2} />
        {unreadCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 bg-rose-500 rounded-full border border-[#050712] shadow-[0_0_8px_rgba(239,68,68,0.8)] animate-pulse" />
        )}
      </button>

      <AnimatePresence>
        {isOpen && (
          <>
            <motion.div 
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              onClick={() => setIsOpen(false)}
              className="fixed inset-0 bg-black/50 z-40 backdrop-blur-sm"
            />
            <motion.div
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 200 }}
              className="fixed inset-y-0 right-0 w-96 bg-[var(--surface-glass)] border-l border-[var(--border-soft)] shadow-2xl z-50 flex flex-col font-geist backdrop-blur-xl"
            >
              <div className="p-4 border-b border-[var(--border-soft)] flex justify-between items-center bg-[var(--surface-glass)]">
                <h2 className="text-lg font-bold text-white flex items-center gap-2">
                  <Bell className="w-5 h-5 text-accent-primary" /> Notifications
                  {unreadCount > 0 && <span className="bg-rose-500 text-white text-xs px-2 py-0.5 rounded-full">{unreadCount}</span>}
                </h2>
                <div className="flex items-center gap-3">
                  <button onClick={handleMarkAllRead} className="text-xs font-semibold text-[var(--text-tertiary)] hover:text-white transition-colors">Mark all read</button>
                  <button onClick={() => setIsOpen(false)} className="p-1 hover:bg-[var(--surface-hover)] rounded-md"><X className="w-5 h-5 text-[var(--text-secondary)]" /></button>
                </div>
              </div>

              <div className="flex-1 overflow-y-auto p-4 space-y-3 scrollbar-thin">
                {notifications.length === 0 ? (
                  <div className="text-center text-[var(--text-tertiary)] py-8 text-sm">No notifications yet.</div>
                ) : (
                  notifications.map(n => (
                    <div key={n.id} className={`p-4 rounded-xl border transition-colors ${n.read_at ? 'bg-[var(--surface-glass)] border-[var(--border-soft)] opacity-75' : 'bg-[var(--surface-hover)] border-accent-primary/30 shadow-md shadow-accent-primary/5'}`}>
                      <div className="flex gap-3">
                        <div className="shrink-0 mt-1">{getIcon(n.category)}</div>
                        <div className="flex-1 min-w-0">
                          <div className="flex justify-between items-start gap-2">
                            <p className="text-sm font-bold text-white truncate">{n.title}</p>
                            <span className="text-[10px] uppercase font-bold text-[var(--text-tertiary)] whitespace-nowrap">{new Date(n.created_at).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span>
                          </div>
                          <p className="text-sm text-[var(--text-secondary)] mt-1">{n.message}</p>
                          
                          <div className="mt-3 flex gap-2">
                            {n.action_url && (
                              <a href={n.action_url} className="text-xs font-bold text-accent-primary hover:underline bg-accent-primary/10 px-2 py-1 rounded">View Details</a>
                            )}
                            {!n.read_at && (
                              <button onClick={() => handleMarkRead(n.id)} className="text-xs font-bold text-[var(--text-tertiary)] hover:text-white px-2 py-1 border border-[var(--border-soft)] rounded">Mark Read</button>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
              <div className="p-3 border-t border-[var(--border-soft)] bg-[var(--surface-glass)] text-center">
                <a href="/workspace/notifications" className="text-xs font-bold text-[var(--text-secondary)] hover:text-white">View Full Inbox</a>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  );
}
