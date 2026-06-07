import React, { useMemo } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useDashboard } from '../../context/DashboardContext';
import { useOperationalData } from '../../context/OperationalDataContext';
import { Users, FileText, ChevronRight, AlertCircle, Calendar, Briefcase, Activity } from 'lucide-react';

export function CapacityAnalytics() {
  const { profiles, teams, tasks, projects } = useDashboard();
  const { raw: { attendanceRows } } = useOperationalData();

  const analyticsData = useMemo(() => {
    let totalWorkloadHours = 0;
    let totalCapacityHours = 0;
    let overallocatedCount = 0;
    
    const activeTeams = teams.filter((t: any) => t.name !== 'SYSTEM_SETTINGS');
    
    const memberStats = activeTeams.flatMap((team: any) => {
      const devIds = team.data?.developer_ids || [];
      const pmId = team.data?.pm_id;
      const allIds = [pmId, ...devIds].filter(Boolean);
      
      return allIds.map((id: string) => {
        const p = profiles.find((prof: any) => prof.id === id);
        const memberTasks = tasks.filter((t: any) => t.assignee_id === id && t.status !== 'done');
        const workloadHours = memberTasks.reduce((s: number, t: any) => s + (t.estimated_hours || 8), 0);
        const capacityHours = 40;
        
        totalWorkloadHours += workloadHours;
        totalCapacityHours += capacityHours;
        
        if (workloadHours > capacityHours * 1.2) {
          overallocatedCount++;
        }
        
        return {
          id,
          name: p?.full_name || p?.email || 'Unknown Member',
          teamName: team.name,
          role: id === pmId ? 'Lead' : 'Engineer',
          workloadHours,
          capacityHours,
          utilization: Math.round((workloadHours / capacityHours) * 100)
        };
      });
    });

    const upcomingLeaves = attendanceRows
      ?.filter((r: any) => r.status === 'leave' && new Date(r.date) >= new Date())
      .sort((a: any, b: any) => new Date(a.date).getTime() - new Date(b.date).getTime())
      .slice(0, 5) || [];
      
    const todayStr = new Date().toISOString().split('T')[0];
    const todaysAttendance = attendanceRows?.filter((r: any) => r.date === todayStr) || [];
    const presentCount = todaysAttendance.filter((r: any) => r.status === 'present' || r.status === 'remote').length;
    const leaveCount = todaysAttendance.filter((r: any) => r.status === 'leave').length;

    return {
      memberStats: memberStats.sort((a, b) => b.utilization - a.utilization),
      teamDistribution: activeTeams,
      totalWorkloadHours,
      totalCapacityHours,
      utilizationAvg: totalCapacityHours ? Math.round((totalWorkloadHours / totalCapacityHours) * 100) : 0,
      overallocatedCount,
      upcomingLeaves,
      attendanceSummary: {
        present: presentCount,
        leave: leaveCount,
        total: profiles.length
      }
    };
  }, [profiles, tasks, teams, attendanceRows]);

  const renderAvatar = (name: string) => {
    const init = name.substring(0, 2).toUpperCase();
    return (
      <div className="w-9 h-9 rounded-full bg-indigo-500/10 border border-indigo-500/30 flex items-center justify-center text-xs font-mono font-bold text-indigo-300 shadow-md">
        {init}
      </div>
    );
  };

  return (
    <div className="space-y-6 pb-16 font-sans premium-fade-in-up">
      {/* Header */}
      <div className="flex items-end justify-between px-1 pt-2 mb-8">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-white">
            Team Workload & Capacity
          </h1>
          <p className="text-xs text-[var(--text-secondary)] mt-1">
            Real-time insights into resource utilization, allocation limits, and team availability.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold uppercase tracking-wider border border-[var(--border-soft)] bg-[var(--surface-glass)] text-[var(--text-secondary)] hover:bg-[var(--surface-hover)] hover:text-white transition-all active:scale-[0.98]">
            <FileText className="w-4 h-4 text-indigo-400" /> Export Report
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="premium-panel premium-hover-lift rounded-2xl p-5 border border-[var(--border-soft)]">
          <div className="flex items-center justify-between mb-3">
            <div className="text-[10px] font-mono uppercase tracking-wider text-[var(--text-secondary)]">Overall Utilization</div>
            <div className="w-8 h-8 rounded-full bg-blue-500/10 flex items-center justify-center">
              <Activity className="w-4 h-4 text-blue-400" />
            </div>
          </div>
          <div className="text-3xl font-bold text-white font-mono">
            {analyticsData.utilizationAvg}%
          </div>
          <div className="text-[10px] font-mono text-[var(--text-secondary)] mt-2">
            {analyticsData.totalWorkloadHours}h / {analyticsData.totalCapacityHours}h allocated
          </div>
        </div>

        <div className="premium-panel premium-hover-lift rounded-2xl p-5 border border-[var(--border-soft)]">
          <div className="flex items-center justify-between mb-3">
            <div className="text-[10px] font-mono uppercase tracking-wider text-[var(--text-secondary)]">Overallocated</div>
            <div className="w-8 h-8 rounded-full bg-rose-500/10 flex items-center justify-center">
              <AlertCircle className="w-4 h-4 text-rose-400" />
            </div>
          </div>
          <div className="text-3xl font-bold text-white font-mono">
            {analyticsData.overallocatedCount}
          </div>
          <div className="text-[10px] font-mono text-[var(--text-secondary)] mt-2">
            Exceeding 120% capacity threshold
          </div>
        </div>

        <div className="premium-panel premium-hover-lift rounded-2xl p-5 border border-[var(--border-soft)]">
          <div className="flex items-center justify-between mb-3">
            <div className="text-[10px] font-mono uppercase tracking-wider text-[var(--text-secondary)]">Active Teams</div>
            <div className="w-8 h-8 rounded-full bg-indigo-500/10 flex items-center justify-center">
              <Users className="w-4 h-4 text-indigo-400" />
            </div>
          </div>
          <div className="text-3xl font-bold text-white font-mono">
            {analyticsData.teamDistribution.length}
          </div>
          <div className="text-[10px] font-mono text-[var(--text-secondary)] mt-2">
            Spanning {analyticsData.memberStats.length} active members
          </div>
        </div>

        <div className="premium-panel premium-hover-lift rounded-2xl p-5 border border-[var(--border-soft)]">
          <div className="flex items-center justify-between mb-3">
            <div className="text-[10px] font-mono uppercase tracking-wider text-[var(--text-secondary)]">Today's Attendance</div>
            <div className="w-8 h-8 rounded-full bg-emerald-500/10 flex items-center justify-center">
              <Briefcase className="w-4 h-4 text-emerald-400" />
            </div>
          </div>
          <div className="text-3xl font-bold text-white font-mono">
            {analyticsData.attendanceSummary.present} <span className="text-lg text-[var(--text-secondary)] font-normal">/ {analyticsData.attendanceSummary.total}</span>
          </div>
          <div className="text-[10px] font-mono text-[var(--text-secondary)] mt-2">
            {analyticsData.attendanceSummary.leave} members on leave today
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6 pt-4">
        {/* Main Utilization Cards Grid (Removed spreadsheet feel) */}
        <div className="xl:col-span-2 space-y-6">
          <div className="premium-panel rounded-2xl border border-[var(--border-soft)] p-6">
            <h2 className="text-lg font-bold tracking-tight text-white mb-6">Member Resource Distribution</h2>
            
            {analyticsData.memberStats.length === 0 ? (
              <div className="p-8 text-center text-[var(--text-secondary)] italic">No active members found.</div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {analyticsData.memberStats.map((member: any) => {
                  const isOverallocated = member.utilization > 100;
                  return (
                    <div 
                      key={member.id} 
                      className={`premium-panel premium-hover-lift rounded-2xl p-5 border transition-all duration-200 flex flex-col justify-between ${
                        isOverallocated 
                          ? 'border-rose-500/20 shadow-[0_0_15px_rgba(239,68,68,0.08)] bg-rose-500/[0.01]' 
                          : 'border-[var(--border-soft)]'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex items-center gap-3">
                          {/* Avatar Ring */}
                          <div className="relative">
                            {renderAvatar(member.name)}
                            <span className={`absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-[#050712] ${
                              isOverallocated ? 'bg-rose-500 animate-pulse' : 'bg-emerald-500'
                            }`} />
                          </div>
                          <div>
                            <h4 className="font-semibold text-sm text-white">{member.name}</h4>
                            <span className="text-[10px] font-mono text-[var(--text-secondary)] uppercase tracking-wider">{member.teamName}</span>
                          </div>
                        </div>

                        {/* Circular Progress Ring */}
                        <div className="relative w-12 h-12 shrink-0">
                          <svg className="w-full h-full transform -rotate-90" viewBox="0 0 36 36">
                            <circle
                              className="text-[var(--text-secondary)]"
                              strokeWidth="3"
                              stroke="currentColor"
                              fill="transparent"
                              r="16"
                              cx="18"
                              cy="18"
                            />
                            <circle
                              className="transition-all duration-300"
                              strokeWidth="3.5"
                              strokeDasharray="100, 100"
                              strokeDashoffset={100 - Math.min(100, member.utilization)}
                              strokeLinecap="round"
                              stroke={isOverallocated ? '#f87171' : (member.utilization > 80 ? '#fbbf24' : '#34d399')}
                              fill="transparent"
                              r="16"
                              cx="18"
                              cy="18"
                            />
                          </svg>
                          <div className="absolute inset-0 flex items-center justify-center text-[10px] font-mono font-bold text-[var(--text-secondary)]">
                            {member.utilization}%
                          </div>
                        </div>
                      </div>

                      <div className="mt-5 pt-3 border-t border-[var(--border-soft)] flex items-center justify-between text-[11px] font-mono text-[var(--text-secondary)]">
                        <span className={`px-2 py-0.5 rounded text-[9px] uppercase font-bold tracking-widest ${
                          member.role === 'Lead' ? 'bg-indigo-500/10 text-indigo-400 border border-indigo-500/15' : 'bg-[var(--surface-glass)] text-[var(--text-secondary)] border border-[var(--border-soft)]'
                        }`}>
                          {member.role}
                        </span>
                        <div>
                          <span className="text-[var(--text-secondary)] font-bold">{member.workloadHours}h</span>
                          <span> / {member.capacityHours}h capacity</span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Sidebar Widgets */}
        <div className="space-y-6">
          <div className="premium-panel rounded-2xl border border-[var(--border-soft)] overflow-hidden">
            <div className="p-5 border-b border-[var(--border-soft)] bg-[var(--surface-glass)]">
              <h2 className="text-base font-bold text-white">Upcoming Leaves</h2>
            </div>
            <div className="p-5">
              {analyticsData.upcomingLeaves.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-6 text-[var(--text-secondary)]">
                  <Calendar className="w-8 h-8 mb-2 opacity-50 text-indigo-400" />
                  <p className="text-xs">No upcoming leaves scheduled.</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {analyticsData.upcomingLeaves.map((leave: any, idx: number) => {
                    const p = profiles.find((prof: any) => prof.id === leave.profile_id);
                    return (
                      <div key={idx} className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-[var(--surface-glass)] flex flex-col items-center justify-center border border-[var(--border-soft)] shrink-0">
                          <span className="text-[9px] uppercase font-bold text-indigo-400 font-mono">
                            {new Date(leave.date).toLocaleString('default', { month: 'short' })}
                          </span>
                          <span className="text-xs font-bold text-white font-mono mt-0.5">
                            {new Date(leave.date).getDate()}
                          </span>
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-white truncate">{p?.full_name || p?.email || 'Unknown'}</p>
                          <p className="text-[10px] text-[var(--text-secondary)] font-mono uppercase tracking-wider">Scheduled Leave</p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
          
          <div className="premium-panel rounded-2xl border border-[var(--border-soft)] p-5">
            <h3 className="text-xs font-mono uppercase tracking-widest text-[var(--text-secondary)] mb-3">Resource Allocation Note</h3>
            <p className="text-xs text-[var(--text-secondary)] leading-relaxed">
              Workload is calculated by aggregating active tasks assigned to each member across all projects. Members marked as overallocated may require load balancing to prevent burnout.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
