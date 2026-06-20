import React, { useEffect, useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useWorkspace } from '../../context/WorkspaceContext';
import { getDailyIntelligence, DailyIntelligence, ActionableItem, Recommendation } from '../../services/dailyCommandService';
import { ActivityStream } from '../dashboard/ActivityStream';
import { ArrowRight, CheckCircle2, Clock, ShieldAlert, Terminal, Play, Flame, Bell, Target, TrendingUp, Activity } from 'lucide-react';
import { RoleAwareQuickAccess } from './RoleAwareQuickAccess';
import { useNavigate } from 'react-router-dom';

export function DailyCommandCenter() {
  const { profile, user } = useAuth();
  const { workspace } = useWorkspace();
  const [intel, setIntel] = useState<DailyIntelligence | null>(null);
  const [loading, setLoading] = useState(true);
  const [recentNotifications, setRecentNotifications] = useState<any[]>([]);
  
  const [activeTab, setActiveTab] = useState<'overview' | 'activity'>(() => {
    return window.location.pathname === '/overview/activity' ? 'activity' : 'overview';
  });

  useEffect(() => {
    const handlePopState = () => {
      setActiveTab(window.location.pathname === '/overview/activity' ? 'activity' : 'overview');
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  useEffect(() => {
    async function load() {
      if (!user || !workspace || !profile?.role) return;
      try {
        const [intelData, notifData] = await Promise.all([
          getDailyIntelligence(user.id, workspace.id, profile),
          import('../../lib/supabase').then(s => s.supabase.from('notification_events')
            .select('*')
            .eq('workspace_id', workspace.id)
            .eq('recipient_id', profile.id)
            .is('read_at', null)
            .order('created_at', { ascending: false })
            .limit(5))
        ]);
        setIntel(intelData);
        if (notifData.data) setRecentNotifications(notifData.data);
      } catch (err) {
        console.error('[DailyCommandCenter] load failed', err);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [user, workspace, profile]);

  if (loading || !intel) {
    return (
      <div className="flex items-center justify-center h-full min-h-[60vh]">
        <div className="w-8 h-8 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const navigateTo = (path: string) => {
    if (path === 'modal:create-project') {
      if ((window as any).openCreateProjectModal) (window as any).openCreateProjectModal();
      return;
    }
    if (path === 'modal:invite-members') {
      if ((window as any).openTeamRosterModal) (window as any).openTeamRosterModal();
      return;
    }
    window.history.pushState(null, '', path);
    window.dispatchEvent(new Event('popstate'));
  };

  const renderRecommendationIcon = (type: string) => {
    switch (type) {
      case 'action': return <Target className="w-5 h-5 text-indigo-400" />;
      case 'urgent': return <ShieldAlert className="w-5 h-5 text-red-400" />;
      case 'focus': return <Flame className="w-5 h-5 text-amber-400" />;
      default: return <Bell className="w-5 h-5 text-indigo-300" />;
    }
  };

  return (
    <div className="space-y-6 pb-16 font-geist max-w-6xl mx-auto px-4 sm:px-6 mt-6 animate-fade-in h-full overflow-y-auto scrollbar-premium">
      {/* Header */}
      <div className="flex items-end justify-between border-b border-border-subtle pb-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-text-primary flex items-center gap-2">
            <Terminal className="w-5 h-5 text-indigo-500" />
            {intel.greeting.message}
          </h1>
          <p className="text-sm mt-1 text-text-secondary">
            {intel.greeting.subMessage}
          </p>
        </div>
      </div>

      {activeTab === 'overview' ? (
        <>
          {/* Role-Aware Quick Access — above primary focus */}
          <RoleAwareQuickAccess />

          {/* Primary Focus */}
          {intel.primaryFocus && (
            <div className={`glass-panel p-6 rounded-xl border relative overflow-hidden mb-6 ${
              intel.primaryFocus.type === 'urgent' ? 'border-red-500/20 bg-red-500/5' : 
              intel.primaryFocus.type === 'focus' ? 'border-amber-500/20 bg-amber-500/5' : 
              'border-indigo-500/20 bg-surface-2'
            }`}>
              <div className="flex items-start gap-4">
                <div className="mt-1">
                  {renderRecommendationIcon(intel.primaryFocus.type)}
                </div>
                <div className="flex-1">
                  <h2 className="text-sm font-bold uppercase tracking-widest font-mono-pm mb-1 text-text-primary">
                    Primary Focus
                  </h2>
                  <p className="text-sm font-medium text-text-secondary mb-3">
                    {intel.primaryFocus.message}
                  </p>
                  {intel.primaryFocus.actionRoute && (
                    <button 
                      onClick={() => navigateTo(intel.primaryFocus!.actionRoute!)}
                      className="px-4 py-2 text-xs font-semibold rounded bg-indigo-500/10 text-indigo-400 hover:bg-indigo-500/20 transition-colors inline-flex items-center gap-1.5 shadow-sm"
                    >
                      Take Action <ArrowRight className="w-3 h-3" />
                    </button>
                  )}
                </div>
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            
            {/* LEFT COLUMN: Actions & Needs Attention */}
            <div className="lg:col-span-2 space-y-6">
              
              {/* Needs My Attention */}
              {intel.attentionItems.length > 0 && (
                <div className="bg-surface-elevated rounded-lg border border-border shadow-sm overflow-hidden">
                  <div className="p-4 border-b border-border bg-surface flex items-center gap-2">
                    <ShieldAlert className="w-4 h-4 text-red-400" />
                    <h2 className="text-sm font-semibold text-text-primary">Needs Your Attention</h2>
                  </div>
                  <div className="p-0">
                    <ul className="divide-y divide-border-subtle">
                      {intel.attentionItems.map(item => (
                        <li key={item.id} className="p-4 hover:bg-surface-hover transition-colors flex justify-between items-center gap-4">
                          <div>
                            <p className="text-sm font-medium text-text-primary">{item.title}</p>
                            {item.subtitle && <p className="text-xs text-text-secondary mt-0.5">{item.subtitle}</p>}
                          </div>
                          <button 
                            onClick={() => navigateTo(item.actionRoute)} 
                            className="px-3 py-1.5 bg-indigo-500/10 text-indigo-500 hover:bg-indigo-500/20 text-xs font-semibold rounded transition-colors"
                          >
                            {item.actionLabel}
                          </button>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              )}

              {/* Upcoming Deadlines / Tasks */}
              {intel.upcomingDeadlines.length > 0 && (
                <div className="bg-surface-elevated rounded-lg border border-border shadow-sm overflow-hidden">
                  <div className="p-4 border-b border-border bg-surface flex items-center gap-2">
                    <Clock className="w-4 h-4 text-amber-500" />
                    <h2 className="text-sm font-semibold text-text-primary">Upcoming & Assigned Work</h2>
                  </div>
                  <div className="p-0">
                    <ul className="divide-y divide-border-subtle">
                      {intel.upcomingDeadlines.map(item => (
                        <li key={item.id} className="p-4 hover:bg-surface-hover transition-colors flex justify-between items-center gap-4">
                          <div>
                            <div className="flex items-center gap-2 mb-1">
                              <span className={`text-[10px] uppercase font-mono tracking-widest px-1.5 py-0.5 rounded ${
                                item.priority === 'High' ? 'bg-amber-500/10 text-amber-500' : 'bg-surface-3 text-text-secondary'
                              }`}>
                                {item.priority} Priority
                              </span>
                            </div>
                            <p className="text-sm font-medium text-text-primary">{item.title}</p>
                            {item.subtitle && <p className="text-xs text-text-secondary mt-0.5">{item.subtitle}</p>}
                          </div>
                          <button 
                            onClick={() => navigateTo(item.actionRoute)} 
                            className="px-3 py-1.5 bg-surface-3 text-text-primary hover:bg-surface-hover border border-border text-xs font-semibold rounded transition-colors"
                          >
                            {item.actionLabel}
                          </button>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              )}
            </div>

            {/* RIGHT COLUMN: Changes & Recommendations */}
            <div className="space-y-6">
              
              {/* Strategic Recommendations */}
              {intel.recommendations.length > 0 && (
                <div className="bg-surface-elevated rounded-lg border border-border shadow-sm overflow-hidden">
                  <div className="p-4 border-b border-border bg-surface flex items-center gap-2">
                    <TrendingUp className="w-4 h-4 text-indigo-400" />
                    <h2 className="text-sm font-semibold text-text-primary">Recommendations</h2>
                  </div>
                  <div className="p-4">
                    <ul className="space-y-3">
                      {intel.recommendations.map(rec => (
                        <li key={rec.id} className="flex gap-3">
                          <div className="mt-0.5">{renderRecommendationIcon(rec.type)}</div>
                          <div>
                            <p className="text-xs text-text-secondary">{rec.message}</p>
                            {rec.actionRoute && (
                              <button onClick={() => navigateTo(rec.actionRoute!)} className="text-[10px] font-semibold text-indigo-400 hover:underline mt-1">
                                Review Details
                              </button>
                            )}
                          </div>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              )}

              {/* Recent Changes */}
              {intel.recentChanges.length > 0 && (
                <div className="bg-surface-elevated rounded-lg border border-border shadow-sm overflow-hidden">
                  <div className="p-4 border-b border-border bg-surface flex items-center gap-2">
                    <Activity className="w-4 h-4 text-text-tertiary" />
                    <h2 className="text-sm font-semibold text-text-primary">Recent Activity</h2>
                  </div>
                  <div className="p-0">
                    <ul className="divide-y divide-border-subtle">
                      {intel.recentChanges.map(change => (
                        <li key={change.id} className="p-3 hover:bg-surface-hover transition-colors">
                          <p className="text-xs font-medium text-text-primary mb-1">{change.description}</p>
                          <p className="text-[10px] text-text-tertiary">{change.time}</p>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              )}

              {/* Notification Intelligence Stream */}
              {recentNotifications.length > 0 && (
                <div className="bg-surface-elevated rounded-lg border border-border shadow-sm overflow-hidden">
                  <div className="p-4 border-b border-border bg-surface flex justify-between items-center">
                    <div className="flex items-center gap-2">
                      <Bell className="w-4 h-4 text-accent-primary" />
                      <h2 className="text-sm font-semibold text-text-primary">Actionable Alerts</h2>
                    </div>
                    <button onClick={() => navigateTo('/workspace/notifications')} className="text-[10px] text-accent-primary hover:underline">View Inbox</button>
                  </div>
                  <div className="p-0">
                    <ul className="divide-y divide-border-subtle">
                      {recentNotifications.map(notif => (
                        <li key={notif.id} className="p-3 hover:bg-surface-hover transition-colors flex gap-3">
                          <div className="flex-1">
                            <p className="text-xs font-bold text-text-primary mb-0.5">{notif.title}</p>
                            <p className="text-[10px] text-text-secondary">{notif.message}</p>
                          </div>
                          {notif.action_url && (
                             <button onClick={() => navigateTo(notif.action_url)} className="text-[10px] bg-accent-primary/10 text-accent-primary px-2 py-1 rounded font-bold h-fit mt-1">Review</button>
                          )}
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              )}

            </div>
          </div>
        </>
      ) : (
        <div className="mt-8 bg-[var(--pm-surface)] border border-[var(--pm-outline-variant)] rounded-xl p-4 h-full min-h-[500px]">
          {workspace?.id && <ActivityStream wsId={workspace.id} />}
        </div>
      )}
    </div>
  );
}
