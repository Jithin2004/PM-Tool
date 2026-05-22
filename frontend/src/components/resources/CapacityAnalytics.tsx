import React, { useMemo } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useDashboard } from '../../context/DashboardContext';
import { BarChart3, TrendingUp, Users, AlertTriangle, Target } from 'lucide-react';

export function CapacityAnalytics() {
  const { profile } = useAuth();
  const { profiles, teams, tasks, projects } = useDashboard();

  const capacityData = useMemo(() => {
    const totalCapacity = profiles.length * 160;
    const totalAssigned = tasks.filter((t: any) => t.assignee_id && t.status !== 'done')
      .reduce((s: number, t: any) => s + (t.estimated_hours || 0), 0);
    const utilization = totalCapacity > 0 ? Math.round((totalAssigned / totalCapacity) * 100) : 0;

    const byTeam = teams.filter((t: any) => t.name !== 'SYSTEM_SETTINGS').map((team: any) => {
      const devIds = team.data?.developer_ids || [];
      const pmId = team.data?.pm_id;
      const allIds = [pmId, ...devIds].filter(Boolean);
      const memberHours = allIds.map((id: string) => {
        const p = profiles.find((prof: any) => prof.id === id);
        const hrs = tasks.filter((t: any) => t.assignee_id === id && t.status !== 'done')
          .reduce((s: number, t: any) => s + (t.estimated_hours || 0), 0);
        return { name: p?.full_name || p?.email || 'Unknown', hours: hrs, capacity: 160 };
      });
      return { name: team.name, members: memberHours };
    });

    const overloaded = profiles.filter((p: any) => {
      const hrs = tasks.filter((t: any) => t.assignee_id === p.id && t.status !== 'done')
        .reduce((s: number, t: any) => s + (t.estimated_hours || 0), 0);
      return hrs > 160;
    });

    const forecast = Math.round(totalAssigned / Math.max(1, profiles.length) / 160 * 100);
    return { totalCapacity, totalAssigned, utilization, byTeam, overloaded, forecast };
  }, [profiles, tasks, teams]);

  return (
    <div className="max-w-[1600px] mx-auto px-3 sm:px-6 py-6 sm:py-12 space-y-8">
      <div>
        <h2 className="text-3xl font-medium tracking-tight mb-1">Capacity Analytics</h2>
        <p className="text-sm text-white/85 font-mono tracking-tighter">Allocation, utilization, and capacity forecasting</p>
      </div>

      {capacityData.overloaded.length > 0 && (
        <div className="flex items-center gap-3 px-4 py-3 border border-red-500/30 bg-red-500/5 text-red-300 text-xs font-mono">
          <AlertTriangle className="w-4 h-4 shrink-0" />
          {capacityData.overloaded.length} team member{capacityData.overloaded.length > 1 ? 's' : ''} exceed{capacityData.overloaded.length === 1 ? 's' : ''} 100% capacity
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="border border-white/10 bg-[#0c0c0c] p-5">
          <p className="text-[10px] font-mono uppercase text-white/50 tracking-widest mb-1">Total Capacity</p>
          <p className="text-2xl font-mono text-blue-400 font-bold">{capacityData.totalCapacity}h</p>
        </div>
        <div className="border border-white/10 bg-[#0c0c0c] p-5">
          <p className="text-[10px] font-mono uppercase text-white/50 tracking-widest mb-1">Assigned Hours</p>
          <p className="text-2xl font-mono text-cyan-400 font-bold">{capacityData.totalAssigned}h</p>
        </div>
        <div className="border border-white/10 bg-[#0c0c0c] p-5">
          <p className="text-[10px] font-mono uppercase text-white/50 tracking-widest mb-1">Utilization</p>
          <p className={`text-2xl font-mono font-bold ${capacityData.utilization > 80 ? 'text-red-400' : capacityData.utilization > 50 ? 'text-yellow-400' : 'text-green-400'}`}>{capacityData.utilization}%</p>
        </div>
        <div className="border border-white/10 bg-[#0c0c0c] p-5">
          <p className="text-[10px] font-mono uppercase text-white/50 tracking-widest mb-1">Forecast</p>
          <p className="text-2xl font-mono text-purple-400 font-bold">{capacityData.forecast}%</p>
        </div>
      </div>

      <div className="border border-white/10 bg-[#0c0c0c] p-6">
        <h3 className="text-xs font-mono uppercase tracking-widest text-white/70 mb-4 flex items-center gap-2"><BarChart3 className="w-4 h-4 text-blue-400" /> Team Allocation</h3>
        <div className="space-y-6">
          {capacityData.byTeam.map((team: any) => (
            <div key={team.name}>
              <p className="text-[10px] font-mono uppercase text-white/50 mb-3">{team.name}</p>
              <div className="space-y-3">
                {team.members.map((m: any) => {
                  const pct = Math.min(100, Math.round((m.hours / m.capacity) * 100));
                  const barColor = pct > 80 ? 'bg-red-500' : pct > 50 ? 'bg-yellow-500' : 'bg-green-500';
                  return (
                    <div key={m.name} className="flex items-center gap-3">
                      <span className="text-[10px] font-mono text-white/70 w-32 truncate">{m.name}</span>
                      <div className="flex-1 h-4 bg-white/5 rounded-sm overflow-hidden relative">
                        <div className={`h-full ${barColor} rounded-sm transition-all`} style={{ width: `${pct}%` }} />
                      </div>
                      <span className="text-[10px] font-mono text-white/60 w-24 text-right">{m.hours}h / {m.capacity}h</span>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="border border-white/10 bg-[#0c0c0c] p-5">
          <p className="text-[10px] font-mono uppercase text-white/50 mb-2 flex items-center gap-2"><TrendingUp className="w-3 h-3 text-green-400" /> Under-utilized (&lt;50%)</p>
          <p className="text-lg font-mono text-green-400 font-bold">{profiles.filter((p: any) => {
            const hrs = tasks.filter((t: any) => t.assignee_id === p.id && t.status !== 'done').reduce((s: number, t: any) => s + (t.estimated_hours || 0), 0);
            return hrs > 0 && hrs < 80;
          }).length} members</p>
        </div>
        <div className="border border-white/10 bg-[#0c0c0c] p-5">
          <p className="text-[10px] font-mono uppercase text-white/50 mb-2 flex items-center gap-2"><Target className="w-3 h-3 text-yellow-400" /> At capacity (50-80%)</p>
          <p className="text-lg font-mono text-yellow-400 font-bold">{profiles.filter((p: any) => {
            const hrs = tasks.filter((t: any) => t.assignee_id === p.id && t.status !== 'done').reduce((s: number, t: any) => s + (t.estimated_hours || 0), 0);
            return hrs >= 80 && hrs <= 130;
          }).length} members</p>
        </div>
        <div className="border border-white/10 bg-[#0c0c0c] p-5">
          <p className="text-[10px] font-mono uppercase text-white/50 mb-2 flex items-center gap-2"><AlertTriangle className="w-3 h-3 text-red-400" /> Overloaded (&gt;80%)</p>
          <p className="text-lg font-mono text-red-400 font-bold">{capacityData.overloaded.length} members</p>
        </div>
      </div>
    </div>
  );
}
