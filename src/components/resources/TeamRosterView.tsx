import React, { useMemo } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useDashboard } from '../../context/DashboardContext';
import { Users, Shield, Zap, Activity, Clock } from 'lucide-react';

export function TeamRosterView() {
  const { profile } = useAuth();
  const { profiles, teams, tasks } = useDashboard();

  const enrichedTeams = useMemo(() => {
    return teams.filter((t: any) => t.name !== 'SYSTEM_SETTINGS').map((team: any) => {
      const pmId = team.data?.pm_id;
      const devIds = team.data?.developer_ids || [];
      const pm = profiles.find((p: any) => p.id === pmId);
      const members = devIds.map((id: string) => {
        const p = profiles.find((prof: any) => prof.id === id);
        if (!p) return null;
        const openTasks = tasks.filter((t: any) => t.assignee_id === id && t.status !== 'done');
        const totalHours = openTasks.reduce((s: number, t: any) => s + (t.estimated_hours || 0), 0);
        return { ...p, openTasks: openTasks.length, workloadHours: totalHours, role: p.role };
      }).filter(Boolean);
      return { ...team, pm, members };
    });
  }, [teams, profiles, tasks]);

  return (
    <div className="max-w-[1600px] mx-auto px-3 sm:px-6 py-6 sm:py-12 space-y-8">
      <div>
        <h2 className="text-3xl font-medium tracking-tight mb-1">Team Roster</h2>
        <p className="text-sm text-white/85 font-mono tracking-tighter">Roles, skills, and workload across all teams</p>
      </div>

      <div className="grid grid-cols-1 gap-8">
        {enrichedTeams.map((team: any) => (
          <div key={team.id} className="border border-white/10 bg-[#0c0c0c] overflow-hidden">
            <div className="p-6 border-b border-white/10 bg-[#0a0a0a] flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 border border-white/10 bg-white/5 flex items-center justify-center"><Users className="w-5 h-5 text-blue-400" /></div>
                <div>
                  <h3 className="text-sm font-semibold">{team.name}</h3>
                  <p className="text-[10px] font-mono text-white/50">{team.members.length + (team.pm ? 1 : 0)} members</p>
                </div>
              </div>
            </div>
            {team.pm && (
              <div className="px-6 py-3 border-b border-white/5 bg-blue-500/5 flex items-center gap-3">
                <Shield className="w-4 h-4 text-blue-400" />
                <span className="text-[10px] font-mono text-blue-300 uppercase">Lead: {team.pm.full_name || team.pm.email}</span>
              </div>
            )}
            <div className="divide-y divide-white/5">
              {team.members.map((member: any) => {
                const loadPct = member.workloadHours > 40 ? 100 : Math.round((member.workloadHours / 40) * 100);
                const color = loadPct > 80 ? 'bg-red-500' : loadPct > 50 ? 'bg-yellow-500' : 'bg-green-500';
                return (
                  <div key={member.id} className="px-6 py-4 flex items-center justify-between hover:bg-white/[0.02]">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 border border-white/10 bg-white/5 flex items-center justify-center text-[10px] font-mono">
                        {(member.full_name || member.email).charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <p className="text-xs font-medium text-white/90">{member.full_name || member.email}</p>
                        <p className="text-[9px] font-mono text-white/50 uppercase">{member.role}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-6">
                      <div className="flex items-center gap-2">
                        <Activity className="w-3 h-3 text-white/40" />
                        <span className="text-[10px] font-mono text-white/60">{member.openTasks} tasks</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Clock className="w-3 h-3 text-white/40" />
                        <span className="text-[10px] font-mono text-white/60">{member.workloadHours}h</span>
                      </div>
                      <div className="w-20 h-2 bg-white/5 rounded-full overflow-hidden">
                        <div className={`h-full ${color} rounded-full transition-all`} style={{ width: `${loadPct}%` }} />
                      </div>
                    </div>
                  </div>
                );
              })}
              {team.members.length === 0 && (
                <div className="px-6 py-8 text-center text-xs font-mono text-white/40 italic">No members assigned</div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
