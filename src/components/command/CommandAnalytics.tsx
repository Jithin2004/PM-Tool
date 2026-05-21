import React, { useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, TrendingUp, TrendingDown, Activity, Clock, BarChart3, Zap, BrainCircuit, Cpu } from 'lucide-react';
import { getTimeline, getTopCommandsWithTrend, type CommandTrend } from './CommandPalette';
import { activityLogService } from '../../services/activityLogService';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  role: string;
  workspaceId?: string;
  profileId?: string;
}

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const HOURS = Array.from({ length: 12 }, (_, i) => `${(i + 6) % 24}:00`);

function getHeatmap(): { day: number; hour: number; count: number }[] {
  const timeline = getTimeline();
  const now = Date.now();
  const week = 7 * 24 * 60 * 60 * 1000;
  const recent = timeline.filter(e => now - e.ts < week);
  const grid: Record<string, number> = {};
  recent.forEach(e => {
    const d = new Date(e.ts);
    const day = d.getDay();
    const hour = d.getHours();
    const key = `${day}-${hour}`;
    grid[key] = (grid[key] || 0) + 1;
  });
  const result: { day: number; hour: number; count: number }[] = [];
  for (let d = 0; d < 7; d++) {
    for (let h = 0; h < 24; h++) {
      const key = `${d}-${h}`;
      result.push({ day: d, hour: h, count: grid[key] || 0 });
    }
  }
  return result;
}

// Convert hour slot index (0-23) to display label
function hourLabel(h: number): string {
  if (h === 0) return '12a';
  if (h < 12) return `${h}a`;
  if (h === 12) return '12p';
  return `${h - 12}p`;
}

function getPopularActions(): Record<string, number> {
  const timeline = getTimeline();
  const now = Date.now();
  const week = 7 * 24 * 60 * 60 * 1000;
  const recent = timeline.filter(e => now - e.ts < week && (e.id.startsWith('action:') || e.id.startsWith('ainlp:')));
  const counts: Record<string, number> = {};
  recent.forEach(e => {
    counts[e.label] = (counts[e.label] || 0) + 1;
  });
  return Object.fromEntries(Object.entries(counts).sort(([, a], [, b]) => b - a).slice(0, 8));
}

function generateInsights(): string[] {
  const timeline = getTimeline();
  const now = Date.now();
  const week = 7 * 24 * 60 * 60 * 1000;
  const recent = timeline.filter(e => now - e.ts < week);
  if (recent.length < 3) return ['Not enough data yet. Use the command palette more this week.'];

  const insights: string[] = [];

  // Peak usage day
  const dayCounts: Record<string, number> = {};
  recent.forEach(e => {
    const d = DAYS[new Date(e.ts).getDay()];
    dayCounts[d] = (dayCounts[d] || 0) + 1;
  });
  const peakDay = Object.entries(dayCounts).sort(([, a], [, b]) => b - a)[0];
  if (peakDay) insights.push(`Peak usage on ${peakDay[0]} — ${peakDay[1]} commands`);

  // Peak hour
  const hourCounts: Record<string, number> = {};
  recent.forEach(e => {
    const h = new Date(e.ts).getHours();
    const label = h < 6 ? 'Late night' : h < 12 ? 'Morning' : h < 17 ? 'Afternoon' : 'Evening';
    hourCounts[label] = (hourCounts[label] || 0) + 1;
  });
  const peakTime = Object.entries(hourCounts).sort(([, a], [, b]) => b - a)[0];
  if (peakTime) insights.push(`Most active: ${peakTime[0]} (${peakTime[1]})`);

  // Navigation vs actions ratio
  const navCount = recent.filter(e => e.id.startsWith('nav:')).length;
  const actionCount = recent.filter(e => e.id.startsWith('action:')).length;
  if (navCount + actionCount > 5) {
    const navPct = Math.round((navCount / (navCount + actionCount)) * 100);
    insights.push(`${navPct}% of commands are navigation, ${100 - navPct}% are actions`);
  }

  // Top trend
  const trend = getTopCommandsWithTrend(1)[0];
  if (trend && trend.count > 2) {
    const direction = trend.trend > 0 ? '↑' : '↓';
    insights.push(`Top: "${trend.label}" used ${trend.count}x this week ${direction}${Math.abs(trend.trend)}%`);
  }

  return insights.slice(0, 4);
}

