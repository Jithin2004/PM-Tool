import React, { useState, useMemo, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { List } from 'react-window';
import { Users, Shield, Terminal, X, AlertTriangle, Activity, Lock, Layers, Search, ChevronRight, BrainCircuit, Plus, Clock } from 'lucide-react';
import { Team, User, Profile, Project } from '../../types';
import { calculateExpectedTime, getLocalDateString } from '../../utils/timeUtils';

export function TeamRosterModal({
  teams,
  profiles,
  projects,
  workingHoursPerDay,
  attendanceRecords,
  systemData,
  onClose
}: {
  teams: Team[],
  profiles: Profile[],
  projects: Project[],
  workingHoursPerDay: number,
  attendanceRecords: Record<string, Record<string, { status: string, leaveType?: string, isPaidHalfDay?: boolean }>>,
  systemData: any,
  onClose: () => void
}) {
  // systemData is passed directly from parent (contains userCustomRoles, etc.)

  const [activeSquadId, setActiveSquadId] = useState<string | null>(teams[0]?.id || null);
  const [searchQuery, setSearchQuery] = useState("");
  const [capacityFilter, setCapacityFilter] = useState<'all' | 'overloaded' | 'optimal' | 'underutilized'>('all');
  const [selectedPersonnelId, setSelectedPersonnelId] = useState<string | null>(null);
  const [rosterTab, setRosterTab] = useState<'teams' | 'analytics'>('teams');

  const containerRef = useRef<HTMLDivElement>(null);
  const [containerHeight, setContainerHeight] = useState(500);

  useEffect(() => {
    if (!containerRef.current) return;
    const resizeObserver = new ResizeObserver((entries) => {
      for (let entry of entries) {
        setContainerHeight(entry.contentRect.height || 500);
      }
    });
    resizeObserver.observe(containerRef.current);
    return () => resizeObserver.disconnect();
  }, []);

  const TeamRow = ({ index, style }: { index: number; style: React.CSSProperties }) => {
    const team = filteredSquads[index];
    if (!team) return null;
    const metrics = getCachedMetrics(team.id);
    const isActive = team.id === activeSquadId;
    const pm = profilesMap.get(metrics.pmId);
    const devsCount = metrics.engineerCount;

    return (
      <div
        style={style}
        onClick={() => {
          setActiveSquadId(team.id);
          setRosterTab('analytics');
        }}
        className={`p-4 cursor-pointer transition-all hover:bg-surface-3 flex flex-col gap-2 border-b border-border-subtle ${isActive ? 'bg-white/5 border-l-2 border-l-accent-primary' : ''}`}
      >
        <div className="flex justify-between items-start gap-2">
          <h4 className="text-sm font-semibold tracking-tight uppercase truncate">{team.name}</h4>
          <span className={`text-[9px] font-mono px-2 py-0.5 border ${metrics.loadPercentage > 100 ? 'bg-signal-critical-bg text-signal-critical border-red-500/20' : metrics.loadPercentage >= 50 ? 'bg-surface-3 text-signal-info border-border' : 'bg-signal-safe-bg text-signal-safe border-border'}`}>
            {metrics.loadPercentage}% LOAD
          </span>
        </div>
        <div className="flex justify-between items-center text-[10px] font-mono text-text-tertiary">
          <span>LEAD: <span className="text-text-secondary">{pm?.full_name?.split(' ')[0] || pm?.email?.split('@')[0] || 'N/A'}</span></span>
          <span>STAFF: <span className="text-text-secondary">{devsCount}</span></span>
        </div>

        {/* Progress indicator */}
        <div className="w-full bg-white/5 h-1">
          <div
            className={`h-full ${metrics.loadPercentage > 100 ? 'bg-signal-critical' : 'bg-accent-primary'}`}
            style={{ width: `${Math.min(100, metrics.loadPercentage)}%` }}
          />
        </div>
      </div>
    );
  };

  const projectsByTeam = useMemo(() => {
    const map = new Map<string, Project[]>();
    for (const p of projects) {
      if (p.status === 'deployed') continue;
      if (!map.has(p.team_id)) map.set(p.team_id, []);
      map.get(p.team_id)!.push(p);
    }
    return map;
  }, [projects]);

  const teamsMap = useMemo(() => {
    const map = new Map<string, Team>();
    for (const t of teams) map.set(t.id, t);
    return map;
  }, [teams]);

  const profilesMap = useMemo(() => {
    const map = new Map<string, Profile>();
    for (const p of profiles) map.set(p.id, p);
    return map;
  }, [profiles]);

  const teamMemberProfileIds = useMemo(() => {
    const set = new Set<string>();
    for (const t of teams) {
      const data = t.data as Record<string, unknown> | undefined;
      if (data?.pm_id) set.add(data.pm_id as string);
      if (data?.developer_ids) for (const id of (data.developer_ids as string[])) set.add(id);
    }
    return set;
  }, [teams]);

  const getSquadLoadMetrics = (team: Team) => {
    const parsedData = team.data as Record<string, unknown> | undefined;
    const devIds = (parsedData?.developer_ids as string[]) || [];
    const engineerCount = Math.max(1, devIds.length);
    const pmId = parsedData?.pm_id as string | undefined;

    const totalCapacityHours = 20 * (workingHoursPerDay * 0.8) * engineerCount;

    const teamProjects = projectsByTeam.get(team.id) || [];
    let totalExpectedHours = 0;
    let totalWorstHours = 0;
    let efficiencySum = 0;
    for (const p of teamProjects) {
      totalExpectedHours += calculateExpectedTime(p.pert_best, p.pert_likely, p.pert_worst);
      totalWorstHours += p.pert_worst;
      efficiencySum += p.efficiency;
    }

    const loadPercentage = Math.round((totalExpectedHours / totalCapacityHours) * 100);
    const averageEfficiency = teamProjects.length > 0 ? efficiencySum / teamProjects.length : 1.0;
    const potentialDriftHours = Math.max(0, totalWorstHours - totalExpectedHours);

    return {
      engineerCount,
      pmId,
      totalCapacityHours,
      totalExpectedHours,
      loadPercentage,
      averageEfficiency,
      potentialDriftHours,
      activeProjects: teamProjects
    };
  };

  const squadMetricsCache = useMemo(() => {
    const cache = new Map<string, ReturnType<typeof getSquadLoadMetrics>>();
    for (const team of teams) {
      cache.set(team.id, getSquadLoadMetrics(team));
    }
    return cache;
  }, [teams, projectsByTeam, workingHoursPerDay]);

  const getCachedMetrics = (teamId: string) => {
    const cached = squadMetricsCache.get(teamId);
    if (cached) return cached;
    const team = teamsMap.get(teamId);
    if (!team) return getSquadLoadMetrics({ id: teamId, data: {} } as Team);
    return getSquadLoadMetrics(team);
  };

  const filteredSquads = useMemo(() => {
    const lowerQuery = searchQuery.toLowerCase();
    return teams.filter(team => {
      const metrics = getCachedMetrics(team.id);

      let matchesSearch = team.name.toLowerCase().includes(lowerQuery);
      if (!matchesSearch) {
        const data = team.data as Record<string, unknown> | undefined;
        const ids = [data?.pm_id, ...((data?.developer_ids as string[]) || [])].filter(Boolean) as string[];
        for (const id of ids) {
          const p = profilesMap.get(id);
          if (p && (p.full_name || p.email || '').toLowerCase().includes(lowerQuery)) {
            matchesSearch = true;
            break;
          }
        }
      }
      if (!matchesSearch) return false;

      if (capacityFilter === 'overloaded') return metrics.loadPercentage > 100;
      if (capacityFilter === 'optimal') return metrics.loadPercentage >= 50 && metrics.loadPercentage <= 100;
      if (capacityFilter === 'underutilized') return metrics.loadPercentage < 50;
      return true;
    });
  }, [teams, searchQuery, capacityFilter, squadMetricsCache, profilesMap]);

  const aggregateMetrics = useMemo(() => {
    if (teams.length === 0) return { totalStaff: profiles.length, avgLoad: 0, overloadedCount: 0 };

    let totalLoadSum = 0;
    let overloadedCount = 0;
    for (const team of teams) {
      const metrics = getCachedMetrics(team.id);
      totalLoadSum += metrics.loadPercentage;
      if (metrics.loadPercentage > 100) overloadedCount++;
    }

    return {
      totalStaff: profiles.length,
      avgLoad: Math.round(totalLoadSum / teams.length),
      overloadedCount
    };
  }, [teams, squadMetricsCache, profiles.length]);

  const selectedPersonnel = useMemo(() => {
    if (!selectedPersonnelId) return null;
    const profile = profilesMap.get(selectedPersonnelId);
    if (!profile) return null;

    let presentDays = 0;
    let halfDays = 0;
    let absentDays = 0;

    const joiningDateStr = profile.created_at ? getLocalDateString(new Date(profile.created_at)) : '';

    for (const dateStr of Object.keys(attendanceRecords)) {
      if (joiningDateStr && dateStr < joiningDateStr) continue;

      const dayData = attendanceRecords[dateStr]?.[profile.id];
      if (dayData) {
        if (dayData.status === 'present') presentDays++;
        else if (dayData.status === 'half_day') halfDays++;
        else if (dayData.status === 'absent') absentDays++;
      } else {
        presentDays++;
      }
    }

    const userProjects: Project[] = [];
    for (const p of projects) {
      if (p.status === 'deployed') continue;
      const team = teamsMap.get(p.team_id);
      if (!team) continue;
      const teamData = team.data as Record<string, unknown> | undefined;
      if ((teamData?.pm_id as string) === profile.id || (teamData?.developer_ids as string[] | undefined)?.includes(profile.id)) {
        userProjects.push(p);
      }
    }

    return {
      profile,
      presentDays,
      halfDays,
      absentDays,
      activeProjects: userProjects
    };
  }, [selectedPersonnelId, profilesMap, attendanceRecords, projects, teamsMap]);

  const selectedSquad = teamsMap.get(activeSquadId) || null;
  const activeMetrics = selectedSquad ? getCachedMetrics(selectedSquad.id) : null;
  const activeSquadPM = selectedSquad && activeMetrics ? profilesMap.get(activeMetrics.pmId) : null;
  const activeSquadEngineers = selectedSquad ? ((selectedSquad.data as Record<string, unknown>)?.developer_ids as string[] || []).map((id: string) => profilesMap.get(id)).filter(Boolean) : [];

  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center p-6">
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose} className="absolute inset-0 bg-bg backdrop-blur-md" />
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 20 }} className="relative bg-surface border border-border w-full max-w-6xl overflow-hidden shadow-2xl flex flex-col h-[90vh]">

        {/* Roster Header */}
        <div className="p-6 border-b border-border bg-bg flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <Users className="w-5 h-5 text-signal-info" />
              <h3 className="text-xl font-medium tracking-tight uppercase">Teams</h3>
            </div>
            <p className="text-xs font-mono text-text-tertiary">Comprehensive workload utilization, analytics and team allocation analysis.</p>
          </div>
          <div className="flex flex-wrap items-center gap-4">
            <div className="bg-bg border border-border px-4 py-2 text-center shrink-0">
              <p className="text-[9px] font-mono text-text-tertiary uppercase tracking-wide mb-0.5">Total Teams</p>
              <p className="text-sm font-bold font-mono">{teams.length}</p>
            </div>
            <div className="bg-bg border border-border px-4 py-2 text-center shrink-0">
              <p className="text-[9px] font-mono text-text-tertiary uppercase tracking-wide mb-0.5">Average Load</p>
              <p className={`text-sm font-bold font-mono ${aggregateMetrics.avgLoad > 100 ? 'text-signal-critical' : 'text-signal-info'}`}>{aggregateMetrics.avgLoad}%</p>
            </div>
            <div className="bg-bg border border-border px-4 py-2 text-center shrink-0">
              <p className="text-[9px] font-mono text-text-tertiary uppercase tracking-wide mb-0.5">Overloaded</p>
              <p className={`text-sm font-bold font-mono ${aggregateMetrics.overloadedCount > 0 ? 'text-signal-critical' : 'text-signal-safe'}`}>{aggregateMetrics.overloadedCount} Units</p>
            </div>
            <button onClick={onClose} className="p-2 border border-border hover:bg-white/5 transition-colors shrink-0">
              <Plus className="w-5 h-5 rotate-45 text-text-secondary" />
            </button>
          </div>
        </div>

        {/* Search & Filter Bar */}
        <div className="p-4 border-b border-border bg-surface-2 flex flex-col md:flex-row gap-4 items-center justify-between">
          <div className="relative w-full md:w-80">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-tertiary" />
            <input
              type="text"
              placeholder="Query name, email or team..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-bg border border-border h-10 pl-10 pr-4 text-xs font-mono focus:border-white/30 outline-none transition-all placeholder:text-text-quaternary text-text-primary animate-none"
            />
          </div>
          <div className="flex gap-2 w-full md:w-auto overflow-x-auto">
            {(['all', 'overloaded', 'optimal', 'underutilized'] as const).map((filter) => (
              <button
                key={filter}
                onClick={() => setCapacityFilter(filter)}
                className={`px-3 py-1.5 text-[9px] font-mono uppercase tracking-wide transition-all border whitespace-nowrap ${capacityFilter === filter ? 'bg-white text-black font-semibold border-white' : 'border-border text-text-tertiary hover:text-text-primary hover:bg-white/5'}`}
              >
                {filter}
              </button>
            ))}
          </div>
        </div>

        {/* Mobile Tab Controls */}
        <div className="flex md:hidden bg-white/5 border-b border-border p-1 shrink-0">
          <button
            onClick={() => setRosterTab('teams')}
            className={`flex-1 text-center py-2 text-[10px] font-mono uppercase tracking-wide transition-all ${rosterTab === 'teams' ? 'bg-white text-black font-semibold' : 'text-text-tertiary'}`}
          >
            Team Directory
          </button>
          <button
            onClick={() => setRosterTab('analytics')}
            className={`flex-1 text-center py-2 text-[10px] font-mono uppercase tracking-wide transition-all ${rosterTab === 'analytics' ? 'bg-white text-black font-semibold' : 'text-text-tertiary'}`}
          >
            Deep Analytics
          </button>
        </div>

        {/* Dashboard Panels */}
        <div className="flex-1 flex flex-col md:flex-row overflow-hidden relative">

          {/* Left Panel: Team Directory */}
          <div 
            ref={containerRef}
            className={`w-full md:w-80 border-r border-border overflow-hidden bg-bg ${rosterTab === 'teams' ? 'block' : 'hidden md:block'}`}
          >
            {filteredSquads.length === 0 ? (
              <div className="p-8 text-center text-xs font-mono text-text-quaternary italic">
                No matching teams found.
              </div>
            ) : filteredSquads.length > 20 ? (
              <List
                rowCount={filteredSquads.length}
                rowHeight={82}
                rowComponent={TeamRow as any}
                rowProps={{}}
                style={{ height: containerHeight, width: '100%' }}
                className="scrollbar-thin divide-y divide-white/5"
              />
            ) : (
              <div className="w-full h-full overflow-y-auto divide-y divide-white/5 scrollbar-thin">
                {filteredSquads.map(team => {
                  const metrics = getCachedMetrics(team.id);
                  const isActive = team.id === activeSquadId;
                  const pm = profilesMap.get(metrics.pmId);
                  const devsCount = metrics.engineerCount;

                  return (
                    <div
                      key={team.id}
                      onClick={() => {
                        setActiveSquadId(team.id);
                        setRosterTab('analytics');
                      }}
                      className={`p-4 cursor-pointer transition-all hover:bg-surface-3 flex flex-col gap-2 ${isActive ? 'bg-white/5 border-l-2 border-l-accent-primary' : ''}`}
                    >
                      <div className="flex justify-between items-start gap-2">
                        <h4 className="text-sm font-semibold tracking-tight uppercase truncate">{team.name}</h4>
                        <span className={`text-[9px] font-mono px-2 py-0.5 border ${metrics.loadPercentage > 100 ? 'bg-signal-critical-bg text-signal-critical border-red-500/20' : metrics.loadPercentage >= 50 ? 'bg-surface-3 text-signal-info border-border' : 'bg-signal-safe-bg text-signal-safe border-border'}`}>
                          {metrics.loadPercentage}% LOAD
                        </span>
                      </div>
                      <div className="flex justify-between items-center text-[10px] font-mono text-text-tertiary">
                        <span>LEAD: <span className="text-text-secondary">{pm?.full_name?.split(' ')[0] || pm?.email?.split('@')[0] || 'N/A'}</span></span>
                        <span>STAFF: <span className="text-text-secondary">{devsCount}</span></span>
                      </div>

                      {/* Progress indicator */}
                      <div className="w-full bg-white/5 h-1">
                        <div
                          className={`h-full ${metrics.loadPercentage > 100 ? 'bg-signal-critical' : 'bg-accent-primary'}`}
                          style={{ width: `${Math.min(100, metrics.loadPercentage)}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Right Panel: Analytical Detail deep dive */}
          <div className={`flex-1 overflow-y-auto p-5 sm:p-8 bg-surface ${rosterTab === 'analytics' ? 'block' : 'hidden md:block'}`}>
            {selectedSquad && activeMetrics ? (
              <div className="space-y-8">
                {/* Mobile Back Button */}
                <div className="block md:hidden mb-2">
                  <button
                    onClick={() => setRosterTab('teams')}
                    className="flex items-center gap-1.5 text-[10px] font-mono uppercase tracking-wide text-signal-info hover:text-accent-primary transition-colors"
                  >
                    â† Back to Team List
                  </button>
                </div>

                {/* Team header banner */}
                <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-6 pb-6 border-b border-border-subtle">
                  <div>
                    <h3 className="text-2xl font-bold uppercase tracking-tight mb-2">{selectedSquad.name}</h3>
                    <div className="flex flex-wrap items-center gap-4 text-xs font-mono text-text-tertiary">
                      <div className="flex items-center gap-2">
                        <span className="w-1.5 h-1.5 rounded-full bg-accent-primary"></span>
                        <span>Lead PM: <strong className="text-signal-info">{activeSquadPM?.full_name || activeSquadPM?.email || 'Unallocated'}</strong></span>
                      </div>
                      <div>â€¢</div>
                      <div>Engineers Assigned: <strong>{activeSquadEngineers.length}</strong></div>
                    </div>
                  </div>
                </div>

                {/* Analytical analytics metrics */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">

                  {/* Gauge 1: Load */}
                  <div className="border border-border bg-white/5 p-6 flex flex-col justify-between h-40 relative overflow-hidden">
                    <div className="flex justify-between items-start">
                      <p className="text-[10px] font-mono text-text-tertiary uppercase tracking-wide">Workload Status</p>
                      <Activity className={`w-4 h-4 ${activeMetrics.loadPercentage > 100 ? 'text-signal-critical transition-opacity duration-300' : 'text-signal-info'}`} />
                    </div>
                    <div>
                      <p className={`text-3xl font-mono font-bold ${activeMetrics.loadPercentage > 100 ? 'text-signal-critical' : 'text-text-primary'}`}>{activeMetrics.loadPercentage}%</p>
                      <p className="text-[10px] font-mono text-text-tertiary mt-1 uppercase">Capacity Utilization</p>
                    </div>
                    <div className="w-full bg-white/5 h-1.5">
                      <div className={`h-full ${activeMetrics.loadPercentage > 100 ? 'bg-signal-critical' : 'bg-accent-primary'}`} style={{ width: `${Math.min(100, activeMetrics.loadPercentage)}%` }} />
                    </div>
                  </div>

                  {/* Gauge 2: Capacity Hours details */}
                  <div className="border border-border bg-white/5 p-6 flex flex-col justify-between h-40">
                    <div className="flex justify-between items-start">
                      <p className="text-[10px] font-mono text-text-tertiary uppercase tracking-wide">Allocated Workload</p>
                      <Clock className="w-4 h-4 text-text-tertiary" />
                    </div>
                    <div>
                      <p className="text-3xl font-sans tracking-tight font-bold text-text-primary">{Math.round(activeMetrics.totalExpectedHours)}h</p>
                      <p className="text-[10px] font-mono text-text-tertiary mt-1 uppercase">Allocated vs {Math.round(activeMetrics.totalCapacityHours)}h Capacity</p>
                    </div>
                    <p className="text-[9px] font-mono text-text-quaternary italic">Calculated across 20 monthly working days.</p>
                  </div>

                  {/* Gauge 3: Potential Drift */}
                  <div className="border border-border bg-white/5 p-6 flex flex-col justify-between h-40">
                    <div className="flex justify-between items-start">
                      <p className="text-[10px] font-mono text-text-tertiary uppercase tracking-wide">Potential drift risk</p>
                      <AlertTriangle className="w-4 h-4 text-signal-warning" />
                    </div>
                    <div>
                      <p className="text-3xl font-sans tracking-tight font-bold text-signal-warning">+{Math.round(activeMetrics.potentialDriftHours)}h</p>
                      <p className="text-[10px] font-mono text-text-tertiary mt-1 uppercase">Worst-case drift delta</p>
                    </div>
                    <div className="flex justify-between items-center text-[9px] font-mono text-text-tertiary">
                      <span>AVG EFFICIENCY</span>
                      <span>{(activeMetrics.averageEfficiency * 100).toFixed(0)}%</span>
                    </div>
                  </div>
                </div>

                {/* Overloaded Banner if load exceeds 100% */}
                {activeMetrics.loadPercentage > 100 && (
                  <div className="bg-signal-critical-bg border border-red-500/20 p-4 flex items-start gap-3">
                    <AlertTriangle className="w-5 h-5 text-signal-critical shrink-0 mt-0.5 animate-bounce" />
                    <div>
                      <h5 className="text-xs font-sans tracking-tight text-signal-critical uppercase tracking-wide font-bold mb-1">Team Analytics Alert: Extreme Overload Detected</h5>
                      <p className="text-[10px] font-mono text-signal-critical/80 leading-relaxed">This team has surpassed its monthly engineering bandwidth. Highly advise reallocating some projects to underloaded teams to prevent burn-out and delivery delay.</p>
                    </div>
                  </div>
                )}

                {/* Active Workflows Section */}
                <div className="space-y-4">
                  <div className="flex justify-between items-center border-b border-border-subtle pb-2">
                    <h4 className="text-xs font-sans tracking-tight uppercase tracking-wide text-text-secondary font-bold">Active Team Projects ({activeMetrics.activeProjects.length})</h4>
                    <span className="text-[9px] font-mono text-text-quaternary">DRIFT TRACKING ACTIVATED</span>
                  </div>

                  {activeMetrics.activeProjects.length === 0 ? (
                    <p className="text-xs font-mono text-text-tertiary italic py-4">No active workflow parameters are assigned to this team.</p>
                  ) : (
                    <div className="grid grid-cols-1 gap-4">
                      {activeMetrics.activeProjects.map(project => {
                        const expected = calculateExpectedTime(project.pert_best, project.pert_likely, project.pert_worst);
                        const progress = project.status === 'planning' ? 15 : project.status === 'in-progress' ? 50 : project.status === 'review' ? 85 : 100;
                        return (
                          <div key={project.id} className="border border-border-subtle bg-surface-2 p-4 flex flex-col md:flex-row justify-between items-start md:items-center gap-6 hover:border-border transition-all">
                            <div className="space-y-1">
                              <h5 className="text-sm font-semibold tracking-tight text-text-secondary">{project.name}</h5>
                              <div className="flex items-center gap-3 text-[10px] font-mono text-text-tertiary uppercase">
                                <span className={`text-[9px] px-1.5 py-0.5 border ${project.priority === 'high' ? 'text-signal-critical border-red-500/20 bg-signal-critical-bg' : project.priority === 'medium' ? 'text-signal-info border-border bg-surface-3' : 'text-signal-safe border-border bg-signal-safe-bg'}`}>
                                  {project.priority}
                                </span>
                                <span>STATUS: <span className="text-signal-info">{project.status.replace('-', '_')}</span></span>
                              </div>
                            </div>

                            {/* Per-engineer allocation */}
                            <div className="text-right shrink-0">
                              <p className="text-xs font-mono text-text-secondary font-bold">{expected.toFixed(1)} hrs</p>
                              <p className="text-[9px] font-mono text-text-tertiary uppercase">PERT projection</p>
                              <p className="text-[8px] font-mono text-text-secondary mt-0.5">{(expected / activeMetrics.engineerCount).toFixed(1)}h/engineer projected</p>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>

                {/* Assigned Personnel grid */}
                <div className="space-y-4">
                  <div className="border-b border-border-subtle pb-2">
                    <h4 className="text-xs font-sans tracking-tight uppercase tracking-wide text-text-secondary font-bold">Assigned engineering personnel</h4>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

                    {/* PM Roster Card */}
                    {activeSquadPM && (
                      <div
                        onClick={() => setSelectedPersonnelId(activeSquadPM.id)}
                        className="border border-border bg-surface-3 p-4 flex items-center justify-between hover:bg-surface-3 cursor-pointer transition-all hover:scale-[1.01] group"
                      >
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 border border-border bg-bg flex items-center justify-center overflow-hidden shrink-0">
                            {activeSquadPM.avatar_url ? (
                              <img src={activeSquadPM.avatar_url} alt={activeSquadPM.full_name} className="w-full h-full object-cover" />
                            ) : (
                              <Users className="w-5 h-5 text-signal-info" />
                            )}
                          </div>
                          <div>
                            <h5 className="text-xs font-semibold text-text-secondary truncate max-w-[140px]">{activeSquadPM.full_name || 'Anonymous User'}</h5>
                            <p className="text-[9px] font-mono text-text-tertiary uppercase truncate max-w-[140px]">{activeSquadPM.email}</p>
                            <span className="inline-block mt-1 text-[8px] font-mono bg-accent-primary text-black px-1.5 uppercase font-bold tracking-wide">SQUAD_LEAD</span>
                          </div>
                        </div>
                        <ChevronRight className="w-4 h-4 text-text-quaternary group-hover:text-text-primary transition-colors" />
                      </div>
                    )}

                    {/* Engineers Cards */}
                    {activeSquadEngineers.map((engineer: any) => (
                      <div
                        key={engineer.id}
                        onClick={() => setSelectedPersonnelId(engineer.id)}
                        className="border border-border-subtle bg-surface-2 p-4 flex items-center justify-between hover:bg-white/5 cursor-pointer transition-all hover:scale-[1.01] group"
                      >
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 border border-border bg-bg flex items-center justify-center overflow-hidden shrink-0">
                            {engineer.avatar_url ? (
                              <img src={engineer.avatar_url} alt={engineer.full_name} className="w-full h-full object-cover" />
                            ) : (
                              <Users className="w-5 h-5 text-text-quaternary" />
                            )}
                          </div>
                          <div>
                            <h5 className="text-xs font-semibold text-text-secondary truncate max-w-[140px]">{engineer.full_name || 'Anonymous User'}</h5>
                            <p className="text-[9px] font-mono text-text-tertiary uppercase truncate max-w-[140px]">{engineer.email}</p>
                            <span className="inline-block mt-1 text-[8px] font-mono bg-white/10 text-text-secondary border border-border px-1.5 uppercase tracking-wide">{(systemData.userCustomRoles && systemData.userCustomRoles[engineer.id]) || 'Viewer'}</span>
                          </div>
                        </div>
                        <ChevronRight className="w-4 h-4 text-text-quaternary group-hover:text-text-primary transition-colors" />
                      </div>
                    ))}

                    {activeSquadEngineers.length === 0 && !activeSquadPM && (
                      <p className="text-xs font-mono text-text-quaternary italic md:col-span-2">No active resources assigned to this team.</p>
                    )}
                  </div>
                </div>

              </div>
            ) : (
              <div className="h-full flex flex-col items-center justify-center text-center opacity-50">
                <BrainCircuit className="w-12 h-12 text-text-secondary mb-4" />
                <h4 className="text-lg font-medium uppercase tracking-tight">Analytical console suspended</h4>
                <p className="text-xs font-mono text-text-secondary mt-1">Please select an operational team from the sidebar directory.</p>
              </div>
            )}
          </div>

          {/* Drawer Overlay: Personnel Analytics Drill-down */}
          <AnimatePresence>
            {selectedPersonnel && (
              <motion.div
                initial={{ x: '100%' }}
                animate={{ x: 0 }}
                exit={{ x: '100%' }}
                transition={{ type: 'spring', damping: 25, stiffness: 200 }}
                className="absolute inset-y-0 right-0 w-full sm:w-96 border-l border-border bg-bg shadow-2xl p-6 flex flex-col justify-between z-50 overflow-y-auto"
              >
                <div className="space-y-8">
                  {/* Close and title */}
                  <div className="flex justify-between items-center border-b border-border pb-4">
                    <h4 className="text-xs font-sans tracking-tight uppercase tracking-wide text-signal-info font-bold">Personnel Analytics</h4>
                    <button
                      onClick={() => setSelectedPersonnelId(null)}
                      className="p-1 border border-border hover:bg-white/5 text-text-secondary hover:text-text-primary transition-colors"
                    >
                      <Plus className="w-4 h-4 rotate-45" />
                    </button>
                  </div>

                  {/* Profile Info */}
                  <div className="flex items-center gap-4">
                    <div className="w-16 h-16 border border-border bg-white/5 flex items-center justify-center overflow-hidden">
                      {selectedPersonnel.profile.avatar_url ? (
                        <img src={selectedPersonnel.profile.avatar_url} alt={selectedPersonnel.profile.full_name} className="w-full h-full object-cover" />
                      ) : (
                        <Users className="w-8 h-8 text-text-quaternary" />
                      )}
                    </div>
                    <div>
                      <h4 className="text-lg font-semibold tracking-tight">{selectedPersonnel.profile.full_name || 'Anonymous User'}</h4>
                      <p className="text-xs font-mono text-text-tertiary">{selectedPersonnel.profile.email}</p>
                      <p className="text-[10px] font-mono text-signal-info uppercase mt-1">ROLE: {selectedPersonnel.profile.role === 'viewer' ? (systemData.userCustomRoles && systemData.userCustomRoles[selectedPersonnel.profile.id]) || 'Viewer' : selectedPersonnel.profile.role.replace('_', ' ')}</p>
                    </div>
                  </div>

                  {/* Dynamic monthly attendance summary stats */}
                  <div className="space-y-3">
                    <h5 className="text-[10px] font-sans tracking-tight uppercase tracking-wide text-text-tertiary font-bold">Monthly Attendance Metrics</h5>
                    <div className="grid grid-cols-3 gap-2">
                      <div className="bg-surface border border-border p-3 text-center">
                        <p className="text-[8px] font-mono text-signal-safe/70 uppercase">PRESENT</p>
                        <p className="text-xl font-bold font-sans tracking-tight text-signal-safe mt-1">{selectedPersonnel.presentDays}</p>
                      </div>
                      <div className="bg-surface border border-yellow-500/10 p-3 text-center">
                        <p className="text-[8px] font-mono text-signal-warning/70 uppercase">HALF_DAY</p>
                        <p className="text-xl font-bold font-sans tracking-tight text-signal-warning mt-1">{selectedPersonnel.halfDays}</p>
                      </div>
                      <div className="bg-surface border border-red-500/10 p-3 text-center">
                        <p className="text-[8px] font-mono text-signal-critical/70 uppercase">ABSENT</p>
                        <p className="text-xl font-bold font-sans tracking-tight text-signal-critical mt-1">{selectedPersonnel.absentDays}</p>
                      </div>
                    </div>
                    <p className="text-[9px] font-mono text-text-quaternary italic leading-tight">Note: Unmarked working days are accounted as present by default.</p>
                  </div>

                  {/* Active tasks assignments */}
                  <div className="space-y-3">
                    <h5 className="text-[10px] font-sans tracking-tight uppercase tracking-wide text-text-tertiary font-bold">Attached workloads</h5>
                    {selectedPersonnel.activeProjects.length === 0 ? (
                      <p className="text-xs font-mono text-text-quaternary italic">Awaiting task allocations.</p>
                    ) : (
                      <div className="space-y-2 max-h-60 overflow-y-auto">
                        {selectedPersonnel.activeProjects.map(proj => (
                          <div key={proj.id} className="border border-border-subtle bg-surface-2 p-3 text-xs font-mono flex flex-col gap-1">
                            <span className="font-semibold text-text-secondary truncate">{proj.name}</span>
                            <div className="flex justify-between items-center text-[9px] text-text-tertiary">
                              <span>PRIORITY: <strong className={proj.priority === 'high' ? 'text-signal-critical' : 'text-signal-info'}>{proj.priority.toUpperCase()}</strong></span>
                              <span>STATUS: {proj.status.toUpperCase()}</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                <div className="pt-6 border-t border-border-subtle flex flex-col gap-3">
                  {selectedPersonnel.profile.phone && (
                    <div className="text-xs font-mono text-text-secondary">
                      CONTACT SECURE KEY: <strong className="text-text-secondary">{selectedPersonnel.profile.phone}</strong>
                    </div>
                  )}
                  <button
                    onClick={() => setSelectedPersonnelId(null)}
                    className="w-full py-2 bg-white text-black text-[10px] uppercase font-mono tracking-wide font-semibold hover:bg-neutral-200 transition-colors"
                  >
                    Commit & Sync Analytics
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

        </div>
      </motion.div>
    </div>
  );
}
