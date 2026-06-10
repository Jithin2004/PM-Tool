import React, { useMemo } from 'react';
import { useWorkspace } from '../../context/WorkspaceContext';
import { useOperationalData } from '../../context/OperationalDataContext';
import { FileText, ChevronRight, AlertTriangle, TrendingUp, Shield, Clock, Users, CheckCircle2 } from 'lucide-react';

export function ExecutiveOverview() {
  const { workspace, projects, t } = useWorkspace() as any;
  const { raw: { tasks, profiles, attendanceRows } } = useOperationalData();

  const activeProjects = useMemo(() => projects?.filter((p: any) => p.status !== 'deployed' && p.status !== 'archived') || [], [projects]);

  const briefData = useMemo(() => {
    let totalDone = 0;
    let totalTasks = 0;
    let totalDelayed = 0;

    const projectSummaries = activeProjects.map((p: any) => {
      const pTasks = tasks?.filter((t: any) => t.project_id === p.id) || [];
      const pTotal = pTasks.length;
      const pDone = pTasks.filter((t: any) => t.status === 'done').length;
      const pDelayed = pTasks.filter((t: any) => t.status !== 'done' && t.risk === 'high').length;
      
      totalDone += pDone;
      totalTasks += pTotal;
      totalDelayed += pDelayed;
      
      const completion = pTotal ? Math.round((pDone / pTotal) * 100) : 0;
      
      let status: 'on_track' | 'at_risk' | 'delayed' = 'on_track';
      if (pDelayed > 3) status = 'delayed';
      else if (pDelayed > 0 || completion < 30) status = 'at_risk';

      const owner = profiles?.find((pr: any) => pr.id === p.owner_id);
      const ownerName = owner?.full_name || owner?.email || 'Unassigned';

      return {
        id: p.id,
        name: p.name,
        completion,
        delayedItems: pDelayed,
        status,
        ownerName,
        totalTasks: pTotal
      };
    });

    // Simple capacity calculation (assuming 8 hours/day per active member, simplified)
    const activeMembers = profiles?.filter((p: any) => p.role !== 'viewer' && p.role !== 'uninvited')?.length || 1;
    // Just a placeholder metric based on real data counts for Team Capacity %
    const teamCapacity = activeMembers > 0 ? Math.min(100, Math.round((activeProjects.length / (activeMembers * 2)) * 100)) : 0;
    const capacityScore = 100 - teamCapacity; // How much capacity is available

    const completionRate = totalTasks ? Math.round((totalDone / totalTasks) * 100) : 0;

    const recentChanges = tasks?.filter((t: any) => t.updated_at && (Date.now() - new Date(t.updated_at).getTime()) < 3 * 86400000).length || 0;
    const pendingApprovals = tasks?.filter((t: any) => t.status === 'in_review').length || 0;
    const pendingDecisions = projects?.filter((p: any) => p.status === 'paused' || p.risk === 'high').length || 0;

    return {
      activeProjectsCount: activeProjects.length,
      completionRate,
      teamCapacity: capacityScore,
      delayedItems: totalDelayed,
      projects: projectSummaries,
      recentChanges,
      newDelays: totalDelayed,
      pendingApprovals,
      pendingDecisions
    };
  }, [activeProjects, tasks, profiles, attendanceRows]);

  const statusConfig = {
    delayed: { color: 'var(--pm-risk)', label: 'Delayed', icon: <AlertTriangle className="w-4 h-4" /> },
    at_risk: { color: 'var(--pm-warning)', label: 'At Risk', icon: <Clock className="w-4 h-4" /> },
    on_track: { color: 'var(--pm-success)', label: 'On Track', icon: <CheckCircle2 className="w-4 h-4" /> },
  };

  const renderAvatar = (name: string) => {
    const init = name.substring(0, 2).toUpperCase();
    return (
      <div className="w-7 h-7 rounded-full bg-[var(--pm-surface)] border border-[var(--pm-border)] flex items-center justify-center text-[11px] font-medium text-[var(--pm-text-secondary)]">
        {init}
      </div>
    );
  };

  return (
    <div className="space-y-8 pb-16 font-sans">
      {/* Header */}
      <div className="flex items-end justify-between px-1 pt-2">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight text-[var(--pm-text)]">
            Executive Brief
          </h1>
          <p className="text-base mt-2 text-[var(--pm-text-secondary)]">
            Live summary of all active {t('projects', 'projects')}, team capacity, and execution risks.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button onClick={() => window.print()} className="px-4 py-2 bg-[var(--pm-surface-elevated)] border border-[var(--pm-border)] rounded-lg text-sm font-medium flex items-center gap-2 hover:bg-[var(--pm-surface-hover)] transition-colors text-[var(--pm-text)] shadow-sm cursor-pointer">
            <FileText className="w-4 h-4"/> Export Report
          </button>
        </div>
      </div>

      {/* Monday Morning Brief */}
      <div className="bg-[var(--pm-surface-elevated)] rounded-xl border border-[var(--pm-border)] p-6 shadow-sm mb-6">
        <h2 className="text-lg font-semibold mb-4 text-[var(--pm-text)] flex items-center gap-2">
          <Clock className="w-5 h-5 text-indigo-500" />
          Monday Morning Brief
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 md:divide-x divide-[var(--pm-border)]/50">
          <div className="p-2">
            <h3 className="text-[10px] font-bold uppercase tracking-wider text-[var(--pm-text-secondary)] mb-2">What changed?</h3>
            <p className="text-sm font-medium text-[var(--pm-text)]"><span className="text-emerald-500 font-bold">{briefData.recentChanges} items</span> progressed.</p>
          </div>
          <div className="p-2 md:pl-4">
            <h3 className="text-[10px] font-bold uppercase tracking-wider text-[var(--pm-text-secondary)] mb-2">What got worse?</h3>
            <p className="text-sm font-medium text-[var(--pm-risk)]"><span className="font-bold">{briefData.newDelays} new delays</span> identified.</p>
          </div>
          <div className="p-2 md:pl-4">
            <h3 className="text-[10px] font-bold uppercase tracking-wider text-[var(--pm-text-secondary)] mb-2">What needs approval?</h3>
            <p className="text-sm font-medium text-[var(--pm-warning)]"><span className="font-bold">{briefData.pendingApprovals} items</span> blocked waiting on you.</p>
          </div>
          <div className="p-2 md:pl-4">
            <h3 className="text-[10px] font-bold uppercase tracking-wider text-[var(--pm-text-secondary)] mb-2">Decisions Waiting</h3>
            <p className="text-sm font-medium text-[var(--pm-primary)]"><span className="font-bold">{briefData.pendingDecisions} executive decisions</span> required.</p>
          </div>
        </div>
      </div>

      {/* Top KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-[var(--pm-surface-elevated)] rounded-xl border border-[var(--pm-border)] p-5 shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <div className="text-sm font-medium text-[var(--pm-text-secondary)]">Active {t('projects', 'Projects')}</div>
            <div className="w-8 h-8 rounded-full bg-blue-500/10 flex items-center justify-center">
              <Shield className="w-4 h-4 text-blue-500" />
            </div>
          </div>
          <div className="text-3xl font-bold text-[var(--pm-text)]">{briefData.activeProjectsCount}</div>
        </div>

        <div className="bg-[var(--pm-surface-elevated)] rounded-xl border border-[var(--pm-border)] p-5 shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <div className="text-sm font-medium text-[var(--pm-text-secondary)]">Completion Rate</div>
            <div className="w-8 h-8 rounded-full bg-emerald-500/10 flex items-center justify-center">
              <CheckCircle2 className="w-4 h-4 text-emerald-500" />
            </div>
          </div>
          <div className="text-3xl font-bold text-[var(--pm-text)]">{briefData.completionRate}%</div>
        </div>

        <div className="bg-[var(--pm-surface-elevated)] rounded-xl border border-[var(--pm-border)] p-5 shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <div className="text-sm font-medium text-[var(--pm-text-secondary)]">Available Capacity</div>
            <div className="w-8 h-8 rounded-full bg-indigo-500/10 flex items-center justify-center">
              <Users className="w-4 h-4 text-indigo-500" />
            </div>
          </div>
          <div className="text-3xl font-bold text-[var(--pm-text)]">{briefData.teamCapacity}%</div>
        </div>

        <div className="bg-[var(--pm-surface-elevated)] rounded-xl border border-[var(--pm-border)] p-5 shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <div className="text-sm font-medium text-[var(--pm-text-secondary)]">Delayed Items</div>
            <div className="w-8 h-8 rounded-full bg-red-500/10 flex items-center justify-center">
              <AlertTriangle className="w-4 h-4 text-red-500" />
            </div>
          </div>
          <div className="text-3xl font-bold" style={{ color: briefData.delayedItems > 0 ? 'var(--pm-risk)' : 'var(--pm-text)' }}>
            {briefData.delayedItems}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        {/* Delivery Summary (Main Column) */}
        <div className="xl:col-span-2 space-y-6">
          <div className="bg-[var(--pm-surface-elevated)] rounded-xl border border-[var(--pm-border)] overflow-hidden shadow-sm">
            <div className="p-5 border-b border-[var(--pm-border)] flex items-center justify-between bg-[var(--pm-surface)]/50">
              <h2 className="text-lg font-semibold text-[var(--pm-text)]">Delivery Summary</h2>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left table-premium executive-table min-w-[800px]">
                <thead className="bg-[var(--pm-surface)]/30 text-[var(--pm-text-secondary)] text-xs border-b border-[var(--pm-border)]">
                  <tr>
                    <th className="px-5 py-3 font-medium">{t('project', 'Project')}</th>
                    <th className="px-5 py-3 font-medium">Owner</th>
                    <th className="px-5 py-3 font-medium">Status</th>
                    <th className="px-5 py-3 font-medium">Completion</th>
                    <th className="px-5 py-3 font-medium text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--pm-border)]/50">
                  {briefData.projects.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="px-5 py-8 text-center text-[var(--pm-text-secondary)]">No active {t('projects', 'projects')} to display.</td>
                    </tr>
                  ) : (
                    briefData.projects.map((item: any) => {
                      const cfg = statusConfig[item.status as keyof typeof statusConfig];
                      return (
                        <tr key={item.id} className="hover:bg-[var(--pm-surface-hover)] transition-colors group">
                          <td className="px-5 py-4 font-medium text-[var(--pm-text)] truncate max-w-[200px]">{item.name}</td>
                          <td className="px-5 py-4">
                            <div className="flex items-center gap-2">
                              {renderAvatar(item.ownerName)}
                              <span className="truncate max-w-[120px]">{item.ownerName}</span>
                            </div>
                          </td>
                          <td className="px-5 py-4">
                            <div className="flex items-center gap-1.5" style={{ color: cfg.color }}>
                              {cfg.icon}
                              <span className="font-medium">{cfg.label}</span>
                            </div>
                          </td>
                          <td className="px-5 py-4">
                            <div className="flex items-center gap-3">
                              <div className="w-full max-w-[100px] h-2 bg-[var(--pm-surface-3)] rounded-full overflow-hidden">
                                <div className="h-full bg-blue-500 rounded-full" style={{ width: `${item.completion}%` }} />
                              </div>
                              <span className="text-xs text-[var(--pm-text-secondary)]">{item.completion}%</span>
                            </div>
                          </td>
                          <td className="px-5 py-4 text-right">
                            <button className="p-1.5 rounded-md text-[var(--pm-text-secondary)] hover:text-[var(--pm-primary)] hover:bg-[var(--pm-primary)]/10 transition-colors">
                              <ChevronRight className="w-4 h-4" />
                            </button>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Right Column: Risk & Team Performance */}
        <div className="space-y-6">
          <div className="bg-[var(--pm-surface-elevated)] rounded-xl border border-[var(--pm-border)] overflow-hidden shadow-sm">
            <div className="p-5 border-b border-[var(--pm-border)] bg-[var(--pm-surface)]/50">
              <h2 className="text-lg font-semibold text-[var(--pm-text)]">Risk Overview</h2>
            </div>
            <div className="p-5 space-y-4">
              {briefData.delayedItems > 0 ? (
                <div className="p-4 rounded-lg bg-red-500/10 border border-[var(--signal-critical)] bg-[var(--signal-critical-bg)]/20 text-red-500">
                  <div className="flex items-center gap-2 font-medium mb-1">
                    <AlertTriangle className="w-4 h-4" />
                    Action Required
                  </div>
                  <p className="text-sm opacity-90">
                    There are {briefData.delayedItems} tasks marked as high risk or delayed across your active projects.
                  </p>
                </div>
              ) : (
                <div className="p-4 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-500 flex items-center gap-3">
                  <CheckCircle2 className="w-5 h-5" />
                  <span className="text-sm font-medium">No critical delays detected.</span>
                </div>
              )}
              
              <div>
                <h3 className="text-sm font-medium text-[var(--pm-text)] mb-3 mt-4">Projects Needing Attention</h3>
                <div className="space-y-3">
                  {briefData.projects.filter(p => p.status === 'delayed' || p.status === 'at_risk').length > 0 ? (
                    briefData.projects.filter(p => p.status === 'delayed' || p.status === 'at_risk').map(p => (
                      <div key={p.id} className="flex justify-between items-center p-3 rounded-md bg-[var(--pm-surface)] border border-[var(--pm-border)]">
                        <span className="text-sm font-medium truncate max-w-[150px]">{p.name}</span>
                        <span className="text-xs font-medium px-2 py-1 rounded" style={{ backgroundColor: p.status === 'delayed' ? 'var(--pm-risk-bg)' : 'var(--pm-warning-bg)', color: p.status === 'delayed' ? 'var(--pm-risk)' : 'var(--pm-warning)' }}>
                          {statusConfig[p.status as keyof typeof statusConfig].label}
                        </span>
                      </div>
                    ))
                  ) : (
                    <div className="text-sm text-[var(--pm-text-secondary)] italic">All projects are on track.</div>
                  )}
                </div>
              </div>
            </div>
          </div>

          <div className="bg-[var(--pm-surface-elevated)] rounded-xl border border-[var(--pm-border)] overflow-hidden shadow-sm">
            <div className="p-5 border-b border-[var(--pm-border)] bg-[var(--pm-surface)]/50">
              <h2 className="text-lg font-semibold text-[var(--pm-text)]">Team Performance</h2>
            </div>
            <div className="p-5">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm text-[var(--pm-text-secondary)]">Overall Task Completion</span>
                <span className="text-sm font-medium text-[var(--pm-text)]">{briefData.completionRate}%</span>
              </div>
              <div className="w-full h-2 bg-[var(--pm-surface-3)] rounded-full overflow-hidden mb-6">
                <div className="h-full bg-emerald-500 rounded-full" style={{ width: `${briefData.completionRate}%` }} />
              </div>
              
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm text-[var(--pm-text-secondary)]">Team Utilization</span>
                <span className="text-sm font-medium text-[var(--pm-text)]">{100 - briefData.teamCapacity}%</span>
              </div>
              <div className="w-full h-2 bg-[var(--pm-surface-3)] rounded-full overflow-hidden">
                <div className="h-full bg-indigo-500 rounded-full" style={{ width: `${100 - briefData.teamCapacity}%` }} />
              </div>
              <p className="text-xs text-[var(--pm-text-tertiary)] mt-3">
                Based on active project assignments versus total team members.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
