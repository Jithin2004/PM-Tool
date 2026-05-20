import React, { useRef, useState, useMemo, useCallback, useEffect } from 'react';
import { useDashboard } from '../../context/DashboardContext';
import {
  AlertTriangle, BrainCircuit, Activity, Clock, GripVertical, Diamond, Calendar,
  Folder, BookOpen, ListChecks, Target, Users
} from 'lucide-react';
import type { Milestone, Meeting, Project, Epic, CalendarEvent } from '../../types';

const ROW_H      = 56;
const HEADER_H   = 72;
const SIDEBAR_W  = 320;
const PAD_DAYS   = 10;
const MS_DAY     = 86_400_000;
const MAX_BODY_H = 520;

type ViewMode = 'Day' | 'Week' | 'Month';
const PPD: Record<ViewMode, number> = { Day: 52, Week: 20, Month: 5 };

const MONTHS_SHORT = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
const DAYS_SHORT   = ['Su','Mo','Tu','We','Th','Fr','Sa'];

const STATUS_COLORS: Record<string, { bg: string; border: string; fill: string; dot: string; text: string }> = {
  backlog:     { bg: 'rgba(30,41,59,0.7)',   border: 'rgba(100,116,139,0.5)', fill: '#64748b', dot: '#94a3b8', text: '#cbd5e1' },
  in_progress: { bg: 'rgba(23,37,84,0.75)',  border: 'rgba(59,130,246,0.55)', fill: '#3b82f6', dot: '#60a5fa', text: '#93c5fd' },
  review:      { bg: 'rgba(69,26,3,0.7)',    border: 'rgba(245,158,11,0.5)', fill: '#f59e0b', dot: '#fbbf24', text: '#fde68a' },
  done:        { bg: 'rgba(2,44,34,0.7)',    border: 'rgba(34,197,94,0.5)',  fill: '#22c55e', dot: '#4ade80', text: '#bbf7d0' },
};

const HIERARCHY_COLORS: Record<string, string> = {
  project: '#60a5fa',
  phase: '#a78bfa',
  epic: '#f472b6',
  story: '#34d399',
  task: '#94a3b8',
};

const sod = (d: Date): Date => { const x = new Date(d); x.setHours(0, 0, 0, 0); return x; };
const addDays = (d: Date, n: number): Date => new Date(sod(d).getTime() + n * MS_DAY);
const diffDays = (a: Date, b: Date): number => Math.round((sod(a).getTime() - sod(b).getTime()) / MS_DAY);
const toDateStr = (d: Date): string => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

interface Col {
  date: Date; mainLabel: string; subLabel: string; width: number;
  isWeekend?: boolean; isToday?: boolean;
}

function buildColumns(from: Date, to: Date, mode: ViewMode): Col[] {
  const cols: Col[] = [];
  const today = sod(new Date());
  if (mode === 'Day') {
    let d = sod(from);
    while (d.getTime() <= to.getTime()) {
      cols.push({ date: new Date(d), mainLabel: DAYS_SHORT[d.getDay()], subLabel: String(d.getDate()), width: PPD.Day, isWeekend: d.getDay() === 0 || d.getDay() === 6, isToday: d.getTime() === today.getTime() });
      d = addDays(d, 1);
    }
  } else if (mode === 'Week') {
    let d = sod(from); d = addDays(d, -d.getDay());
    while (d.getTime() <= to.getTime()) {
      const we = addDays(d, 6);
      cols.push({ date: new Date(d), mainLabel: `${MONTHS_SHORT[d.getMonth()]} ${d.getDate()}`, subLabel: `→ ${MONTHS_SHORT[we.getMonth()]} ${we.getDate()}`, width: PPD.Week * 7 });
      d = addDays(d, 7);
    }
  } else {
    let d = new Date(from.getFullYear(), from.getMonth(), 1);
    while (d.getTime() <= to.getTime()) {
      const daysInMonth = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
      cols.push({ date: new Date(d), mainLabel: MONTHS_SHORT[d.getMonth()], subLabel: String(d.getFullYear()), width: daysInMonth * PPD.Month });
      d = new Date(d.getFullYear(), d.getMonth() + 1, 1);
    }
  }
  return cols;
}

const getX = (date: Date, origin: Date, mode: ViewMode) => diffDays(date, origin) * PPD[mode];