function getMaxHeatmapCount(cells: { day: number; hour: number; count: number }[]): number {
  return Math.max(...cells.map(c => c.count), 1);
}

export default function CommandAnalytics({ isOpen, onClose, role, workspaceId, profileId }: Props) {
  const trend = useMemo(() => getTopCommandsWithTrend(5), [isOpen]);
  const heatmap = useMemo(() => getHeatmap(), [isOpen]);
  const popularActions = useMemo(() => getPopularActions(), [isOpen]);
  const insights = useMemo(() => generateInsights(), [isOpen]);
  const maxCount = useMemo(() => getMaxHeatmapCount(heatmap), [heatmap]);

  const logAnalytics = (action: string) => {
    if (!workspaceId) return;
    activityLogService.appendLog({
      workspace_id: workspaceId,
      actor_id: profileId,
      action: 'command_analytics',
      metadata: { analytics_action: action }
    });
  };

  const privacyLabel = role === 'super_admin' ? 'WORKSPACE ANALYTICS'
    : role === 'pm' ? 'TEAM ANALYTICS'
    : 'PERSONAL ANALYTICS';

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.12 }}
            className="fixed inset-0 z-[300] bg-black/70"
            onClick={onClose}
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.96, y: -12 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: -12 }}
            transition={{ duration: 0.15, ease: 'easeOut' }}
            className="fixed inset-0 z-[301] flex items-start justify-center pt-[8vh] px-4 pointer-events-none"
          >
            <div
              className="w-full max-w-2xl max-h-[80vh] overflow-y-auto bg-[#0c0c0c] border border-white/15 shadow-2xl pointer-events-auto"
              onClick={e => e.stopPropagation()}
            >
              {/* Header */}
              <div className="flex items-center justify-between px-5 py-4 border-b border-white/10">
                <div className="flex items-center gap-3">
                  <Activity className="w-4 h-4 text-orange-400" />
                  <span className="text-xs font-mono text-white/90 tracking-wide">COMMAND ANALYTICS</span>
                  <span className="text-[9px] font-mono uppercase text-white/25 border border-white/10 px-1.5 py-0.5">{privacyLabel}</span>
                </div>
                <button onClick={onClose} className="text-white/30 hover:text-white/70 transition-colors">
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="p-5 space-y-6">

                {/* 1. Most Used */}
                <div>
                  <div className="flex items-center gap-2 mb-3">
                    <Cpu className="w-3.5 h-3.5 text-orange-400" />
                    <span className="text-[10px] font-mono uppercase tracking-wider text-white/60">Most Used</span>
                  </div>
                  <div className="space-y-1">
                    {trend.map(t => (
                      <div key={t.id} className="flex items-center gap-3 px-3 py-2 bg-white/[0.02] border border-white/5">
                        <span className="text-xs font-mono text-white/80 flex-1 truncate">{t.label}</span>
                        <span className="text-[10px] font-mono text-white/40">{t.count}x</span>
                        <span className={`text-[10px] font-mono ${t.trend >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                          {t.trend >= 0 ? <TrendingUp className="w-3 h-3 inline" /> : <TrendingDown className="w-3 h-3 inline" />}
                          {' '}{Math.abs(t.trend)}%
                        </span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* 2. Popular Actions */}
                {Object.keys(popularActions).length > 0 && (
                  <div>
                    <div className="flex items-center gap-2 mb-3">
                      <Zap className="w-3.5 h-3.5 text-purple-400" />
                      <span className="text-[10px] font-mono uppercase tracking-wider text-white/60">Popular Actions This Week</span>
                    </div>
                    <div className="space-y-1">
                      {Object.entries(popularActions).map(([label, count]) => {
                        const maxAction = Math.max(...Object.values(popularActions), 1);
                        const pct = Math.round((count / maxAction) * 100);
                        return (
                          <div key={label} className="flex items-center gap-3 px-3 py-1.5">
                            <span className="text-[10px] font-mono text-white/70 w-3 text-right">{count}</span>
                            <div className="flex-1 h-4 bg-white/5 relative">
                              <div
                                className="absolute inset-y-0 left-0 bg-purple-500/40"
                                style={{ width: `${pct}%` }}
                              />
                            </div>
                            <span className="text-[10px] font-mono text-white/50 w-32 truncate text-right">{label}</span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* 3. Workflow Heatmap */}
                <div>
                  <div className="flex items-center gap-2 mb-3">
                    <BarChart3 className="w-3.5 h-3.5 text-cyan-400" />
                    <span className="text-[10px] font-mono uppercase tracking-wider text-white/60">Workflow Heatmap</span>
                    <span className="text-[9px] font-mono text-white/25">(7 days · local time)</span>
                  </div>
                  <div className="overflow-x-auto">
                    <div className="grid grid-cols-[auto_repeat(12,1fr)] gap-px min-w-[400px]">
                      <div className="text-[8px] font-mono text-white/20" />
                      {HOURS.map(h => (
                        <div key={h} className="text-[8px] font-mono text-white/20 text-center">{h}</div>
                      ))}
                      {DAYS.map((day, di) => (
                        <React.Fragment key={day}>
                          <div className="text-[8px] font-mono text-white/30 py-1">{day}</div>
                          {Array.from({ length: 12 }, (_, hi) => {
                            const hourIdx = (hi + 6) % 24;
                            const cell = heatmap.find(c => c.day === di && c.hour === hourIdx);
                            const count = cell?.count || 0;
                            const intensity = maxCount > 0 ? Math.min(count / maxCount, 1) : 0;
                            const bg = intensity === 0 ? 'bg-white/[0.02]'
                              : intensity < 0.2 ? 'bg-cyan-500/10'
                              : intensity < 0.4 ? 'bg-cyan-500/25'
                              : intensity < 0.6 ? 'bg-cyan-500/40'
                              : intensity < 0.8 ? 'bg-cyan-500/60'
                              : 'bg-cyan-500/80';
                            return (
                              <div
                                key={`${di}-${hourIdx}`}
                                className={`aspect-square ${bg} border border-white/[0.03] flex items-center justify-center`}
                                title={`${day} ${hourLabel(hourIdx)} — ${count}`}
                              >
                                <span className="text-[7px] font-mono text-white/40">{count > 0 ? count : ''}</span>
                              </div>
                            );
                          })}
                        </React.Fragment>
                      ))}
                    </div>
                  </div>
                </div>

                {/* 4. Insights */}
                <div>
                  <div className="flex items-center gap-2 mb-3">
                    <BrainCircuit className="w-3.5 h-3.5 text-amber-400" />
                    <span className="text-[10px] font-mono uppercase tracking-wider text-white/60">Insights</span>
                  </div>
                  <div className="space-y-2">
                    {insights.map((insight, i) => (
                      <div key={i} className="flex items-start gap-2 px-3 py-2 bg-white/[0.02] border border-white/5">
                        <span className="text-[9px] font-mono text-amber-400/60 mt-0.5">◆</span>
                        <span className="text-[11px] font-mono text-white/70">{insight}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Footer */}
                <div className="flex items-center justify-between pt-2 border-t border-white/5">
                  <span className="text-[9px] font-mono text-white/20">Data from localStorage — cleared on browser reset</span>
                  <span className="text-[9px] font-mono text-white/20">
                    {trend.reduce((s, t) => s + t.count, 0)} commands this week
                  </span>
                </div>

              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
