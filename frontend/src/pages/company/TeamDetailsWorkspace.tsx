import React, { useState } from 'react';

import { useDashboard } from '../../context/DashboardContext';
import { useAuth } from '../../context/AuthContext';
import { hasCapability } from '../../core/auth/permissions';
import { 
  ArrowLeft, 
  LayoutDashboard, 
  Users, 
  Briefcase, 
  Activity, 
  Map, 
  Clock, 
  Settings,
  Plus,
  BarChart2,
  Zap,
  FileText,
  CheckCircle,
  ShieldAlert,
  Calendar
} from 'lucide-react';
import { MemberDirectory } from '../../components/team/MemberDirectory';
import { SkillsMatrixView } from '../../components/resources/SkillsMatrixView';
import { TeamRosterView } from '../../components/resources/TeamRosterView';
import { navigate } from '../../lib/navigation';


export default function TeamDetailsWorkspace({ teamId }: { teamId: string }) {
  const { profile } = useAuth();
  const { teams, projects, tasks, profiles } = useDashboard();
  
  const [activeTab, setActiveTab] = useState<'overview' | 'members' | 'projects' | 'capacity' | 'skills' | 'workload' | 'settings'>('overview');

  const team = teams.find(t => t.id === teamId);
  if (!team) {
    return (
      <div className="flex h-screen items-center justify-center p-8 bg-surface text-white">
        <div className="text-center">
          <h2 className="text-xl font-bold mb-2">Team not found</h2>
          <button 
            onClick={() => {
              navigate('/company/teams');
            }} 
            className="text-indigo-400 hover:underline"
          >
            Return to Teams
          </button>
        </div>
      </div>
    );
  }

  const data = team.data as any;
  const pm = profiles.find(p => p.id === data?.pm_id);
  const devIds = data?.developer_ids || [];
  const teamProjects = projects.filter(p => p.team_id === team.id && p.status !== 'done');
  
  const TABS = [
    { id: 'overview', label: 'Overview', icon: LayoutDashboard },
    { id: 'members', label: 'Members', icon: Users },
    { id: 'projects', label: 'Projects', icon: Briefcase },
    { id: 'capacity', label: 'Capacity', icon: Activity },
    { id: 'skills', label: 'Skills', icon: Map },
    { id: 'settings', label: 'Settings', icon: Settings }
  ] as const;

  return (
    <div className="flex flex-col h-[calc(100vh-80px)] overflow-hidden bg-surface text-white">
      {/* Header */}
      <div className="flex-shrink-0 p-6 md:p-8 border-b border-border bg-surface-2/30">
        <button 
          onClick={() => {
            navigate('/company/teams');
          }}
          className="flex items-center gap-2 text-sm text-[var(--text-secondary)] hover:text-white transition-colors mb-4"
        >
          <ArrowLeft className="w-4 h-4" /> Back to Teams
        </button>
        
        <div className="flex justify-between items-start">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <div className="w-10 h-10 rounded-xl flex items-center justify-center text-xl font-bold shadow-inner" style={{ backgroundColor: data?.color || '#6366f1' }}>
                {team.name.charAt(0)}
              </div>
              <h1 className="text-3xl font-extrabold tracking-tight">
                {team.name}
              </h1>
            </div>
            {data?.department && (
              <span className="inline-block px-2 py-1 bg-surface-3 rounded text-[10px] uppercase font-bold tracking-wider text-[var(--text-secondary)] mb-2">
                {data.department}
              </span>
            )}
            <p className="text-[var(--text-secondary)] text-sm max-w-2xl leading-relaxed">
              {data?.description || 'No description provided for this operational team.'}
            </p>
          </div>
        </div>

        <div className="flex gap-2 mt-6 overflow-x-auto pb-1">
          {TABS.map(tab => (
            <button 
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`flex items-center gap-2 px-4 py-2 text-sm font-semibold rounded-md transition-all whitespace-nowrap ${activeTab === tab.id ? 'bg-indigo-500 text-white shadow-sm' : 'text-[var(--text-secondary)] hover:text-white hover:bg-surface-3'}`}
            >
              <tab.icon className="w-4 h-4" />
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 overflow-y-auto p-6 md:p-8">
        <div className="animate-in fade-in slide-in-from-bottom-2 duration-300 h-full">
          {activeTab === 'overview' && (
            <div className="space-y-6">
              {/* Top Row: Quick Stats & Health */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="bg-surface-2 border border-border rounded-xl p-5 shadow-sm">
                  <h3 className="text-xs font-mono uppercase tracking-widest text-[var(--text-secondary)] mb-4 flex items-center gap-2"><CheckCircle className="w-3.5 h-3.5"/> Team Lead</h3>
                  {pm ? (
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-indigo-500/20 text-indigo-300 rounded-full flex items-center justify-center font-bold">
                        {pm.full_name?.charAt(0) || pm.email.charAt(0)}
                      </div>
                      <div className="truncate">
                        <div className="font-semibold text-white truncate">{pm.full_name || pm.email}</div>
                        <div className="text-xs text-[var(--text-secondary)]">{pm.designation || 'Project Manager'}</div>
                      </div>
                    </div>
                  ) : (
                    <span className="text-sm text-[var(--text-secondary)] italic">No Lead Assigned</span>
                  )}
                </div>

                <div className="bg-surface-2 border border-border rounded-xl p-5 shadow-sm">
                  <h3 className="text-xs font-mono uppercase tracking-widest text-[var(--text-secondary)] mb-4 flex items-center gap-2"><Users className="w-3.5 h-3.5"/> Team Size</h3>
                  <div className="text-3xl font-bold text-white">{devIds.length} <span className="text-sm font-normal text-[var(--text-secondary)]">members</span></div>
                  <div className="text-xs text-[var(--text-secondary)] mt-1">Capacity: {devIds.length * 5} tasks / wk</div>
                </div>

                <div className="bg-surface-2 border border-border rounded-xl p-5 shadow-sm">
                  <h3 className="text-xs font-mono uppercase tracking-widest text-[var(--text-secondary)] mb-4 flex items-center gap-2"><Briefcase className="w-3.5 h-3.5"/> Active Projects</h3>
                  <div className="text-3xl font-bold text-blue-400">{teamProjects.length}</div>
                  <div className="text-xs text-[var(--text-secondary)] mt-1">Across {data?.department || 'all departments'}</div>
                </div>

                <div className="bg-surface-2 border border-border rounded-xl p-5 shadow-sm">
                  <h3 className="text-xs font-mono uppercase tracking-widest text-[var(--text-secondary)] mb-4 flex items-center gap-2"><Activity className="w-3.5 h-3.5"/> Health Status</h3>
                  <div className="flex items-center gap-2">
                    {teamProjects.length > 0 ? (
                      <div className="flex items-center gap-2 text-emerald-400 bg-emerald-500/10 px-3 py-1.5 rounded-lg border border-emerald-500/20">
                        <CheckCircle className="w-5 h-5" />
                        <span className="font-bold">Healthy</span>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2 text-slate-400 bg-slate-500/10 px-3 py-1.5 rounded-lg border border-slate-500/20">
                        <Clock className="w-5 h-5" />
                        <span className="font-bold">Idle</span>
                      </div>
                    )}
                  </div>
                  <div className="text-xs text-[var(--text-secondary)] mt-2">Based on active workload</div>
                </div>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Main Content Area */}
                <div className="lg:col-span-2 space-y-6">
                  {/* Upcoming Deadlines */}
                  <div className="bg-surface-2 border border-border rounded-xl p-6">
                    <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2"><Calendar className="w-5 h-5 text-amber-400"/> Upcoming Deadlines</h3>
                    <div className="space-y-3">
                      <div className="p-3 bg-surface border border-border rounded-lg flex justify-between items-center">
                        <div>
                          <div className="text-sm font-semibold">Phase 1 Delivery</div>
                          <div className="text-xs text-[var(--text-secondary)] mt-0.5">Project Alpha</div>
                        </div>
                        <div className="text-xs font-bold text-amber-400 bg-amber-500/10 px-2 py-1 rounded">Tomorrow</div>
                      </div>
                      <div className="text-center text-xs text-[var(--text-secondary)] italic mt-2">Mocked data. Tie to actual tasks via tasks.filter in future.</div>
                    </div>
                  </div>

                  {/* Recent Activity */}
                  <div className="bg-surface-2 border border-border rounded-xl p-6">
                    <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2"><Clock className="w-5 h-5 text-indigo-400"/> Recent Activity</h3>
                    <div className="space-y-4 relative before:absolute before:inset-0 before:ml-5 before:-translate-x-px md:before:mx-auto md:before:translate-x-0 before:h-full before:w-0.5 before:bg-gradient-to-b before:from-transparent before:via-border before:to-transparent">
                       <div className="text-center text-xs text-[var(--text-secondary)] italic p-4">No recent activity found for this team.</div>
                    </div>
                  </div>
                </div>

                {/* Sidebar: Quick Actions */}
                <div className="space-y-6">
                  <div className="bg-surface-2 border border-border rounded-xl p-6">
                    <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2"><Zap className="w-5 h-5 text-yellow-400"/> Quick Actions</h3>
                    <div className="space-y-2">
                      <button onClick={() => setActiveTab('members')} className="w-full flex items-center justify-between p-3 bg-surface hover:bg-surface-3 border border-border rounded-lg transition-colors group">
                        <div className="flex items-center gap-3 text-sm font-semibold text-[var(--text-secondary)] group-hover:text-white">
                          <Users className="w-4 h-4" /> Add Member
                        </div>
                        <Plus className="w-4 h-4 text-[var(--text-secondary)]" />
                      </button>
                      <button className="w-full flex items-center justify-between p-3 bg-surface hover:bg-surface-3 border border-border rounded-lg transition-colors group">
                        <div className="flex items-center gap-3 text-sm font-semibold text-[var(--text-secondary)] group-hover:text-white">
                          <Briefcase className="w-4 h-4" /> Assign Project
                        </div>
                        <Plus className="w-4 h-4 text-[var(--text-secondary)]" />
                      </button>
                      <button className="w-full flex items-center justify-between p-3 bg-surface hover:bg-surface-3 border border-border rounded-lg transition-colors group">
                        <div className="flex items-center gap-3 text-sm font-semibold text-[var(--text-secondary)] group-hover:text-white">
                          <Activity className="w-4 h-4" /> Create Sprint
                        </div>
                        <Plus className="w-4 h-4 text-[var(--text-secondary)]" />
                      </button>
                      <button className="w-full flex items-center justify-between p-3 bg-surface hover:bg-surface-3 border border-border rounded-lg transition-colors group">
                        <div className="flex items-center gap-3 text-sm font-semibold text-[var(--text-secondary)] group-hover:text-white">
                          <FileText className="w-4 h-4" /> Generate Report
                        </div>
                        <Plus className="w-4 h-4 text-[var(--text-secondary)]" />
                      </button>
                      <button onClick={() => setActiveTab('settings')} className="w-full flex items-center justify-between p-3 bg-surface hover:bg-surface-3 border border-border rounded-lg transition-colors group">
                        <div className="flex items-center gap-3 text-sm font-semibold text-[var(--text-secondary)] group-hover:text-white">
                          <Settings className="w-4 h-4" /> Edit Team
                        </div>
                        <Plus className="w-4 h-4 text-[var(--text-secondary)]" />
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'members' && (
            <div className="bg-surface-2 p-4 rounded-xl border border-border">
              <MemberDirectory teamId={teamId} />
            </div>
          )}

          {activeTab === 'projects' && (
            <div className="space-y-4">
              {teamProjects.length === 0 ? (
                <div className="text-center p-8 bg-surface-2 border border-border rounded-xl text-[var(--text-secondary)]">
                  No active projects assigned to this team.
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {teamProjects.map(p => (
                    <div key={p.id} className="p-4 bg-surface-2 border border-border rounded-xl">
                      <div className="font-semibold text-white">{p.name}</div>
                      <div className="text-xs text-[var(--text-secondary)] mt-1">{p.status.toUpperCase()}</div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {activeTab === 'capacity' && (
            <TeamRosterView teamId={teamId} />
          )}

          {activeTab === 'skills' && (
            <div className="bg-surface-2 p-4 rounded-xl border border-border">
              <SkillsMatrixView teamId={teamId} />
            </div>
          )}

          {activeTab === 'settings' && (
            <div className="max-w-2xl">
              <div className="bg-surface-2 border border-border rounded-xl p-6">
                <h2 className="text-lg font-bold mb-4">Team Settings</h2>
                <p className="text-sm text-[var(--text-secondary)] mb-6">
                  Update team details. (Not fully implemented in this demo).
                </p>
                <div className="space-y-4 opacity-50 pointer-events-none">
                  <div>
                    <label className="block text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wider mb-2">Team Name</label>
                    <input type="text" value={team.name} readOnly className="w-full bg-surface border border-border rounded-lg px-4 py-2" />
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
