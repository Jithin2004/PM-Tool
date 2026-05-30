import React, { useState, useMemo } from 'react';
import { useWorkspace } from '../../context/WorkspaceContext';

import { useAuth } from '../../context/AuthContext';
import { Icon } from '../../components/ui/Icon';
import { hasCapability } from '../../core/auth/permissions';
import { useOperationalDerived, useOperationalData } from '../../context/OperationalDataContext';

type ViewMode = 'grid' | 'list' | 'timeline';
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

  const [view, setView] = useState<ViewMode>('grid');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [search, setSearch] = useState('');

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
          <button className="flex items-center gap-2 px-4 py-2 rounded-lg font-semibold text-sm transition-all active:scale-95"
            style={{ background: 'var(--pm-primary)', color: 'var(--pm-on-primary)' }}>
            <Icon name="add" size={18} />
            New Initiative
          </button>
        )}
      </div>

      {/* ── View Controls + Filter Bar ──────────────────────────── */}
      <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
        {/* View toggle */}
        <div className="flex p-1 rounded-lg" style={{ background: 'var(--pm-surface-lowest)', border: '1px solid rgba(70,69,84,0.2)' }}>
          {(['grid', 'list', 'timeline'] as ViewMode[]).map(v => (
            <button key={v} onClick={() => setView(v)}
              className="flex items-center gap-1.5 px-4 py-2 rounded-md text-sm transition-all"
              style={view === v
                ? { background: 'var(--pm-secondary-container)', color: 'var(--pm-on-secondary-container)' }
                : { color: 'var(--pm-on-surface-variant)' }}>
              <Icon name={v === 'grid' ? 'grid_view' : v === 'list' ? 'list' : 'timeline'} size={16} />
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
                    <span className="text-slate-300">WAIT: {frictionMetric.waitTimeRatio}%</span>
                  </div>
                  <div className="h-2 w-full rounded-full overflow-hidden flex bg-slate-950">
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
                      style={{ color: 'var(--pm-on-surface-variant)', opacity: 0.6 }}>CALIBRATED COGNITION</span>
                    <div className="flex items-center gap-1.5">
                      <span className="font-mono-pm text-base font-semibold" style={{ color: confColor }}>{confidence}%</span>
                      <span className="text-[10px] text-slate-500">CONFIDENCE</span>
                    </div>
                  </div>
                  <div>
                    <span className="font-mono-pm text-[9px] uppercase tracking-widest block mb-1"
                      style={{ color: 'var(--pm-on-surface-variant)', opacity: 0.6 }}>STABILITY</span>
                    <div className="flex items-center gap-1">
                      <span className="font-mono-pm text-base font-semibold text-indigo-300">{frictionMetric.operationalContinuity}/100</span>
                      <span className="text-[10px] text-slate-500">CONTINUITY</span>
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
            <button className="rounded-xl p-6 flex flex-col items-center justify-center gap-3 transition-all cursor-pointer group"
              style={{ border: '2px dashed rgba(70,69,84,0.4)' }}
              onMouseEnter={e => { (e.currentTarget as any).style.borderColor = 'rgba(192,193,255,0.4)'; (e.currentTarget as any).style.background = 'rgba(192,193,255,0.03)'; }}
              onMouseLeave={e => { (e.currentTarget as any).style.borderColor = 'rgba(70,69,84,0.4)'; (e.currentTarget as any).style.background = ''; }}>
              <Icon name="add_circle" size={32} style={{ color: 'var(--pm-on-surface-variant)' }} />
              <span className="font-mono-pm text-[10px] uppercase tracking-[0.3em] font-bold"
                style={{ color: 'var(--pm-on-surface-variant)' }}>
                Initiate Project
              </span>
              <span className="text-xs" style={{ color: 'var(--pm-on-surface-variant)', opacity: 0.5 }}>
                Draft a new strategic initiative
              </span>
            </button>
          )}
        </div>
      )}

      {/* List View */}
      {view === 'list' && (
        <div className="rounded-xl overflow-hidden" style={{ background: 'var(--pm-surface-low)', border: '1px solid rgba(70,69,84,0.3)' }}>
          <table className="w-full text-left executive-table">
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
