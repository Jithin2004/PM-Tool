import React, { useState, useEffect, useMemo } from 'react';
import { 
  BarChart3, 
  Activity, 
  Users, 
  Clock, 
  Target, 
  Plus, 
  Search, 
  ChevronRight, 
  AlertTriangle,
  BrainCircuit,
  Settings,
  LogOut,
  Zap,
  TrendingUp,
  Cpu
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { supabase, isSupabaseConfigured } from './lib/supabase';

// --- Types ---
type UserRole = 'super_admin' | 'pm' | 'viewer';

interface Profile {
  id: string;
  email: string;
  role: UserRole;
  created_at: string;
}

interface Project {
  id: string;
  name: string;
  status: 'planning' | 'in-progress' | 'review' | 'deployed';
  priority: 'high' | 'medium' | 'low';
  efficiency: number; // 0 to 1
  pert_best: number; // days
  pert_likely: number; // days
  pert_worst: number; // days
  created_at: string;
  owner_id?: string;
  tags: string[];
}

interface Stats {
  totalProjects: number;
  deliveryConfidence: number;
  teamBandwidth: number;
  dailyFatigue: number;
}

// --- Utilities ---
const calculateExpectedTime = (best: number, likely: number, worst: number) => {
  return (best + 4 * likely + worst) / 6;
};

const calculateVariance = (best: number, worst: number) => {
  return Math.pow((worst - best) / 6, 2);
};

// --- Components ---

function Login() {
  const handleGoogleLogin = async () => {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: window.location.origin
      }
    });
    if (error) console.error("Auth error:", error);
  };

  return (
    <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center p-6 relative overflow-hidden">
      {/* Grid Overlay */}
      <div className="absolute inset-0 pointer-events-none opacity-20" 
           style={{ backgroundImage: 'radial-gradient(circle at 2px 2px, rgba(255,255,255,0.05) 1px, transparent 0)', backgroundSize: '40px 40px' }}>
      </div>
      
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-md bg-[#0c0c0c] border border-white/10 p-10 relative z-10"
      >
        <div className="flex flex-col items-center text-center mb-10">
          <div className="w-16 h-16 bg-white flex items-center justify-center rounded-sm mb-6">
            <Activity className="text-black w-8 h-8" />
          </div>
          <h1 className="text-4xl font-medium tracking-tight mb-2">RESOLVE PM</h1>
          <p className="text-[10px] font-mono text-white/40 uppercase tracking-[0.3em]">Precision Engineering Control</p>
        </div>

        <div className="space-y-6">
          <div className="bg-white/5 border border-white/10 p-6 text-xs font-mono text-white/40 leading-relaxed">
            <p className="mb-4">SYSTEM_ACCESS_PROTOCOL: v4.0.2</p>
            <p>Authorized personnel only. By entering, you consent to predictive bias modeling and historical data aggregation.</p>
          </div>

          <button 
            onClick={handleGoogleLogin}
            className="w-full bg-white text-black h-14 flex items-center justify-center gap-3 font-semibold uppercase tracking-widest text-xs hover:bg-neutral-200 transition-all active:scale-[0.98]"
            id="google-login-btn"
          >
            <Zap className="w-4 h-4" />
            Initialize Google Auth
          </button>
        </div>

        <div className="mt-12 pt-6 border-t border-white/5 flex justify-center gap-6">
          <div className="flex items-center gap-1.5 text-[9px] font-mono text-white/10">
            <div className="w-1 h-1 rounded-full bg-white/20"></div>
            AES_256
          </div>
          <div className="flex items-center gap-1.5 text-[9px] font-mono text-white/10">
            <div className="w-1 h-1 rounded-full bg-white/20"></div>
            ENCLAVE_ACTIVE
          </div>
        </div>
      </motion.div>
    </div>
  );
}

