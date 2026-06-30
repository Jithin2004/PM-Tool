import React, { useState, useEffect } from 'react';
import { Shield, Key, Building2, Server, Users } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useWorkspace } from '../../context/WorkspaceContext';
import { getLicenseInfo, clearLicense, validateWorkspaceLicenseUpdate } from '../../lib/productKey';
import { getWorkspaceDisplayName } from '../../lib/workspaceDisplayName';
import { supabase } from '../../lib/supabase';
import { sha256 } from '../../utils/cryptoUtils';

export function BillingSettings() {
  const { workspace } = useWorkspace();
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [dbLicense, setDbLicense] = useState<any>(null);
  const [showUpdateModal, setShowUpdateModal] = useState(false);
  const [newKey, setNewKey] = useState('');
  const [verifyingNewKey, setVerifyingNewKey] = useState(false);
  const [keyError, setKeyError] = useState('');
  const [activeUsersCount, setActiveUsersCount] = useState(0);
  const [isVerifying, setIsVerifying] = useState(true);
  const [serverLicenseData, setServerLicenseData] = useState<any>(null);
  const license = getLicenseInfo();

  useEffect(() => {
    async function fetchStats() {
      if (workspace?.id) {
        const { count } = await supabase
          .from('users')
          .select('*', { count: 'exact', head: true })
          .eq('workspace_id', workspace.id);

        setActiveUsersCount(count || 0);

        const { data: licenseData } = await supabase
          .from('workspace_license')
          .select('*')
          .eq('workspace_id', workspace.id)
          .maybeSingle();

        if (licenseData) {
          setDbLicense(licenseData);
        }
      }
    }

    async function verifyLicenseOnline() {
      if (!license?.token) {
        setIsVerifying(false);
        return;
      }
      // Use same API base as productKey.ts activation flow
      const API_URL = import.meta.env.VITE_PRODUCT_KEY_API_URL || 'https://pm-tool-server.onrender.com';

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
        }
        // Don't set verifyError — server being unavailable doesn't invalidate a locally stored license
      } catch (err) {
        console.error('License verification (supplementary) failed:', err);
        // Don't set verifyError — local license data is the source of truth
      } finally {
        setIsVerifying(false);
      }
    }

    fetchStats();
    verifyLicenseOnline();
  }, [workspace?.id, license?.token]);

  const handleUpdateLicense = () => {
    setShowUpdateModal(true);
  };

  const submitNewLicense = async () => {
    if (!newKey.trim() || !workspace?.id) return;
    setVerifyingNewKey(true);
    setKeyError('');

    try {
      const verifyRes = await validateWorkspaceLicenseUpdate(newKey.trim(), workspace.id);

      if (!verifyRes.success) {
        throw new Error(verifyRes.error || 'Invalid or expired license key.');
      }

      // Upsert workspace_license
      const rawPlan = (verifyRes.plan || '').toLowerCase();
      const planType = rawPlan === 'enterprise' ? 'enterprise' : rawPlan === 'premium' ? 'premium' : 'standard';

      const hashedKey = await sha256(newKey.trim());

      const { error: dbError } = await supabase
        .from('workspace_license')
        .upsert({
          workspace_id: workspace.id,
          license_key_hash: hashedKey,
          allowed_users: 9999,
          license_type: planType,
          activation_date: new Date().toISOString(),
          support_until: verifyRes.licenseData?.supportExpiry ? new Date(verifyRes.licenseData.supportExpiry).toISOString() : null
        }, { onConflict: 'workspace_id' });

      if (dbError) throw new Error('Failed to attach license to workspace.');

      window.location.reload();

    } catch (err: any) {
      setKeyError(err.message || 'License validation failed.');
    } finally {
      setVerifyingNewKey(false);
    }
  };

  // Local DB license data is the source of truth.
  // serverLicenseData is supplementary enrichment from the /verify endpoint.
  const isActive = dbLicense
    ? (!!dbLicense.workspace_id && !!dbLicense.activation_date)
    : license?.status === 'Activated';
  const isExpired = dbLicense?.support_until
    ? (new Date(dbLicense.support_until).getTime() < Date.now())
    : license?.status === 'Expired Support';

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
    if (isExpired) {
      displayStatus = 'EXPIRED SUPPORT';
      statusColor = 'text-amber-400';
      statusBg = 'bg-amber-500/10 border-amber-500/20';
      statusDot = 'bg-amber-400';
    } else {
      displayStatus = 'ACTIVE';
      statusColor = 'text-emerald-400';
      statusBg = 'bg-emerald-500/10 border-emerald-500/20';
      statusDot = 'bg-emerald-400';
    }
  } else if (isExpired) {
    displayStatus = 'EXPIRED SUPPORT';
    statusColor = 'text-amber-400';
    statusBg = 'bg-amber-500/10 border-amber-500/20';
    statusDot = 'bg-amber-400';
  }

  const planName = dbLicense?.license_type || dbLicense?.plan || serverLicenseData?.plan || license?.plan || 'Enterprise';
  const maxSeats = dbLicense?.allowed_users || dbLicense?.max_seats || serverLicenseData?.seats || '';
  const productKeyId = dbLicense?.license_key_hash || dbLicense?.id || serverLicenseData?.keyId || license?.productKey || license?.purchaseId || 'Unlicensed';
  const isSandbox = workspace?.environment === 'sandbox';
  const displayWorkspaceName = getWorkspaceDisplayName(workspace?.name, !!isSandbox);

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
                <p className="text-sm font-bold text-[var(--pm-text)]">{displayWorkspaceName || 'Workspace'}</p>
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
                <span className="text-sm font-medium text-[var(--pm-text)]">{dbLicense?.created_at ? new Date(dbLicense.created_at).toLocaleDateString() : (license?.verifiedAt ? new Date(license.verifiedAt).toLocaleDateString() : 'N/A')}</span>
              </div>
              <div className="flex justify-between items-center py-2 border-b border-[var(--pm-border)] gap-4">
                <span className="text-sm text-[var(--pm-text-secondary)] shrink-0">Support Coverage</span>
                <span className={`text-sm font-medium ${isExpired ? 'text-red-400' : 'text-indigo-500'} truncate`}>
                  {dbLicense?.support_until 
                    ? `Until ${new Date(dbLicense.support_until).toLocaleDateString()}` 
                    : (license?.supportExpiry ? `Until ${new Date(license.supportExpiry).toLocaleDateString()}` : 'Lifetime')}
                </span>
              </div>
              <div className="flex justify-between items-center py-2 border-b border-[var(--pm-border)] gap-4">
                <span className="text-sm text-[var(--pm-text-secondary)] shrink-0">License Key ID</span>
                <span className="text-sm font-mono text-[var(--pm-text)] truncate" title={productKeyId}>{productKeyId}</span>
              </div>
            </div>
          </div>

          <div className="flex flex-col gap-4 justify-center">
            <button
              onClick={handleUpdateLicense}
              className="flex items-center justify-center gap-2 w-full py-3 rounded-xl text-sm font-bold uppercase tracking-wider bg-indigo-500 text-white hover:bg-indigo-600 transition-colors shadow-sm"
            >
              <Key className="w-4 h-4" />
              Update License Key
            </button>
          </div>
        </div>
      </div>

      {showUpdateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
          <div className="bg-[var(--pm-surface)] border border-[var(--pm-border)] rounded-2xl p-6 sm:p-8 shadow-2xl max-w-md w-full animate-in zoom-in-95 duration-200">
            <h3 className="text-xl font-bold text-[var(--pm-text)] mb-2 flex items-center gap-2">
              <Key className="w-5 h-5 text-indigo-500" />
              Update Workspace License
            </h3>
            <p className="text-sm text-[var(--pm-text-secondary)] mb-6">
              Enter a new product key to upgrade or refresh your workspace's license tier.
            </p>

            <input
              type="text"
              value={newKey}
              onChange={e => setNewKey(e.target.value)}
              placeholder="XXXX-XXXX-XXXX-XXXX"
              className="w-full bg-black/30 border border-[var(--pm-border)] rounded-xl h-12 px-4 text-sm font-mono text-white outline-none focus:border-indigo-500/50 mb-4"
              autoFocus
            />

            {keyError && (
              <div className="p-3 bg-red-500/10 border border-red-500/20 text-red-400 rounded-lg text-xs mb-4">
                {keyError}
              </div>
            )}

            <div className="flex items-center justify-end gap-3">
              <button
                onClick={() => setShowUpdateModal(false)}
                className="px-4 py-2 text-sm font-medium text-[var(--pm-text-secondary)] hover:text-[var(--pm-text)] transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={submitNewLicense}
                disabled={verifyingNewKey || !newKey.trim()}
                className="px-6 py-2 bg-indigo-500 hover:bg-indigo-600 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-bold tracking-wider uppercase rounded-lg transition-colors"
              >
                {verifyingNewKey ? 'Validating...' : 'Apply License'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

