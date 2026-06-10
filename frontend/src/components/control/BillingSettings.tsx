import React, { useState } from 'react';
import { Shield, Key, Download, Building2, Server } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';

import { useWorkspace } from '../../context/WorkspaceContext';
import { getLicenseInfo } from '../../lib/productKey';

export function BillingSettings() {
  const { workspace } = useWorkspace();
  const [isRefreshing, setIsRefreshing] = useState(false);

  const handleRefresh = () => {
    setIsRefreshing(true);
    setTimeout(() => setIsRefreshing(false), 1500);
  };

  const license = getLicenseInfo();
  const isActive = license?.status === 'Activated';
  const isExpired = license?.status === 'Expired Support';
  
  const statusColor = isActive ? 'text-emerald-400' : isExpired ? 'text-amber-400' : 'text-red-400';
  const statusBg = isActive ? 'bg-emerald-500/10 border-emerald-500/20' : isExpired ? 'bg-amber-500/10 border-amber-500/20' : 'bg-red-500/10 border-red-500/20';
  const statusDot = isActive ? 'bg-emerald-400' : isExpired ? 'bg-amber-400' : 'bg-red-400';

  return (
    <div className="space-y-8">
      <div className="premium-panel border border-[var(--border-soft)] rounded-2xl p-6 sm:p-8 bg-surface-2">
        <div className="flex items-center justify-between mb-8 pb-6 border-b border-border">
          <div>
            <h3 className="text-xl font-bold text-white flex items-center gap-2">
              <Shield className="w-5 h-5 text-emerald-400" />
              Resolve PM Enterprise License
            </h3>
            <p className="text-sm text-[var(--text-secondary)] mt-1">
              On-premise / Private Cloud operating system license details.
            </p>
          </div>
          <div className={`px-4 py-2 ${statusBg} border rounded-lg flex items-center gap-2`}>
            <span className={`w-2 h-2 rounded-full ${statusDot} ${isActive ? 'animate-pulse' : ''}`} />
            <span className={`text-xs font-bold ${statusColor} uppercase tracking-wider`}>{license?.status || 'Unactivated'}</span>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          <div className="p-5 rounded-xl border border-[var(--border-soft)] bg-surface flex flex-col">
            <span className="text-xs text-[var(--text-secondary)] uppercase tracking-wider font-mono mb-2">Company Identity</span>
            <div className="flex items-center gap-3">
              <Building2 className="w-8 h-8 text-indigo-400" />
              <div>
                <p className="text-sm font-bold text-white">{license?.companyName || workspace?.name || 'Enterprise Workspace'}</p>
                <p className="text-xs text-[var(--text-tertiary)]">Purchased: Resolve PM Enterprise</p>
              </div>
            </div>
          </div>

          <div className="p-5 rounded-xl border border-[var(--border-soft)] bg-surface flex flex-col">
            <span className="text-xs text-[var(--text-secondary)] uppercase tracking-wider font-mono mb-2">System Version</span>
            <div className="flex items-center gap-3">
              <Server className="w-8 h-8 text-blue-400" />
              <div>
                <p className="text-sm font-bold text-white">v1.0.0 (LTS)</p>
                <p className="text-xs text-[var(--text-tertiary)]">Private Cloud Instance</p>
              </div>
            </div>
          </div>

          <div className="p-5 rounded-xl border border-[var(--border-soft)] bg-surface flex flex-col">
            <span className="text-xs text-[var(--text-secondary)] uppercase tracking-wider font-mono mb-2">Capacity Utilization</span>
            <div className="flex flex-col gap-2 mt-1">
              <div className="flex justify-between items-end">
                <span className="text-xl font-bold text-white">Unlimited</span>
                <span className="text-xs text-[var(--text-tertiary)] mb-1">Licensed Team Members</span>
              </div>
              <div className="w-full h-1.5 bg-surface-3 rounded-full overflow-hidden">
                <div className="h-full bg-indigo-500 rounded-full" style={{ width: '100%' }} />
              </div>
            </div>
          </div>
        </div>

        <div className="mt-8 grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="p-6 rounded-xl border border-[var(--border-soft)] bg-surface-3/30">
            <h4 className="text-sm font-bold text-white mb-4 uppercase tracking-wider font-mono">Product Key Architecture</h4>
            <div className="space-y-4">
              <div className="flex justify-between items-center py-2 border-b border-border-subtle">
                <span className="text-sm text-[var(--text-secondary)]">Status</span>
                <span className={`text-sm font-medium ${statusColor}`}>{license?.status || 'Unknown'}</span>
              </div>
              <div className="flex justify-between items-center py-2 border-b border-border-subtle">
                <span className="text-sm text-[var(--text-secondary)]">Activated</span>
                <span className="text-sm font-medium text-white">{license?.verifiedAt ? new Date(license.verifiedAt).toLocaleDateString() : 'N/A'}</span>
              </div>
              <div className="flex justify-between items-center py-2 border-b border-border-subtle">
                <span className="text-sm text-[var(--text-secondary)]">Support Coverage</span>
                <span className={`text-sm font-medium ${isExpired ? 'text-red-400' : 'text-indigo-400'}`}>
                  {license?.supportExpiry ? `Until ${new Date(license.supportExpiry).toLocaleDateString()}` : 'N/A'}
                </span>
              </div>
              <div className="flex justify-between items-center py-2 border-b border-border-subtle">
                <span className="text-sm text-[var(--text-secondary)]">Purchase ID</span>
                <span className="text-sm font-mono text-white">{license?.purchaseId || 'N/A'}</span>
              </div>
            </div>
          </div>

          <div className="flex flex-col gap-4 justify-center">
            <button 
              onClick={handleRefresh}
              className="flex items-center justify-center gap-2 w-full py-3 rounded-xl text-sm font-bold uppercase tracking-wider bg-indigo-500 text-white hover:bg-indigo-600 transition-colors shadow-lg"
            >
              <Key className="w-4 h-4" />
              {isRefreshing ? 'Verifying...' : 'Update License Key'}
            </button>
            <button className="flex items-center justify-center gap-2 w-full py-3 rounded-xl text-sm font-bold uppercase tracking-wider bg-surface-3 text-[var(--text-secondary)] hover:text-white hover:bg-surface-4 transition-colors">
              <Shield className="w-4 h-4" />
              Download Audit Certificate
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
