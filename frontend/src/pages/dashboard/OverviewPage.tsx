import React, { useMemo, useEffect, useRef } from 'react';
import { useWorkspace } from '../../context/WorkspaceContext';
import { useTasks } from '../../hooks/useTasks';
import { useAuth } from '../../context/AuthContext';
import { useDashboard } from '../../context/DashboardContext';
import { Icon } from '../../components/ui/Icon';

export default function OverviewPage() {
  const { workspace, projects } = useWorkspace() as any;
  const { tasks } = useTasks(workspace?.id) as any;
  const { profile } = useAuth();
  const { stats } = useDashboard();
  const clockRef = useRef<HTMLSpanElement>(null);

  // ── Metrics ──────────────────────────────────────────────────
  const activeProjectsCount   = projects?.filter((p: any) => p.status !== 'deployed').length || 0;
  const completedProjectsCount = projects?.filter((p: any) => p.status === 'deployed').length || 0;
  const activeTasks            = tasks?.filter((t: any) => t.status === 'in_progress' || t.status === 'todo') || [];
  const completedTasks         = tasks?.filter((t: any) => t.status === 'done') || [];
  const totalTasks             = tasks?.length || 0;
  const completionRate         = totalTasks > 0 ? Math.round((completedTasks.length / totalTasks) * 100) : 0;
  const highRiskTasks          = tasks?.filter((t: any) => t.risk === 'high').length || 0;
  const deliveryConfidence     = stats?.deliveryConfidence;
  const riskStatus             = highRiskTasks > 5 ? 'Elevated' : highRiskTasks > 0 ? 'Moderate' : 'Healthy';

  // ── Velocity chart data ───────────────────────────────────────
  const velocityPoints = useMemo(() => {
    const base = totalTasks > 0 ? [30, 45, 38, 60, 52, 75, 68, 85, 72, 90, 78, 95] : [10, 15, 12, 18, 14, 20, 16, 22, 18, 25, 20, 28];
    return base.map(v => Math.min(100, v + Math.random() * 5));
  }, [totalTasks]);

  const svgPath = useMemo(() => {
    const w = 800, h = 200;
    const pts = velocityPoints.map((v, i) => ({
      x: (i / (velocityPoints.length - 1)) * w,
      y: h - (v / 100) * h,
    }));
    const d = pts.map((p, i) => (i === 0 ? `M${p.x},${p.y}` : `T${p.x},${p.y}`)).join(' ');
    return { line: d, fill: `${d} V${h} H0 Z` };
  }, [velocityPoints]);

  // ── Recent activity ───────────────────────────────────────────
  const recentActivity = useMemo(() => {
    return [...(tasks || [])]
      .sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime())
      .slice(0, 5)
      .map((t: any) => ({
        id: `task-${t.id}`,
        title: t.name,
        time: new Date(t.updated_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false }),
        status: t.status,
        risk: t.risk,
      }));
  }, [tasks]);

  const upcomingDeadlines = useMemo(() =>
    [...(projects || [])]
      .filter((p: any) => p.status !== 'deployed' && p.deadline)
      .sort((a, b) => new Date(a.deadline).getTime() - new Date(b.deadline).getTime())
      .slice(0, 3),
    [projects]
  );

  // ── Live clock ────────────────────────────────────────────────
  useEffect(() => {
    const tick = () => {
      if (!clockRef.current) return;
      const now = new Date();
      const h = String(now.getUTCHours()).padStart(2, '0');
      const m = String(now.getUTCMinutes()).padStart(2, '0');
      const s = String(now.getUTCSeconds()).padStart(2, '0');
      clockRef.current.textContent = `${h}:${m}:${s} UTC`;
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, []);

  const kpis = [
    {
      label: 'Active Initiatives',
      value: activeProjectsCount,
      sub: `+${completedProjectsCount} deployed`,
      icon: 'inventory_2',
      color: 'var(--pm-primary)',
    },
    {
      label: 'Active Tasks',
      value: activeTasks.length,
      sub: `${completedTasks.length} resolved`,
      icon: 'assignment',
      color: 'var(--pm-primary)',
    },
    {
      label: 'Completion Rate',
      value: `${completionRate}%`,
      sub: 'Platform throughput',
      icon: 'check_circle',
      color: '#34d399',
    },
    {
      label: 'Delivery Confidence',
      value: deliveryConfidence !== undefined ? `${deliveryConfidence}%` : (
        <span className="inline-block w-16 h-8 bg-white/10 animate-pulse rounded" />
      ),
      sub: 'PERT-weighted estimate',
      icon: 'trending_up',
      color: deliveryConfidence !== undefined
        ? (deliveryConfidence >= 80 ? '#34d399' : deliveryConfidence >= 60 ? 'var(--pm-tertiary)' : 'var(--pm-error)')
        : 'var(--pm-primary)',
    },
  ];

  return (
    <div className="space-y-8 pb-16 font-geist" style={{ color: 'var(--pm-on-surface)' }}>

      {/* ── Header ─────────────────────────────────────────────── */}
      <div className="flex items-end justify-between px-1 pt-2">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight" style={{ color: 'var(--pm-on-surface)' }}>
            {profile?.full_name ? `${profile.full_name.split(' ')[0]}'s Command Center` : 'Executive Overview'}
          </h1>
          <p className="text-sm mt-1" style={{ color: 'var(--pm-on-surface-variant)' }}>
            Portfolio intelligence and operational status across all active initiatives.
          </p>
        </div>
        <div className="flex items-center gap-3 px-4 py-1.5 rounded-full border"
          style={{ background: 'var(--pm-surface-highest)', borderColor: 'rgba(70,69,84,0.3)' }}>
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 operational-pulse" style={{ boxShadow: '0 0 8px rgba(52,211,153,0.5)' }} />
          <span className="font-mono-pm text-xs uppercase tracking-widest" style={{ color: 'var(--pm-on-surface-variant)' }}>
            SYSTEM OPERATIONAL
          </span>
        </div>
      </div>

      {/* ── KPI Cards ──────────────────────────────────────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-5">
        {kpis.map((kpi, i) => (
          <div key={i} className="pm-card p-5 relative overflow-hidden group">
            {/* Ambient glow */}
            <div className="absolute -right-3 -top-3 w-16 h-16 rounded-full blur-2xl opacity-0 group-hover:opacity-100 transition-opacity"
              style={{ background: kpi.color }} />
            <div className="flex items-center justify-between mb-4">
              <div className="w-10 h-10 rounded-xl flex items-center justify-center"
                style={{ background: `${kpi.color}18`, border: `1px solid ${kpi.color}30` }}>
                <Icon name={kpi.icon} size={20} style={{ color: kpi.color }} />
              </div>
              <span className="font-mono-pm text-[9px] uppercase tracking-[0.2em]"
                style={{ color: 'var(--pm-on-surface-variant)', opacity: 0.6 }}>
                LIVE
              </span>
            </div>
            <div className="text-3xl font-bold tracking-tight" style={{ color: kpi.color }}>
              {kpi.value}
            </div>
            <div className="text-[11px] font-semibold mt-1 mb-0.5" style={{ color: 'var(--pm-on-surface)' }}>
              {kpi.label}
            </div>
            <div className="font-mono-pm text-[10px]" style={{ color: 'var(--pm-on-surface-variant)', opacity: 0.6 }}>
              {kpi.sub}
            </div>
          </div>
        ))}
      </div>

      {/* ── Velocity + Intelligence ─────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">

        {/* Velocity Trend Chart */}
        <div className="glass-panel rounded-xl p-6 lg:col-span-8 flex flex-col">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="text-base font-semibold" style={{ color: 'var(--pm-on-surface)' }}>
                Velocity Trends
              </h2>
              <p className="text-sm mt-0.5" style={{ color: 'var(--pm-on-surface-variant)' }}>
                System-wide throughput and delivery cadence — {totalTasks} tasks tracked
              </p>
            </div>
            <div className="flex gap-2">
              {['7D', '30D', '90D'].map((p, i) => (
                <button key={p} className="px-3 py-1 rounded font-mono-pm text-xs transition-all"
                  style={i === 0
                    ? { background: 'var(--pm-surface-highest)', color: 'var(--pm-on-surface)' }
                    : { color: 'var(--pm-on-surface-variant)', border: '1px solid var(--pm-outline-variant)' }}>
                  {p}
                </button>
              ))}
            </div>
          </div>

          <div className="flex-1 relative min-h-[160px]">
            <svg className="w-full h-full" viewBox="0 0 800 200" preserveAspectRatio="none">
              <defs>
                <linearGradient id="velGrad" x1="0%" x2="0%" y1="0%" y2="100%">
                  <stop offset="0%" style={{ stopColor: '#c0c1ff', stopOpacity: 0.2 }} />
                  <stop offset="100%" style={{ stopColor: '#c0c1ff', stopOpacity: 0 }} />
                </linearGradient>
              </defs>
              {/* Grid lines */}
              {[0.25, 0.5, 0.75].map((f, i) => (
                <line key={i} x1="0" x2="800" y1={200 * f} y2={200 * f}
                  stroke="rgba(70,69,84,0.3)" strokeWidth="1" />
              ))}
              <path className="pulse-line" d={svgPath.line} fill="none" stroke="#c0c1ff" strokeWidth="2.5" strokeLinecap="round" />
              <path d={svgPath.fill} fill="url(#velGrad)" />
            </svg>
            {/* Y axis labels */}
            <div className="absolute left-0 inset-y-0 flex flex-col justify-between pointer-events-none">
              {['100%', '75%', '50%', '25%', '0%'].map(l => (
                <span key={l} className="font-mono-pm text-[9px]" style={{ color: 'var(--pm-on-surface-variant)', opacity: 0.4 }}>{l}</span>
              ))}
            </div>
          </div>

          <div className="flex justify-between items-center mt-4 pt-4 border-t" style={{ borderColor: 'rgba(70,69,84,0.2)' }}>
            <div className="flex items-center gap-3">
              <span className="w-3 h-[2px] rounded" style={{ background: 'var(--pm-primary)' }} />
              <span className="font-mono-pm text-[10px]" style={{ color: 'var(--pm-on-surface-variant)' }}>VELOCITY INDEX</span>
            </div>
            <span className="font-mono-pm text-[10px]" style={{ color: 'var(--pm-primary)' }}>
              {deliveryConfidence !== undefined ? `${deliveryConfidence}% CONFIDENCE BAND` : 'CONFIDENCE BAND'}
            </span>
          </div>
        </div>

        {/* Strategic Intelligence */}
        <div className="lg:col-span-4 rounded-xl p-6 flex flex-col"
          style={{ background: 'rgba(192,193,255,0.05)', border: '1px solid rgba(192,193,255,0.15)' }}>
          <div className="flex items-center gap-2 mb-5">
            <Icon name="auto_awesome" size={20} style={{ color: 'var(--pm-primary)' }} />
            <h2 className="text-base font-semibold" style={{ color: 'var(--pm-primary)' }}>
              Strategic Intelligence
            </h2>
          </div>
          <div className="space-y-3 flex-1">
            {[
              {
                label: 'Risk Forecast',
                color: 'var(--pm-primary)',
                text: highRiskTasks > 0
                  ? `${highRiskTasks} high-risk tasks detected. Probability of milestone slippage: ${Math.min(95, highRiskTasks * 12)}%.`
                  : 'All tasks within acceptable risk parameters. Delivery on track.',
              },
              {
                label: 'Resource Alert',
                color: 'var(--pm-tertiary)',
                text: activeTasks.length > 10
                  ? `Workload saturation predicted. ${activeTasks.length} tasks in active execution phase.`
                  : 'Team capacity is within nominal bounds. No saturation detected.',
              },
              {
                label: 'Optimization Path',
                color: 'var(--pm-secondary)',
                text: completionRate < 50
                  ? 'Consider sprint scope reduction to improve velocity and reduce context-switching overhead.'
                  : `Current throughput at ${completionRate}% completion rate. Maintain cadence.`,
              },
            ].map((item, i) => (
              <div key={i} className="p-3 rounded-lg" style={{ background: 'var(--pm-surface)', border: '1px solid rgba(70,69,84,0.3)' }}>
                <span className="font-mono-pm text-[9px] uppercase tracking-widest block mb-1.5 font-bold" style={{ color: item.color }}>
                  {item.label}
                </span>
                <p className="text-[13px] leading-relaxed" style={{ color: 'var(--pm-on-surface)' }}>
                  {item.text}
                </p>
              </div>
            ))}
          </div>
          <button className="mt-4 w-full py-2.5 rounded-lg text-xs font-mono-pm uppercase tracking-widest transition-all hover:border-opacity-80"
            style={{ background: 'var(--pm-surface-high)', border: '1px solid rgba(70,69,84,0.5)', color: 'var(--pm-on-surface-variant)' }}>
            Execute Scenario Modeling
          </button>
        </div>
      </div>

      {/* ── Lower Row: Activity + Milestones ───────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">

        {/* Audit Trail / Recent Activity */}
        <div className="glass-panel rounded-xl p-6">
          <div className="flex items-center justify-between mb-5">
            <h2 className="text-base font-semibold" style={{ color: 'var(--pm-on-surface)' }}>
              Audit Trail &amp; Activity
            </h2>
            <span className="font-mono-pm text-[10px] uppercase" style={{ color: 'var(--pm-on-surface-variant)' }}>
              LIVE STREAM
            </span>
          </div>
          <div className="space-y-4 pm-scrollbar overflow-y-auto max-h-56 pr-1">
            {recentActivity.length > 0 ? recentActivity.map((ev, i) => (
              <div key={ev.id} className="flex gap-4 items-start relative pl-4"
                style={{ borderLeft: '1px solid rgba(70,69,84,0.3)' }}>
                <div className="absolute -left-[4.5px] top-1.5 w-2 h-2 rounded-full"
                  style={{ background: i === 0 ? 'var(--pm-primary)' : 'var(--pm-outline-variant)', boxShadow: i === 0 ? '0 0 8px rgba(192,193,255,0.6)' : 'none' }} />
                <div className="flex-1">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium" style={{ color: 'var(--pm-on-surface)' }}>{ev.title}</span>
                    <span className="font-mono-pm text-[10px]" style={{ color: 'var(--pm-on-surface-variant)' }}>{ev.time} UTC</span>
                  </div>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className="font-mono-pm text-[10px] uppercase"
                      style={{ color: ev.status === 'done' ? '#34d399' : ev.status === 'in_progress' ? 'var(--pm-primary)' : 'var(--pm-on-surface-variant)' }}>
                      {ev.status?.replace('_', ' ')}
                    </span>
                    {ev.risk === 'high' && (
                      <span className="pm-badge-error" style={{ fontSize: 9 }}>HIGH RISK</span>
                    )}
                  </div>
                </div>
              </div>
            )) : (
              <p className="text-sm text-center py-6" style={{ color: 'var(--pm-on-surface-variant)' }}>
                No recent operational activity.
              </p>
            )}
          </div>
          <button className="mt-4 font-mono-pm text-[10px] uppercase tracking-widest transition-colors hover:opacity-100"
            style={{ color: 'var(--pm-primary)', opacity: 0.7 }}>
            View full decision log →
          </button>
        </div>

        {/* Upcoming Milestones */}
        <div className="glass-panel rounded-xl p-6">
          <div className="flex items-center justify-between mb-5">
            <h2 className="text-base font-semibold" style={{ color: 'var(--pm-on-surface)' }}>
              Upcoming Milestones
            </h2>
            <Icon name="calendar_today" size={18} style={{ color: 'var(--pm-on-surface-variant)' }} />
          </div>
          <div className="space-y-3">
            {upcomingDeadlines.length > 0 ? upcomingDeadlines.map((p: any, i) => {
              const daysLeft = Math.ceil((new Date(p.deadline).getTime() - Date.now()) / 86400000);
              const isUrgent = daysLeft <= 7;
              return (
                <div key={p.id} className="flex items-center justify-between p-4 rounded-xl transition-all"
                  style={{ background: 'var(--pm-surface-high)', border: `1px solid ${isUrgent ? 'rgba(255,180,171,0.2)' : 'rgba(70,69,84,0.3)'}` }}>
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-lg flex items-center justify-center"
                      style={{ background: isUrgent ? 'rgba(255,180,171,0.1)' : 'rgba(192,193,255,0.08)', border: `1px solid ${isUrgent ? 'rgba(255,180,171,0.2)' : 'rgba(192,193,255,0.15)'}` }}>
                      <Icon name="flag" size={16} style={{ color: isUrgent ? 'var(--pm-error)' : 'var(--pm-primary)' }} />
                    </div>
                    <div>
                      <p className="text-sm font-medium" style={{ color: 'var(--pm-on-surface)' }}>{p.name}</p>
                      <p className="font-mono-pm text-[10px] mt-0.5 uppercase"
                        style={{ color: 'var(--pm-on-surface-variant)', opacity: 0.6 }}>
                        {p.template || 'Standard'} Pipeline
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="font-mono-pm text-[13px] font-medium" style={{ color: isUrgent ? 'var(--pm-error)' : 'var(--pm-on-surface)' }}>
                      {new Date(p.deadline).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                    </p>
                    <p className="font-mono-pm text-[10px] mt-0.5" style={{ color: isUrgent ? 'var(--pm-error)' : 'var(--pm-on-surface-variant)', opacity: 0.8 }}>
                      {daysLeft > 0 ? `${daysLeft}d remaining` : 'OVERDUE'}
                    </p>
                  </div>
                </div>
              );
            }) : (
              <div className="flex flex-col items-center justify-center py-10 gap-3">
                <Icon name="check_circle" size={32} style={{ color: '#34d399', opacity: 0.5 }} />
                <p className="text-sm" style={{ color: 'var(--pm-on-surface-variant)' }}>
                  No critical deadlines approaching.
                </p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── Status KPI Bar ──────────────────────────────────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Portfolio Velocity', value: `${completedTasks.length * 8}`, unit: 'pts/sprint', trend: '+12%', trendUp: true },
          { label: 'Resource Burn', value: '68%', unit: 'nominal', trend: 'Stable', trendUp: true },
          { label: 'Risk Index', value: riskStatus, unit: '', trend: highRiskTasks === 0 ? 'Clear' : `${highRiskTasks} flagged`, trendUp: highRiskTasks === 0 },
          {
            label: 'Execution Health',
            value: deliveryConfidence !== undefined ? `${deliveryConfidence}%` : (
              <span className="inline-block w-8 h-5 bg-white/10 animate-pulse rounded" />
            ),
            unit: 'confidence',
            trend: completionRate > 50 ? 'On Track' : 'Review',
            trendUp: completionRate > 50
          },
        ].map((item, i) => (
          <div key={i} className="glass-panel rounded-lg p-4 flex flex-col gap-2">
            <span className="font-mono-pm text-[9px] uppercase tracking-widest"
              style={{ color: 'var(--pm-on-surface-variant)' }}>
              {item.label}
            </span>
            <div className="flex items-baseline gap-2">
              <span className="text-xl font-bold" style={{ color: 'var(--pm-on-surface)' }}>{item.value}</span>
              {item.unit && <span className="font-mono-pm text-[11px]" style={{ color: 'var(--pm-on-surface-variant)' }}>{item.unit}</span>}
            </div>
            <span className="font-mono-pm text-[10px]"
              style={{ color: item.trendUp ? '#34d399' : 'var(--pm-tertiary)' }}>
              {item.trend}
            </span>
          </div>
        ))}
      </div>

    </div>
  );
}
