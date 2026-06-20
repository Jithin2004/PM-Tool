import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Shield, Clock, FileText, CheckSquare, Calendar as CalendarIcon, LogOut, ArrowRight, ShieldCheck, Download, Activity } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { showAlert, showPrompt } from '../../components/common/Dialogs';
import { PremiumLoader } from '../../components/common/PremiumLoader';

export function SharedProjectDashboard({ previewToken }: { previewToken?: string }) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<any>(null);
  const [documents, setDocuments] = useState<any[]>([]);
  const [meetings, setMeetings] = useState<any[]>([]);
  const [tasks, setTasks] = useState<any[]>([]);
  const [approvals, setApprovals] = useState<any[]>([]);
  const [submittingApproval, setSubmittingApproval] = useState<string | null>(null);

  // Extract token from path or use prop
  const pathParts = window.location.pathname.split('/');
  const token = previewToken || pathParts[pathParts.length - 1];

  useEffect(() => {
    const fetchSharedData = async () => {
      try {
        setLoading(true);
        // 1. Fetch project and permissions via secure RPC
        const { data: sharedData, error: sharedError } = await supabase.rpc('get_shared_project_data', { p_token: token });
        
        if (sharedError) throw sharedError;
        if (!sharedData) throw new Error("Invalid link");

        setData(sharedData);

        const perms = sharedData.permissions;

        // 2. Fetch Client-Visible Documents
        if (perms.can_view_documents) {
          setDocuments(sharedData.documents || []);
        }

        // 3. Fetch Client Meetings
        setMeetings(sharedData.meetings || []);

        // 4. Fetch Tasks (High-level)
        if (perms.can_view_tasks) {
          setTasks(sharedData.tasks || []);
        }

        // 5. Fetch Approvals
        if (perms.can_approve) {
          setApprovals(sharedData.approvals || []);
        }

      } catch (err: any) {
        console.error("Shared project error:", err);
        setError(err.message || "Unable to access shared project. Link may be invalid or expired.");
      } finally {
        setLoading(false);
      }
    };

    if (token) {
      fetchSharedData();
    } else {
      setError("No token provided");
      setLoading(false);
    }
  }, [token]);

  const handleApprovalAction = async (approvalId: string, status: 'approved' | 'rejected') => {
    try {
      setSubmittingApproval(approvalId);
      
      const notes = await showPrompt(`Please provide any notes for ${status === 'approved' ? 'approving' : 'rejecting'}:`, {
        title: status === 'approved' ? 'Approve Deliverable' : 'Reject Deliverable'
      });
      if (notes === null && status === 'rejected') return; // Cancelled

      const { error } = await supabase.rpc('submit_client_approval', {
        p_token: token,
        p_approval_id: approvalId,
        p_status: status,
        p_notes: notes || ''
      });

      if (error) throw error;
      
      // Remove from list
      setApprovals(prev => prev.filter(a => a.id !== approvalId));
      await showAlert(`Deliverable ${status}`, { type: 'success' });
    } catch (err: any) {
      console.error(err);
      await showAlert("Failed to submit: " + err.message, { type: 'error' });
    } finally {
      setSubmittingApproval(null);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen  flex items-center justify-center p-6">
        <div className="max-w-md w-full premium-panel p-8 rounded-2xl">
          <PremiumLoader type="page" label="Syncing Client Portal..." />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen  flex items-center justify-center p-6">
        <div className="premium-panel p-8 max-w-md w-full text-center rounded-2xl border-rose-500/20">
          <Shield className="w-12 h-12 text-rose-500/50 mx-auto mb-4" />
          <h2 className="text-xl font-sans text-rose-400 mb-2 font-semibold">Access Denied</h2>
          <p className="text-sm font-mono text-[var(--text-secondary)]">{error}</p>
        </div>
      </div>
    );
  }

  const { project, permissions } = data;

  const getStatusColor = (s: string) => {
    switch (s) {
      case 'done': return 'text-emerald-400';
      case 'in_progress': return 'text-amber-400';
      case 'review': return 'text-purple-400';
      default: return 'text-[var(--text-secondary)]';
    }
  };

  return (
    <div className="min-h-screen  text-white selection:bg-purple-500/30 font-geist">
      {/* Client Header */}
      <header className="h-16 border-b border-[var(--border-soft)] bg-[#050712]/50 backdrop-blur-md flex items-center justify-between px-6 sticky top-0 z-10">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 premium-panel flex items-center justify-center rounded-xl">
            <ShieldCheck className="w-4 h-4 text-purple-400" />
          </div>
          <div>
            <h1 className="text-sm font-bold tracking-tight text-white">{project.name}</h1>
            <div className="text-[10px] font-mono text-purple-400 uppercase tracking-widest">Client Portal</div>
          </div>
        </div>
        
        <div className="flex items-center gap-4">
          {project.client_view_budget && project.budget && (
            <div className="px-3 py-1 bg-[var(--surface-glass)] border border-[var(--border-soft)] text-[10px] font-mono text-[var(--text-secondary)] uppercase tracking-wider rounded-lg">
              Budget: <span className="text-white">${project.budget.toLocaleString()}</span>
            </div>
          )}
          <div className="px-3 py-1 bg-[var(--surface-glass)] border border-[var(--border-soft)] text-[10px] font-mono text-[var(--text-secondary)] uppercase tracking-wider rounded-lg">
            Status: <span className="text-white capitalize">{project.status}</span>
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto p-6 md:p-8 space-y-8">
        
        {/* Approvals (Highest Priority) */}
        {permissions.can_approve && approvals.length > 0 && (
          <section className="space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <h2 className="text-sm font-mono uppercase tracking-widest text-amber-400 flex items-center gap-2">
              <CheckSquare className="w-4 h-4" /> Pending Deliverables
            </h2>
            <div className="grid gap-4">
              {approvals.map(appr => (
                <div key={appr.id} className="premium-panel border border-amber-500/20 bg-amber-500/5 p-5 rounded-2xl flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                  <div>
                    <div className="text-xs font-mono text-amber-400/50 uppercase mb-1">Phase: {appr.phase}</div>
                    <div className="text-sm font-medium text-[var(--text-secondary)]">{appr.comment || "Please review and approve the latest delivery."}</div>
                  </div>
                  <div className="flex gap-3 shrink-0">
                    <button 
                      disabled={!!submittingApproval}
                      onClick={() => handleApprovalAction(appr.id, 'rejected')}
                      className="px-4 py-2 btn-premium-danger text-xs font-mono uppercase tracking-wider transition-colors disabled:opacity-50 rounded-lg"
                    >
                      Reject
                    </button>
                    <button 
                      disabled={!!submittingApproval}
                      onClick={() => handleApprovalAction(appr.id, 'approved')}
                      className="px-4 py-2 btn-premium-success text-xs font-mono uppercase tracking-wider transition-colors disabled:opacity-50 rounded-lg"
                    >
                      {submittingApproval === appr.id ? '...' : 'Approve'}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          
          {/* Documents */}
          {permissions.can_view_documents && (
            <section className="space-y-4 font-mono">
              <h2 className="text-sm font-mono uppercase tracking-widest text-[var(--text-secondary)] flex items-center gap-2 border-b border-[var(--border-soft)] pb-2">
                <FileText className="w-4 h-4 text-purple-400/80" /> Shared Documents
              </h2>
              {documents.length === 0 ? (
                <p className="text-xs font-mono text-[var(--text-secondary)] p-4 border border-[var(--border-soft)] bg-[var(--surface-glass)] text-center rounded-xl">No documents shared yet.</p>
              ) : (
                <div className="space-y-2">
                  {documents.map(doc => (
                    <a 
                      key={doc.id} 
                      href={doc.url} 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="flex items-center justify-between p-3 bg-[var(--surface-glass)] border border-[var(--border-soft)] hover:border-purple-500/30 hover:bg-[var(--surface-hover)] transition-all rounded-xl group"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 bg-[var(--surface-glass)] flex items-center justify-center shrink-0 rounded-lg">
                          <FileText className="w-4 h-4 text-[var(--text-secondary)] group-hover:text-purple-400 transition-colors" />
                        </div>
                        <span className="text-sm font-medium text-[var(--text-secondary)] group-hover:text-white transition-colors">{doc.title}</span>
                      </div>
                      <ArrowRight className="w-4 h-4 text-[var(--text-secondary)] group-hover:text-purple-400 group-hover:translate-x-1 transition-all" />
                    </a>
                  ))}
                </div>
              )}
            </section>
          )}

          {/* Meetings */}
          <section className="space-y-4">
            <h2 className="text-sm font-mono uppercase tracking-widest text-[var(--text-secondary)] flex items-center gap-2 border-b border-[var(--border-soft)] pb-2 font-mono">
              <CalendarIcon className="w-4 h-4 text-purple-400/80" /> Upcoming Client Meetings
            </h2>
            {meetings.length === 0 ? (
              <p className="text-xs font-mono text-[var(--text-secondary)] p-4 border border-[var(--border-soft)] bg-[var(--surface-glass)] text-center rounded-xl">No meetings scheduled.</p>
            ) : (
              <div className="space-y-2">
                {meetings.map(meet => {
                  const date = new Date(meet.start_time);
                  return (
                    <div key={meet.id} className="flex items-center gap-4 p-3 bg-[var(--surface-glass)] border border-[var(--border-soft)] hover:border-purple-500/20 transition-all rounded-xl">
                      <div className="w-12 h-12 bg-[var(--surface-glass)] flex flex-col items-center justify-center shrink-0 rounded-lg">
                        <span className="text-[10px] font-mono text-[var(--text-secondary)] uppercase">{date.toLocaleString('en-US', { month: 'short' })}</span>
                        <span className="text-lg font-bold text-white">{date.getDate()}</span>
                      </div>
                      <div>
                        <div className="text-sm font-medium text-[var(--text-secondary)]">{meet.title}</div>
                        <div className="text-xs font-mono text-[var(--text-secondary)] mt-1 flex items-center gap-1">
                          <Clock className="w-3 h-3 text-purple-400/80" /> {date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </section>
        </div>

        {/* Task Progress */}
        {permissions.can_view_tasks && (
          <section className="space-y-4">
            <h2 className="text-sm font-mono uppercase tracking-widest text-[var(--text-secondary)] flex items-center gap-2 border-b border-[var(--border-soft)] pb-2 font-mono">
              <Activity className="w-4 h-4 text-purple-400/80" /> Project Progress
            </h2>
            {tasks.length === 0 ? (
              <p className="text-xs font-mono text-[var(--text-secondary)] p-4 border border-[var(--border-soft)] bg-[var(--surface-glass)] text-center rounded-xl">No tasks available.</p>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                {tasks.map(task => (
                  <div key={task.id} className="p-4 bg-[var(--surface-glass)] border border-[var(--border-soft)] hover:border-purple-500/20 hover:bg-[var(--surface-hover)] transition-all rounded-xl space-y-3">
                    <div className="flex items-start justify-between">
                      <span className={`text-[10px] font-mono uppercase px-2 py-0.5 rounded border ${
                        task.priority === 'urgent' ? 'border-[var(--signal-critical)] bg-[var(--signal-critical-bg)]/30 text-red-400 bg-red-500/10' :
                        task.priority === 'high' ? 'border-amber-500/30 text-amber-400 bg-amber-500/10' :
                        'border-[var(--border-soft)] text-[var(--text-secondary)] bg-[var(--surface-glass)]'
                      }`}>
                        {task.priority || 'normal'}
                      </span>
                      <span className={`text-[10px] font-mono uppercase tracking-wider ${getStatusColor(task.status)}`}>
                        {task.status.replace('_', ' ')}
                      </span>
                    </div>
                    <div className="text-sm font-semibold text-[var(--text-secondary)] line-clamp-2 leading-relaxed">
                      {task.title}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
        )}

      </main>
    </div>
  );
}
