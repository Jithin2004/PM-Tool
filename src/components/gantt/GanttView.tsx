import React, { useEffect, useRef, useState, useMemo } from 'react';
import Gantt from 'frappe-gantt';
import '../../../node_modules/frappe-gantt/dist/frappe-gantt.css';
import { useDashboard } from '../../context/DashboardContext';
import { normalizeTasksForGantt, formatDateString } from '../../utils/ganttDateUtils';
import { AlertTriangle, BrainCircuit, Activity, Clock, Users, ArrowRight } from 'lucide-react';

export function GanttView() {
  const { tasks, dependencies, profiles, updateTaskDates, notify } = useDashboard();
  const svgRef = useRef<SVGSVGElement | null>(null);
  const ganttInstance = useRef<any>(null);
  const [viewMode, setViewMode] = useState<'Day' | 'Week' | 'Month'>('Day');

  // Normalize tasks for Gantt chart
  const normalizedTasks = useMemo(() => {
    return normalizeTasksForGantt(tasks, dependencies).map(t => ({
      id: t.id,
      name: t.name,
      start: t.start,
      end: t.end,
      progress: t.progress,
      dependencies: t.dependencies
    }));
  }, [tasks, dependencies]);

  // Compute Advanced Timeline Intelligence Overlays
  const timelineInsights = useMemo(() => {
    const alerts: {
      id: string;
      type: 'delay' | 'risk' | 'attendance' | 'overload';
      title: string;
      message: string;
      severity: 'high' | 'medium' | 'info';
    }[] = [];

    // 1. Calculate individual task delays and risk levels
    tasks.forEach(task => {
      if (task.status === 'done') return;

      // Predicted delay warning
      if (task.delay_drift_days && task.delay_drift_days > 0) {
        alerts.push({
          id: `delay-${task.id}`,
          type: 'delay',
          title: 'Timeline Drift Detected',
          message: `Task "${task.name.toUpperCase()}" is predicted to slip by +${task.delay_drift_days} day(s).`,
          severity: task.delay_drift_days > 2 ? 'high' : 'medium'
        });
      }

      // High delivery risk warning
      if (task.risk === 'high') {
        alerts.push({
          id: `risk-${task.id}`,
          type: 'risk',
          title: 'High Delivery Risk',
          message: `Task "${task.name.toUpperCase()}" has excessive estimation variance. Confidence is low.`,
          severity: 'high'
        });
      }

      // 2. Attendance & Availability constraints matching assignee
      if (task.assignee_id) {
        const assignee = profiles?.find(p => p.id === task.assignee_id);
        if (assignee && assignee.availability_factor && assignee.availability_factor < 1.0) {
          alerts.push({
            id: `avail-${task.id}`,
            type: 'attendance',
            title: 'Attendance / Availability Impact',
            message: `"${assignee.full_name || assignee.email}" is at ${Math.round(assignee.availability_factor * 100)}% capacity.`,
            severity: 'info'
          });
        }
      }
    });

    // 3. Calculate Team/Developer Capacity Overloads
    if (profiles && profiles.length > 0) {
      profiles.forEach(profile => {
        const activeDevTasks = tasks.filter(t => t.assignee_id === profile.id && t.status !== 'done');
        const activeHours = activeDevTasks.reduce((sum, t) => sum + (t.estimated_hours || 0), 0);
        const weeklyCapacity = 40 * (profile.availability_factor || 1.0);

        if (activeHours > weeklyCapacity) {
          alerts.push({
            id: `overload-${profile.id}`,
            type: 'overload',
            title: 'Operator Capacity Breach',
            message: `"${profile.full_name || profile.email}" is overloaded (${activeHours} hours assigned vs ${weeklyCapacity}h limit).`,
            severity: 'high'
          });
        }
      });
    }

    return alerts;
  }, [tasks, profiles]);

  // Handle Gantt Instantiation and Updates
  useEffect(() => {
    if (!svgRef.current) return;

    if (normalizedTasks.length === 0) {
      if (ganttInstance.current) {
        svgRef.current.innerHTML = '';
        ganttInstance.current = null;
      }
      return;
    }

    try {
      if (ganttInstance.current) {
        ganttInstance.current.refresh(normalizedTasks);
      } else {
        svgRef.current.innerHTML = ''; // Ensure clear container
        ganttInstance.current = new Gantt(svgRef.current, normalizedTasks, {
          header_height: 50,
          column_width: 30,
          step: 24,
          view_mode: viewMode,
          date_format: 'YYYY-MM-DD',
          custom_popup_html: null,
          readonly: false, // Turn off read-only mode to make Gantt interactive!
          on_date_change: async (task: any, start: Date, end: Date) => {
            try {
              const startStr = formatDateString(start);
              const endStr = formatDateString(end);
              await updateTaskDates(task.id, startStr, endStr);
              notify(`Rescheduled task "${task.name.toUpperCase()}" to ${startStr} - ${endStr}`, 'success');
            } catch (err: any) {
              notify(err.message || 'Failed to update task dates', 'error');
              // Force snap back to original stable timeline state on exception
              if (ganttInstance.current) {
                ganttInstance.current.refresh(normalizedTasks);
              }
            }
          }
        } as any);
      }
    } catch (err) {
      console.error("Failed to initialize or refresh Frappe Gantt:", err);
    }

    return () => {
      if (svgRef.current) {
        svgRef.current.innerHTML = '';
      }
      ganttInstance.current = null;
    };
  }, [normalizedTasks]);

  // Handle View Mode Switching
  useEffect(() => {
    if (ganttInstance.current) {
      try {
        ganttInstance.current.change_view_mode(viewMode);
      } catch (err) {
        console.error("Failed to change view mode:", err);
      }
    }
  }, [viewMode]);

  return (
    <div className="w-full flex flex-col xl:flex-row gap-6 items-stretch">
      {/* 1. Main Timeline Render Panel */}
      <div className="flex-1 bg-[#090a0f]/80 backdrop-blur-md border border-white/10 rounded-lg p-6 relative overflow-hidden flex flex-col">
        {/* Dynamic Header */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-8 pb-4 border-b border-white/5">
          <div>
            <h3 className="text-sm font-semibold uppercase tracking-wider text-cyan-400">
              Timeline Engine (Interactive)
            </h3>
            <p className="text-xs text-white/50">Drag task bars to update schedules. Changes propagate and trigger risk calculations in real-time.</p>
          </div>
          
          {/* Toggle switch for Day/Week/Month */}
          <div className="flex bg-black/40 border border-white/10 p-0.5 rounded-sm gap-0.5 self-end">
            {(['Day', 'Week', 'Month'] as const).map(mode => (
              <button
                key={mode}
                onClick={() => setViewMode(mode)}
                className={`px-3 py-1 text-[10px] font-mono uppercase tracking-wider rounded-sm transition-all cursor-pointer ${
                  viewMode === mode 
                    ? 'bg-blue-600/30 text-blue-400 border border-blue-500/20 shadow-[0_0_12px_rgba(59,130,246,0.15)]' 
                    : 'text-white/60 hover:text-white border border-transparent'
                }`}
              >
                {mode}
              </button>
            ))}
          </div>
        </div>

        {/* Render Target */}
        <div className="overflow-x-auto overflow-y-hidden max-w-full rounded-sm bg-black/30 p-4 border border-white/5 flex-1 flex flex-col justify-center">
          {normalizedTasks.length === 0 ? (
            <div className="h-64 flex flex-col justify-center items-center gap-4 text-center p-8 border border-dashed border-white/10 rounded-sm">
              <p className="text-xs font-mono uppercase tracking-wider text-white/40">
                No active tasks to map on the timeline
              </p>
              <button 
                onClick={() => {
                  window.dispatchEvent(new CustomEvent('switch-to-board'));
                }}
                className="px-4 py-2 border border-cyan-500/30 bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-400 text-[10px] font-mono uppercase tracking-wider rounded-sm transition-all cursor-pointer"
              >
                Create your first task
              </button>
            </div>
          ) : (
            <svg 
              ref={svgRef} 
              className="w-full text-white/90" 
              style={{ minWidth: '800px', background: 'transparent' }}
            />
          )}
        </div>
      </div>

      {/* 2. Side intelligence Overlay Panel */}
      <div className="w-full xl:w-96 bg-[#090a0f]/80 backdrop-blur-md border border-white/10 rounded-lg p-6 flex flex-col justify-between">
        <div>
          <div className="flex items-center gap-2 mb-6 pb-4 border-b border-white/5">
            <BrainCircuit className="w-4 h-4 text-cyan-400" />
            <h3 className="text-sm font-semibold uppercase tracking-wider text-white">
              Timeline Intel Overlays
            </h3>
          </div>

          <div className="space-y-4 max-h-[450px] overflow-y-auto pr-1">
            {timelineInsights.length === 0 ? (
              <div className="h-32 flex flex-col justify-center items-center text-[10px] font-mono uppercase tracking-widest text-white/30 text-center p-4 border border-dashed border-white/5 rounded-sm">
                <Activity className="w-5 h-5 text-white/20 mb-2 animate-pulse" />
                Zero Schedule Anomalies Detected
              </div>
            ) : (
              timelineInsights.map(alert => (
                <div 
                  key={alert.id}
                  className={`p-3.5 rounded-sm border backdrop-blur-xs flex gap-3 transition-all ${
                    alert.severity === 'high' 
                      ? 'bg-rose-950/20 border-rose-500/30 text-rose-200' 
                      : alert.severity === 'medium'
                        ? 'bg-amber-950/20 border-amber-500/30 text-amber-200'
                        : 'bg-blue-950/20 border-blue-500/30 text-blue-200'
                  }`}
                >
                  <div className="mt-0.5 shrink-0">
                    {alert.severity === 'high' ? (
                      <AlertTriangle className="w-4 h-4 text-rose-500 animate-pulse" />
                    ) : alert.severity === 'medium' ? (
                      <AlertTriangle className="w-4 h-4 text-amber-500" />
                    ) : (
                      <Clock className="w-4 h-4 text-blue-400" />
                    )}
                  </div>
                  <div>
                    <h4 className="text-[10px] font-mono uppercase tracking-wider font-bold mb-1">
                      {alert.title}
                    </h4>
                    <p className="text-[11px] leading-relaxed text-white/80">
                      {alert.message}
                    </p>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Dynamic Capacity Aggregation Stats */}
        <div className="mt-6 pt-4 border-t border-white/5 space-y-3">
          <div className="flex justify-between items-center text-[10px] font-mono uppercase tracking-wider text-white/60">
            <span>Critical Paths Drift</span>
            <span className="text-cyan-400 font-bold">
              {tasks.some(t => t.delay_drift_days && t.delay_drift_days > 0) ? 'ACTIVE DRIFT' : 'CALIBRATED'}
            </span>
          </div>
          <div className="flex justify-between items-center text-[10px] font-mono uppercase tracking-wider text-white/60">
            <span>Aggregated Load Alerts</span>
            <span className={timelineInsights.filter(a => a.type === 'overload').length > 0 ? 'text-rose-500 font-bold animate-pulse' : 'text-emerald-400 font-bold'}>
              {timelineInsights.filter(a => a.type === 'overload').length} BREACHES
            </span>
          </div>
        </div>
      </div>

      {/* Glassmorphic custom CSS overrides for dark skin */}
      <style>{`
        .gantt .grid-header {
          fill: rgba(0, 0, 0, 0.4) !important;
          stroke: rgba(255, 255, 255, 0.08) !important;
          stroke-width: 1px !important;
        }
        .gantt .grid-row {
          fill: transparent !important;
          stroke: rgba(255, 255, 255, 0.04) !important;
        }
        .gantt .grid-row:nth-child(even) {
          fill: rgba(255, 255, 255, 0.01) !important;
        }
        .gantt .tick {
          stroke: rgba(255, 255, 255, 0.06) !important;
        }
        .gantt .holiday-style {
          fill: rgba(255, 255, 255, 0.015) !important;
        }
        .gantt .bar {
          fill: rgba(30, 58, 138, 0.45) !important;
          stroke: rgba(59, 130, 246, 0.6) !important;
          stroke-width: 1px !important;
          rx: 2px !important;
          ry: 2px !important;
        }
        .gantt .bar-progress {
          fill: rgba(59, 130, 246, 0.8) !important;
          rx: 2px !important;
          ry: 2px !important;
        }
        .gantt .bar-label {
          fill: rgba(255, 255, 255, 0.85) !important;
          font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace !important;
          font-size: 9px !important;
          text-transform: uppercase !important;
          letter-spacing: 0.08em !important;
          font-weight: 500 !important;
        }
        .gantt .arrow {
          fill: none !important;
          stroke: rgba(6, 182, 212, 0.4) !important;
          stroke-width: 1.5px !important;
          stroke-dasharray: 2, 2 !important;
        }
        .gantt .lower-text {
          fill: rgba(255, 255, 255, 0.45) !important;
          font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace !important;
          font-size: 8px !important;
          text-transform: uppercase !important;
          letter-spacing: 0.05em !important;
        }
        .gantt .upper-text {
          fill: rgba(255, 255, 255, 0.75) !important;
          font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace !important;
          font-size: 9px !important;
          font-weight: 600 !important;
          text-transform: uppercase !important;
          letter-spacing: 0.08em !important;
        }
        .gantt-container {
          background: transparent !important;
        }
        .gantt .popup-wrapper {
          background: rgba(10, 11, 18, 0.85) !important;
          backdrop-filter: blur(8px) !important;
          border: 1px solid rgba(255, 255, 255, 0.1) !important;
          border-radius: 4px !important;
          box-shadow: 0 4px 20px rgba(0, 0, 0, 0.4) !important;
          padding: 8px 12px !important;
          color: #ffffff !important;
          font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace !important;
          font-size: 10px !important;
          z-index: 1000 !important;
        }
        .gantt .popup-wrapper .title {
          font-weight: bold !important;
          font-size: 11px !important;
          color: rgb(34, 211, 238) !important;
          text-transform: uppercase !important;
          margin-bottom: 4px !important;
          border-bottom: 1px solid rgba(255, 255, 255, 0.08) !important;
          padding-bottom: 4px !important;
        }
        .gantt .popup-wrapper .subtitle {
          color: rgba(255, 255, 255, 0.7) !important;
        }
        .gantt .popup-wrapper .pointer {
          border-top-color: rgba(10, 11, 18, 0.85) !important;
        }
      `}</style>
    </div>
  );
}
