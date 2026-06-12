import React, { useState, useEffect } from 'react';
import { ShieldAlert, CheckSquare, FileText, UserCheck, Calendar } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useWorkspace } from '../../context/WorkspaceContext';
import { useAuth } from '../../context/AuthContext';
import { Icon } from '../../components/ui/Icon';
import { ApprovalDecisionModal } from './ApprovalDecisionModal';
import { PremiumEmptyState } from '../../components/common/PremiumEmptyState';

export default function ApprovalsPage() {
  const { workspace } = useWorkspace();
  const { profile } = useAuth();
  const [approvals, setApprovals] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'needs_me' | 'requested_by_me' | 'completed'>('needs_me');
  const [selectedApproval, setSelectedApproval] = useState<any | null>(null);

  const fetchApprovals = async () => {
    if (!workspace?.id || !profile?.id) {
      setLoading(false);
      return;
    }
    setLoading(true);
    
    try {
      let query = supabase.from('universal_approvals').select('*, requested_by_user:users!requested_by(email), approved_by_user:users!approved_by(email)').eq('workspace_id', workspace.id);
      
      if (filter === 'needs_me') {
        query = query.eq('decision', 'Pending');
      } else if (filter === 'requested_by_me') {
        query = query.eq('requested_by', profile.id);
      } else if (filter === 'completed') {
        query = query.neq('decision', 'Pending');
      }
      
      const { data, error } = await query.order('created_at', { ascending: false });
        
      if (!error && data) {
        setApprovals(data);
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchApprovals();
  }, [workspace?.id, profile?.id, filter]);

  return (
    <div className="flex-1 flex flex-col h-full bg-transparent text-white overflow-hidden premium-fade-in-up">
      <div className="flex-none p-6 border-b border-[var(--border-soft)]">
        <h1 className="text-2xl font-bold tracking-tight text-white">Approval Center</h1>
        <p className="text-xs text-[var(--text-secondary)] mt-1">Review, approve, and track universal entity approvals.</p>
        
        <div className="mt-6 flex premium-segmented-control max-w-md">
          {['needs_me', 'requested_by_me', 'completed'].map(f => (
            <button
              key={f}
              onClick={() => setFilter(f as any)}
              className={`flex-1 py-2 text-xs font-mono uppercase tracking-wider premium-segmented-control-btn ${filter === f ? 'active' : ''}`}
            >
              {f.replace(/_/g, ' ')}
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 p-6 overflow-y-auto scrollbar-premium">
        {loading ? (
          <div className="flex items-center justify-center h-64">
            <div className="animate-spin w-8 h-8 border-2 border-indigo-500 border-t-transparent rounded-full" />
          </div>
        ) : approvals.length === 0 ? (
          <div className="max-w-md mx-auto mt-12">
            <PremiumEmptyState
              icon={CheckSquare}
              title="All caught up!"
              description="No approvals match your current filter selection. Rest easy."
              accentColor="#a78bfa"
            />
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 max-w-7xl">
            {approvals.map(approval => (
              <div 
                key={approval.id} 
                className="premium-panel premium-hover-lift rounded-2xl p-6 border border-[var(--border-soft)] flex flex-col justify-between"
              >
                <div>
                  {/* Document Header Bar */}
                  <div className="flex items-center justify-between pb-3 border-b border-[var(--border-soft)] mb-4">
                    <span className="text-[10px] uppercase tracking-widest font-mono text-indigo-400 font-semibold bg-indigo-500/10 border border-indigo-500/15 px-2.5 py-0.5 rounded">
                      {approval.entity_type.replace(/_/g, ' ')}
                    </span>
                    <span className={`text-[10px] uppercase tracking-widest font-mono px-2 py-0.5 rounded border ${
                      approval.decision === 'Approved' || approval.decision === 'Overridden'
                        ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/15'
                        : approval.decision === 'Rejected'
                        ? 'bg-rose-500/10 text-rose-400 border-rose-500/15'
                        : 'bg-amber-500/10 text-amber-400 border-amber-500/15 animate-pulse'
                    }`}>
                      {approval.decision}
                    </span>
                  </div>

                  {/* Decision Timeline Details */}
                  <div className="space-y-4">
                    {/* Step 1: Request Init */}
                    <div className="flex gap-3 items-start relative">
                      <div className="absolute left-2.5 top-5 bottom-0 w-0.5 bg-[var(--surface-glass)]" />
                      <div className="w-5 h-5 rounded-full bg-emerald-500/10 border border-emerald-500/35 flex items-center justify-center shrink-0 mt-0.5">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                      </div>
                      <div className="text-xs">
                        <span className="block text-[var(--text-secondary)] text-[9px] uppercase font-mono tracking-wider">Init Request</span>
                        <span className="text-[var(--text-secondary)] font-mono block truncate max-w-[200px]">{approval.requested_by_user?.email || 'System'}</span>
                        <span className="text-[var(--text-secondary)] text-[9px] block mt-0.5">{new Date(approval.created_at).toLocaleDateString()}</span>
                      </div>
                    </div>

                    {/* Step 2: System Evaluation */}
                    <div className="flex gap-3 items-start relative">
                      <div className="absolute left-2.5 top-5 bottom-0 w-0.5 bg-[var(--surface-glass)]" />
                      <div className="w-5 h-5 rounded-full bg-indigo-500/10 border border-indigo-500/35 flex items-center justify-center shrink-0 mt-0.5">
                        <span className="w-1.5 h-1.5 rounded-full bg-indigo-400" />
                      </div>
                      <div className="text-xs">
                        <span className="block text-[var(--text-secondary)] text-[9px] uppercase font-mono tracking-wider">Security Check</span>
                        <span className="text-emerald-400/80 font-mono block">Compliant</span>
                      </div>
                    </div>

                    {/* Step 3: Executive Review */}
                    <div className="flex gap-3 items-start">
                      <div className={`w-5 h-5 rounded-full flex items-center justify-center shrink-0 mt-0.5 border ${
                        approval.decision === 'Pending' 
                          ? 'bg-amber-500/10 border-amber-500/35' 
                          : approval.decision === 'Rejected' 
                          ? 'bg-rose-500/10 border-rose-500/35'
                          : 'bg-emerald-500/10 border-emerald-500/35'
                      }`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${
                          approval.decision === 'Pending' 
                            ? 'bg-amber-400 animate-pulse' 
                            : approval.decision === 'Rejected' 
                            ? 'bg-rose-400'
                            : 'bg-emerald-400'
                        }`} />
                      </div>
                      <div className="text-xs">
                        <span className="block text-[var(--text-secondary)] text-[9px] uppercase font-mono tracking-wider">Executive Review</span>
                        {approval.decision === 'Pending' ? (
                          <span className="text-amber-400 font-mono">Awaiting Decision</span>
                        ) : (
                          <div>
                            <span className="text-[var(--text-secondary)] font-mono block truncate max-w-[200px]">Audited by {approval.approved_by_user?.email || 'Authorized Role'}</span>
                            {approval.note && (
                              <p className="text-[10px] text-[var(--text-secondary)] bg-[var(--surface-glass)] p-2 rounded border border-[var(--border-soft)] mt-1.5 italic max-w-full truncate" title={approval.note}>{approval.note}</p>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Review Action */}
                {filter === 'needs_me' && (
                  <div className="mt-6 pt-4 border-t border-[var(--border-soft)]">
                    <button 
                      onClick={() => setSelectedApproval(approval)} 
                      className="w-full py-2 bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-300 border border-indigo-500/25 text-xs font-bold uppercase tracking-wider rounded-xl transition-all active:scale-95"
                    >
                      Review Document
                    </button>
                  </div>
                )}
                {approval.decision !== 'Pending' && (
                  <div className="mt-6 pt-4 border-t border-[var(--border-soft)] text-[10px] font-mono text-[var(--text-secondary)] uppercase tracking-wider flex justify-between">
                    <span>Source: {approval.approval_source}</span>
                    <span>ID: {approval.id.substring(0, 8)}</span>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
      
      {selectedApproval && (
        <ApprovalDecisionModal 
          approval={selectedApproval} 
          onClose={() => setSelectedApproval(null)}
          onUpdate={fetchApprovals}
        />
      )}
    </div>
  );
}
