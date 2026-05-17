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
  Trash2,
  History,
  Calendar,
  DollarSign,
  Sliders,
  Check,
  Lock
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { supabase, isSupabaseConfigured } from './lib/supabase';
import { CheckCircle2, XCircle, Info, AlertCircle } from 'lucide-react';
import { generateSystemInsight } from './services/aiService';

// --- Types ---
type UserRole = 'super_admin' | 'pm' | 'viewer';

interface Profile {
  id: string;
  email: string;
  role: UserRole;
  full_name?: string;
  phone?: string;
  avatar_url?: string;
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
  proposed_start_date?: string;
  delete_reason?: string;
  owner_id?: string;
  team_id?: string;
  tags: string[];
  client_deadline?: string;
  real_hours?: number;
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
          <p className="text-[10px] font-mono text-white/85 uppercase tracking-[0.3em]">Precision Engineering Control</p>
        </div>

        <div className="space-y-6">
          <div className="bg-white/5 border border-white/10 p-6 text-xs font-mono text-white/85 leading-relaxed">
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
          <div className="flex items-center gap-1.5 text-[11px] font-mono text-white/70">
            <div className="w-1 h-1 rounded-full bg-white/20"></div>
            AES_256
          </div>
          <div className="flex items-center gap-1.5 text-[11px] font-mono text-white/70">
            <div className="w-1 h-1 rounded-full bg-white/20"></div>
            ENCLAVE_ACTIVE
          </div>
        </div>
      </motion.div>
    </div>
  );
}

