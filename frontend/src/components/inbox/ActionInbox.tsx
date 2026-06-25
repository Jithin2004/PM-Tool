import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useWorkspace } from '../../context/WorkspaceContext';
import { useOperationalData } from '../../context/OperationalDataContext';
import { generateWorkInbox, WorkInboxItem } from '../../core/execution/WorkInboxEngine';
import { Inbox, AlertTriangle, CheckCircle2, Clock, AtSign, ArrowRight, ShieldAlert, X } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { generatePriorityExplanation } from '../../core/intelligence/PriorityExplanationEngine';
import { PriorityExplanationBadge } from '../ui/PriorityExplanationBadge';

import { ApprovalDecisionModal } from '../../pages/workspace/ApprovalDecisionModal';

export function ActionInbox() {
  const { profile } = useAuth();
  const { workspace } = useWorkspace();
  const { raw: { tasks, projects, profiles }, dbNotifications } = useOperationalData();
  const [inboxItems, setInboxItems] = useState<WorkInboxItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [isOpen, setIsOpen] = useState(false);
  const [rawApprovals, setRawApprovals] = useState<any[]>([]);
  const [selectedApproval, setSelectedApproval] = useState<any | null>(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('inbox') === 'open') {
      setIsOpen(true);
      // Optional: remove query param to not trigger again on reload
      const newUrl = window.location.pathname;
      window.history.replaceState({}, '', newUrl);
    }
  }, []);

  useEffect(() => {
    if (!profile || !workspace) return;
    loadInbox();
  }, [profile, workspace, tasks, projects]);

  const loadInbox = async () => {
    setLoading(true);
    try {
      const { data: approvals } = await supabase.from('universal_approvals').select('*').eq('workspace_id', workspace!.id);

      setRawApprovals(approvals || []);
      const notifs = dbNotifications;

      const items = generateWorkInbox({
        userId: profile!.id,
        tasks,
        projects,
        approvals: approvals || [],
        notifications: notifs || [],
        workspaceSettingsBlob: workspace!.settings,
        profiles: profiles || []
      });

      setInboxItems(items);
    } catch (e) {
      console.error("Failed to load inbox:", e);
    } finally {
      setLoading(false);
    }
  };

  const navigateTo = (path: string) => {
    window.history.pushState(null, '', path);
    window.dispatchEvent(new Event('popstate'));
    setIsOpen(false);
  };

  const criticalCount = inboxItems.filter(i => i.priority === 'CRITICAL').length;
  const totalCount = inboxItems.length;

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="relative p-2 rounded-full hover:bg-[var(--pm-surface-hover)] transition-colors text-[var(--pm-text)] group"
      >
        <Inbox className="w-5 h-5 text-text-secondary group-hover:text-text-primary transition-colors" />
        {totalCount > 0 && (
          <span className={`absolute top-0 right-0 w-4 h-4 text-[9px] font-bold text-white rounded-full flex items-center justify-center ${criticalCount > 0 ? 'bg-signal-error animate-pulse' : 'bg-accent-primary'}`}>
            {totalCount > 9 ? '9+' : totalCount}
          </span>
        )}
      </button>

      {isOpen && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setIsOpen(false)} />
          <div className="absolute right-0 top-full mt-2 w-96 max-h-[80vh] overflow-y-auto bg-surface-2 border border-border shadow-2xl rounded-xl z-50 flex flex-col backdrop-blur-xl">
            <div className="p-4 border-b border-border/50 flex justify-between items-center sticky top-0 bg-surface-2/90 backdrop-blur-md z-10">
              <div className="flex items-center gap-2">
                <Inbox className="w-5 h-5 text-accent-primary" />
                <h3 className="font-semibold text-[var(--pm-text)]">Universal Inbox</h3>
              </div>
              <button onClick={() => setIsOpen(false)} className="text-text-tertiary hover:text-text-primary">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-2 space-y-1 overflow-y-auto flex-1">
              {loading ? (
                <div className="p-8 text-center text-sm text-text-tertiary font-mono animate-pulse">Loading actions...</div>
              ) : inboxItems.length === 0 ? (
                <div className="p-8 text-center">
                  <CheckCircle2 className="w-12 h-12 text-emerald-500/30 mx-auto mb-3" />
                  <p className="text-sm font-medium text-text-secondary">Inbox Zero</p>
                  <p className="text-xs text-text-tertiary mt-1">No pending actions required.</p>
                </div>
              ) : (
                inboxItems.map(item => (
                  <div
                    key={item.id}
                    className={`p-3 rounded-lg border flex flex-col gap-2 transition-colors cursor-pointer hover:bg-[var(--pm-surface-hover)]
                      ${item.priority === 'CRITICAL' ? 'border-signal-error/30 bg-signal-error/5' :
                        item.priority === 'HIGH' ? 'border-amber-500/30 bg-amber-500/5' :
                          'border-border/50 bg-surface-highest'}`}
                    onClick={() => {
                      if (item.type === 'approval' && item.metadata?.approvalId) {
                        const approval = rawApprovals.find(a => a.id === item.metadata?.approvalId);
                        if (approval) {
                          setSelectedApproval(approval);
                        } else {
                          navigateTo(item.actionRoute);
                        }
                      } else {
                        navigateTo(item.actionRoute);
                      }
                    }}
                  >
                    <div className="flex items-start gap-3">
                      <div className="mt-0.5">
                        {item.type === 'mention' && <AtSign className="w-4 h-4 text-indigo-400" />}
                        {item.type === 'approval' && <ShieldAlert className="w-4 h-4 text-amber-500" />}
                        {item.type === 'assigned_task' && <CheckCircle2 className="w-4 h-4 text-emerald-400" />}
                        {item.type === 'blocker_request' && <AlertTriangle className="w-4 h-4 text-signal-error" />}
                        {(item.type as string) === 'notification' && <Clock className="w-4 h-4 text-blue-400" />}
                      </div>
                      <div className="flex-1">
                        <div className="flex justify-between items-start">
                          <div className="flex items-center gap-2">
                            <h4 className="text-sm font-semibold text-text-primary line-clamp-1">{item.title}</h4>
                            {item.metadata?.taskId && (
                              <PriorityExplanationBadge
                                explanation={generatePriorityExplanation(
                                  tasks.find(t => t.id === item.metadata.taskId) || { id: item.metadata.taskId },
                                  'task',
                                  { userId: profile?.id || '', role: profile?.role || 'developer' as any, tasks, projects, blockers: ((workspace?.settings as any)?.execution_blockers as any[]) || [], approvals: [] }
                                )}
                              />
                            )}
                            {item.metadata?.approvalId && (
                              <PriorityExplanationBadge
                                explanation={generatePriorityExplanation(
                                  { id: item.metadata.approvalId, requested_from: profile?.id, status: 'pending', created_at: item.timestamp },
                                  'approval',
                                  { userId: profile?.id || '', role: profile?.role || 'developer' as any, tasks, projects, blockers: [], approvals: [{ id: item.metadata.approvalId, requested_from: profile?.id, status: 'pending', created_at: item.timestamp }] }
                                )}
                              />
                            )}
                          </div>
                          <span className="text-[10px] text-text-tertiary whitespace-nowrap ml-2 mt-1">
                            {new Date(item.timestamp).toLocaleDateString()}
                          </span>
                        </div>
                        {item.description && (
                          <p className="text-xs text-text-secondary mt-1 line-clamp-2">{item.description}</p>
                        )}
                        <div className="mt-3 flex justify-end">
                          <button
                            className="text-xs font-semibold px-3 py-1.5 rounded flex items-center gap-1.5 transition-colors
                              bg-surface-3 text-text-primary hover:bg-surface-lowest border border-border"
                          >
                            Take Action <ArrowRight className="w-3 h-3" />
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </>
      )}

      {selectedApproval && (
        <ApprovalDecisionModal
          approval={selectedApproval}
          onClose={() => setSelectedApproval(null)}
          onUpdate={loadInbox}
        />
      )}
    </div>
  );
}
