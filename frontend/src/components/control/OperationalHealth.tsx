import React, { useMemo } from 'react';
import { ShieldCheck, AlertTriangle, Database } from 'lucide-react';
import { useOperationalData } from '../../context/OperationalDataContext';

export function OperationalHealth() {
  const { raw, derived } = useOperationalData();

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

  const hasDataErrors = dataDiagnostics.length > 0;

  if (!hasDataErrors) {
    return (
      <div className="bg-surface/40 backdrop-blur-md border border-border/50 rounded-2xl p-6 mb-8 transition-all duration-300">
        <h3 className="text-xs font-bold tracking-widest uppercase text-text-secondary mb-4 flex items-center gap-2">
          <Database className="w-4 h-4 text-accent-primary" />
          System Health
        </h3>
        <div className="flex items-center gap-3 p-4 bg-signal-safe/10 border border-signal-safe/20 rounded-xl">
          <ShieldCheck className="w-5 h-5 text-signal-safe" />
          <div>
            <p className="text-sm font-medium text-signal-safe">System Healthy</p>
            <p className="text-xs text-signal-safe/80">No data integrity issues detected across the workspace.</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-surface/40 backdrop-blur-md border border-border/50 rounded-2xl p-6 mb-8 transition-all duration-300">
      <h3 className="text-xs font-bold tracking-widest uppercase text-text-secondary mb-4 flex items-center gap-2">
        <Database className="w-4 h-4 text-accent-primary" />
        System Health
      </h3>

      <div className="pt-2">
        <h4 className="text-xs font-bold tracking-widest uppercase text-signal-error mb-3 flex items-center gap-2">
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
    </div>
  );
}
