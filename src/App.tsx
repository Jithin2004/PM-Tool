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
  Cpu,
  Edit2,
  Trash2
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { supabase, isSupabaseConfigured } from './lib/supabase';
import { CheckCircle2, XCircle, Info, AlertCircle } from 'lucide-react';

// --- Types ---
type UserRole = 'super_admin' | 'pm' | 'viewer';

interface Profile {
  id: string;
  email: string;
  role: UserRole;
  full_name?: string;
  created_at: string;
}

interface TeamData {
  pm_id: string;
  developer_ids: string[];
}

interface Team {
  id: string;
  name: string;
  data: TeamData | null;
  created_at: string;
  updated_at?: string;
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
  team_id?: string;
  tags: string[];
}

interface Stats {
  totalProjects: number;
  deliveryConfidence: number;
  teamBandwidth: number;
  dailyFatigue: number;
  insight: string;
}

interface Notification {
  id: string;
  type: 'success' | 'error' | 'info' | 'warning';
  message: string;
}

interface ConfirmState {
  isOpen: boolean;
  title: string;
  message: string;
  onConfirm: () => void;
}

// --- Utilities ---
const calculateExpectedTime = (best: number, likely: number, worst: number) => {
  return (best + 4 * likely + worst) / 6;
};

const calculateVariance = (best: number, worst: number) => {
  return Math.pow((worst - best) / 6, 2);
};

const getRelativeTime = (dateString?: string) => {
  if (!dateString) return 'INITIALIZING...';
  const date = new Date(dateString);
  const now = new Date();
  const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);

  if (diffInSeconds < 0) return 'just now';
  if (diffInSeconds < 60) return 'just now';
  const diffInMinutes = Math.floor(diffInSeconds / 60);
  if (diffInMinutes < 60) return `${diffInMinutes}m ago`;
  const diffInHours = Math.floor(diffInMinutes / 60);
  if (diffInHours < 24) return `${diffInHours}h ago`;
  const diffInDays = Math.floor(diffInHours / 24);
  if (diffInDays < 30) return `${diffInDays}d ago`;
  const diffInMonths = Math.floor(diffInDays / 30);
  return `${diffInMonths}mo ago`;
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
            <div className="w-9 h-9 rounded-full bg-white/5 border border-white/10 flex items-center justify-center overflow-hidden cursor-pointer hover:border-white/40 transition-colors" onClick={() => (window as any).openProfileModal()}>
              {profile?.full_name ? (
                <span className="text-[10px] font-mono font-bold text-white/60">{profile.full_name.substring(0, 2).toUpperCase()}</span>
              ) : (
                <Users className="w-4 h-4 text-white/40" />
              )}
            </div>
          </div>
        ) : (
          <p className="text-xs font-mono text-white/40">ANONYMOUS_ACCESS_RESTRICTED</p>
        )}
      </div>
    </header>
  );
}

function NotificationToast({ notification, onClose }: { notification: Notification; onClose: () => void; key?: string }) {
  useEffect(() => {
    const timer = setTimeout(onClose, 5000);
    return () => clearTimeout(timer);
  }, [onClose]);

  const icons = {
    success: <CheckCircle2 className="w-4 h-4 text-green-400" />,
    error: <XCircle className="w-4 h-4 text-red-400" />,
    info: <Info className="w-4 h-4 text-blue-400" />,
    warning: <AlertCircle className="w-4 h-4 text-yellow-400" />
  };

  return (
    <motion.div
      initial={{ opacity: 0, x: 20, y: 0 }}
      animate={{ opacity: 1, x: 0, y: 0 }}
      exit={{ opacity: 0, scale: 0.95 }}
      className="fixed bottom-6 right-6 z-[100] flex items-center gap-3 bg-[#0c0c0c] border border-white/10 p-4 min-w-[300px] shadow-2xl"
    >
      {icons[notification.type]}
      <p className="text-xs font-mono text-white/80">{notification.message}</p>
      <button onClick={onClose} className="ml-auto text-white/20 hover:text-white transition-colors">
        <Plus className="w-4 h-4 rotate-45" />
      </button>
    </motion.div>
  );
}

function ConfirmationModal({ isOpen, title, message, onConfirm, onCancel }: { isOpen: boolean; title: string; message: string; onConfirm: () => void; onCancel: () => void }) {
  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[110] flex items-center justify-center p-6">
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onCancel}
          className="absolute inset-0 bg-black/80 backdrop-blur-sm"
        />
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 20 }}
          className="relative w-full max-w-md bg-[#0c0c0c] border border-white/10 p-8 shadow-2xl"
        >
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 rounded-sm bg-red-500/10 border border-red-500/20 flex items-center justify-center">
              <AlertTriangle className="w-5 h-5 text-red-500" />
            </div>
            <h3 className="text-xl font-medium tracking-tight uppercase">{title}</h3>
          </div>
          <p className="text-sm font-mono text-white/40 mb-8 leading-relaxed">
            {message}
          </p>
          <div className="flex gap-4">
            <button
              onClick={onConfirm}
              className="flex-1 bg-red-500 text-white h-12 text-xs font-semibold uppercase tracking-widest hover:bg-red-600 transition-colors"
            >
              Delete
            </button>
            <button
              onClick={onCancel}
              className="flex-1 border border-white/10 text-white/40 h-12 text-xs font-semibold uppercase tracking-widest hover:bg-white/5 transition-colors"
            >
              Abort
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}

