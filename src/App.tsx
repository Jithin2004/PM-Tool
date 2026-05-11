import React, { useState, useEffect, useMemo } from 'react';
import { 
  Plus, 
  Settings, 
  BarChart3, 
  CheckCircle2, 
  Clock, 
  AlertCircle, 
  ChevronDown as ChevronDownIcon, 
  Trash2, 
  ArrowUp, 
  ArrowDown,
  Sparkles,
  Search,
  Filter,
  LayoutDashboard,
  Calendar,
  Activity,
  Users,
  ChevronRight,
  UserPlus,
  LogOut,
  Shield,
  User,
  ChevronDown,
  Briefcase,
  History,
  Info
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { supabase } from './lib/supabase';
import { Project, AppConfig, OverheadItem, Team, Developer, UserProfile, UserRole, AuditLog } from './types';
import { forecastProjects, calcProjectRealHours, calcHistoricalBias } from './utils/calculations';
import { estimateProjectHours } from './services/gemini';

export default function App() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [teams, setTeams] = useState<Team[]>([
    { 
      id: 'team-a', 
      name: 'Team Alpha', 
      capacityPerDay: 8, 
      developers: [
        { id: 'd1', name: 'Dev 1', efficiency: 1.2, level: 'senior' }
      ] 
    },
    { 
      id: 'team-b', 
      name: 'Team Beta', 
      capacityPerDay: 8, 
      developers: [
        { id: 'd2', name: 'Dev 2', efficiency: 1.0, level: 'mid' }
      ] 
    }
  ]);
  const [now, setNow] = useState(new Date());
  const [config, setConfig] = useState<AppConfig>({
    hoursPerDay: 8,
    defaultOverhead: 2.0,
    bufferPercent: 10,
    contextSwitchCost: 0.5,
    fatigueFactor: 0.85 
  });

  // Clock
  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);
  const [activeFilter, setActiveFilter] = useState<'all' | 'pending' | 'inprogress' | 'inreview' | 'done'>('all');
  const [teamFilter, setTeamFilter] = useState<string>('all');
  const [expandedCards, setExpandedCards] = useState<Set<number>>(new Set());
  const [currentUser, setCurrentUser] = useState<UserProfile | null>(null);
  const [viewingAsRole, setViewingAsRole] = useState<UserRole | null>(null);
  const [isNewModalOpen, setIsNewModalOpen] = useState(false);
  const [isConfigOpen, setIsConfigOpen] = useState(false);
  const [isTeamModalOpen, setIsTeamModalOpen] = useState(false);
  const [isAuditModalOpen, setIsAuditModalOpen] = useState(false);
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [syncStatus, setSyncStatus] = useState<'connecting' | 'live' | 'syncing' | 'error'>('connecting');

  // New Project Form State
  const [newProject, setNewProject] = useState<Partial<Project>>({
    name: '',
    client: '',
    status: 'inprogress',
    priority: 1,
    bestCaseHours: 6,
    expectedCaseHours: 8,
    worstCaseHours: 12,
    waitDays: 0,
    overhead: 2.0,
    startDate: new Date().toISOString().slice(0, 10),
    clientDeadline: new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10),
    overheadItems: []
  });

  const [isEstimating, setIsEstimating] = useState(false);

  // Fetch and Subscribe
  useEffect(() => {
    fetchProjects();
    fetchTeams();
    fetchAuditLogs();
    
    let channel: any;
    
    const setupSub = async () => {
      channel = supabase
        .channel('pm-live')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'projects' }, payload => {
          handleRealtimeEvent(payload);
        })
        .on('postgres_changes', { event: '*', schema: 'public', table: 'teams' }, payload => {
          handleTeamRealtimeEvent(payload);
        })
        .on('postgres_changes', { event: '*', schema: 'public', table: 'audit_logs' }, payload => {
          handleAuditRealtimeEvent(payload);
        })
        .subscribe(status => {
          if (status === 'SUBSCRIBED') setSyncStatus('live');
          else if (status === 'CLOSED' || status === 'CHANNEL_ERROR') setSyncStatus('error');
        });
    };

    setupSub();

    return () => {
      if (channel) supabase.removeChannel(channel);
    };
  }, []);

  const fetchTeams = async () => {
    try {
      const { data, error } = await supabase.from('teams').select('*').order('id');
      if (error) throw error;
      if (data && data.length > 0) {
        setTeams(data.map(row => row.data as Team));
      }
    } catch (e) {
      console.error('Fetch teams error:', e);
    }
  };

  const handleTeamRealtimeEvent = (payload: any) => {
    const { eventType, new: newRow, old: oldRow } = payload;
    setTeams(current => {
      if (eventType === 'INSERT') {
        if (!current.find(t => t.id === newRow.data.id)) return [...current, newRow.data];
      } else if (eventType === 'UPDATE') {
        return current.map(t => t.id === newRow.data.id ? newRow.data : t);
      } else if (eventType === 'DELETE') {
        return current.filter(t => t.id !== oldRow.id);
      }
      return current;
    });
  };

  const handleAuditRealtimeEvent = (payload: any) => {
    const { eventType, new: newRow } = payload;
    if (eventType === 'INSERT') {
      setAuditLogs(current => [newRow.data, ...current].slice(0, 50));
    }
  };

  const fetchAuditLogs = async () => {
    try {
      const { data, error } = await supabase.from('audit_logs').select('*').order('timestamp', { ascending: false }).limit(50);
      if (error) throw error;
      if (data) setAuditLogs(data.map(row => row.data as AuditLog));
    } catch (e) {
      console.error('Fetch audit logs error:', e);
    }
  };

  const logAuditAction = async (action: string, targetId: string, targetName: string, details: any) => {
    if (!currentUser) return;
    const log: AuditLog = {
      id: `log-${Date.now()}`,
      userId: currentUser.id,
      userName: currentUser.name,
      userRole: currentUser.role,
      action,
      targetId,
      targetName,
      details: JSON.stringify(details),
      timestamp: new Date().toISOString()
    };
    
    try {
      await supabase.from('audit_logs').insert({ 
        id: log.id, 
        data: log, 
        timestamp: log.timestamp 
      });
    } catch (e) {
      console.error('Log audit error:', e);
    }
  };

  const saveTeam = async (t: Team, isNew = false) => {
    setSyncStatus('syncing');
    try {
      const { error } = await supabase.from('teams').upsert({ 
        id: t.id, 
        data: t, 
        updated_at: new Date().toISOString() 
      });
      if (error) throw error;
      setSyncStatus('live');
      await logAuditAction(isNew ? 'team_created' : 'team_updated', t.id, t.name, { team: t });
    } catch (e) {
      console.error('Save team error:', e);
      setSyncStatus('error');
    }
  };

  const deleteTeamFromDB = async (team: Team) => {
    setSyncStatus('syncing');
    try {
      const { error } = await supabase.from('teams').delete().eq('id', team.id);
      if (error) throw error;
      setSyncStatus('live');
      await logAuditAction('team_deleted', team.id, team.name, { team });
    } catch (e) {
      console.error('Delete team error:', e);
      setSyncStatus('error');
    }
  };

  const historicalBias = useMemo(() => calcHistoricalBias(projects), [projects]);

  const fetchProjects = async () => {
    setIsLoading(true);
    setSyncStatus('connecting');
    try {
      const { data, error } = await supabase.from('projects').select('*').order('id');
      if (error) throw error;
      const loadedProjects = (data || []).map(row => row.data as Project);
      setProjects(loadedProjects);
      setSyncStatus('live');
    } catch (e) {
      console.error(e);
      setSyncStatus('error');
    } finally {
      setIsLoading(false);
    }
  };

  const handleRealtimeEvent = (payload: any) => {
    const { eventType, new: newRow, old: oldRow } = payload;
    setProjects(current => {
      if (eventType === 'INSERT') {
        if (!current.find(p => p.id === newRow.data.id)) {
          return [...current, newRow.data];
        }
      } else if (eventType === 'UPDATE') {
        return current.map(p => p.id === newRow.data.id ? newRow.data : p);
      } else if (eventType === 'DELETE') {
        return current.filter(p => p.id !== oldRow.id);
      }
      return current;
    });
  };

  const saveProject = async (p: Project, isNew = false) => {
    setSyncStatus('syncing');
    try {
      const { error } = await supabase.from('projects').upsert({ 
        id: p.id, 
        data: p, 
        updated_at: new Date().toISOString() 
      });
      if (error) throw error;
      setSyncStatus('live');
      await logAuditAction(isNew ? 'project_created' : 'project_updated', p.id.toString(), p.name, { status: p.status, teamId: p.teamId });
    } catch (e) {
      console.error('Save error:', e);
      setSyncStatus('error');
    }
  };

  const deleteProjectFromDB = async (project: Project) => {
    setSyncStatus('syncing');
    try {
      const { error } = await supabase.from('projects').delete().eq('id', project.id);
      if (error) throw error;
      setSyncStatus('live');
      await logAuditAction('project_deleted', project.id.toString(), project.name, { project });
    } catch (e) {
      console.error('Delete error:', e);
      setSyncStatus('error');
    }
  };

  // Forecasted Projects
  const forecastedProjects = useMemo(() => {
    return forecastProjects(projects, config);
  }, [projects, config]);

  const stats = useMemo(() => {
    const active = forecastedProjects.filter(p => p.status !== 'done');
    const totalHours = active.reduce((s, p) => s + calcProjectRealHours(p, config), 0);
    return {
      active: active.filter(p => p.status === 'inprogress').length,
      pending: active.filter(p => p.status === 'pending').length,
      review: active.filter(p => p.status === 'inreview').length,
      done: forecastedProjects.filter(p => p.status === 'done').length,
      atRisk: active.filter(p => p.health === 'late' || p.health === 'risk').length,
      totalHours,
      totalDays: totalHours / config.hoursPerDay
    };
  }, [forecastedProjects, config]);

  const filteredProjects = useMemo(() => {
    let filtered = activeFilter === 'all' 
      ? forecastedProjects 
      : forecastedProjects.filter(p => p.status === activeFilter);
      
    if (teamFilter !== 'all') {
      filtered = filtered.filter(p => p.teamId === teamFilter);
    }
    
    return [...filtered].sort((a, b) => a.priority - b.priority || a.id - b.id);
  }, [forecastedProjects, activeFilter, teamFilter]);

  const toggleCard = (id: number) => {
    const next = new Set(expandedCards);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setExpandedCards(next);
  };

  const handleAIEstimate = async () => {
    if (!newProject.name) return;
    setIsEstimating(true);
    const estimate = await estimateProjectHours(newProject.name || '', newProject.description || '');
    setNewProject(prev => ({ 
      ...prev, 
      expectedCaseHours: estimate,
      bestCaseHours: Math.round(estimate * 0.75),
      worstCaseHours: Math.round(estimate * 1.5)
    }));
    setIsEstimating(false);
  };

  const handleSubmitNewProject = async () => {
    if (!newProject.name) return;
    const id = Date.now();
    
    // Team Recommendation Logic
    const recommendedTeam = teamRecommendations[0]?.teamId || 'team-a';

    const p: Project = {
      ...newProject as Project,
      id,
      teamId: newProject.teamId || recommendedTeam,
      addedOn: new Date().toISOString(),
      health: 'ok',
      predictedEnd: '',
      predictedStart: '',
      delayDays: 0,
    };
    setProjects(prev => [...prev, p]);
    setIsNewModalOpen(false);
    setExpandedCards(prev => new Set(prev).add(id));
    await saveProject(p, true);
  };

  const teamRecommendations = useMemo(() => {
    return teams.map(team => {
      const teamProjects = forecastedProjects.filter(p => p.teamId === team.id && p.status !== 'done');
      const totalLoad = teamProjects.reduce((s, p) => s + calcProjectRealHours(p, config), 0);
      const atRiskCount = teamProjects.filter(p => p.health === 'late' || p.health === 'risk').length;
      
      const lastProject = [...teamProjects].sort((a,b) => new Date(b.predictedEnd).getTime() - new Date(a.predictedEnd).getTime())[0];
      const freeDate = lastProject ? lastProject.predictedEnd : new Date().toISOString().slice(0, 10);

      return {
        teamId: team.id,
        teamName: team.name,
        load: totalLoad,
        risk: atRiskCount,
        freeDate
      };
    }).sort((a, b) => {
      // Prioritize earliest free date, then lowest load, then lowest risk
      if (a.freeDate !== b.freeDate) return new Date(a.freeDate).getTime() - new Date(b.freeDate).getTime();
      if (a.load !== b.load) return a.load - b.load;
      return a.risk - b.risk;
    });
  }, [teams, forecastedProjects, config]);

  const updateProjectField = async (id: number, field: keyof Project, value: any) => {
    const p = projects.find(p => p.id === id);
    if (!p) return;
    const updated = { ...p, [field]: value };
    setProjects(prev => prev.map(item => item.id === id ? updated : item));
    await saveProject(updated, false);
  };

  // Auto-login user from metadata if possible
  useEffect(() => {
    const mockUser: UserProfile = {
      id: 'admin-1',
      email: 'jithinragesh@gmail.com',
      name: 'Jithin Ragesh',
      role: 'admin',
      avatar: 'https://ui-avatars.com/api/?name=Jithin+Ragesh&background=f97316&color=fff'
    };
    setCurrentUser(mockUser);
    setViewingAsRole('admin');
  }, []);

  if (!currentUser) {
    return (
      <div className="min-h-screen bg-[#0f0e0d] flex items-center justify-center p-6 text-[#f0ede8]">
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="w-full max-w-md bg-[#1a1917] border border-[#333130] rounded-3xl p-8 space-y-8 text-center"
        >
          <div className="flex flex-col items-center gap-4">
            <div className="w-16 h-16 rounded-2xl bg-orange-600 flex items-center justify-center shadow-2xl shadow-orange-600/20">
              <span className="text-3xl font-serif font-black text-[#0f0e0d]">R</span>
            </div>
            <div>
              <h1 className="text-2xl font-bold font-serif tracking-tight">RESOLVE PM</h1>
              <p className="text-xs text-[#5a5650] font-mono uppercase tracking-widest mt-1">High-Fidelity Engineering</p>
            </div>
          </div>

          <div className="space-y-4">
            <button 
              onClick={() => {
                setCurrentUser({
                  id: 'admin-1',
                  email: 'jithinragesh@gmail.com',
                  name: 'Jithin Ragesh',
                  role: 'admin'
                });
                setViewingAsRole('admin');
              }}
              className="w-full bg-white text-black font-bold py-3 rounded-xl hover:bg-[#e0e0e0] transition-colors"
            >
              Sign in with Google
            </button>
            <p className="text-[10px] text-[#5a5650] px-4">
              By continuing, you agree to Resolve's predictive modeling terms and data privacy shield.
            </p>
          </div>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0f0e0d] text-[#f0ede8] font-sans">
      {/* Sync Status Banner */}
      {syncStatus === 'error' && (
        <div className="bg-red-500/10 border-b border-red-500/20 py-2 px-4 text-center text-red-500 text-xs font-mono">
          ⚠️ Connection lost — changes will not sync until reconnected.
        </div>
      )}

      {/* Header */}
      <header className="sticky top-0 z-50 bg-[#0f0e0d]/80 backdrop-blur-xl border-b border-[#333130] px-6 py-4">
        <div className="max-w-[1800px] mx-auto w-full flex items-center justify-between">
          <div className="flex flex-col">
            <div className="flex items-baseline gap-3">
              <h1 className="text-xl font-bold font-serif tracking-tight text-white">RESOLVE</h1>
              <span className="text-[10px] font-mono text-orange-500 font-medium px-1.5 py-0.5 border border-orange-500/20 rounded bg-orange-500/5">v4.0 PRÉCISION</span>
            </div>
            <div className="text-[10px] font-mono text-[#5a5650] mt-0.5 uppercase tracking-widest">
              {now.toLocaleDateString(undefined, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })} • {now.toLocaleTimeString()}
            </div>
          </div>

          <div className="flex items-center gap-6">
            <div className="flex items-center gap-2 text-[10px] font-mono text-[#5a5650]">
              <div className={`w-2 h-2 rounded-full ${
                syncStatus === 'live' ? 'bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.4)]' : 
                syncStatus === 'syncing' ? 'bg-amber-500 animate-pulse' : 'bg-[#5a5650]'
              }`} />
              {syncStatus}
            </div>
            
            <div className="hidden md:flex items-center gap-1 text-[11px] font-mono text-[#5a5650]">
              {config.hoursPerDay}h/day · ×{config.defaultOverhead}
            </div>

            <div className="flex items-center gap-4 pl-4 border-l border-[#333130] ml-2">
              <div className="flex bg-[#0f0e0d] p-1 rounded-xl border border-[#333130]">
                <button 
                  onClick={() => setViewingAsRole('admin')}
                  className={`px-3 py-1 rounded-lg text-[10px] font-mono uppercase tracking-widest transition-all ${viewingAsRole === 'admin' ? 'bg-orange-600 text-white shadow-lg shadow-orange-600/20' : 'text-[#5a5650] hover:text-[#9e9890]'}`}
                >
                  Admin
                </button>
                <button 
                  onClick={() => setViewingAsRole('pm')}
                  className={`px-3 py-1 rounded-lg text-[10px] font-mono uppercase tracking-widest transition-all ${viewingAsRole === 'pm' ? 'bg-orange-600 text-white shadow-lg shadow-orange-600/20' : 'text-[#5a5650] hover:text-[#9e9890]'}`}
                >
                  PM/Lead
                </button>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <button 
                onClick={() => setIsTeamModalOpen(true)}
                className="p-2 hover:bg-[#1a1917] rounded-lg transition-colors text-[#9e9890] hover:text-[#f0ede8] flex items-center gap-2"
                title="Team Management"
              >
                <Users size={18} />
                <span className="text-[11px] font-mono uppercase hidden lg:block">Team/Users</span>
              </button>
              
              <div className="relative group">
                <button className="flex items-center gap-3 p-1 pl-3 bg-[#1a1917] border border-[#333130] rounded-xl hover:border-[#5a5650] transition-all">
                  <div className="flex flex-col items-end">
                    <span className="text-[11px] font-bold text-white">{currentUser.name}</span>
                    <span className="text-[9px] font-mono text-orange-500 uppercase tracking-tighter">{currentUser.role} View</span>
                  </div>
                  <div className="w-8 h-8 rounded-lg overflow-hidden bg-orange-600/20 flex items-center justify-center">
                    <img src={currentUser.avatar} alt="" className="w-full h-full object-cover" />
                  </div>
                  <ChevronDown size={14} className="text-[#5a5650] mr-2" />
                </button>
                
                <div className="absolute right-0 top-full mt-2 w-48 bg-[#1e1c1a] border border-[#333130] rounded-2xl shadow-2xl py-2 opacity-0 group-hover:opacity-100 pointer-events-none group-hover:pointer-events-auto transition-all translate-y-2 group-hover:translate-y-0 z-[100]">
                  <div className="px-4 py-2 border-b border-[#333130] mb-2">
                    <p className="text-[10px] font-mono text-[#5a5650] uppercase">Logged in as</p>
                    <p className="text-xs font-medium truncate">{currentUser.email}</p>
                  </div>
                  <button 
                    onClick={() => setIsProfileModalOpen(true)}
                    className="w-full flex items-center gap-2 px-4 py-2 text-xs hover:bg-[#2a2826] text-[#9e9890] transition-colors"
                  >
                    <User size={14} />
                    Profile Settings
                  </button>
                  <button 
                    onClick={() => setIsAuditModalOpen(true)}
                    className="w-full flex items-center gap-2 px-4 py-2 text-xs hover:bg-[#2a2826] text-[#9e9890] transition-colors"
                  >
                    <Shield size={14} />
                    Audit Logs
                  </button>
                  <button 
                    onClick={() => setCurrentUser(null)}
                    className="w-full flex items-center gap-2 px-4 py-2 text-xs hover:bg-red-500/10 text-red-500 transition-colors mt-2 border-t border-[#333130]"
                  >
                    <LogOut size={14} />
                    Sign Out
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-[1800px] mx-auto grid grid-cols-1 lg:grid-cols-[300px_1fr] gap-0">
        {/* Sidebar */}
        <aside className="border-r border-[#333130] p-6 space-y-8 bg-[#0a0a0a]">
          {/* Stats Section */}
          <section className="space-y-4">
            <div className="text-[10px] font-mono uppercase tracking-[0.15em] text-[#5a5650] px-1">Global Load</div>
            <div className="grid gap-2">
              <div className="bg-[#1a1917] border border-[#333130] p-4 rounded-xl flex items-center justify-between group hover:border-[#444240] transition-colors">
                <div className="space-y-1">
                  <div className="text-[10px] text-[#9e9890] font-mono">Total Hours</div>
                  <div className="text-xl font-bold font-mono text-orange-500">{stats.totalHours.toFixed(1)}h</div>
                </div>
                <Activity size={20} className="text-[#333130] group-hover:text-orange-500/50 transition-colors" />
              </div>
              <div className="bg-[#1a1917] border border-[#333130] p-4 rounded-xl flex items-center justify-between group hover:border-[#444240] transition-colors">
                <div className="space-y-1">
                  <div className="text-[10px] text-[#9e9890] font-mono">Working Days</div>
                  <div className="text-xl font-bold font-mono">{stats.totalDays.toFixed(1)}d</div>
                </div>
                <Calendar size={20} className="text-[#333130] group-hover:text-[#50a0fa]/50 transition-colors" />
              </div>
            </div>
          </section>

          {/* Overview Section */}
          <section className="space-y-4">
            <div className="text-[10px] font-mono uppercase tracking-[0.15em] text-[#5a5650] px-1">Overview</div>
            <div className="space-y-2">
              <StatPill label="Active" value={stats.active} active />
              <StatPill label="In Review" value={stats.review} />
              <StatPill label="Pending" value={stats.pending} />
              <StatPill label="Completed" value={stats.done} />
              <StatPill label="At Risk" value={stats.atRisk} danger={stats.atRisk > 0} />
            </div>
          </section>

          {/* AI Insights Section */}
          <section className="bg-orange-500/5 border border-orange-500/10 rounded-xl p-4 space-y-3">
            <div className="flex items-center gap-2 text-orange-500">
              <Sparkles size={14} />
              <span className="text-[10px] font-bold uppercase tracking-wider">AI Insights</span>
            </div>
            <p className="text-[11px] text-[#9e9890] leading-relaxed italic">
              "You are currently at {stats.totalDays > 10 ? 'high' : 'moderate'} load. Consider prioritizing 'In Review' items to unblock the pipeline."
            </p>
          </section>
        </aside>

        {/* Main Content */}
        <main className="p-8 space-y-8 bg-[#0f0e0d]">
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
            <div>
              <h2 className="text-3xl font-bold font-serif tracking-tight">Project Dashboard</h2>
              <p className="text-[#9e9890] text-sm mt-2">Precision forecasting through engineering overhead modeling.</p>
            </div>

            {/* Config Panel (Inline for v3) */}
            <AnimatePresence>
              {isConfigOpen && (
                <motion.div 
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 10 }}
                  className="bg-[#1a1917] border border-[#333130] p-4 rounded-xl flex flex-wrap gap-6 shadow-2xl"
                >
                  <ConfigItem 
                    label="H/Day" 
                    value={config.hoursPerDay} 
                    onChange={v => setConfig(c => ({...c, hoursPerDay: parseFloat(v) || 8}))} 
                  />
                  <ConfigItem 
                    label="Default OH" 
                    asSelect
                    value={config.defaultOverhead} 
                    onChange={v => setConfig(c => ({...c, defaultOverhead: parseFloat(v) || 2}))}
                    options={[
                      { label: 'Low ×1.3', value: 1.3 },
                      { label: 'Med ×1.6', value: 1.6 },
                      { label: 'High ×2.0', value: 2.0 },
                      { label: 'Max ×2.5', value: 2.5 },
                    ]}
                  />
                  <ConfigItem 
                    label="Buffer %" 
                    value={config.bufferPercent} 
                    onChange={v => setConfig(c => ({...c, bufferPercent: parseFloat(v) || 0}))} 
                  />
                  <ConfigItem 
                    label="Switch Cost (H)" 
                    value={config.contextSwitchCost} 
                    onChange={v => setConfig(c => ({...c, contextSwitchCost: parseFloat(v) || 0}))} 
                  />
                  <ConfigItem 
                    label="Fatigue Dec" 
                    value={config.fatigueFactor} 
                    onChange={v => setConfig(c => ({...c, fatigueFactor: parseFloat(v) || 1}))} 
                  />
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Filters */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-[#333130] pb-1">
            <div className="flex items-center gap-2 flex-wrap">
              <FilterBtn active={activeFilter === 'all'} onClick={() => setActiveFilter('all')}>All</FilterBtn>
              <FilterBtn active={activeFilter === 'inprogress'} onClick={() => setActiveFilter('inprogress')}>Progress</FilterBtn>
              <FilterBtn active={activeFilter === 'inreview'} onClick={() => setActiveFilter('inreview')}>Review</FilterBtn>
              <FilterBtn active={activeFilter === 'pending'} onClick={() => setActiveFilter('pending')}>Pending</FilterBtn>
              <FilterBtn active={activeFilter === 'done'} onClick={() => setActiveFilter('done')}>Done</FilterBtn>
            </div>
            
            <div className="flex items-center gap-3 px-4 py-2 border-l border-[#333130]">
              <span className="text-[10px] font-mono text-[#5a5650] uppercase tracking-wider">Team</span>
              <select 
                value={teamFilter}
                onChange={e => setTeamFilter(e.target.value)}
                className="bg-[#1a1917] border border-[#333130] rounded-lg px-3 py-1 text-xs focus:border-orange-500 outline-none text-[#9e9890]"
              >
                <option value="all">Entire Org</option>
                {teams.map(t => (
                  <option key={t.id} value={t.id}>{t.name}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Projects Grid Container */}
          <div className="grid grid-cols-1 xl:grid-cols-12 gap-8 items-start">
            <div className="xl:col-span-8 flex flex-col gap-3">
              <AnimatePresence mode="popLayout">
                {isLoading ? (
                  <motion.div key="loading" className="py-20 flex flex-col items-center justify-center gap-4 text-[#5a5650]">
                    <div className="w-8 h-8 border-2 border-orange-500/20 border-t-orange-500 rounded-full animate-spin" />
                    <span className="text-sm font-mono tracking-widest uppercase">Initializing RESOLVE...</span>
                  </motion.div>
                ) : filteredProjects.length === 0 ? (
                  <motion.div key="empty" className="py-20 text-center border-2 border-dashed border-[#1a1917] rounded-3xl">
                    <div className="text-4xl mb-4 opacity-20">📋</div>
                    <h3 className="text-lg font-bold text-[#9e9890]">No projects found</h3>
                    <p className="text-[#5a5650] text-sm">Try a different filter or create a new project.</p>
                  </motion.div>
                ) : (
                  filteredProjects.map((p, idx) => (
                    <ProjectCard 
                      key={p.id} 
                      project={p} 
                      index={idx}
                      isExpanded={expandedCards.has(p.id)}
                      onToggle={() => toggleCard(p.id)}
                      onUpdate={(field, val) => updateProjectField(p.id, field, val)}
                      onDelete={() => deleteProjectFromDB(p)}
                      config={config}
                      teams={teams}
                    />
                  ))
                )}
              </AnimatePresence>
            </div>

            {/* V3 Insights Sidebar */}
            <div className="xl:col-span-4 sticky top-32 space-y-6">
              <div className="bg-[#1a1917] border border-[#333130] rounded-2xl p-6 space-y-6">
                <div className="flex items-center gap-2 text-xs font-mono text-orange-500 uppercase tracking-widest">
                  <Activity size={14} />
                  <span>{viewingAsRole === 'admin' ? 'Strategic Portfolio Monitor' : 'Predictive Execution Monitor'}</span>
                </div>
                
                <div className="space-y-6">
                  <div className="space-y-2">
                    <div className="flex justify-between text-[10px] font-mono text-[#5a5650] uppercase">
                      <span>{viewingAsRole === 'admin' ? 'Portfolio Confidence' : 'Squad Delivery Confidence'}</span>
                      <span className="text-green-500">{Math.round((filteredProjects.filter(p => p.health === 'ok').length / (filteredProjects.length || 1)) * 100)}%</span>
                    </div>
                    <div className="h-1 bg-[#0f0e0d] rounded-full overflow-hidden">
                      <motion.div 
                        initial={{ width: 0 }}
                        animate={{ width: `${(filteredProjects.filter(p => p.health === 'ok').length / (filteredProjects.length || 1)) * 100}%` }}
                        className="h-full bg-green-500"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="p-3 bg-[#0f0e0d] rounded-xl border border-[#333130] space-y-1">
                      <div className="text-[10px] text-[#5a5650] font-mono uppercase">Load</div>
                      <div className="text-lg font-mono text-white">{(filteredProjects.reduce((s, p) => s + calcProjectRealHours(p, config), 0)).toFixed(0)}h</div>
                    </div>
                    <div className="p-3 bg-[#0f0e0d] rounded-xl border border-[#333130] space-y-1">
                      <div className="text-[10px] text-[#5a5650] font-mono uppercase">Wait</div>
                      <div className="text-lg font-mono text-orange-500">{(filteredProjects.reduce((s, p) => s + (p.waitDays || 0), 0))}d</div>
                    </div>
                  </div>

                  <div className="space-y-3 pt-2">
                    <div className="text-[10px] text-[#5a5650] font-mono uppercase tracking-widest px-1">Dynamics Monitor</div>
                    <div className="space-y-2.5">
                      <InsightRow label="Historical Bias" value={`${historicalBias.toFixed(2)}x (Auto)`} />
                      <InsightRow label="Max-Days Slip" value={`${Math.max(0, ...filteredProjects.map(p => p.delayDays))}d`} />
                      <InsightRow label="Cognitive Cost" value={`High (LogScale)`} />
                      <InsightRow label="Fatigue Factor" value={`${config.fatigueFactor}`} />
                    </div>
                  </div>
                </div>

                <div className="pt-4 border-t border-[#333130]">
                  <p className="text-[10px] text-[#5a5650] leading-relaxed italic">
                    Forecast precision is adjusted automatically based on team allocation and daily energy decay models.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </main>
      </div>

      {/* New Project Modal */}
      <AnimatePresence>
        {isNewModalOpen && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 pb-20 md:pb-6">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsNewModalOpen(false)}
              className="absolute inset-0 bg-black/60 backdrop-blur-md"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative w-full max-w-xl bg-[#1e1c1a] border border-[#333130] rounded-3xl p-8 shadow-2xl overflow-y-auto max-h-[90vh]"
            >
              <div className="flex items-center justify-between mb-8">
                <div>
                  <h3 className="text-2xl font-bold font-serif tracking-tight">Add New Project</h3>
                  <p className="text-sm text-[#9e9890] mt-1">AI-assisted estimation for v3 precision.</p>
                </div>
                <div className="p-3 bg-orange-500/10 rounded-2xl text-orange-500">
                  <LayoutDashboard size={24} />
                </div>
              </div>

              <div className="space-y-6">
                <div className="space-y-2">
                  <label className="text-[10px] font-mono uppercase text-[#5a5650] px-1">Identity</label>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <input 
                      type="text" 
                      placeholder="Project Name *"
                      className="w-full bg-[#0f0e0d] border border-[#333130] rounded-xl px-4 py-3 focus:outline-none focus:border-orange-500 text-sm"
                      value={newProject.name}
                      onChange={e => setNewProject({...newProject, name: e.target.value})}
                    />
                    <input 
                      type="text" 
                      placeholder="Stakeholder / Client"
                      className="w-full bg-[#0f0e0d] border border-[#333130] rounded-xl px-4 py-3 focus:outline-none focus:border-orange-500 text-sm"
                      value={newProject.client}
                      onChange={e => setNewProject({...newProject, client: e.target.value})}
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] font-mono uppercase text-[#5a5650] px-1">Description</label>
                  <textarea 
                    placeholder="Briefly describe the scope for better AI estimation..."
                    className="w-full bg-[#0f0e0d] border border-[#333130] rounded-xl px-4 py-3 focus:outline-none focus:border-orange-500 text-sm min-h-[80px]"
                    value={newProject.description}
                    onChange={e => setNewProject({...newProject, description: e.target.value})}
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] font-mono uppercase text-[#5a5650] px-1 flex justify-between">
                    <span>Capability</span>
                    {newProject.name && (
                      <button 
                        onClick={handleAIEstimate}
                        disabled={isEstimating}
                        className="flex items-center gap-1 text-orange-500 hover:text-orange-400 transition-colors disabled:opacity-50"
                      >
                        {isEstimating ? 'Estimating...' : (
                          <>
                            <Sparkles size={10} />
                            <span>AI Estimate</span>
                          </>
                        )}
                      </button>
                    )}
                  </label>
                  <div className="grid grid-cols-3 gap-3">
                    <div className="bg-[#0f0e0d] border border-[#333130] rounded-xl px-4 py-2">
                      <label className="text-[10px] text-[#5a5650] font-mono block">Best</label>
                      <input 
                        type="number" 
                        className="w-full bg-transparent py-1 focus:outline-none text-sm font-mono text-green-500"
                        value={newProject.bestCaseHours}
                        onChange={e => setNewProject({...newProject, bestCaseHours: parseFloat(e.target.value) || 0})}
                      />
                    </div>
                    <div className="bg-[#0f0e0d] border border-[#333130] rounded-xl px-4 py-2">
                      <label className="text-[10px] text-[#5a5650] font-mono block">Expected</label>
                      <input 
                        type="number" 
                        className="w-full bg-transparent py-1 focus:outline-none text-sm font-mono text-orange-500"
                        value={newProject.expectedCaseHours}
                        onChange={e => setNewProject({...newProject, expectedCaseHours: parseFloat(e.target.value) || 0})}
                      />
                    </div>
                    <div className="bg-[#0f0e0d] border border-[#333130] rounded-xl px-4 py-2">
                      <label className="text-[10px] text-[#5a5650] font-mono block">Worst</label>
                      <input 
                        type="number" 
                        className="w-full bg-transparent py-1 focus:outline-none text-sm font-mono text-red-500"
                        value={newProject.worstCaseHours}
                        onChange={e => setNewProject({...newProject, worstCaseHours: parseFloat(e.target.value) || 0})}
                      />
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-[10px] font-mono uppercase text-[#5a5650] px-1">Wait Days</label>
                    <input 
                      type="number" 
                      placeholder="e.g. 2 days for approval"
                      className="w-full bg-[#0f0e0d] border border-[#333130] rounded-xl px-4 py-3 focus:outline-none focus:border-orange-500 text-sm font-mono"
                      value={newProject.waitDays}
                      onChange={e => setNewProject({...newProject, waitDays: parseInt(e.target.value) || 0})}
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-mono uppercase text-[#5a5650] px-1 flex justify-between">
                      <span>Assign Team</span>
                      <span className="text-green-500 lowercase">Recommendation: {teamRecommendations[0]?.teamName}</span>
                    </label>
                    <select 
                      className="w-full bg-[#0f0e0d] border border-[#333130] rounded-xl px-4 py-3 focus:outline-none focus:border-orange-500 text-sm"
                      value={newProject.teamId}
                      onChange={e => setNewProject({...newProject, teamId: e.target.value})}
                    >
                      <option value="">Recommended (AI Allocation)</option>
                      {teams.map(t => (
                        <option key={t.id} value={t.id}>{t.name}</option>
                      ))}
                    </select>
                    <div className="px-2 py-1">
                      <p className="text-[10px] text-[#5a5650] leading-tight">
                        Calculated based on earliest available date and current queue depth.
                      </p>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-[10px] font-mono uppercase text-[#5a5650] px-1">Start Date</label>
                    <input 
                      type="date" 
                      className="w-full bg-[#0f0e0d] border border-[#333130] rounded-xl px-4 py-3 focus:outline-none focus:border-orange-500 text-sm"
                      value={newProject.startDate}
                      onChange={e => setNewProject({...newProject, startDate: e.target.value})}
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-mono uppercase text-[#5a5650] px-1">Deadline</label>
                    <input 
                      type="date" 
                      className="w-full bg-[#0f0e0d] border border-[#333130] rounded-xl px-4 py-3 focus:outline-none focus:border-orange-500 text-sm"
                      value={newProject.clientDeadline}
                      onChange={e => setNewProject({...newProject, clientDeadline: e.target.value})}
                    />
                  </div>
                </div>
              </div>

              <div className="mt-10 flex gap-3">
                <button 
                  onClick={() => setIsNewModalOpen(false)}
                  className="flex-1 px-6 py-3 rounded-xl border border-[#333130] text-sm font-semibold hover:bg-[#1a1917] transition-colors"
                >
                  Cancel
                </button>
                <button 
                  onClick={handleSubmitNewProject}
                  disabled={!newProject.name}
                  className="flex-[2] bg-orange-600 hover:bg-orange-500 text-white px-6 py-3 rounded-xl text-sm font-semibold transition-all disabled:opacity-50 shadow-lg shadow-orange-600/20"
                >
                  Create Project →
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Team Management Modal */}
      <AnimatePresence>
        {isTeamModalOpen && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-6">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsTeamModalOpen(false)}
              className="absolute inset-0 bg-black/60 backdrop-blur-md"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative w-full max-w-4xl bg-[#1e1c1a] border border-[#333130] rounded-3xl p-8 shadow-2xl overflow-y-auto max-h-[90vh]"
            >
              <div className="flex items-center justify-between mb-8">
                <div>
                  <h3 className="text-2xl font-bold font-serif tracking-tight">Team Management</h3>
                  <p className="text-sm text-[#9e9890] mt-1">Configure teams and developer efficiency profiles.</p>
                </div>
                <button 
                  onClick={() => {
                    const newTeam: Team = {
                      id: `team-${Date.now()}`,
                      name: 'New Team',
                      capacityPerDay: 8,
                      developers: []
                    };
                    setTeams([...teams, newTeam]);
                    saveTeam(newTeam, true);
                  }}
                  className="bg-orange-600 hover:bg-orange-500 text-white px-4 py-2 rounded-xl text-xs font-bold uppercase tracking-widest flex items-center gap-2"
                >
                  <Plus size={14} />
                  <span>Add Team</span>
                </button>
              </div>

              <div className="flex flex-col gap-6">
                <div className="flex bg-[#0f0e0d] p-1 rounded-xl border border-[#333130] w-fit">
                  <button className="px-6 py-2 bg-orange-600 text-white rounded-lg text-xs font-bold uppercase tracking-widest">Teams</button>
                  <button className="px-6 py-2 text-[#5a5650] hover:text-[#9e9890] transition-colors text-xs font-bold uppercase tracking-widest">Users & Roles</button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {teams.map(team => (
                  <div key={team.id} className="bg-[#0f0e0d] border border-[#333130] rounded-2xl p-6 space-y-4">
                    <div className="flex justify-between items-start">
                      <div className="space-y-1">
                        <input 
                          type="text" 
                          value={team.name}
                          onChange={e => {
                            const updated = { ...team, name: e.target.value };
                            setTeams(teams.map(t => t.id === team.id ? updated : t));
                            saveTeam(updated, false);
                          }}
                          className="bg-transparent font-bold text-lg focus:outline-none focus:border-b border-[#333130] w-full"
                        />
                        <div className="text-[10px] font-mono text-[#5a5650] uppercase">Capacity: {team.capacityPerDay}h/day</div>
                      </div>
                      <button 
                        onClick={() => {
                          if (confirm('Delete this team?')) {
                            setTeams(teams.filter(t => t.id !== team.id));
                            deleteTeamFromDB(team);
                          }
                        }}
                        className="text-red-500/40 hover:text-red-500 p-1"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>

                    <div className="space-y-3">
                      <div className="flex justify-between items-center text-[10px] font-mono uppercase text-[#5a5650] border-b border-[#333130] pb-1">
                        <span>Developers</span>
                        <button 
                          onClick={() => {
                            const newDev: Developer = {
                              id: `dev-${Date.now()}`,
                              name: 'New Dev',
                              efficiency: 1.0,
                              level: 'mid'
                            };
                            const updated = { ...team, developers: [...team.developers, newDev] };
                            setTeams(teams.map(t => t.id === team.id ? updated : t));
                            saveTeam(updated, false);
                          }}
                          className="text-orange-500 hover:text-orange-400 flex items-center gap-1"
                        >
                          <UserPlus size={12} />
                          Add
                        </button>
                      </div>
                      
                      <div className="space-y-2">
                        {team.developers.map(dev => (
                          <div key={dev.id} className="flex items-center gap-3 bg-[#1a1917] p-2 rounded-lg border border-[#333130]/50 group">
                            <input 
                              type="text"
                              value={dev.name}
                              onChange={e => {
                                const updatedDevs = team.developers.map(d => d.id === dev.id ? { ...d, name: e.target.value } : d);
                                const updatedTeam = { ...team, developers: updatedDevs };
                                setTeams(teams.map(t => t.id === team.id ? updatedTeam : t));
                                saveTeam(updatedTeam, false);
                              }}
                              className="bg-transparent text-xs font-medium focus:outline-none flex-1"
                            />
                            <div className="flex items-center gap-2">
                              <span className="text-[10px] font-mono text-[#5a5650]">Eff:</span>
                              <input 
                                type="number"
                                step="0.1"
                                value={dev.efficiency}
                                onChange={e => {
                                  const updatedDevs = team.developers.map(d => d.id === dev.id ? { ...d, efficiency: parseFloat(e.target.value) || 1 } : d);
                                  const updatedTeam = { ...team, developers: updatedDevs };
                                  setTeams(teams.map(t => t.id === team.id ? updatedTeam : t));
                                  saveTeam(updatedTeam, false);
                                }}
                                className="w-10 bg-transparent text-[10px] font-mono text-orange-500 focus:outline-none"
                              />
                            </div>
                            <button 
                              onClick={() => {
                                const updatedDevs = team.developers.filter(d => d.id !== dev.id);
                                const updatedTeam = { ...team, developers: updatedDevs };
                                setTeams(teams.map(t => t.id === team.id ? updatedTeam : t));
                                saveTeam(updatedTeam, false);
                              }}
                              className="opacity-0 group-hover:opacity-100 text-red-500/40 hover:text-red-500 transition-opacity"
                            >
                              <Plus size={12} className="rotate-45" />
                            </button>
                          </div>
                        ))}
                        {team.developers.length === 0 && (
                          <div className="text-[10px] text-[#5a5650] italic text-center py-2">No developers assigned.</div>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
                </div>
              </div>

              <div className="mt-10 flex justify-end">
                <button 
                  onClick={() => setIsTeamModalOpen(false)}
                  className="px-8 py-3 bg-[#0f0e0d] border border-[#333130] rounded-xl text-sm font-semibold hover:bg-[#1a1917] transition-all"
                >
                  Close Manager
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Audit Logs Modal */}
      <AnimatePresence>
        {isAuditModalOpen && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-6">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsAuditModalOpen(false)}
              className="absolute inset-0 bg-black/60 backdrop-blur-md"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative w-full max-w-3xl bg-[#1e1c1a] border border-[#333130] rounded-3xl p-8 shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
            >
              <div className="flex items-center justify-between mb-8 shrink-0">
                <div>
                  <h3 className="text-2xl font-bold font-serif tracking-tight">System Audit Log</h3>
                  <p className="text-sm text-[#9e9890] mt-1">Immutable record of all project and team mutations.</p>
                </div>
                <button onClick={() => setIsAuditModalOpen(false)} className="p-2 hover:bg-[#333130] rounded-full">
                  <Plus size={20} className="rotate-45" />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto space-y-4 pr-2">
                {auditLogs.length === 0 ? (
                  <div className="py-20 text-center text-[#5a5650] font-mono uppercase text-xs tracking-widest">No logs recorded yet.</div>
                ) : (
                  auditLogs.map(log => (
                    <div key={log.id} className="bg-[#0f0e0d] border border-[#333130] rounded-2xl p-4 space-y-3">
                      <div className="flex items-start justify-between">
                        <div className="flex items-center gap-3">
                          <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                            log.action.includes('created') ? 'bg-green-500/10 text-green-400' :
                            log.action.includes('deleted') ? 'bg-red-500/10 text-red-500' : 'bg-orange-500/10 text-orange-500'
                          }`}>
                            <History size={16} />
                          </div>
                          <div>
                            <div className="text-xs font-bold font-serif">{log.userName} <span className="text-[#5a5650] font-sans font-normal lowercase">{(log.action as string).replace(/_/g, ' ')}</span> {log.targetName}</div>
                            <div className="text-[10px] font-mono text-[#5a5650]">{new Date(log.timestamp).toLocaleString()}</div>
                          </div>
                        </div>
                        <div className="text-[10px] font-mono px-2 py-0.5 rounded bg-[#1a1917] border border-[#333130] text-[#9e9890] uppercase">{log.userRole}</div>
                      </div>
                      <div className="bg-[#1a1917] p-3 rounded-xl border border-[#333130] text-[10px] font-mono text-[#9e9890] overflow-x-auto whitespace-pre">
                        {log.details}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Profile Modal */}
      <AnimatePresence>
        {isProfileModalOpen && currentUser && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-6">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsProfileModalOpen(false)}
              className="absolute inset-0 bg-black/60 backdrop-blur-md"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative w-full max-w-md bg-[#1e1c1a] border border-[#333130] rounded-3xl p-8 shadow-2xl"
            >
              <div className="flex flex-col items-center gap-6">
                <div className="relative group">
                  <div className="w-24 h-24 rounded-3xl overflow-hidden bg-orange-600/20 border-2 border-orange-500/20">
                    <img src={currentUser.avatar} alt="" className="w-full h-full object-cover" />
                  </div>
                  <button className="absolute -bottom-2 -right-2 p-2 bg-orange-600 rounded-xl border-4 border-[#1e1c1a] hover:bg-orange-500 transition-colors">
                    <Settings size={16} />
                  </button>
                </div>
                
                <div className="text-center space-y-1">
                  <h3 className="text-xl font-bold font-serif">{currentUser.name}</h3>
                  <p className="text-sm text-[#5a5650] font-mono">{currentUser.email}</p>
                </div>

                <div className="w-full grid grid-cols-2 gap-3 pb-4">
                  <div className="bg-[#0f0e0d] border border-[#333130] rounded-2xl p-4 text-center">
                    <div className="text-[10px] text-[#5a5650] font-mono uppercase mb-1">Assigned Role</div>
                    <div className="text-xs font-bold text-orange-500 uppercase tracking-widest">{currentUser.role}</div>
                  </div>
                  <div className="bg-[#0f0e0d] border border-[#333130] rounded-2xl p-4 text-center">
                    <div className="text-[10px] text-[#5a5650] font-mono uppercase mb-1">Activity Rank</div>
                    <div className="text-xs font-bold text-orange-500 uppercase tracking-widest">S-Tier PM</div>
                  </div>
                </div>

                <div className="w-full space-y-3">
                  <button className="w-full py-3 bg-[#333130] hover:bg-[#444240] rounded-xl text-xs font-bold uppercase tracking-widest transition-colors flex items-center justify-center gap-2">
                    <Info size={14} />
                    Account Preferences
                  </button>
                  <button 
                    onClick={() => setIsProfileModalOpen(false)}
                    className="w-full py-3 bg-white text-black hover:bg-white/90 rounded-xl text-xs font-bold uppercase tracking-widest transition-colors"
                  >
                    Done
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}

// Sub-components
function StatPill({ label, value, active, danger }: { label: string, value: number, active?: boolean, danger?: boolean }) {
  return (
    <div className={`p-3 rounded-xl border transition-all flex items-center justify-between ${
      active ? 'bg-orange-600/5 border-orange-600/20 text-orange-500' :
      danger ? 'bg-red-500/5 border-red-500/20 text-red-500' : 
      'bg-transparent border-[#1a1917] text-[#9e9890]'
    }`}>
      <span className="text-[11px] font-medium">{label}</span>
      <span className={`text-[12px] font-bold font-mono ${active || danger ? '' : 'text-[#f0ede8]'}`}>{value}</span>
    </div>
  );
}

function ConfigItem({ label, value, onChange, asSelect, options }: { label: string, value: any, onChange: (v: string) => void, asSelect?: boolean, options?: {label: string, value: any}[] }) {
  return (
    <div className="flex items-center gap-3">
      <span className="text-[10px] font-mono text-[#5a5650] uppercase tracking-wider">{label}</span>
      {asSelect ? (
        <select 
          className="bg-[#0f0e0d] border border-[#333130] rounded-lg px-2 py-1 text-xs focus:outline-none focus:border-orange-500"
          value={value}
          onChange={e => onChange(e.target.value)}
        >
          {options?.map(opt => <option key={opt.value} value={String(opt.value)}>{opt.label}</option>)}
        </select>
      ) : (
        <input 
          type="number"
          className="w-16 bg-[#0f0e0d] border border-[#333130] rounded-lg px-2 py-1 text-xs focus:outline-none focus:border-orange-500 text-orange-500 font-mono"
          value={value}
          onChange={e => onChange(e.target.value)}
        />
      )}
    </div>
  );
}

function FilterBtn({ children, active, onClick }: { children: React.ReactNode, active: boolean, onClick: () => void }) {
  return (
    <button 
      onClick={onClick}
      className={`px-4 py-2 text-[11px] font-mono uppercase tracking-[0.1em] transition-all relative ${
        active ? 'text-orange-500' : 'text-[#5a5650] hover:text-[#9e9890]'
      }`}
    >
      {children}
      {active && (
        <motion.div 
          layoutId="filter-pill"
          className="absolute bottom-0 left-0 right-0 h-0.5 bg-orange-500"
        />
      )}
    </button>
  );
}

function InsightRow({ label, value }: { label: string, value: string }) {
  return (
    <div className="flex justify-between items-center text-xs">
      <span className="text-[#5a5650]">{label}</span>
      <span className="font-mono text-[#9e9890]">{value}</span>
    </div>
  );
}

interface ProjectCardProps {
  key?: React.Key;
  project: Project;
  index: number;
  isExpanded: boolean;
  onToggle: () => void;
  onUpdate: (field: keyof Project, val: any) => void | Promise<void>;
  onDelete: () => void | Promise<void>;
  config: AppConfig;
  teams: Team[];
}

function ProjectCard({ project, index, isExpanded, onToggle, onUpdate, onDelete, config, teams }: ProjectCardProps) {
  const realH = calcProjectRealHours(project, config);
  const healthColors: Record<string, string> = {
    ok: 'text-green-500 bg-green-500/10 border-green-500/20 shadow-green-500/5',
    risk: 'text-amber-500 bg-amber-500/10 border-amber-500/20 shadow-amber-500/5',
    late: 'text-red-500 bg-red-500/10 border-red-500/20 shadow-red-500/5',
    done: 'text-[#5a5650] bg-[#1a1917] border-[#333130] shadow-none'
  };

  const statusLabels: Record<string, string> = {
    pending: 'Pending',
    inprogress: 'Progress',
    inreview: 'Review',
    done: 'Done'
  };

  // Timeline calc
  const start = new Date(project.startDate || project.addedOn);
  const end = new Date(project.predictedEnd || project.clientDeadline);
  const total = end.getTime() - start.getTime();
  const current = new Date().getTime() - start.getTime();
  const progress = total > 0 ? Math.min(100, Math.max(0, (current / total) * 100)) : 0;

  return (
    <motion.div 
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: index * 0.05 }}
      className={`group bg-[#1a1917] border rounded-2xl overflow-hidden transition-all duration-300 ${
        isExpanded ? 'border-[#444240] shadow-2xl ring-1 ring-orange-500/10' : 'border-[#333130] hover:border-[#444240]'
      }`}
    >
      {/* Card Header */}
      <div 
        className="px-6 py-5 cursor-pointer flex flex-col md:flex-row md:items-center justify-between gap-4"
        onClick={onToggle}
      >
        <div className="flex gap-4">
          <div className={`w-12 h-12 rounded-xl border flex items-center justify-center shrink-0 ${healthColors[project.health] || healthColors.ok}`}>
            {project.status === 'done' ? <CheckCircle2 size={24} /> : 
             project.health === 'late' ? <AlertCircle size={24} /> : <Clock size={24} />}
          </div>
          <div className="space-y-1">
            <h4 className={`text-base font-bold font-serif transition-colors ${project.status === 'done' ? 'text-[#5a5650]' : 'group-hover:text-orange-500'}`}>
              {project.name}
            </h4>
            <div className="text-[11px] font-mono text-[#5a5650] space-x-2">
              <span className="text-[#9e9890]">{project.client || 'Internal'}</span>
              <span>•</span>
              <span>Priority #{project.priority}</span>
              <span>•</span>
              <span className="text-orange-500/80">{realH.toFixed(1)}h Real</span>
              {project.delayDays > 0 && (
                <>
                  <span>•</span>
                  <span className="text-red-500">+{project.delayDays}d late</span>
                </>
              )}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className={`px-2.5 py-1 rounded-lg border text-[10px] font-mono font-bold uppercase tracking-widest ${
            project.status === 'inprogress' ? 'bg-amber-500/10 border-amber-500/20 text-amber-500' :
            project.status === 'inreview' ? 'bg-orange-500/10 border-orange-500/20 text-orange-500' :
            project.status === 'done' ? 'bg-green-500/10 border-green-500/20 text-green-500' :
            'bg-[#0f0e0d] border-[#333130] text-[#5a5650]'
          }`}>
            {statusLabels[project.status] || project.status}
          </div>
          <motion.div 
            animate={{ rotate: isExpanded ? 180 : 0 }}
            className="text-[#333130] group-hover:text-[#5a5650]"
          >
            <ChevronDown size={20} />
          </motion.div>
        </div>
      </div>

      {/* Progress Bar (Visible when collapsed too) */}
      <div className="px-6 pb-2">
        <div className="h-0.5 bg-[#0f0e0d] rounded-full overflow-hidden flex items-center">
          <motion.div 
            initial={{ width: 0 }}
            animate={{ width: `${progress}%` }}
            className={`h-full ${
              project.health === 'ok' ? 'bg-green-500' :
              project.health === 'risk' ? 'bg-amber-500' :
              project.health === 'done' ? 'bg-[#333130]' : 'bg-red-500'
            }`}
          />
        </div>
      </div>

      <AnimatePresence>
        {isExpanded && (
          <motion.div 
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="bg-[#0f0e0d]/50 border-t border-[#333130]"
          >
            <div className="p-8 grid grid-cols-1 lg:grid-cols-2 gap-12">
              {/* Edit Facet */}
              <div className="space-y-6">
                <div className="text-[10px] font-mono tracking-[0.2em] uppercase text-[#5a5650] flex justify-between">
                  <span>Modification</span>
                  <span className="text-orange-500">{teams.find(t => t.id === project.teamId)?.name || 'No Team'}</span>
                </div>
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <label className="text-[10px] text-[#5a5650] font-mono uppercase">Status</label>
                      <select 
                        value={project.status}
                        onChange={e => onUpdate('status', e.target.value)}
                        className="w-full bg-[#1a1917] border border-[#333130] rounded-xl px-3 py-2 text-xs focus:border-orange-500 outline-none"
                      >
                        <option value="pending">Pending</option>
                        <option value="inprogress">In Progress</option>
                        <option value="inreview">In Review</option>
                        <option value="done">Done ✓</option>
                      </select>
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-[10px] text-[#5a5650] font-mono uppercase">Priority</label>
                      <input 
                        type="number"
                        value={project.priority}
                        onChange={e => onUpdate('priority', parseInt(e.target.value) || 1)}
                        className="w-full bg-[#1a1917] border border-[#333130] rounded-xl px-3 py-2 text-xs focus:border-orange-500 outline-none text-orange-500 font-mono"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-4">
                    <div className="space-y-1.5 col-span-3 lg:col-span-1">
                      <label className="text-[10px] text-[#5a5650] font-mono uppercase">PERT (B/E/W)</label>
                      <div className="grid grid-cols-3 gap-1">
                        <input 
                          type="number"
                          value={project.bestCaseHours}
                          onChange={e => onUpdate('bestCaseHours', parseFloat(e.target.value) || 0)}
                          className="bg-[#1a1917] border border-[#333130] rounded-lg px-2 py-2 text-xs focus:border-green-500 outline-none text-green-500 font-mono"
                          title="Best Case"
                        />
                        <input 
                          type="number"
                          value={project.expectedCaseHours}
                          onChange={e => onUpdate('expectedCaseHours', parseFloat(e.target.value) || 0)}
                          className="bg-[#1a1917] border border-[#333130] rounded-lg px-2 py-2 text-xs focus:border-orange-500 outline-none text-orange-500 font-mono"
                          title="Expected Case"
                        />
                        <input 
                          type="number"
                          value={project.worstCaseHours}
                          onChange={e => onUpdate('worstCaseHours', parseFloat(e.target.value) || 0)}
                          className="bg-[#1a1917] border border-[#333130] rounded-lg px-2 py-2 text-xs focus:border-red-500 outline-none text-red-500 font-mono"
                          title="Worst Case"
                        />
                      </div>
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-[10px] text-[#5a5650] font-mono uppercase">Wait Days</label>
                      <input 
                        type="number"
                        value={project.waitDays}
                        onChange={e => onUpdate('waitDays', parseInt(e.target.value) || 0)}
                        className="w-full bg-[#1a1917] border border-[#333130] rounded-xl px-3 py-2 text-xs focus:border-orange-500 outline-none font-mono"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-[10px] text-[#5a5650] font-mono uppercase">Actual Hours</label>
                      <input 
                        type="number"
                        value={project.actualHours || 0}
                        onChange={e => onUpdate('actualHours', parseFloat(e.target.value) || 0)}
                        placeholder="On completion..."
                        className="w-full bg-[#1a1917] border border-[#333130] rounded-xl px-3 py-2 text-xs focus:border-green-500 outline-none font-mono text-green-500"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <label className="text-[10px] text-[#5a5650] font-mono uppercase">Deadline</label>
                      <input 
                        type="date"
                        value={project.clientDeadline}
                        onChange={e => onUpdate('clientDeadline', e.target.value)}
                        className="w-full bg-[#1a1917] border border-[#333130] rounded-xl px-3 py-2 text-xs focus:border-orange-500 outline-none font-mono"
                      />
                    </div>
                    <div className="space-y-1.5 pt-6 flex gap-2">
                       <select 
                        value={project.overhead}
                        onChange={e => onUpdate('overhead', parseFloat(e.target.value))}
                        className="flex-1 bg-[#1a1917] border border-[#333130] rounded-xl px-3 py-2 text-xs focus:border-orange-500 outline-none"
                      >
                        <option value="1.3">Low ×1.3</option>
                        <option value="1.6">Med ×1.6</option>
                        <option value="2.0">High ×2.0</option>
                        <option value="2.5">Max ×2.5</option>
                      </select>
                      <button 
                        onClick={() => onUpdate('status', 'done')}
                        className="flex-1 bg-green-600 hover:bg-green-500 text-white rounded-xl py-2.5 text-[10px] font-bold uppercase tracking-widest transition-all"
                      >
                        Complete
                      </button>
                    </div>
                  </div>
                </div>
                <div className="flex justify-end pt-4">
                   <button 
                    onClick={onDelete}
                    className="flex items-center gap-2 text-xs text-red-500/40 hover:text-red-500 transition-colors p-2"
                  >
                    <Trash2 size={14} />
                    <span>Delete Permanently</span>
                  </button>
                </div>
              </div>

              {/* Forecast Facet */}
              <div className="space-y-6">
                <div className="text-[10px] font-mono tracking-[0.2em] uppercase text-[#5a5650]">Impact Forecasting</div>
                <div className="bg-[#1a1917] border border-[#333130] rounded-2xl p-6 space-y-4">
                  <div className="flex justify-between items-center text-xs">
                    <span className="text-[#5a5650]">PERT Core (B/E/W)</span>
                    <span className="font-mono">{((project.bestCaseHours + 4*project.expectedCaseHours + project.worstCaseHours)/6).toFixed(1)}h</span>
                  </div>
                  <div className="flex justify-between items-center text-xs">
                    <span className="text-[#5a5650]">Cognitive Load (Switching)</span>
                    <span className="font-mono text-orange-500">+{ (config.contextSwitchCost * Math.log2(index + 2)).toFixed(2) }h</span>
                  </div>
                  <div className="flex justify-between items-center text-xs">
                    <span className="text-[#5a5650]">Energy Decay Penalty</span>
                    <span className="font-mono text-orange-500">+{ (realH - ((project.bestCaseHours + 4*project.expectedCaseHours + project.worstCaseHours)/6) * project.overhead - (config.contextSwitchCost * Math.log2(index + 2))).toFixed(1) }h</span>
                  </div>
                  <div className="pt-4 border-t border-[#333130] flex justify-between items-end">
                    <div className="space-y-1">
                      <div className="text-[10px] text-[#5a5650] font-mono uppercase">Calculated Reality</div>
                      <div className="text-2xl font-bold font-mono text-orange-500">{realH.toFixed(1)}h</div>
                    </div>
                    <div className="text-right space-y-1">
                      <div className="text-[10px] text-[#5a5650] font-mono uppercase">Forecasted End</div>
                      <div className={`text-lg font-bold font-mono ${project.delayDays > 0 ? 'text-red-500' : 'text-green-500'}`}>
                        {project.predictedEnd || project.clientDeadline}
                      </div>
                    </div>
                  </div>
                </div>
                <div className="text-[11px] text-[#5a5650] italic px-2">
                  * Dynamic modeling includes a {config.contextSwitchCost}h switch penalty and {project.waitDays || 0} wait days.
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
