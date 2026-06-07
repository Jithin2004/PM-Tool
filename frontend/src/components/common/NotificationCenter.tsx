import React, { useState } from 'react';
import { Bell, Check, Archive, AlertTriangle, Info, ShieldAlert, AtSign, CheckSquare, FileText, Activity, Zap } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useOperationalData } from '../../context/OperationalDataContext';
import { supabase } from '../../lib/supabase';
import { activityLogService } from '../../services/activityLogService';
import { useWorkspace } from '../../context/WorkspaceContext';
import { PremiumEmptyState } from './PremiumEmptyState';

export function NotificationCenter() {
  const [isOpen, setIsOpen] = useState(false);
  const { workspace } = useWorkspace() as any;
  const { dbNotifications = [] } = useOperationalData();

  const activeNotifications = dbNotifications.filter(n => !n.read_at);
  const unreadCount = activeNotifications.length;

  const getCategoryGroup = (n: any) => {
    const type = n.type || n.category;
    
    // Needs Action: important unread
    if (!n.read_at && ['approval', 'assignments', 'assigned_work', 'mention', 'risk', 'capacity'].includes(type)) {
      return 'Needs Action';
    }
    
    const createdDate = new Date(n.created_at);
    const today = new Date();
    const isToday = createdDate.getDate() === today.getDate() &&
      createdDate.getMonth() === today.getMonth() &&
      createdDate.getFullYear() === today.getFullYear();
      
    if (isToday) return 'Today';
    return 'Earlier';
  };

  const categorized = dbNotifications.slice(0, 50).reduce((acc: any, n: any) => {
    const group = getCategoryGroup(n);
    if (!acc[group]) acc[group] = [];
    acc[group].push(n);
    return acc;
  }, {});

  const markAllRead = async () => {
    const unreadIds = activeNotifications.map(n => n.id);
    if (unreadIds.length === 0) return;
    
    await supabase.from('notifications')
      .update({ read_at: new Date().toISOString() })
      .in('id', unreadIds);

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

  const markOpened = async (id: string) => {
    await supabase.from('notifications')
      .update({ opened_at: new Date().toISOString() })
      .eq('id', id);
  };

  const dismiss = async (id: string) => {
    await supabase.from('notifications')
      .update({ dismissed_at: new Date().toISOString() })
      .eq('id', id);
    if (workspace?.id) {
      activityLogService.appendLog({
        workspace_id: workspace.id,
        actor_id: 'system',
        action: 'notification_dismissed',
        metadata: { notification_id: id }
      }).catch(() => {});
    }
  };

  const toggleOpen = () => setIsOpen(!isOpen);

  const getIcon = (type: string) => {
    switch (type) {
      case 'mention': return <AtSign className="w-4 h-4" />;
      case 'approval': return <CheckSquare className="w-4 h-4" />;
      case 'comment': return <FileText className="w-4 h-4" />;
      case 'risk': return <AlertTriangle className="w-4 h-4" />;
      case 'automation': return <Zap className="w-4 h-4" />;
      case 'capacity': return <Activity className="w-4 h-4" />;
      case 'error': return <ShieldAlert className="w-4 h-4" />;
      default: return <Info className="w-4 h-4" />;
    }
  };

  const getTypeStyle = (type: string) => {
    switch (type) {
      case 'mention':
      case 'comment':
        return {
          color: 'text-indigo-400 border-indigo-500/20 bg-indigo-500/5',
          dot: 'bg-indigo-400 shadow-[0_0_8px_rgba(99,102,241,0.6)]'
        };
      case 'approval':
        return {
          color: 'text-amber-400 border-amber-500/20 bg-amber-500/5',
          dot: 'bg-amber-400 shadow-[0_0_8px_rgba(245,158,11,0.6)]'
        };
      case 'risk':
      case 'capacity':
      case 'error':
        return {
          color: 'text-rose-400 border-rose-500/20 bg-rose-500/5',
          dot: 'bg-rose-400 shadow-[0_0_8px_rgba(244,63,94,0.6)]'
        };
      default:
        return {
          color: 'text-emerald-400 border-emerald-500/20 bg-emerald-500/5',
          dot: 'bg-emerald-400 shadow-[0_0_8px_rgba(16,185,129,0.6)]'
        };
    }
  };

  const handleNavigate = (n: any) => {
    if (n.route_path) {
      window.location.hash = `#${n.route_path}`;
    } else if (n.source_entity_type && n.source_entity_id) {
      // Fallback navigation using source_entity fields
      window.location.hash = `#/${n.source_entity_type}/${n.source_entity_id}`;
    }
    if (!n.read_at) markRead(n.id);
    if (!n.opened_at) markOpened(n.id);
  };

  return (
    <div className="relative font-geist">
      <button 
        onClick={toggleOpen} 
        className="relative p-1.5 border border-[var(--border-soft)] bg-[var(--surface-glass)] hover:bg-[var(--surface-hover)] rounded-md text-[var(--text-secondary)] hover:text-white transition-all shadow-sm"
      >
        <Bell className="w-4 h-4" strokeWidth={2.2} />
        {unreadCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 bg-rose-500 rounded-full border border-[#050712] shadow-[0_0_8px_rgba(239,68,68,0.8)] animate-pulse" />
        )}
      </button>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 10, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.95 }}
            className="absolute right-0 top-full mt-2 w-96 premium-panel rounded-2xl overflow-hidden z-50 flex flex-col max-h-[500px]"
          >
            <div className="flex items-center justify-between p-4 border-b border-[var(--border-soft)] bg-[var(--surface-glass)]">
              <h3 className="text-xs font-bold uppercase tracking-widest text-[var(--text-secondary)] font-mono">Notifications</h3>
              {unreadCount > 0 && (
                <button 
                  onClick={markAllRead} 
                  className="text-[10px] font-bold uppercase tracking-wider text-purple-400 hover:text-purple-300 transition-colors"
                >
                  Mark all read
                </button>
              )}
            </div>
            
            <div className="flex-1 overflow-y-auto scrollbar-thin p-2">
              {Object.keys(categorized).length === 0 ? (
                <PremiumEmptyState
                  icon={Bell}
                  title="All caught up!"
                  description="Your team's updates and system alerts will appear here."
                  accentColor="#818cf8"
                />
              ) : (
                <div className="flex flex-col gap-2">
                  {['Needs Action', 'Today', 'Earlier'].map(group => {
                    const notes = categorized[group];
                    if (!notes || notes.length === 0) return null;
                    return (
                      <div key={group} className="mb-2">
                        <div className="px-2 py-1 text-[9px] font-bold uppercase tracking-widest text-[var(--text-secondary)] mb-1 font-mono">
                          {group}
                        </div>
                        <div className="flex flex-col gap-1.5">
                          {notes.map((n: any) => {
                            const style = getTypeStyle(n.type || n.category);
                            return (
                              <div 
                                key={n.id} 
                                onClick={() => handleNavigate(n)}
                                className={`p-3 rounded-xl border cursor-pointer transition-all duration-200 hover:bg-[var(--surface-hover)] ${
                                  !n.read_at 
                                    ? 'border-[var(--border-soft)] bg-[var(--surface-glass)] shadow-sm shadow-purple-500/5' 
                                    : 'border-transparent bg-transparent'
                                }`}
                              >
                                <div className="flex items-start gap-3">
                                  <div className={`p-2 rounded-lg border flex items-center justify-center shrink-0 ${style.color}`}>
                                    {getIcon(n.type || n.category)}
                                  </div>
                                  <div className="flex-1">
                                    <div className="flex items-start justify-between gap-1">
                                      <h4 className={`text-xs font-semibold ${!n.read_at ? 'text-white' : 'text-[var(--text-secondary)]'}`}>
                                        {n.title}
                                      </h4>
                                      {!n.read_at && (
                                        <span className={`w-1.5 h-1.5 rounded-full mt-1.5 shrink-0 ${style.dot}`} />
                                      )}
                                    </div>
                                    <p className="text-[11px] text-[var(--text-secondary)] mt-1 leading-relaxed">{n.message || n.body}</p>
                                    <span className="text-[9px] font-mono text-[var(--text-secondary)] mt-1.5 block">
                                      {new Date(n.created_at).toLocaleDateString()} at {new Date(n.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                    </span>
                                  </div>
                                  <div className="shrink-0 flex flex-col gap-1">
                                    <button 
                                      onClick={(e) => { e.stopPropagation(); dismiss(n.id); }} 
                                      className="p-1 hover:bg-[var(--surface-hover)] rounded text-[var(--text-secondary)] hover:text-rose-400 transition-colors" 
                                      title="Dismiss"
                                    >
                                      <Archive className="w-3.5 h-3.5" />
                                    </button>
                                    {!n.read_at && (
                                      <button 
                                        onClick={(e) => { e.stopPropagation(); markRead(n.id); }} 
                                        className="p-1 hover:bg-[var(--surface-hover)] rounded text-[var(--text-secondary)] hover:text-emerald-400 transition-colors" 
                                        title="Mark Read"
                                      >
                                        <Check className="w-3.5 h-3.5" />
                                      </button>
                                    )}
                                  </div>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