function StatsGrid({ stats }: { stats: Stats }) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-4 gap-px bg-white/10 border-b border-white/10">
      <StatCard label="Pipeline Confidence" value={`${stats.deliveryConfidence}%`} icon={Target} color="text-green-400" />
      <StatCard label="Active Workflows" value={stats.totalProjects} icon={BarChart3} />
      <StatCard label="Team Allocation" value={`${stats.teamBandwidth}%`} icon={Users} />
      <StatCard label="Predictive Decay" value={`${stats.dailyFatigue}h`} icon={TrendingUp} color="text-yellow-500" />
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

function ProjectCard({ project, teams, onClick }: { project: Project; teams: Team[]; onClick: (p: Project) => void }) {
  const team = teams.find(t => t.id === project.team_id);
  const teamName = team ? team.name : "UNALLOCATED";
  const parsedTeamData = team ? (typeof team.data === 'string' ? JSON.parse(team.data) : team.data) : null;
  const engineerCount = Math.max(1, parsedTeamData?.developer_ids?.length || 1);

  const expectedManDays = useMemo(() =>
    calculateExpectedTime(project.pert_best, project.pert_likely, project.pert_worst),
    [project]
  );
  const calendarDays = (expectedManDays / engineerCount).toFixed(1);

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      layout
      onClick={() => onClick(project)}
      className="border border-white/10 bg-[#0c0c0c] p-5 group hover:border-white/30 transition-all cursor-pointer relative overflow-hidden"
    >
      <div className="absolute top-0 right-0 w-32 h-32 bg-white/[0.02] -mr-16 -mt-16 rounded-full blur-3xl pointer-events-none group-hover:bg-white/[0.05]"></div>

      <div className="flex justify-between items-start mb-6">
        <div>
          <div className="flex items-center gap-2 mb-2">
            {project.priority === 'high' && <div className="w-1 h-4 bg-red-500"></div>}
            <span className={`text-[10px] font-mono uppercase border px-2 py-0.5 ${
              project.status === 'deployed' ? 'border-green-500/30 text-green-400 bg-green-500/5' :
              project.status === 'in-progress' ? 'border-blue-500/30 text-blue-400 bg-blue-500/5' :
              'border-white/10 text-white/60 bg-white/5'
            }`}>
              {project.status.replace('-', ' ')}
            </span>
          </div>
          <h3 className="text-lg font-medium leading-none mb-1 group-hover:text-white transition-colors">{project.name}</h3>
          <div className="flex items-center gap-3">
            <span className="text-[9px] font-mono text-white/20 uppercase tracking-widest">{getRelativeTime(project.created_at)}</span>
            <div className="flex gap-2">
              {project.tags.map(tag => (
                <span key={tag} className="text-[9px] font-mono text-white/30">#{tag}</span>
              ))}
            </div>
          </div>
        </div>
        <div className="text-right">
          <p className="text-[10px] font-mono text-white/40 uppercase mb-1">Finish_ETA</p>
          <div className="text-xl font-mono font-medium text-white/80">{calendarDays}d</div>
          <p className="text-[8px] font-mono text-white/20 uppercase">Effort: {expectedManDays.toFixed(1)}m/d</p>
        </div>
      </div>

      <div className="flex items-center justify-between mt-4 pt-4 border-t border-white/5">
        <div className="flex items-center gap-2">
          <Users className="w-3 h-3 text-white/20" />
          <span className="text-[10px] font-mono text-white/40 uppercase tracking-widest">{teamName}</span>
        </div>
        <button className="flex items-center gap-1 text-[10px] uppercase font-mono text-white/60 hover:text-white transition-all group/btn">
          Forecast <ChevronRight className="w-3 h-3 group-hover/btn:translate-x-1 transition-transform" />
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

function AdminDashboard({
  profiles,
  teams,
  onUpdateRole,
  onCreateTeam,
  onUpdateTeam,
  onDeleteTeam
}: {
  profiles: Profile[],
  teams: Team[],
  onUpdateRole: (id: string, role: UserRole) => void,
  onCreateTeam: (name: string, pmId: string, devIds: string[]) => void,
  onUpdateTeam: (id: string, name: string, pmId: string, devIds: string[]) => void,
  onDeleteTeam: (id: string) => void
}) {
  const [newTeamName, setNewTeamName] = useState('');
  const [selectedPm, setSelectedPm] = useState('');
  const [selectedDevs, setSelectedDevs] = useState<string[]>([]);
  const [editingTeamId, setEditingTeamId] = useState<string | null>(null);

  const handleCreateTeam = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTeamName || !selectedPm) return;

    if (editingTeamId) {
      onUpdateTeam(editingTeamId, newTeamName, selectedPm, selectedDevs);
      setEditingTeamId(null);
    } else {
      onCreateTeam(newTeamName, selectedPm, selectedDevs);
    }

    setNewTeamName('');
    setSelectedPm('');
    setSelectedDevs([]);
  };

  const startEditing = (team: Team) => {
    const parsedData = typeof team.data === 'string' ? JSON.parse(team.data) : team.data;
    setEditingTeamId(team.id);
    setNewTeamName(team.name);
    setSelectedPm(parsedData?.pm_id || '');
    setSelectedDevs(parsedData?.developer_ids || []);

    // Scroll to form
    const form = document.getElementById('squad-form');
    if (form) form.scrollIntoView({ behavior: 'smooth' });
  };

  const cancelEditing = () => {
    setEditingTeamId(null);
    setNewTeamName('');
    setSelectedPm('');
    setSelectedDevs([]);
  };

  const pms = profiles.filter(p => p.role === 'pm' || p.role === 'super_admin');
  const devs = profiles.filter(p => p.role === 'viewer');

  // Identify devs already in other squads to prevent double-assignment
  const assignedDevIds = new Set(
    teams
      .filter(t => t.id !== editingTeamId)
      .flatMap(t => {
        const d = typeof t.data === 'string' ? JSON.parse(t.data) : t.data;
        return d?.developer_ids || [];
      })
  );

  const availableDevs = devs.filter(d => !assignedDevIds.has(d.id));

  return (
    <main className="max-w-[1600px] mx-auto px-6 py-12 space-y-16">
      <div>
        <div className="mb-8">
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
                      <span className="font-mono text-xs">{profile.full_name || profile.email}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <span className={`text-[10px] font-mono uppercase px-2 py-0.5 border ${profile.role === 'super_admin' ? 'border-red-500/30 text-red-500 bg-red-500/5' :
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
      </div>

      {/* --- Squad Configuration Section --- */}
      <div>
        <div className="mb-6">
          <h2 className="text-3xl font-medium tracking-tight mb-2">Squad Configuration</h2>
          <p className="text-sm text-white/40 font-mono tracking-tighter">
            Assemble cross-functional squads. Assign one Lead (PM) and multiple Engineers (Viewers).
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="border border-white/10 bg-[#0c0c0c] p-6 lg:col-span-1" id="squad-form">
            <h3 className="text-sm font-mono uppercase tracking-widest mb-6">{editingTeamId ? 'Update Squad' : 'Initialize Squad'}</h3>
            <form onSubmit={handleCreateTeam} className="space-y-4">
              <div>
                <label className="block text-[10px] uppercase font-mono text-white/40 mb-2">Squad Designation</label>
                <input
                  required
                  type="text"
                  value={newTeamName}
                  onChange={e => setNewTeamName(e.target.value)}
                  className="w-full bg-black border border-white/10 h-10 px-3 font-mono text-xs focus:border-white/40 outline-none placeholder:text-white/20"
                  placeholder="E.g. SQUAD_DELTA"
                />
              </div>

              <div>
                <label className="block text-[10px] uppercase font-mono text-white/40 mb-2">Assign Project Manager (PM)</label>
                <select
                  required
                  value={selectedPm}
                  onChange={e => setSelectedPm(e.target.value)}
                  className="w-full bg-black border border-white/10 h-10 px-3 font-mono text-xs focus:border-white/40 outline-none text-white/80"
                >
                  <option value="" disabled>Select PM</option>
                  {pms.map(pm => (
                    <option key={pm.id} value={pm.id}>{pm.full_name || pm.email}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-[10px] uppercase font-mono text-white/40 mb-2">Assign Engineers (Viewers)</label>
                <div className="border border-white/10 bg-black max-h-40 overflow-y-auto p-2 space-y-1">
                  {availableDevs.map(dev => (
                    <label key={dev.id} className="flex items-center gap-2 text-xs font-mono cursor-pointer hover:bg-white/5 p-1 transition-colors">
                      <input
                        type="checkbox"
                        className="accent-white"
                        checked={selectedDevs.includes(dev.id)}
                        onChange={(e) => {
                          if (e.target.checked) setSelectedDevs([...selectedDevs, dev.id]);
                          else setSelectedDevs(selectedDevs.filter(id => id !== dev.id));
                        }}
                      />
                      <span>{dev.full_name || dev.email}</span>
                    </label>
                  ))}
                  {availableDevs.length === 0 && <p className="text-[10px] text-white/40 italic p-1">No unassigned engineers detected.</p>}
                </div>
              </div>

              <div className="flex gap-2">
                <button
                  type="submit"
                  className="flex-1 bg-white text-black h-10 font-medium hover:bg-neutral-200 transition-colors uppercase text-xs tracking-widest mt-4"
                >
                  {editingTeamId ? 'Update Squad' : 'Form Squad'}
                </button>
                {editingTeamId && (
                  <button
                    type="button"
                    onClick={cancelEditing}
                    className="flex-1 border border-white/10 text-white/40 h-10 font-medium hover:bg-white/5 transition-colors uppercase text-xs tracking-widest mt-4"
                  >
                    Cancel
                  </button>
                )}
              </div>
            </form>
          </div>

          <div className="lg:col-span-2 border border-white/10 bg-[#0c0c0c] overflow-hidden flex flex-col">
            <h3 className="text-sm font-mono uppercase tracking-widest p-6 border-b border-white/10">Active Squads</h3>
            <div className="overflow-y-auto p-6 space-y-4 flex-1">
              {teams.length === 0 && (
                <div className="flex flex-col items-center justify-center py-10 opacity-50">
                  <Users className="w-8 h-8 text-white/20 mb-3" />
                  <p className="text-xs font-mono text-white/40 text-center uppercase">No squads initialized.</p>
                </div>
              )}
              {teams.map(team => {
                const parsedData = typeof team.data === 'string' ? JSON.parse(team.data) : team.data;
                const pmId = parsedData?.pm_id;
                const devIds = parsedData?.developer_ids || [];
                const pm = profiles.find(p => p.id === pmId);
                const squadDevs = devIds.map((id: string) => profiles.find(p => p.id === id)).filter(Boolean);
                return (
                  <div key={team.id} className="border border-white/10 p-4 bg-white/5 hover:border-white/30 transition-colors group">
                    <div className="flex justify-between items-start mb-4">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-sm bg-white/10 flex items-center justify-center border border-white/10">
                          <Zap className="w-4 h-4 text-white/60 group-hover:text-white transition-colors" />
                        </div>
                        <h4 className="font-sans font-medium text-lg tracking-tight">{team.name}</h4>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => startEditing(team)}
                          className="p-1.5 border border-white/10 text-white/40 hover:text-white hover:border-white/30 transition-colors"
                          title="Edit Squad"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => onDeleteTeam(team.id)}
                          className="p-1.5 border border-white/10 text-white/40 hover:text-red-500 hover:border-red-500/30 transition-colors"
                          title="Delete Squad"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                        <span className="text-[10px] font-mono text-white/40 uppercase bg-black px-2 py-1 border border-white/10">ID: {team.id?.substring(0, 8) || 'UNKNOWN'}</span>
                      </div>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-4 border-t border-white/5">
                      <div>
                        <p className="text-[9px] font-mono text-white/40 uppercase mb-2">Lead (PM)</p>
                        <p className="text-xs font-mono text-blue-400 flex items-center gap-1.5"><Users className="w-3 h-3" /> {pm?.full_name || pm?.email || 'Unknown'}</p>
                      </div>
                      <div>
                        <p className="text-[9px] font-mono text-white/40 uppercase mb-2">Engineers ({squadDevs.length})</p>
                        <div className="space-y-1.5">
                          {squadDevs.length === 0 && <p className="text-[10px] font-mono text-white/20 italic">None assigned</p>}
                          {squadDevs.map(d => (
                            <p key={d?.id} className="text-xs font-mono text-white/80">{d?.full_name || d?.email}</p>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}

function ProjectDetailsModal({
  project,
  teams,
  onClose,
  onUpdate
}: {
  project: Project,
  teams: Team[],
  onClose: () => void,
  onUpdate: (id: string, updates: Partial<Project>) => void
}) {
  const [name, setName] = useState(project.name);
  const [status, setStatus] = useState(project.status);
  const [priority, setPriority] = useState(project.priority);
  const [teamId, setTeamId] = useState(project.team_id || '');
  const [pBest, setPBest] = useState(project.pert_best.toString());
  const [pLikely, setPLikely] = useState(project.pert_likely.toString());
  const [pWorst, setPWorst] = useState(project.pert_worst.toString());

  const team = teams.find(t => t.id === teamId);
  const parsedTeamData = team ? (typeof team.data === 'string' ? JSON.parse(team.data) : team.data) : null;
  const engineerCount = Math.max(1, parsedTeamData?.developer_ids?.length || 1);

  const expected = calculateExpectedTime(Number(pBest), Number(pLikely), Number(pWorst));
  const calendarExpected = (expected / engineerCount).toFixed(2);
  const variance = calculateVariance(Number(pBest), Number(pWorst));
  const stdDev = Math.sqrt(variance);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onUpdate(project.id, {
      name,
      status: status as any,
      priority: priority as any,
      team_id: teamId || undefined,
      pert_best: Number(pBest),
      pert_likely: Number(pLikely),
      pert_worst: Number(pWorst)
    });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center p-6">
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose} className="absolute inset-0 bg-[#0a0a0a]/95 backdrop-blur-md" />
      <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }} className="relative bg-[#0c0c0c] border border-white/10 w-full max-w-2xl overflow-hidden shadow-2xl">
        <div className="p-8">
          <div className="flex justify-between items-start mb-8">
            <div>
              <div className="flex items-center gap-2 mb-2">
                <BrainCircuit className="w-4 h-4 text-white/40" />
                <span className="text-[10px] font-mono text-white/30 uppercase tracking-[0.2em]">Asset Analysis Console</span>
              </div>
              <h3 className="text-2xl font-medium tracking-tight">Predictive Workspace: {project.name}</h3>
            </div>
            <button onClick={onClose} className="p-2 border border-white/10 hover:bg-white/5 transition-colors">
              <Plus className="w-5 h-5 rotate-45 text-white/20" />
            </button>
          </div>

          <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div className="space-y-6">
              <div>
                <label className="block text-[10px] uppercase font-mono text-white/40 mb-2">Project Designation</label>
                <input value={name} onChange={e => setName(e.target.value)} className="w-full bg-black border border-white/10 h-11 px-4 font-mono text-sm focus:border-white/40 outline-none" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] uppercase font-mono text-white/40 mb-2">Status</label>
                  <select value={status} onChange={e => setStatus(e.target.value as any)} className="w-full bg-black border border-white/10 h-11 px-3 font-mono text-xs focus:border-white/40 outline-none">
                    <option value="planning">PLANNING</option>
                    <option value="in-progress">IN_PROGRESS</option>
                    <option value="review">REVIEW</option>
                    <option value="deployed">DEPLOYED</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[10px] uppercase font-mono text-white/40 mb-2">Priority</label>
                  <select value={priority} onChange={e => setPriority(e.target.value as any)} className="w-full bg-black border border-white/10 h-11 px-3 font-mono text-xs focus:border-white/40 outline-none">
                    <option value="low">LOW</option>
                    <option value="medium">MEDIUM</option>
                    <option value="high">HIGH</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-[10px] uppercase font-mono text-white/40 mb-2">Allocate Squad</label>
                <select value={teamId} onChange={e => setTeamId(e.target.value)} className="w-full bg-black border border-white/10 h-11 px-3 font-mono text-xs focus:border-white/40 outline-none">
                  <option value="">UNALLOCATED</option>
                  {teams.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                </select>
              </div>
            </div>

            <div className="space-y-6">
              <div className="bg-white/5 border border-white/10 p-6 rounded-sm relative overflow-hidden">
                <div className="absolute top-0 right-0 p-3 opacity-10"><Activity className="w-12 h-12" /></div>
                <h4 className="text-[10px] font-mono text-white/40 uppercase tracking-widest mb-4">Predictive Outcome</h4>
                
                <div className="grid grid-cols-2 gap-4 mb-6">
                  <div className="bg-white/5 p-3">
                    <p className="text-[8px] font-mono text-white/20 uppercase mb-1">Man-Days Effort</p>
                    <p className="text-xl font-mono">{expected.toFixed(2)}d</p>
                  </div>
                  <div className="bg-blue-500/10 p-3 border border-blue-500/20">
                    <p className="text-[8px] font-mono text-blue-400 uppercase mb-1">Calendar Finish</p>
                    <p className="text-xl font-mono text-blue-400">{calendarExpected}d</p>
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-2 mb-6">
                  <div><p className="text-[8px] font-mono text-white/10 uppercase mb-1">Best</p><input type="number" step="0.1" value={pBest} onChange={e => setPBest(e.target.value)} className="w-full bg-black/40 border border-white/5 text-center py-1 font-mono text-[10px]" /></div>
                  <div><p className="text-[8px] font-mono text-white/10 uppercase mb-1">Likely</p><input type="number" step="0.1" value={pLikely} onChange={e => setPLikely(e.target.value)} className="w-full bg-black/40 border border-white/5 text-center py-1 font-mono text-[10px]" /></div>
                  <div><p className="text-[8px] font-mono text-white/10 uppercase mb-1">Worst</p><input type="number" step="0.1" value={pWorst} onChange={e => setPWorst(e.target.value)} className="w-full bg-black/40 border border-white/5 text-center py-1 font-mono text-[10px]" /></div>
                </div>

                <div className="pt-4 border-t border-white/5">
                  <div className="flex justify-between items-center"><span className="text-[9px] font-mono text-white/20 uppercase tracking-tighter">Variance calibration</span><span className="text-[10px] font-mono text-yellow-500/80">±{stdDev.toFixed(2)}σ</span></div>
                  <p className="text-[8px] font-mono text-white/10 mt-1 italic leading-tight">Parallel processing factor: {engineerCount} engineers.</p>
                </div>
              </div>
              <button type="submit" className="w-full bg-white text-black h-12 font-semibold uppercase tracking-widest text-[10px] hover:bg-neutral-200 transition-all shadow-xl shadow-white/5">
                Commit System Updates
              </button>
            </div>
          </form>
        </div>
      </motion.div>
    </div>
  );
}

function SquadRosterModal({ teams, profiles, onClose }: { teams: Team[], profiles: Profile[], onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center p-6">
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose} className="absolute inset-0 bg-[#0a0a0a]/95 backdrop-blur-md" />
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 20 }} className="relative bg-[#0c0c0c] border border-white/10 w-full max-w-4xl p-8 max-h-[80vh] overflow-y-auto">
        <div className="flex justify-between items-center mb-8 pb-4 border-b border-white/10">
          <h3 className="text-xl font-medium tracking-tight uppercase">Operational Squad Roster</h3>
          <button onClick={onClose} className="p-2 border border-white/10 hover:bg-white/5 transition-colors"><Plus className="w-5 h-5 rotate-45 text-white/20" /></button>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          {teams.map(team => {
            const data = typeof team.data === 'string' ? JSON.parse(team.data) : team.data;
            const pm = profiles.find(p => p.id === data?.pm_id);
            const engineers = (data?.developer_ids || []).map((id: string) => profiles.find(p => p.id === id)).filter(Boolean);
            return (
              <div key={team.id} className="border border-white/10 p-6 bg-white/5">
                <div className="flex items-center gap-3 mb-6">
                  <div className="w-8 h-8 rounded-sm bg-white/10 flex items-center justify-center border border-white/10"><Zap className="w-4 h-4 text-white/60" /></div>
                  <h4 className="text-lg font-medium">{team.name}</h4>
                </div>
                <div className="space-y-6">
                  <div><p className="text-[9px] font-mono text-white/20 uppercase mb-2">Squad Lead</p><p className="text-sm text-blue-400 font-mono">{pm?.email || 'N/A'}</p></div>
                  <div>
                    <p className="text-[9px] font-mono text-white/20 uppercase mb-2">Engineering Corps ({engineers.length})</p>
                    <div className="space-y-1">
                      {engineers.map((e: any) => <p key={e.id} className="text-xs text-white/60 font-mono">{e.email}</p>)}
                      {engineers.length === 0 && <p className="text-xs text-white/20 italic font-mono">No personnel assigned</p>}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </motion.div>
    </div>
  );
}
function UserProfileModal({ profile, onClose, onUpdate }: { profile: Profile, onClose: () => void, onUpdate: (name: string) => void }) {
  const [name, setName] = useState(profile.full_name || '');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onUpdate(name);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[130] flex items-center justify-center p-6">
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose} className="absolute inset-0 bg-[#0a0a0a]/95 backdrop-blur-md" />
      <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }} className="relative bg-[#0c0c0c] border border-white/10 w-full max-w-md p-8 shadow-2xl">
        <div className="flex items-center gap-3 mb-8 pb-4 border-b border-white/10">
          <div className="w-10 h-10 bg-white/5 border border-white/10 flex items-center justify-center">
            <Users className="w-5 h-5 text-white/40" />
          </div>
          <div>
            <h3 className="text-xl font-medium tracking-tight uppercase">Identity Profile</h3>
            <p className="text-[10px] font-mono text-white/20 uppercase tracking-widest">{profile.email}</p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label className="block text-[10px] uppercase font-mono text-white/40 mb-2">Display Name</label>
            <input
              autoFocus
              required
              type="text"
              value={name}
              onChange={e => setName(e.target.value)}
              className="w-full bg-black border border-white/10 h-12 px-4 font-mono text-sm focus:border-white/40 outline-none"
              placeholder="Enter your full name"
            />
          </div>
          <div className="bg-white/5 border border-white/10 p-4 text-[10px] font-mono text-white/30 leading-relaxed italic">
            "Your identity will be visible to administrators for squad tasking and precision engineering allocation."
          </div>
          <div className="flex gap-4">
            <button type="submit" className="flex-1 bg-white text-black h-12 font-semibold uppercase tracking-widest text-[10px] hover:bg-neutral-200 transition-all">
              Update Identity
            </button>
            <button type="button" onClick={onClose} className="flex-1 border border-white/10 text-white/40 h-12 font-semibold uppercase tracking-widest text-[10px] hover:bg-white/5 transition-all">
              Abort
            </button>
          </div>
        </form>
      </motion.div>
    </div>
  );
}

function LiveClock() {
  const [time, setTime] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  return (
    <div className="hidden sm:block">
      UPTIME: {time.toLocaleTimeString('en-US', { hour12: true, hour: '2-digit', minute: '2-digit', second: '2-digit' })}
    </div>
  );
}

export default function App() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [teams, setTeams] = useState<Team[]>([]);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [isAdding, setIsAdding] = useState(false);
  const [isAdminView, setIsAdminView] = useState(false);
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);
  const [isRosterOpen, setIsRosterOpen] = useState(false);
  const [isProfileOpen, setIsProfileOpen] = useState(false);

  // Expose profile modal trigger for header
  useEffect(() => {
    (window as any).openProfileModal = () => setIsProfileOpen(true);
  }, []);

  // Notification and Confirmation State
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [confirmState, setConfirmState] = useState<ConfirmState>({
    isOpen: false,
    title: '',
    message: '',
    onConfirm: () => { }
  });

  const notify = (message: string, type: Notification['type'] = 'info') => {
    const id = Math.random().toString(36).substring(7);
    setNotifications(prev => [...prev, { id, message, type }]);
  };

  const removeNotification = (id: string) => {
    setNotifications(prev => prev.filter(n => n.id !== id));
  };

  const askConfirmation = (title: string, message: string, onConfirm: () => void) => {
    setConfirmState({
      isOpen: true,
      title,
      message,
      onConfirm: () => {
        onConfirm();
        setConfirmState(prev => ({ ...prev, isOpen: false }));
      }
    });
  };

  // Form State
  const [newName, setNewName] = useState('');
  const [pertBest, setPertBest] = useState<string>('');
  const [pertLikely, setPertLikely] = useState<string>('');
  const [pertWorst, setPertWorst] = useState<string>('');

  useEffect(() => {
    const initAuth = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      setUser(session?.user || null);

      if (session?.user) {
        await syncProfile(session.user);
        await Promise.all([
          fetchProjects(),
          fetchTeams()
        ]);
      }

      supabase.auth.onAuthStateChange(async (_event, session) => {
        setUser(session?.user || null);
        if (session?.user) {
          await syncProfile(session.user);
          await Promise.all([
            fetchProjects(),
            fetchTeams()
          ]);
        } else {
          setProfile(null);
          setProjects([]);
          setTeams([]);
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

  const fetchTeams = async () => {
    const { data, error } = await supabase
      .from('teams')
      .select('*')
      .order('created_at', { ascending: false });

    if (!error && data) setTeams(data);
  };

  const syncProfile = async (u: any) => {
    try {
      // Try fetching with full_name first
      let { data, error } = await supabase
        .from('profiles')
        .select('id, email, role, full_name')
        .eq('id', u.id)
        .single();

      // If it fails because full_name column is missing, fallback to basic fields
      if (error && error.message?.includes('full_name')) {
        console.warn("Schema mismatch: full_name column missing. Falling back to basic profile.");
        const fallback = await supabase
          .from('profiles')
          .select('id, email, role')
          .eq('id', u.id)
          .single();
        data = fallback.data;
        error = fallback.error;
        notify("Database schema update required: Please add 'full_name' to profiles.", "warning");
      }

      if (error && error.code !== 'PGRST116') throw error;

      if (!data) {
        const { count: totalCount } = await supabase.from('profiles').select('*', { count: 'exact', head: true });
        const newRole: UserRole = (totalCount === 0) ? 'super_admin' : 'viewer';
        const { data: newProfile, error: insertError } = await supabase
          .from('profiles')
          .insert({ id: u.id, email: u.email, role: newRole })
          .select()
          .single();
        if (insertError) throw insertError;
        setProfile(newProfile);
      } else {
        setProfile(data);
      }
    } catch (e: any) {
      console.error("Profile sync failed", e);
      notify(`Identity Sync Failed: ${e.message || "Unknown database error"}`, "error");
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

  const handleUpdateProjectMetadata = async (id: string, updates: Partial<Project>) => {
    const { data, error } = await supabase
      .from('projects')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (!error && data) {
      setProjects(projects.map(p => p.id === id ? data : p));
      notify("System metadata synchronized.", "success");
    } else {
      console.error("Metadata update failed:", error);
      notify(`Sync failed: ${error?.message || "Unknown error"}`, "error");
    }
  };

  const handleUpdateProfile = async (name: string) => {
    if (!user) return;
    const { data, error } = await supabase
      .from('profiles')
      .update({ full_name: name })
      .eq('id', user.id)
      .select()
      .single();

    if (!error && data) {
      setProfile(data);
      notify("Identity parameters updated.", "success");
    } else {
      notify(`Sync failed: ${error?.message}`, "error");
    }
  };

  const handleCreateTeam = async (name: string, pmId: string, devIds: string[]) => {
    if (profile?.role !== 'super_admin') {
      notify("Unauthorized: Only super admins can create teams.", "error");
      return;
    }

    const generateId = () => {
      if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID();
      return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
        const r = Math.random() * 16 | 0, v = c === 'x' ? r : (r & 0x3 | 0x8);
        return v.toString(16);
      });
    };

    const newTeam = {
      id: generateId(),
      name,
      data: {
        pm_id: pmId,
        developer_ids: devIds
      }
    };

    console.log("Attempting to insert new team:", newTeam);

    const { data, error } = await supabase
      .from('teams')
      .insert(newTeam)
      .select()
      .single();

    if (!error && data) {
      setTeams([data, ...teams]);
      notify("Squad successfully initialized!", "success");
    } else {
      console.error("Team creation failed:", error);
      notify(`Team creation failed: ${error?.message || "Unknown error"}`, "error");
    }
  };

  const handleUpdateTeam = async (id: string, name: string, pmId: string, devIds: string[]) => {
    if (profile?.role !== 'super_admin') return;

    const { data, error } = await supabase
      .from('teams')
      .update({
        name,
        data: {
          pm_id: pmId,
          developer_ids: devIds
        }
      })
      .eq('id', id)
      .select()
      .single();

    if (!error && data) {
      setTeams(teams.map(t => t.id === id ? data : t));
      notify("Squad configuration updated.", "success");
    } else {
      console.error("Team update failed:", error);
      notify(`Team update failed: ${error?.message || "Unknown error"}`, "error");
    }
  };

  const handleDeleteTeam = async (id: string) => {
    if (profile?.role !== 'super_admin') return;

    askConfirmation(
      "Decommission Squad",
      "Are you sure you want to decommission this squad? All project associations will be lost.",
      async () => {
        // Attempting to cast ID as UUID if it's currently causing issues
        // PostgREST handles strings as UUIDs automatically if the column is UUID
        // The error "operator does not exist: uuid = text" usually points to RLS or 
        // complex queries, but here we'll just try the direct delete again.
        const { error } = await supabase
          .from('teams')
          .delete()
          .eq('id', id);

        if (!error) {
          setTeams(teams.filter(t => t.id !== id));
          notify("Squad decommissioned successfully.", "success");
        } else {
          console.error("Team deletion failed:", error);
          notify(`Team deletion failed: ${error.message}`, "error");
        }
      }
    );
  };

  const handleCreateProject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName) {
      notify("Project designation is required.", "error");
      return;
    }
    if (profile?.role === 'viewer') {
      notify("Unauthorized: Viewers cannot create assets.", "error");
      return;
    }

    const newProject = {
      name: newName,
      status: 'planning',
      priority: 'medium',
      efficiency: 0.8,
      pert_best: Number(pertBest) || 0,
      pert_likely: Number(pertLikely) || 0,
      pert_worst: Number(pertWorst) || 0,
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
      setPertBest('');
      setPertLikely('');
      setPertWorst('');
      notify("Asset successfully committed to system.", "success");
    } else {
      console.error("Project creation failed:", error);
      notify(`System Error: ${error?.message || "Failed to commit asset"}`, "error");
    }
  };

  const filteredProjects = projects.filter(p =>
    p.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const calculateDynamicStats = () => {
    let totalDecayHours = 0;
    projects.forEach(p => {
      const expected = calculateExpectedTime(p.pert_best, p.pert_likely, p.pert_worst);
      if (p.pert_worst > expected) {
        totalDecayHours += (p.pert_worst - expected) * 24;
      }
    });

    const deliveryConfidence = Math.max(0, 100 - (totalDecayHours * 0.5));
    const teamsWithProjects = new Set(projects.filter(p => p.team_id).map(p => p.team_id));
    const teamBandwidth = teams.length > 0 ? (teamsWithProjects.size / teams.length) * 100 : 0;

    // Generate dynamic insight
    let insight = "System operations are nominal. No significant architectural bias detected.";
    
    const overloadedSquads = teams.map(t => {
      const teamProjects = projects.filter(p => p.team_id === t.id);
      const totalExpected = teamProjects.reduce((acc, p) => acc + calculateExpectedTime(p.pert_best, p.pert_likely, p.pert_worst), 0);
      return { name: t.name, load: (totalExpected / 20) };
    }).filter(s => s.load > 1.0);

    if (overloadedSquads.length > 0) {
      insight = `"${overloadedSquads[0].name} is currently at critical load (${(overloadedSquads[0].load * 100).toFixed(0)}%). Expect a 15-20% increase in regression frequency due to fatigue."`;
    } else if (deliveryConfidence < 85) {
      insight = `"Systemic confidence has dropped to ${deliveryConfidence.toFixed(0)}%. Predictive decay suggests high variance in ${projects.filter(p => p.pert_worst > p.pert_likely).length} workstreams."`;
    } else if (totalDecayHours > 24) {
      insight = `"Minor predictive decay detected (${totalDecayHours.toFixed(0)}h). Recommend reviewing worst-case buffers on newly initialized assets."`;
    }

    return {
      totalProjects: projects.length,
      deliveryConfidence: Number(deliveryConfidence.toFixed(1)),
      teamBandwidth: Number(teamBandwidth.toFixed(1)),
      dailyFatigue: Number(totalDecayHours.toFixed(1)),
      insight
    };
  };

  const stats: Stats = useMemo(() => calculateDynamicStats(), [projects, teams]);

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

      <AnimatePresence>
        {notifications.map(n => (
          <NotificationToast key={n.id} notification={n} onClose={() => removeNotification(n.id)} />
        ))}
      </AnimatePresence>

      <ConfirmationModal
        isOpen={confirmState.isOpen}
        title={confirmState.title}
        message={confirmState.message}
        onConfirm={confirmState.onConfirm}
        onCancel={() => setConfirmState(prev => ({ ...prev, isOpen: false }))}
      />

      {isAdminView && profile?.role === 'super_admin' ? (
        <AdminDashboard
          profiles={profiles}
          teams={teams}
          onUpdateRole={handleUpdateRole}
          onCreateTeam={handleCreateTeam}
          onUpdateTeam={handleUpdateTeam}
          onDeleteTeam={handleDeleteTeam}
        />
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
                    <ProjectCard
                      key={project.id}
                      project={project}
                      teams={teams}
                      onClick={setSelectedProject}
                    />
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
                  {teams.slice(0, 3).map(team => {
                    const teamProjects = projects.filter(p => p.team_id === team.id);
                    const totalExpected = teamProjects.reduce((acc, p) => acc + calculateExpectedTime(p.pert_best, p.pert_likely, p.pert_worst), 0);
                    const avgEfficiency = teamProjects.length > 0 ? teamProjects.reduce((acc, p) => acc + p.efficiency, 0) / teamProjects.length : 1;
                    const load = Math.round((totalExpected / 20) * 100); // Assuming 20 days capacity

                    return (
                      <TeamMember
                        key={team.id}
                        name={team.name}
                        role={teamProjects.length > 0 ? `${teamProjects.length} Active Workflows` : 'Awaiting Tasking'}
                        load={Math.min(load, 150)}
                        efficiency={Number(avgEfficiency.toFixed(2))}
                        urgent={load > 100}
                      />
                    );
                  })}
                  {teams.length === 0 && <p className="text-[10px] font-mono text-white/20 italic">No operational units detected.</p>}
                </div>

                <button
                  onClick={() => setIsRosterOpen(true)}
                  className="w-full mt-8 py-3 border border-white/5 bg-white/5 text-[9px] uppercase font-mono tracking-widest hover:bg-white/10 transition-colors"
                >
                  View Full Roster
                </button>
              </div>

              <div className="border border-white/10 bg-[#0c0c0c] p-6">
                <div className="flex items-center gap-2 mb-4">
                  <Zap className="w-4 h-4 text-yellow-500/60" />
                  <h3 className="text-[10px] font-mono uppercase tracking-widest text-white/60">System Insight</h3>
                </div>
                <p className="text-[11px] leading-relaxed text-white/40 font-mono italic">
                  {stats.insight}
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
          >
            {/* ... rest of the isAdding code ... */}
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
                      step="0.1"
                      value={pertBest}
                      onChange={e => setPertBest(e.target.value)}
                      className="w-full bg-black border border-white/10 h-12 px-4 font-mono text-sm focus:border-white/40 outline-none"
                      placeholder="0"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] uppercase font-mono text-white/40 mb-2">PERT: Expected</label>
                    <input
                      required
                      type="number"
                      step="0.1"
                      value={pertLikely}
                      onChange={e => setPertLikely(e.target.value)}
                      className="w-full bg-black border border-white/10 h-12 px-4 font-mono text-sm focus:border-white/40 outline-none"
                      placeholder="0"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] uppercase font-mono text-white/40 mb-2">PERT: Worst</label>
                    <input
                      required
                      type="number"
                      step="0.1"
                      value={pertWorst}
                      onChange={e => setPertWorst(e.target.value)}
                      className="w-full bg-black border border-white/10 h-12 px-4 font-mono text-sm focus:border-white/40 outline-none"
                      placeholder="0"
                    />
                  </div>
                </div>

                <div className="bg-white/5 border border-white/10 p-4">
                  <div className="flex justify-between items-center text-[10px] uppercase font-mono mb-2">
                    <span className="text-white/40">Statistical Estimate</span>
                    <span className="text-white/80">
                      {calculateExpectedTime(Number(pertBest), Number(pertLikely), Number(pertWorst)).toFixed(2)} MAN_DAYS
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
                    Confidence interval adjusted for ±{Math.sqrt(calculateVariance(Number(pertBest), Number(pertWorst))).toFixed(2)}σ.
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

      <AnimatePresence>
        {selectedProject && (
          <ProjectDetailsModal
            project={selectedProject}
            teams={teams}
            onClose={() => setSelectedProject(null)}
            onUpdate={handleUpdateProjectMetadata}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {isRosterOpen && (
          <SquadRosterModal
            teams={teams}
            profiles={profiles}
            onClose={() => setIsRosterOpen(false)}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {isProfileOpen && profile && (
          <UserProfileModal
            profile={profile}
            onClose={() => setIsProfileOpen(false)}
            onUpdate={handleUpdateProfile}
          />
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
          <LiveClock />
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
