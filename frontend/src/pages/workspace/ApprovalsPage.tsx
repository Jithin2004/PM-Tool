import React, { useState, useEffect } from 'react';
import { ShieldCheck, CheckCircle, AlertCircle, FileSignature, Clock, XCircle, Loader2, Building2 } from 'lucide-react';
import { fetchApprovalInstances, approveStep, rejectStep, ApprovalInstance } from '../../services/approvalService';
import { useWorkspace } from '../../context/WorkspaceContext';
import { useAuth } from '../../context/AuthContext';
import { PremiumEmptyState } from '../../components/ui/PremiumEmptyState';

export default function ApprovalsPage() {
  const [activeTab, setActiveTab] = useState<'pending' | 'history'>('pending');
  const [instances, setInstances] = useState<ApprovalInstance[]>([]);
  const [loading, setLoading] = useState(true);
  const [processingId, setProcessingId] = useState<string | null>(null);

  const { workspace } = useWorkspace();
  const { profile } = useAuth();

  useEffect(() => {
    loadApprovals();
  }, [workspace?.id]);

  const loadApprovals = async () => {
    if (!workspace?.id) return;
    setLoading(true);
    const data = await fetchApprovalInstances(workspace.id);
    setInstances(data);
    setLoading(false);
  };

  const handleApprove = async (instance: ApprovalInstance) => {
    if (!profile?.id) return;
    setProcessingId(instance.id);
    await approveStep(instance.id, instance.current_step, profile.id);
    await loadApprovals();
    setProcessingId(null);
  };

  const handleReject = async (instance: ApprovalInstance) => {
    if (!profile?.id) return;
    setProcessingId(instance.id);
    await rejectStep(instance.id, instance.current_step, profile.id);
    await loadApprovals();
    setProcessingId(null);
  };

  const pendingInstances = instances.filter(i => i.status === 'pending');
  const historyInstances = instances.filter(i => i.status !== 'pending');

  const displayList = activeTab === 'pending' ? pendingInstances : historyInstances;

  return (
    <div className="flex flex-col gap-6 font-geist text-[var(--pm-on-surface)] h-full">
      {/* Header */}
      <div className="flex items-end justify-between px-1 pt-2 border-b border-[var(--border-soft)] pb-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-white flex items-center gap-2">
            <ShieldCheck className="text-indigo-500 w-6 h-6" />
            Approval Center
          </h1>
          <p className="text-sm mt-1 text-[var(--text-secondary)]">
            Manage operational, financial, and access requests distinct from strategic decisions.
          </p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-6 border-b border-[var(--border-soft)] mb-2 px-1">
        {[
          { id: 'pending', label: 'Pending Approvals', count: pendingInstances.length },
          { id: 'history', label: 'Approval History' }
        ].map(tab => (
          <button 
            key={tab.id}
            onClick={() => setActiveTab(tab.id as 'pending' | 'history')}
            className={`pb-3 text-sm font-semibold uppercase tracking-wider transition-all relative flex items-center gap-2 ${activeTab === tab.id ? 'text-indigo-400 border-b-2 border-indigo-400' : 'text-[var(--text-secondary)] hover:text-white'}`}
          >
            {tab.label}
            {tab.count !== undefined && tab.count > 0 && (
              <span className="bg-indigo-500/20 text-indigo-400 text-[10px] px-1.5 py-0.5 rounded-full">
                {tab.count}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* View */}
      <div className="flex-1 overflow-y-auto pr-2 pb-12">
        {loading ? (
          <div className="flex items-center justify-center h-40">
            <Loader2 className="w-6 h-6 text-indigo-500 animate-spin" />
          </div>
        ) : displayList.length === 0 ? (
          <PremiumEmptyState 
            icon={FileSignature}
            title={activeTab === 'pending' ? "No pending approvals" : "No approval history"}
            description={activeTab === 'pending' 
              ? "All caught up! There are no operational or access requests waiting for your approval right now." 
              : "No historical approvals found in this workspace."}
          />
        ) : (
          <div className="space-y-4">
            {displayList.map(instance => (
              <div key={instance.id} className="bg-[var(--surface-elevated)] border border-[var(--border-soft)] rounded-xl p-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <h3 className="font-semibold text-white">{instance.chain_name || 'Workflow Request'}</h3>
                    <span className={`text-[10px] uppercase font-bold px-2 py-0.5 rounded tracking-wider ${
                      instance.status === 'pending' ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20' :
                      instance.status === 'approved' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' :
                      'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                    }`}>
                      {instance.status}
                    </span>
                  </div>
                  <div className="text-sm text-[var(--text-secondary)] flex items-center gap-3">
                    <span className="flex items-center gap-1"><Building2 className="w-3.5 h-3.5" /> {instance.target_type}</span>
                    <span className="text-[var(--border-strong)]">|</span>
                    <span className="flex items-center gap-1"><Clock className="w-3.5 h-3.5" /> Step {instance.current_step}</span>
                  </div>
                </div>

                {activeTab === 'pending' && (
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleReject(instance)}
                      disabled={processingId === instance.id}
                      className="px-4 py-2 bg-[var(--surface-glass)] hover:bg-rose-500/10 text-[var(--text-primary)] hover:text-rose-400 border border-[var(--border-soft)] hover:border-rose-500/30 rounded-lg text-sm font-semibold transition-all disabled:opacity-50 flex items-center gap-1"
                    >
                      {processingId === instance.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <XCircle className="w-4 h-4" />}
                      Reject
                    </button>
                    <button
                      onClick={() => handleApprove(instance)}
                      disabled={processingId === instance.id}
                      className="px-4 py-2 bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-400 border border-indigo-500/20 hover:border-indigo-500/40 rounded-lg text-sm font-semibold transition-all disabled:opacity-50 flex items-center gap-1"
                    >
                      {processingId === instance.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle className="w-4 h-4" />}
                      Approve
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