function Header({
  user,
  profile,
  onLogout,
  onToggleAdmin,
  showAdmin,
  onToggleLogistics,
  showLogistics,
  workingHours,
  setWorkingHours,
  tilesPerRow,
  setTilesPerRow
}: {
  user: any,
  profile: Profile | null,
  onLogout: () => void,
  onToggleAdmin: () => void,
  showAdmin: boolean,
  onToggleLogistics: () => void,
  showLogistics: boolean,
  workingHours: number,
  setWorkingHours: (h: number) => void,
  tilesPerRow: number,
  setTilesPerRow: (t: number) => void
}) {
  return (
    <header className="border-b border-white/10 px-6 py-4 flex items-center justify-between sticky top-0 bg-[#0a0a0a]/80 backdrop-blur-md z-50">
      <div className="flex items-center gap-3">
        <div className="w-14 h-14 border border-white/20 bg-white/5 flex items-center justify-center overflow-hidden">
          <img src="/logo.png" alt="Logo" className="w-full h-full object-cover scale-110" />
        </div>
        <div>
          <h1 className="font-sans font-semibold text-lg tracking-tight uppercase leading-none">Resolve PM</h1>
          <p className="text-[10px] font-mono text-white/85 uppercase tracking-[0.2em]">High-Fidelity Engineering System</p>
        </div>
      </div>

      <div className="flex items-center gap-6">
        <div className="hidden xl:flex items-center gap-6 border-x border-white/10 px-6">
          <div className="flex flex-col">
            <label className="text-[9px] font-mono text-white/50 uppercase tracking-widest mb-1">Working Hours/Day</label>
            <div className="flex items-center gap-2">
              <Clock className="w-3 h-3 text-blue-400" />
              {profile?.role === 'super_admin' ? (
                <input
                  type="number"
                  value={workingHours}
                  onChange={(e) => setWorkingHours(Number(e.target.value))}
                  min={1}
                  max={24}
                  className="w-12 bg-transparent border-b border-blue-400/50 font-mono text-xs focus:border-blue-400 outline-none text-center"
                />
              ) : (
                <span className="w-12 font-mono text-xs text-center text-white/70">{workingHours}h</span>
              )}
            </div>
          </div>
          <div className="flex flex-col">
            <label className="text-[9px] font-mono text-white/50 uppercase tracking-widest mb-1">Tiles Per Row</label>
            <div className="flex items-center gap-3">
              <div className="flex bg-white/5 p-1 border border-white/10 rounded-sm">
                {[2, 3, 4].map(num => (
                  <button
                    key={num}
                    onClick={() => setTilesPerRow(num)}
                    className={`px-2 py-0.5 text-[10px] font-mono transition-all ${tilesPerRow === num ? 'bg-white text-black' : 'text-white/60 hover:text-white'}`}
                  >
                    {num}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>

        <div className="hidden lg:flex items-center gap-4 mr-4">
          {(profile?.role === 'super_admin' || profile?.role === 'pm') && (
            <button
              onClick={onToggleLogistics}
              className={`text-[10px] font-mono uppercase tracking-widest px-3 py-1 border transition-all ${showLogistics ? 'bg-white text-black border-white' : 'text-white/85 border-white/10 hover:border-white/30'}`}
            >
              {showLogistics ? 'Exit Logistics Console' : 'Logistics Console'}
            </button>
          )}

          {profile?.role === 'super_admin' && (
            <button
              onClick={onToggleAdmin}
              className={`text-[10px] font-mono uppercase tracking-widest px-3 py-1 border transition-all ${showAdmin ? 'bg-white text-black border-white' : 'text-white/85 border-white/10 hover:border-white/30'}`}
            >
              {showAdmin ? 'Exit Admin Console' : 'Admin Console'}
            </button>
          )}
        </div>

        <div className="hidden md:flex flex-col items-end">
          <p className="text-xs font-mono text-white/90 uppercase">Role: <span className={profile?.role === 'super_admin' ? 'text-red-500' : profile?.role === 'pm' ? 'text-blue-400' : 'text-white/85'}>{profile?.role || 'INITIALIZING...'}</span></p>
          <p className="text-[10px] font-mono text-white/80 uppercase tracking-[0.2em]">{profile?.role === 'viewer' ? 'READ ONLY ACCESS' : 'FULL WRITE AUTHORITY'}</p>
        </div>

        <div className="h-8 w-[1px] bg-white/10 hidden md:block"></div>

        {user ? (
          <div className="flex items-center gap-4">
            <div className="flex flex-col items-end">
              <p className="text-sm font-medium">{user.email?.split('@')[0]}</p>
              <button
                onClick={onLogout}
                className="text-[10px] font-mono uppercase text-white/85 hover:text-white transition-colors"
                id="logout-btn"
              >
                Terminate Session
              </button>
            </div>
            <div className="w-9 h-9 rounded-full bg-white/5 border border-white/10 flex items-center justify-center overflow-hidden cursor-pointer hover:border-white/40 transition-colors" onClick={() => (window as any).openProfileModal()}>
              {profile?.avatar_url ? (
                <img src={profile.avatar_url} alt="Avatar" className="w-full h-full object-cover" />
              ) : profile?.full_name ? (
                <span className="text-[10px] font-mono font-bold text-white/90">{profile.full_name.substring(0, 2).toUpperCase()}</span>
              ) : (
                <Users className="w-4 h-4 text-white/85" />
              )}
            </div>
          </div>
        ) : (
          <p className="text-xs font-mono text-white/85">ANONYMOUS_ACCESS_RESTRICTED</p>
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
      <button onClick={onClose} className="ml-auto text-white/75 hover:text-white transition-colors">
        <Plus className="w-4 h-4 rotate-45" />
      </button>
    </motion.div>
  );
}

function ConfirmationModal({ isOpen, title, message, onConfirm, onCancel }: { isOpen: boolean; title: string; message: string; onConfirm: () => void; onCancel: () => void }) {
  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[200] flex items-center justify-center p-6">
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
          <p className="text-sm font-mono text-white/85 mb-8 leading-relaxed">
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
              className="flex-1 border border-white/10 text-white/85 h-12 text-xs font-semibold uppercase tracking-widest hover:bg-white/5 transition-colors"
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
        <Icon className="w-4 h-4 text-white/85 group-hover:text-white transition-colors" />
        <span className="text-[10px] uppercase font-mono text-white/85 tracking-wider leading-none">{label}</span>
      </div>
      <div className={`text-2xl font-mono font-medium ${color}`}>{value}</div>
    </div>
  );
}

function ProjectCard({ project, teams, profiles, workingHoursPerDay, onClick }: { project: Project; teams: Team[]; profiles: Profile[]; workingHoursPerDay: number; onClick: (p: Project) => void }) {
  const creator = profiles.find(p => p.id === project.owner_id);
  const historicalSquad = project.tags.find(t => t.startsWith('SQUAD:'))?.replace('SQUAD:', '');
  const team = teams.find(t => t.id === project.team_id);
  const teamName = team ? team.name : (historicalSquad || "UNALLOCATED");
  const parsedTeamData = team ? (typeof team.data === 'string' ? JSON.parse(team.data) : team.data) : null;
  const engineerCount = Math.max(1, parsedTeamData?.developer_ids?.length || 1);

  const expectedRealHours = useMemo(() =>
    calculateExpectedTime(project.pert_best, project.pert_likely, project.pert_worst),
    [project]
  );

  const productiveHoursPerDay = workingHoursPerDay * 0.8;
  const calendarDays = (expectedRealHours / productiveHoursPerDay / engineerCount).toFixed(1);
  const stdDev = Math.sqrt(calculateVariance(project.pert_best, project.pert_worst));

  const riskColor = stdDev < 1.5 ? 'text-green-400' : stdDev < 3 ? 'text-yellow-400' : 'text-red-500';
  const riskLabel = stdDev < 1.5 ? 'STABLE' : stdDev < 3 ? 'CAUTION' : 'HIGH_RISK';

  // ETA Calibration Logic
  const startDate = project.proposed_start_date ? new Date(project.proposed_start_date) : new Date(project.created_at);
  const now = new Date();
  const daysPassed = Math.max(0, (now.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));

  const remainingDays = Math.max(0, Number(calendarDays) - daysPassed);

  const completionDate = new Date(startDate.getTime() + Number(calendarDays) * 24 * 60 * 60 * 1000);
  const completionDateStr = completionDate.toLocaleDateString('en-GB', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: 'numeric'
  });

  return (
    <div
      onClick={() => onClick(project)}
      className={`border border-white/10 bg-[#0c0c0c] p-5 group hover:border-white/30 transition-all cursor-pointer relative overflow-hidden ${stdDev >= 3 ? 'border-red-500/20 shadow-[0_0_20px_rgba(239,68,68,0.05)]' : ''
        }`}
    >
      <div className="absolute top-0 right-0 w-32 h-32 bg-white/[0.02] -mr-16 -mt-16 rounded-full blur-3xl pointer-events-none group-hover:bg-white/[0.05]"></div>
      {stdDev >= 3 && <div className="absolute top-0 left-0 w-full h-0.5 bg-red-500/50"></div>}

      <div className="flex justify-between items-start mb-6">
        <div>
          <div className="flex items-center gap-2 mb-2">
            <span className={`text-[11px] font-mono font-bold uppercase px-3 py-1 border ${project.status === 'deployed' ? 'border-green-500/50 text-green-400 bg-green-500/15' :
              project.status === 'in-progress' ? 'border-blue-500/50 text-blue-400 bg-blue-500/15' :
                'border-white/30 text-white bg-white/20'
              }`}>
              {project.status.replace('-', ' ')}
            </span>
            <span className={`text-[11px] font-mono font-bold uppercase px-3 py-1 border border-white/20 bg-white/10 ${riskColor}`}>
              {riskLabel}
            </span>
          </div>
          <h3 className="text-lg font-medium leading-none mb-1 group-hover:text-white transition-colors">{project.name}</h3>
          <div className="flex items-center gap-3">
            <span className="text-[11px] font-mono text-white/75 uppercase tracking-widest">{getRelativeTime(project.created_at)}</span>
            <div className="flex gap-2">
              {project.tags
                .filter(tag => !tag.startsWith('SQUAD:') && !tag.startsWith('LOG:'))
                .map(tag => (
                  <span key={tag} className="text-[11px] font-mono text-white/80">#{tag}</span>
                ))}
            </div>
          </div>
          {creator && (
            <div className="mt-3 flex items-center gap-2">
              <div className="w-4 h-4 rounded-full bg-white/10 flex items-center justify-center overflow-hidden border border-white/20">
                {creator.avatar_url ? (
                  <img src={creator.avatar_url} alt="Creator" className="w-full h-full object-cover" />
                ) : (
                  <Users className="w-2.5 h-2.5 text-white/70" />
                )}
              </div>
              <p className="text-[10px] font-mono text-white/60">
                Created by <span className="text-white/85">{creator.full_name || creator.email}</span>
              </p>
            </div>
          )}
        </div>
        <div className="text-right">
          <p className="text-[10px] font-mono text-white/85 uppercase mb-1">Finish_ETA</p>
          <div className={`text-xl font-mono font-medium ${riskColor}`}>{remainingDays.toFixed(1)}d</div>
          <p className="text-[9px] font-mono text-white/60 uppercase mt-1 leading-none">{completionDateStr}</p>
          <p className="text-[10px] font-mono text-white/75 uppercase mt-2">Effort: {expectedRealHours.toFixed(1)}h</p>
        </div>
      </div>

      <div className="flex items-center justify-between mt-4 pt-4 border-t border-white/5">
        <div className="flex items-center gap-2">
          <Users className="w-3 h-3 text-white/75" />
          <span className="text-[10px] font-mono text-white/85 uppercase tracking-widest">{teamName}</span>
        </div>
        <button className="flex items-center gap-1 text-[10px] uppercase font-mono text-white/90 hover:text-white transition-all group/btn">
          Forecast <ChevronRight className="w-3 h-3 group-hover/btn:translate-x-1 transition-transform" />
        </button>
      </div>
    </div>
  );
}

function TeamMember({ name, role, load, efficiency, urgent }: { name: string, role: string, load: number, efficiency: number, urgent?: boolean }) {
  const loadColor = load < 70 ? 'text-green-400' : load < 100 ? 'text-yellow-400' : 'text-red-500';
  const loadBg = load < 70 ? 'bg-green-500/20' : load < 100 ? 'bg-yellow-500/20' : 'bg-red-500/20';

  return (
    <div className="flex flex-col gap-2">
      <div className="flex justify-between items-start">
        <div>
          <h4 className="text-xs font-medium text-white/80">{name}</h4>
          <p className="text-[10px] font-mono text-white/75 uppercase">{role}</p>
        </div>
        <div className={`px-2 py-0.5 rounded-sm ${loadBg} ${loadColor} text-[11px] font-mono font-bold`}>
          {load}% LOAD
        </div>
      </div>
      <div className="w-full bg-white/5 h-1 relative overflow-hidden">
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${Math.min(100, load)}%` }}
          className={`h-full ${load >= 100 ? 'bg-red-500' : load >= 70 ? 'bg-yellow-500' : 'bg-green-500'}`}
        />
      </div>
      <div className="flex justify-between text-[10px] font-mono text-white/75 uppercase">
        <span>Efficiency: {(efficiency * 100).toFixed(0)}%</span>
        <span>{load > 100 ? 'CRITICAL_OVERAGE' : 'STABLE BANDWIDTH'}</span>
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
          <p className="text-sm text-white/85 font-mono tracking-tighter">
            Super Admin Privileges: Calibrate squad access levels and verify engineering credentials.
          </p>
        </div>

        <div className="border border-white/10 bg-[#0c0c0c] overflow-hidden">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-white/5 border-b border-white/10">
                <th className="px-6 py-4 text-[10px] font-mono uppercase tracking-widest text-white/85">User Identity</th>
                <th className="px-6 py-4 text-[10px] font-mono uppercase tracking-widest text-white/85">Current Role</th>
                <th className="px-6 py-4 text-[10px] font-mono uppercase tracking-widest text-white/85 text-right">Access Calibration</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {profiles.map((profile) => (
                <tr key={profile.id} className="hover:bg-white/[0.02] transition-colors">
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded bg-white/5 flex items-center justify-center border border-white/10 overflow-hidden font-mono text-[10px]">
                        {profile.avatar_url ? (
                          <img src={profile.avatar_url} alt="P" className="w-full h-full object-cover" />
                        ) : (profile.full_name || profile.email).charAt(0).toUpperCase()}
                      </div>
                      <div className="flex flex-col">
                        <span className="font-mono text-xs">{profile.full_name || profile.email}</span>
                        {profile.phone && <span className="text-[10px] font-mono text-white/75">{profile.phone}</span>}
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <span className={`text-[10px] font-mono uppercase px-2 py-0.5 border ${profile.role === 'super_admin' ? 'border-red-500/30 text-red-500 bg-red-500/5' :
                      profile.role === 'pm' ? 'border-blue-500/30 text-blue-400 bg-blue-500/5' :
                        'border-white/10 text-white/85 bg-white/5'
                      }`}>
                      {profile.role.replace('_', ' ')}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-right">
                    {profile.role !== 'super_admin' && (
                      <div className="flex justify-end gap-2">
                        <button
                          onClick={() => onUpdateRole(profile.id, 'pm')}
                          className={`text-[10px] font-mono uppercase px-3 py-1 transition-all ${profile.role === 'pm' ? 'bg-blue-500 text-white' : 'border border-white/10 text-white/85 hover:border-white/30'}`}
                        >
                          PM_ROLE
                        </button>
                        <button
                          onClick={() => onUpdateRole(profile.id, 'viewer')}
                          className={`text-[10px] font-mono uppercase px-3 py-1 transition-all ${profile.role === 'viewer' ? 'bg-white text-black' : 'border border-white/10 text-white/85 hover:border-white/30'}`}
                        >
                          VIEWER
                        </button>
                      </div>
                    )}
                    {profile.role === 'super_admin' && (
                      <span className="text-[10px] font-mono text-white/75 uppercase">Immutable_Root</span>
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
          <p className="text-sm text-white/85 font-mono tracking-tighter">
            Assemble cross-functional squads. Assign one Lead (PM) and multiple Engineers (Viewers).
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="border border-white/10 bg-[#0c0c0c] p-6 lg:col-span-1" id="squad-form">
            <h3 className="text-sm font-mono uppercase tracking-widest mb-6">{editingTeamId ? 'Update Squad' : 'Initialize Squad'}</h3>
            <form onSubmit={handleCreateTeam} className="space-y-4">
              <div>
                <label className="block text-[10px] uppercase font-mono text-white/85 mb-2">Squad Designation</label>
                <input
                  required
                  type="text"
                  value={newTeamName}
                  onChange={e => setNewTeamName(e.target.value)}
                  className="w-full bg-black border border-white/10 h-10 px-3 font-mono text-xs focus:border-white/40 outline-none placeholder:text-white/75"
                  placeholder="E.g. SQUAD_DELTA"
                />
              </div>

              <div>
                <label className="block text-[10px] uppercase font-mono text-white/85 mb-2">Assign Project Manager (PM)</label>
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
                <label className="block text-[10px] uppercase font-mono text-white/85 mb-2">Assign Engineers (Viewers)</label>
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
                  {availableDevs.length === 0 && <p className="text-[10px] text-white/85 italic p-1">No unassigned engineers detected.</p>}
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
                    className="flex-1 border border-white/10 text-white/85 h-10 font-medium hover:bg-white/5 transition-colors uppercase text-xs tracking-widest mt-4"
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
                  <Users className="w-8 h-8 text-white/75 mb-3" />
                  <p className="text-xs font-mono text-white/85 text-center uppercase">No squads initialized.</p>
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
                          <Zap className="w-4 h-4 text-white/90 group-hover:text-white transition-colors" />
                        </div>
                        <h4 className="font-sans font-medium text-lg tracking-tight">{team.name}</h4>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => startEditing(team)}
                          className="p-1.5 border border-white/10 text-white/85 hover:text-white hover:border-white/30 transition-colors"
                          title="Edit Squad"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => onDeleteTeam(team.id)}
                          className="p-1.5 border border-white/10 text-white/85 hover:text-red-500 hover:border-red-500/30 transition-colors"
                          title="Delete Squad"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                        <span className="text-[10px] font-mono text-white/85 uppercase bg-black px-2 py-1 border border-white/10">ID: {team.id?.substring(0, 8) || 'UNKNOWN'}</span>
                      </div>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-4 border-t border-white/5">
                      <div>
                        <p className="text-[11px] font-mono text-white/85 uppercase mb-2">Lead (PM)</p>
                        <p className="text-xs font-mono text-blue-400 flex items-center gap-1.5"><Users className="w-3 h-3" /> {pm?.full_name || pm?.email || 'Unknown'}</p>
                      </div>
                      <div>
                        <p className="text-[11px] font-mono text-white/85 uppercase mb-2">Engineers ({squadDevs.length})</p>
                        <div className="space-y-1.5">
                          {squadDevs.length === 0 && <p className="text-[10px] font-mono text-white/75 italic">None assigned</p>}
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

function LogisticsDashboard({
  profiles,
  teams,
  onSaveData
}: {
  profiles: Profile[],
  teams: Team[],
  onSaveData: (updatedData: any) => Promise<void>
}) {
  const settingsTeam = teams.find(t => t.name === 'SYSTEM_SETTINGS');
  const systemData: any = settingsTeam?.data || {};

  // Tab state
  const [activeTab, setActiveTab] = useState<'attendance' | 'paySlab' | 'payroll'>('attendance');

  // Attendance states
  const [selectedDate, setSelectedDate] = useState(() => {
    const today = new Date();
    return today.toISOString().split('T')[0];
  });
  const [attendanceSearch, setAttendanceSearch] = useState('');

  // Pay Slab form states (initialize from DB or default)
  const [allowedCasualLeaves, setAllowedCasualLeaves] = useState(2);
  const [allowedMedicalLeaves, setAllowedMedicalLeaves] = useState(2);
  const [halfDayRule, setHalfDayRule] = useState(2);
  const [unexcusedDeductionAmount, setUnexcusedDeductionAmount] = useState(100);
  const [deductionMethod, setDeductionMethod] = useState<'fixed' | 'pro_rata'>('fixed');
  const [currency, setCurrency] = useState<'USD' | 'INR' | 'EUR' | 'CAD' | 'AED'>('USD');
  const [bypassHalfDay, setBypassHalfDay] = useState(false);

  const currencySymbols: Record<string, string> = {
    USD: '$',
    INR: '₹',
    EUR: '€',
    CAD: 'C$',
    AED: 'AED '
  };

  const activeSymbol = currencySymbols[currency] || '$';

  // Payroll states
  const [selectedMonth, setSelectedMonth] = useState(() => {
    const today = new Date();
    return (today.getMonth() + 1).toString().padStart(2, '0');
  });
  const [selectedYear, setSelectedYear] = useState(() => {
    const today = new Date();
    return today.getFullYear().toString();
  });
  const [editingSalaryUserId, setEditingSalaryUserId] = useState<string | null>(null);
  const [editingSalaryValue, setEditingSalaryValue] = useState('');

  // Sync state values when DB systemData updates
  useEffect(() => {
    if (systemData.paySlab) {
      setAllowedCasualLeaves(systemData.paySlab.allowedCasualLeaves ?? 2);
      setAllowedMedicalLeaves(systemData.paySlab.allowedMedicalLeaves ?? 2);
      setHalfDayRule(systemData.paySlab.halfDayRule ?? 2);
      setUnexcusedDeductionAmount(systemData.paySlab.unexcusedDeductionAmount ?? 100);
      setDeductionMethod(systemData.paySlab.deductionMethod ?? 'fixed');
      setCurrency(systemData.paySlab.currency ?? 'USD');
      setBypassHalfDay(systemData.paySlab.bypassHalfDay ?? false);
    }
  }, [settingsTeam]);

  // Calculations for deductions and net payroll
  const monthPrefix = `${selectedYear}-${selectedMonth}`;
  const attendanceRecords = systemData.attendance || {};

  const payrollData = useMemo(() => {
    const defaultCasual = allowedCasualLeaves;
    const defaultMedical = allowedMedicalLeaves;
    const defaultHalfDayRatio = halfDayRule;

    return profiles.map(profile => {
      const baseSalary = systemData.salaries?.[profile.id] ?? 3000;

      let presentCount = 0;
      let halfDayCount = 0;
      let clCount = 0;
      let mlCount = 0;
      let uuCount = 0;

      Object.keys(attendanceRecords).forEach(dateStr => {
        if (dateStr.startsWith(monthPrefix)) {
          const dayData = attendanceRecords[dateStr]?.[profile.id];
          if (dayData) {
            if (dayData.status === 'present') {
              presentCount++;
            } else if (dayData.status === 'half_day') {
              halfDayCount++;
            } else if (dayData.status === 'absent') {
              if (dayData.leaveType === 'casual') clCount++;
              else if (dayData.leaveType === 'medical') mlCount++;
              else uuCount++;
            }
          }
        }
      });

      const expectedWorkingDays = 22;
      const totalDaysMarked = presentCount + halfDayCount + clCount + mlCount + uuCount;
      const unmarkedWorkingDays = Math.max(0, expectedWorkingDays - totalDaysMarked);

      const halfDayLeavesConverted = bypassHalfDay ? 0 : (halfDayCount / defaultHalfDayRatio);
      const casualExceeded = Math.max(0, clCount - defaultCasual);
      const medicalExceeded = Math.max(0, mlCount - defaultMedical);
      const totalUnpaidDays = casualExceeded + medicalExceeded + halfDayLeavesConverted + uuCount + unmarkedWorkingDays;

      let totalDeductions = 0;
      if (totalUnpaidDays > 0) {
        if (deductionMethod === 'fixed') {
          totalDeductions = totalUnpaidDays * unexcusedDeductionAmount;
        } else {
          const dailyRate = baseSalary / 22;
          totalDeductions = totalUnpaidDays * dailyRate;
        }
      }

      const netPayable = Math.max(0, baseSalary - totalDeductions);

      return {
        profile,
        baseSalary,
        presentCount,
        halfDayCount,
        clCount,
        mlCount,
        uuCount,
        totalUnpaidDays,
        totalDeductions,
        netPayable
      };
    });
  }, [profiles, systemData, monthPrefix, allowedCasualLeaves, allowedMedicalLeaves, halfDayRule, unexcusedDeductionAmount, deductionMethod, bypassHalfDay]);

  const handleMarkAttendance = async (userId: string, status: 'present' | 'half_day' | 'absent', leaveType?: 'casual' | 'medical' | 'unexcused') => {
    const existingAttendance = systemData.attendance || {};
    const dayRecords = { ...(existingAttendance[selectedDate] || {}) };

    if (status === 'absent') {
      dayRecords[userId] = { status, leaveType: leaveType || 'unexcused' };
    } else {
      dayRecords[userId] = { status };
    }

    const updatedAttendance = {
      ...existingAttendance,
      [selectedDate]: dayRecords
    };

    await onSaveData({
      ...systemData,
      attendance: updatedAttendance
    });
  };

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    const updatedPaySlab = {
      allowedCasualLeaves,
      allowedMedicalLeaves,
      halfDayRule,
      unexcusedDeductionAmount,
      deductionMethod,
      currency,
      bypassHalfDay
    };

    await onSaveData({
      ...systemData,
      paySlab: updatedPaySlab
    });
  };

  const handleSaveSalary = async (userId: string) => {
    const existingSalaries = systemData.salaries || {};
    const updatedSalaries = {
      ...existingSalaries,
      [userId]: Number(editingSalaryValue) || 0
    };

    await onSaveData({
      ...systemData,
      salaries: updatedSalaries
    });
    setEditingSalaryUserId(null);
  };

  // Filter profiles for attendance marking
  const filteredProfiles = profiles.filter(p => {
    const searchLower = attendanceSearch.toLowerCase();
    return (
      (p.full_name || '').toLowerCase().includes(searchLower) ||
      p.email.toLowerCase().includes(searchLower)
    );
  });

  // Calculate day summary stats
  const dayAttendance = attendanceRecords[selectedDate] || {};
  const dayStats = useMemo(() => {
    let present = 0;
    let halfDay = 0;
    let absent = 0;
    profiles.forEach(p => {
      const dayData = dayAttendance[p.id];
      if (dayData) {
        if (dayData.status === 'present') present++;
        else if (dayData.status === 'half_day') halfDay++;
        else if (dayData.status === 'absent') absent++;
      }
    });
    return { present, halfDay, absent };
  }, [dayAttendance, profiles]);

  return (
    <main className="max-w-[1600px] mx-auto px-6 py-12">
      {/* Visual Section Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-8 mb-12 border-b border-white/10 pb-8">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <Sliders className="w-5 h-5 text-blue-400" />
            <h2 className="text-3xl font-medium tracking-tight uppercase">Logistics & Payroll Console</h2>
          </div>
          <p className="text-sm font-mono text-white/70">
            Secure workspace administration: attendance tracking, pay slab logic, and automated pro-rata deductions.
          </p>
        </div>

        {/* Tab Selector */}
        <div className="flex bg-white/5 p-1 border border-white/5 rounded-sm">
          <button
            onClick={() => setActiveTab('attendance')}
            className={`px-4 py-2 text-[10px] font-mono uppercase tracking-widest transition-all ${activeTab === 'attendance' ? 'bg-white text-black font-semibold' : 'text-white/60 hover:text-white'}`}
          >
            Attendance Tracker
          </button>
          <button
            onClick={() => setActiveTab('paySlab')}
            className={`px-4 py-2 text-[10px] font-mono uppercase tracking-widest transition-all ${activeTab === 'paySlab' ? 'bg-white text-black font-semibold' : 'text-white/60 hover:text-white'}`}
          >
            Global Rules & Pay Slabs
          </button>
          <button
            onClick={() => setActiveTab('payroll')}
            className={`px-4 py-2 text-[10px] font-mono uppercase tracking-widest transition-all ${activeTab === 'payroll' ? 'bg-white text-black font-semibold' : 'text-white/60 hover:text-white'}`}
          >
            Payroll Telemetry
          </button>
        </div>
      </div>

      {/* Tab Contents */}
      <AnimatePresence mode="wait">
        {activeTab === 'attendance' && (
          <motion.div
            key="attendance"
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -15 }}
            transition={{ duration: 0.2 }}
            className="space-y-8"
          >
            {/* Header controls for Attendance */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-center bg-[#0c0c0c] border border-white/10 p-6">
              <div className="flex flex-col gap-2">
                <label className="text-[10px] font-mono uppercase tracking-wider text-white/50">Tracking Target Date</label>
                <div className="relative">
                  <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/60" />
                  <input
                    type="date"
                    value={selectedDate}
                    onChange={(e) => setSelectedDate(e.target.value)}
                    className="w-full bg-[#0a0a0a] border border-white/10 h-11 pl-10 pr-4 text-sm font-mono text-white focus:border-white/30 outline-none transition-all"
                  />
                </div>
              </div>

              <div className="flex flex-col gap-2">
                <label className="text-[10px] font-mono uppercase tracking-wider text-white/50">Query Profiles</label>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/60" />
                  <input
                    type="text"
                    placeholder="Search name or email..."
                    value={attendanceSearch}
                    onChange={(e) => setAttendanceSearch(e.target.value)}
                    className="w-full bg-[#0a0a0a] border border-white/10 h-11 pl-10 pr-4 text-sm font-mono text-white focus:border-white/30 outline-none transition-all placeholder:text-white/40"
                  />
                </div>
              </div>

              {/* Day stats counters */}
              <div className="flex gap-4 items-center justify-between border-t border-white/5 lg:border-t-0 lg:border-l lg:border-white/10 pt-4 lg:pt-0 lg:pl-8 h-full">
                <div className="text-center flex-1">
                  <p className="text-[9px] font-mono text-white/50 uppercase tracking-widest mb-1">PRESENT</p>
                  <p className="text-2xl font-bold text-green-400 font-mono">{dayStats.present}</p>
                </div>
                <div className="h-8 w-[1px] bg-white/5"></div>
                <div className="text-center flex-1">
                  <p className="text-[9px] font-mono text-white/50 uppercase tracking-widest mb-1">HALF DAY</p>
                  <p className="text-2xl font-bold text-yellow-400 font-mono">{dayStats.halfDay}</p>
                </div>
                <div className="h-8 w-[1px] bg-white/5"></div>
                <div className="text-center flex-1">
                  <p className="text-[9px] font-mono text-white/50 uppercase tracking-widest mb-1">ABSENT</p>
                  <p className="text-2xl font-bold text-red-500 font-mono">{dayStats.absent}</p>
                </div>
              </div>
            </div>

            {/* Attendance Marking Grid */}
            <div className="border border-white/10 bg-[#0c0c0c] overflow-hidden">
              <div className="p-6 border-b border-white/10 bg-[#0a0a0a] flex justify-between items-center">
                <h3 className="text-xs font-mono uppercase tracking-widest text-white/90">Mark System Attendance</h3>
                <span className="text-[9px] font-mono text-white/50 bg-white/5 px-2 py-0.5 border border-white/5 uppercase">TELEMETRY_ONLINE</span>
              </div>

              <div className="divide-y divide-white/5">
                {filteredProfiles.length === 0 ? (
                  <div className="p-12 text-center text-xs font-mono text-white/50 italic">
                    No active system profiles match your search criteria.
                  </div>
                ) : (
                  filteredProfiles.map(profile => {
                    const record = dayAttendance[profile.id];
                    const status = record?.status;
                    const leaveType = record?.leaveType;

                    return (
                      <div key={profile.id} className="p-6 flex flex-col md:flex-row md:items-center justify-between gap-6 hover:bg-white/[0.01] transition-all">
                        {/* User Details */}
                        <div className="flex items-center gap-4">
                          <div className="w-12 h-12 border border-white/10 bg-white/5 flex items-center justify-center overflow-hidden">
                            {profile.avatar_url ? (
                              <img src={profile.avatar_url} alt={profile.full_name} className="w-full h-full object-cover" />
                            ) : (
                              <Users className="w-5 h-5 text-white/40" />
                            )}
                          </div>
                          <div>
                            <h4 className="text-sm font-semibold text-white/90">{profile.full_name || 'Anonymous User'}</h4>
                            <p className="text-[10px] font-mono text-white/60 uppercase">{profile.email}</p>
                            <p className="text-[9px] font-mono mt-1"><span className="text-white/40 uppercase">Role:</span> <span className="text-blue-400 uppercase">{profile.role}</span></p>
                          </div>
                        </div>

                        {/* Status marking controls */}
                        <div className="flex flex-wrap items-center gap-3">
                          {/* Present button */}
                          <button
                            onClick={() => handleMarkAttendance(profile.id, 'present')}
                            className={`px-3 py-1.5 text-[9px] font-mono uppercase tracking-wider border rounded-sm transition-all ${status === 'present' ? 'bg-green-500/20 border-green-500 text-green-400 font-bold shadow-[0_0_10px_rgba(34,197,94,0.15)]' : 'border-white/10 hover:border-white/20 text-white/60 hover:text-white'}`}
                          >
                            Present
                          </button>

                          {/* Half Day button */}
                          <button
                            onClick={() => handleMarkAttendance(profile.id, 'half_day')}
                            className={`px-3 py-1.5 text-[9px] font-mono uppercase tracking-wider border rounded-sm transition-all ${status === 'half_day' ? 'bg-yellow-500/20 border-yellow-500 text-yellow-400 font-bold shadow-[0_0_10px_rgba(234,179,8,0.15)]' : 'border-white/10 hover:border-white/20 text-white/60 hover:text-white'}`}
                          >
                            Half Day
                          </button>

                          {/* Absent Option split */}
                          <div className="flex items-center bg-black/40 border border-white/10 p-1">
                            <button
                              onClick={() => handleMarkAttendance(profile.id, 'absent', 'unexcused')}
                              className={`px-2.5 py-1 text-[9px] font-mono uppercase tracking-wider transition-all ${status === 'absent' && leaveType === 'unexcused' ? 'bg-red-500/20 text-red-500 font-bold' : 'text-white/50 hover:text-white'}`}
                            >
                              Absent (Unpaid)
                            </button>
                            <div className="w-[1px] h-4 bg-white/10 mx-1 font-mono"></div>
                            
                            <button
                              onClick={() => handleMarkAttendance(profile.id, 'absent', 'casual')}
                              className={`px-2.5 py-1 text-[9px] font-mono uppercase tracking-wider transition-all ${status === 'absent' && leaveType === 'casual' ? 'bg-blue-500/20 text-blue-400 font-bold' : 'text-white/50 hover:text-white'}`}
                            >
                              Casual Leave (CL)
                            </button>
                            <div className="w-[1px] h-4 bg-white/10 mx-1"></div>

                            <button
                              onClick={() => handleMarkAttendance(profile.id, 'absent', 'medical')}
                              className={`px-2.5 py-1 text-[9px] font-mono uppercase tracking-wider transition-all ${status === 'absent' && leaveType === 'medical' ? 'bg-purple-500/20 text-purple-400 font-bold' : 'text-white/50 hover:text-white'}`}
                            >
                              Medical Leave (ML)
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          </motion.div>
        )}

        {activeTab === 'paySlab' && (
          <motion.div
            key="paySlab"
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -15 }}
            transition={{ duration: 0.2 }}
            className="grid grid-cols-1 lg:grid-cols-3 gap-8"
          >
            {/* Rules configurator Form */}
            <div className="lg:col-span-2 border border-white/10 bg-[#0c0c0c] p-8 space-y-6">
              <div className="border-b border-white/10 pb-4 flex items-center gap-2">
                <Sliders className="w-4 h-4 text-blue-400" />
                <h3 className="text-sm font-mono uppercase tracking-widest text-white/90 font-semibold font-bold">Global System Pay Slabs</h3>
              </div>

              <form onSubmit={handleSaveSettings} className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Casual Leaves */}
                  <div className="flex flex-col gap-2">
                    <label className="text-[10px] font-mono uppercase tracking-wider text-white/70">Allowed Paid Casual Leaves (CL) / Month</label>
                    <input
                      type="number"
                      required
                      value={allowedCasualLeaves}
                      onChange={(e) => setAllowedCasualLeaves(Number(e.target.value))}
                      min={0}
                      max={31}
                      className="w-full bg-[#0a0a0a] border border-white/10 h-11 px-4 text-sm font-mono text-white focus:border-white/30 outline-none"
                    />
                    <p className="text-[9px] font-mono text-white/40 italic">Allocated paid leave allowance per user. Exceeding days trigger deductions.</p>
                  </div>

                  {/* Medical Leaves */}
                  <div className="flex flex-col gap-2">
                    <label className="text-[10px] font-mono uppercase tracking-wider text-white/70">Allowed Paid Medical Leaves (ML) / Month</label>
                    <input
                      type="number"
                      required
                      value={allowedMedicalLeaves}
                      onChange={(e) => setAllowedMedicalLeaves(Number(e.target.value))}
                      min={0}
                      max={31}
                      className="w-full bg-[#0a0a0a] border border-white/10 h-11 px-4 text-sm font-mono text-white focus:border-white/30 outline-none"
                    />
                    <p className="text-[9px] font-mono text-white/40 italic">Allocated paid sick/medical leave. Excess days trigger deductions.</p>
                  </div>

                  {/* Half-day Conversion Rule */}
                  <div className="flex flex-col gap-2">
                    <label className="text-[10px] font-mono uppercase tracking-wider text-white/70">Half-Day Conversion Threshold</label>
                    <input
                      type="number"
                      required
                      value={halfDayRule}
                      onChange={(e) => setHalfDayRule(Number(e.target.value))}
                      min={1}
                      max={10}
                      className="w-full bg-[#0a0a0a] border border-white/10 h-11 px-4 text-sm font-mono text-white focus:border-white/30 outline-none"
                    />
                    <p className="text-[9px] font-mono text-white/40 italic">Specify how many marked Half-Day absences equal 1 Full-Day leave (e.g. 2 half-days = 1 full day).</p>
                  </div>

                  {/* Half-day Empathy Bypass Toggle */}
                  <div className="flex flex-col gap-2">
                    <label className="text-[10px] font-mono uppercase tracking-wider text-white/70">Half-Day Empathy Bypass</label>
                    <div className="flex items-center gap-3 bg-[#0a0a0a] border border-white/10 h-11 px-4">
                      <input
                        type="checkbox"
                        id="bypassHalfDay"
                        checked={bypassHalfDay}
                        onChange={(e) => setBypassHalfDay(e.target.checked)}
                        className="w-4 h-4 accent-white cursor-pointer"
                      />
                      <label htmlFor="bypassHalfDay" className="text-xs font-mono text-white/80 cursor-pointer select-none">
                        Bypass half-day pay deductions
                      </label>
                    </div>
                    <p className="text-[9px] font-mono text-white/40 italic">When enabled, employees will NOT have pay deducted for marked half-day leaves (showing empathy for genuine needs).</p>
                  </div>

                  {/* Currency Selector */}
                  <div className="flex flex-col gap-2">
                    <label className="text-[10px] font-mono uppercase tracking-wider text-white/70">Global System Currency</label>
                    <select
                      value={currency}
                      onChange={(e) => setCurrency(e.target.value as any)}
                      className="w-full bg-[#0a0a0a] border border-white/10 h-11 px-4 text-sm font-mono text-white focus:border-white/30 outline-none"
                    >
                      <option value="USD">USD ($) - US Dollar</option>
                      <option value="INR">INR (₹) - Indian Rupee</option>
                      <option value="EUR">EUR (€) - Euro</option>
                      <option value="CAD">CAD (C$) - Canadian Dollar</option>
                      <option value="AED">AED (د.إ) - UAE Dirham</option>
                    </select>
                    <p className="text-[9px] font-mono text-white/40 italic">Set the primary currency used across salary listings, calculations, and deductions.</p>
                  </div>

                  {/* Deduction Method Selector */}
                  <div className="flex flex-col gap-2">
                    <label className="text-[10px] font-mono uppercase tracking-wider text-white/70">Leave Deduction Calculation Method</label>
                    <select
                      value={deductionMethod}
                      onChange={(e) => setDeductionMethod(e.target.value as any)}
                      className="w-full bg-[#0a0a0a] border border-white/10 h-11 px-4 text-sm font-mono text-white focus:border-white/30 outline-none"
                    >
                      <option value="fixed">Fixed Currency Value per Leave Day</option>
                      <option value="pro_rata">Daily Pro-Rata (Base Monthly Salary / 22 Working Days)</option>
                    </select>
                    <p className="text-[9px] font-mono text-white/40 italic">Choose whether unexcused leaves deduct a flat fee or calculate dynamic pro-rata daily wage cuts.</p>
                  </div>

                  {/* Fixed Amount input */}
                  {deductionMethod === 'fixed' && (
                    <div className="flex flex-col gap-2 md:col-span-2">
                      <label className="text-[10px] font-mono uppercase tracking-wider text-white/70">Flat Deduction Value ({activeSymbol.trim()}) per Excess Leave</label>
                      <div className="relative">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-mono text-white/60">{activeSymbol}</span>
                        <input
                          type="number"
                          required
                          value={unexcusedDeductionAmount}
                          onChange={(e) => setUnexcusedDeductionAmount(Number(e.target.value))}
                          min={0}
                          className="w-full bg-[#0a0a0a] border border-white/10 h-11 pl-10 pr-4 text-sm font-mono text-white focus:border-white/30 outline-none"
                        />
                      </div>
                      <p className="text-[9px] font-mono text-white/40 italic">Configured deduction amount deducted from the user's monthly payload for each exceeding unexcused day.</p>
                    </div>
                  )}
                </div>

                <div className="pt-4 border-t border-white/10 flex justify-end">
                  <button
                    type="submit"
                    className="bg-white text-black font-semibold text-[10px] font-mono uppercase tracking-widest px-8 py-3 hover:bg-neutral-200 transition-colors flex items-center gap-2"
                  >
                    <Check className="w-4 h-4" /> Save Slab System Configuration
                  </button>
                </div>
              </form>
            </div>

            {/* Quick Helper Rules Info panel */}
            <div className="border border-white/10 bg-[#0c0c0c] p-8 space-y-6">
              <div className="border-b border-white/10 pb-4 flex items-center gap-2">
                <BrainCircuit className="w-4 h-4 text-blue-400" />
                <h3 className="text-sm font-mono uppercase tracking-widest text-white/90 font-semibold font-bold">Formula Telemetry</h3>
              </div>

              <div className="space-y-4 text-xs font-mono text-white/70 leading-relaxed">
                <p>
                  The payroll deduction calculation is computed in real-time using high-fidelity rules matching standard corporate infrastructure:
                </p>
                <div className="border border-white/10 bg-[#0a0a0a] p-4 text-[11px] space-y-2">
                  <p className="font-bold text-white">1. Total Unpaid Leave Days (LD):</p>
                  <p className="text-white/60">LD = Excess(CL) + Excess(ML) + (Half-Days / Threshold) + Unexcused Absences</p>
                  
                  <p className="font-bold text-white pt-2">2. Daily Wage Rate (DR):</p>
                  <p className="text-white/60">DR = Base Salary / 22 (Industry average working days)</p>

                  <p className="font-bold text-white pt-2">3. Total Deductions:</p>
                  <p className="text-white/60">If Fixed Method: Deduct = LD * Flat Deduction Amount</p>
                  <p className="text-white/60">If Pro-Rata Method: Deduct = LD * DR</p>
                </div>
                <div className="bg-blue-500/10 border border-blue-500/20 p-4 flex items-start gap-3">
                  <Info className="w-4 h-4 text-blue-400 shrink-0 mt-0.5" />
                  <p className="text-[10px] text-blue-400/90">
                    Paid leave allocations are automatically assigned to all active user roles (both Project Managers and Developers/Viewers) inside the database.
                  </p>
                </div>
              </div>
            </div>
          </motion.div>
        )}

        {activeTab === 'payroll' && (
          <motion.div
            key="payroll"
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -15 }}
            transition={{ duration: 0.2 }}
            className="space-y-8"
          >
            {/* Payroll filters */}
            <div className="flex flex-col md:flex-row gap-6 items-center bg-[#0c0c0c] border border-white/10 p-6 justify-between">
              <div>
                <h3 className="text-xs font-mono uppercase tracking-widest text-white/90 font-semibold font-bold mb-1">Payroll Telemetry Analysis</h3>
                <p className="text-[10px] font-mono text-white/50 uppercase">MONTHLY SQUAD COMPENSATION COMPLIANCE</p>
              </div>

              <div className="flex items-center gap-4">
                {/* Month Picker */}
                <select
                  value={selectedMonth}
                  onChange={(e) => setSelectedMonth(e.target.value)}
                  className="bg-[#0a0a0a] border border-white/10 h-10 px-4 text-xs font-mono text-white focus:border-white/30 outline-none"
                >
                  <option value="01">January</option>
                  <option value="02">February</option>
                  <option value="03">March</option>
                  <option value="04">April</option>
                  <option value="05">May</option>
                  <option value="06">June</option>
                  <option value="07">July</option>
                  <option value="08">August</option>
                  <option value="09">September</option>
                  <option value="10">October</option>
                  <option value="11">November</option>
                  <option value="12">December</option>
                </select>

                {/* Year Picker */}
                <select
                  value={selectedYear}
                  onChange={(e) => setSelectedYear(e.target.value)}
                  className="bg-[#0a0a0a] border border-white/10 h-10 px-4 text-xs font-mono text-white focus:border-white/30 outline-none"
                >
                  <option value="2025">2025</option>
                  <option value="2026">2026</option>
                  <option value="2027">2027</option>
                </select>
              </div>
            </div>

            {/* Payroll Data Grid */}
            <div className="border border-white/10 bg-[#0c0c0c] overflow-hidden">
              <div className="p-6 border-b border-white/10 bg-[#0a0a0a] flex justify-between items-center">
                <h3 className="text-xs font-mono uppercase tracking-widest text-white/90 font-bold">Compiled Month Telemetry Sheet</h3>
                <span className="text-[10px] font-mono text-white/50">Month Scope: {monthPrefix}</span>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-white/10 bg-white/[0.02]">
                      <th className="p-4 text-[10px] font-mono uppercase tracking-wider text-white/50">System Profile</th>
                      <th className="p-4 text-[10px] font-mono uppercase tracking-wider text-white/50 text-right">Base Salary ({activeSymbol.trim()})</th>
                      <th className="p-4 text-[10px] font-mono uppercase tracking-wider text-white/50 text-center">Attendance Summary (Days)</th>
                      <th className="p-4 text-[10px] font-mono uppercase tracking-wider text-white/50 text-center">Leaves / Exceeded Allowed</th>
                      <th className="p-4 text-[10px] font-mono uppercase tracking-wider text-white/50 text-center font-bold text-red-500/90">Deductible Days</th>
                      <th className="p-4 text-[10px] font-mono uppercase tracking-wider text-white/50 text-right font-bold text-red-400">Total Deductions ({activeSymbol.trim()})</th>
                      <th className="p-4 text-[10px] font-mono uppercase tracking-wider text-white/50 text-right font-bold text-green-400">Net Payable ({activeSymbol.trim()})</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5">
                    {payrollData.map(({
                      profile,
                      baseSalary,
                      presentCount,
                      halfDayCount,
                      clCount,
                      mlCount,
                      uuCount,
                      totalUnpaidDays,
                      totalDeductions,
                      netPayable
                    }) => {
                      const isEditing = editingSalaryUserId === profile.id;

                      return (
                        <tr key={profile.id} className="hover:bg-white/[0.01] transition-all">
                          {/* Profile */}
                          <td className="p-4 flex items-center gap-3">
                            <div className="w-8 h-8 border border-white/10 bg-white/5 flex items-center justify-center overflow-hidden shrink-0">
                              {profile.avatar_url ? (
                                <img src={profile.avatar_url} alt={profile.full_name} className="w-full h-full object-cover" />
                              ) : (
                                <Users className="w-4 h-4 text-white/40" />
                              )}
                            </div>
                            <div>
                              <h4 className="text-xs font-semibold text-white/90">{profile.full_name || 'Anonymous User'}</h4>
                              <p className="text-[9px] font-mono text-white/50 uppercase">{profile.email}</p>
                            </div>
                          </td>

                          {/* Base Salary (Editable) */}
                          <td className="p-4 text-right">
                            {isEditing ? (
                              <div className="flex items-center gap-1.5 justify-end">
                                <input
                                  type="number"
                                  value={editingSalaryValue}
                                  onChange={(e) => setEditingSalaryValue(e.target.value)}
                                  className="w-20 bg-black border border-white/20 px-2 py-1 text-xs font-mono text-right text-white focus:border-white/50 outline-none"
                                />
                                <button
                                  onClick={() => handleSaveSalary(profile.id)}
                                  className="p-1 border border-green-500/50 bg-green-500/10 text-green-400 hover:bg-green-500/20"
                                >
                                  <Check className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            ) : (
                              <div className="flex items-center justify-end gap-2 group/sal">
                                <span className="font-mono text-xs text-white/80">{activeSymbol}{baseSalary.toLocaleString()}</span>
                                <button
                                  onClick={() => {
                                    setEditingSalaryUserId(profile.id);
                                    setEditingSalaryValue(baseSalary.toString());
                                  }}
                                  className="opacity-0 group-hover/sal:opacity-100 p-1 hover:bg-white/5 text-white/60 hover:text-white transition-all"
                                >
                                  <Edit2 className="w-3 h-3" />
                                </button>
                              </div>
                            )}
                          </td>

                          {/* Attendance */}
                          <td className="p-4 text-center">
                            <div className="flex items-center justify-center gap-2 text-[10px] font-mono">
                              <span className="bg-green-500/10 text-green-400 px-2 py-0.5 border border-green-500/15" title="Present Days">P: {presentCount}</span>
                              <span className="bg-yellow-500/10 text-yellow-400 px-2 py-0.5 border border-yellow-500/15" title="Half Days">HD: {halfDayCount}</span>
                              <span className="bg-red-500/10 text-red-400 px-2 py-0.5 border border-red-500/15" title="Unexcused Absences">UU: {uuCount}</span>
                            </div>
                          </td>

                          {/* Leaves */}
                          <td className="p-4 text-center">
                            <div className="flex flex-col items-center justify-center gap-1 text-[9px] font-mono">
                              <div>
                                <span className="text-white/60">CL: {clCount}</span>
                                <span className="text-white/40"> / Allowed: {allowedCasualLeaves}</span>
                              </div>
                              <div>
                                <span className="text-white/60">ML: {mlCount}</span>
                                <span className="text-white/40"> / Allowed: {allowedMedicalLeaves}</span>
                              </div>
                            </div>
                          </td>

                          {/* Deductible Days */}
                          <td className="p-4 text-center font-bold font-mono text-xs text-red-400">
                            {totalUnpaidDays > 0 ? `${totalUnpaidDays.toFixed(1)} Days` : '0 Days'}
                          </td>

                          {/* Deductions */}
                          <td className="p-4 text-right font-mono text-xs text-red-500 font-bold">
                            {totalDeductions > 0 ? `-${activeSymbol}${totalDeductions.toFixed(2)}` : `${activeSymbol}0.00`}
                          </td>

                          {/* Net Payable */}
                          <td className="p-4 text-right font-mono text-xs text-green-400 font-bold">
                            {activeSymbol}{netPayable.toFixed(2)}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </main>
  );
}

function ProjectDetailsModal({
  project,
  teams,
  onClose,
  onUpdate,
  onDelete,
  workingHoursPerDay
}: {
  project: Project,
  teams: Team[],
  onClose: () => void,
  onUpdate: (id: string, updates: Partial<Project>) => void,
  onDelete: (id: string, reason: string) => void,
  workingHoursPerDay: number
}) {
  const [name, setName] = useState(project.name);
  const [status, setStatus] = useState(project.status);
  const [priority, setPriority] = useState(project.priority);
  const [teamId, setTeamId] = useState(project.team_id || '');
  const [pBest, setPBest] = useState(project.pert_best.toString());
  const [pLikely, setPLikely] = useState(project.pert_likely.toString());
  const [pWorst, setPWorst] = useState(project.pert_worst.toString());
  const [proposedStartDate, setProposedStartDate] = useState(project.proposed_start_date?.substring(0, 10) || '');
  const [clientDeadline, setClientDeadline] = useState(project.client_deadline?.substring(0, 10) || '');
  const [deleteReason, setDeleteReason] = useState('');
  const [isDeleting, setIsDeleting] = useState(false);

  const hasAllData = pBest !== '' && pLikely !== '' && pWorst !== '' && proposedStartDate !== '' && clientDeadline !== '';

  const team = teams.find(t => t.id === teamId);
  const parsedTeamData = team ? (typeof team.data === 'string' ? JSON.parse(team.data) : team.data) : null;
  const engineerCount = Math.max(1, parsedTeamData?.developer_ids?.length || 1);

  const expectedRealHours = calculateExpectedTime(Number(pBest), Number(pLikely), Number(pWorst));
  const productiveHoursPerDay = workingHoursPerDay * 0.8;
  const calendarExpected = (expectedRealHours / productiveHoursPerDay / engineerCount).toFixed(2);
  const variance = calculateVariance(Number(pBest), Number(pWorst));
  const stdDev = Math.sqrt(variance);

  const [changeReasonPrompt, setChangeReasonPrompt] = useState<{ changes: any, open: boolean }>({ changes: null, open: false });
  const [changeReason, setChangeReason] = useState('');
  const [showLogs, setShowLogs] = useState(false);

  const logs = useMemo(() => {
    return (project.tags || []).filter(t => t.startsWith('LOG:')).map(t => JSON.parse(t.substring(4)));
  }, [project.tags]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    const changes: string[] = [];
    if (status !== project.status) changes.push(`Status (${project.status} -> ${status})`);
    if (priority !== project.priority) changes.push(`Priority (${project.priority} -> ${priority})`);
    if ((teamId || null) !== (project.team_id || null)) {
      const oldTeam = teams.find(t => t.id === project.team_id)?.name || 'UNALLOCATED';
      const newTeam = teams.find(t => t.id === teamId)?.name || 'UNALLOCATED';
      changes.push(`Squad (${oldTeam} -> ${newTeam})`);
    }
    const oldDeadline = project.client_deadline?.substring(0, 10) || 'None';
    const newDeadline = clientDeadline || 'None';
    if (oldDeadline !== newDeadline) changes.push(`Client Deadline (${oldDeadline} -> ${newDeadline})`);

    const oldStart = project.proposed_start_date?.substring(0, 10) || 'None';
    const newStart = proposedStartDate || 'None';
    if (oldStart !== newStart) changes.push(`Proposed Start (${oldStart} -> ${newStart})`);

    const updates = {
      name,
      status: status as any,
      priority: priority as any,
      team_id: teamId || null,
      pert_best: Number(pBest),
      pert_likely: Number(pLikely),
      pert_worst: Number(pWorst),
      proposed_start_date: proposedStartDate || null,
      client_deadline: clientDeadline || null
    };

    if (changes.length > 0) {
      setChangeReasonPrompt({ changes: { ...updates, _log_summary: changes.join(', ') }, open: true });
    } else {
      onUpdate(project.id, updates);
      onClose();
    }
  };

  const handleConfirmChange = () => {
    if (!changeReason) return;
    const logEntry = JSON.stringify({
      timestamp: new Date().toISOString(),
      changes: changeReasonPrompt.changes._log_summary,
      reason: changeReason
    });

    const updatedTags = [...(project.tags || []), `LOG:${logEntry}`];
    const finalUpdates = { ...changeReasonPrompt.changes, tags: updatedTags };
    delete finalUpdates._log_summary;

    onUpdate(project.id, finalUpdates);
    setChangeReasonPrompt({ changes: null, open: false });
    onClose();
  };

  const startDate = proposedStartDate ? new Date(proposedStartDate) : new Date(project.created_at);
  const now = new Date();
  const daysPassed = Math.max(0, (now.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
  const remainingDays = Math.max(0, Number(calendarExpected) - daysPassed);
  const completionDate = new Date(startDate.getTime() + Number(calendarExpected) * 24 * 60 * 60 * 1000);

  const deadline = clientDeadline ? new Date(clientDeadline) : null;
  const deadlineVariance = deadline ? Math.floor((deadline.getTime() - completionDate.getTime()) / (1000 * 60 * 60 * 24)) : null;

  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center p-6">
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose} className="absolute inset-0 bg-[#0a0a0a]/95 backdrop-blur-md" />
      <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }} className="relative bg-[#0c0c0c] border border-white/10 w-full max-w-2xl overflow-hidden shadow-2xl">

        {showLogs && (
          <div className="absolute inset-0 z-50 bg-[#0c0c0c] flex flex-col">
            <div className="p-6 border-b border-white/10 flex justify-between items-center bg-[#0a0a0a]">
              <h4 className="text-sm font-mono text-white/90 uppercase tracking-widest flex items-center gap-2"><History className="w-4 h-4" /> Asset Modification Log</h4>
              <button type="button" onClick={() => setShowLogs(false)} className="p-2 border border-white/10 hover:bg-white/5 transition-colors"><Plus className="w-4 h-4 rotate-45 text-white/75" /></button>
            </div>
            <div className="flex-1 p-6 overflow-y-auto space-y-4">
              {logs.length === 0 ? (
                <p className="text-xs font-mono text-white/50 italic">No historical adjustments recorded.</p>
              ) : (
                [...logs].reverse().map((log, i) => (
                  <div key={i} className="border border-white/10 bg-white/5 p-4 flex flex-col gap-2">
                    <p className="text-[10px] font-mono text-white/50">{new Date(log.timestamp).toLocaleString()}</p>
                    <p className="text-xs font-mono text-white/90 leading-relaxed"><span className="text-white/50 uppercase tracking-widest text-[9px] mr-2">CHANGES:</span> {log.changes}</p>
                    <p className="text-xs font-mono text-yellow-500/90 leading-relaxed"><span className="text-white/50 uppercase tracking-widest text-[9px] mr-2">REASON:</span> {log.reason}</p>
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {changeReasonPrompt.open && (
          <div className="absolute inset-0 z-50 bg-[#0c0c0c]/95 backdrop-blur-sm flex items-center justify-center p-8">
            <div className="w-full max-w-md bg-black border border-white/20 p-6 space-y-4 shadow-2xl">
              <div className="flex items-center gap-2 mb-2">
                <Activity className="w-4 h-4 text-yellow-500" />
                <h4 className="text-sm font-mono text-white/90 uppercase tracking-widest">Reason for Adjustment</h4>
              </div>
              <p className="text-[10px] font-mono text-white/60">The following adjustments require documentation for compliance:</p>
              <ul className="text-[10px] font-mono text-white/80 list-disc pl-4 space-y-1">
                {changeReasonPrompt.changes._log_summary.split(', ').map((c: string) => <li key={c}>{c}</li>)}
              </ul>
              <textarea
                autoFocus
                required
                value={changeReason}
                onChange={e => setChangeReason(e.target.value)}
                className="w-full bg-[#0a0a0a] border border-white/20 p-3 text-xs font-mono min-h-[100px] focus:border-white/50 outline-none"
                placeholder="Enter reason for modifying these parameters..."
              />
              <div className="flex gap-2 pt-2">
                <button type="button" onClick={handleConfirmChange} disabled={!changeReason} className="flex-1 bg-white text-black text-[10px] uppercase font-mono py-2 disabled:opacity-50 tracking-widest font-semibold">Log & Commit</button>
                <button type="button" onClick={() => setChangeReasonPrompt({ changes: null, open: false })} className="flex-1 border border-white/20 text-white/70 text-[10px] uppercase font-mono py-2 hover:bg-white/5 tracking-widest">Cancel</button>
              </div>
            </div>
          </div>
        )}

        <div className="p-8">
          <div className="flex justify-between items-start mb-8">
            <div>
              <div className="flex items-center gap-2 mb-2">
                <BrainCircuit className="w-4 h-4 text-white/85" />
                <span className="text-[10px] font-mono text-white/80 uppercase tracking-[0.2em]">Asset Analysis Console</span>
              </div>
              <h3 className="text-2xl font-medium tracking-tight">Predictive Workspace: {project.name}</h3>
            </div>
            <button onClick={onClose} className="p-2 border border-white/10 hover:bg-white/5 transition-colors">
              <Plus className="w-5 h-5 rotate-45 text-white/75" />
            </button>
          </div>

          <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div className="space-y-6">
              <div>
                <label className="block text-[10px] uppercase font-mono text-white/85 mb-2">Project Designation</label>
                <input value={name} onChange={e => setName(e.target.value)} className="w-full bg-black border border-white/10 h-11 px-4 font-mono text-sm focus:border-white/40 outline-none" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] uppercase font-mono text-white/85 mb-2">Status</label>
                  <select value={status} onChange={e => setStatus(e.target.value as any)} className="w-full bg-black border border-white/10 h-11 px-3 font-mono text-xs focus:border-white/40 outline-none">
                    <option value="planning">PLANNING</option>
                    <option value="in-progress">IN_PROGRESS</option>
                    <option value="review">REVIEW</option>
                    <option value="deployed">DEPLOYED</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[10px] uppercase font-mono text-white/85 mb-2">Priority</label>
                  <select value={priority} onChange={e => setPriority(e.target.value as any)} className="w-full bg-black border border-white/10 h-11 px-3 font-mono text-xs focus:border-white/40 outline-none">
                    <option value="low">LOW</option>
                    <option value="medium">MEDIUM</option>
                    <option value="high">HIGH</option>
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] uppercase font-mono text-white/85 mb-2">Proposed Start</label>
                  <input type="date" value={proposedStartDate} onChange={e => setProposedStartDate(e.target.value)} className="w-full bg-black border border-white/10 h-11 px-3 font-mono text-xs focus:border-white/40 outline-none" />
                </div>
                <div>
                  <label className="block text-[10px] uppercase font-mono text-white/85 mb-2">Client Deadline</label>
                  <input type="date" value={clientDeadline} onChange={e => setClientDeadline(e.target.value)} className="w-full bg-black border border-white/10 h-11 px-3 font-mono text-xs focus:border-white/40 outline-none" />
                </div>
              </div>
              <div>
                <label className="block text-[10px] uppercase font-mono text-white/85 mb-2">Allocate Squad</label>
                <select value={teamId} onChange={e => setTeamId(e.target.value)} className="w-full bg-black border border-white/10 h-11 px-3 font-mono text-xs focus:border-white/40 outline-none">
                  <option value="">UNALLOCATED</option>
                  {teams.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                </select>
              </div>

              <div className="pt-4 border-t border-white/10 flex items-center justify-between gap-4">
                <button
                  type="button"
                  onClick={() => setShowLogs(true)}
                  className="flex items-center gap-2 text-xs font-mono text-blue-400 hover:text-blue-300 transition-colors uppercase tracking-widest whitespace-nowrap"
                >
                  <History className="w-4 h-4" /> View Logs
                </button>

                {!isDeleting ? (
                  <button
                    type="button"
                    onClick={() => setIsDeleting(true)}
                    className="flex items-center gap-2 text-xs font-mono text-red-500 hover:text-red-400 transition-colors uppercase tracking-widest whitespace-nowrap"
                  >
                    <Trash2 className="w-4 h-4" /> Decommission
                  </button>
                ) : (
                  <div className="space-y-3">
                    <label className="block text-[10px] uppercase font-mono text-red-500/80">Reason for Decommissioning</label>
                    <textarea
                      required
                      value={deleteReason}
                      onChange={e => setDeleteReason(e.target.value)}
                      className="w-full bg-black border border-red-500/30 p-3 font-mono text-xs focus:border-red-500 outline-none min-h-[80px]"
                      placeholder="Specify reason..."
                    />
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => onDelete(project.id, deleteReason)}
                        className="flex-1 bg-red-500 text-white py-2 text-[10px] font-mono uppercase tracking-widest hover:bg-red-600 transition-colors"
                      >
                        Confirm Delete
                      </button>
                      <button
                        type="button"
                        onClick={() => setIsDeleting(false)}
                        className="flex-1 border border-white/10 text-white/70 py-2 text-[10px] font-mono uppercase tracking-widest hover:bg-white/5 transition-colors"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>

            <div className="space-y-6">
              <div className="bg-white/5 border border-white/10 p-6 rounded-sm relative overflow-hidden">
                <div className="absolute top-0 right-0 p-3 opacity-10"><Activity className="w-12 h-12" /></div>
                <h4 className="text-[10px] font-mono text-white/85 uppercase tracking-widest mb-4">Predictive Outcome</h4>

                {hasAllData ? (
                  <>
                    <div className="grid grid-cols-2 gap-4 mb-6">
                      <div className="bg-white/5 p-3">
                        <p className="text-[10px] font-mono text-white/75 uppercase mb-1">Total Real Hours</p>
                        <p className="text-xl font-mono">{expectedRealHours.toFixed(1)}h</p>
                      </div>
                      <div className="bg-white/5 p-3">
                        <p className="text-[10px] font-mono text-white/75 uppercase mb-1">Working Days</p>
                        <p className="text-xl font-mono">{calendarExpected}d</p>
                      </div>
                      <div className="bg-blue-500/10 p-3 border border-blue-500/20">
                        <p className="text-[10px] font-mono text-blue-400 uppercase mb-1">Remaining ETA</p>
                        <p className="text-xl font-mono text-blue-400">{remainingDays.toFixed(1)}d</p>
                      </div>
                      <div className={`p-3 border ${deadlineVariance !== null && deadlineVariance < 0 ? 'bg-red-500/10 border-red-500/20' : 'bg-green-500/10 border-green-500/20'}`}>
                        <p className={`text-[10px] font-mono uppercase mb-1 ${deadlineVariance !== null && deadlineVariance < 0 ? 'text-red-400' : 'text-green-400'}`}>Variance</p>
                        <p className={`text-xl font-mono ${deadlineVariance !== null && deadlineVariance < 0 ? 'text-red-400' : 'text-green-400'}`}>
                          {deadlineVariance !== null ? `${Math.abs(deadlineVariance)}d ${deadlineVariance < 0 ? 'behind' : 'ahead'}` : 'N/A'}
                        </p>
                      </div>
                    </div>

                    <div className="mb-6">
                      <p className="text-[10px] font-mono text-white/75 uppercase mb-2">Predicted End</p>
                      <p className="text-lg font-mono text-white">{completionDate.toLocaleDateString('en-GB', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</p>
                    </div>
                  </>
                ) : (
                  <div className="bg-yellow-500/10 border border-yellow-500/20 p-4 mb-6 flex items-start gap-3">
                    <AlertTriangle className="w-5 h-5 text-yellow-500 shrink-0 mt-0.5" />
                    <div>
                      <p className="text-xs font-mono text-yellow-500 uppercase tracking-widest mb-1">Calculation Suspended</p>
                      <p className="text-[10px] font-mono text-yellow-500/80 leading-relaxed">Please obtain and input all PERT estimates and timeline constraints to initiate the predictive outcome engine.</p>
                    </div>
                  </div>
                )}

                <div className="grid grid-cols-3 gap-2 mb-6">
                  <div><p className="text-[9px] font-mono text-white/90 uppercase tracking-tighter mb-1">BEST (H)</p><input type="number" step="0.1" value={pBest} onChange={e => setPBest(e.target.value)} className="w-full bg-black/40 border border-white/10 text-center py-1 font-mono text-[10px] text-white" /></div>
                  <div><p className="text-[9px] font-mono text-white/90 uppercase tracking-tighter mb-1">LIKELY (H)</p><input type="number" step="0.1" value={pLikely} onChange={e => setPLikely(e.target.value)} className="w-full bg-black/40 border border-white/10 text-center py-1 font-mono text-[10px] text-white" /></div>
                  <div><p className="text-[9px] font-mono text-white/90 uppercase tracking-tighter mb-1">WORST (H)</p><input type="number" step="0.1" value={pWorst} onChange={e => setPWorst(e.target.value)} className="w-full bg-black/40 border border-white/10 text-center py-1 font-mono text-[10px] text-white" /></div>
                </div>

                {hasAllData && (
                  <div className="pt-4 border-t border-white/5">
                    <div className="flex justify-between items-center"><span className="text-[11px] font-mono text-white/75 uppercase tracking-tighter">Variance calibration</span><span className="text-[10px] font-mono text-yellow-500/80">±{stdDev.toFixed(2)}σ</span></div>
                    <p className="text-[10px] font-mono text-white/70 mt-1 italic leading-tight">Parallel processing factor: {engineerCount} engineers.</p>
                  </div>
                )}
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
          <button onClick={onClose} className="p-2 border border-white/10 hover:bg-white/5 transition-colors"><Plus className="w-5 h-5 rotate-45 text-white/75" /></button>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          {teams.map(team => {
            const data = typeof team.data === 'string' ? JSON.parse(team.data) : team.data;
            const pm = profiles.find(p => p.id === data?.pm_id);
            const engineers = (data?.developer_ids || []).map((id: string) => profiles.find(p => p.id === id)).filter(Boolean);
            return (
              <div key={team.id} className="border border-white/10 p-6 bg-white/5">
                <div className="flex items-center gap-3 mb-6">
                  <div className="w-8 h-8 rounded-sm bg-white/10 flex items-center justify-center border border-white/10"><Zap className="w-4 h-4 text-white/90" /></div>
                  <h4 className="text-lg font-medium">{team.name}</h4>
                </div>
                <div className="space-y-6">
                  <div><p className="text-[11px] font-mono text-white/75 uppercase mb-2">Squad Lead</p><p className="text-sm text-blue-400 font-mono">{pm?.full_name || pm?.email || 'N/A'}</p></div>
                  <div>
                    <p className="text-[11px] font-mono text-white/75 uppercase mb-2">Engineering Corps ({engineers.length})</p>
                    <div className="space-y-1">
                      {engineers.map((e: any) => <p key={e.id} className="text-xs text-white/90 font-mono">{e.full_name || e.email}</p>)}
                      {engineers.length === 0 && <p className="text-xs text-white/75 italic font-mono">No personnel assigned</p>}
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
function UserProfileModal({ profile, googleAvatar, onClose, onUpdate }: { profile: Profile, googleAvatar?: string | null, onClose: () => void, onUpdate: (updates: Partial<Profile>) => void }) {
  const [name, setName] = useState(profile.full_name || '');
  const [phone, setPhone] = useState(profile.phone || '');
  const [avatarUrl, setAvatarUrl] = useState(profile.avatar_url || '');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onUpdate({ full_name: name, phone, avatar_url: avatarUrl });
    onClose();
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 2 * 1024 * 1024) {
        alert("Image too large. Please select a file under 2MB.");
        return;
      }
      const reader = new FileReader();
      reader.onloadend = () => {
        setAvatarUrl(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  return (
    <div className="fixed inset-0 z-[130] flex items-center justify-center p-6">
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose} className="absolute inset-0 bg-[#0a0a0a]/95 backdrop-blur-md" />
      <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }} className="relative bg-[#0c0c0c] border border-white/10 w-full max-w-md p-8 shadow-2xl">
        <div className="flex items-center gap-3 mb-8 pb-4 border-b border-white/10">
          <div className="w-16 h-16 border border-white/10 bg-white/5 flex items-center justify-center overflow-hidden">
            {avatarUrl ? (
              <img src={avatarUrl} alt="Preview" className="w-full h-full object-cover" />
            ) : (
              <Users className="w-6 h-6 text-white/40" />
            )}
          </div>
          <div className="flex-1">
            <h3 className="text-xl font-medium tracking-tight uppercase">Identity Profile</h3>
            <p className="text-[10px] font-mono text-white/75 uppercase tracking-widest">{profile.email}</p>
            <div className="mt-2 flex gap-2">
              <input type="file" accept="image/*" className="hidden" id="avatar-upload" onChange={handleFileChange} />
              <label htmlFor="avatar-upload" className="text-[9px] font-mono text-blue-400 border border-blue-400/20 px-2 py-0.5 hover:bg-blue-400/10 cursor-pointer transition-all">
                GALLERY_UPLOAD
              </label>
            </div>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label className="block text-[10px] uppercase font-mono text-white/85 mb-2">Full Name</label>
            <input
              autoFocus
              required
              type="text"
              value={name}
              onChange={e => setName(e.target.value)}
              className="w-full bg-black border border-white/10 h-11 px-4 font-mono text-sm focus:border-white/40 outline-none"
              placeholder="e.g. John Doe"
            />
          </div>

          <div>
            <label className="block text-[10px] uppercase font-mono text-white/85 mb-2">Phone / Contact (10 Digits)</label>
            <input
              type="tel"
              pattern="[0-9]{10}"
              title="Please enter a full 10 digit phone number"
              required
              value={phone}
              onChange={e => setPhone(e.target.value)}
              className="w-full bg-black border border-white/10 h-11 px-4 font-mono text-sm focus:border-white/40 outline-none"
              placeholder="e.g. 1234567890"
            />
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="block text-[10px] uppercase font-mono text-white/85">Profile Identity Source</label>
              <div className="flex gap-2">
                {googleAvatar && avatarUrl !== googleAvatar && (
                  <button
                    type="button"
                    onClick={() => setAvatarUrl(googleAvatar)}
                    className="text-[9px] font-mono text-yellow-500 border border-yellow-500/20 px-2 py-0.5 hover:bg-yellow-500/10 transition-all uppercase"
                  >
                    Restore Google
                  </button>
                )}
                <input type="file" accept="image/*" className="hidden" id="avatar-upload" onChange={handleFileChange} />
                <label htmlFor="avatar-upload" className="text-[9px] font-mono text-blue-400 border border-blue-400/20 px-2 py-0.5 hover:bg-blue-400/10 cursor-pointer transition-all uppercase">
                  [+ Gallery Photo]
                </label>
              </div>
            </div>

            {avatarUrl?.startsWith('data:image') ? (
              <div className="flex items-center gap-2">
                <div className="flex-1 bg-white/5 border border-white/10 h-11 px-4 font-mono text-[10px] flex items-center text-blue-400/80 italic">
                  LOCAL_GALLERY_OVERRIDE_ACTIVE
                </div>
                <button
                  type="button"
                  onClick={() => setAvatarUrl('')}
                  className="h-11 px-4 border border-red-500/30 text-red-400 font-mono text-[9px] uppercase hover:bg-red-500/10 transition-all"
                >
                  Clear
                </button>
              </div>
            ) : avatarUrl === googleAvatar && googleAvatar ? (
              <div className="flex items-center gap-2">
                <div className="flex-1 bg-white/5 border border-white/10 h-11 px-4 font-mono text-[10px] flex items-center text-green-400/80 italic">
                  GOOGLE_ACCOUNT_LINKED
                </div>
                <button
                  type="button"
                  onClick={() => setAvatarUrl('')}
                  className="h-11 px-4 border border-red-500/30 text-red-400 font-mono text-[9px] uppercase hover:bg-red-500/10 transition-all"
                >
                  Clear
                </button>
              </div>
            ) : (
              <input
                type="url"
                value={avatarUrl}
                onChange={e => setAvatarUrl(e.target.value)}
                className="w-full bg-black border border-white/10 h-11 px-4 font-mono text-sm focus:border-white/40 outline-none"
                placeholder="Enter image URL or upload from gallery..."
              />
            )}
          </div>

          <div className="bg-white/5 border border-white/10 p-3 text-[10px] font-mono text-white/60 leading-relaxed italic border-l-2 border-l-blue-500/40">
            Note: Your profile picture is automatically synced from Google. Uploading from your gallery will create a temporary local override for this device.
          </div>
          <div className="flex gap-4">
            <button type="submit" className="flex-1 bg-white text-black h-12 font-semibold uppercase tracking-widest text-[10px] hover:bg-neutral-200 transition-all">
              Update Identity
            </button>
            <button type="button" onClick={onClose} className="flex-1 border border-white/10 text-white/85 h-12 font-semibold uppercase tracking-widest text-[10px] hover:bg-white/5 transition-all">
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
  const [isLogisticsView, setIsLogisticsView] = useState(false);
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);
  const [isRosterOpen, setIsRosterOpen] = useState(false);
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [dashboardTab, setDashboardTab] = useState<'active' | 'completed'>('active');
  const [workingHoursPerDay, setWorkingHoursPerDay] = useState(8);
  const [tilesPerRow, setTilesPerRow] = useState(3);
  const [aiInsight, setAiInsight] = useState("Awaiting telemetry...");



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
  const [proposedStartDate, setProposedStartDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [newClientDeadline, setNewClientDeadline] = useState<string>('');
  const [newPriority, setNewPriority] = useState<string>('medium');
  const [newTeamId, setNewTeamId] = useState<string>('');

  useEffect(() => {
    const initAuth = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      setUser(session?.user || null);

      if (session?.user) {
        await syncProfile(session.user);
        await Promise.all([
          fetchProjects(),
          fetchTeams(),
          fetchProfiles()
        ]);
      }

      // Clear stale OAuth hash fragments from URL to prevent expired session warnings
      if (window.location.hash && window.location.hash.includes('access_token')) {
        window.history.replaceState(null, '', window.location.pathname);
      }

      supabase.auth.onAuthStateChange(async (_event, session) => {
        setUser(session?.user || null);
        if (session?.user) {
          await syncProfile(session.user);
          await Promise.all([
            fetchProjects(),
            fetchTeams(),
            fetchProfiles()
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

    const projectsSub = supabase.channel('public:projects')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'projects' }, () => {
        fetchProjects();
      }).subscribe();

    const teamsSub = supabase.channel('public:teams')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'teams' }, () => {
        fetchTeams();
      }).subscribe();

    const profilesSub = supabase.channel('public:profiles')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'profiles' }, (payload) => {
        fetchProfiles();
        const newEmail = payload.new.email;
        notify(`New member onboarded: ${newEmail}`, 'info');
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'profiles' }, () => {
        fetchProfiles();
      })
      .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'profiles' }, () => {
        fetchProfiles();
      }).subscribe();

    return () => {
      supabase.removeChannel(projectsSub);
      supabase.removeChannel(teamsSub);
      supabase.removeChannel(profilesSub);
    };
  }, []);

  const activeTeams = useMemo(() => teams.filter(t => t.name !== 'SYSTEM_SETTINGS'), [teams]);

  useEffect(() => {
    if (loading || projects.length === 0) return;

    const fetchInsight = async () => {
      setAiInsight("Analyzing telemetry...");
      const activeProjects = projects.filter(p => p.status !== 'deployed');
      
      let totalDecayHours = 0;
      activeProjects.forEach(p => {
        const expected = calculateExpectedTime(p.pert_best, p.pert_likely, p.pert_worst);
        if (p.pert_worst > expected) {
          totalDecayHours += (p.pert_worst - expected);
        }
      });

      const deliveryConfidence = Math.max(0, 100 - (totalDecayHours * 0.5));
      const teamsWithProjects = new Set(activeProjects.filter(p => p.team_id).map(p => p.team_id));
      const teamBandwidth = activeTeams.length > 0 ? (teamsWithProjects.size / activeTeams.length) * 100 : 0;

      const overloadedSquads = activeTeams.map(t => {
        const parsedData = typeof t.data === 'string' ? JSON.parse(t.data) : t.data;
        const engineerCount = Math.max(1, parsedData?.developer_ids?.length || 1);
        const teamCapacityHours = 20 * (workingHoursPerDay * 0.8) * engineerCount;
        const teamProjects = activeProjects.filter(p => p.team_id === t.id);
        const totalExpected = teamProjects.reduce((acc, p) => acc + calculateExpectedTime(p.pert_best, p.pert_likely, p.pert_worst), 0);
        return { name: t.name, load: (totalExpected / teamCapacityHours) };
      }).filter(s => s.load > 1.0);

      const insightText = await generateSystemInsight({
        totalProjects: activeProjects.length,
        deliveryConfidence: Number(deliveryConfidence.toFixed(1)),
        teamBandwidth: Number(teamBandwidth.toFixed(1)),
        dailyFatigue: Number(totalDecayHours.toFixed(1)),
        overloadedSquads
      });

      setAiInsight(`"${insightText}"`);
    };

    const debounceId = setTimeout(fetchInsight, 2500);
    return () => clearTimeout(debounceId);
  }, [projects, activeTeams, workingHoursPerDay, loading]);

  useEffect(() => {
    const settingsTeam = teams.find(t => t.name === 'SYSTEM_SETTINGS');
    if (settingsTeam && settingsTeam.data && typeof (settingsTeam.data as any).workingHours === 'number') {
      setWorkingHoursPerDay((settingsTeam.data as any).workingHours);
    }
  }, [teams]);

  const handleWorkingHoursChange = async (h: number) => {
    setWorkingHoursPerDay(h);
    const { data: existing, error: findError } = await supabase
      .from('teams')
      .select('*')
      .eq('name', 'SYSTEM_SETTINGS')
      .maybeSingle();

    if (!findError && existing) {
      const mergedData = {
        ...existing.data,
        workingHours: h
      };
      await supabase.from('teams').update({ data: mergedData }).eq('id', existing.id);
    } else {
      await supabase.from('teams').insert({ name: 'SYSTEM_SETTINGS', data: { workingHours: h } });
    }
  };

  const handleSaveLogisticsData = async (updatedData: any) => {
    // Save to localStorage immediately as a fast fallback
    localStorage.setItem('SYSTEM_SETTINGS', JSON.stringify(updatedData));

    // Update in-memory state immediately so responsiveness is instantaneous
    setTeams(prevTeams => {
      const settingsTeam = prevTeams.find(t => t.name === 'SYSTEM_SETTINGS');
      if (settingsTeam) {
        return prevTeams.map(t => t.name === 'SYSTEM_SETTINGS' ? { ...t, data: { ...t.data, ...updatedData } } : t);
      } else {
        return [...prevTeams, { id: 'SYSTEM_SETTINGS', name: 'SYSTEM_SETTINGS', data: updatedData, created_at: new Date().toISOString() }];
      }
    });

    const { data: existing, error: findError } = await supabase
      .from('teams')
      .select('*')
      .eq('name', 'SYSTEM_SETTINGS')
      .maybeSingle();

    if (!findError && existing) {
      const mergedData = {
        ...existing.data,
        ...updatedData
      };
      const { error } = await supabase
        .from('teams')
        .update({ data: mergedData })
        .eq('id', existing.id);
      if (!error) {
        notify("Logistics telemetry synchronized.", "success");
        await fetchTeams();
      } else {
        console.warn("Supabase logistics sync failed, using localStorage fallback:", error);
      }
    } else {
      const { error } = await supabase
        .from('teams')
        .insert({ name: 'SYSTEM_SETTINGS', data: updatedData });
      if (!error) {
        notify("Logistics telemetry initialized.", "success");
        await fetchTeams();
      } else {
        console.warn("Supabase logistics init failed, using localStorage fallback:", error);
      }
    }
  };

  // fetchProfiles is now called globally on init to support ProjectCard lookups

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

    if (!error && data) {
      // If SYSTEM_SETTINGS is in the DB, sync with localStorage
      const settingsTeam = data.find(t => t.name === 'SYSTEM_SETTINGS');
      if (settingsTeam) {
        localStorage.setItem('SYSTEM_SETTINGS', JSON.stringify(settingsTeam.data));
      }
      setTeams(data);
    } else {
      // Fallback: check localStorage for SYSTEM_SETTINGS
      const localSettings = localStorage.getItem('SYSTEM_SETTINGS');
      if (localSettings) {
        const parsedSettings = JSON.parse(localSettings);
        setTeams([{ id: 'SYSTEM_SETTINGS', name: 'SYSTEM_SETTINGS', data: parsedSettings, created_at: new Date().toISOString() }]);
      }
    }
  };

  const syncProfile = async (u: any) => {
    try {
      // Pull avatar from Google if it exists
      const googleAvatar = u.user_metadata?.avatar_url || u.user_metadata?.picture;

      let data: any = null;
      let error: any = null;
      const res = await supabase
        .from('profiles')
        .select('id, email, role, full_name, phone, avatar_url')
        .eq('id', u.id)
        .single();
      data = res.data;
      error = res.error;

      // Handle common schema mismatch errors
      if (error && (error.message?.includes('full_name') || error.message?.includes('avatar_url'))) {
        console.warn("Schema mismatch detected: falling back to basic profile select.");
        const fallback = await supabase
          .from('profiles')
          .select('id, email, role')
          .eq('id', u.id)
          .single();
        data = fallback.data;
        error = fallback.error;
      }

      if (error && error.code !== 'PGRST116') throw error;

      if (!data) {
        // Decide initial role
        const { count: totalCount, error: countError } = await supabase
          .from('profiles')
          .select('*', { count: 'exact', head: true });

        if (countError) console.error("Initial role check failed:", countError);
        const newRole: UserRole = (!countError && totalCount === 0) ? 'super_admin' : 'viewer';

        // Attempt to insert full profile
        const { data: newProfile, error: insertError } = await supabase
          .from('profiles')
          .insert({
            id: u.id,
            email: u.email,
            role: newRole,
            avatar_url: googleAvatar
          })
          .select()
          .single();

        if (insertError) {
          console.error("Primary profile insert failed:", insertError);
          // Fallback insert with only core fields
          const { data: retryProfile, error: retryError } = await supabase
            .from('profiles')
            .insert({
              id: u.id,
              email: u.email,
              role: newRole
            })
            .select()
            .single();

          if (retryError) throw retryError;
          setProfile(retryProfile);
        } else {
          setProfile(newProfile);
        }
        // Welcome toast for new users
        const welcomeName = u.user_metadata?.full_name || u.email?.split('@')[0] || 'Engineer';
        notify(`Welcome aboard, ${welcomeName}! Complete your identity profile to get started.`, 'info');
        fetchProfiles();
        setIsProfileOpen(true);
      } else {
        // Auto-sync Google avatar for existing users if missing
        if (!data.avatar_url && googleAvatar) {
          const { data: updatedProfile, error: updateError } = await supabase
            .from('profiles')
            .update({ avatar_url: googleAvatar })
            .eq('id', u.id)
            .select()
            .single();

          if (!updateError && updatedProfile) {
            data = updatedProfile;
          }
        }

        setProfile(data);
        if (!data.full_name || !data.phone) {
          setIsProfileOpen(true);
        }
      }
    } catch (e: any) {
      console.error("Profile sync failed:", e);
      const detailedError = e.message || e.details || "Database connection error (Code 103)";
      notify(`Identity Sync Failed: ${detailedError}`, "error");
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
    // Relieve squad and snapshot history upon completion
    if (updates.status === 'deployed') {
      const project = projects.find(p => p.id === id);
      const team = teams.find(t => t.id === (updates.team_id || project?.team_id));
      if (team) {
        const historyTag = `SQUAD:${team.name}`;
        const currentTags = updates.tags || project?.tags || [];
        updates.tags = [...currentTags.filter(t => !t.startsWith('SQUAD:')), historyTag, 'FINALIZED'];
        (updates as any).team_id = null;
      }
    }

    const { data, error } = await supabase
      .from('projects')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (!error && data) {
      setProjects(projects.map(p => p.id === id ? data : p));
      notify("Asset metrics synchronized.", "success");
      fetchProjects();
    } else {
      console.error("Metadata update failed:", error);
      notify(`Sync failed: ${error?.message || "Unknown error"}`, "error");
    }
  };

  const handleUpdateProfile = async (updates: Partial<Profile>) => {
    if (!user) return;
    const { data, error } = await supabase
      .from('profiles')
      .update(updates)
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
      fetchProfiles();
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

  const handleDeleteProject = async (id: string, reason: string) => {
    askConfirmation(
      "Decommission Asset",
      `Are you sure you want to decommission this engineering asset? Reason: ${reason}`,
      async () => {
        const { error } = await supabase
          .from('projects')
          .delete()
          .eq('id', id);

        if (!error) {
          setProjects(projects.filter(p => p.id !== id));
          notify("Asset successfully decommissioned.", "success");
          setSelectedProject(null);
          fetchProjects();
        } else {
          console.error("Asset deletion failed:", error);
          notify(`Deletion failed: ${error.message}`, "error");
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
      priority: newPriority,
      efficiency: 0.8,
      pert_best: Number(pertBest) || 0,
      pert_likely: Number(pertLikely) || 0,
      pert_worst: Number(pertWorst) || 0,
      proposed_start_date: proposedStartDate || null,
      client_deadline: newClientDeadline || null,
      team_id: newTeamId || null,
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
      setProposedStartDate('');
      setNewClientDeadline('');
      setNewPriority('medium');
      setNewTeamId('');
      notify("Asset successfully committed to system.", "success");
      fetchProjects();
    } else {
      console.error("Project creation failed:", error);
      notify(`System Error: ${error?.message || "Failed to commit asset"}`, "error");
    }
  };

  const getSuggestedSquad = () => {
    if (activeTeams.length === 0) return null;
    const stats = activeTeams.map(t => {
      const teamProjects = projects.filter(p => p.team_id === t.id && p.status !== 'deployed');
      const load = teamProjects.reduce((acc, p) => acc + calculateExpectedTime(p.pert_best, p.pert_likely, p.pert_worst), 0);
      const eff = teamProjects.length > 0 ? teamProjects.reduce((acc, p) => acc + p.efficiency, 0) / teamProjects.length : 1;
      return { id: t.id, name: t.name, load, eff };
    });
    return stats.sort((a, b) => a.load !== b.load ? a.load - b.load : b.eff - a.eff)[0];
  };

  const filteredProjects = projects.filter(p => {
    const matchesSearch = p.name.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesTab = dashboardTab === 'active' ? p.status !== 'deployed' : p.status === 'deployed';
    return matchesSearch && matchesTab;
  });

  const calculateDynamicStats = () => {
    const activeProjects = projects.filter(p => p.status !== 'deployed');
    let totalDecayHours = 0;
    activeProjects.forEach(p => {
      const expected = calculateExpectedTime(p.pert_best, p.pert_likely, p.pert_worst);
      if (p.pert_worst > expected) {
        totalDecayHours += (p.pert_worst - expected); // Removed *24 multiplier, PERT is already in hours
      }
    });

    const deliveryConfidence = Math.max(0, 100 - (totalDecayHours * 0.5));
    
    const teamsWithProjects = new Set(activeProjects.filter(p => p.team_id).map(p => p.team_id));
    const teamBandwidth = activeTeams.length > 0 ? (teamsWithProjects.size / activeTeams.length) * 100 : 0;

    return {
      totalProjects: activeProjects.length,
      deliveryConfidence: Number(deliveryConfidence.toFixed(1)),
      teamBandwidth: Number(teamBandwidth.toFixed(1)),
      dailyFatigue: Number(totalDecayHours.toFixed(1)),
      insight: aiInsight
    };
  };

  const stats: Stats = useMemo(() => calculateDynamicStats(), [projects, activeTeams, aiInsight]);

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0a0a0a] flex flex-col items-center justify-center gap-4">
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
          className="w-12 h-12 border-2 border-white/10 border-t-white rounded-full"
        />
        <p className="font-mono text-sm uppercase tracking-widest text-white/85">Initializing Core Engine...</p>
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
        onToggleAdmin={() => {
          setIsAdminView(!isAdminView);
          setIsLogisticsView(false);
        }}
        showAdmin={isAdminView}
        onToggleLogistics={() => {
          setIsLogisticsView(!isLogisticsView);
          setIsAdminView(false);
        }}
        showLogistics={isLogisticsView}
        workingHours={workingHoursPerDay}
        setWorkingHours={handleWorkingHoursChange}
        tilesPerRow={tilesPerRow}
        setTilesPerRow={setTilesPerRow}
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

      {isLogisticsView && (profile?.role === 'super_admin' || profile?.role === 'pm') ? (
        <LogisticsDashboard
          profiles={profiles}
          teams={teams}
          onSaveData={handleSaveLogisticsData}
        />
      ) : isAdminView && profile?.role === 'super_admin' ? (
        <AdminDashboard
          profiles={profiles}
          teams={activeTeams}
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
                  <div className="flex items-center gap-6 mb-2">
                    <h2 className="text-3xl font-medium tracking-tight">Project Workspace</h2>
                    <div className="flex bg-white/5 p-1 border border-white/5">
                      <button
                        onClick={() => setDashboardTab('active')}
                        className={`px-3 py-1 text-[9px] font-mono uppercase tracking-widest transition-all ${dashboardTab === 'active' ? 'bg-white text-black' : 'text-white/40 hover:text-white'}`}
                      >
                        Active
                      </button>
                      <button
                        onClick={() => setDashboardTab('completed')}
                        className={`px-3 py-1 text-[9px] font-mono uppercase tracking-widest transition-all ${dashboardTab === 'completed' ? 'bg-white text-black' : 'text-white/40 hover:text-white'}`}
                      >
                        Completed
                      </button>
                    </div>
                  </div>
                  <p className="text-sm text-white/85 font-mono tracking-tighter">
                    {dashboardTab === 'active'
                      ? "Precision forecasting through engineering overhead modeling and historical drift correction."
                      : "Historical repository of finalized assets and squad attribution data."}
                  </p>
                </div>

                <div className="flex items-center gap-4 w-full md:w-auto">
                  <div className="relative flex-1 md:w-64">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/80" />
                    <input
                      type="text"
                      placeholder="Query system assets..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="w-full bg-[#0c0c0c] border border-white/10 h-10 pl-10 pr-4 text-sm font-mono focus:border-white/30 outline-none transition-all placeholder:text-white/70"
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

              <div className={`grid grid-cols-1 ${tilesPerRow === 2 ? 'md:grid-cols-2' :
                tilesPerRow === 3 ? 'md:grid-cols-2 xl:grid-cols-3' :
                  'md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4'
                } gap-6`}>
                <AnimatePresence mode="popLayout">
                  {filteredProjects.map((project) => (
                    <motion.div
                      layout
                      initial={{ opacity: 0, scale: 0.95, y: 10 }}
                      animate={{ opacity: 1, scale: 1, y: 0 }}
                      exit={{ opacity: 0, scale: 0.95, y: -10 }}
                      transition={{ duration: 0.2 }}
                      key={project.id}
                    >
                      <ProjectCard
                        project={project}
                        teams={activeTeams}
                        profiles={profiles}
                        workingHoursPerDay={workingHoursPerDay}
                        onClick={setSelectedProject}
                      />
                    </motion.div>
                  ))}
                </AnimatePresence>

                {filteredProjects.length === 0 && (
                  <div className="col-span-full border-2 border-dashed border-white/5 py-24 flex flex-col items-center justify-center text-center opacity-50">
                    <div className="w-16 h-16 rounded-full bg-white/5 flex items-center justify-center mb-6">
                      <BrainCircuit className="w-8 h-8 text-white/75" />
                    </div>
                    <h3 className="text-xl font-medium mb-2 uppercase tracking-tight">Zero Assets Found</h3>
                    <p className="text-sm font-mono text-white/85">Query yielded no matching engineering constructs.</p>
                  </div>
                )}
              </div>
            </div>

            {/* --- Sidebar: Team Allocation --- */}
            <div className="space-y-6">
              <div className="border border-white/10 bg-[#0c0c0c] p-6">
                <div className="flex items-center gap-2 mb-6">
                  <Users className="w-4 h-4 text-white/85" />
                  <h3 className="text-[10px] font-mono uppercase tracking-widest text-white/90">Squad Allocation</h3>
                </div>

                <div className="space-y-4">
                  {activeTeams.slice(0, 3).map(team => {
                    const parsedData = typeof team.data === 'string' ? JSON.parse(team.data) : team.data;
                    const engineerCount = Math.max(1, parsedData?.developer_ids?.length || 1);
                    const teamCapacityHours = 20 * (workingHoursPerDay * 0.8) * engineerCount; // 20 days capacity

                    const teamProjects = projects.filter(p => p.team_id === team.id);
                    const totalExpected = teamProjects.reduce((acc, p) => acc + calculateExpectedTime(p.pert_best, p.pert_likely, p.pert_worst), 0);
                    const avgEfficiency = teamProjects.length > 0 ? teamProjects.reduce((acc, p) => acc + p.efficiency, 0) / teamProjects.length : 1;
                    const load = Math.round((totalExpected / teamCapacityHours) * 100);

                    return (
                      <div key={team.id}>
                        <TeamMember
                          name={team.name}
                          role={teamProjects.length > 0 ? `${teamProjects.length} Active Workflows` : 'Awaiting Tasking'}
                          load={Math.min(load, 150)}
                          efficiency={Number(avgEfficiency.toFixed(2))}
                          urgent={load > 100}
                        />
                      </div>
                    );
                  })}
                  {activeTeams.length === 0 && <p className="text-[10px] font-mono text-white/75 italic">No operational units detected.</p>}
                </div>

                <button
                  onClick={() => setIsRosterOpen(true)}
                  className="w-full mt-8 py-3 border border-white/5 bg-white/5 text-[9px] uppercase font-mono tracking-widest hover:bg-white/10 transition-colors"
                >
                  View Full Roster
                </button>
              </div>

              <div className="border border-white/10 bg-[#0c0c0c] p-6 relative overflow-hidden">
                {stats.deliveryConfidence < 85 && <div className="absolute top-0 left-0 w-full h-1 bg-red-500/30 animate-pulse"></div>}
                <div className="flex items-center gap-2 mb-4">
                  <Zap className={`w-4 h-4 ${stats.deliveryConfidence < 85 ? 'text-red-500' : 'text-yellow-500/60'}`} />
                  <h3 className="text-[10px] font-mono uppercase tracking-widest text-white/90">System Insight</h3>
                </div>
                <p className={`text-[11px] leading-relaxed font-mono italic ${stats.deliveryConfidence < 85 ? 'text-red-400' : 'text-white/85'}`}>
                  {stats.insight}
                </p>
                <div className="mt-4 flex items-center gap-2">
                  <TrendingUp className={`w-3 h-3 ${stats.deliveryConfidence < 85 ? 'text-red-500/40' : 'text-white/75'}`} />
                  <span className="text-[11px] font-mono text-white/75 uppercase tracking-[0.2em]">Live Bias Analysis</span>
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
                  <Zap className="w-4 h-4 text-white/90" />
                </div>
                <div>
                  <h3 className="text-xl font-medium tracking-tight">System Initialization</h3>
                  <p className="text-[10px] font-mono text-white/80 uppercase">New workload asset creation</p>
                </div>
              </div>

              <form onSubmit={handleCreateProject} className="space-y-6">
                <div>
                  <label className="block text-[10px] uppercase font-mono text-white/85 mb-2">Project Designation</label>
                  <input
                    autoFocus
                    required
                    type="text"
                    value={newName}
                    onChange={e => setNewName(e.target.value)}
                    className="w-full bg-black border border-white/10 h-12 px-4 font-mono text-sm focus:border-white/40 outline-none"
                    placeholder="E.g. QUANTUM STORAGE OPTIMIZER"
                  />
                </div>

                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <label className="block text-[10px] uppercase font-mono text-white/70 tracking-tighter mb-2">PERT: BEST (H)</label>
                    <input
                      type="number"
                      step="0.1"
                      value={pertBest}
                      onChange={e => setPertBest(e.target.value)}
                      className="w-full bg-black border border-white/10 h-12 px-4 font-mono text-sm focus:border-white/40 outline-none"
                      placeholder="0"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] uppercase font-mono text-white/70 tracking-tighter mb-2">PERT: LIKELY (H)</label>
                    <input
                      type="number"
                      step="0.1"
                      value={pertLikely}
                      onChange={e => setPertLikely(e.target.value)}
                      className="w-full bg-black border border-white/10 h-12 px-4 font-mono text-sm focus:border-white/40 outline-none"
                      placeholder="0"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] uppercase font-mono text-white/70 tracking-tighter mb-2">PERT: WORST (H)</label>
                    <input
                      type="number"
                      step="0.1"
                      value={pertWorst}
                      onChange={e => setPertWorst(e.target.value)}
                      className="w-full bg-black border border-white/10 h-12 px-4 font-mono text-sm focus:border-white/40 outline-none"
                      placeholder="0"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[10px] uppercase font-mono text-white/85 mb-2">Priority Selection</label>
                    <select
                      value={newPriority}
                      onChange={e => setNewPriority(e.target.value)}
                      className="w-full bg-black border border-white/10 h-12 px-4 font-mono text-sm focus:border-white/40 outline-none appearance-none"
                    >
                      <option value="low">LOW PRIORITY</option>
                      <option value="medium">MEDIUM PRIORITY</option>
                      <option value="high">CRITICAL PRIORITY</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-[10px] uppercase font-mono text-white/85 mb-2">Allocate Squad</label>
                    <select
                      value={newTeamId}
                      onChange={e => setNewTeamId(e.target.value)}
                      className="w-full bg-black border border-white/10 h-12 px-4 font-mono text-sm focus:border-white/40 outline-none appearance-none"
                    >
                      <option value="">UNALLOCATED</option>
                      {activeTeams.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                    </select>
                  </div>
                </div>

                {getSuggestedSquad() && !newTeamId && (
                  <div className="bg-blue-500/10 border border-blue-500/20 p-3 flex justify-between items-center">
                    <div>
                      <p className="text-[10px] font-mono text-blue-400 uppercase tracking-widest mb-0.5">AI Suggestion</p>
                      <p className="text-xs font-mono text-white/80">Squad <strong>{getSuggestedSquad()?.name}</strong> has optimal bandwidth availability.</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setNewTeamId(getSuggestedSquad()?.id || '')}
                      className="bg-blue-500/20 hover:bg-blue-500/40 text-blue-300 px-3 py-1.5 text-[10px] font-mono uppercase tracking-widest transition-colors border border-blue-500/30"
                    >
                      Auto-Assign
                    </button>
                  </div>
                )}

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[10px] uppercase font-mono text-white/85 mb-2">Proposed Start Date</label>
                    <input
                      type="date"
                      value={proposedStartDate}
                      onChange={e => setProposedStartDate(e.target.value)}
                      className="w-full bg-black border border-white/10 h-12 px-4 font-mono text-sm focus:border-white/40 outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] uppercase font-mono text-white/85 mb-2">Client Deadline</label>
                    <input
                      type="date"
                      value={newClientDeadline}
                      onChange={e => setNewClientDeadline(e.target.value)}
                      className="w-full bg-black border border-white/10 h-12 px-4 font-mono text-sm focus:border-white/40 outline-none"
                    />
                  </div>
                </div>

                <div className="bg-white/5 border border-white/10 p-4">
                  <div className="flex justify-between items-center text-[10px] uppercase font-mono mb-2">
                    <span className="text-white/85">Statistical Estimate</span>
                    <span className="text-white/80">
                      {calculateExpectedTime(Number(pertBest), Number(pertLikely), Number(pertWorst)).toFixed(2)} HOURS
                    </span>
                  </div>
                  <div className="w-full bg-white/5 h-1">
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: '65%' }}
                      className="h-full bg-white/40"
                    />
                  </div>
                  <p className="text-[11px] font-mono text-white/75 mt-2 italic">
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
            teams={activeTeams}
            onClose={() => setSelectedProject(null)}
            onUpdate={handleUpdateProjectMetadata}
            onDelete={handleDeleteProject}
            workingHoursPerDay={workingHoursPerDay}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {isRosterOpen && (
          <SquadRosterModal
            teams={activeTeams}
            profiles={profiles}
            onClose={() => setIsRosterOpen(false)}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {isProfileOpen && profile && (
          <UserProfileModal
            profile={profile}
            googleAvatar={user?.user_metadata?.avatar_url || user?.user_metadata?.picture}
            onClose={() => setIsProfileOpen(false)}
            onUpdate={handleUpdateProfile}
          />
        )}
      </AnimatePresence>

      {/* --- Footer / Sidebar Accent --- */}
      <footer className="fixed bottom-0 left-0 right-0 bg-[#0a0a0a]/80 border-t border-white/5 px-6 py-3 flex justify-between items-center pointer-events-none z-40">
        <div className="flex items-center gap-4 text-[11px] font-mono text-white/75 uppercase tracking-widest">
          <div className="flex items-center gap-1.5">
            <div className="w-1.5 h-1.5 rounded-full bg-green-500/50 animate-pulse"></div>
            SESSION_HEARTBEAT
          </div>
          <div>ENCRYPTION: AES-256-GCM</div>
          <LiveClock />
        </div>
        <div className="flex items-center gap-6">
          <Settings className="w-3 h-3 text-white/70 pointer-events-auto cursor-pointer hover:text-white transition-colors" />
          <Cpu className="w-3 h-3 text-white/70" />
        </div>
      </footer>

      {/* Grid Overlay for aesthetic */}
      <div className="fixed inset-0 pointer-events-none z-[-1] opacity-20"
        style={{ backgroundImage: 'radial-gradient(circle at 2px 2px, rgba(255,255,255,0.05) 1px, transparent 0)', backgroundSize: '40px 40px' }}>
      </div>
    </div>
  );
}