function Header({ user, profile, onLogout, onToggleAdmin, showAdmin }: { user: any, profile: Profile | null, onLogout: () => void, onToggleAdmin: () => void, showAdmin: boolean }) {
  return (
    <header className="border-b border-white/10 px-6 py-4 flex items-center justify-between sticky top-0 bg-[#0a0a0a]/80 backdrop-blur-md z-50">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 bg-white flex items-center justify-center rounded-sm">
          <Activity className="text-black w-6 h-6" />
        </div>
        <div>
          <h1 className="font-sans font-semibold text-lg tracking-tight uppercase leading-none">Resolve PM</h1>
          <p className="text-[10px] font-mono text-white/40 uppercase tracking-[0.2em]">High-Fidelity Engineering System</p>
        </div>
      </div>
      
      <div className="flex items-center gap-6">
        <div className="hidden lg:flex items-center gap-8 mr-4">
          <button 
            onClick={() => onToggleAdmin()}
            className={`text-[10px] font-mono uppercase tracking-widest px-3 py-1 border transition-all ${showAdmin ? 'bg-white text-black border-white' : 'text-white/40 border-white/10 hover:border-white/30'}`}
          >
            {showAdmin ? 'Close Console' : 'Workspace'}
          </button>
          {profile?.role === 'super_admin' && (
            <button 
              onClick={onToggleAdmin}
              className={`text-[10px] font-mono uppercase tracking-widest px-3 py-1 border transition-all ${showAdmin ? 'bg-white text-black border-white' : 'text-white/40 border-white/10 hover:border-white/30'}`}
            >
              {showAdmin ? 'Exit Admin' : 'Admin Console'}
            </button>
          )}
        </div>

        <div className="hidden md:flex flex-col items-end">
          <p className="text-xs font-mono text-white/60 uppercase">Role: <span className={profile?.role === 'super_admin' ? 'text-red-500' : profile?.role === 'pm' ? 'text-blue-400' : 'text-white/40'}>{profile?.role || 'INITIALIZING...'}</span></p>
          <p className="text-[10px] font-mono text-white/30 uppercase tracking-[0.2em]">{profile?.role === 'viewer' ? 'READ_ONLY_ACCESS' : 'FULL_WRITE_AUTHORITY'}</p>
        </div>
        
        <div className="h-8 w-[1px] bg-white/10 hidden md:block"></div>
        
        {user ? (
          <div className="flex items-center gap-4">
            <div className="flex flex-col items-end">
              <p className="text-sm font-medium">{user.email?.split('@')[0]}</p>
              <button 
                onClick={onLogout}
                className="text-[10px] font-mono uppercase text-white/40 hover:text-white transition-colors"
                id="logout-btn"
              >
                Terminate Session
              </button>
            </div>
            <div className="w-9 h-9 rounded-full bg-white/5 border border-white/10 flex items-center justify-center overflow-hidden">
               <Users className="w-4 h-4 text-white/40" />
            </div>
          </div>
        ) : (
          <p className="text-xs font-mono text-white/40">ANONYMOUS_ACCESS_RESTRICTED</p>
        )}
      </div>
    </header>
  );
}

function StatsGrid({ stats }: { stats: Stats }) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-4 gap-px bg-white/10 border-b border-white/10">
      <StatCard label="Pipeline Confidence" value={`${stats.deliveryConfidence}%`} icon={Target} color="text-green-400" />
      <StatCard label="Active Workflows" value={stats.totalProjects} icon={BarChart3} />
      <StatCard label="Team Allocation" value={`${stats.teamBandwidth}%`} icon={Users} />
      <StatCard label="Predictive Decay" value={`-${stats.dailyFatigue}%`} icon={TrendingUp} color="text-yellow-500" />
    </div>
  );
}

function StatCard({ label, value, icon: Icon, color = "text-white" }: { label: string, value: any, icon: any, color?: string }) {
  return (
    <div className="bg-[#0a0a0a] p-6 group hover:bg-white/[0.02] transition-colors">
      <div className="flex items-center gap-3 mb-1">
        <Icon className="w-4 h-4 text-white/40 group-hover:text-white transition-colors" />
        <span className="text-[10px] uppercase font-mono text-white/40 tracking-wider leading-none">{label}</span>
      </div>
      <div className={`text-2xl font-mono font-medium ${color}`}>{value}</div>
    </div>
  );
}

