import React, { useState, useMemo } from 'react';
import { useWorkspace } from '../../context/WorkspaceContext';

import { useAuth } from '../../context/AuthContext';
import { Icon } from '../../components/ui/Icon';
import { hasCapability } from '../../core/auth/permissions';
import { useOperationalDerived, useOperationalData } from '../../context/OperationalDataContext';
import { useDashboard } from '../../context/DashboardContext';
import { dependencyService, CrossProjectDependency } from '../../services/dependencyService';

import { deliverableService, Milestone } from '../../services/deliverableService';
import { profitabilityService, ProjectProfitability } from '../../services/profitabilityService';

type ViewMode = 'grid' | 'list' | 'timeline' | 'deliverables';
type StatusFilter = 'all' | 'active' | 'deployed' | 'planning';

const STATUS_META: Record<string, { label: string; color: string; dot: string }> = {
  active:     { label: 'ACTIVE',    color: '#34d399', dot: 'bg-emerald-400' },
  in_progress:{ label: 'EXECUTING', color: 'var(--pm-primary)', dot: 'bg-[#c0c1ff]' },
  planning:   { label: 'PLANNING',  color: 'var(--pm-tertiary)', dot: 'bg-[#ffb783]' },
  deployed:   { label: 'DEPLOYED',  color: 'var(--pm-on-surface-variant)', dot: 'bg-[#c7c4d7]' },
  stalled:    { label: 'STALLED',   color: 'var(--pm-error)', dot: 'bg-[#ffb4ab]' },
};

function getStatusMeta(status: string) {
  return STATUS_META[status] || { label: status?.toUpperCase() || 'UNKNOWN', color: 'var(--pm-on-surface-variant)', dot: 'bg-surface-highest' };
}

function getInitials(name: string) {
  return name?.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase() || '??';
}

