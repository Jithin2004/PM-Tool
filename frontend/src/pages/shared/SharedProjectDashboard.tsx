import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Shield, Clock, FileText, CheckSquare, Calendar as CalendarIcon, LogOut, ArrowRight, ShieldCheck, Download, Activity } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { showAlert, showPrompt } from '../../components/common/Dialogs';

export function SharedProjectDashboard() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<any>(null);
  const [documents, setDocuments] = useState<any[]>([]);
  const [meetings, setMeetings] = useState<any[]>([]);
  const [tasks, setTasks] = useState<any[]>([]);
  const [approvals, setApprovals] = useState<any[]>([]);
  const [submittingApproval, setSubmittingApproval] = useState<string | null>(null);

  // Extract token from path
  const pathParts = window.location.pathname.split('/');
  const token = pathParts[pathParts.length - 1];

  useEffect(() => {
    const fetchSharedData = async () => {
      try {
        setLoading(true);
        // 1. Fetch project and permissions via secure RPC
        const { data: sharedData, error: sharedError } = await supabase.rpc('get_shared_project_data', { p_token: token });
        
        if (sharedError) throw sharedError;
        if (!sharedData) throw new Error("Invalid link");

        setData(sharedData);

        const projectId = sharedData.project.id;
        const perms = sharedData.permissions;

        // 2. Fetch Client-Visible Documents
        if (perms.can_view_documents) {
          const { data: docs } = await supabase
            .from('document_references')
            .select('*')
            .eq('project_id', projectId)
            .eq('visibility', 'client_visible');
          if (docs) setDocuments(docs);
        }

        // 3. Fetch Client Meetings
        const { data: meets } = await supabase
          .from('meetings')
          .select('*')
          .eq('project_id', projectId)
          .eq('meeting_category', 'Client')
          .order('start_time', { ascending: true });
        if (meets) setMeetings(meets);

        // 4. Fetch Tasks (High-level)
        if (perms.can_view_tasks) {
          const { data: taskData } = await supabase
            .from('tasks')
            .select('id, title, status, priority')
            .eq('project_id', projectId);
          if (taskData) setTasks(taskData);
        }

        // 5. Fetch Approvals
        if (perms.can_approve) {
          const { data: apprData } = await supabase
            .from('universal_approvals')
            .select('*')
            .eq('entity_id', projectId)
            .eq('status', 'pending');
          if (apprData) setApprovals(apprData);
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
      <div className="min-h-screen bg-[#0a0a0b] flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-cyan-500/30 border-t-cyan-400 rounded-full animate-spin" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-[#0a0a0b] flex items-center justify-center p-6">
        <div className="bg-[#121214] border border-red-500/20 p-8 max-w-md w-full text-center rounded-sm">
          <Shield className="w-12 h-12 text-red-500/50 mx-auto mb-4" />
          <h2 className="text-xl font-sans text-red-400 mb-2">Access Denied</h2>
          <p className="text-sm font-mono text-white/50">{error}</p>
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
      default: return 'text-white/50';
    }
  };

  return (
    <div className="min-h-screen bg-[#0a0a0b] text-white selection:bg-cyan-500/30 font-sans">
      {/* Client Header */}
      <header className="h-16 border-b border-white/10 bg-[#121214] flex items-center justify-between px-6 sticky top-0 z-10">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-cyan-500/10 flex items-center justify-center rounded-sm border border-cyan-500/20">
            <ShieldCheck className="w-4 h-4 text-cyan-400" />
          </div>
          <div>
            <h1 className="text-sm font-bold tracking-tight text-white">{project.name}</h1>
            <div className="text-[10px] font-mono text-cyan-400 uppercase tracking-widest">Client Portal</div>
          </div>
        </div>
        
        <div className="flex items-center gap-4">
          <div className="px-3 py-1 bg-white/5 border border-white/10 text-[10px] font-mono text-white/50 uppercase tracking-wider rounded-sm">
            Status: <span className="text-white">{project.status}</span>
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
                <div key={appr.id} className="bg-amber-500/5 border border-amber-500/20 p-5 rounded-sm flex items-center justify-between">
                  <div>
                    <div className="text-xs font-mono text-amber-400/50 uppercase mb-1">Phase: {appr.phase}</div>
                    <div className="text-sm font-medium">{appr.comment || "Please review and approve the latest delivery."}</div>
                  </div>
                  <div className="flex gap-2 shrink-0">
                    <button 
                      disabled={!!submittingApproval}
                      onClick={() => handleApprovalAction(appr.id, 'rejected')}
                      className="px-4 py-2 border border-red-500/20 hover:bg-red-500/10 text-red-400 text-xs font-mono uppercase tracking-wider transition-colors disabled:opacity-50"
                    >
                      Reject
                    </button>
                    <button 
                      disabled={!!submittingApproval}
                      onClick={() => handleApprovalAction(appr.id, 'approved')}
                      className="px-4 py-2 bg-emerald-500/20 border border-emerald-500/30 hover:bg-emerald-500/30 text-emerald-400 text-xs font-mono uppercase tracking-wider transition-colors disabled:opacity-50"
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
            <section className="space-y-4">
              <h2 className="text-sm font-mono uppercase tracking-widest text-white/50 flex items-center gap-2 border-b border-white/10 pb-2">
                <FileText className="w-4 h-4" /> Shared Documents
              </h2>
              {documents.length === 0 ? (
                <p className="text-xs font-mono text-white/30 p-4 border border-white/5 bg-white/5 text-center">No documents shared yet.</p>
              ) : (
                <div className="space-y-2">
                  {documents.map(doc => (
                    <a 
                      key={doc.id} 
                      href={doc.url} 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="flex items-center justify-between p-3 bg-[#121214] border border-white/10 hover:border-cyan-500/30 transition-colors group"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 bg-white/5 flex items-center justify-center shrink-0">
                          <FileText className="w-4 h-4 text-white/50 group-hover:text-cyan-400 transition-colors" />
                        </div>
                        <span className="text-sm font-medium text-white/80 group-hover:text-white transition-colors">{doc.title}</span>
                      </div>
                      <ArrowRight className="w-4 h-4 text-white/30 group-hover:text-cyan-400 group-hover:translate-x-1 transition-all" />
                    </a>
                  ))}
                </div>
              )}
            </section>
          )}

          {/* Meetings */}
          <section className="space-y-4">
            <h2 className="text-sm font-mono uppercase tracking-widest text-white/50 flex items-center gap-2 border-b border-white/10 pb-2">
              <CalendarIcon className="w-4 h-4" /> Upcoming Client Meetings
            </h2>
            {meetings.length === 0 ? (
              <p className="text-xs font-mono text-white/30 p-4 border border-white/5 bg-white/5 text-center">No meetings scheduled.</p>
            ) : (
              <div className="space-y-2">
                {meetings.map(meet => {
                  const date = new Date(meet.start_time);
                  return (
                    <div key={meet.id} className="flex items-center gap-4 p-3 bg-[#121214] border border-white/10">
                      <div className="w-12 h-12 bg-white/5 flex flex-col items-center justify-center shrink-0">
                        <span className="text-[10px] font-mono text-white/50 uppercase">{date.toLocaleString('en-US', { month: 'short' })}</span>
                        <span className="text-lg font-bold">{date.getDate()}</span>
                      </div>
                      <div>
                        <div className="text-sm font-medium text-white/90">{meet.title}</div>
                        <div className="text-xs font-mono text-white/50 mt-1 flex items-center gap-1">
                          <Clock className="w-3 h-3" /> {date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
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
            <h2 className="text-sm font-mono uppercase tracking-widest text-white/50 flex items-center gap-2 border-b border-white/10 pb-2">
              <Activity className="w-4 h-4" /> Project Progress
            </h2>
            {tasks.length === 0 ? (
              <p className="text-xs font-mono text-white/30 p-4 border border-white/5 bg-white/5 text-center">No tasks available.</p>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                {tasks.map(task => (
                  <div key={task.id} className="p-4 bg-[#121214] border border-white/10 space-y-3">
                    <div className="flex items-start justify-between">
                      <span className={`text-[10px] font-mono uppercase px-2 py-0.5 rounded-sm border ${
                        task.priority === 'urgent' ? 'border-red-500/30 text-red-400 bg-red-500/10' :
                        task.priority === 'high' ? 'border-amber-500/30 text-amber-400 bg-amber-500/10' :
                        'border-white/10 text-white/50 bg-white/5'
                      }`}>
                        {task.priority || 'normal'}
                      </span>
                      <span className={`text-[10px] font-mono uppercase tracking-wider ${getStatusColor(task.status)}`}>
                        {task.status.replace('_', ' ')}
                      </span>
                    </div>
                    <div className="text-sm font-medium text-white/80 line-clamp-2 leading-relaxed">
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
