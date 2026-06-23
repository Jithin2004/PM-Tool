import React, { useEffect, useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useWorkspace } from '../../context/WorkspaceContext';
import { useDashboard } from '../../context/DashboardContext';
import { hasAuthority, hasCapability } from '../../core/auth/permissions';
import { supabase } from '../../lib/supabase';
import { attendanceEngine } from '../../core/engines/attendanceEngine';
import { leaveBalanceService } from '../../services/leaveBalanceService';
import { LogisticsDashboard } from '../../components/admin/LogisticsDashboard';
import { WorkLogsPanel } from '../../components/resources/WorkLogsPanel';
import { showAlert } from '../../components/common/Dialogs';
import { 
  User, 
  Users, 
  Briefcase, 
  FileText, 
  CheckSquare, 
  ArrowRight, 
  Calendar, 
  Layers,
  Clock,
  UserCheck
} from 'lucide-react';

export default function PeopleOpsCenter() {
  const { profile } = useAuth();
  const { workspace } = useWorkspace();
  const { 
    teams, 
    projects, 
    tasks, 
    profiles,
    updateTask,
    systemData,
    handleSaveLogisticsData
  } = useDashboard();

  const canManageHR = hasCapability(profile?.role, 'people.manage');
  
  // Start with 'admin' if route indicates logistics/attendance/payroll, else 'journey'
  const [activeTab, setActiveTab] = useState<'journey' | 'admin' | 'timesheets'>(() => {
    const path = window.location.pathname;
    if (canManageHR && (path.includes('resources') && !path.includes('employee'))) {
      return 'admin';
    }
    return 'journey';
  });

  // EmployeeStartCenter State
  const [documents, setDocuments] = useState<any[]>([]);
  const [loadingDocs, setLoadingDocs] = useState(true);

  // EmployeeDashboard State
  const [loadingOps, setLoadingOps] = useState(false);
  const [dailyStatus, setDailyStatus] = useState<any[]>([]);
  const [balances, setBalances] = useState<any[]>([]);
  const [isClockedIn, setIsClockedIn] = useState(false);

  useEffect(() => {
    async function loadDocs() {
      if (!workspace?.id) return;
      try {
        const { data, error } = await supabase
          .from('document_references')
          .select('*')
          .eq('workspace_id', workspace.id)
          .order('created_at', { ascending: false });
        if (!error && data) {
          setDocuments(data);
        }
      } catch (e) {
        console.error('Failed to load document references:', e);
      } finally {
        setLoadingDocs(false);
      }
    }
    loadDocs();
  }, [workspace?.id]);

  useEffect(() => {
    if (!workspace?.id || !profile?.id) return;
    loadOpsData();
  }, [workspace?.id, profile?.id]);

  const loadOpsData = async () => {
    if (!workspace?.id || !profile?.id) return;
    try {
      const status = await attendanceEngine.getDailyStatus(workspace.id, profile.id, new Date());
      setDailyStatus(status);
      
      const inEvent = status.filter(e => e.event_type === 'CLOCK_IN').pop();
      const outEvent = status.filter(e => e.event_type === 'CLOCK_OUT').pop();
      setIsClockedIn(inEvent && (!outEvent || outEvent.timestamp < inEvent.timestamp));

      // Load balances (Mock fetching multiple types for demo)
      const bal1 = await leaveBalanceService.getBalance(workspace.id, profile.id, 'Casual');
      const bal2 = await leaveBalanceService.getBalance(workspace.id, profile.id, 'Medical');
      setBalances([bal1, bal2].filter(Boolean));
    } catch (err) {
      console.error(err);
    }
  };

  const handleClockIn = async () => {
    setLoadingOps(true);
    try {
      await attendanceEngine.clockIn(workspace!.id, profile!.id);
      await loadOpsData();
      showAlert("Clocked in successfully.", { type: "success" });
    } catch (e: any) {
      showAlert(e.message, { type: "error" });
    } finally {
      setLoadingOps(false);
    }
  };

  const handleClockOut = async () => {
    setLoadingOps(true);
    try {
      await attendanceEngine.clockOut(workspace!.id, profile!.id);
      await loadOpsData();
      showAlert("Clocked out successfully.", { type: "success" });
    } catch (e: any) {
      showAlert(e.message, { type: "error" });
    } finally {
      setLoadingOps(false);
    }
  };

  const handleRequestLeave = async () => {
    const reason = prompt("Enter reason for leave:");
    if (!reason) return;
    setLoadingOps(true);
    try {
      const start = new Date();
      start.setDate(start.getDate() + 1); // Tomorrow
      const end = new Date(start);
      end.setDate(end.getDate() + 1); // 2 days

      await leaveBalanceService.requestLeave(workspace!.id, profile!.id, 'Casual', start, end, reason);
      showAlert("Leave requested successfully. Waiting for manager approval.", { type: "success" });
    } catch (e: any) {
      showAlert(e.message, { type: "error" });
    } finally {
      setLoadingOps(false);
    }
  };

  if (!profile) {
    return (
      <div className="flex h-screen items-center justify-center bg-[#111827] text-white">
        <div className="animate-spin w-8 h-8 border-2 border-indigo-500 border-t-transparent rounded-full" />
      </div>
    );
  }

  // Derived Data for "My Journey"
  const myTeams = teams.filter(t => {
    if (t.name === 'SYSTEM_SETTINGS') return false;
    const devIds = (t.data as any)?.developer_ids || [];
    const pmId = (t.data as any)?.pm_id || '';
    return devIds.includes(profile.id) || pmId === profile.id;
  });

  const teammateIds = new Set<string>();
  const managerIds = new Set<string>();

  myTeams.forEach(t => {
    const devIds = (t.data as any)?.developer_ids || [];
    const pmId = (t.data as any)?.pm_id || '';
    if (pmId && pmId !== profile.id) {
      managerIds.add(pmId);
    }
    devIds.forEach((id: string) => {
      if (id !== profile.id) {
        teammateIds.add(id);
      }
    });
  });

  const teammates = profiles.filter(p => teammateIds.has(p.id));
  const fallbackContacts = profiles.filter(p => p.id !== profile.id).slice(0, 8);
  const myTasks = tasks.filter(t => t.assignee_id === profile.id && !['completed', 'done', 'verified'].includes(t.status.toLowerCase()));
  const userTeamIds = myTeams.map(t => t.id);
  const myProjects = projects.filter(p => p.status !== 'done' && (p.team_id && userTeamIds.includes(p.team_id)));
  const displayProjects = myProjects.length > 0 ? myProjects : projects.filter(p => p.status !== 'done').slice(0, 4);

  const initials = (profile.full_name || profile.email || '?')
    .split(' ')
    .map(w => w[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();

  return (
    <div className="flex-1 bg-surface text-white p-6 md:p-8 min-h-screen overflow-y-auto">
      
      {/* Header and Tab Selection */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end mb-8 gap-4">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight text-white mb-2">
            People Ops Center
          </h1>
          <p className="text-[var(--text-secondary)] text-sm max-w-2xl leading-relaxed">
            Your unified hub for individual onboarding, daily operations, and human resources tracking.
          </p>
        </div>
        
        {canManageHR && (
          <div className="flex bg-surface-2 p-1 rounded-lg border border-[var(--border-soft)]">
            <button 
              onClick={() => setActiveTab('journey')}
              className={`px-4 py-2 text-sm font-semibold rounded-md transition-all ${activeTab === 'journey' ? 'bg-indigo-500 text-white' : 'text-[var(--text-secondary)] hover:text-white'}`}
            >
              My Journey
            </button>
            <button 
              onClick={() => setActiveTab('admin')}
              className={`px-4 py-2 text-sm font-semibold rounded-md transition-all ${activeTab === 'admin' ? 'bg-indigo-500 text-white' : 'text-[var(--text-secondary)] hover:text-white'}`}
            >
              HR Admin
            </button>
            <button 
              onClick={() => setActiveTab('timesheets')}
              className={`px-4 py-2 text-sm font-semibold rounded-md transition-all ${activeTab === 'timesheets' ? 'bg-indigo-500 text-white' : 'text-[var(--text-secondary)] hover:text-white'}`}
            >
              Timesheets
            </button>
          </div>
        )}
      </div>

      {activeTab === 'admin' ? (
        <div className="animate-in fade-in slide-in-from-bottom-2 duration-300">
          <LogisticsDashboard
            profiles={profiles}
            teams={teams}
            projects={projects}
            tasks={tasks}
            updateTask={updateTask}
            systemData={systemData}
            onSaveData={handleSaveLogisticsData}
            role={profile?.role}
            defaultTab={window.location.pathname.includes('attendance') ? 'attendance' : window.location.pathname.includes('payroll') ? 'payroll' : 'members'}
          />
        </div>
      ) : activeTab === 'timesheets' ? (
        <div className="animate-in fade-in slide-in-from-bottom-2 duration-300">
          <WorkLogsPanel />
        </div>
      ) : (
        <div className="space-y-8 animate-in fade-in slide-in-from-bottom-2 duration-300">
          
          {/* Welcome Banner */}
          <div className="relative bg-gradient-to-r from-indigo-900/60 to-purple-900/30 border border-indigo-500/20 rounded-2xl p-6 md:p-8 overflow-hidden shadow-lg">
            <div className="absolute -right-10 -bottom-10 w-40 h-40 bg-indigo-500/10 rounded-full blur-3xl" />
            <div className="absolute -left-10 -top-10 w-40 h-40 bg-purple-500/10 rounded-full blur-3xl" />
            
            <div className="flex flex-col md:flex-row items-center gap-6 relative z-10">
              <div className="w-20 h-20 rounded-2xl flex items-center justify-center font-extrabold text-2xl bg-indigo-500/20 border-2 border-indigo-500/40 text-indigo-300 shadow-inner animate-pulse">
                {initials}
              </div>
              <div className="text-center md:text-left">
                <div className="text-xs font-mono uppercase tracking-widest text-indigo-400 mb-1">Employee Profile</div>
                <h2 className="text-2xl font-bold text-white mb-2">
                  Welcome, {profile.full_name || 'Partner'}
                </h2>
                <div className="flex items-center justify-center md:justify-start gap-3 mt-3">
                  <div className={`px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider border ${isClockedIn ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' : 'bg-[var(--surface-hover)] text-[var(--text-secondary)] border-[var(--border-soft)]'}`}>
                    {isClockedIn ? 'ON SHIFT' : 'OFF SHIFT'}
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            
            {/* Left Column: Role details, Team & Attendance */}
            <div className="space-y-6">
              
              {/* Card: Attendance Terminal */}
              <div className="bg-surface-2 border border-[var(--border-soft)] rounded-xl p-5 shadow-md">
                <h3 className="text-xs font-mono uppercase tracking-widest text-[var(--text-secondary)] mb-4 flex items-center gap-2">
                  <Clock className="w-4 h-4 text-blue-400" /> Attendance Terminal
                </h3>
                <div className="flex gap-4">
                  <button 
                    onClick={handleClockIn}
                    disabled={loadingOps || isClockedIn}
                    className="flex-1 py-3 bg-emerald-500/10 text-emerald-500 border border-emerald-500/20 rounded-lg text-xs font-bold disabled:opacity-50 hover:bg-emerald-500/20 transition-all"
                  >
                    CLOCK IN
                  </button>
                  <button 
                    onClick={handleClockOut}
                    disabled={loadingOps || !isClockedIn}
                    className="flex-1 py-3 bg-rose-500/10 text-rose-500 border border-rose-500/20 rounded-lg text-xs font-bold disabled:opacity-50 hover:bg-rose-500/20 transition-all"
                  >
                    CLOCK OUT
                  </button>
                </div>
                
                <div className="mt-5 space-y-2">
                  <h4 className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-secondary)]">Today's Log</h4>
                  {dailyStatus.length === 0 ? (
                    <p className="text-xs text-[var(--text-secondary)] italic">No punches today.</p>
                  ) : (
                    dailyStatus.map(e => (
                      <div key={e.id} className="flex justify-between items-center text-xs p-2 bg-black/20 rounded border border-[var(--border-soft)]">
                        <span className="font-mono text-[var(--text-secondary)]">{new Date(e.timestamp).toLocaleTimeString()}</span>
                        <span className={`font-bold ${e.event_type === 'CLOCK_IN' ? 'text-emerald-400' : 'text-rose-400'}`}>
                          {e.event_type.replace('_', ' ')}
                        </span>
                      </div>
                    ))
                  )}
                </div>
              </div>

              {/* Card: Your Role */}
              <div className="bg-surface-2 border border-[var(--border-soft)] rounded-xl p-5 shadow-md">
                <h3 className="text-xs font-mono uppercase tracking-widest text-[var(--text-secondary)] mb-4 flex items-center gap-2">
                  <User className="w-4 h-4 text-indigo-400" />
                  Your Role Profile
                </h3>
                <div className="space-y-4">
                  <div>
                    <div className="text-[10px] uppercase text-[var(--text-secondary)] font-mono mb-0.5">Designation</div>
                    <div className="font-semibold text-sm text-white">{profile.designation || 'Specialist'}</div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <div className="text-[10px] uppercase text-[var(--text-secondary)] font-mono mb-0.5">Role Tier</div>
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-indigo-500/10 text-indigo-300 border border-indigo-500/20">
                        {profile.role}
                      </span>
                    </div>
                    <div>
                      <div className="text-[10px] uppercase text-[var(--text-secondary)] font-mono mb-0.5">Joining Date</div>
                      <div className="text-xs font-medium text-white flex items-center gap-1">
                        <Calendar className="w-3.5 h-3.5 text-[var(--text-secondary)]" />
                        {profile.date_of_joining ? new Date(profile.date_of_joining).toLocaleDateString() : 'N/A'}
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Card: Your Team */}
              <div className="bg-surface-2 border border-[var(--border-soft)] rounded-xl p-5 shadow-md">
                <h3 className="text-xs font-mono uppercase tracking-widest text-[var(--text-secondary)] mb-4 flex items-center gap-2">
                  <Layers className="w-4 h-4 text-indigo-400" />
                  Your Team Alignment
                </h3>
                {myTeams.length === 0 ? (
                  <div className="text-xs text-[var(--text-secondary)] leading-relaxed italic p-3 bg-yellow-500/5 border border-yellow-500/10 rounded-lg">
                    You are not assigned to an operational team. Check with an administrator.
                  </div>
                ) : (
                  <div className="space-y-4">
                    {myTeams.map(t => (
                      <div key={t.id} className="pb-3 border-b border-[var(--border-soft)] last:border-b-0 last:pb-0">
                        <div className="font-semibold text-sm text-white mb-2">{t.name}</div>
                        <div className="mt-2 bg-indigo-500/5 border border-indigo-500/10 rounded-lg p-2">
                          <div className="text-[9px] uppercase tracking-wider text-indigo-400 font-mono mb-1">Team Lead</div>
                          {(() => {
                            const pm = profiles.find(p => p.id === (t.data as any)?.pm_id);
                            if (!pm) return <div className="text-xs italic text-[var(--text-secondary)]">No Manager assigned</div>;
                            return (
                              <div className="flex items-center gap-2">
                                <div className="text-xs font-semibold text-white">{pm.full_name || 'Manager'}</div>
                              </div>
                            );
                          })()}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

            </div>

            {/* Center Column: Active Projects, Tasks, Leave Balances */}
            <div className="lg:col-span-2 space-y-6">
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Card: First Deliverables */}
                <div className="bg-surface-2 border border-[var(--border-soft)] rounded-xl p-5 shadow-md flex flex-col">
                  <h3 className="text-xs font-mono uppercase tracking-widest text-[var(--text-secondary)] mb-4 flex items-center justify-between">
                    <span className="flex items-center gap-2">
                      <CheckSquare className="w-4 h-4 text-indigo-400" /> My Tasks
                    </span>
                    <span className="text-[9px] bg-indigo-500/20 text-indigo-300 px-2 py-0.5 rounded font-mono">
                      {myTasks.length} pending
                    </span>
                  </h3>
                  <div className="flex-1 overflow-y-auto space-y-3 pr-1 max-h-60 scrollbar-premium">
                    {myTasks.length === 0 ? (
                      <div className="text-xs text-[var(--text-secondary)] italic p-4 border border-dashed border-[var(--border-soft)] rounded-lg text-center">
                        No tasks assigned.
                      </div>
                    ) : (
                      myTasks.map(task => (
                        <div key={task.id} className="p-3 bg-black/20 border border-[var(--border-soft)] rounded-lg">
                          <div className="font-semibold text-xs text-white truncate">{task.name}</div>
                          <span className="inline-flex mt-2 items-center px-1.5 py-0.5 rounded text-[9px] font-bold uppercase bg-amber-500/10 text-amber-400 border border-amber-500/20">
                            {task.status}
                          </span>
                        </div>
                      ))
                    )}
                  </div>
                </div>

                {/* Card: Leave Balances */}
                <div className="bg-surface-2 border border-[var(--border-soft)] rounded-xl p-5 shadow-md flex flex-col">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-xs font-mono uppercase tracking-widest text-[var(--text-secondary)] flex items-center gap-2">
                      <UserCheck className="w-4 h-4 text-indigo-400" /> Leave
                    </h3>
                    <button 
                      onClick={handleRequestLeave}
                      className="px-2 py-1 text-[10px] font-bold bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 rounded hover:bg-indigo-500/20 transition-colors"
                    >
                      Request
                    </button>
                  </div>
                  <div className="flex-1 overflow-y-auto space-y-3 pr-1 max-h-60 scrollbar-premium">
                    {balances.length === 0 ? (
                      <div className="p-3 bg-black/20 rounded border border-[var(--border-soft)] text-center text-xs text-[var(--text-secondary)]">
                        Balances synced with HR.
                      </div>
                    ) : (
                      balances.map((b, i) => (
                        <div key={i} className="flex justify-between items-center p-3 bg-black/20 rounded-lg border border-[var(--border-soft)]">
                          <div>
                            <span className="block font-bold text-xs text-white">{b.leave_type}</span>
                            <span className="text-[10px] text-[var(--text-secondary)]">{b.used}/{b.allocated} used</span>
                          </div>
                          <div className="text-sm font-bold text-indigo-400">
                            {b.remaining} <span className="text-[10px] font-normal text-[var(--text-secondary)]">left</span>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </div>

              {/* Card: Active Projects */}
              <div className="bg-surface-2 border border-[var(--border-soft)] rounded-xl p-5 shadow-md">
                <h3 className="text-xs font-mono uppercase tracking-widest text-[var(--text-secondary)] mb-4 flex items-center gap-2">
                  <Briefcase className="w-4 h-4 text-indigo-400" /> Active Projects
                </h3>
                {displayProjects.length === 0 ? (
                  <div className="text-xs text-[var(--text-secondary)] italic p-4 border border-dashed border-[var(--border-soft)] rounded-lg text-center">
                    No active projects.
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {displayProjects.map(proj => (
                      <div 
                        key={proj.id}
                        onClick={() => {
                          window.history.pushState(null, '', `/projects/${proj.id}/board`);
                          window.dispatchEvent(new CustomEvent('popstate'));
                        }}
                        className="p-3 bg-black/20 border border-[var(--border-soft)] rounded-lg hover:border-indigo-500/30 cursor-pointer group"
                      >
                        <div className="font-bold text-sm text-white group-hover:text-indigo-400 transition-colors truncate">
                          {proj.name}
                        </div>
                        <div className="flex items-center justify-between text-[10px] font-mono text-[var(--text-secondary)] mt-2">
                          <span className="capitalize">{proj.status}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

            </div>
          </div>
        </div>
      )}
    </div>
  );
}