export default function PortfolioPage() {
  const { workspace, projects } = useWorkspace() as any;
  const { raw: { tasks } } = useOperationalData();
  const { profile } = useAuth();
  const { projectFrictionMetrics } = useOperationalDerived();
  const { setIsAdding } = useDashboard();

  const [view, setView] = useState<ViewMode>('grid');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [search, setSearch] = useState('');
  const [crossDeps, setCrossDeps] = useState<CrossProjectDependency[]>([]);
  const [milestones, setMilestones] = useState<Milestone[]>([]);
  const [profitability, setProfitability] = useState<Record<string, ProjectProfitability>>({});

  React.useEffect(() => {
    if (workspace?.id && view === 'deliverables') {
      deliverableService.getMilestones(workspace.id).then(setMilestones);
    }
  }, [workspace?.id, view]);

  React.useEffect(() => {
    if (workspace?.id) {
      dependencyService.getCrossProjectDependencies(workspace.id).then(res => {
        if (res.data) setCrossDeps(res.data);
      });
      profitabilityService.getWorkspaceProfitability(workspace.id).then(data => {
        const map = data.reduce((acc, curr) => ({ ...acc, [curr.project_id]: curr }), {});
        setProfitability(map);
      }).catch(console.error);
    }
  }, [workspace?.id]);

  const filteredProjects = useMemo(() => {
    let list = [...(projects || [])];
    if (statusFilter !== 'all') list = list.filter(p => p.status === statusFilter || (statusFilter === 'active' && p.status === 'in_progress'));
    if (search) list = list.filter(p => p.name?.toLowerCase().includes(search.toLowerCase()));
    return list;
  }, [projects, statusFilter, search]);

  const stats = useMemo(() => {
    const all = projects || [];
    return {
      total:     all.length,
      active:    all.filter((p: any) => p.status !== 'deployed').length,
      deployed:  all.filter((p: any) => p.status === 'deployed').length,
      blockers:  (tasks || []).filter((t: any) => t.risk === 'high' && t.status !== 'done').length,
      velocity:  Math.max(0, (tasks || []).filter((t: any) => t.status === 'done').length * 8),
    };
  }, [projects, tasks]);

  return (
    <div className="flex flex-col min-h-full font-geist pb-16" style={{ color: 'var(--pm-on-surface)' }}>

      {/* ── Header ─────────────────────────────────────────────── */}
      <div className="flex items-center justify-between px-1 py-2 mb-6">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Portfolio Orchestration</h1>
          <p className="text-sm mt-1" style={{ color: 'var(--pm-on-surface-variant)' }}>
            {stats.active} active initiatives across {stats.total} total projects
          </p>
        </div>
        {hasCapability(profile?.role, 'manage_projects') && (
          <button onClick={() => setIsAdding(true)} className="flex items-center gap-2 px-4 py-2 rounded-lg font-semibold text-sm transition-all active:scale-95"
            style={{ background: 'var(--pm-primary)', color: 'var(--pm-on-primary)' }}>
            <Icon name="add" size={18} />
            New Project
          </button>
        )}
      </div>

      {/* ── View Controls + Filter Bar ──────────────────────────── */}
      <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
        {/* View toggle */}
        <div className="flex p-1 rounded-lg" style={{ background: 'var(--pm-surface-lowest)', border: '1px solid rgba(70,69,84,0.2)' }}>
          {(['grid', 'list', 'timeline', 'deliverables'] as ViewMode[]).map(v => (
            <button key={v} onClick={() => setView(v)}
              className="flex items-center gap-1.5 px-4 py-2 rounded-md text-sm transition-all"
              style={view === v
                ? { background: 'var(--pm-secondary-container)', color: 'var(--pm-on-secondary-container)' }
                : { color: 'var(--pm-on-surface-variant)' }}>
              <Icon name={v === 'grid' ? 'grid_view' : v === 'list' ? 'list' : v === 'timeline' ? 'timeline' : 'verified'} size={16} />
              {v.charAt(0).toUpperCase() + v.slice(1)}
            </button>
          ))}
        </div>

        {/* Search + Filter */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 px-3 py-2 rounded-lg"
            style={{ background: 'var(--pm-surface-high)', border: '1px solid rgba(70,69,84,0.3)' }}>
            <Icon name="search" size={16} style={{ color: 'var(--pm-on-surface-variant)' }} />
            <input
              className="bg-transparent border-none outline-none text-sm w-48"
              style={{ color: 'var(--pm-on-surface)' }}
              placeholder="Filter projects..."
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>
          <select
            className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm appearance-none cursor-pointer"
            style={{ background: 'var(--pm-surface-high)', border: '1px solid rgba(70,69,84,0.3)', color: 'var(--pm-on-surface-variant)' }}
            value={statusFilter}
            onChange={e => setStatusFilter(e.target.value as StatusFilter)}>
            <option value="all">Status: All</option>
            <option value="active">Active</option>
            <option value="planning">Planning</option>
            <option value="deployed">Deployed</option>
          </select>
        </div>
      </div>

      {/* ── Project Grid ────────────────────────────────────────── */}
      {view === 'grid' && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {filteredProjects.map((project: any) => {
            const meta = getStatusMeta(project.status);
            const projectTasks = (tasks || []).filter((t: any) => t.project_id === project.id);
            const doneTasks = projectTasks.filter((t: any) => t.status === 'done').length;
            const doneRatio = projectTasks.length > 0 ? (doneTasks / projectTasks.length) : 0;
            
            // Advanced Execution Intelligence retrieval
            const frictionMetric = projectFrictionMetrics?.[project.id] || {
              waitTimeRatio: 0,
              adjustedConfidence: projectTasks.length > 0 ? Math.round((doneTasks / projectTasks.length) * 100) : 0,
              operationalContinuity: 95,
              liabilityRatio: 0
            };

            const confidence = frictionMetric.adjustedConfidence;
            const blockers = projectTasks.filter((t: any) => t.risk === 'high' && t.status !== 'done').length;
            const confColor = confidence >= 80 ? '#34d399' : confidence >= 50 ? 'var(--pm-primary)' : 'var(--pm-error)';
            const prof = profitability[project.id];
            const riskColor = prof?.risk === 'Healthy' ? '#34d399' : prof?.risk === 'At Risk' ? '#f59e0b' : '#ef4444';

            return (
              <div key={project.id} className="pm-card flex flex-col gap-4 p-6 cursor-pointer group hover:-translate-y-0.5 transition-transform">
                {/* Top row */}
                <div className="flex items-start justify-between">
                  <div>
                    <span className="font-mono-pm text-[9px] uppercase tracking-widest block mb-1"
                      style={{ color: meta.color }}>
                      {meta.label}
                    </span>
                    <h3 className="text-base font-semibold" style={{ color: 'var(--pm-on-surface)' }}>
                      {project.name}
                    </h3>
                  </div>
                  <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full"
                    style={{ background: 'var(--pm-surface-high)' }}>
                    <span className={`status-dot ${meta.dot}`} style={{ boxShadow: `0 0 6px ${meta.color}80` }} />
                    <span className="font-mono-pm text-[10px]" style={{ color: meta.color }}>{meta.label}</span>
                  </div>
                </div>

                {/* Description */}
                <p className="text-sm leading-relaxed line-clamp-2" style={{ color: 'var(--pm-on-surface-variant)' }}>
                  {project.description || 'No description provided.'}
                </p>

                {/* Stacked Progress Bar: Active Delivery vs Wait-Time vs Blocked */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between font-mono-pm text-[9px]" style={{ color: 'var(--pm-on-surface-variant)' }}>
                    <span>DELIVERY RATIO</span>
                    <span className="text-[var(--pm-secondary)]">WAIT: {frictionMetric.waitTimeRatio}%</span>
                  </div>
                  <div className="h-2 w-full rounded-full overflow-hidden flex bg-surface-3">
                    <div className="h-full rounded-l transition-all duration-500" style={{ width: `${Math.round(doneRatio * 100)}%`, background: '#34d399' }} />
                    <div className="h-full transition-all duration-500" style={{ width: `${Math.min(100 - Math.round(doneRatio * 100), frictionMetric.waitTimeRatio)}%`, background: '#ff9800' }} />
                    <div className="h-full rounded-r bg-red-500/20" style={{ flex: 1 }} />
                  </div>
                  <div className="flex items-center justify-between text-[9px] font-mono-pm opacity-60">
                    <span className="text-emerald-400">● EXEC: {Math.round(doneRatio * 100)}%</span>
                    <span className="text-amber-500">● WAIT: {frictionMetric.waitTimeRatio}%</span>
                    <span className="text-red-400">● BLK: {Math.max(0, 100 - Math.round(doneRatio * 100) - frictionMetric.waitTimeRatio)}%</span>
                  </div>
                </div>

                {/* Confidence + sprint */}
                <div className="grid grid-cols-2 gap-3 mt-1">
                  <div>
                    <span className="font-mono-pm text-[9px] uppercase tracking-widest block mb-1"
                      style={{ color: 'var(--pm-on-surface-variant)', opacity: 0.6 }}>BUDGET HEALTH</span>
                    <div className="flex flex-col">
                      <div className="flex items-center gap-1.5">
                        <span className="font-mono-pm text-base font-semibold" style={{ color: riskColor }}>
                          {prof?.risk || 'Unknown'}
                        </span>
                      </div>
                      {prof && prof.risk !== 'Healthy' && (
                        <span className="text-[9px] text-[var(--pm-on-surface-variant)] leading-tight mt-1">
                          {prof.actual_cost > prof.estimated_cost ? 'High effort variance' : 'Scope/Cost overrun'}
                        </span>
                      )}
                    </div>
                  </div>
                  <div>
                    <span className="font-mono-pm text-[9px] uppercase tracking-widest block mb-1"
                      style={{ color: 'var(--pm-on-surface-variant)', opacity: 0.6 }}>STABILITY</span>
                    <div className="flex flex-col">
                      <div className="flex items-center gap-1">
                        <span className="font-mono-pm text-base font-semibold text-indigo-300">{frictionMetric.operationalContinuity}/100</span>
                      </div>
                      <span className="text-[9px] text-[var(--pm-on-surface-variant)] leading-tight mt-1">
                        CONF: <span style={{ color: confColor }}>{confidence}%</span>
                      </span>
                    </div>
                  </div>
                </div>

                {/* Bottom row */}
                <div className="flex items-center justify-between pt-3 border-t"
                  style={{ borderColor: 'rgba(70,69,84,0.2)' }}>
                  <div className="flex items-center gap-1.5">
                    {/* Initials avatar */}
                    <div className="w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-bold"
                      style={{ background: 'rgba(192,193,255,0.1)', border: '1px solid rgba(192,193,255,0.2)', color: 'var(--pm-primary)' }}>
                      {getInitials(project.name)}
                    </div>
                    {project.deadline && (
                      <span className="font-mono-pm text-[10px]" style={{ color: 'var(--pm-on-surface-variant)', opacity: 0.6 }}>
                        Due {new Date(project.deadline).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                      </span>
                    )}
                  </div>
                  {blockers > 0 ? (
                    <div className="flex items-center gap-1 px-2 py-0.5 rounded pm-badge-error" style={{ fontSize: 10 }}>
                      <Icon name="warning" size={12} />
                      {blockers} Blocker{blockers !== 1 ? 's' : ''}
                    </div>
                  ) : (
                    <div className="flex items-center gap-1 px-2 py-0.5 rounded pm-badge-success" style={{ fontSize: 10 }}>
                      <Icon name="check_circle" size={12} />
                      Clear
                    </div>
                  )}
                </div>
              </div>
            );
          })}

          {/* New initiative slot */}
          {hasCapability(profile?.role, 'manage_projects') && (
            <button onClick={() => setIsAdding(true)} className="rounded-xl p-6 flex flex-col items-center justify-center gap-3 transition-all cursor-pointer group"
              style={{ border: '2px dashed rgba(70,69,84,0.4)' }}
              onMouseEnter={e => { (e.currentTarget as any).style.borderColor = 'rgba(192,193,255,0.4)'; (e.currentTarget as any).style.background = 'rgba(192,193,255,0.03)'; }}
              onMouseLeave={e => { (e.currentTarget as any).style.borderColor = 'rgba(70,69,84,0.4)'; (e.currentTarget as any).style.background = ''; }}>
              <Icon name="add_circle" size={32} style={{ color: 'var(--pm-on-surface-variant)' }} />
              <span className="font-mono-pm text-[10px] uppercase tracking-[0.3em] font-bold"
                style={{ color: 'var(--pm-on-surface-variant)' }}>
                Create Project
              </span>
              <span className="text-xs" style={{ color: 'var(--pm-on-surface-variant)', opacity: 0.5 }}>
                Configure a new project
              </span>
            </button>
          )}
        </div>
      )}

      {/* List View */}
      {view === 'list' && (
        <div className="rounded-xl overflow-x-auto" style={{ background: 'var(--pm-surface-low)', border: '1px solid rgba(70,69,84,0.3)' }}>
          <table className="w-full text-left executive-table min-w-[800px]">
            <thead style={{ background: 'rgba(51,53,55,0.5)', borderBottom: '1px solid rgba(70,69,84,0.3)' }}>
              <tr>
                {['Project', 'Status', 'Confidence', 'Tasks', 'Deadline'].map(h => (
                  <th key={h} className="px-6 py-4">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody style={{ borderColor: 'rgba(70,69,84,0.1)' }}>
              {filteredProjects.map((project: any) => {
                const meta = getStatusMeta(project.status);
                const pt = (tasks || []).filter((t: any) => t.project_id === project.id);
                const conf = pt.length > 0 ? Math.round((pt.filter((t: any) => t.status === 'done').length / pt.length) * 100) : 0;
                const confColor = conf >= 80 ? '#34d399' : conf >= 50 ? 'var(--pm-primary)' : 'var(--pm-error)';
                return (
                  <tr key={project.id} className="border-t" style={{ borderColor: 'rgba(70,69,84,0.1)' }}>
                    <td className="px-6 py-4">
                      <div>
                        <div className="font-medium" style={{ color: 'var(--pm-on-surface)' }}>{project.name}</div>
                        <div className="font-mono-pm text-[11px] mt-0.5" style={{ color: 'var(--pm-on-surface-variant)', opacity: 0.5 }}>
                          {project.template || 'Standard'}
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className="pm-badge-primary" style={{ color: meta.color, borderColor: `${meta.color}30`, background: `${meta.color}12` }}>
                        {meta.label}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2 w-32">
                        <div className="h-1.5 flex-1 rounded-full overflow-hidden" style={{ background: 'var(--pm-surface-highest)' }}>
                          <div className="h-full rounded-full" style={{ width: `${conf}%`, background: confColor }} />
                        </div>
                        <span className="font-mono-pm text-sm" style={{ color: confColor }}>{conf}%</span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className="font-mono-pm text-sm" style={{ color: 'var(--pm-on-surface-variant)' }}>
                        {pt.filter((t: any) => t.status === 'done').length}/{pt.length}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <span className="font-mono-pm text-sm" style={{ color: 'var(--pm-on-surface-variant)' }}>
                        {project.deadline ? new Date(project.deadline).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: '2-digit' }) : '—'}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Timeline View (placeholder) */}
      {view === 'timeline' && (
        <div className="glass-panel rounded-xl p-8 flex flex-col items-center justify-center min-h-64 gap-4">
          <Icon name="timeline" size={40} style={{ color: 'var(--pm-primary)', opacity: 0.4 }} />
          <p className="text-sm" style={{ color: 'var(--pm-on-surface-variant)' }}>
            Gantt timeline view — navigate to <strong>Scheduling</strong> for full execution timeline.
          </p>
        </div>
      )}

      {/* Deliverables View */}
      {view === 'deliverables' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Drafts */}
            <div className="bg-surface-lowest rounded-xl p-4 border border-[var(--pm-border)]">
              <h3 className="text-sm font-bold uppercase font-mono tracking-wider mb-4 flex items-center justify-between">
                <span>Internal Drafts</span>
                <span className="bg-surface-high px-2 py-0.5 rounded-full text-[10px]">{milestones.filter(m => !['client_review', 'approved', 'ready_for_billing', 'billed'].includes(m.status)).length}</span>
              </h3>
              <div className="space-y-3">
                {milestones.filter(m => !['client_review', 'approved', 'ready_for_billing', 'billed'].includes(m.status)).map(m => (
                  <div key={m.id} className="p-3 bg-surface-2 rounded-lg border border-[var(--pm-border)] flex flex-col gap-2">
                    <div className="text-[10px] uppercase text-[var(--pm-on-surface-variant)]">{m.project_name}</div>
                    <div className="font-semibold">{m.title}</div>
                    {m.status === 'changes_requested' && (
                      <div className="text-xs text-amber-500 bg-amber-500/10 p-2 rounded flex gap-1 items-start">
                        <Icon name="warning" size={14} /> Client requested changes
                      </div>
                    )}
                    <button 
                      className="mt-2 text-xs font-semibold py-1.5 bg-primary/10 text-primary rounded w-full hover:bg-primary/20 transition-colors"
                      onClick={async () => {
                        await deliverableService.updateMilestoneStatus(m.id, 'client_review');
                        deliverableService.getMilestones(workspace.id).then(setMilestones);
                      }}
                    >
                      Submit for Client Review
                    </button>
                  </div>
                ))}
              </div>
            </div>

            {/* In Review */}
            <div className="bg-surface-lowest rounded-xl p-4 border border-amber-500/30">
              <h3 className="text-sm font-bold uppercase font-mono tracking-wider mb-4 flex items-center justify-between text-amber-500">
                <span>Client Review</span>
                <span className="bg-amber-500/10 px-2 py-0.5 rounded-full text-[10px]">{milestones.filter(m => m.status === 'client_review').length}</span>
              </h3>
              <div className="space-y-3">
                {milestones.filter(m => m.status === 'client_review').map(m => (
                  <div key={m.id} className="p-3 bg-surface-2 rounded-lg border border-amber-500/30 flex flex-col gap-2">
                    <div className="text-[10px] uppercase text-[var(--pm-on-surface-variant)]">{m.project_name}</div>
                    <div className="font-semibold">{m.title}</div>
                    <div className="text-xs text-[var(--pm-on-surface-variant)] flex items-center gap-1">
                      <Icon name="schedule" size={14} /> Waiting on client...
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Approved & Ready */}
            <div className="bg-surface-lowest rounded-xl p-4 border border-emerald-500/30">
              <h3 className="text-sm font-bold uppercase font-mono tracking-wider mb-4 flex items-center justify-between text-emerald-400">
                <span>Approved</span>
                <span className="bg-emerald-500/10 px-2 py-0.5 rounded-full text-[10px]">{milestones.filter(m => ['approved', 'ready_for_billing', 'billed'].includes(m.status)).length}</span>
              </h3>
              <div className="space-y-3">
                {milestones.filter(m => ['approved', 'ready_for_billing', 'billed'].includes(m.status)).map(m => (
                  <div key={m.id} className="p-3 bg-surface-2 rounded-lg border border-emerald-500/30 flex flex-col gap-2">
                    <div className="text-[10px] uppercase text-[var(--pm-on-surface-variant)]">{m.project_name}</div>
                    <div className="font-semibold">{m.title}</div>
                    {m.status === 'approved' ? (
                      <button 
                        className="mt-2 text-xs font-semibold py-1.5 bg-emerald-500/10 text-emerald-400 rounded w-full hover:bg-emerald-500/20 transition-colors"
                        onClick={async () => {
                          await deliverableService.updateMilestoneStatus(m.id, 'ready_for_billing');
                          deliverableService.getMilestones(workspace.id).then(setMilestones);
                        }}
                      >
                        Push to Finance (Billing)
                      </button>
                    ) : (
                      <div className="text-xs text-[var(--pm-on-surface-variant)] bg-surface-high p-2 rounded text-center">
                        {m.status === 'ready_for_billing' ? 'In Finance Queue' : 'Billed'}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Cross Project Dependencies Panel ──────────────────── */}
      {crossDeps.length > 0 && (
        <div className="mt-8 glass-panel rounded-xl p-6 border border-amber-500/20">
          <div className="flex items-center gap-2 mb-4">
            <Icon name="warning" size={20} style={{ color: 'var(--pm-tertiary)' }} />
            <h2 className="text-lg font-semibold" style={{ color: 'var(--pm-on-surface)' }}>Cross-Project Blockers</h2>
          </div>
          <div className="space-y-3">
            {crossDeps.map(dep => (
              <div key={dep.id} className="flex items-center justify-between p-4 rounded-lg bg-surface-2 border border-[var(--pm-border)]">
                <div>
                  <div className="font-mono-pm text-[10px] uppercase text-text-quaternary mb-1">Blocked Project</div>
                  <div className="font-medium text-text-primary">{dep.blocked_project_name}</div>
                  <div className="text-sm text-text-secondary mt-1 flex items-center gap-2">
                    <Icon name="lock" size={14} className="text-amber-500" />
                    {dep.blocked_task_title}
                  </div>
                </div>
                <div className="text-center px-4">
                  <Icon name="arrow_forward" size={20} className="text-text-quaternary" />
                </div>
                <div className="text-right">
                  <div className="font-mono-pm text-[10px] uppercase text-text-quaternary mb-1">Blocking Project</div>
                  <div className="font-medium text-text-primary">{dep.blocking_project_name}</div>
                  <div className="text-sm text-text-secondary mt-1 flex items-center justify-end gap-2">
                    {dep.blocking_task_title}
                    <span className="px-2 py-0.5 rounded text-[10px] font-bold tracking-wider bg-surface-highest text-text-primary">
                      {dep.blocking_task_status}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── KPI Footer Bar ──────────────────────────────────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mt-8">
        {[
          { label: 'Portfolio Velocity', value: `${stats.velocity}`, unit: 'pts', trend: '+12%', up: true },
          { label: 'Resource Burn', value: `${Math.min(100, Math.round((stats.active / (stats.total || 1)) * 100))}%`, unit: 'active capacity', trend: 'Nominal', up: true },
          { label: 'Risk Index', value: stats.blockers > 0 ? 'Elevated' : 'Low', unit: '', trend: `${stats.blockers} blockers`, up: stats.blockers === 0 },
          { label: 'Delivery Rate', value: `${stats.total > 0 ? Math.round((stats.deployed / stats.total) * 100) : 0}%`, unit: 'completed', trend: 'Steady', up: true },
        ].map((item, i) => (
          <div key={i} className="glass-panel p-4 rounded-lg flex flex-col gap-2">
            <span className="font-mono-pm text-[9px] uppercase tracking-widest" style={{ color: 'var(--pm-on-surface-variant)' }}>
              {item.label}
            </span>
            <div className="flex items-baseline gap-2">
              <span className="text-xl font-bold" style={{ color: 'var(--pm-on-surface)' }}>{item.value}</span>
              {item.unit && <span className="font-mono-pm text-xs" style={{ color: 'var(--pm-on-surface-variant)' }}>{item.unit}</span>}
            </div>
            <span className="font-mono-pm text-[10px]" style={{ color: item.up ? '#34d399' : 'var(--pm-tertiary)' }}>
              {item.trend}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
