import React, { useRef, useState, useMemo, useCallback, useEffect } from 'react';
import { useDashboard } from '../../context/DashboardContext';
import { AlertTriangle, BrainCircuit, Activity, Clock, GripVertical } from 'lucide-react';

// ─── Layout constants ─────────────────────────────────────────────────────────
const ROW_H      = 56;   // px per task row
const HEADER_H   = 72;   // px for date column header
const SIDEBAR_W  = 264;  // px for task-name sidebar
const PAD_DAYS   = 10;   // extra days on each side of the task range
const MS_DAY     = 86_400_000;
const MAX_BODY_H = 520;  // cap scrollable body height

// ─── Pixels per day per view mode ────────────────────────────────────────────
type ViewMode = 'Day' | 'Week' | 'Month';
const PPD: Record<ViewMode, number> = { Day: 52, Week: 20, Month: 5 };

// ─── Misc ─────────────────────────────────────────────────────────────────────
const MONTHS_FULL  = ['January','February','March','April','May','June','July','August','September','October','November','December'];
const MONTHS_SHORT = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
const DAYS_SHORT   = ['Su','Mo','Tu','We','Th','Fr','Sa'];

const STATUS_COLORS: Record<string, { bg: string; border: string; fill: string; dot: string; text: string }> = {
  backlog:     { bg: 'rgba(30,41,59,0.7)',   border: 'rgba(100,116,139,0.5)', fill: '#64748b', dot: '#94a3b8', text: '#cbd5e1' },
  in_progress: { bg: 'rgba(23,37,84,0.75)',  border: 'rgba(59,130,246,0.55)', fill: '#3b82f6', dot: '#60a5fa', text: '#93c5fd' },
  review:      { bg: 'rgba(69,26,3,0.7)',    border: 'rgba(245,158,11,0.5)', fill: '#f59e0b', dot: '#fbbf24', text: '#fde68a' },
  done:        { bg: 'rgba(2,44,34,0.7)',    border: 'rgba(34,197,94,0.5)',  fill: '#22c55e', dot: '#4ade80', text: '#bbf7d0' },
};

// ─── Date helpers ─────────────────────────────────────────────────────────────
const sod = (d: Date): Date => { const x = new Date(d); x.setHours(0, 0, 0, 0); return x; };
const addDays = (d: Date, n: number): Date => new Date(sod(d).getTime() + n * MS_DAY);
const diffDays = (a: Date, b: Date): number => Math.round((sod(a).getTime() - sod(b).getTime()) / MS_DAY);
const toDateStr = (d: Date): string =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

// ─── Column definition ────────────────────────────────────────────────────────
interface Col {
  date: Date;
  mainLabel: string;
  subLabel:  string;
  width: number;
  isWeekend?: boolean;
  isToday?: boolean;
}

function buildColumns(from: Date, to: Date, mode: ViewMode): Col[] {
  const cols: Col[] = [];
  const today = sod(new Date());

  if (mode === 'Day') {
    let d = sod(from);
    while (d.getTime() <= to.getTime()) {
      cols.push({
        date:      new Date(d),
        mainLabel: DAYS_SHORT[d.getDay()],
        subLabel:  String(d.getDate()),
        width:     PPD.Day,
        isWeekend: d.getDay() === 0 || d.getDay() === 6,
        isToday:   d.getTime() === today.getTime(),
      });
      d = addDays(d, 1);
    }
  } else if (mode === 'Week') {
    let d = sod(from);
    d = addDays(d, -d.getDay()); // snap to Sunday
    while (d.getTime() <= to.getTime()) {
      const we = addDays(d, 6);
      cols.push({
        date:      new Date(d),
        mainLabel: `${MONTHS_SHORT[d.getMonth()]} ${d.getDate()}`,
        subLabel:  `→ ${MONTHS_SHORT[we.getMonth()]} ${we.getDate()}`,
        width:     PPD.Week * 7,
      });
      d = addDays(d, 7);
    }
  } else {
    // Month
    let d = new Date(from.getFullYear(), from.getMonth(), 1);
    while (d.getTime() <= to.getTime()) {
      const daysInMonth = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
      cols.push({
        date:      new Date(d),
        mainLabel: MONTHS_SHORT[d.getMonth()],
        subLabel:  String(d.getFullYear()),
        width:     daysInMonth * PPD.Month,
      });
      d = new Date(d.getFullYear(), d.getMonth() + 1, 1);
    }
  }
  return cols;
}

