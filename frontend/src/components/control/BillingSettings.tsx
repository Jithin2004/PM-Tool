import React, { useState, useEffect } from 'react';
import { Shield, Key, Building2, Server, Users } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useWorkspace } from '../../context/WorkspaceContext';
import { getLicenseInfo, clearLicense } from '../../lib/productKey';
import { supabase } from '../../lib/supabase';

export function BillingSettings() {
  const { workspace } = useWorkspace();
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isVerifying, setIsVerifying] = useState(true);
  const [serverLicenseData, setServerLicenseData] = useState<any>(null);
  const [verifyError, setVerifyError] = useState(false);
  const [activeUsersCount, setActiveUsersCount] = useState<number>(0);
  const license = getLicenseInfo();

  useEffect(() => {
    async function fetchStats() {
      if (workspace?.id) {
        const { count } = await supabase
          .from('users')
          .select('*', { count: 'exact', head: true })
          .eq('workspace_id', workspace.id);
        
        setActiveUsersCount(count || 0);
      }
    }
    
    async function verifyLicenseOnline() {
      if (!license?.token) {
        setIsVerifying(false);
        return;
      }
      const API_URL = import.meta.env.VITE_PRODUCT_KEY_API_URL || 'https://api.resolvepm.com/license';
      
      try {
        const res = await fetch(`${API_URL}/verify`, {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${license.token}`
          }
        });
        if (res.ok) {
          const data = await res.json();
          setServerLicenseData(data);
        } else {
          setVerifyError(true);
        }
      } catch (err) {
        console.error('License verification failed:', err);
        setVerifyError(true);
      } finally {
        setIsVerifying(false);
      }
    }

    fetchStats();
    verifyLicenseOnline();
  }, [workspace?.id, license?.token]);

  const handleUpdateLicense = () => {
    setIsRefreshing(true);
    // Clear license and reload to trigger the app's standard activation flow
    setTimeout(() => {
      clearLicense();
      window.location.href = '/'; 
    }, 500);
  };

  const isActive = license && serverLicenseData && !verifyError;
  const isExpired = license?.status === 'Expired Support';
  
  let displayStatus = 'UNACTIVATED';
  let statusColor = 'text-red-400';
  let statusBg = 'bg-red-500/10 border-red-500/20';
  let statusDot = 'bg-red-400';

  if (isVerifying) {
    displayStatus = 'Checking license...';
    statusColor = 'text-indigo-400';
    statusBg = 'bg-indigo-500/10 border-indigo-500/20';
    statusDot = 'bg-indigo-400';
  } else if (isActive) {
    displayStatus = 'ACTIVE';
    statusColor = 'text-emerald-400';
    statusBg = 'bg-emerald-500/10 border-emerald-500/20';
    statusDot = 'bg-emerald-400';
  } else if (isExpired) {
    displayStatus = 'EXPIRED SUPPORT';
    statusColor = 'text-amber-400';
    statusBg = 'bg-amber-500/10 border-amber-500/20';
    statusDot = 'bg-amber-400';
  } else if (verifyError) {
    displayStatus = 'INVALID';
  }

  const planName = serverLicenseData?.plan || license?.plan || '';
  const maxSeats = serverLicenseData?.seats || '';
  const productKeyId = serverLicenseData?.keyId || license?.productKey || license?.purchaseId || 'Unlicensed';

  return (
    <div className="space-y-8 animate-fade-in font-geist">
      <div className="bg-[var(--pm-surface)] border border-[var(--pm-border)] rounded-2xl p-6 sm:p-8 shadow-sm">
        <div className="flex items-center justify-between mb-8 pb-6 border-b border-[var(--pm-border)]">
          <div>
            <h3 className="text-xl font-bold text-[var(--pm-text)] flex items-center gap-2">
              <Shield className="w-5 h-5 text-indigo-500" />
              Resolve PM License Details
            </h3>
            <p className="text-sm text-[var(--pm-text-secondary)] mt-1 tracking-tight">
              Manage your deployment's license status and workspace coverage.
            </p>
          </div>
          <div className={`px-4 py-2 ${statusBg} border rounded-lg flex items-center gap-2`}>
            <span className={`w-2 h-2 rounded-full ${statusDot} ${isVerifying || isActive ? 'animate-pulse' : ''}`} />
            <span className={`text-xs font-bold ${statusColor} uppercase tracking-wider`}>{displayStatus}</span>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          <div className="p-5 rounded-xl border border-[var(--pm-border)] bg-[var(--pm-surface-elevated)] flex flex-col">
            <span className="text-xs text-[var(--pm-text-secondary)] uppercase tracking-wider font-mono mb-2">Workspace Identity</span>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-indigo-500/10 flex items-center justify-center text-indigo-500">
                <Building2 className="w-5 h-5" />
              </div>
              <div>
                <p className="text-sm font-bold text-[var(--pm-text)]">{workspace?.name || 'Enterprise Workspace'}</p>
              </div>
            </div>
          </div>

          <div className="p-5 rounded-xl border border-[var(--pm-border)] bg-[var(--pm-surface-elevated)] flex flex-col">
            <span className="text-xs text-[var(--pm-text-secondary)] uppercase tracking-wider font-mono mb-2">License Plan</span>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-blue-500/10 flex items-center justify-center text-blue-500">
                <Server className="w-5 h-5" />
              </div>
              <div>
                <p className="text-sm font-bold text-[var(--pm-text)]">{planName || 'N/A'}</p>
                {serverLicenseData?.environment && <p className="text-xs text-[var(--pm-text-tertiary)]">{serverLicenseData.environment}</p>}
              </div>
            </div>
          </div>

          <div className="p-5 rounded-xl border border-[var(--pm-border)] bg-[var(--pm-surface-elevated)] flex flex-col">
            <span className="text-xs text-[var(--pm-text-secondary)] uppercase tracking-wider font-mono mb-2">Active Seats</span>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-emerald-500/10 flex items-center justify-center text-emerald-500">
                <Users className="w-5 h-5" />
              </div>
              <div>
                <p className="text-sm font-bold text-[var(--pm-text)]">{activeUsersCount} {maxSeats && <span className="text-xs text-[var(--pm-text-tertiary)] font-normal">/ {maxSeats}</span>}</p>
                <p className="text-xs text-[var(--pm-text-tertiary)]">Licensed Team Members</p>
              </div>
            </div>
          </div>
        </div>

        <div className="mt-8 grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="p-6 rounded-xl border border-[var(--pm-border)] bg-[var(--pm-surface-elevated)]">
            <h4 className="text-sm font-bold text-[var(--pm-text)] mb-4 uppercase tracking-wider font-mono">License Architecture</h4>
            <div className="space-y-4">
              <div className="flex justify-between items-center py-2 border-b border-[var(--pm-border)]">
                <span className="text-sm text-[var(--pm-text-secondary)]">Status</span>
                <span className={`text-sm font-medium ${statusColor}`}>{displayStatus}</span>
              </div>
              <div className="flex justify-between items-center py-2 border-b border-[var(--pm-border)]">
                <span className="text-sm text-[var(--pm-text-secondary)]">Activated On</span>
                <span className="text-sm font-medium text-[var(--pm-text)]">{license?.verifiedAt ? new Date(license.verifiedAt).toLocaleDateString() : 'N/A'}</span>
              </div>
              <div className="flex justify-between items-center py-2 border-b border-[var(--pm-border)]">
                <span className="text-sm text-[var(--pm-text-secondary)]">Support Coverage</span>
                <span className={`text-sm font-medium ${isExpired ? 'text-red-400' : 'text-indigo-500'}`}>
                  {license?.supportExpiry ? `Until ${new Date(license.supportExpiry).toLocaleDateString()}` : 'N/A'}
                </span>
              </div>
              <div className="flex justify-between items-center py-2 border-b border-[var(--pm-border)]">
                <span className="text-sm text-[var(--pm-text-secondary)]">License Key ID</span>
                <span className="text-sm font-mono text-[var(--pm-text)]">{productKeyId}</span>
              </div>
            </div>
          </div>

          <div className="flex flex-col gap-4 justify-center">
            <button 
              onClick={handleUpdateLicense}
              className="flex items-center justify-center gap-2 w-full py-3 rounded-xl text-sm font-bold uppercase tracking-wider bg-indigo-500 text-white hover:bg-indigo-600 transition-colors shadow-sm"
            >
              <Key className="w-4 h-4" />
              {isRefreshing ? 'Redirecting...' : 'Update License Key'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
