import React, { useEffect, useState, useMemo } from 'react';
import { useWorkspace } from '../../context/WorkspaceContext';
import { ShieldAlert, CheckCircle2, Circle } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { getLicenseInfo } from '../../lib/productKey';

export function WorkspaceReadiness() {
  const { workspace } = useWorkspace();
  const [licenseData, setLicenseData] = useState<any>(null);

  useEffect(() => {
    if (workspace?.id) {
      supabase.from('workspace_license').select('*').eq('workspace_id', workspace.id).maybeSingle().then(({ data }) => {
        setLicenseData(data);
      });
    }
  }, [workspace?.id]);

  const checks = useMemo(() => {
    if (!workspace) return [];
    
    let companyName = '';
    let country = '';
    let baseCurrency = '';
    let passwordPolicy = '';
    let autoArchive = false;

    if (workspace.settings) {
      companyName = workspace.settings.companyName || '';
      country = workspace.settings.country || '';
      baseCurrency = workspace.settings.baseCurrency || '';
      passwordPolicy = workspace.settings.passwordPolicy || '';
      autoArchive = workspace.settings.auto_archive ?? true;
    }

    const localLicense = getLicenseInfo();
    const isSandboxMode = localStorage.getItem('resolve-sandbox-mode') === 'true';
    
    let licenseStateText = 'License requires attention';
    let licenseValid = false;

    if (isSandboxMode) {
      licenseStateText = 'Sandbox active';
      licenseValid = true;
    } else if (localLicense?.plan === 'Trial' || licenseData?.license_type === 'Trial') {
      licenseStateText = 'Trial workspace active';
      licenseValid = true;
    } else if (localLicense?.status === 'Invalid' && localLicense?.error === 'License belongs to another workspace') {
      licenseStateText = 'License belongs to another workspace';
      licenseValid = false;
    } else if (licenseData?.activation_date || localLicense?.status === 'Activated') {
      const isExpired = licenseData?.support_until ? (new Date(licenseData.support_until).getTime() < Date.now()) : (localLicense?.status === 'Expired Support');
      if (isExpired) {
        licenseStateText = 'License requires renewal';
        licenseValid = false;
      } else {
        licenseStateText = 'License verified';
        licenseValid = true;
      }
    }

    return [
      { id: 'company', label: 'Company profile', done: !!companyName },
      { id: 'location', label: 'Configure company location', done: !!country },
      { id: 'currency', label: 'Set base currency', done: !!baseCurrency },
      { id: 'security', label: 'Configure security policy', done: !!passwordPolicy },
      { id: 'backup', label: 'Configure backup policy', done: !!autoArchive },
      { id: 'license', label: `Verify production license (${licenseStateText})`, done: licenseValid }
    ];
  }, [workspace, licenseData]);

  const allDone = checks.every(c => c.done);

  if (allDone) return null;

  return (
    <div className="bg-surface/40 backdrop-blur-md border border-border/50 rounded-2xl p-6 mb-8 transition-all duration-300">
      <div className="flex items-center gap-3 mb-4 p-4 bg-signal-warning/10 border border-signal-warning/20 rounded-xl">
        <div className="text-signal-warning">
          <ShieldAlert className="w-5 h-5" />
        </div>
        <div>
          <h3 className="text-sm font-bold text-signal-warning">Complete Workspace Setup</h3>
          <p className="text-xs text-signal-warning/80">Finish recommended configuration before scaling your workspace.</p>
        </div>
      </div>
      
      <div className="space-y-3 mt-4 ml-2">
        {checks.map(check => (
          <div key={check.id} className="flex items-center gap-3 py-1">
            {check.done ? (
              <CheckCircle2 className="w-5 h-5 text-signal-safe" />
            ) : (
              <Circle className="w-5 h-5 text-[var(--pm-text-tertiary)]" />
            )}
            <span className={`text-sm font-medium ${check.done ? 'text-[var(--pm-text-secondary)] line-through opacity-70' : 'text-[var(--pm-text)]'}`}>
              {check.label}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