function ProjectCard({ project }: { project: Project }) {
  const expectedTime = useMemo(() => 
    calculateExpectedTime(project.pert_best, project.pert_likely, project.pert_worst).toFixed(1),
    [project]
  );

  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      layout
      className="border border-white/10 bg-[#0c0c0c] p-5 group hover:border-white/30 transition-all cursor-pointer relative overflow-hidden"
    >
      <div className="absolute top-0 right-0 w-32 h-32 bg-white/[0.02] -mr-16 -mt-16 rounded-full blur-3xl pointer-events-none group-hover:bg-white/[0.05]"></div>
      
      <div className="flex justify-between items-start mb-6">
        <div>
          <div className="flex items-center gap-2 mb-2">
            {project.priority === 'high' && <div className="w-1 h-4 bg-red-500"></div>}
            <span className="text-[10px] font-mono uppercase bg-white/5 border border-white/10 px-2 py-0.5 text-white/60">
              {project.status.replace('-', ' ')}
            </span>
          </div>
          <h3 className="text-lg font-medium leading-none mb-1 group-hover:text-white transition-colors">{project.name}</h3>
          <div className="flex gap-2">
            {project.tags.map(tag => (
              <span key={tag} className="text-[9px] font-mono text-white/30">#{tag}</span>
            ))}
          </div>
        </div>
        <div className="text-right">
          <p className="text-[10px] font-mono text-white/40 uppercase mb-1">E(time)</p>
          <div className="text-xl font-mono font-medium text-white/80">{expectedTime}d</div>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-2 mb-6">
        <div className="border border-white/10 p-2 bg-black/40">
          <p className="text-[9px] font-mono text-white/30 uppercase">Best</p>
          <p className="text-xs font-mono">{project.pert_best}d</p>
        </div>
        <div className="border border-white/10 p-2 bg-black/40">
          <p className="text-[9px] font-mono text-white/30 uppercase">Likely</p>
          <p className="text-xs font-mono">{project.pert_likely}d</p>
        </div>
        <div className="border border-white/10 p-2 bg-black/40">
          <p className="text-[9px] font-mono text-white/30 uppercase">Worst</p>
          <p className="text-xs font-mono">{project.pert_worst}d</p>
        </div>
      </div>

      <div className="flex items-center justify-between mt-auto pt-4 border-t border-white/5">
        <div className="flex items-center gap-2 text-[10px] text-white/40 uppercase font-mono">
          <Users className="w-3 h-3" />
          <span>Core Team S-1</span>
        </div>
        <button className="flex items-center gap-1 text-[10px] uppercase font-mono text-white/60 hover:text-white transition-all group/btn">
          View Forecast <ChevronRight className="w-3 h-3 group-hover/btn:translate-x-1 transition-transform" />
        </button>
      </div>
    </motion.div>
  );
}

function TeamMember({ name, role, load, efficiency, urgent }: { name: string, role: string, load: number, efficiency: number, urgent?: boolean }) {
  return (
    <div className="flex flex-col gap-2">
      <div className="flex justify-between items-start">
        <div>
          <p className="text-[11px] font-medium leading-none mb-1">{name}</p>
          <p className="text-[9px] font-mono text-white/30 uppercase tracking-tighter">{role}</p>
        </div>
        <div className={`text-[10px] font-mono ${urgent ? 'text-red-500' : 'text-white/60'}`}>
          {load}% LOAD
        </div>
      </div>
      <div className="w-full bg-white/5 h-1 relative overflow-hidden">
        <motion.div 
          initial={{ width: 0 }}
          animate={{ width: `${Math.min(load, 100)}%` }}
          className={`h-full ${urgent ? 'bg-red-500' : 'bg-white/40'}`}
        />
      </div>
      <div className="flex justify-between items-center text-[8px] font-mono uppercase tracking-[0.2em] text-white/20">
        <span>Efficiency: {efficiency}</span>
        <span>{urgent ? 'DECAY_DETECTION' : 'STABLE'}</span>
      </div>
    </div>
  );
}

