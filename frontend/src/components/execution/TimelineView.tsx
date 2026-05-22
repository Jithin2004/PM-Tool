import React, { useMemo } from 'react';
import { Activity, GitBranch, Calendar, AlertTriangle, ArrowRight, Clock } from 'lucide-react';

interface TimelineViewProps {
  projects: any[];
  tasks: any[];
  dependencies: any[];
  profiles: any[];
}

export function TimelineView({ projects, tasks, dependencies, profiles }: TimelineViewProps) {
  // Backward compat: accept legacy props shape
  if (!projects && (arguments[0] as any)?.kanbanProjects) {
    return null;
  }
  const timelineData = useMemo(() => {
    const now = new Date();
    const phases: { label: string; start: Date; end: Date; progress: number; tasks: number }[] = [];
    const criticalPath: any[] = [];

    projects.forEach((p: any) => {
      const ptasks = tasks.filter((t: any) => t.project_id === p.id);
      const dates = ptasks.filter((t: any) => t.due_date).map((t: any) => new Date(t.due_date));
      if (dates.length === 0) return;
      const earliest = new Date(Math.min(...dates.map(d => d.getTime())));
      const latest = new Date(Math.max(...dates.map(d => d.getTime())));
      const done = ptasks.filter((t: any) => t.status === 'done').length;
      phases.push({
        label: p.name,
        start: earliest,
        end: latest,
        progress: ptasks.length > 0 ? Math.round((done / ptasks.length) * 100) : 0,
        tasks: ptasks.length,
      });

      const chain = ptasks.filter((t: any) => {
        const deps = dependencies.filter((d: any) => d.task_id === t.id);
        return deps.length > 0;
      });
      chain.forEach((t: any) => {
        const depTasks = dependencies
          .filter((d: any) => d.task_id === t.id)
          .map((d: any) => tasks.find((task: any) => task.id === d.depends_on_task_id))
          .filter(Boolean);
        if (depTasks.length > 0) criticalPath.push({ task: t, dependsOn: depTasks });
      });
    });

    phases.sort((a, b) => a.start.getTime() - b.start.getTime());

    const todayOffset = Math.min(...phases.map(p => p.start.getTime()));
    const maxEnd = Math.max(...phases.map(p => p.end.getTime()));
    const range = maxEnd - todayOffset || 1;

    return { phases, criticalPath, todayOffset, range, now };
  }, [projects, tasks, dependencies]);

  const schedulingInsights = useMemo(() => {
    const insights: { type: 'warning' | 'info' | 'error'; message: string }[] = [];
    const overloaded = profiles.filter((p: any) => {
      const openTasks = tasks.filter((t: any) => t.assignee_id === p.id && t.status !== 'done');
      const totalHours = openTasks.reduce((s: number, t: any) => s + (t.estimated_hours || 0), 0);
      return totalHours > 40;
    });
    if (overloaded.length > 0) insights.push({ type: 'warning', message: `${overloaded.length} team members exceed 40h workload` });
    const untimed = tasks.filter((t: any) => t.status !== 'done' && !t.due_date);
    if (untimed.length > 0) insights.push({ type: 'info', message: `${untimed.length} tasks have no due date` });
    const overdue = tasks.filter((t: any) => t.status !== 'done' && t.due_date && new Date(t.due_date) < new Date());
    if (overdue.length > 0) insights.push({ type: 'error', message: `${overdue.length} tasks are past due date` });
    return insights;
  }, [tasks, profiles]);

  return (
    <div className="max-w-[1600px] mx-auto px-3 sm:px-6 py-6 sm:py-12 space-y-8">
      <div>
        <h2 className="text-3xl font-medium tracking-tight mb-1">Timeline Intelligence</h2>
        <p className="text-sm text-white/85 font-mono tracking-tighter">Dependency propagation and scheduling intelligence across all projects</p>
      </div>

      {schedulingInsights.length > 0 && (
        <div className="space-y-2">
          {schedulingInsights.map((insight, i) => (
            <div key={i} className={`flex items-center gap-3 px-4 py-3 border text-xs font-mono ${
              insight.type === 'error' ? 'border-red-500/30 bg-red-500/5 text-red-300' :
              insight.type === 'warning' ? 'border-yellow-500/30 bg-yellow-500/5 text-yellow-300' :
              'border-blue-500/30 bg-blue-500/5 text-blue-300'
            }`}>
              <AlertTriangle className="w-4 h-4 shrink-0" />
              {insight.message}
            </div>
          ))}
        </div>
      )}

      <div className="border border-white/10 bg-[#0c0c0c] p-6">
        <h3 className="text-xs font-mono uppercase tracking-widest text-white/70 mb-6 flex items-center gap-2"><Activity className="w-4 h-4 text-blue-400" /> Project Timeline Phases</h3>
        {timelineData.phases.length === 0 ? (
          <p className="text-xs font-mono text-white/40 italic text-center py-8">No timeline data available. Add due dates to tasks.</p>
        ) : (
          <div className="space-y-4">
            {timelineData.phases.map((phase, i) => {
              const left = ((phase.start.getTime() - timelineData.todayOffset) / timelineData.range) * 100;
              const width = ((phase.end.getTime() - phase.start.getTime()) / timelineData.range) * 100;
              const isPast = phase.end < timelineData.now;
              return (
                <div key={i} className="relative">
                  <div className="flex items-center gap-4 mb-1">
                    <span className="text-[10px] font-mono text-white/70 w-32 truncate" title={phase.label}>{phase.label}</span>
                    <div className="flex-1 h-6 bg-white/5 relative rounded-sm overflow-hidden">
                      <div className={`absolute h-full ${isPast ? 'bg-white/10' : 'bg-blue-500/20'} rounded-sm`} style={{ left: `${Math.max(0, left)}%`, width: `${Math.max(1, width)}%` }} />
                      <div className={`absolute h-full ${isPast ? 'bg-white/20' : 'bg-blue-500/40'}`} style={{ left: `${Math.max(0, left)}%`, width: `${Math.max(1, width * (phase.progress / 100))}%` }} />
                    </div>
                    <span className="text-[9px] font-mono text-white/50 w-12 text-right">{phase.progress}%</span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="border border-white/10 bg-[#0c0c0c] p-6">
          <h3 className="text-xs font-mono uppercase tracking-widest text-white/70 mb-4 flex items-center gap-2"><GitBranch className="w-4 h-4 text-purple-400" /> Critical Path Dependencies</h3>
          {timelineData.criticalPath.length === 0 ? (
            <p className="text-xs font-mono text-white/40 italic py-8 text-center">No chained dependencies detected</p>
          ) : (
            <div className="space-y-3">
              {timelineData.criticalPath.slice(0, 10).map((cp: any, i: number) => (
                <div key={i} className="flex items-start gap-2 border-l-2 border-purple-500/30 pl-3 py-1">
                  <ArrowRight className="w-3 h-3 text-purple-400 mt-0.5 shrink-0" />
                  <div>
                    <p className="text-[10px] font-mono text-white/80">{cp.task.name}</p>
                    <p className="text-[8px] font-mono text-white/40">
                      Depends on: {cp.dependsOn.map((d: any) => d?.name).filter(Boolean).join(', ')}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="border border-white/10 bg-[#0c0c0c] p-6">
          <h3 className="text-xs font-mono uppercase tracking-widest text-white/70 mb-4 flex items-center gap-2"><Calendar className="w-4 h-4 text-cyan-400" /> Scheduling Intelligence</h3>
          <div className="space-y-4">
            <div className="border border-white/10 bg-black p-4">
              <p className="text-[9px] font-mono uppercase text-white/50 mb-1">Earliest Start</p>
              <p className="text-sm font-mono text-white/80">{timelineData.phases.length > 0 ? timelineData.phases[0]?.start.toLocaleDateString() : 'N/A'}</p>
            </div>
            <div className="border border-white/10 bg-black p-4">
              <p className="text-[9px] font-mono uppercase text-white/50 mb-1">Latest Delivery</p>
              <p className="text-sm font-mono text-white/80">{timelineData.phases.length > 0 ? timelineData.phases[timelineData.phases.length - 1]?.end.toLocaleDateString() : 'N/A'}</p>
            </div>
            <div className="border border-white/10 bg-black p-4">
              <p className="text-[9px] font-mono uppercase text-white/50 mb-1">Total Projects in Timeline</p>
              <p className="text-sm font-mono text-cyan-400 font-bold">{timelineData.phases.length}</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default TimelineView;
