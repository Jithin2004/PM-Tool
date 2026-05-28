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
    <div className="max-w-[1600px] mx-auto px-3 sm:px-6 py-6 sm:py-12 space-y-8 font-geist" style={{ color: 'var(--pm-on-surface)' }}>
      <div>
        <h2 className="text-2xl font-semibold tracking-tight mb-1" style={{ color: 'var(--pm-on-surface)' }}>Capacity Analytics</h2>
        <p className="text-sm tracking-tight" style={{ color: 'var(--pm-on-surface-variant)' }}>Allocation, utilization, and capacity forecasting</p>
      </div>

      {capacityData.overloaded.length > 0 && (
        <div className="flex items-center gap-3 px-4 py-3 rounded-xl border text-xs font-mono-pm uppercase tracking-widest"
             style={{ borderColor: 'rgba(239, 68, 68, 0.3)', background: 'rgba(239, 68, 68, 0.05)', color: 'var(--pm-error)' }}>
          <AlertTriangle className="w-4 h-4 shrink-0" />
          {capacityData.overloaded.length} team member{capacityData.overloaded.length > 1 ? 's' : ''} exceed{capacityData.overloaded.length === 1 ? 's' : ''} 100% capacity
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="glass-panel rounded-xl p-5">
          <p className="text-[10px] font-mono-pm uppercase tracking-widest mb-1" style={{ color: 'var(--pm-on-surface-variant)' }}>Total Capacity</p>
          <p className="text-2xl font-bold tracking-tight" style={{ color: '#3b82f6' }}>{capacityData.totalCapacity}h</p>
        </div>
        <div className="glass-panel rounded-xl p-5">
          <p className="text-[10px] font-mono-pm uppercase tracking-widest mb-1" style={{ color: 'var(--pm-on-surface-variant)' }}>Assigned Hours</p>
          <p className="text-2xl font-bold tracking-tight" style={{ color: 'var(--pm-tertiary)' }}>{capacityData.totalAssigned}h</p>
        </div>
        <div className="glass-panel rounded-xl p-5">
          <p className="text-[10px] font-mono-pm uppercase tracking-widest mb-1" style={{ color: 'var(--pm-on-surface-variant)' }}>Utilization</p>
          <p className="text-2xl font-mono-pm tracking-widest font-bold"
             style={{ color: capacityData.utilization > 80 ? 'var(--pm-error)' : capacityData.utilization > 50 ? 'var(--pm-warning)' : 'var(--pm-primary)' }}>
            {capacityData.utilization}%
          </p>
        </div>
        <div className="glass-panel rounded-xl p-5">
          <p className="text-[10px] font-mono-pm uppercase tracking-widest mb-1" style={{ color: 'var(--pm-on-surface-variant)' }}>Forecast</p>
          <p className="text-2xl font-bold tracking-tight" style={{ color: 'var(--pm-on-surface)' }}>{capacityData.forecast}%</p>
        </div>
      </div>

      <div className="glass-panel rounded-xl p-6">
        <h3 className="text-sm font-semibold tracking-tight mb-4 flex items-center gap-2" style={{ color: 'var(--pm-on-surface)' }}>
          <BarChart3 className="w-4 h-4" style={{ color: 'var(--pm-on-surface-variant)' }} /> Team Allocation
        </h3>
        <div className="space-y-6">
          {capacityData.byTeam.map((team: any) => (
            <div key={team.name}>
              <p className="text-[10px] font-mono-pm uppercase tracking-widest mb-3" style={{ color: 'var(--pm-on-surface-variant)' }}>{team.name}</p>
              <div className="space-y-3">
                {team.members.map((m: any) => {
                  const pct = Math.min(100, Math.round((m.hours / m.capacity) * 100));
                  const barColor = pct > 80 ? 'var(--pm-error)' : pct > 50 ? 'var(--pm-warning)' : 'var(--pm-primary)';
                  return (
                    <div key={m.name} className="flex items-center gap-3">
                      <span className="text-[11px] font-medium w-32 truncate" style={{ color: 'var(--pm-on-surface)' }}>{m.name}</span>
                      <div className="flex-1 h-2 rounded-full overflow-hidden relative" style={{ background: 'var(--pm-surface-high)' }}>
                        <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, backgroundColor: barColor }} />
                      </div>
                      <span className="text-[10px] font-mono-pm uppercase tracking-widest w-24 text-right" style={{ color: 'var(--pm-on-surface-variant)' }}>{m.hours}h / {m.capacity}h</span>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="glass-panel rounded-xl p-5">
          <p className="text-[10px] font-mono-pm uppercase tracking-widest mb-2 flex items-center gap-2" style={{ color: 'var(--pm-on-surface-variant)' }}>
            <TrendingUp className="w-3 h-3" style={{ color: 'var(--pm-primary)' }} /> Under-utilized (&lt;50%)
          </p>
          <p className="text-lg font-bold tracking-tight" style={{ color: 'var(--pm-primary)' }}>{profiles.filter((p: any) => {
            const hrs = tasks.filter((t: any) => t.assignee_id === p.id && t.status !== 'done').reduce((s: number, t: any) => s + (t.estimated_hours || 0), 0);
            return hrs > 0 && hrs < 80;
          }).length} members</p>
        </div>
        <div className="glass-panel rounded-xl p-5">
          <p className="text-[10px] font-mono-pm uppercase tracking-widest mb-2 flex items-center gap-2" style={{ color: 'var(--pm-on-surface-variant)' }}>
            <Target className="w-3 h-3" style={{ color: 'var(--pm-warning)' }} /> At capacity (50-80%)
          </p>
          <p className="text-lg font-bold tracking-tight" style={{ color: 'var(--pm-warning)' }}>{profiles.filter((p: any) => {
            const hrs = tasks.filter((t: any) => t.assignee_id === p.id && t.status !== 'done').reduce((s: number, t: any) => s + (t.estimated_hours || 0), 0);
            return hrs >= 80 && hrs <= 130;
          }).length} members</p>
        </div>
        <div className="glass-panel rounded-xl p-5">
          <p className="text-[10px] font-mono-pm uppercase tracking-widest mb-2 flex items-center gap-2" style={{ color: 'var(--pm-on-surface-variant)' }}>
            <AlertTriangle className="w-3 h-3" style={{ color: 'var(--pm-error)' }} /> Overloaded (&gt;80%)
          </p>
          <p className="text-lg font-bold tracking-tight" style={{ color: 'var(--pm-error)' }}>{capacityData.overloaded.length} members</p>
        </div>
      </div>
    </div>
  );
}
