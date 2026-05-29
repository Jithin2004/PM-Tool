import React, { useState } from 'react';
import { Bell, Check, Archive, AlertTriangle, Info, ShieldAlert } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useOperationalData } from '../../context/OperationalDataContext';
import { supabase } from '../../lib/supabase';
import { activityLogService } from '../../services/activityLogService';
import { useWorkspace } from '../../context/WorkspaceContext';

export function NotificationCenter() {
  const [isOpen, setIsOpen] = useState(false);
  const { workspace } = useWorkspace() as any;
  const { dbNotifications = [] } = useOperationalData();

  // Filter out archived ones if we want, or assuming dbNotifications are only active ones.
  // Actually, dbNotifications fetches everything, let's just use it directly.
  const activeNotifications = dbNotifications.filter(n => !n.read_at); // For unread count
  const displayNotifications = dbNotifications.slice(0, 50); // limit to recent 50

  const unreadCount = activeNotifications.length;

  const markAllRead = async () => {
    const unreadIds = activeNotifications.map(n => n.id);
    if (unreadIds.length === 0) return;
    
    await supabase.from('notifications')
      .update({ read_at: new Date().toISOString() })
      .in('id', unreadIds);

    // Track in observability
    if (workspace?.id) {
      activityLogService.appendLog({
        workspace_id: workspace.id,
        actor_id: 'system',
        action: 'notifications_cleared',
        metadata: { count: unreadIds.length }
      }).catch(() => {});
    }
  };

  const markRead = async (id: string) => {
    await supabase.from('notifications')
      .update({ read_at: new Date().toISOString() })
      .eq('id', id);
  };

  const archive = async (id: string) => {
    // In this context, archive might mean delete, or setting archived_at. Let's delete.
    await supabase.from('notifications').delete().eq('id', id);
    
    if (workspace?.id) {
      activityLogService.appendLog({
        workspace_id: workspace.id,
        actor_id: 'system',
        action: 'notification_archived',
        metadata: { notification_id: id }
      }).catch(() => {});
    }
  };

  const toggleOpen = () => setIsOpen(!isOpen);

  return (
    <div className="relative">
      <button onClick={toggleOpen} className="relative p-2 rounded-lg hover:bg-surface-2 transition-colors border border-transparent hover:border-border">
        <Bell className="w-5 h-5 text-text-secondary" />
        {unreadCount > 0 && (
          <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-signal-critical rounded-full border border-surface shadow-[0_0_8px_rgba(239,68,68,0.5)] animate-pulse" />
        )}
      </button>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 10, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.95 }}
            className="absolute right-0 top-full mt-2 w-80 bg-surface border border-border rounded-xl shadow-2xl overflow-hidden z-50 flex flex-col max-h-[400px]"
          >
            <div className="flex items-center justify-between p-3 border-b border-border bg-surface-2">
              <h3 className="text-xs font-bold uppercase tracking-widest text-text-primary">Notifications</h3>
              <div className="flex gap-2">
                <button onClick={markAllRead} className="text-[10px] font-bold uppercase tracking-wider text-accent-primary hover:text-accent-primary/80 transition-colors">Mark all read</button>
              </div>
            </div>
            
            <div className="flex-1 overflow-y-auto scrollbar-thin">
              {displayNotifications.length === 0 ? (
                <div className="p-8 text-center text-[11px] font-mono uppercase text-text-quaternary">
                  All caught up!
                </div>
              ) : (
                <div className="divide-y divide-border-subtle">
                  {displayNotifications.map((n: any) => (
                    <div key={n.id} className={`p-3 transition-colors hover:bg-surface-2/50 ${!n.read_at ? 'bg-accent-primary/5' : ''}`}>
                      <div className="flex items-start gap-3">
                        <div className={`mt-0.5 shrink-0 ${n.type === 'error' || n.priority === 'high' ? 'text-signal-critical' : n.type === 'warning' || n.priority === 'medium' ? 'text-signal-warning' : 'text-signal-info'}`}>
                          {n.type === 'error' || n.priority === 'high' ? <ShieldAlert className="w-4 h-4" /> : n.type === 'warning' || n.priority === 'medium' ? <AlertTriangle className="w-4 h-4" /> : <Info className="w-4 h-4" />}
                        </div>
                        <div className="flex-1">
                          <h4 className={`text-xs font-bold ${!n.read_at ? 'text-text-primary' : 'text-text-secondary'}`}>{n.title}</h4>
                          <p className="text-[11px] text-text-tertiary mt-0.5 leading-snug">{n.body || n.message}</p>
                          <span className="text-[9px] text-text-quaternary mt-1 block">{new Date(n.created_at).toLocaleString()}</span>
                        </div>
                        <div className="shrink-0 flex flex-col gap-1">
                          <button onClick={() => archive(n.id)} className="p-1 hover:bg-surface-3 rounded text-text-quaternary hover:text-signal-critical transition-colors" title="Archive">
                            <Archive className="w-3 h-3" />
                          </button>
                          {!n.read_at && (
                            <button onClick={() => markRead(n.id)} className="p-1 hover:bg-surface-3 rounded text-text-quaternary hover:text-signal-safe transition-colors" title="Mark Read">
                              <Check className="w-3 h-3" />
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
