import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { useWorkspace } from '../../context/WorkspaceContext';
import { useAuth } from '../../context/AuthContext';
import { Icon } from '../../components/ui/Icon';
import { ApprovalDecisionModal } from './ApprovalDecisionModal';

export default function ApprovalsPage() {
  const { workspace } = useWorkspace();
  const { profile } = useAuth();
  const [approvals, setApprovals] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'needs_me' | 'requested_by_me' | 'completed'>('needs_me');
  const [selectedApproval, setSelectedApproval] = useState<any | null>(null);

  const fetchApprovals = async () => {
    if (!workspace?.id || !profile?.id) return;
    setLoading(true);
    
    let query = supabase.from('universal_approvals').select('*, requested_by_user:users!requested_by(email), approved_by_user:users!approved_by(email)').eq('workspace_id', workspace.id);
    
    if (filter === 'needs_me') {
      // Typically, there's logic indicating WHO it's assigned to.
      // For now, if we are simulating this, we might fetch all Pending or those assigned to me if there's an 'assigned_to' column.
      // The schema only has requested_by, approved_by. We'll show all Pending if user has permission, or ones lacking approved_by.
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
    setLoading(false);
  };

  useEffect(() => {
    fetchApprovals();
  }, [workspace?.id, profile?.id, filter]);

  return (
    <div className="flex-1 flex flex-col h-full bg-[#111827] text-white overflow-hidden">
      <div className="flex-none p-6 border-b border-white/10">
        <h1 className="text-2xl font-bold">Approval Center</h1>
        <p className="text-sm text-gray-400 mt-1">Review, approve, and track universal entity approvals.</p>
        
        <div className="mt-6 flex gap-2">
          {['needs_me', 'requested_by_me', 'completed'].map(f => (
            <button
              key={f}
              onClick={() => setFilter(f as any)}
              className={`px-4 py-2 rounded-lg text-sm font-medium capitalize transition-colors ${filter === f ? 'bg-white/10 text-white' : 'text-gray-400 hover:text-white hover:bg-white/5'}`}
            >
              {f.replace(/_/g, ' ')}
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 p-6 overflow-y-auto">
        {loading ? (
          <div className="flex items-center justify-center h-full">
            <div className="animate-spin w-8 h-8 border-2 border-indigo-500 border-t-transparent rounded-full" />
          </div>
        ) : approvals.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-gray-400">
            <Icon name="verified" size={48} className="mb-4 opacity-50" />
            <p>You're all caught up! No pending approvals found.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {approvals.map(approval => (
              <div 
                key={approval.id} 
                className="bg-white/5 border border-white/10 rounded-xl p-5 hover:bg-white/10 transition-colors flex flex-col"
              >
                <div className="flex items-start justify-between mb-3">
                  <span className="text-[10px] uppercase tracking-wider font-mono px-2 py-1 bg-indigo-500/20 text-indigo-300 rounded">
                    {approval.entity_type}
                  </span>
                  <span className={`text-[10px] uppercase tracking-wider px-2 py-1 rounded
                    ${approval.decision === 'Approved' || approval.decision === 'Overridden' ? 'bg-emerald-500/20 text-emerald-400' :
                      approval.decision === 'Rejected' ? 'bg-red-500/20 text-red-400' : 'bg-amber-500/20 text-amber-400'}`}>
                    {approval.decision}
                  </span>
                </div>
                <div className="flex-1 space-y-3 mt-2">
                  <div className="flex items-center gap-2 text-sm text-gray-300">
                    <Icon name="person" size={16} className="text-gray-500" />
                    <span className="truncate">{approval.requested_by_user?.email || 'System'}</span>
                  </div>
                  <div className="flex items-center gap-2 text-xs text-gray-500">
                    <Icon name="calendar_today" size={14} />
                    {new Date(approval.created_at).toLocaleDateString()}
                  </div>
                </div>
                
                {filter === 'needs_me' && (
                  <div className="mt-4 pt-4 border-t border-white/10 flex gap-2">
                    <button onClick={() => setSelectedApproval(approval)} className="flex-1 px-3 py-2 bg-indigo-500 hover:bg-indigo-600 text-white text-xs font-medium rounded-lg transition-colors">
                      Review Request
                    </button>
                  </div>
                )}
                {approval.decision !== 'Pending' && (
                  <div className="mt-4 pt-4 border-t border-white/10 text-xs text-gray-400">
                    Handled via {approval.approval_source}
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
