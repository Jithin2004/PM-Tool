import React, { useMemo } from 'react';
import { useWorkspace } from '../../context/WorkspaceContext';
import { useOperationalData, useOperationalDerived } from '../../context/OperationalDataContext';
import { AlertTriangle, TrendingUp, Users, Activity, BarChart3, Clock, Briefcase, FileText } from 'lucide-react';
import { ResolveLayout } from '../../app/layouts/ResolveLayout';

export function ExecutiveOverview() {
  const { workspace, projects } = useWorkspace() as any;
  const { raw: { tasks } } = useOperationalData();

  const activeProjects = useMemo(() => projects?.filter((p: any) => p.status !== 'deployed') || [], [projects]);
  const completedProjects = useMemo(() => projects?.filter((p: any) => p.status === 'deployed') || [], [projects]);
  
  const highRiskProjects = useMemo(() => {
    return activeProjects.filter((p: any) => {
      const pTasks = tasks?.filter((t: any) => t.project_id === p.id) || [];
      return pTasks.some((t: any) => t.risk === 'high' && t.status !== 'done');
    });
  }, [activeProjects, tasks]);

  const deliveryConfidence = 82; // Mock calculation for executive view
  const capacityUtilization = 88; // Mock
  const completionReadiness = 75; // Mock

  return (
    <div className="space-y-8 pb-16 font-geist text-slate-100 max-w-7xl mx-auto mt-4 px-4">
      {/* Header */}
      <div className="flex items-end justify-between border-b border-border/50 pb-5">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-[var(--pm-on-surface)]">Executive Summary</h1>
          <p className="text-sm mt-1 text-[var(--pm-on-surface-variant)]">
            Portfolio Health, Delivery Confidence, and Risk Aggregation
          </p>
        </div>
        <div className="flex gap-2">
           <button onClick={() => window.print()} className="px-4 py-2 bg-surface-3 border border-border/50 rounded-lg text-xs font-semibold flex items-center gap-2 hover:bg-surface-4 transition-colors">
              <FileText className="w-4 h-4"/> Export PDF
           </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-5">
        <div className="bg-surface-3 border border-border/50 p-5 rounded-xl">
          <div className="flex items-center gap-3 mb-3">
             <Activity className="w-5 h-5 text-[var(--pm-primary)]" />
             <span className="text-[10px] font-mono uppercase tracking-widest text-[var(--pm-on-surface-variant)]">Portfolio Health</span>
          </div>
          <div className="text-3xl font-bold text-emerald-400">Stable</div>
          <div className="text-xs text-[var(--pm-on-surface-variant)] mt-1">{activeProjects.length} Active / {completedProjects.length} Deployed</div>
        </div>
        
        <div className="bg-surface-3 border border-border/50 p-5 rounded-xl">
          <div className="flex items-center gap-3 mb-3">
             <TrendingUp className="w-5 h-5 text-emerald-400" />
             <span className="text-[10px] font-mono uppercase tracking-widest text-[var(--pm-on-surface-variant)]">Delivery Confidence</span>
          </div>
          <div className="text-3xl font-bold text-[var(--pm-on-surface)]">{deliveryConfidence}%</div>
          <div className="text-xs text-[var(--pm-on-surface-variant)] mt-1">Based on historical velocity</div>
        </div>

        <div className="bg-surface-3 border border-border/50 p-5 rounded-xl">
          <div className="flex items-center gap-3 mb-3">
             <AlertTriangle className="w-5 h-5 text-amber-400" />
             <span className="text-[10px] font-mono uppercase tracking-widest text-[var(--pm-on-surface-variant)]">Projects At Risk</span>
          </div>
          <div className="text-3xl font-bold text-amber-400">{highRiskProjects.length}</div>
          <div className="text-xs text-[var(--pm-on-surface-variant)] mt-1">Require immediate intervention</div>
        </div>

        <div className="bg-surface-3 border border-border/50 p-5 rounded-xl">
          <div className="flex items-center gap-3 mb-3">
             <Users className="w-5 h-5 text-indigo-400" />
             <span className="text-[10px] font-mono uppercase tracking-widest text-[var(--pm-on-surface-variant)]">Capacity Utilization</span>
          </div>
          <div className="text-3xl font-bold text-[var(--pm-on-surface)]">{capacityUtilization}%</div>
          <div className="text-xs text-[var(--pm-on-surface-variant)] mt-1">Across all delivery units</div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Top Delay Sources */}
        <div className="bg-surface-3 border border-border/50 p-6 rounded-xl">
          <h3 className="text-sm font-semibold mb-4 text-[var(--pm-on-surface)] flex items-center gap-2">
            <Clock className="w-4 h-4 text-amber-400"/> Wait-State Breakdown & Top Delays
          </h3>
          <div className="space-y-4">
            <div>
              <div className="flex justify-between text-xs mb-1">
                <span>Client Verification Dependencies</span>
                <span>45%</span>
              </div>
              <div className="h-2 w-full bg-surface-4 rounded-full overflow-hidden">
                <div className="h-full bg-amber-400 w-[45%]" />
              </div>
            </div>
            <div>
              <div className="flex justify-between text-xs mb-1">
                <span>Infrastructure Provisioning</span>
                <span>30%</span>
              </div>
              <div className="h-2 w-full bg-surface-4 rounded-full overflow-hidden">
                <div className="h-full bg-amber-400 w-[30%]" />
              </div>
            </div>
            <div>
              <div className="flex justify-between text-xs mb-1">
                <span>Internal Signoffs</span>
                <span>25%</span>
              </div>
              <div className="h-2 w-full bg-surface-4 rounded-full overflow-hidden">
                <div className="h-full bg-amber-400 w-[25%]" />
              </div>
            </div>
          </div>
        </div>

        {/* Completion Readiness */}
        <div className="bg-surface-3 border border-border/50 p-6 rounded-xl">
          <h3 className="text-sm font-semibold mb-4 text-[var(--pm-on-surface)] flex items-center gap-2">
            <Briefcase className="w-4 h-4 text-emerald-400"/> Completion Readiness
          </h3>
          <div className="flex items-center justify-center py-8">
            <div className="text-center">
              <div className="text-5xl font-bold text-emerald-400 mb-2">{completionReadiness}%</div>
              <div className="text-xs text-[var(--pm-on-surface-variant)]">Of portfolio milestones are on track to complete this quarter.</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
