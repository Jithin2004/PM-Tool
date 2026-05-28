import React, { useMemo, useState, useEffect } from 'react';
import { useWorkspace } from '../../context/WorkspaceContext';
import { useTasks } from '../../hooks/useTasks';
import { Icon } from '../../components/ui/Icon';
import { supabase } from '../../lib/supabase';export default function DecisionsPage() {
  const { workspace } = useWorkspace() as any;
  const { tasks } = useTasks(workspace?.id) as any;
  const [velocityPeriod, setVelocityPeriod] = useState('30D');

  const insights = useMemo(() => {
    const highRisk = (tasks || []).filter((t: any) => t.risk === 'high' && t.status !== 'done');
    const blocked  = (tasks || []).filter((t: any) => t.status === 'blocked');
    const total    = (tasks || []).length;
    const done     = (tasks || []).filter((t: any) => t.status === 'done').length;
    const velocity = total > 0 ? Math.round((done / total) * 100) : 0;
    return { highRisk, blocked, velocity, total, done };
  }, [tasks]);

  const [logs, setLogs] = useState<any[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);

  useEffect(() => {
    async function fetchLogs() {
      if (!tasks || tasks.length === 0) return;
      
      const taskIds = tasks.map((t: any) => t.id);
      
      const { data, error } = await supabase
        .from('task_history_logs')
        .select('*')
        .in('task_id', taskIds)
        .order('timestamp', { ascending: false })
        .limit(100);
        
      if (data && !error) {
         setLogs(data);
      }
    }
    fetchLogs();
  }, [tasks]);

  const decisionLog = useMemo(() => {
    if (!logs || logs.length === 0) return [];
    return logs.map((log: any, i: number) => {
      const taskName = tasks.find((t: any) => t.id === log.task_id)?.name || 'Unknown Task';
      return {
        title: `Task: ${taskName}`,
        desc: `${log.author_name} (${log.author_role}) changed ${log.field_name} from '${log.old_value || 'None'}' to '${log.new_value || 'None'}'.`,
        time: new Date(log.timestamp).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }),
        active: i === 0,
      };
    });
  }, [logs, tasks]);

  const heatmapData = useMemo(() => {
    const data = Array(35).fill(0.1); // baseline
    if (tasks) {
      tasks.forEach((t: any) => {
        if (!t.id) return;
        const idx = (t.id.charCodeAt(0) + t.id.charCodeAt(t.id.length - 1)) % 35;
        data[idx] += 0.3;
      });
    }
    const max = Math.max(...data, 1);
    return data.map(d => Math.min(1, d / max));
  }, [tasks]);

  const velocityPoints = useMemo(() => {
    const days = velocityPeriod === '7D' ? 7 : velocityPeriod === '15D' ? 15 : 30;
    const points: number[] = Array(days).fill(0);
    const completedTasks = (tasks || []).filter((t: any) => t.status === 'done');
    
    if (completedTasks && completedTasks.length > 0) {
      const now = new Date();
      now.setHours(23, 59, 59, 999);
      
      completedTasks.forEach((t: any) => {
        const dateStr = t.updated_at || t.created_at;
        if (!dateStr) return;
        const d = new Date(dateStr);
        const diffTime = now.getTime() - d.getTime();
        const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
        
        if (diffDays >= 0 && diffDays < days) {
          points[days - 1 - diffDays] += (t.estimated_hours || 1);
        }
      });
    }
    
    const maxVal = Math.max(10, ...points);
    return { points, maxVal };
  }, [tasks, velocityPeriod]);

  const svgPath = useMemo(() => {
    const w = 800, h = 200;
    const { points, maxVal } = velocityPoints;
    
    const pts = points.map((v, i) => ({
      x: (i / Math.max(1, points.length - 1)) * w,
      y: h * 0.95 - (v / maxVal) * (h * 0.8), // leave 20% padding at top, 5% at bottom
    }));
    
    let d = `M${pts[0].x},${pts[0].y}`;
    for (let i = 1; i < pts.length; i++) {
      const p0 = pts[i - 1];
      const p1 = pts[i];
      const cx1 = p0.x + (p1.x - p0.x) / 3;
      const cy1 = p0.y;
      const cx2 = p1.x - (p1.x - p0.x) / 3;
      const cy2 = p1.y;
      d += ` C${cx1},${cy1} ${cx2},${cy2} ${p1.x},${p1.y}`;
    }
    
    return { line: d, fill: `${d} V${h} H0 Z`, pts, maxVal };
  }, [velocityPoints]);

  return (
    <div className="flex flex-col gap-8 pb-16 font-geist" style={{ color: 'var(--pm-on-surface)' }}>

      {/* Header */}
      <div className="flex items-end justify-between px-1 pt-2">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Analytics &amp; Decision Center</h1>
          <p className="text-sm mt-1" style={{ color: 'var(--pm-on-surface-variant)' }}>
            Executive intelligence, scenario modeling, and strategic decision log.
          </p>
        </div>
        <div className="flex items-center gap-2 px-3 py-1 rounded-full"
          style={{ background: 'rgba(192,193,255,0.08)', border: '1px solid rgba(192,193,255,0.2)' }}>
          <span className="w-1.5 h-1.5 rounded-full bg-[#c0c1ff] operational-pulse" />
          <span className="font-mono-pm text-[10px] uppercase tracking-widest" style={{ color: 'var(--pm-primary)' }}>
            Operational
          </span>
        </div>
      </div>

      {/* Main Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">

        {/* Velocity Trend */}
        <div className="glass-panel rounded-xl p-6 lg:col-span-8 flex flex-col min-h-72">
          <div className="flex justify-between items-center mb-6">
            <div>
              <h2 className="text-base font-semibold" style={{ color: 'var(--pm-on-surface)' }}>Velocity Trends</h2>
              <p className="text-sm mt-0.5" style={{ color: 'var(--pm-on-surface-variant)' }}>
                System-wide throughput and delivery cadence
              </p>
            </div>
            <div className="flex gap-2">
              {['7D', '15D', '30D'].map((p) => (
                <button key={p} 
                  onClick={() => setVelocityPeriod(p)}
                  className="px-2 py-1 rounded font-mono-pm text-[11px] transition-all"
                  style={velocityPeriod === p
                    ? { background: 'var(--pm-surface-highest)', color: 'var(--pm-on-surface)' }
                    : { color: 'var(--pm-on-surface-variant)', border: '1px solid var(--pm-outline-variant)' }}>
                  {p}
                </button>
              ))}
            </div>
          </div>
          <div className="flex-1 relative">
            <svg className="w-full h-full" viewBox="0 0 800 200" preserveAspectRatio="none">
              <defs>
                <linearGradient id="decGrad" x1="0%" x2="0%" y1="0%" y2="100%">
                  <stop offset="0%" style={{ stopColor: '#c0c1ff', stopOpacity: 0.2 }} />
                  <stop offset="100%" style={{ stopColor: '#c0c1ff', stopOpacity: 0 }} />
                </linearGradient>
              </defs>
              {[0.25, 0.5, 0.75].map((f, i) => (
                <line key={i} x1="0" x2="800" y1={200 * f} y2={200 * f}
                  stroke="rgba(70,69,84,0.15)" strokeWidth="1" />
              ))}
              <path className="pulse-line" d={svgPath.line} fill="none" stroke="#c0c1ff" strokeWidth="2.5" strokeLinecap="round" />
              <path d={svgPath.fill} fill="url(#decGrad)" />
              {svgPath.pts.map((p, i) => (
                <circle
                  key={i}
                  cx={p.x}
                  cy={p.y}
                  r="3.5"
                  fill="#c0c1ff"
                  stroke="var(--pm-bg)"
                  strokeWidth="1.5"
                />
              ))}
            </svg>
            <div className="absolute left-0 flex flex-col justify-between pointer-events-none" style={{ top: '15%', bottom: '5%' }}>
              {['100%', '75%', '50%', '25%', '0%'].map((l, i) => (
                <span key={l} className="font-mono-pm text-[9px]" style={{ color: 'var(--pm-on-surface-variant)', opacity: 0.4 }}>
                  {i === 0 ? Math.round(svgPath.maxVal) : Math.round(svgPath.maxVal * (1 - i * 0.25))}
                </span>
              ))}
            </div>
          </div>
        </div>

        {/* Strategic Intelligence */}
        <div className="lg:col-span-4 rounded-xl p-6 flex flex-col"
          style={{ background: 'rgba(192,193,255,0.05)', border: '1px solid rgba(192,193,255,0.15)' }}>
          <div className="flex items-center gap-2 mb-5">
            <Icon name="auto_awesome" size={20} style={{ color: 'var(--pm-primary)' }} />
            <h2 className="text-base font-semibold" style={{ color: 'var(--pm-primary)' }}>Strategic Intelligence</h2>
          </div>
          <div className="space-y-3 flex-1">
            {[
              {
                label: 'Risk Forecast', color: 'var(--pm-primary)',
                text: insights.highRisk.length > 0
                  ? `${insights.highRisk.length} high-risk tasks detected. Slippage probability: ${Math.min(95, insights.highRisk.length * 15)}%.`
                  : 'All initiatives within acceptable risk parameters.',
              },
              {
                label: 'Resource Alert', color: 'var(--pm-tertiary)',
                text: insights.blocked.length > 0
                  ? `${insights.blocked.length} tasks currently blocked. Review dependencies.`
                  : 'No resource saturation detected. Capacity nominal.',
              },
              {
                label: 'Optimization Path', color: 'var(--pm-secondary)',
                text: `Current velocity at ${insights.velocity}%. ${insights.velocity < 60 ? 'Sprint scope reduction recommended.' : 'Maintain current cadence.'}`,
              },
            ].map((item, i) => (
              <div key={i} className="p-3 rounded-lg"
                style={{ background: 'var(--pm-surface)', border: '1px solid rgba(70,69,84,0.3)' }}>
                <span className="font-mono-pm text-[9px] uppercase tracking-widest block mb-1.5 font-bold"
                  style={{ color: item.color }}>
                  {item.label}
                </span>
                <p className="text-[13px] leading-relaxed" style={{ color: 'var(--pm-on-surface)' }}>
                  {item.text}
                </p>
              </div>
            ))}
          </div>
          <button className="mt-4 w-full py-2.5 rounded-lg font-mono-pm text-[11px] uppercase tracking-widest transition-all"
            style={{ background: 'var(--pm-surface-high)', border: '1px solid rgba(70,69,84,0.5)', color: 'var(--pm-on-surface-variant)' }}>
            Execute Scenario Modeling
          </button>
        </div>
      </div>

      {/* Workload Heatmap + Decision Log */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">

        {/* Workload Heatmap */}
        <div className="glass-panel rounded-xl p-6 lg:col-span-7">
          <div className="flex justify-between items-center mb-5">
            <h2 className="text-base font-semibold" style={{ color: 'var(--pm-on-surface)' }}>Workload Distribution</h2>
            <span className="font-mono-pm text-[10px]" style={{ color: 'var(--pm-on-surface-variant)' }}>
              Live Cluster Telemetry
            </span>
          </div>
          <div className="grid grid-cols-7 gap-2">
            {heatmapData.map((op, i) => {
              return (
                <div key={i} className="h-10 rounded-sm transition-all cursor-crosshair hover:scale-105"
                  style={{ background: 'var(--pm-primary)', opacity: op > 0.8 ? 0.9 : op > 0.4 ? 0.5 : 0.1 }} />
              );
            })}
          </div>
          <div className="mt-4 flex justify-between items-center">
            <div className="flex gap-4">
              {[['Idle', 0.1], ['Optimal', 0.5], ['Saturated', 0.9]].map(([label, op]) => (
                <div key={String(label)} className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-sm" style={{ background: 'var(--pm-primary)', opacity: Number(op) }} />
                  <span className="font-mono-pm text-[10px] uppercase" style={{ color: 'var(--pm-on-surface-variant)' }}>{label}</span>
                </div>
              ))}
            </div>
            <span className="font-mono-pm text-[12px]" style={{ color: 'var(--pm-on-surface-variant)' }}>
              Cluster Health: {Math.max(70, 100 - insights.highRisk.length * 3)}%
            </span>
          </div>
        </div>

        {/* Decision Log */}
        <div className="glass-panel rounded-xl p-6 lg:col-span-5 flex flex-col">
          <h2 className="text-base font-semibold mb-5" style={{ color: 'var(--pm-on-surface)' }}>
            Audit Trail &amp; Decisions
          </h2>
          <div className="space-y-4 overflow-y-auto pm-scrollbar flex-1 pr-1">
            {decisionLog.length > 0 ? decisionLog.slice(0, 8).map((item, i) => (
              <div key={i} className="flex gap-4 items-start pl-4 relative"
                style={{ borderLeft: '1px solid rgba(70,69,84,0.3)' }}>
                <div className="absolute -left-[4.5px] top-1.5 w-2 h-2 rounded-full"
                  style={{
                    background: item.active ? 'var(--pm-primary)' : 'var(--pm-outline-variant)',
                    boxShadow: item.active ? '0 0 8px rgba(192,193,255,0.6)' : 'none',
                  }} />
                <div className="flex-1">
                  <div className="flex justify-between items-center">
                    <span className="text-sm font-semibold" style={{ color: 'var(--pm-on-surface)' }}>{item.title}</span>
                    <span className="font-mono-pm text-[10px]" style={{ color: 'var(--pm-on-surface-variant)' }}>{item.time}</span>
                  </div>
                  <p className="text-[13px] mt-1 leading-relaxed" style={{ color: 'var(--pm-on-surface-variant)' }}>{item.desc}</p>
                </div>
              </div>
            )) : (
              <p className="text-sm text-center py-6" style={{ color: 'var(--pm-on-surface-variant)' }}>
                No recent decisions logged.
              </p>
            )}
          </div>
          <button 
            onClick={() => setIsModalOpen(true)}
            className="mt-4 font-mono-pm text-[10px] uppercase tracking-widest transition-opacity hover:opacity-100"
            style={{ color: 'var(--pm-primary)', opacity: 0.7 }}>
            View full decision log →
          </button>
        </div>
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.5)' }}>
          <div className="rounded-xl w-full max-w-3xl max-h-[80vh] flex flex-col" style={{ background: 'var(--pm-surface-high)', border: '1px solid rgba(70,69,84,0.5)' }}>
            <div className="p-5 border-b flex justify-between items-center" style={{ borderColor: 'rgba(70,69,84,0.3)' }}>
              <h2 className="text-lg font-semibold" style={{ color: 'var(--pm-on-surface)' }}>Full Decision Log</h2>
              <button onClick={() => setIsModalOpen(false)} className="text-text-tertiary hover:text-text-primary">
                <Icon name="close" size={24} />
              </button>
            </div>
            <div className="p-5 overflow-y-auto pm-scrollbar flex-1 space-y-4">
              {decisionLog.map((item, i) => (
                <div key={i} className="flex gap-4 items-start pl-4 relative" style={{ borderLeft: '1px solid rgba(70,69,84,0.3)' }}>
                  <div className="absolute -left-[4.5px] top-1.5 w-2 h-2 rounded-full"
                    style={{
                      background: item.active ? 'var(--pm-primary)' : 'var(--pm-outline-variant)',
                      boxShadow: item.active ? '0 0 8px rgba(192,193,255,0.6)' : 'none',
                    }} />
                  <div className="flex-1">
                    <div className="flex justify-between items-center">
                      <span className="text-sm font-semibold" style={{ color: 'var(--pm-on-surface)' }}>{item.title}</span>
                      <span className="font-mono-pm text-[10px]" style={{ color: 'var(--pm-on-surface-variant)' }}>{item.time}</span>
                    </div>
                    <p className="text-[13px] mt-1 leading-relaxed" style={{ color: 'var(--pm-on-surface-variant)' }}>{item.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}