interface DragState { taskId: string; mode: 'move' | 'resize'; startClientX: number; origStartDays: number; origEndDays: number; }

interface GanttHierarchyItem {
  id: string;
  type: 'project' | 'phase' | 'epic' | 'story' | 'task';
  name: string;
  start: Date;
  end: Date;
  progress: number;
  parentId?: string;
  status?: string;
  depth: number;
}

export function GanttView({
  milestones = [], meetings = [], projects = [], epics = [], calendarEvents = []
}: {
  milestones?: Milestone[];
  meetings?: Meeting[];
  projects?: Project[];
  epics?: Epic[];
  calendarEvents?: CalendarEvent[];
}) {
  const { tasks, dependencies, profiles, updateTaskDates, notify } = useDashboard();

  const [viewMode,  setViewMode]  = useState<ViewMode>('Week');
  const [showIntel, setShowIntel] = useState(true);
  const [dragState, setDragState] = useState<DragState | null>(null);
  const [overrides, setOverrides] = useState<Record<string, { start: Date; end: Date }>>({});
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());

  const timelineRef    = useRef<HTMLDivElement>(null);
  const sidebarBodyRef = useRef<HTMLDivElement>(null);
  const containerRef   = useRef<HTMLDivElement>(null);

  // Build hierarchy
  const hierarchy: GanttHierarchyItem[] = useMemo(() => {
    const items: GanttHierarchyItem[] = [];
    const isCollapsed = (id: string) => collapsed.has(id);

    // Projects
    projects.forEach(p => {
      const pTasks = tasks.filter(t => t.project_id === p.id);
      const pStart = pTasks.length > 0 ? sod(new Date(Math.min(...pTasks.map(t => new Date(t.start_date || t.created_at).getTime())))) : sod(new Date());
      const pEnd = pTasks.length > 0 ? sod(new Date(Math.max(...pTasks.map(t => new Date(t.deadline || t.created_at).getTime())))) : addDays(pStart, 14);
      items.push({ id: `proj-${p.id}`, type: 'project', name: p.name, start: pStart, end: pEnd, progress: pTasks.length > 0 ? Math.round(pTasks.filter(t => t.status === 'done').length / pTasks.length * 100) : 0, depth: 0 });

      if (isCollapsed(`proj-${p.id}`)) return;

      // Epics under project
      const projectEpics = epics.filter(e => e.project_id === p.id);
      projectEpics.forEach(ep => {
        const epTasks = tasks.filter(t => t.project_id === p.id && t.epic_id === ep.id);
        const epStart = epTasks.length > 0 ? sod(new Date(Math.min(...epTasks.map(t => new Date(t.start_date || t.created_at).getTime())))) : sod(new Date());
        const epEnd = epTasks.length > 0 ? sod(new Date(Math.max(...epTasks.map(t => new Date(t.deadline || t.created_at).getTime())))) : addDays(epStart, 7);
        items.push({ id: `epic-${ep.id}`, type: 'epic', name: `📋 ${ep.name}`, start: epStart, end: epEnd, progress: epTasks.length > 0 ? Math.round(epTasks.filter(t => t.status === 'done').length / epTasks.length * 100) : 0, parentId: `proj-${p.id}`, depth: 1 });

        if (isCollapsed(`epic-${ep.id}`)) return;

        // Tasks under epic
        epTasks.forEach(t => {
          let start = sod(new Date()); let end = addDays(start, 1);
          if (t.start_date) { const d = new Date(t.start_date); if (!isNaN(d.getTime())) start = sod(d); }
          if (t.deadline) { const d = new Date(t.deadline); if (!isNaN(d.getTime()) && d > start) end = sod(d); }
          const progress = ({ backlog: 0, ready: 0, in_progress: 50, review: 85, done: 100 })[t.status] ?? 0;
          items.push({ id: t.id, type: 'task', name: t.name, start, end, progress, parentId: `epic-${ep.id}`, status: t.status, depth: 2 });
        });
      });

      // Orphan tasks (no epic)
      const orphanTasks = pTasks.filter(t => !t.epic_id);
      if (!collapsed.has(`proj-${p.id}`) && orphanTasks.length > 0) {
        orphanTasks.forEach(t => {
          let start = sod(new Date()); let end = addDays(start, 1);
          if (t.start_date) { const d = new Date(t.start_date); if (!isNaN(d.getTime())) start = sod(d); }
          if (t.deadline) { const d = new Date(t.deadline); if (!isNaN(d.getTime()) && d > start) end = sod(d); }
          const progress = ({ backlog: 0, ready: 0, in_progress: 50, review: 85, done: 100 })[t.status] ?? 0;
          items.push({ id: t.id, type: 'task', name: t.name, start, end, progress, parentId: `proj-${p.id}`, status: t.status, depth: 2 });
        });
      }
    });

    return items;
  }, [projects, epics, tasks, collapsed]);

  const effectiveItems = useMemo(() =>
    hierarchy.map(item => ({
      ...item,
      start: overrides[item.id]?.start ?? item.start,
      end: overrides[item.id]?.end ?? item.end,
    })), [hierarchy, overrides]);

  const { origin, terminus } = useMemo(() => {
    if (effectiveItems.length === 0) return { origin: addDays(sod(new Date()), -14), terminus: addDays(sod(new Date()), 45) };
    const starts = effectiveItems.map(t => t.start.getTime());
    const ends = effectiveItems.map(t => t.end.getTime());
    return { origin: addDays(sod(new Date(Math.min(...starts))), -PAD_DAYS), terminus: addDays(sod(new Date(Math.max(...ends))), PAD_DAYS) };
  }, [effectiveItems]);

  const columns = useMemo(() => buildColumns(origin, terminus, viewMode), [origin, terminus, viewMode]);
  const totalWidth = useMemo(() => {
    if (columns.length === 0) return 800;
    const last = columns[columns.length - 1];
    return getX(last.date, origin, viewMode) + last.width + 32;
  }, [columns, origin, viewMode]);

  const todayX = useMemo(() => getX(new Date(), origin, viewMode), [origin, viewMode]);
  const totalBodyH = effectiveItems.length * ROW_H;
  const bodyH = Math.min(totalBodyH || 200, MAX_BODY_H);

  const onTimelineScroll = useCallback(() => {
    if (timelineRef.current && sidebarBodyRef.current) sidebarBodyRef.current.scrollTop = timelineRef.current.scrollTop;
  }, []);

  const toggleCollapse = (id: string) => {
    setCollapsed(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const startDrag = useCallback((e: React.PointerEvent, taskId: string, mode: 'move' | 'resize') => {
    e.preventDefault(); e.stopPropagation();
    const t = effectiveItems.find(x => x.id === taskId);
    if (!t) return;
    if (t.type !== 'task') return;
    containerRef.current?.setPointerCapture(e.pointerId);
    setDragState({ taskId, mode, startClientX: e.clientX, origStartDays: diffDays(t.start, origin), origEndDays: diffDays(t.end, origin) });
  }, [effectiveItems, origin]);

  const onPointerMove = useCallback((e: React.PointerEvent) => {
    if (!dragState) return;
    const deltaDays = Math.round((e.clientX - dragState.startClientX) / PPD[viewMode]);
    let newStart = addDays(origin, dragState.origStartDays);
    let newEnd = addDays(origin, dragState.origEndDays);
    if (dragState.mode === 'move') { newStart = addDays(origin, dragState.origStartDays + deltaDays); newEnd = addDays(origin, dragState.origEndDays + deltaDays); }
    else { newEnd = addDays(origin, dragState.origEndDays + deltaDays); if (newEnd <= newStart) newEnd = addDays(newStart, 1); }
    setOverrides(prev => ({ ...prev, [dragState.taskId]: { start: newStart, end: newEnd } }));
  }, [dragState, origin, viewMode]);

  const onPointerUp = useCallback(async (e: React.PointerEvent) => {
    if (!dragState) return;
    const ov = overrides[dragState.taskId];
    if (ov) {
      try {
        const task = effectiveItems.find(x => x.id === dragState.taskId);
        await updateTaskDates(dragState.taskId, toDateStr(ov.start), toDateStr(ov.end));
        notify(`Rescheduled "${task?.name?.toUpperCase() ?? dragState.taskId}" → ${toDateStr(ov.start)} to ${toDateStr(ov.end)}`, 'success');
        // Propagate delay to dependent tasks
        const dependentTasks = dependencies.filter(d => d.depends_on_task_id === dragState.taskId);
        for (const dep of dependentTasks) {
          const depItem = effectiveItems.find(x => x.id === dep.task_id);
          if (depItem) {
            const newDepStart = addDays(ov.end, 1);
            await updateTaskDates(dep.task_id, toDateStr(newDepStart), null);
          }
        }
      } catch (err: any) {
        notify(err.message || 'Failed to reschedule', 'error');
        setOverrides(prev => { const n = { ...prev }; delete n[dragState.taskId]; return n; });
      }
    }
    setDragState(null);
  }, [dragState, overrides, effectiveItems, updateTaskDates, notify, dependencies]);

  // Intel alerts (meeting hours via CalendarEvents + holiday warnings)
  const alerts = useMemo(() => {
    const out: Array<{ id: string; title: string; message: string; severity: 'high' | 'medium' | 'info' }> = [];
    tasks.forEach(t => {
      if (t.status === 'done') return;
      if (t.delay_drift_days && t.delay_drift_days > 0)
        out.push({ id: `d-${t.id}`, title: 'Timeline Drift', message: `"${t.name}" predicted +${t.delay_drift_days}d slip`, severity: t.delay_drift_days > 2 ? 'high' : 'medium' });
      if (t.risk === 'high')
        out.push({ id: `r-${t.id}`, title: 'High Delivery Risk', message: `"${t.name}" has high estimation variance`, severity: 'high' });
    });

    // Holiday warnings from CalendarEvents
    const holidays = calendarEvents.filter(e => e.event_type === 'holiday');
    holidays.forEach(h => {
      out.push({ id: `hol-${h.id}`, title: 'Holiday', message: `"${h.title}" on ${h.start_date} (full capacity loss)`, severity: 'medium' });
    });

    profiles?.forEach(p => {
      const hrs = tasks.filter(t => t.assignee_id === p.id && t.status !== 'done').reduce((s, t) => s + (t.estimated_hours || 0), 0);
      const meetingHrs = meetings.filter(m => new Date(m.start_time) > new Date()).reduce((s, m) => s + (new Date(m.end_time).getTime() - new Date(m.start_time).getTime()) / 3600000, 0);
      const leaveHrs = calendarEvents.filter(e => e.event_type === 'leave' && e.participants?.includes(p.id)).reduce((s, e) => {
        const dur = (new Date(e.end_date).getTime() - new Date(e.start_date).getTime()) / 3600000;
        return s + dur * (1 - e.capacity_impact);
      }, 0);
      const totalDeduction = meetingHrs + leaveHrs;
      const cap = 40 * (p.availability_factor || 1) - totalDeduction;
      if (hrs > cap) out.push({ id: `o-${p.id}`, title: 'Capacity Breach', message: `"${p.full_name || p.email}" ${hrs}h / ${cap}h limit (${totalDeduction.toFixed(1)}h events)`, severity: 'high' });
    });
    return out;
  }, [tasks, profiles, meetings, calendarEvents]);

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap justify-between items-center gap-4 bg-[#07080e]/70 border border-white/10 rounded-xl px-5 py-3.5 backdrop-blur-md">
        <div>
          <h3 className="text-sm font-semibold uppercase tracking-wider text-cyan-400">Timeline Engine</h3>
          <p className="text-[10px] font-mono text-white/35 mt-0.5">Hierarchy: Project → Epic → Task · Drag to reschedule · Delay auto-propagates</p>
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          <div className="flex bg-black/50 border border-white/10 p-0.5 rounded-md gap-0.5">
            {(['Day', 'Week', 'Month'] as ViewMode[]).map(m => (
              <button key={m} onClick={() => setViewMode(m)} className={`px-3.5 py-1.5 text-[10px] font-mono uppercase tracking-wider rounded-sm transition-all cursor-pointer ${viewMode === m ? 'bg-blue-600/35 text-blue-300 border border-blue-500/30 shadow-[0_0_14px_rgba(59,130,246,0.18)]' : 'text-white/45 hover:text-white/80 border border-transparent'}`}>{m}</button>
            ))}
          </div>
          <button onClick={() => setShowIntel(v => !v)} className={`flex items-center gap-1.5 px-3 py-1.5 text-[10px] font-mono uppercase tracking-wider border rounded-md transition-all cursor-pointer ${showIntel ? 'bg-cyan-500/10 border-cyan-500/30 text-cyan-400 shadow-[0_0_10px_rgba(6,182,212,0.1)]' : 'bg-black/30 border-white/10 text-white/40 hover:text-cyan-400 hover:border-cyan-500/25'}`}>
            <BrainCircuit className="w-3 h-3" />
            {showIntel ? 'Hide Intel' : 'Intel'}
            {alerts.length > 0 && <span className="ml-1 bg-rose-500 text-white text-[8px] font-bold rounded-full w-3.5 h-3.5 flex items-center justify-center leading-none">{alerts.length}</span>}
          </button>
        </div>
      </div>

      <div className="flex gap-4 items-start min-h-0">
        <div ref={containerRef} className={`flex-1 min-w-0 bg-[#07080e]/80 border border-white/10 rounded-xl overflow-hidden backdrop-blur-md ${dragState ? 'cursor-grabbing select-none' : ''}`} onPointerMove={onPointerMove} onPointerUp={onPointerUp} onPointerCancel={() => setDragState(null)}>
          {effectiveItems.length === 0 ? (
            <div className="h-64 flex flex-col justify-center items-center gap-4 text-center p-8">
              <Activity className="w-4 h-4 text-white/25" />
              <p className="text-[11px] font-mono uppercase tracking-widest text-white/30">No items to render on timeline</p>
            </div>
          ) : (
            <div className="flex" style={{ height: `${HEADER_H + bodyH}px` }}>
              <div className="flex-none flex flex-col z-10" style={{ width: `${SIDEBAR_W}px`, background: 'rgba(5,6,10,0.97)' }}>
                <div className="flex-none flex items-end px-4 pb-3 border-b border-r border-white/[0.08]" style={{ height: `${HEADER_H}px` }}>
                  <span className="text-[9px] font-mono uppercase tracking-[0.18em] text-white/20">Hierarchy · Name</span>
                </div>
                <div ref={sidebarBodyRef} className="flex-1 overflow-hidden border-r border-white/[0.07]" style={{ overflowY: 'hidden' }}>
                  {effectiveItems.map((item, i) => {
                    const hColor = HIERARCHY_COLORS[item.type] || '#94a3b8';
                    return (
                      <div key={item.id} className={`flex items-center gap-2 px-4 border-b border-white/[0.04] transition-colors ${hoveredId === item.id ? 'bg-white/[0.03]' : 'hover:bg-white/[0.02]'}`}
                        style={{ height: `${ROW_H}px`, paddingLeft: `${16 + item.depth * 16}px` }}
                        onMouseEnter={() => setHoveredId(item.id)} onMouseLeave={() => setHoveredId(null)}>
                        <button onClick={() => toggleCollapse(item.id)} className="w-3 h-3 flex items-center justify-center text-white/30 hover:text-white/70 cursor-pointer">
                          {item.depth < 2 && <span>{collapsed.has(item.id) ? '▶' : '▼'}</span>}
                        </button>
                        <div className="w-2 h-2 rounded-full flex-none ring-1" style={{ background: hColor, boxShadow: `0 0 6px ${hColor}55` }} />
                        <div className="min-w-0">
                          <p className="text-[11.5px] font-medium text-white/85 truncate leading-tight">{item.name}</p>
                          <p className="text-[9px] font-mono uppercase tracking-wider mt-0.5" style={{ color: item.type === 'task' ? (STATUS_COLORS[item.status || 'backlog']?.text || '#cbd5e1') : hColor }}>
                            {item.type} {item.status ? `· ${item.status.replace('_', ' ')}` : ''}
                          </p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div ref={timelineRef} className="flex-1 overflow-auto" onScroll={onTimelineScroll} style={{ overflowX: 'auto', overflowY: 'auto' }}>
                <div style={{ width: `${totalWidth}px`, minWidth: '100%' }}>
                  <div className="sticky top-0 z-20 flex border-b border-white/[0.09]" style={{ height: `${HEADER_H}px`, background: 'rgba(5,6,10,0.96)', backdropFilter: 'blur(8px)' }}>
                    {columns.map((col, ci) => {
                      const x = getX(col.date, origin, viewMode);
                      return (
                        <div key={ci} className="flex-none flex flex-col items-center justify-end pb-2.5 border-r border-white/[0.05]" style={{ width: `${col.width}px`, background: col.isToday ? 'rgba(6,182,212,0.06)' : col.isWeekend ? 'rgba(255,255,255,0.008)' : 'transparent' }}>
                          <span className={`text-[10px] font-semibold font-mono uppercase tracking-wider leading-tight ${col.isToday ? 'text-cyan-400' : 'text-white/65'}`}>{col.mainLabel}</span>
                          {col.subLabel && <span className={`text-[8.5px] font-mono mt-0.5 leading-tight ${col.isToday ? 'text-cyan-500/70' : 'text-white/25'}`}>{col.subLabel}</span>}
                        </div>
                      );
                    })}
                  </div>

                  <div className="relative" style={{ height: `${totalBodyH}px` }}>
                    {columns.map((col, ci) => {
                      const x = getX(col.date, origin, viewMode);
                      return (
                        <div key={ci} className="absolute top-0 bottom-0 border-r border-white/[0.04]" style={{ left: `${x}px`, width: `${col.width}px`, background: col.isToday ? 'rgba(6,182,212,0.04)' : col.isWeekend ? 'rgba(255,255,255,0.008)' : 'transparent' }} />
                      );
                    })}
                    {effectiveItems.filter(e => e.type === 'task').map((_, i) => {
                      const item = effectiveItems.find(e => e.type === 'task');
                      if (!item) return null;
                      return (
                        <div key={i} className="absolute left-0 right-0 border-b border-white/[0.03]" style={{ top: `${(i + 1) * ROW_H - 1}px` }} />
                      );
                    })}

                    {hoveredId && (() => {
                      const idx = effectiveItems.findIndex(t => t.id === hoveredId);
                      return idx >= 0 ? <div className="absolute left-0 right-0 pointer-events-none" style={{ top: `${idx * ROW_H}px`, height: `${ROW_H}px`, background: 'rgba(255,255,255,0.018)' }} /> : null;
                    })()}

                    {todayX >= 0 && (
                      <div className="absolute top-0 bottom-0 w-px pointer-events-none z-20" style={{ left: `${todayX}px`, background: 'rgba(6,182,212,0.65)', boxShadow: '0 0 8px rgba(6,182,212,0.35)' }}>
                        <div className="absolute -top-px -translate-x-1/2 px-1.5 py-0.5 text-[8px] font-mono uppercase font-bold text-cyan-400 bg-[#05060a] border border-cyan-500/40 rounded-sm whitespace-nowrap">Today</div>
                      </div>
                    )}

                    {/* Dependency arrows */}
                    <svg className="absolute inset-0 pointer-events-none z-10" style={{ width: `${totalWidth}px`, height: `${totalBodyH}px` }}>
                      <defs>
                        <marker id="gantt-arrow" markerWidth="7" markerHeight="7" refX="6" refY="3.5" orient="auto">
                          <path d="M0,0 L0,7 L7,3.5 z" fill="rgba(6,182,212,0.45)" />
                        </marker>
                      </defs>
                      {(dependencies ?? []).map((dep, di) => {
                        const fromTask = effectiveItems.find(t => t.id === dep.depends_on_task_id);
                        const toTask = effectiveItems.find(t => t.id === dep.task_id);
                        if (!fromTask || !toTask) return null;
                        const fi = effectiveItems.indexOf(fromTask);
                        const ti = effectiveItems.indexOf(toTask);
                        const fx = getX(fromTask.end, origin, viewMode);
                        const fy = fi * ROW_H + ROW_H / 2;
                        const tx = getX(toTask.start, origin, viewMode);
                        const ty = ti * ROW_H + ROW_H / 2;
                        const mx = (fx + tx) / 2;
                        return <path key={di} d={`M ${fx} ${fy} C ${mx} ${fy}, ${mx} ${ty}, ${tx} ${ty}`} fill="none" stroke="rgba(6,182,212,0.3)" strokeWidth="1.5" strokeDasharray="4,3" markerEnd="url(#gantt-arrow)" />;
                      })}
                    </svg>

                    {/* Milestones */}
                    {milestones.map(m => {
                      const mDate = sod(new Date(m.target_date));
                      const mX = getX(mDate, origin, viewMode);
                      if (mX < 0 || mX > totalWidth) return null;
                      return (
                        <div key={`ms-${m.id}`} className="absolute z-20" style={{ left: `${mX - 8}px`, top: '-4px' }}>
                          <Diamond className={`w-4 h-4 ${m.status === 'achieved' ? 'text-emerald-400' : m.status === 'missed' ? 'text-red-400' : 'text-cyan-400'}`} />
                        </div>
                      );
                    })}

                    {/* Meeting markers */}
                    {meetings.slice(0, 30).map(m => {
                      const mDate = sod(new Date(m.start_time));
                      const mX = getX(mDate, origin, viewMode);
                      if (mX < 0 || mX > totalWidth) return null;
                      return (
                        <div key={`mt-${m.id}`} className="absolute z-15" style={{ left: `${mX - 6}px`, top: `${totalBodyH + 4}px` }} title={`${m.title} (${m.meeting_type})`}>
                          <Calendar className="w-3 h-3 text-purple-400/60" />
                        </div>
                      );
                    })}

                    {/* Hierarchy bars */}
                    {effectiveItems.map((item, i) => {
                      if (item.type === 'project') {
                        const barX = getX(item.start, origin, viewMode);
                        const barW = Math.max(getX(item.end, origin, viewMode) - barX, 28);
                        return (
                          <div key={item.id} className="absolute z-5 pointer-events-none" style={{ left: `${barX}px`, top: `${i * ROW_H + ROW_H / 2 - 1}px`, width: `${barW}px`, height: '2px', background: 'rgba(96,165,250,0.3)' }} />
                        );
                      }
                      if (item.type === 'epic') {
                        const barX = getX(item.start, origin, viewMode);
                        const barW = Math.max(getX(item.end, origin, viewMode) - barX, 28);
                        return (
                          <div key={item.id} className="absolute z-5 pointer-events-none" style={{ left: `${barX}px`, top: `${i * ROW_H + ROW_H / 2 - 1}px`, width: `${barW}px`, height: '2px', background: 'rgba(244,114,182,0.3)' }} />
                        );
                      }
                      if (item.type !== 'task') return null;
                      const barX = getX(item.start, origin, viewMode);
                      const barW = Math.max(getX(item.end, origin, viewMode) - barX, 28);
                      const barTop = i * ROW_H + 10;
                      const barH = ROW_H - 20;
                      const progW = Math.max(0, (item.progress / 100) * barW);
                      const isDrag = dragState?.taskId === item.id;
                      const isHov = hoveredId === item.id;
                      const sc = STATUS_COLORS[item.status || 'backlog'] || STATUS_COLORS.backlog;

                      return (
                        <div key={item.id} className={`absolute rounded-md border overflow-hidden flex items-center select-none transition-shadow ${isDrag ? 'z-30 shadow-[0_0_20px_rgba(59,130,246,0.45)]' : isHov ? 'z-20 shadow-[0_0_12px_rgba(255,255,255,0.08)]' : 'z-10'}`}
                          style={{ left: `${barX}px`, top: `${barTop}px`, width: `${barW}px`, height: `${barH}px`, background: sc.bg, borderColor: sc.border, cursor: dragState ? (dragState.mode === 'move' ? 'grabbing' : 'ew-resize') : 'grab' }}
                          onPointerDown={e => startDrag(e, item.id, 'move')} onMouseEnter={() => setHoveredId(item.id)} onMouseLeave={() => setHoveredId(null)}>
                          <div className="absolute left-0 top-0 bottom-0 opacity-55" style={{ width: `${progW}px`, background: sc.fill, borderRadius: '6px 0 0 6px' }} />
                          <div className="absolute top-0 left-0 h-0.5 opacity-80" style={{ width: `${progW}px`, background: sc.fill, boxShadow: `0 0 4px ${sc.fill}` }} />
                          <span className="relative z-10 px-2.5 text-[10.5px] font-mono font-semibold uppercase tracking-wide truncate pointer-events-none" style={{ color: 'rgba(255,255,255,0.88)' }}>{item.name}</span>
                          <div className="absolute right-0 top-0 bottom-0 w-3.5 flex items-center justify-center cursor-ew-resize opacity-0 hover:opacity-100 transition-opacity z-20" onPointerDown={e => { e.stopPropagation(); startDrag(e, item.id, 'resize'); }}>
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

        {/* Intel Panel */}
        {showIntel && (
          <div className="w-76 flex-none bg-[#07080e]/85 border border-white/10 rounded-xl p-5 backdrop-blur-md" style={{ minWidth: '280px', maxWidth: '304px' }}>
            <div className="flex items-center gap-2 mb-5 pb-4 border-b border-white/[0.07]">
              <BrainCircuit className="w-4 h-4 text-cyan-400" />
              <h3 className="text-xs font-semibold uppercase tracking-wider text-white/90">Timeline Intel</h3>
              {alerts.length > 0 && <span className="ml-auto text-[9px] font-mono text-rose-400 bg-rose-500/10 border border-rose-500/25 px-1.5 py-0.5 rounded-sm">{alerts.length} alert{alerts.length !== 1 ? 's' : ''}</span>}
            </div>
            <div className="space-y-2.5 max-h-80 overflow-y-auto pr-1 custom-scrollbar">
              {alerts.length === 0 ? (
                <div className="h-28 flex flex-col justify-center items-center text-center p-4 border border-dashed border-white/[0.06] rounded-lg">
                  <Activity className="w-4 h-4 text-white/15 mb-2 animate-pulse" />
                  <p className="text-[9px] font-mono uppercase tracking-widest text-white/20">Zero anomalies detected</p>
                </div>
              ) : alerts.map(a => (
                <div key={a.id} className={`p-3 rounded-lg border flex gap-2.5 ${a.severity === 'high' ? 'bg-rose-950/25 border-rose-500/20 text-rose-200' : a.severity === 'medium' ? 'bg-amber-950/25 border-amber-500/20 text-amber-200' : 'bg-blue-950/25 border-blue-500/20 text-blue-200'}`}>
                  <div className="mt-0.5 flex-none">
                    {a.severity === 'high' ? <AlertTriangle className="w-3.5 h-3.5 text-rose-500 animate-pulse" /> : a.severity === 'medium' ? <AlertTriangle className="w-3.5 h-3.5 text-amber-500" /> : <Clock className="w-3.5 h-3.5 text-blue-400" />}
                  </div>
                  <div className="min-w-0">
                    <h4 className="text-[9px] font-mono uppercase tracking-wider font-bold mb-1">{a.title}</h4>
                    <p className="text-[10px] leading-relaxed text-white/65 break-words">{a.message}</p>
                  </div>
                </div>
              ))}
            </div>
            <div className="mt-5 pt-4 border-t border-white/[0.06] space-y-2.5">
              <div className="flex justify-between items-center"><span className="text-[9px] font-mono uppercase tracking-wider text-white/40">Projects</span><span className="text-[9px] font-mono font-bold text-cyan-400">{effectiveItems.filter(i => i.type === 'project').length}</span></div>
              <div className="flex justify-between items-center"><span className="text-[9px] font-mono uppercase tracking-wider text-white/40">Epics</span><span className="text-[9px] font-mono font-bold text-pink-400">{effectiveItems.filter(i => i.type === 'epic').length}</span></div>
              <div className="flex justify-between items-center"><span className="text-[9px] font-mono uppercase tracking-wider text-white/40">Tasks</span><span className="text-[9px] font-mono font-bold text-cyan-400">{effectiveItems.filter(i => i.type === 'task').length}</span></div>
              <div className="flex justify-between items-center"><span className="text-[9px] font-mono uppercase tracking-wider text-white/40">Milestones</span><span className="text-[9px] font-mono font-bold text-cyan-400">{milestones.length}</span></div>
              <div className="flex justify-between items-center"><span className="text-[9px] font-mono uppercase tracking-wider text-white/40">Calendar Events</span><span className="text-[9px] font-mono font-bold text-amber-400">{calendarEvents.length}</span></div>
              <div className="flex justify-between items-center"><span className="text-[9px] font-mono uppercase tracking-wider text-white/40">Holidays</span><span className="text-[9px] font-mono font-bold text-amber-400">{calendarEvents.filter(e => e.event_type === 'holiday').length}</span></div>
              <div className="flex justify-between items-center"><span className="text-[9px] font-mono uppercase tracking-wider text-white/40">Leaves</span><span className="text-[9px] font-mono font-bold text-rose-400">{calendarEvents.filter(e => e.event_type === 'leave').length}</span></div>
              <div className="flex justify-between items-center"><span className="text-[9px] font-mono uppercase tracking-wider text-white/40">Meetings</span><span className="text-[9px] font-mono font-bold text-purple-400">{calendarEvents.filter(e => e.event_type === 'meeting').length}</span></div>
              <div className="flex justify-between items-center"><span className="text-[9px] font-mono uppercase tracking-wider text-white/40">Event Hours</span><span className="text-[9px] font-mono font-bold text-purple-400">{calendarEvents.reduce((s, e) => s + (new Date(e.end_date).getTime() - new Date(e.start_date).getTime()) / 3600000, 0).toFixed(1)}h</span></div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
