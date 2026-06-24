import React, { useState } from 'react';
import { ShieldCheck, CheckCircle, AlertCircle, FileSignature, Clock, Building2 } from 'lucide-react';
import { PremiumEmptyState } from '../../components/ui/PremiumEmptyState';

export default function ApprovalsPage() {
  const [activeTab, setActiveTab] = useState<'pending' | 'history'>('pending');

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
          { id: 'pending', label: 'Pending Approvals' },
          { id: 'history', label: 'Approval History' }
        ].map(tab => (
          <button 
            key={tab.id}
            onClick={() => setActiveTab(tab.id as 'pending' | 'history')}
            className={`pb-3 text-sm font-semibold uppercase tracking-wider transition-all relative ${activeTab === tab.id ? 'text-indigo-400 border-b-2 border-indigo-400' : 'text-[var(--text-secondary)] hover:text-white'}`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* View */}
      <div className="flex-1 overflow-y-auto pr-2 pb-12">
        <div className="premium-panel rounded-2xl p-12 text-center border border-[var(--border-soft)] flex flex-col items-center justify-center min-h-[400px]">
          <FileSignature className="w-12 h-12 text-indigo-400 mb-4" />
          <h3 className="text-xl font-bold text-white mb-2">Secure Approval Engine</h3>
          <p className="text-sm text-[var(--text-secondary)] mb-6 max-w-md">
            The Approval Center provides centralized governance for access requests, budget expansions, and policy overrides. This system strictly governs permissions distinct from standard project decisions.
          </p>
          <div className="flex items-center justify-center gap-4 text-[10px] uppercase font-mono-pm text-[var(--text-secondary)] tracking-widest bg-black/20 px-6 py-3 rounded-xl border border-[var(--border-soft)]">
            <span className="flex items-center gap-1"><CheckCircle className="w-3 h-3 text-emerald-400"/> Cryptographically Logged</span>
            <span className="flex items-center gap-1"><Clock className="w-3 h-3 text-amber-400"/> SLA Monitored</span>
          </div>
        </div>
      </div>
    </div>
  );
}
