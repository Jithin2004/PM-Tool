import React, { useState } from 'react';
import { useEscapeKey } from '../../hooks/useEscapeKey';
import { supabase } from '../../lib/supabase';
import { useWorkspace } from '../../context/WorkspaceContext';
import { useDashboard } from '../../context/DashboardContext';
import { useAuth } from '../../context/AuthContext';
import { Icon } from '../../components/ui/Icon';
import { activityLogService } from '../../services/activityLogService';
import { sendNotification } from '../../services/notificationService';
import { ConfirmationModal } from '../../components/ui/ConfirmationModal';

export function ApprovalDecisionModal({ approval, onClose, onUpdate }: { approval: any, onClose: () => void, onUpdate: () => void }) {
  useEscapeKey(true, onClose);
  const { workspace } = useWorkspace();
  const { profile } = useAuth();
  const { notify } = useDashboard();
  const [loading, setLoading] = useState(false);
  const [view, setView] = useState<'decision' | 'external'>('decision');
  const [isRejectConfirmOpen, setIsRejectConfirmOpen] = useState(false);
  const [rejectActionConfig, setRejectActionConfig] = useState<{decision: string, note: string} | null>(null);
  
  const [decisionNotes, setDecisionNotes] = useState('');
  const [externalSource, setExternalSource] = useState('Email');

  const executeDecision = async (decisionStr: string, source: string, noteStr: string) => {
    if ((decisionStr === 'Rejected' || decisionStr === 'Overridden') && !noteStr.trim()) {
      notify("A reason/proof note is required for this action.", "error");
      return;
    }

    setLoading(true);
    try {
      let finalNoteStr = noteStr;
      
      // Handle time_entry specific logic
      if (approval.entity_type === 'time_entry' && decisionStr === 'Approved') {
        try {
          const payload = JSON.parse(approval.note);
          
          // Create the work session
          const { error: wsError } = await supabase.from('work_sessions').insert({
            workspace_id: workspace!.id,
            task_id: approval.entity_id,
            user_id: approval.requested_by,
            started_at: payload.started_at,
            ended_at: payload.ended_at,
            duration_minutes: payload.duration_minutes,
            session_type: 'normal',
            entry_type: 'manual',
            status: 'completed',
            locked_at: new Date().toISOString(), // automatically lock it since it's PM approved
            locked_by: profile?.id
          });
          if (wsError) throw wsError;
          
          finalNoteStr = `[Approved Time Entry] PM Note: ${noteStr} | Original Reason: ${payload.reason}`;
        } catch (e) {
          console.error("Failed to parse time_entry payload or insert session", e);
          notify("Failed to process time entry data.", "error");
          setLoading(false);
          return;
        }
      } else if (approval.entity_type === 'time_entry_edit' && decisionStr === 'Approved') {
        try {
          const payload = JSON.parse(approval.note);
          
          const { error: wsError } = await supabase.from('work_sessions').update({
            ...payload.updates,
            updated_at: new Date().toISOString()
          }).eq('id', approval.entity_id);
          
          if (wsError) throw wsError;
          
          finalNoteStr = `[Approved Time Edit] PM Note: ${noteStr} | Original Reason: ${payload.reason}`;
        } catch (e) {
          console.error("Failed to parse time_entry_edit payload or update session", e);
          notify("Failed to process time edit data.", "error");
          setLoading(false);
          return;
        }
      } else if (approval.entity_type === 'time_entry' || approval.entity_type === 'time_entry_edit') {
        // Just preserve the original reason if rejected
        try {
          const payload = JSON.parse(approval.note);
          finalNoteStr = `[Rejected ${approval.entity_type}] PM Note: ${noteStr} | Original Reason: ${payload.reason}`;
        } catch (e) {
          // ignore
        }
      }

      const { error } = await supabase.from('universal_approvals').update({
        decision: decisionStr,
        approval_source: source,
        note: finalNoteStr,
        approved_by: profile?.id,
        updated_at: new Date().toISOString()
      }).eq('id', approval.id);

      if (error) throw error;

      await activityLogService.appendLog({
        workspace_id: workspace!.id,
        action: 'approval_decision',
        metadata: { 
          approval_id: approval.id, 
          entity_type: approval.entity_type,
          decision: decisionStr,
          source: source,
          old_status: approval.decision,
          new_status: decisionStr
        }
      });

      if (approval.requested_by) {
        await sendNotification(
          workspace!.id,
          'system',
          `Approval ${decisionStr}`,
          `Your request for ${approval.entity_type} was ${decisionStr.toLowerCase()}.`,
          approval.requested_by,
          { type: 'approval_decision', entity_id: approval.id, deep_link: '/workspace/approvals' }
        );
      }

      // Simple notification system integration (simulated via notify or real insert if there's a notifications table)
      notify(`Approval marked as ${decisionStr}.`, "success");
      onUpdate();
      onClose();
    } catch (err) {
      console.error(err);
      notify("Failed to record decision.", "error");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 overflow-y-auto">
      <div className="absolute inset-0 modal-overlay-premium" />
      <div className="relative modal-premium p-6 rounded-2xl max-w-md w-full text-white max-h-[90vh] flex flex-col scrollbar-premium">
        <div className="flex justify-between items-center mb-4 flex-none">
          <h2 className="text-lg font-bold tracking-tight">Approval Request</h2>
          <button onClick={onClose} aria-label="Close modal" className="p-2 rounded-lg hover:bg-[var(--surface-hover)] transition-colors text-[var(--text-secondary)] hover:text-white">
            <Icon name="close" size={20} />
          </button>
        </div>
        
        <div className="flex-1 overflow-y-auto pr-2 space-y-6 scrollbar-premium">
          <div className="bg-black/20 p-4 rounded-xl border border-[var(--border-soft)] text-sm space-y-2">
            <div className="flex justify-between">
              <span className="text-[var(--text-secondary)]">Entity Type</span>
              <span className="font-mono uppercase tracking-wider text-indigo-400">{approval.entity_type}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-[var(--text-secondary)]">Requested By</span>
              <span className="font-mono text-[var(--text-secondary)]">{approval.requested_by_user?.email || 'Unknown'}</span>
            </div>
            {approval.entity_type === 'time_entry' && approval.note && (
              <div className="mt-2 pt-2 border-t border-[var(--border-soft)] space-y-2">
                {(() => {
                  try {
                    const p = JSON.parse(approval.note);
                    return (
                      <>
                        <div className="flex justify-between">
                          <span className="text-[var(--text-secondary)]">Duration</span>
                          <span className="font-mono text-emerald-400">{p.duration_minutes} mins ({(p.duration_minutes / 60).toFixed(1)} hrs)</span>
                        </div>
                        <div className="flex flex-col gap-1">
                          <span className="text-[var(--text-secondary)]">Employee Reason</span>
                          <span className="text-[var(--text-secondary)] bg-black/40 p-2.5 rounded border border-[var(--border-soft)]">{p.reason}</span>
                        </div>
                      </>
                    );
                  } catch (e) {
                    return <span>Could not parse entry details.</span>;
                  }
                })()}
              </div>
            )}
          </div>

          <div className="flex premium-segmented-control">
            <button 
              onClick={() => setView('decision')}
              className={`flex-1 py-2 text-xs font-mono uppercase tracking-wider premium-segmented-control-btn ${view === 'decision' ? 'active' : ''}`}
            >
              Direct Decision
            </button>
            <button 
              onClick={() => setView('external')}
              className={`flex-1 py-2 text-xs font-mono uppercase tracking-wider premium-segmented-control-btn ${view === 'external' ? 'active' : ''}`}
            >
              External Approval
            </button>
          </div>

          {view === 'decision' ? (
            <div className="space-y-4">
              {approval.entity_type === 'time_entry' || approval.entity_type === 'time_entry_edit' ? (
                <div className="p-3 bg-amber-500/10 border border-amber-500/25 rounded-xl">
                  <h4 className="text-[10px] font-bold uppercase tracking-wider text-amber-400 mb-1">System Observation</h4>
                  <p className="text-xs text-amber-200/80">
                    {approval.entity_type === 'time_entry_edit' 
                      ? "This session was edited after the same-day window closed."
                      : "This session exceeds the standard expected duration (120m) and was flagged for PM review."}
                  </p>
                </div>
              ) : null}

              <div>
                <label className="block text-[10px] font-mono uppercase tracking-widest text-[var(--text-secondary)] mb-2">Notes / Reason (Required for Rejection)</label>
                <textarea 
                  value={decisionNotes} 
                  onChange={e => setDecisionNotes(e.target.value)} 
                  placeholder="Provide context for your decision..."
                  className="w-full input-premium px-3 py-2.5 text-sm outline-none min-h-[95px]" 
                />
              </div>
              <div className="flex flex-col gap-2 pt-2">
                <button 
                  onClick={() => executeDecision('Approved', 'internal', decisionNotes)}
                  disabled={loading}
                  className="w-full btn-premium-success py-2.5 rounded-xl text-xs font-bold uppercase tracking-wider active:scale-[0.98]"
                >
                  Approve Request
                </button>
                <button 
                  onClick={() => {
                    if (!decisionNotes.trim()) {
                      notify("A reason/proof note is required for this action.", "error");
                      return;
                    }
                    setRejectActionConfig({ decision: 'Rejected', note: decisionNotes });
                    setIsRejectConfirmOpen(true);
                  }}
                  disabled={loading}
                  className="w-full btn-premium-danger py-2.5 rounded-xl text-xs font-bold uppercase tracking-wider active:scale-[0.98]"
                >
                  Reject Request
                </button>
                <button 
                  onClick={() => executeDecision('Rejected', 'internal', "Requesting Changes: " + decisionNotes)}
                  disabled={loading}
                  className="w-full py-2.5 bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 border border-amber-500/20 rounded-xl text-xs font-bold uppercase tracking-wider active:scale-[0.98] transition-colors"
                >
                  Request Changes
                </button>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="p-3 bg-indigo-500/10 border border-indigo-500/20 rounded-xl text-xs text-indigo-200">
                Use this to log an approval that occurred outside the platform (e.g., Client WhatsApp, Email, Phone Call).
              </div>
              <div>
                <label className="block text-[10px] font-mono uppercase tracking-widest text-[var(--text-secondary)] mb-2">External Source</label>
                <select value={externalSource} onChange={e => setExternalSource(e.target.value)} className="w-full input-premium px-3 py-2.5 text-sm outline-none">
                  <option value="Email">Email</option>
                  <option value="WhatsApp">WhatsApp</option>
                  <option value="Phone Call">Phone Call</option>
                  <option value="Slack/Teams">Slack/Teams</option>
                  <option value="In-person">In-person</option>
                </select>
              </div>
              <div>
                <label className="block text-[10px] font-mono uppercase tracking-widest text-[var(--text-secondary)] mb-2">Proof / Notes (Required)</label>
                <textarea 
                  value={decisionNotes} 
                  onChange={e => setDecisionNotes(e.target.value)} 
                  placeholder="Paste snippet or link to email..."
                  className="w-full input-premium px-3 py-2.5 text-sm outline-none min-h-[95px]" 
                />
              </div>
              <div className="pt-2">
                <button 
                  onClick={() => executeDecision('Overridden', externalSource, decisionNotes)}
                  disabled={loading}
                  className="w-full btn-premium-primary py-2.5 rounded-xl text-xs font-bold uppercase tracking-wider active:scale-[0.98]"
                >
                  Mark Externally Approved
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      <ConfirmationModal
        isOpen={isRejectConfirmOpen}
        title="Reject Approval Request"
        message="Are you sure you want to reject this request? The requester will be notified."
        confirmText="Reject"
        onConfirm={() => {
          setIsRejectConfirmOpen(false);
          if (rejectActionConfig) {
            executeDecision(rejectActionConfig.decision, 'internal', rejectActionConfig.note);
          }
        }}
        onCancel={() => {
          setIsRejectConfirmOpen(false);
          setRejectActionConfig(null);
        }}
      />
    </div>
  );
}