// ─── X ↔ Date conversions ─────────────────────────────────────────────────────
const getX    = (date: Date, origin: Date, mode: ViewMode) => diffDays(date, origin) * PPD[mode];

// ─── Drag state ───────────────────────────────────────────────────────────────
interface DragState {
  taskId: string;
  mode: 'move' | 'resize';
  startClientX: number;
  origStartDays: number;
  origEndDays:   number;
}

// ─── Main component ───────────────────────────────────────────────────────────
export function GanttView() {
  const { tasks, dependencies, profiles, updateTaskDates, notify } = useDashboard();

  const [viewMode,  setViewMode]  = useState<ViewMode>('Week');
  const [showIntel, setShowIntel] = useState(true);
  const [dragState, setDragState] = useState<DragState | null>(null);
  const [overrides, setOverrides] = useState<Record<string, { start: Date; end: Date }>>({});
  const [hoveredId, setHoveredId] = useState<string | null>(null);

  const timelineRef    = useRef<HTMLDivElement>(null);
  const sidebarBodyRef = useRef<HTMLDivElement>(null);
  const containerRef   = useRef<HTMLDivElement>(null);

  // ── Normalize tasks to Gantt format ──────────────────────────────────────
  const baseTasks = useMemo(() => tasks.map(t => {
    let start = sod(new Date());
    if (t.start_date) { const d = new Date(t.start_date); if (!isNaN(d.getTime())) start = sod(d); }
    else if (t.created_at) { const d = new Date(t.created_at); if (!isNaN(d.getTime())) start = sod(d); }

    let end = addDays(start, 1);
    if (t.deadline) { const d = new Date(t.deadline); if (!isNaN(d.getTime()) && d > start) end = sod(d); }
    else if (t.estimated_hours && t.estimated_hours > 0) end = addDays(start, Math.max(1, Math.ceil(t.estimated_hours / 8)));

    const progress = ({ backlog: 0, in_progress: 50, review: 85, done: 100 } as Record<string, number>)[t.status] ?? 0;
    return { ...t, ganttStart: start, ganttEnd: end, progress };
  }), [tasks]);

  // Apply local drag overrides
  const effectiveTasks = useMemo(() =>
    baseTasks.map(t => ({
      ...t,
      ganttStart: overrides[t.id]?.start ?? t.ganttStart,
      ganttEnd:   overrides[t.id]?.end   ?? t.ganttEnd,
    })), [baseTasks, overrides]);

  // ── Timeline bounds ───────────────────────────────────────────────────────
  const { origin, terminus } = useMemo(() => {
    if (effectiveTasks.length === 0) {
      return { origin: addDays(sod(new Date()), -14), terminus: addDays(sod(new Date()), 45) };
    }
    const starts = effectiveTasks.map(t => t.ganttStart.getTime());
    const ends   = effectiveTasks.map(t => t.ganttEnd.getTime());
    return {
      origin:  addDays(sod(new Date(Math.min(...starts))), -PAD_DAYS),
      terminus: addDays(sod(new Date(Math.max(...ends))), PAD_DAYS),
    };
  }, [effectiveTasks]);

  const columns    = useMemo(() => buildColumns(origin, terminus, viewMode), [origin, terminus, viewMode]);
  const totalWidth = useMemo(() => {
    if (columns.length === 0) return 800;
    const last = columns[columns.length - 1];
    return getX(last.date, origin, viewMode) + last.width + 32;
  }, [columns, origin, viewMode]);

  const todayX = useMemo(() => getX(new Date(), origin, viewMode), [origin, viewMode]);
  const totalBodyH = effectiveTasks.length * ROW_H;
  const bodyH = Math.min(totalBodyH || 200, MAX_BODY_H);

  // ── Sync sidebar scroll with timeline ────────────────────────────────────
  const onTimelineScroll = useCallback(() => {
    if (timelineRef.current && sidebarBodyRef.current) {
      sidebarBodyRef.current.scrollTop = timelineRef.current.scrollTop;
    }
  }, []);

  // ── Drag logic ────────────────────────────────────────────────────────────
  const startDrag = useCallback((e: React.PointerEvent, taskId: string, mode: 'move' | 'resize') => {
    e.preventDefault();
    e.stopPropagation();
    const t = effectiveTasks.find(x => x.id === taskId);
    if (!t) return;
    containerRef.current?.setPointerCapture(e.pointerId);
    setDragState({
      taskId, mode,
      startClientX:  e.clientX,
      origStartDays: diffDays(t.ganttStart, origin),
      origEndDays:   diffDays(t.ganttEnd,   origin),
    });
  }, [effectiveTasks, origin]);

  const onPointerMove = useCallback((e: React.PointerEvent) => {
    if (!dragState) return;
    const deltaDays = Math.round((e.clientX - dragState.startClientX) / PPD[viewMode]);
    let newStart = addDays(origin, dragState.origStartDays);
    let newEnd   = addDays(origin, dragState.origEndDays);
    if (dragState.mode === 'move') {
      newStart = addDays(origin, dragState.origStartDays + deltaDays);
      newEnd   = addDays(origin, dragState.origEndDays   + deltaDays);
    } else {
      newEnd = addDays(origin, dragState.origEndDays + deltaDays);
      if (newEnd <= newStart) newEnd = addDays(newStart, 1);
    }
    setOverrides(prev => ({ ...prev, [dragState.taskId]: { start: newStart, end: newEnd } }));
  }, [dragState, origin, viewMode]);

  const onPointerUp = useCallback(async (e: React.PointerEvent) => {
    if (!dragState) return;
    const ov = overrides[dragState.taskId];
    if (ov) {
      try {
        const t = baseTasks.find(x => x.id === dragState.taskId);
        await updateTaskDates(dragState.taskId, toDateStr(ov.start), toDateStr(ov.end));
        notify(`Rescheduled "${t?.name?.toUpperCase() ?? dragState.taskId}" → ${toDateStr(ov.start)} to ${toDateStr(ov.end)}`, 'success');
      } catch (err: any) {
        notify(err.message || 'Failed to reschedule', 'error');
        setOverrides(prev => { const n = { ...prev }; delete n[dragState.taskId]; return n; });
      }
    }
    setDragState(null);
  }, [dragState, overrides, baseTasks, updateTaskDates, notify]);

  // ── Intel alerts ──────────────────────────────────────────────────────────
  const alerts = useMemo(() => {
    const out: Array<{ id: string; title: string; message: string; severity: 'high' | 'medium' | 'info' }> = [];
    tasks.forEach(t => {
      if (t.status === 'done') return;
      if (t.delay_drift_days && t.delay_drift_days > 0)
        out.push({ id: `d-${t.id}`, title: 'Timeline Drift', message: `"${t.name}" predicted +${t.delay_drift_days}d slip`, severity: t.delay_drift_days > 2 ? 'high' : 'medium' });
      if (t.risk === 'high')
        out.push({ id: `r-${t.id}`, title: 'High Delivery Risk', message: `"${t.name}" has high estimation variance`, severity: 'high' });
    });
    profiles?.forEach(p => {
      const hrs = tasks.filter(t => t.assignee_id === p.id && t.status !== 'done').reduce((s, t) => s + (t.estimated_hours || 0), 0);
      const cap = 40 * (p.availability_factor || 1);
      if (hrs > cap) out.push({ id: `o-${p.id}`, title: 'Capacity Breach', message: `"${p.full_name || p.email}" ${hrs}h / ${cap}h limit`, severity: 'high' });
    });
    return out;
  }, [tasks, profiles]);

  // ─────────────────────────────────────────────────────────────────────────
  return (
    <div className="flex flex-col gap-5">

      {/* ── Controls bar ─────────────────────────────────────────────────── */}
      <div className="flex flex-wrap justify-between items-center gap-4 bg-[#07080e]/70 border border-white/10 rounded-xl px-5 py-3.5 backdrop-blur-md">
        <div>
          <h3 className="text-sm font-semibold uppercase tracking-wider text-cyan-400">Timeline Engine</h3>
          <p className="text-[10px] font-mono text-white/35 mt-0.5">Drag bars to reschedule · Drag right edge to resize · Scroll to navigate</p>
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          {/* View mode */}
          <div className="flex bg-black/50 border border-white/10 p-0.5 rounded-md gap-0.5">
            {(['Day', 'Week', 'Month'] as ViewMode[]).map(m => (
              <button key={m} onClick={() => setViewMode(m)}
                className={`px-3.5 py-1.5 text-[10px] font-mono uppercase tracking-wider rounded-sm transition-all cursor-pointer ${
                  viewMode === m
                    ? 'bg-blue-600/35 text-blue-300 border border-blue-500/30 shadow-[0_0_14px_rgba(59,130,246,0.18)]'
                    : 'text-white/45 hover:text-white/80 border border-transparent'
                }`}
              >{m}</button>
            ))}
          </div>
          {/* Intel toggle */}
          <button onClick={() => setShowIntel(v => !v)}
            className={`flex items-center gap-1.5 px-3 py-1.5 text-[10px] font-mono uppercase tracking-wider border rounded-md transition-all cursor-pointer ${
              showIntel
                ? 'bg-cyan-500/10 border-cyan-500/30 text-cyan-400 shadow-[0_0_10px_rgba(6,182,212,0.1)]'
                : 'bg-black/30 border-white/10 text-white/40 hover:text-cyan-400 hover:border-cyan-500/25'
            }`}
          >
            <BrainCircuit className="w-3 h-3" />
            {showIntel ? 'Hide Intel' : 'Intel'}
            {alerts.length > 0 && (
              <span className="ml-1 bg-rose-500 text-white text-[8px] font-bold rounded-full w-3.5 h-3.5 flex items-center justify-center leading-none">
                {alerts.length}
              </span>
            )}
          </button>
        </div>
      </div>

      {/* ── Gantt + Intel side-by-side ────────────────────────────────────── */}
      <div className="flex gap-4 items-start min-h-0">

        {/* ── Gantt Panel ───────────────────────────────────────────────── */}
        <div
          ref={containerRef}
          className={`flex-1 min-w-0 bg-[#07080e]/80 border border-white/10 rounded-xl overflow-hidden backdrop-blur-md ${dragState ? 'cursor-grabbing select-none' : ''}`}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={() => setDragState(null)}
        >
          {effectiveTasks.length === 0 ? (
            <div className="h-64 flex flex-col justify-center items-center gap-4 text-center p-8">
              <div className="w-10 h-10 rounded-full border border-dashed border-white/15 flex items-center justify-center">
                <Activity className="w-4 h-4 text-white/25" />
              </div>
              <p className="text-[11px] font-mono uppercase tracking-widest text-white/30">No tasks to render on timeline</p>
              <button
                onClick={() => window.dispatchEvent(new CustomEvent('switch-to-board'))}
                className="px-4 py-2 border border-cyan-500/30 bg-cyan-500/8 hover:bg-cyan-500/18 text-cyan-400 text-[10px] font-mono uppercase tracking-wider rounded-md transition-all cursor-pointer"
              >
                + Create first task
              </button>
            </div>
          ) : (
            <div className="flex" style={{ height: `${HEADER_H + bodyH}px` }}>

              {/* ── Sidebar ──────────────────────────────────────────────── */}
              <div className="flex-none flex flex-col z-10" style={{ width: `${SIDEBAR_W}px`, background: 'rgba(5,6,10,0.97)' }}>
                {/* Sidebar header spacer (aligned with timeline header) */}
                <div
                  className="flex-none flex items-end px-4 pb-3 border-b border-r border-white/[0.08]"
                  style={{ height: `${HEADER_H}px` }}
                >
                  <span className="text-[9px] font-mono uppercase tracking-[0.18em] text-white/20">Task · Status</span>
                </div>

                {/* Sidebar body (synced scroll) */}
                <div
                  ref={sidebarBodyRef}
                  className="flex-1 overflow-hidden border-r border-white/[0.07]"
                  style={{ overflowY: 'hidden' }}
                >
                  {effectiveTasks.map((task, i) => {
                    const sc = STATUS_COLORS[task.status] ?? STATUS_COLORS.backlog;
                    return (
                      <div
                        key={task.id}
                        className={`flex items-center gap-3 px-4 border-b border-white/[0.04] transition-colors ${hoveredId === task.id ? 'bg-white/[0.03]' : 'hover:bg-white/[0.02]'}`}
                        style={{ height: `${ROW_H}px` }}
                        onMouseEnter={() => setHoveredId(task.id)}
                        onMouseLeave={() => setHoveredId(null)}
                      >
                        <div
                          className="w-2 h-2 rounded-full flex-none ring-1 ring-offset-0"
                          style={{ background: sc.dot, boxShadow: `0 0 6px ${sc.dot}55` }}
                        />
                        <div className="min-w-0">
                          <p className="text-[11.5px] font-medium text-white/85 truncate leading-tight">{task.name}</p>
                          <p className="text-[9px] font-mono uppercase tracking-wider mt-0.5" style={{ color: sc.text }}>{task.status.replace('_', ' ')}</p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* ── Timeline scroll area ──────────────────────────────────── */}
              <div
                ref={timelineRef}
                className="flex-1 overflow-auto"
                onScroll={onTimelineScroll}
                style={{ overflowX: 'auto', overflowY: 'auto' }}
              >
                <div style={{ width: `${totalWidth}px`, minWidth: '100%' }}>

                  {/* Header */}
                  <div
                    className="sticky top-0 z-20 flex border-b border-white/[0.09]"
                    style={{ height: `${HEADER_H}px`, background: 'rgba(5,6,10,0.96)', backdropFilter: 'blur(8px)' }}
                  >
                    {columns.map((col, ci) => {
                      const x = getX(col.date, origin, viewMode);
                      return (
                        <div
                          key={ci}
                          className="flex-none flex flex-col items-center justify-end pb-2.5 border-r border-white/[0.05]"
                          style={{
                            width:      `${col.width}px`,
                            background: col.isToday
                              ? 'rgba(6,182,212,0.06)'
                              : col.isWeekend
                              ? 'rgba(255,255,255,0.008)'
                              : 'transparent',
                          }}
                        >
                          <span className={`text-[10px] font-semibold font-mono uppercase tracking-wider leading-tight ${col.isToday ? 'text-cyan-400' : 'text-white/65'}`}>
                            {col.mainLabel}
                          </span>
                          {col.subLabel && (
                            <span className={`text-[8.5px] font-mono mt-0.5 leading-tight ${col.isToday ? 'text-cyan-500/70' : 'text-white/25'}`}>
                              {col.subLabel}
                            </span>
                          )}
                        </div>
                      );
                    })}
                  </div>

                  {/* Body */}
                  <div className="relative" style={{ height: `${totalBodyH}px` }}>

                    {/* Column shading */}
                    {columns.map((col, ci) => {
                      const x = getX(col.date, origin, viewMode);
                      return (
                        <div
                          key={ci}
                          className="absolute top-0 bottom-0 border-r border-white/[0.04]"
                          style={{
                            left:       `${x}px`,
                            width:      `${col.width}px`,
                            background: col.isToday
                              ? 'rgba(6,182,212,0.04)'
                              : col.isWeekend
                              ? 'rgba(255,255,255,0.008)'
                              : 'transparent',
                          }}
                        />
                      );
                    })}

                    {/* Row separators */}
                    {effectiveTasks.map((_, i) => (
                      <div
                        key={i}
                        className="absolute left-0 right-0 border-b border-white/[0.03]"
                        style={{ top: `${(i + 1) * ROW_H - 1}px` }}
                      />
                    ))}

                    {/* Row hover highlight */}
                    {hoveredId && (() => {
                      const idx = effectiveTasks.findIndex(t => t.id === hoveredId);
                      return idx >= 0 ? (
                        <div
                          className="absolute left-0 right-0 pointer-events-none"
                          style={{ top: `${idx * ROW_H}px`, height: `${ROW_H}px`, background: 'rgba(255,255,255,0.018)' }}
                        />
                      ) : null;
                    })()}

                    {/* Today vertical line */}
                    {todayX >= 0 && (
                      <div
                        className="absolute top-0 bottom-0 w-px pointer-events-none z-20"
                        style={{ left: `${todayX}px`, background: 'rgba(6,182,212,0.65)', boxShadow: '0 0 8px rgba(6,182,212,0.35)' }}
                      >
                        <div className="absolute -top-px -translate-x-1/2 px-1.5 py-0.5 text-[8px] font-mono uppercase font-bold text-cyan-400 bg-[#05060a] border border-cyan-500/40 rounded-sm whitespace-nowrap">
                          Today
                        </div>
                      </div>
                    )}

                    {/* Dependency arrows SVG */}
                    <svg
                      className="absolute inset-0 pointer-events-none z-10"
                      style={{ width: `${totalWidth}px`, height: `${totalBodyH}px` }}
                    >
                      <defs>
                        <marker id="gantt-arrow" markerWidth="7" markerHeight="7" refX="6" refY="3.5" orient="auto">
                          <path d="M0,0 L0,7 L7,3.5 z" fill="rgba(6,182,212,0.45)" />
                        </marker>
                      </defs>
                      {(dependencies ?? []).map((dep, di) => {
                        const fromTask = effectiveTasks.find(t => t.id === dep.depends_on_task_id);
                        const toTask   = effectiveTasks.find(t => t.id === dep.task_id);
                        if (!fromTask || !toTask) return null;
                        const fi = effectiveTasks.indexOf(fromTask);
                        const ti = effectiveTasks.indexOf(toTask);
                        const fx = getX(fromTask.ganttEnd,   origin, viewMode);
                        const fy = fi * ROW_H + ROW_H / 2;
                        const tx = getX(toTask.ganttStart,   origin, viewMode);
                        const ty = ti * ROW_H + ROW_H / 2;
                        const mx = (fx + tx) / 2;
                        return (
                          <path
                            key={di}
                            d={`M ${fx} ${fy} C ${mx} ${fy}, ${mx} ${ty}, ${tx} ${ty}`}
                            fill="none"
                            stroke="rgba(6,182,212,0.3)"
                            strokeWidth="1.5"
                            strokeDasharray="4,3"
                            markerEnd="url(#gantt-arrow)"
                          />
                        );
                      })}
                    </svg>

                    {/* Task bars */}
                    {effectiveTasks.map((task, i) => {
                      const sc      = STATUS_COLORS[task.status] ?? STATUS_COLORS.backlog;
                      const barX    = getX(task.ganttStart, origin, viewMode);
                      const barW    = Math.max(getX(task.ganttEnd, origin, viewMode) - barX, 28);
                      const barTop  = i * ROW_H + 10;
                      const barH    = ROW_H - 20;
                      const progW   = Math.max(0, (task.progress / 100) * barW);
                      const isDrag  = dragState?.taskId === task.id;
                      const isHov   = hoveredId === task.id;

                      return (
                        <div
                          key={task.id}
                          className={`absolute rounded-md border overflow-hidden flex items-center select-none transition-shadow ${isDrag ? 'z-30 shadow-[0_0_20px_rgba(59,130,246,0.45)]' : isHov ? 'z-20 shadow-[0_0_12px_rgba(255,255,255,0.08)]' : 'z-10'}`}
                          style={{
                            left:        `${barX}px`,
                            top:         `${barTop}px`,
                            width:       `${barW}px`,
                            height:      `${barH}px`,
                            background:  sc.bg,
                            borderColor: sc.border,
                            cursor:      dragState ? (dragState.mode === 'move' ? 'grabbing' : 'ew-resize') : 'grab',
                          }}
                          onPointerDown={e => startDrag(e, task.id, 'move')}
                          onMouseEnter={() => setHoveredId(task.id)}
                          onMouseLeave={() => setHoveredId(null)}
                        >
                          {/* Progress fill */}
                          <div
                            className="absolute left-0 top-0 bottom-0 opacity-55"
                            style={{ width: `${progW}px`, background: sc.fill, borderRadius: '6px 0 0 6px' }}
                          />

                          {/* Progress % glow line at top */}
                          <div
                            className="absolute top-0 left-0 h-0.5 opacity-80"
                            style={{ width: `${progW}px`, background: sc.fill, boxShadow: `0 0 4px ${sc.fill}` }}
                          />

                          {/* Label */}
                          <span
                            className="relative z-10 px-2.5 text-[10.5px] font-mono font-semibold uppercase tracking-wide truncate pointer-events-none"
                            style={{ color: 'rgba(255,255,255,0.88)' }}
                          >
                            {task.name}
                          </span>

                          {/* Resize handle */}
                          <div
                            className="absolute right-0 top-0 bottom-0 w-3.5 flex items-center justify-center cursor-ew-resize opacity-0 hover:opacity-100 transition-opacity z-20"
                            onPointerDown={e => { e.stopPropagation(); startDrag(e, task.id, 'resize'); }}
                          >
                            <GripVertical className="w-3 h-3" style={{ color: sc.fill }} />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* ── Intel Panel ───────────────────────────────────────────────── */}
        {showIntel && (
          <div className="w-76 flex-none bg-[#07080e]/85 border border-white/10 rounded-xl p-5 backdrop-blur-md" style={{ minWidth: '280px', maxWidth: '304px' }}>
            <div className="flex items-center gap-2 mb-5 pb-4 border-b border-white/[0.07]">
              <BrainCircuit className="w-4 h-4 text-cyan-400" />
              <h3 className="text-xs font-semibold uppercase tracking-wider text-white/90">Timeline Intel</h3>
              {alerts.length > 0 && (
                <span className="ml-auto text-[9px] font-mono text-rose-400 bg-rose-500/10 border border-rose-500/25 px-1.5 py-0.5 rounded-sm">
                  {alerts.length} alert{alerts.length !== 1 ? 's' : ''}
                </span>
              )}
            </div>

            <div className="space-y-2.5 max-h-80 overflow-y-auto pr-1 custom-scrollbar">
              {alerts.length === 0 ? (
                <div className="h-28 flex flex-col justify-center items-center text-center p-4 border border-dashed border-white/[0.06] rounded-lg">
                  <Activity className="w-4 h-4 text-white/15 mb-2 animate-pulse" />
                  <p className="text-[9px] font-mono uppercase tracking-widest text-white/20">Zero anomalies detected</p>
                </div>
              ) : alerts.map(a => (
                <div key={a.id} className={`p-3 rounded-lg border flex gap-2.5 ${
                  a.severity === 'high'
                    ? 'bg-rose-950/25 border-rose-500/20 text-rose-200'
                    : a.severity === 'medium'
                    ? 'bg-amber-950/25 border-amber-500/20 text-amber-200'
                    : 'bg-blue-950/25 border-blue-500/20 text-blue-200'
                }`}>
                  <div className="mt-0.5 flex-none">
                    {a.severity === 'high'
                      ? <AlertTriangle className="w-3.5 h-3.5 text-rose-500 animate-pulse" />
                      : a.severity === 'medium'
                      ? <AlertTriangle className="w-3.5 h-3.5 text-amber-500" />
                      : <Clock className="w-3.5 h-3.5 text-blue-400" />}
                  </div>
                  <div className="min-w-0">
                    <h4 className="text-[9px] font-mono uppercase tracking-wider font-bold mb-1">{a.title}</h4>
                    <p className="text-[10px] leading-relaxed text-white/65 break-words">{a.message}</p>
                  </div>
                </div>
              ))}
            </div>

            {/* Aggregate stats */}
            <div className="mt-5 pt-4 border-t border-white/[0.06] space-y-2.5">
              <div className="flex justify-between items-center">
                <span className="text-[9px] font-mono uppercase tracking-wider text-white/40">Critical Drift</span>
                <span className={`text-[9px] font-mono font-bold ${tasks.some(t => t.delay_drift_days && t.delay_drift_days > 0) ? 'text-rose-400' : 'text-emerald-400'}`}>
                  {tasks.some(t => t.delay_drift_days && t.delay_drift_days > 0) ? '⚠ ACTIVE' : '✓ CLEAR'}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-[9px] font-mono uppercase tracking-wider text-white/40">Load Breaches</span>
                <span className={`text-[9px] font-mono font-bold ${alerts.filter(a => a.id.startsWith('o-')).length > 0 ? 'text-rose-400 animate-pulse' : 'text-emerald-400'}`}>
                  {alerts.filter(a => a.id.startsWith('o-')).length} BREACH{alerts.filter(a => a.id.startsWith('o-')).length !== 1 ? 'ES' : ''}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-[9px] font-mono uppercase tracking-wider text-white/40">Tasks Mapped</span>
                <span className="text-[9px] font-mono font-bold text-cyan-400">{effectiveTasks.length}</span>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
