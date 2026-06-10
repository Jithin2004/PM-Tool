import React, { useEffect, useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useWorkspace } from '../../context/WorkspaceContext';
import { useDashboard } from '../../context/DashboardContext';
import { supabase } from '../../lib/supabase';
import { 
  User, 
  Users, 
  Briefcase, 
  FileText, 
  CheckSquare, 
  ArrowRight, 
  MapPin, 
  Calendar, 
  Shield, 
  Mail, 
  Phone, 
  Layers 
} from 'lucide-react';

export function EmployeeStartCenter() {
  const { profile } = useAuth();
  const { workspace } = useWorkspace();
  const { teams, projects, tasks, profiles } = useDashboard();
  const [documents, setDocuments] = useState<any[]>([]);
  const [loadingDocs, setLoadingDocs] = useState(true);

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

  if (!profile) {
    return (
      <div className="flex h-screen items-center justify-center bg-[#111827] text-white">
        <div className="animate-spin w-8 h-8 border-2 border-indigo-500 border-t-transparent rounded-full" />
      </div>
    );
  }

  // Find user's teams
  const myTeams = teams.filter(t => {
    if (t.name === 'SYSTEM_SETTINGS') return false;
    const devIds = (t.data as any)?.developer_ids || [];
    const pmId = (t.data as any)?.pm_id || '';
    return devIds.includes(profile.id) || pmId === profile.id;
  });

  // Teammates in my teams
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

  const managers = profiles.filter(p => managerIds.has(p.id));
  const teammates = profiles.filter(p => teammateIds.has(p.id));

  // If no specific teammates/managers (not in any team yet), fallback to general contacts in workspace
  const fallbackContacts = profiles.filter(p => p.id !== profile.id).slice(0, 8);

  // User's assigned tasks
  const myTasks = tasks.filter(t => t.assignee_id === profile.id && !['completed', 'done', 'verified'].includes(t.status.toLowerCase()));

  // Active projects for user's teams
  const userTeamIds = myTeams.map(t => t.id);
  const myProjects = projects.filter(p => p.status !== 'done' && (p.team_id && userTeamIds.includes(p.team_id)));

  // Fallback to all projects if user has no specific team projects
  const displayProjects = myProjects.length > 0 ? myProjects : projects.filter(p => p.status !== 'done').slice(0, 4);

  const initials = (profile.full_name || profile.email || '?')
    .split(' ')
    .map(w => w[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();

  return (
    <div className="flex-1 bg-[#111827] text-white p-6 md:p-8 min-h-screen overflow-y-auto">
      {/* Welcome Banner */}
      <div className="relative bg-gradient-to-r from-indigo-900/60 to-purple-900/30 border border-indigo-500/20 rounded-2xl p-6 md:p-8 mb-8 overflow-hidden shadow-lg">
        <div className="absolute -right-10 -bottom-10 w-40 h-40 bg-indigo-500/10 rounded-full blur-3xl" />
        <div className="absolute -left-10 -top-10 w-40 h-40 bg-purple-500/10 rounded-full blur-3xl" />
        
        <div className="flex flex-col md:flex-row items-center gap-6 relative z-10">
          <div className="w-20 h-20 rounded-2xl flex items-center justify-center font-extrabold text-2xl bg-indigo-500/20 border-2 border-indigo-500/40 text-indigo-300 shadow-inner animate-pulse">
            {initials}
          </div>
          <div className="text-center md:text-left">
            <div className="text-xs font-mono uppercase tracking-widest text-indigo-400 mb-1">Employee Onboarding</div>
            <h1 className="text-3xl font-extrabold tracking-tight text-white mb-2">
              Welcome to the Team, {profile.full_name || 'Partner'}!
            </h1>
            <p className="text-[var(--text-secondary)] text-sm max-w-2xl leading-relaxed">
              We are excited to have you join us at <span className="text-white font-semibold">{workspace?.name || 'Resolve PM'}</span>. 
              This is your Employee Start Center — a consolidated hub designed to give you alignment on your role, team, active projects, and first deliverables.
            </p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left Column: Role details, Team & Manager */}
        <div className="space-y-6">
          {/* Card 1: Your Role */}
          <div className="bg-[#1f2937]/50 border border-[var(--border-soft)] rounded-xl p-5 backdrop-blur-sm shadow-md">
            <h3 className="text-xs font-mono uppercase tracking-widest text-[var(--text-secondary)] mb-4 flex items-center gap-2">
              <User className="w-4 h-4 text-indigo-400" />
              Your Role Profile
            </h3>
            <div className="space-y-4">
              <div>
                <div className="text-[10px] uppercase text-[var(--text-secondary)] font-mono mb-0.5">Designation</div>
                <div className="font-semibold text-lg text-white">{profile.designation || 'Specialist'}</div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <div className="text-[10px] uppercase text-[var(--text-secondary)] font-mono mb-0.5">Role Tier</div>
                  <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-indigo-500/10 text-indigo-300 border border-indigo-500/20">
                    {profile.role}
                  </span>
                </div>
                <div>
                  <div className="text-[10px] uppercase text-[var(--text-secondary)] font-mono mb-0.5">Joining Date</div>
                  <div className="text-sm font-medium text-white flex items-center gap-1">
                    <Calendar className="w-3.5 h-3.5 text-[var(--text-secondary)]" />
                    {profile.date_of_joining ? new Date(profile.date_of_joining).toLocaleDateString() : 'N/A'}
                  </div>
                </div>
              </div>
              {profile.department && (
                <div>
                  <div className="text-[10px] uppercase text-[var(--text-secondary)] font-mono mb-0.5">Department</div>
                  <div className="text-sm font-semibold text-white">{profile.department}</div>
                </div>
              )}
            </div>
          </div>

          {/* Card 2: Your Team */}
          <div className="bg-[#1f2937]/50 border border-[var(--border-soft)] rounded-xl p-5 backdrop-blur-sm shadow-md">
            <h3 className="text-xs font-mono uppercase tracking-widest text-[var(--text-secondary)] mb-4 flex items-center gap-2">
              <Layers className="w-4 h-4 text-indigo-400" />
              Your Team Alignment
            </h3>
            {myTeams.length === 0 ? (
              <div className="text-sm text-[var(--text-secondary)] leading-relaxed italic p-3 bg-yellow-500/5 border border-yellow-500/10 rounded-lg">
                You are not currently assigned to an operational team. Check with an administrator to get added to a team roster.
              </div>
            ) : (
              <div className="space-y-4">
                {myTeams.map(t => (
                  <div key={t.id} className="pb-3 border-b border-[var(--border-soft)] last:border-b-0 last:pb-0">
                    <div className="font-semibold text-white mb-2">{t.name}</div>
                    
                    {/* Manager / PM display */}
                    <div className="mt-2 bg-indigo-500/5 border border-indigo-500/10 rounded-lg p-3">
                      <div className="text-[9px] uppercase tracking-wider text-indigo-400 font-mono mb-1">Team Lead / Manager</div>
                      {(() => {
                        const pm = profiles.find(p => p.id === (t.data as any)?.pm_id);
                        if (!pm) return <div className="text-xs italic text-[var(--text-secondary)]">No Manager assigned</div>;
                        return (
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-full bg-indigo-500/20 flex items-center justify-center font-bold text-xs text-indigo-300">
                              {(pm.full_name || pm.email).split(' ').map((n: string) => n[0]).join('').slice(0, 2).toUpperCase()}
                            </div>
                            <div>
                              <div className="text-xs font-semibold text-white">{pm.full_name || 'Manager'}</div>
                              <div className="text-[10px] text-[var(--text-secondary)] font-mono">{pm.email}</div>
                            </div>
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

        {/* Center Column: Active Projects & Tasks */}
        <div className="lg:col-span-2 space-y-6">
          {/* Card 3: First Deliverables (Tasks) */}
          <div className="bg-[#1f2937]/50 border border-[var(--border-soft)] rounded-xl p-5 backdrop-blur-sm shadow-md">
            <h3 className="text-xs font-mono uppercase tracking-widest text-[var(--text-secondary)] mb-4 flex items-center justify-between">
              <span className="flex items-center gap-2">
                <CheckSquare className="w-4 h-4 text-indigo-400" />
                First Tasks Assigned
              </span>
              <span className="text-[10px] bg-indigo-500/20 text-indigo-300 px-2 py-0.5 rounded font-mono">
                {myTasks.length} pending
              </span>
            </h3>

            {myTasks.length === 0 ? (
              <div className="text-sm text-[var(--text-secondary)] leading-relaxed italic p-6 border border-dashed border-[var(--border-soft)] rounded-lg text-center">
                Welcome onboard! No tasks have been assigned to you yet. Explore the project documentation in the meantime.
              </div>
            ) : (
              <div className="space-y-3">
                {myTasks.map(task => (
                  <div 
                    key={task.id} 
                    className="flex items-start justify-between p-3.5 bg-black/20 border border-[var(--border-soft)] rounded-lg hover:border-indigo-500/30 transition-colors"
                  >
                    <div>
                      <div className="font-semibold text-sm text-white hover:underline cursor-pointer" onClick={() => {
                        window.history.pushState(null, '', `/projects/${task.project_id}/board`);
                        window.dispatchEvent(new CustomEvent('popstate'));
                      }}>
                        {task.name}
                      </div>
                      <div className="text-[11px] text-[var(--text-secondary)] mt-1 max-w-xl truncate">
                        {task.description || 'No description provided.'}
                      </div>
                    </div>
                    <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wide bg-amber-500/10 text-amber-400 border border-amber-500/20">
                      {task.status}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Card 4: Active Projects */}
          <div className="bg-[#1f2937]/50 border border-[var(--border-soft)] rounded-xl p-5 backdrop-blur-sm shadow-md">
            <h3 className="text-xs font-mono uppercase tracking-widest text-[var(--text-secondary)] mb-4 flex items-center gap-2">
              <Briefcase className="w-4 h-4 text-indigo-400" />
              Active Projects
            </h3>

            {displayProjects.length === 0 ? (
              <div className="text-sm text-[var(--text-secondary)] leading-relaxed italic p-6 border border-dashed border-[var(--border-soft)] rounded-lg text-center">
                No active projects listed in this workspace currently.
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
                    className="p-4 bg-black/20 border border-[var(--border-soft)] rounded-lg hover:border-indigo-500/30 transition-all cursor-pointer group"
                  >
                    <div className="flex items-center justify-between mb-2">
                      <span className="font-bold text-sm text-white group-hover:text-indigo-400 transition-colors">
                        {proj.name}
                      </span>
                      <ArrowRight className="w-4 h-4 text-[var(--text-secondary)] group-hover:text-indigo-400 group-hover:translate-x-1 transition-all" />
                    </div>
                    <p className="text-xs text-[var(--text-secondary)] line-clamp-2 mb-3">
                      {proj.description || 'No project description available.'}
                    </p>
                    <div className="flex items-center justify-between text-[10px] font-mono text-[var(--text-secondary)]">
                      <span>Lane Mode: {proj.execution_mode || 'Standard'}</span>
                      <span className="capitalize">{proj.status}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Card 5: Teammates / People You Work With */}
            <div className="bg-[#1f2937]/50 border border-[var(--border-soft)] rounded-xl p-5 backdrop-blur-sm shadow-md flex flex-col h-[380px]">
              <h3 className="text-xs font-mono uppercase tracking-widest text-[var(--text-secondary)] mb-4 flex items-center gap-2">
                <Users className="w-4 h-4 text-indigo-400" />
                People You Work With
              </h3>

              <div className="flex-1 overflow-y-auto space-y-3 pr-1 scrollbar-premium">
                {(teammates.length > 0 ? teammates : fallbackContacts).map(person => (
                  <div key={person.id} className="flex items-center justify-between p-2.5 bg-black/10 border border-[var(--border-soft)] rounded-lg hover:bg-black/20 transition-colors">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-purple-500/10 border border-purple-500/20 flex items-center justify-center font-bold text-xs text-purple-400">
                        {(person.full_name || person.email).split(' ').map((n: string) => n[0]).join('').slice(0, 2).toUpperCase()}
                      </div>
                      <div>
                        <div className="text-xs font-semibold text-white">{person.full_name || 'Colleague'}</div>
                        <div className="text-[10px] text-[var(--text-secondary)] font-mono truncate max-w-[140px]">{person.email}</div>
                      </div>
                    </div>
                    <span className="text-[9px] uppercase tracking-wider text-[var(--text-secondary)] bg-surface-3 px-2 py-0.5 rounded border border-border">
                      {person.role === 'pm' ? 'PM' : person.role === 'super_admin' ? 'Admin' : 'Dev'}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Card 6: Important Documents */}
            <div className="bg-[#1f2937]/50 border border-[var(--border-soft)] rounded-xl p-5 backdrop-blur-sm shadow-md flex flex-col h-[380px]">
              <h3 className="text-xs font-mono uppercase tracking-widest text-[var(--text-secondary)] mb-4 flex items-center gap-2">
                <FileText className="w-4 h-4 text-indigo-400" />
                Important Company Docs
              </h3>

              <div className="flex-1 overflow-y-auto space-y-3 pr-1 scrollbar-premium">
                {loadingDocs ? (
                  <div className="flex justify-center py-8">
                    <div className="animate-spin w-5 h-5 border-2 border-indigo-500 border-t-transparent rounded-full" />
                  </div>
                ) : documents.length === 0 ? (
                  <div className="text-xs text-[var(--text-secondary)] leading-relaxed italic p-4 text-center border border-dashed border-[var(--border-soft)] rounded-lg">
                    No document references registered yet in the Workspace.
                  </div>
                ) : (
                  documents.map(doc => (
                    <a 
                      key={doc.id}
                      href={doc.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="block p-3 bg-black/10 border border-[var(--border-soft)] rounded-lg hover:border-indigo-500/30 hover:bg-black/20 transition-all group"
                    >
                      <div className="font-semibold text-xs text-white group-hover:text-indigo-400 transition-colors truncate">
                        {doc.title}
                      </div>
                      <div className="text-[9px] text-[var(--text-secondary)] font-mono mt-1 uppercase tracking-wide">
                        Type: {doc.type || 'link'}
                      </div>
                    </a>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
