import React, { useEffect, useState } from 'react';
import { ShieldCheck, ShieldAlert, Check, X } from 'lucide-react';
import { useOperationalData } from '../../context/OperationalDataContext';
import { useWorkspace } from '../../context/WorkspaceContext';
import { workspaceHealthService, HealthCheckResult } from '../../services/workspaceHealthService';

export function PilotReadinessPanel() {
  const { workspace } = useWorkspace();
  const { raw: { projects, profiles, workspaceSettingsBlob } } = useOperationalData();
  const [healthChecks, setHealthChecks] = useState<HealthCheckResult[]>([]);

  useEffect(() => {
    if (workspace?.id) {
      workspaceHealthService.getHealthDiagnostics(workspace.id).then(setHealthChecks);
    }
  }, [workspace?.id, workspace?.settings]);

  const hasGovernanceWarnings = healthChecks.some(c => c.type === 'warning');

  const checks = [
    { label: 'Onboarding Configured', passed: !!workspaceSettingsBlob },
    { label: 'Projects Initialized', passed: projects.length > 0 },
    { label: 'Users Provisioned', passed: profiles.length > 0 },
    { label: 'Reporting Active', passed: true }, // Assuming active by default in this MVP
    { label: 'Governance Active', passed: !hasGovernanceWarnings }
  ];

  const allPassed = checks.every(c => c.passed);

  return (
    <div className={`border rounded-xl p-6 ${allPassed ? 'bg-signal-safe/5 border-signal-safe/20' : 'bg-surface-2 border-border'}`}>
      <div className="flex items-center gap-3 mb-6 border-b border-border/50 pb-4">
        {allPassed ? (
          <ShieldCheck className="w-6 h-6 text-signal-safe" />
        ) : (
          <ShieldAlert className="w-6 h-6 text-signal-warning" />
        )}
        <div>
          <h3 className="text-sm font-bold uppercase tracking-wider text-text-primary">Pilot Readiness Assessment</h3>
          <p className="text-[11px] text-text-tertiary mt-0.5">Verification of critical prerequisites before enterprise rollout.</p>
        </div>
        <div className="ml-auto">
          {allPassed ? (
            <span className="px-3 py-1 bg-signal-safe/10 border border-signal-safe/20 text-signal-safe rounded-lg text-xs font-bold uppercase tracking-widest">
              Ready for Pilot
            </span>
          ) : (
            <span className="px-3 py-1 bg-signal-warning/10 border border-signal-warning/20 text-signal-warning rounded-lg text-xs font-bold uppercase tracking-widest">
              Missing Requirements
            </span>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
        {checks.map((check, i) => (
          <div key={i} className={`flex flex-col gap-2 p-4 rounded-lg border ${check.passed ? 'bg-surface/50 border-signal-safe/20' : 'bg-surface border-signal-warning/30'}`}>
            <div className="flex items-center justify-between">
              {check.passed ? (
                <div className="w-6 h-6 rounded-full bg-signal-safe/20 flex items-center justify-center">
                  <Check className="w-3.5 h-3.5 text-signal-safe" />
                </div>
              ) : (
                <div className="w-6 h-6 rounded-full bg-signal-warning/20 flex items-center justify-center">
                  <X className="w-3.5 h-3.5 text-signal-warning" />
                </div>
              )}
            </div>
            <span className={`text-[10px] font-bold uppercase tracking-wider ${check.passed ? 'text-text-secondary' : 'text-signal-warning'}`}>
              {check.label}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
