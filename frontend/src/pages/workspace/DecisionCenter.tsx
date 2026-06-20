import React, { useEffect, useState } from 'react';
import { BrainCircuit, CheckCircle2, Clock, Shield } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useWorkspace } from '../../context/WorkspaceContext';
import { PremiumEmptyState } from '../../components/ui/PremiumEmptyState';

export default function DecisionCenter() {
  const { workspace } = useWorkspace();
  const [approvals, setApprovals] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!workspace?.id) return;
    supabase
      .from('universal_approvals')
      .select('*')
      .eq('workspace_id', workspace.id)
      .order('created_at', { ascending: false })
      .limit(20)
      .then(({ data, error }) => {
        setApprovals(data || []);
      })
      .finally(() => {
        setLoading(false);
      });
  }, [workspace?.id]);

  const pendingCount = approvals.filter(a => a.status === 'pending').length;
  const resolvedCount = approvals.filter(a => a.status === 'approved' || a.status === 'rejected').length;

  return (
    <div className="space-y-8 pb-16 font-geist text-[var(--pm-primary)]" style={{ color: 'var(--pm-on-surface)' }}>
      {/* Header */}
      <div className="flex items-end justify-between px-1 pt-2">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight" style={{ color: 'var(--pm-on-surface)' }}>
            Decision Center
          </h1>
          <p className="text-sm mt-1" style={{ color: 'var(--pm-on-surface-variant)' }}>
            Governance, Approvals, Escalations, and Executive Decisions.
          </p>
        </div>
        <div className="flex items-center gap-3 px-4 py-1.5 rounded-full border border-border bg-surface-2"
          style={{ background: 'var(--pm-surface-highest)', borderColor: 'rgba(70,69,84,0.3)' }}>
          <span className="w-1.5 h-1.5 rounded-full bg-teal-400 operational-pulse" style={{ boxShadow: '0 0 8px rgba(45,212,191,0.5)' }} />
          <span className="font-mono-pm text-xs uppercase tracking-widest text-[var(--pm-on-surface-variant)]" style={{ color: 'var(--pm-on-surface-variant)' }}>
             EXECUTIVE PIPELINE
          </span>
        </div>
      </div>

      {/* KPI metrics bar */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-5">
        {[
          { label: 'Pending Approvals', value: loading ? '—' : pendingCount, sub: 'Awaiting Sign-off', icon: <CheckCircle2 size={20} />, color: 'var(--pm-primary)' },
          { label: 'Resolved Decisions', value: loading ? '—' : resolvedCount, sub: 'Total resolved', icon: <BrainCircuit size={20} />, color: '#34d399' },
          { label: 'Total Requests', value: loading ? '—' : approvals.length, sub: 'All time', icon: <Shield size={20} />, color: '#60a5fa' },
          { label: 'Avg Resolution Time', value: 'Tracked', sub: 'From initiation to approval', icon: <Clock size={20} />, color: '#a78bfa' }
        ].map((kpi, i) => (
          <div key={i} className="pm-card p-5 relative overflow-hidden group">
            <div className="flex items-center justify-between mb-4">
              <div className="w-10 h-10 rounded-xl flex items-center justify-center"
                style={{ background: `${kpi.color}18`, border: `1px solid ${kpi.color}30`, color: kpi.color }}>
                {kpi.icon}
              </div>
              <span className="font-mono-pm text-[9px] uppercase tracking-[0.2em]" style={{ color: 'var(--pm-on-surface-variant)', opacity: 0.6 }}>LIVE</span>
            </div>
            <div className="text-3xl font-bold tracking-tight" style={{ color: kpi.color }}>{kpi.value}</div>
            <div className="text-[11px] font-semibold mt-1 mb-0.5" style={{ color: 'var(--pm-on-surface)' }}>{kpi.label}</div>
            <div className="font-mono-pm text-[10px]" style={{ color: 'var(--pm-on-surface-variant)', opacity: 0.6 }}>{kpi.sub}</div>
          </div>
        ))}
      </div>

      {/* Decision Pipeline */}
      <div className="glass-panel rounded-xl p-6 bg-surface-2 border border-border">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-base font-semibold text-[var(--pm-primary)]">Decision Pipeline</h2>
        </div>

        {loading ? (
          <div className="flex items-center justify-center h-24">
            <div className="w-5 h-5 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : approvals.filter(a => a.status === 'pending').length === 0 ? (
          <PremiumEmptyState
            icon={CheckCircle2}
            title="No Pending Decisions"
            description="All decisions are resolved. New approval requests will appear here."
          />
        ) : (
          <div className="space-y-4">
            {approvals.filter(a => a.status === 'pending').map(approval => (
              <div key={approval.id} className="flex flex-col md:flex-row md:items-center justify-between p-4 rounded-xl gap-4"
                style={{ background: 'var(--pm-surface-high)', borderColor: 'rgba(70,69,84,0.3)', border: '1px solid' }}>
                <div className="space-y-1.5 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold" style={{ color: 'var(--pm-on-surface)' }}>
                      {approval.type === 'risk_escalation' ? `Escalation: ${approval.metadata?.escalationType || 'Unknown Risk'}` : approval.type}
                    </span>
                    <span className="text-[9px] px-1.5 py-0.5 rounded uppercase font-mono-pm bg-amber-500/10 text-amber-400 border border-amber-500/20">PENDING</span>
                  </div>
                  {approval.type === 'risk_escalation' && approval.metadata?.message && (
                    <div className="text-xs text-text-secondary mt-1">
                      {approval.metadata.message}
                    </div>
                  )}
                  <div className="font-mono-pm text-[11px] text-[var(--pm-on-surface-variant)] mt-1">
                    Submitted: {new Date(approval.created_at).toLocaleDateString()}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button className="px-3 py-1.5 bg-signal-safe/10 text-signal-safe hover:bg-signal-safe/20 border border-signal-safe/20 rounded font-bold text-xs uppercase tracking-wider">Acknowledge</button>
                  <button className="px-3 py-1.5 bg-signal-critical/10 text-signal-critical hover:bg-signal-critical/20 border border-signal-critical/20 rounded font-bold text-xs uppercase tracking-wider">Reject</button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}