function AdminDashboard({ profiles, onUpdateRole }: { profiles: Profile[], onUpdateRole: (id: string, role: UserRole) => void }) {
  return (
    <main className="max-w-[1600px] mx-auto px-6 py-12">
      <div className="mb-12">
        <h2 className="text-3xl font-medium tracking-tight mb-2">Internal Identity Console</h2>
        <p className="text-sm text-white/40 font-mono tracking-tighter">
          Super Admin Privileges: Calibrate squad access levels and verify engineering credentials.
        </p>
      </div>

      <div className="border border-white/10 bg-[#0c0c0c] overflow-hidden">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-white/5 border-b border-white/10">
              <th className="px-6 py-4 text-[10px] font-mono uppercase tracking-widest text-white/40">User Identity</th>
              <th className="px-6 py-4 text-[10px] font-mono uppercase tracking-widest text-white/40">Current Role</th>
              <th className="px-6 py-4 text-[10px] font-mono uppercase tracking-widest text-white/40 text-right">Access Calibration</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5">
            {profiles.map((profile) => (
              <tr key={profile.id} className="hover:bg-white/[0.02] transition-colors">
                <td className="px-6 py-4">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded bg-white/5 flex items-center justify-center border border-white/10 font-mono text-[10px]">
                      {profile.email.charAt(0).toUpperCase()}
                    </div>
                    <span className="font-mono text-xs">{profile.email}</span>
                  </div>
                </td>
                <td className="px-6 py-4">
                  <span className={`text-[10px] font-mono uppercase px-2 py-0.5 border ${
                    profile.role === 'super_admin' ? 'border-red-500/30 text-red-500 bg-red-500/5' :
                    profile.role === 'pm' ? 'border-blue-500/30 text-blue-400 bg-blue-500/5' :
                    'border-white/10 text-white/40 bg-white/5'
                  }`}>
                    {profile.role.replace('_', ' ')}
                  </span>
                </td>
                <td className="px-6 py-4 text-right">
                  {profile.role !== 'super_admin' && (
                    <div className="flex justify-end gap-2">
                       <button 
                        onClick={() => onUpdateRole(profile.id, 'pm')}
                        className={`text-[10px] font-mono uppercase px-3 py-1 transition-all ${profile.role === 'pm' ? 'bg-blue-500 text-white' : 'border border-white/10 text-white/40 hover:border-white/30'}`}
                      >
                        PM_ROLE
                      </button>
                      <button 
                        onClick={() => onUpdateRole(profile.id, 'viewer')}
                        className={`text-[10px] font-mono uppercase px-3 py-1 transition-all ${profile.role === 'viewer' ? 'bg-white text-black' : 'border border-white/10 text-white/40 hover:border-white/30'}`}
                      >
                        VIEWER
                      </button>
                    </div>
                  )}
                  {profile.role === 'super_admin' && (
                    <span className="text-[10px] font-mono text-white/20 uppercase">Immutable_Root</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </main>
  );
}

export default function App() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [isAdding, setIsAdding] = useState(false);
  const [isAdminView, setIsAdminView] = useState(false);
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

  // Form State
  const [newName, setNewName] = useState('');
  const [pertBest, setPertBest] = useState(0);
  const [pertLikely, setPertLikely] = useState(0);
  const [pertWorst, setPertWorst] = useState(0);

  useEffect(() => {
    const initAuth = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      setUser(session?.user || null);

      if (session?.user) {
        await syncProfile(session.user);
        await fetchProjects();
      }

      supabase.auth.onAuthStateChange(async (_event, session) => {
        setUser(session?.user || null);
        if (session?.user) {
          await syncProfile(session.user);
          await fetchProjects();
        } else {
          setProfile(null);
          setProjects([]);
        }
      });

      setLoading(false);
    };

    initAuth();
  }, []);

  useEffect(() => {
    if (isAdminView && profile?.role === 'super_admin') {
      fetchProfiles();
    }
  }, [isAdminView, profile]);

  const fetchProjects = async () => {
    const { data, error } = await supabase
      .from('projects')
      .select('*')
      .order('created_at', { ascending: false });
    
    if (!error && data) setProjects(data);
  };

  const fetchProfiles = async () => {
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .order('created_at', { ascending: true });
    
    if (!error && data) setProfiles(data);
  };

  const syncProfile = async (u: any) => {
    try {
      const { data: existingProfile } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', u.id)
        .single();

      if (existingProfile) {
        setProfile(existingProfile);
      } else {
        // Strict logic: First user in DB becomes super_admin
        const { count } = await supabase
          .from('profiles')
          .select('*', { count: 'exact', head: true });

        const newRole: UserRole = (count === 0) ? 'super_admin' : 'viewer';
        const newProfile = { id: u.id, email: u.email, role: newRole };
        
        const { data: createdProfile, error } = await supabase
          .from('profiles')
          .insert(newProfile)
          .select()
          .single();

        if (!error && createdProfile) {
          setProfile(createdProfile);
        }
      }
    } catch (e) {
      console.error("Profile sync failed", e);
    }
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    setUser(null);
    setProfile(null);
    setProjects([]);
  };

  const handleUpdateRole = async (id: string, role: UserRole) => {
    if (profile?.role !== 'super_admin') return;

    const { error } = await supabase
      .from('profiles')
      .update({ role })
      .eq('id', id);

    if (!error) {
      fetchProfiles();
      if (profile?.id === id) setProfile(prev => prev ? { ...prev, role } : null);
    }
  };

  const handleCreateProject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName || profile?.role === 'viewer') return;

    const newProject = {
      name: newName,
      status: 'planning',
      priority: 'medium',
      efficiency: 0.8,
      pert_best: Number(pertBest),
      pert_likely: Number(pertLikely),
      pert_worst: Number(pertWorst),
      owner_id: user.id,
      tags: ['NEW']
    };

    const { data, error } = await supabase
      .from('projects')
      .insert(newProject)
      .select()
      .single();

    if (!error && data) {
      setProjects([data, ...projects]);
      setIsAdding(false);
      setNewName('');
      setPertBest(0);
      setPertLikely(0);
      setPertWorst(0);
    } else {
      console.error("Project creation failed:", error);
    }
  };

  const filteredProjects = projects.filter(p => 
    p.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const stats: Stats = {
    totalProjects: projects.length,
    deliveryConfidence: 94.2,
    teamBandwidth: 82.5,
    dailyFatigue: 4.2
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0a0a0a] flex flex-col items-center justify-center gap-4">
        <motion.div 
          animate={{ rotate: 360 }}
          transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
          className="w-12 h-12 border-2 border-white/10 border-t-white rounded-full"
        />
        <p className="font-mono text-sm uppercase tracking-widest text-white/40">Initializing Core Engine...</p>
      </div>
    );
  }

  if (!user) {
    return <Login />;
  }

  return (
    <div className="min-h-screen bg-[#0a0a0a] font-sans text-white/90 selection:bg-white selection:text-black">
      <Header 
        user={user} 
        profile={profile} 
        onLogout={handleLogout} 
        onToggleAdmin={() => setIsAdminView(!isAdminView)}
        showAdmin={isAdminView}
      />
      
      <StatsGrid stats={stats} />

      {isAdminView && profile?.role === 'super_admin' ? (
        <AdminDashboard profiles={profiles} onUpdateRole={handleUpdateRole} />
      ) : (
        <main className="max-w-[1600px] mx-auto px-6 py-12">
          <div className="grid grid-cols-1 lg:grid-cols-4 gap-8 mb-12">
            <div className="lg:col-span-3">
              <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-8 mb-8">
                <div>
                  <h2 className="text-3xl font-medium tracking-tight mb-2">Project Workspace</h2>
                  <p className="text-sm text-white/40 font-mono tracking-tighter">
                    Precision forecasting through engineering overhead modeling and historical drift correction.
                  </p>
                </div>
                
                <div className="flex items-center gap-4 w-full md:w-auto">
                  <div className="relative flex-1 md:w-64">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30" />
                    <input 
                      type="text" 
                      placeholder="Query system assets..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="w-full bg-[#0c0c0c] border border-white/10 h-10 pl-10 pr-4 text-sm font-mono focus:border-white/30 outline-none transition-all placeholder:text-white/10"
                    />
                  </div>
                  {profile && profile.role !== 'viewer' && (
                    <button 
                      onClick={() => setIsAdding(true)}
                      className="bg-white text-black px-4 h-10 flex items-center gap-2 font-medium hover:bg-neutral-200 transition-colors shrink-0"
                      id="add-project-btn"
                    >
                      <Plus className="w-4 h-4" />
                      <span className="hidden sm:inline text-xs uppercase tracking-wider">Add Asset</span>
                    </button>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                <AnimatePresence mode="popLayout">
                  {filteredProjects.map((project) => (
                    <ProjectCard key={project.id} project={project} />
                  ))}
                </AnimatePresence>
                
                {filteredProjects.length === 0 && (
                  <div className="col-span-full border-2 border-dashed border-white/5 py-24 flex flex-col items-center justify-center text-center opacity-50">
                    <div className="w-16 h-16 rounded-full bg-white/5 flex items-center justify-center mb-6">
                      <BrainCircuit className="w-8 h-8 text-white/20" />
                    </div>
                    <h3 className="text-xl font-medium mb-2 uppercase tracking-tight">Zero Assets Found</h3>
                    <p className="text-sm font-mono text-white/40">Query yielded no matching engineering constructs.</p>
                  </div>
                )}
              </div>
            </div>

            {/* --- Sidebar: Team Allocation --- */}
            <div className="space-y-6">
                <div className="border border-white/10 bg-[#0c0c0c] p-6">
                  <div className="flex items-center gap-2 mb-6">
                    <Users className="w-4 h-4 text-white/40" />
                    <h3 className="text-[10px] font-mono uppercase tracking-widest text-white/60">Squad Allocation</h3>
                  </div>
                  
                  <div className="space-y-4">
                    <TeamMember name="Squad Alpha" role="Core Systems" load={88} efficiency={0.92} />
                    <TeamMember name="Squad Beta" role="Interface Design" load={42} efficiency={0.84} />
                    <TeamMember name="Squad Gamma" role="Data Pipes" load={110} efficiency={0.71} urgent />
                  </div>
                  
                  <button className="w-full mt-8 py-3 border border-white/5 bg-white/5 text-[9px] uppercase font-mono tracking-widest hover:bg-white/10 transition-colors">
                    View Full Roster
                  </button>
                </div>

                <div className="border border-white/10 bg-[#0c0c0c] p-6">
                  <div className="flex items-center gap-2 mb-4">
                    <Zap className="w-4 h-4 text-yellow-500/60" />
                    <h3 className="text-[10px] font-mono uppercase tracking-widest text-white/60">System Insight</h3>
                  </div>
                  <p className="text-[11px] leading-relaxed text-white/40 font-mono italic">
                    "Squad Gamma is currently at critical load. Expect a 15-20% increase in regression frequency due to fatigue-driven oversight."
                  </p>
                  <div className="mt-4 flex items-center gap-2">
                    <TrendingUp className="w-3 h-3 text-white/20" />
                    <span className="text-[9px] font-mono text-white/20 uppercase tracking-[0.2em]">Live Bias Analysis</span>
                  </div>
                </div>
            </div>
          </div>
        </main>
      )}

      {/* --- Overlay Components --- */}
      
      <AnimatePresence>
        {isAdding && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-[#0a0a0a]/90 backdrop-blur-sm z-[100] flex items-center justify-center p-6"
            onClick={() => setIsAdding(false)}
          >
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-[#0c0c0c] border border-white/10 w-full max-w-xl p-8"
              onClick={e => e.stopPropagation()}
            >
              <div className="flex items-center gap-3 mb-8">
                <div className="w-8 h-8 bg-white/5 border border-white/10 flex items-center justify-center">
                  <Zap className="w-4 h-4 text-white/60" />
                </div>
                <div>
                  <h3 className="text-xl font-medium tracking-tight">System Initialization</h3>
                  <p className="text-[10px] font-mono text-white/30 uppercase">New workload asset creation</p>
                </div>
              </div>

              <form onSubmit={handleCreateProject} className="space-y-6">
                <div>
                  <label className="block text-[10px] uppercase font-mono text-white/40 mb-2">Project Designation</label>
                  <input 
                    autoFocus
                    required
                    type="text" 
                    value={newName}
                    onChange={e => setNewName(e.target.value)}
                    className="w-full bg-black border border-white/10 h-12 px-4 font-mono text-sm focus:border-white/40 outline-none"
                    placeholder="E.g. QUANTUM_STORAGE_OPTIMIZER"
                  />
                </div>

                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <label className="block text-[10px] uppercase font-mono text-white/40 mb-2">PERT: Best</label>
                    <input 
                      required
                      type="number" 
                      value={pertBest}
                      onChange={e => setPertBest(Number(e.target.value))}
                      className="w-full bg-black border border-white/10 h-12 px-4 font-mono text-sm focus:border-white/40 outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] uppercase font-mono text-white/40 mb-2">PERT: Expected</label>
                    <input 
                      required
                      type="number" 
                      value={pertLikely}
                      onChange={e => setPertLikely(Number(e.target.value))}
                      className="w-full bg-black border border-white/10 h-12 px-4 font-mono text-sm focus:border-white/40 outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] uppercase font-mono text-white/40 mb-2">PERT: Worst</label>
                    <input 
                      required
                      type="number" 
                      value={pertWorst}
                      onChange={e => setPertWorst(Number(e.target.value))}
                      className="w-full bg-black border border-white/10 h-12 px-4 font-mono text-sm focus:border-white/40 outline-none"
                    />
                  </div>
                </div>

                <div className="bg-white/5 border border-white/10 p-4">
                  <div className="flex justify-between items-center text-[10px] uppercase font-mono mb-2">
                    <span className="text-white/40">Statistical Estimate</span>
                    <span className="text-white/80">
                      {calculateExpectedTime(pertBest, pertLikely, pertWorst).toFixed(2)} MAN_DAYS
                    </span>
                  </div>
                  <div className="w-full bg-white/5 h-1">
                    <motion.div 
                      initial={{ width: 0 }}
                      animate={{ width: '65%' }}
                      className="h-full bg-white/40"
                    />
                  </div>
                  <p className="text-[9px] font-mono text-white/20 mt-2 italic">
                    Confidence interval adjusted for ±{Math.sqrt(calculateVariance(pertBest, pertWorst)).toFixed(2)}σ.
                  </p>
                </div>

                <div className="flex gap-4 pt-4">
                  <button 
                    type="submit"
                    className="flex-1 bg-white text-black h-12 font-medium hover:bg-neutral-200 transition-colors uppercase text-xs tracking-widest"
                  >
                    Commit Asset
                  </button>
                  <button 
                    type="button"
                    onClick={() => setIsAdding(false)}
                    className="flex-1 border border-white/10 h-12 font-medium hover:bg-white/5 transition-colors uppercase text-xs tracking-widest"
                  >
                    Abort
                  </button>
                </div>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* --- Footer / Sidebar Accent --- */}
      <footer className="fixed bottom-0 left-0 right-0 bg-[#0a0a0a]/80 border-t border-white/5 px-6 py-3 flex justify-between items-center pointer-events-none z-40">
        <div className="flex items-center gap-4 text-[9px] font-mono text-white/20 uppercase tracking-widest">
          <div className="flex items-center gap-1.5">
             <div className="w-1.5 h-1.5 rounded-full bg-green-500/50 animate-pulse"></div>
             SESSION_HEARTBEAT
          </div>
          <div>ENCRYPTION: AES-256-GCM</div>
          <div className="hidden sm:block">UPTIME: 168:12:44:02</div>
        </div>
        <div className="flex items-center gap-6">
          <Settings className="w-3 h-3 text-white/10 pointer-events-auto cursor-pointer hover:text-white transition-colors" />
          <Cpu className="w-3 h-3 text-white/10" />
        </div>
      </footer>

      {/* Grid Overlay for aesthetic */}
      <div className="fixed inset-0 pointer-events-none z-[-1] opacity-20" 
           style={{ backgroundImage: 'radial-gradient(circle at 2px 2px, rgba(255,255,255,0.05) 1px, transparent 0)', backgroundSize: '40px 40px' }}>
      </div>
    </div>
  );
}
