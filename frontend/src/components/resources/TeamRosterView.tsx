import React, { useMemo } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useDashboard } from '../../context/DashboardContext';
import { Users, Shield, Zap, Activity, Clock, Briefcase, Layers } from 'lucide-react';

export function TeamRosterView() {
  const { profile } = useAuth();
  const { profiles, teams, tasks, projects } = useDashboard();

  const enrichedTeams = useMemo(() => {
    return teams.filter((t: any) => t.name !== 'SYSTEM_SETTINGS').map((team: any) => {
      const pmId = team.data?.pm_id;
      const devIds = Array.isArray(team.data?.developer_ids) ? team.data.developer_ids : [];
      const pm = profiles.find((p: any) => p.id === pmId);
      const members = devIds.map((id: string) => {
        const p = profiles.find((prof: any) => prof.id === id);
        if (!p) return null;
        const openTasks = tasks.filter((t: any) => t.assignee_id === id && t.status !== 'done');
        const totalHours = openTasks.reduce((s: number, t: any) => s + (t.estimated_hours || 0), 0);
        return { ...p, openTasks: openTasks.length, workloadHours: totalHours };
      }).filter(Boolean);

      // Associated active project boundaries
      const activeProjects = projects.filter((p: any) => p.team_id === team.id && p.status !== 'deployed');
      
      const devsCount = members.length;
      const weeklyCapacity = devsCount * 40; // 40h per developer weekly capacity
      const teamExpectedHours = members.reduce((s: number, m: any) => s + m.workloadHours, 0);
      const teamSaturation = weeklyCapacity > 0 ? Math.round((teamExpectedHours / weeklyCapacity) * 100) : 0;

      return { 
        ...team, 
        pm, 
        members, 
        activeProjects,
        devsCount,
        weeklyCapacity,
        teamExpectedHours,
        teamSaturation 
      };
    });
  }, [teams, profiles, tasks, projects]);

  return (
    <div className="max-w-[1600px] mx-auto px-3 sm:px-6 py-6 sm:py-12 space-y-8">
      <div>
        <h2 className="text-3xl font-medium tracking-tight mb-1 text-text-primary">Team Capacity & Allocation Matrix</h2>
        <p className="text-sm text-text-secondary font-mono tracking-tighter">Operational capacity, team role allocations, and workload saturation across active project boundaries</p>
      </div>

      <div className="grid grid-cols-1 gap-8">
        {enrichedTeams.map((team: any) => {
          // Saturation color selection based on thresholds
          const saturationColor = team.teamSaturation > 100 
            ? 'text-signal-critical' 
            : team.teamSaturation >= 80 
              ? 'text-signal-warning' 
              : 'text-text-primary';
          
          const progressColor = team.teamSaturation > 100 
            ? 'bg-signal-critical' 
            : team.teamSaturation >= 80 
              ? 'bg-signal-warning' 
              : 'bg-accent-primary';

          return (
            <div key={team.id} className="border border-border bg-surface-2 overflow-hidden rounded-xl shadow-premium">
              {/* Header Panel */}
              <div className="p-6 border-b border-border bg-bg/50 flex flex-col lg:flex-row lg:items-center justify-between gap-6">
                <div className="flex items-start gap-4">
                  <div className="w-12 h-12 border border-border bg-surface-3 flex items-center justify-center rounded-lg">
                    <Users className="w-6 h-6 text-text-secondary" />
                  </div>
                  <div>
                    <h3 className="text-base font-semibold text-text-primary uppercase tracking-tight">{team.name}</h3>
                    <div className="flex items-center gap-3 mt-1 text-[11px] font-mono text-text-tertiary">
                      <span>STAFF: <strong className="text-text-secondary">{team.members.length + (team.pm ? 1 : 0)} Units</strong></span>
                      <span>•</span>
                      <span>LEAD: <strong className="text-text-secondary">{team.pm ? (team.pm.full_name || team.pm.email) : 'Unallocated'}</strong></span>
                    </div>
                  </div>
                </div>

                {/* Workload Saturation Indicator */}
                <div className="flex flex-col sm:flex-row sm:items-center gap-6 lg:self-center">
                  <div className="space-y-1">
                    <div className="flex justify-between items-center text-[10px] font-mono uppercase text-text-tertiary tracking-wider gap-8">
                      <span>Workload Saturation</span>
                      <span className={`font-bold ${saturationColor}`}>{team.teamSaturation}%</span>
                    </div>
                    <div className="w-48 h-1.5 bg-surface-3 rounded-full overflow-hidden">
                      <div className={`h-full ${progressColor} transition-all`} style={{ width: `${Math.min(100, team.teamSaturation)}%` }} />
                    </div>
                    <div className="text-[9px] font-mono text-text-tertiary text-right">
                      {team.teamExpectedHours}h / {team.weeklyCapacity}h Capacity
                    </div>
                  </div>

                  {/* Active Projects Boundaries */}
                  <div className="border-l border-border pl-6 space-y-1">
                    <p className="text-[10px] font-mono uppercase text-text-tertiary tracking-wider flex items-center gap-1.5">
                      <Briefcase className="w-3.5 h-3.5 text-text-secondary" />
                      Active Projects
                    </p>
                    {team.activeProjects.length === 0 ? (
                      <span className="text-[10px] font-mono text-text-quaternary italic block">No active project boundaries</span>
                    ) : (
                      <div className="flex flex-wrap gap-1.5 max-w-xs">
                        {team.activeProjects.map((p: any) => (
                          <span key={p.id} className="text-[9px] font-mono bg-surface-3 border border-border text-text-secondary px-1.5 py-0.5 rounded-md truncate max-w-[120px]">
                            {p.name}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Roster Matrix View */}
              <div className="p-0">
                <div>
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="border-b border-border bg-surface-3/30 text-[9px] font-mono uppercase tracking-wider text-text-tertiary">
                        <th className="px-6 py-3 font-semibold">Team Role Allocation</th>
                        <th className="px-6 py-3 font-semibold">Assignment Metrics</th>
                        <th className="px-6 py-3 font-semibold">Allocated Load</th>
                        <th className="px-6 py-3 font-semibold">Utilization Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {/* PM Lead Row */}
                      {team.pm && (
                        <tr className="hover:bg-surface-3/15 transition-all text-xs">
                          <td className="px-6 py-4">
                            <div className="flex items-center gap-3">
                              <div className="w-8 h-8 border border-border bg-surface-3 flex items-center justify-center rounded-md shrink-0 text-text-secondary text-[10px] font-mono font-bold">
                                <Shield className="w-4 h-4 text-text-secondary" />
                              </div>
                              <div>
                                <p className="font-semibold text-text-primary">{team.pm.full_name || team.pm.email}</p>
                                <p className="text-[9px] font-mono text-text-tertiary uppercase">Squad Lead</p>
                              </div>
                            </div>
                          </td>
                          <td className="px-6 py-4 text-text-secondary font-mono">-</td>
                          <td className="px-6 py-4 text-text-secondary font-mono">-</td>
                          <td className="px-6 py-4">
                            <span className="inline-flex items-center gap-1.5 text-[10px] font-mono text-text-secondary uppercase">
                              <span className="w-1.5 h-1.5 rounded-full bg-text-secondary" />
                              Management
                            </span>
                          </td>
                        </tr>
                      )}

                      {/* Developers Rows */}
                      {team.members.map((member: any) => {
                        const loadPct = member.workloadHours > 40 ? 100 : Math.round((member.workloadHours / 40) * 100);
                        const statusText = loadPct > 100 
                          ? 'Overloaded' 
                          : loadPct >= 80 
                            ? 'High Capacity' 
                            : loadPct >= 50 
                              ? 'Optimal' 
                              : 'Underutilized';

                        const barColor = loadPct > 100 
                          ? 'bg-signal-critical' 
                          : loadPct >= 80 
                            ? 'bg-signal-warning' 
                            : 'bg-signal-safe';

                        const statusDotColor = loadPct > 100 
                          ? 'bg-signal-critical' 
                          : loadPct >= 80 
                            ? 'bg-signal-warning' 
                            : 'bg-signal-safe';

                        const statusTextColor = loadPct > 100 
                          ? 'text-signal-critical font-bold' 
                          : loadPct >= 80 
                            ? 'text-signal-warning' 
                            : 'text-signal-safe';

                        return (
                          <tr key={member.id} className="hover:bg-surface-3/15 transition-all text-xs">
                            <td className="px-6 py-4">
                              <div className="flex items-center gap-3">
                                <div className="w-8 h-8 border border-border bg-surface-3 flex items-center justify-center rounded-md shrink-0 text-text-secondary text-[10px] font-mono font-bold">
                                  {(member.full_name || member.email).charAt(0).toUpperCase()}
                                </div>
                                <div>
                                  <p className="font-semibold text-text-primary">{member.full_name || member.email}</p>
                                  <p className="text-[9px] font-mono text-text-tertiary uppercase">Developer</p>
                                </div>
                              </div>
                            </td>
                            <td className="px-6 py-4">
                              <div className="flex items-center gap-4 text-text-secondary font-mono text-[11px]">
                                <span className="flex items-center gap-1.5">
                                  <Activity className="w-3.5 h-3.5 text-text-tertiary" />
                                  {member.openTasks} Tasks
                                </span>
                                <span className="flex items-center gap-1.5">
                                  <Clock className="w-3.5 h-3.5 text-text-tertiary" />
                                  {member.workloadHours}h
                                </span>
                              </div>
                            </td>
                            <td className="px-6 py-4">
                              <div className="space-y-1">
                                <div className="flex items-center justify-between text-[9px] font-mono text-text-tertiary w-24">
                                  <span>Load</span>
                                  <span>{loadPct}%</span>
                                </div>
                                <div className="w-24 h-1 bg-surface-3 rounded-full overflow-hidden">
                                  <div className={`h-full ${barColor} rounded-full transition-all`} style={{ width: `${loadPct}%` }} />
                                </div>
                              </div>
                            </td>
                            <td className="px-6 py-4">
                              <span className={`inline-flex items-center gap-1.5 text-[10px] font-mono uppercase ${statusTextColor}`}>
                                <span className={`w-1.5 h-1.5 rounded-full ${statusDotColor}`} />
                                {statusText}
                              </span>
                            </td>
                          </tr>
                        );
                      })}

                      {team.members.length === 0 && !team.pm && (
                        <tr>
                          <td colSpan={4} className="px-6 py-8 text-center text-xs font-mono text-text-quaternary italic bg-surface-2/20">
                            No team members allocated to this squad
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
