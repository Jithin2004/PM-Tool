import React, { useMemo } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useDashboard } from '../../context/DashboardContext';
import { BarChart3, TrendingUp, Activity, Users, Target, Zap, Clock, CheckCircle } from 'lucide-react';

export function ExecutiveAnalytics() {
  const { profile } = useAuth();
  const { projects, tasks, profiles, teams } = useDashboard();

  const metrics = useMemo(() => {
    const totalProjects = projects.length;
    const activeProjects = projects.filter((p: any) => p.status === 'active').length;
    const totalTasks = tasks.length;
    const completedTasks = tasks.filter((t: any) => t.status === 'done').length;
    const completionRate = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;
    const inProgressTasks = tasks.filter((t: any) => t.status === 'in_progress').length;
    const backlogTasks = tasks.filter((t: any) => t.status === 'backlog').length;
    const overdueTasks = tasks.filter((t: any) => t.status !== 'done' && t.due_date && new Date(t.due_date) < new Date()).length;
    const totalProfiles = profiles.length;
    const totalTeams = teams.filter((t: any) => t.name !== 'SYSTEM_SETTINGS').length;
    const avgTasksPerProject = totalProjects > 0 ? Math.round(totalTasks / totalProjects) : 0;
    const executionModes = projects.reduce((acc: Record<string, number>, p: any) => {
      acc[p.execution_mode] = (acc[p.execution_mode] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
    return { totalProjects, activeProjects, totalTasks, completedTasks, completionRate, inProgressTasks, backlogTasks, overdueTasks, totalProfiles, totalTeams, avgTasksPerProject, executionModes };
  }, [projects, tasks, profiles, teams]);

  const velocityData = useMemo(() => {
    const byMode: Record<string, number> = {};
    projects.forEach((p: any) => {
      const mode = p.execution_mode || 'unknown';
      const pts = tasks.filter((t: any) => t.project_id === p.id && t.status === 'done');
      const vel = pts.length;
      byMode[mode] = (byMode[mode] || 0) + vel;
    });
    return byMode;
  }, [projects, tasks]);

  const systemHealth = useMemo(() => {
    const warnings: { label: string; status: 'good' | 'warning' | 'critical'; value: string }[] = [];
    if (metrics.overdueTasks > 10) warnings.push({ label: 'Overdue Tasks', status: 'critical', value: `${metrics.overdueTasks}` });
    else if (metrics.overdueTasks > 0) warnings.push({ label: 'Overdue Tasks', status: 'warning', value: `${metrics.overdueTasks}` });
    else warnings.push({ label: 'Overdue Tasks', status: 'good', value: '0' });

    if (metrics.backlogTasks > 50) warnings.push({ label: 'Backlog Size', status: 'warning', value: `${metrics.backlogTasks}` });
    else warnings.push({ label: 'Backlog Size', status: 'good', value: `${metrics.backlogTasks}` });

    if (metrics.completionRate < 30) warnings.push({ label: 'Completion Rate', status: 'critical', value: `${metrics.completionRate}%` });
    else if (metrics.completionRate < 60) warnings.push({ label: 'Completion Rate', status: 'warning', value: `${metrics.completionRate}%` });
    else warnings.push({ label: 'Completion Rate', status: 'good', value: `${metrics.completionRate}%` });

    return warnings;
  }, [metrics]);

  return (
    <div className="max-w-[1600px] mx-auto px-3 sm:px-6 py-6 sm:py-12 space-y-8">
      <div>
        <h2 className="text-3xl font-medium tracking-tight mb-1">Executive Analytics</h2>
        <p className="text-sm text-text-secondary font-mono tracking-tighter">High-level metrics, velocity, and system health</p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="border border-border bg-surface p-5"><p className="text-[10px] font-mono uppercase text-text-tertiary tracking-wide mb-1">Projects</p><p className="text-2xl font-sans tracking-tight text-signal-info font-bold">{metrics.totalProjects}<span className="text-sm text-text-quaternary ml-1">({metrics.activeProjects} active)</span></p></div>
        <div className="border border-border bg-surface p-5"><p className="text-[10px] font-mono uppercase text-text-tertiary tracking-wide mb-1">Tasks</p><p className="text-2xl font-sans tracking-tight text-cyan-400 font-bold">{metrics.totalTasks}<span className="text-sm text-text-quaternary ml-1">({metrics.completedTasks} done)</span></p></div>
        <div className="border border-border bg-surface p-5"><p className="text-[10px] font-mono uppercase text-text-tertiary tracking-wide mb-1">Team</p><p className="text-2xl font-sans tracking-tight text-accent-secondary font-bold">{metrics.totalProfiles}<span className="text-sm text-text-quaternary ml-1">in {metrics.totalTeams} teams</span></p></div>
        <div className="border border-border bg-surface p-5"><p className="text-[10px] font-mono uppercase text-text-tertiary tracking-wide mb-1">Completion</p><p className="text-2xl font-sans tracking-tight text-signal-safe font-bold">{metrics.completionRate}%</p></div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="border border-border bg-surface p-6">
          <h3 className="text-xs font-sans tracking-tight uppercase tracking-wide text-text-secondary mb-4 flex items-center gap-2"><Activity className="w-4 h-4 text-signal-info" /> Task Pipeline</h3>
          <div className="space-y-3">
            {[{ label: 'Backlog', count: metrics.backlogTasks, color: 'bg-white/20' },
              { label: 'In Progress', count: metrics.inProgressTasks, color: 'bg-yellow-500' },
              { label: 'Completed', count: metrics.completedTasks, color: 'bg-green-500' },
              { label: 'Overdue', count: metrics.overdueTasks, color: 'bg-red-500' },
            ].map(({ label, count, color }) => (
              <div key={label} className="flex items-center gap-3">
                <span className="text-[10px] font-mono uppercase text-text-tertiary w-20">{label}</span>
                <div className="flex-1 h-4 bg-white/5 rounded-sm overflow-hidden">
                  <div className={`h-full ${color} rounded-sm transition-all`} style={{ width: `${metrics.totalTasks > 0 ? (count / metrics.totalTasks) * 100 : 0}%` }} />
                </div>
                <span className="text-xs font-mono text-text-secondary w-8 text-right">{count}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="border border-border bg-surface p-6">
          <h3 className="text-xs font-sans tracking-tight uppercase tracking-wide text-text-secondary mb-4 flex items-center gap-2"><Zap className="w-4 h-4 text-accent-secondary" /> Velocity by Mode</h3>
          <div className="space-y-3">
            {Object.entries(metrics.executionModes).map(([mode, count]) => {
              const completed = velocityData[mode] || 0;
              return (
                <div key={mode} className="border border-border bg-bg p-4">
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-[10px] font-mono uppercase text-text-secondary">{mode}</span>
                    <span className="text-xs font-mono text-cyan-400">{completed} completed</span>
                  </div>
                  <p className="text-[9px] font-mono text-text-quaternary">{count} project{count > 1 ? 's' : ''}</p>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      <div className="border border-border bg-surface p-6">
        <h3 className="text-xs font-sans tracking-tight uppercase tracking-wide text-text-secondary mb-4 flex items-center gap-2"><Target className="w-4 h-4 text-emerald-400" /> System Health</h3>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {systemHealth.map((item) => (
            <div key={item.label} className={`border p-4 ${
              item.status === 'critical' ? 'border-red-500/30 bg-signal-critical-bg' :
              item.status === 'warning' ? 'border-yellow-500/30 bg-signal-warning-bg' :
              'border-border bg-signal-safe-bg'
            }`}>
              <div className="flex items-center gap-2 mb-2">
                <div className={`w-2 h-2 rounded-full ${
                  item.status === 'critical' ? 'bg-red-500' :
                  item.status === 'warning' ? 'bg-yellow-500' : 'bg-green-500'
                }`} />
                <span className="text-[10px] font-mono uppercase text-text-tertiary">{item.label}</span>
              </div>
              <p className="text-lg font-sans tracking-tight font-bold text-text-primary">{item.value}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
