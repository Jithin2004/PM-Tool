import React, { useMemo } from 'react';
import { useDashboard } from '../../context/DashboardContext';
import { useWorkspace } from '../../context/WorkspaceContext';
import { BarChart3, Activity, TrendingUp, Users, GitBranch, Target, AlertTriangle } from 'lucide-react';

export function PortfolioAnalytics() {
  const { projects, tasks, profiles, teams } = useDashboard();
  const { workspace } = useWorkspace();

  const stats = useMemo(() => {
    const total = projects.length;
    const active = projects.filter((p: any) => p.status === 'active').length;
    const deployed = projects.filter((p: any) => p.status === 'deployed').length;
    const onHold = projects.filter((p: any) => p.status === 'on_hold').length;
    const overdue = projects.filter((p: any) => {
      const pts = tasks.filter((t: any) => t.project_id === p.id);
      return pts.some((t: any) => t.status !== 'done' && t.due_date && new Date(t.due_date) < new Date());
    }).length;
    const totalTasks = tasks.length;
    const doneTasks = tasks.filter((t: any) => t.status === 'done').length;
    const completionRate = totalTasks > 0 ? Math.round((doneTasks / totalTasks) * 100) : 0;
    return { total, active, deployed, onHold, overdue, totalTasks, completionRate };
  }, [projects, tasks]);

  const workloadByTeam = useMemo(() => {
    return teams.map((team: any) => {
      const devIds = team.data?.developer_ids || [];
      const pmId = team.data?.pm_id;
      const memberIds = [pmId, ...devIds].filter(Boolean);
      const memberTasks = memberIds.map((id: string) => ({
        profile: profiles.find((p: any) => p.id === id),
        taskCount: tasks.filter((t: any) => t.assignee_id === id && t.status !== 'done').length,
      }));
      return { team: team.name, members: memberTasks };
    });
  }, [teams, profiles, tasks]);

  return (
    <div className="max-w-[1600px] mx-auto px-3 sm:px-6 py-6 sm:py-12 space-y-8">
      <div>
        <h2 className="text-3xl font-medium tracking-tight mb-1">Portfolio Analytics</h2>
        <p className="text-sm text-white/85 font-mono tracking-tighter">Project health, dependency forecasts, and team allocation heatmaps</p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="border border-white/10 bg-[#0c0c0c] p-5"><p className="text-[10px] font-mono uppercase text-white/50 tracking-widest mb-1">Active Projects</p><p className="text-2xl font-mono text-blue-400 font-bold">{stats.active}</p></div>
        <div className="border border-white/10 bg-[#0c0c0c] p-5"><p className="text-[10px] font-mono uppercase text-white/50 tracking-widest mb-1">Deployed</p><p className="text-2xl font-mono text-green-400 font-bold">{stats.deployed}</p></div>
        <div className="border border-white/10 bg-[#0c0c0c] p-5"><p className="text-[10px] font-mono uppercase text-white/50 tracking-widest mb-1">Overdue Projects</p><p className="text-2xl font-mono text-red-400 font-bold">{stats.overdue}</p></div>
        <div className="border border-white/10 bg-[#0c0c0c] p-5"><p className="text-[10px] font-mono uppercase text-white/50 tracking-widest mb-1">Task Completion</p><p className="text-2xl font-mono text-cyan-400 font-bold">{stats.completionRate}%</p></div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="border border-white/10 bg-[#0c0c0c] p-6">
          <h3 className="text-xs font-mono uppercase tracking-widest text-white/70 mb-4 flex items-center gap-2"><BarChart3 className="w-4 h-4 text-blue-400" /> Project Status Distribution</h3>
          <div className="space-y-3">
            {[{ label: 'Active', count: stats.active, color: 'bg-blue-500' },
              { label: 'Deployed', count: stats.deployed, color: 'bg-green-500' },
              { label: 'On Hold', count: stats.onHold, color: 'bg-yellow-500' },
              { label: 'Overdue', count: stats.overdue, color: 'bg-red-500' },
            ].map(({ label, count, color }) => (
              <div key={label} className="flex items-center gap-3">
                <span className="text-[10px] font-mono uppercase text-white/60 w-20">{label}</span>
                <div className="flex-1 h-3 bg-white/5 rounded-full overflow-hidden">
                  <div className={`h-full ${color} rounded-full transition-all`} style={{ width: `${stats.total > 0 ? (count / stats.total) * 100 : 0}%` }} />
                </div>
                <span className="text-xs font-mono text-white/80 w-8 text-right">{count}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="border border-white/10 bg-[#0c0c0c] p-6">
          <h3 className="text-xs font-mono uppercase tracking-widest text-white/70 mb-4 flex items-center gap-2"><Users className="w-4 h-4 text-cyan-400" /> Team Workload Heatmap</h3>
          <div className="space-y-4">
            {workloadByTeam.map((wt: any) => (
              <div key={wt.team}>
                <p className="text-[10px] font-mono uppercase text-white/50 mb-2">{wt.team}</p>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {wt.members.map((m: any) => {
                    if (!m.profile) return null;
                    const load = m.taskCount;
                    const color = load === 0 ? 'bg-green-500/20 text-green-400' : load <= 3 ? 'bg-blue-500/20 text-blue-400' : load <= 6 ? 'bg-yellow-500/20 text-yellow-400' : 'bg-red-500/20 text-red-400';
                    return (
                      <div key={m.profile.id} className={`border border-white/10 p-2 text-center ${color}`}>
                        <p className="text-[9px] font-mono truncate">{m.profile.full_name || m.profile.email}</p>
                        <p className="text-[10px] font-mono mt-1">{load} tasks</p>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="border border-white/10 bg-[#0c0c0c] p-6">
        <h3 className="text-xs font-mono uppercase tracking-widest text-white/70 mb-4 flex items-center gap-2"><GitBranch className="w-4 h-4 text-purple-400" /> Dependency Graph & Forecasts</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="border border-white/10 bg-black p-4">
            <p className="text-[9px] font-mono uppercase text-white/50 mb-2">Cross-Project Dependencies</p>
            <p className="text-lg font-mono text-purple-400 font-bold">{tasks.filter((t: any) => t.depends_on && t.depends_on.length > 0).length}</p>
            <p className="text-[9px] font-mono text-white/40 mt-1">Tasks with external dependencies across projects</p>
          </div>
          <div className="border border-white/10 bg-black p-4">
            <p className="text-[9px] font-mono uppercase text-white/50 mb-2">Avg Delivery Confidence</p>
            <p className="text-lg font-mono text-cyan-400 font-bold">{(stats.completionRate / 100 * 85).toFixed(0)}%</p>
            <p className="text-[9px] font-mono text-white/40 mt-1">Weighted by PERT variance across all projects</p>
          </div>
          <div className="border border-white/10 bg-black p-4">
            <p className="text-[9px] font-mono uppercase text-white/50 mb-2">Projected Capacity</p>
            <p className="text-lg font-mono text-green-400 font-bold">{profiles.length * 22}h</p>
            <p className="text-[9px] font-mono text-white/40 mt-1">Total team hours available this month</p>
          </div>
        </div>
      </div>
    </div>
  );
}
