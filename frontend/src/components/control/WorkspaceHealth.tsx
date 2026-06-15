import React, { useEffect, useState, useMemo } from 'react';
import { useWorkspace } from '../../context/WorkspaceContext';
import { ShieldAlert, CheckCircle, AlertTriangle, Database } from 'lucide-react';
import { useOperationalData } from '../../context/OperationalDataContext';
import { workspaceHealthService, HealthCheckResult } from '../../services/workspaceHealthService';

export function WorkspaceHealth() {
  const { workspace } = useWorkspace();
  const { raw, derived } = useOperationalData();
  const [healthChecks, setHealthChecks] = useState<HealthCheckResult[]>([]);

  useEffect(() => {
    if (workspace?.id) {
      workspaceHealthService.getHealthDiagnostics(workspace.id).then(setHealthChecks);
    }
  }, [workspace?.id, workspace?.settings]); // Re-run when settings change

  const dataDiagnostics = useMemo(() => {
    if (!raw.profiles || !derived.visibleProjects || !derived.visibleTasks) return [];
    
    const diagnostics = [];
    const validUserIds = new Set(raw.profiles.map((p: any) => p.id));
    const validProjectIds = new Set(derived.visibleProjects.map((p: any) => p.id));

    // Check 1: Projects without valid owners
    const orphanedProjects = derived.visibleProjects.filter((p: any) => p.owner_id && !validUserIds.has(p.owner_id));
    if (orphanedProjects.length > 0) {
      diagnostics.push({ 
        type: 'error', 
        message: `${orphanedProjects.length} project(s) owned by deleted users. Reassign them.` 
      });
    }

    // Check 2: Tasks assigned to deleted users
    const orphanedTasks = derived.visibleTasks.filter((t: any) => t.assignee_id && !validUserIds.has(t.assignee_id));
    if (orphanedTasks.length > 0) {
      diagnostics.push({ 
        type: 'error', 
        message: `${orphanedTasks.length} task(s) assigned to deleted users. Reassign them.` 
      });
    }

    // Check 3: Tasks linked to deleted projects
    const orphanedTasksByProject = derived.visibleTasks.filter((t: any) => !validProjectIds.has(t.project_id));
    if (orphanedTasksByProject.length > 0) {
      diagnostics.push({ 
        type: 'error', 
        message: `${orphanedTasksByProject.length} task(s) belong to deleted projects. Clean up required.` 
      });
    }

    return diagnostics;
  }, [raw.profiles, derived.visibleProjects, derived.visibleTasks]);

  const hasIssues = healthChecks.some(c => c.type === 'warning');
  const hasDataErrors = dataDiagnostics.length > 0;

  const navigateTo = (path: string) => {
    window.history.pushState(null, '', path);
    window.dispatchEvent(new CustomEvent('popstate'));
  };

  return (
    <div className="bg-surface/40 backdrop-blur-md border border-border/50 rounded-2xl p-6 mb-8 transition-all duration-300">
      <h3 className="text-xs font-bold tracking-widest uppercase text-text-secondary mb-4 flex items-center gap-2">
        <ShieldAlert className="w-4 h-4 text-accent-primary" />
        Workspace Health
      </h3>

      {healthChecks.length === 0 && dataDiagnostics.length === 0 ? (
        <div className="flex items-center gap-3 p-4 bg-signal-safe/10 border border-signal-safe/20 rounded-xl">
          <CheckCircle className="w-5 h-5 text-signal-safe" />
          <div>
            <p className="text-sm font-medium text-signal-safe">Setup & Data Complete</p>
            <p className="text-xs text-signal-safe/80">Your workspace is fully configured with clean relational data.</p>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          {hasIssues && (
            <div className="p-4 bg-signal-warning/10 border border-signal-warning/20 rounded-xl mb-4">
              <p className="text-sm font-medium text-signal-warning flex items-center gap-2">
                <AlertTriangle className="w-4 h-4" /> Action Recommended
              </p>
              <p className="text-xs text-signal-warning/80 mt-1">Some configuration is missing which may affect features like invoicing or calendar sync.</p>
            </div>
          )}
          
          <div className="space-y-2">
            {healthChecks.map((check, i) => (
              <div key={i} className={`flex items-center gap-3 p-3 rounded-xl border ${check.type === 'warning' ? 'bg-signal-warning/5 border-signal-warning/20 text-signal-warning' : 'bg-signal-info/5 border-signal-info/20 text-signal-info'}`}>
                {check.type === 'warning' ? <AlertTriangle className="w-4 h-4 shrink-0" /> : <ShieldAlert className="w-4 h-4 shrink-0" />}
                <p className="text-xs flex-1">{check.message}</p>
                {check.actionRoute && (
                  <button onClick={() => navigateTo(check.actionRoute!)} className="text-[10px] font-bold uppercase tracking-wider underline opacity-80 hover:opacity-100 transition-opacity whitespace-nowrap">
                    Resolve
                  </button>
                )}
              </div>
            ))}
          </div>

          {hasDataErrors && (
            <div className="mt-6 pt-4 border-t border-border/50">
              <h4 className="text-xs font-bold tracking-widest uppercase text-signal-error mb-3 flex items-center gap-2">
                <Database className="w-3.5 h-3.5" />
                Data Integrity Diagnostics
              </h4>
              <div className="space-y-2">
                {dataDiagnostics.map((diag, i) => (
                  <div key={i} className="flex items-center gap-3 p-3 rounded-xl border bg-signal-error/5 border-signal-error/20 text-signal-error">
                    <AlertTriangle className="w-4 h-4 shrink-0" />
                    <p className="text-xs">{diag.message}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
