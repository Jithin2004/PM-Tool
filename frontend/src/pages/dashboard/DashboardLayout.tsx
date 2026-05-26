import React, { useState, useEffect, useMemo } from 'react';
import {
  BarChart3, Activity, Users, Clock, Target, Plus, Search,
  ChevronRight, ChevronLeft, AlertTriangle, BrainCircuit,
  Settings, LogOut, Zap, TrendingUp, Cpu, Edit2, Trash2,
  History, Calendar, DollarSign, Sliders, Check, Lock,
  Calculator, TrendingDown, Banknote, Download, Menu, X,
  Sun, Moon, Layers, ListOrdered, Kanban, Play,
  Briefcase, ListTodo, FileText, Link2, Bell, HelpCircle, LayoutDashboard,
  Truck, Route, GitBranch, Building2, Radar
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { supabase, isSupabaseConfigured, createRealtimeChannel } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';
import { useWorkspace } from '../../context/WorkspaceContext';
import { DashboardProvider } from '../../context/DashboardContext';
import { sha256 } from '../../utils/cryptoUtils';
import { useTasks } from '../../hooks/useTasks';
import { fetchNotifications, markAsRead as markNotifAsRead, sendNotification } from '../../services/notificationService';
import { activityLogService } from '../../services/activityLogService';
import { CheckCircle2, XCircle, Info, AlertCircle } from 'lucide-react';
import { Login } from '../../components/auth/Login';
import CommandPalette from '../../components/command/CommandPalette';
import CommandAnalytics from '../../components/command/CommandAnalytics';
import { NotificationToast, Notification } from '../../components/ui/NotificationToast';
import { ConfirmationModal } from '../../components/ui/ConfirmationModal';
import { LiveClock } from '../../components/ui/LiveClock';
import { StatsGrid, StatCard } from '../../components/dashboard/StatsGrid';
import { ProjectCard } from '../../components/project/ProjectCard';
import { TeamMember } from '../../components/team/TeamMember';
import { AdminDashboard } from '../../components/admin/AdminDashboard';
import { LogisticsDashboard } from '../../components/admin/LogisticsDashboard';
import { ProjectDetailsModal } from '../../components/project/ProjectDetailsModal';
import { TeamRosterModal } from '../../components/team/TeamRosterModal';
import { UserProfileModal } from '../../components/user/UserProfileModal';
import { calculateExpectedTime, calculateVariance, calculateHoursFromRange, getLocalDateString, getRelativeTime } from '../../utils/timeUtils';
import { isWorkspaceOwner, requireWorkspaceOwner } from '../../utils/workspaceUtils';
import { buildVisibilityContext, filterVisibleTasks, filterVisibleProjects, getVisibleProjectIds } from '../../utils/visibilityFilter';

import { Project, Team, Profile, User, UserRole } from '../../types';

interface Stats {
  totalProjects: number;
  deliveryConfidence: number;
  teamBandwidth: number;
  dailyFatigue: number;
}

interface ConfirmState {
  isOpen: boolean;
  title: string;
  message: string;
  confirmText?: string;
  onConfirm: () => void;
}

// --- Utilities Extracted to timeUtils.ts ---

// --- Components ---




export default function DashboardLayout({ children }: { children?: React.ReactNode }) {
  const { user, profile, logout, updateRole, updateProfile } = useAuth();
  const { workspace } = useWorkspace();
  const [projects, setProjects] = useState<Project[]>([]);
  const { tasks, dependencies, addDependency, removeDependency, updateTaskDates, updateTask } = useTasks(workspace?.id);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [teams, setTeams] = useState<Team[]>([]);

  const projectsWithAggregatedPERT = useMemo(() => {
    return projects.map(project => {
      const projectTasks = tasks.filter(t => t.project_id === project.id);
      if (projectTasks.length === 0) {
        return project;
      }

      // Only aggregate if tasks have *explicit* PERT values set (not just estimated_hours fallback).
      // This preserves the manually entered project-level PERT values when tasks haven't been
      // individually estimated yet — avoiding the "all values become 5" bug.
      const tasksWithExplicitPERT = projectTasks.filter(t =>
        Number(t.pert_best) > 0 &&
        Number(t.pert_likely) > 0 &&
        Number(t.pert_worst) > 0
      );

      if (tasksWithExplicitPERT.length === 0) {
        // No tasks have dedicated PERT values — keep the project's own PERT values intact.
        return project;
      }

      let totalExpected = 0;
      let totalVariance = 0;

      tasksWithExplicitPERT.forEach(task => {
        const best = Number(task.pert_best);
        const likely = Number(task.pert_likely);
        const worst = Number(task.pert_worst);

        const expected = (best + 4 * likely + worst) / 6;
        const variance = Math.pow((worst - best) / 6, 2);

        totalExpected += expected;
        totalVariance += variance;
      });

      const stdDev = Math.sqrt(totalVariance);
      const pertBest = Math.max(0, totalExpected - 2 * stdDev);
      const pertWorst = totalExpected + 2 * stdDev;

      return {
        ...project,
        pert_best: Number(pertBest.toFixed(1)),
        pert_likely: Number(totalExpected.toFixed(1)),
        pert_worst: Number(pertWorst.toFixed(1))
      };
    });
  }, [projects, tasks]);

  // ── Role-aware visibility filtering ──
  const visibilityContext = useMemo(() =>
    buildVisibilityContext(profile?.id || '', profile?.role || 'viewer', projects),
  [profile?.id, profile?.role, projects]);

  const visibleTasks = useMemo(() =>
    filterVisibleTasks(tasks, visibilityContext),
  [tasks, visibilityContext]);

  const visibleProjectIds = useMemo(() =>
    getVisibleProjectIds(projects, visibilityContext, tasks),
  [projects, visibilityContext, tasks]);

  const visibleProjects = useMemo(() =>
    filterVisibleProjects(projects, visibilityContext, new Set(visibleTasks.map(t => t.project_id))),
  [projects, visibilityContext, visibleTasks]);

  const [attendanceRows, setAttendanceRows] = useState<any[]>([]);
  const [salariesRows, setSalariesRows] = useState<any[]>([]);
  const [workspaceSettingsBlob, setWorkspaceSettingsBlob] = useState<any>({});

  // Notifications State
  const [dbNotifications, setDbNotifications] = useState<any[]>([]);

  // Fetch notifications
  const handleFetchNotifications = React.useCallback(async () => {
    if (!workspace?.id) return;
    const data = await fetchNotifications(workspace.id, user?.id);
    setDbNotifications(data);
  }, [workspace?.id, user?.id]);

  // Mark notification as read
  const handleMarkAsRead = async (notificationId: string) => {
    if (!workspace?.id) return;
    const success = await markNotifAsRead(notificationId, workspace.id);
    if (success) {
      setDbNotifications(prev => prev.map(n => n.id === notificationId ? { ...n, read_at: new Date().toISOString() } : n));
    }
  };

  useEffect(() => {
    handleFetchNotifications();

    if (workspace?.id && isSupabaseConfigured) {
      // Real-time listener for incoming notifications
      const notifChannel = createRealtimeChannel(`notifications-changes-${workspace.id}`)
        .on('postgres_changes', {
            event: 'INSERT',
            schema: 'public',
            table: 'notifications',
            filter: `workspace_id=eq.${workspace.id}`
          },
          (payload) => {
            const newNotif = payload.new as any;
            // Only alert if it's broad or explicitly targeted to current user
            if (!newNotif.user_id || newNotif.user_id === user?.id) {
              setDbNotifications(prev => [newNotif, ...prev]);
              notify(`${newNotif.title.toUpperCase()}: ${newNotif.body || ''}`, 'warning');
            }
          }
        )
        .subscribe();

      return () => {
        supabase.removeChannel(notifChannel);
      };
    }
  }, [workspace?.id, user?.id, handleFetchNotifications]);

  // Timeline Intelligence Daemon (Capacity & Risk breaching monitor)
  useEffect(() => {
    if (!workspace?.id || tasks.length === 0 || profiles.length === 0) return;

    const cacheKey = `notified_breaches_${workspace.id}`;
    let notifiedBreaches: string[] = [];
    try {
      notifiedBreaches = JSON.parse(localStorage.getItem(cacheKey) || '[]');
    } catch (e) {
      console.warn("Dashboard Layout Error:", {
        source: "DashboardLayout",
        operation: "fetch_notified_breaches",
        workspace_id: workspace.id,
        timestamp: new Date().toISOString(),
        error: e
      });
    }

    let updated = false;

    // 1. Operator overload check
    profiles.forEach(profile => {
      const activeDevTasks = tasks.filter(t => t.assignee_id === profile.id && t.status !== 'done');
      const activeHours = activeDevTasks.reduce((sum, t) => sum + (t.estimated_hours || 0), 0);
      const weeklyCapacity = 40 * (profile.availability_factor || 1.0);
      const breachId = `overload-${profile.id}-${Math.floor(activeHours)}`;

      if (activeHours > weeklyCapacity && !notifiedBreaches.includes(breachId)) {
        notifiedBreaches.push(breachId);
        updated = true;
        
        sendNotification(
          workspace.id,
          'risk',
          'Operator Capacity Breach',
          `"${profile.full_name || profile.email}" is overloaded: active tasks sum to ${activeHours}h (Weekly limit: ${weeklyCapacity}h).`
        );
      }
    });

    // 2. High delivery risk task check
    tasks.forEach(task => {
      if (task.status === 'done') return;
      const breachId = `risk-${task.id}-${task.risk}`;

      if (task.risk === 'high' && !notifiedBreaches.includes(breachId)) {
        notifiedBreaches.push(breachId);
        updated = true;

        sendNotification(
          workspace.id,
          'risk',
          'High Delivery Risk Warning',
          `Task "${task.name.toUpperCase()}" estimation deviation has breached acceptable margins.`
        );
      }
    });

    if (updated) {
      localStorage.setItem(cacheKey, JSON.stringify(notifiedBreaches));
    }
  }, [workspace?.id, tasks, profiles]);

  // Onboarding Tour state
  const [showGuide, setShowGuide] = useState(() => {
    return localStorage.getItem('resolve-pm-onboarded') !== 'true';
  });
  const [guideStep, setGuideStep] = useState(0);

  const dismissGuide = () => {
    localStorage.setItem('resolve-pm-onboarded', 'true');
    setShowGuide(false);
  };

  const navigateTo = (path: string) => {
    window.history.pushState(null, '', path);
    window.dispatchEvent(new CustomEvent('popstate'));
  };

  const systemSettings = useMemo(() => teams.find(t => t.name === 'SYSTEM_SETTINGS'), [teams]);
  const rawSystemData = useMemo(() => systemSettings?.data as any || {}, [systemSettings]);

  const systemData = useMemo(() => {
    // Merge workspace_settings with fallback to legacy SYSTEM_SETTINGS blob
    const data = { ...rawSystemData, ...workspaceSettingsBlob };

    // Overwrite attendance from dedicated table if available
    if (attendanceRows.length > 0) {
      const records: Record<string, Record<string, any>> = {};
      attendanceRows.forEach(row => {
        if (!records[row.date]) {
          records[row.date] = {};
        }
        records[row.date][row.user_id] = {
          status: row.status,
          leaveType: row.leave_type || undefined,
          isPaidHalfDay: row.is_paid_half_day !== undefined ? row.is_paid_half_day : (row.availability_factor !== undefined ? row.availability_factor === 0.5 : false)
        };
      });
      data.attendance = records;
    }

    // Overwrite salaries from dedicated table if available
    if (salariesRows.length > 0) {
      const salaries: Record<string, number> = {};
      salariesRows.forEach(row => {
        salaries[row.user_id] = Number(row.base_salary);
      });
      data.salaries = salaries;
    }

    return data;
  }, [rawSystemData, attendanceRows, salariesRows]);

  const userCustomRoles = useMemo(() => systemData.userCustomRoles || {}, [systemData]);
  const customRoles = useMemo(() => systemData.customRoles || ['Developer', 'Designer', 'QA Engineer', 'Viewer'], [systemData]);

  const [isAdding, setIsAdding] = useState(false);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);
  const [isRosterOpen, setIsRosterOpen] = useState(false);
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [dashboardTab, setDashboardTab] = useState<'dashboard' | 'active' | 'completed' | 'intelligence'>('dashboard');
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [projectSetupGuide, setProjectSetupGuide] = useState<{ projectId: string; executionMode: string; step: number } | null>(null);
  const [showFeedbackGate, setShowFeedbackGate] = useState(false);
  const [feedbackRating, setFeedbackRating] = useState<number | null>(null);
  const [feedbackTags, setFeedbackTags] = useState<string[]>([]);
  const [feedbackComment, setFeedbackComment] = useState('');
  const [commandPaletteOpen, setCommandPaletteOpen] = useState(false);
  const [commandAnalyticsOpen, setCommandAnalyticsOpen] = useState(false);

  // Global keyboard shortcuts
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        setCommandPaletteOpen(v => !v);
      }
      if (e.key === 'Escape' && commandPaletteOpen) {
        setCommandPaletteOpen(false);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [commandPaletteOpen]);

  const breadcrumb = useMemo(() => {
    const p = window.location.pathname.replace(/\/+$/, '').split('/').filter(Boolean);
    if (p.length === 0) return null;
    const sectionLabels: Record<string, string> = { workspace: 'WORKSPACE', execution: 'EXECUTION', resources: 'RESOURCES', control: 'CONTROL' };
    const pageLabels: Record<string, string> = {
      projects: 'PROJECTS', portfolio: 'PORTFOLIO', decisions: 'DECISION CENTER', knowledge: 'KNOWLEDGE HUB',
      board: 'BOARD', timeline: 'TIMELINE', gantt: 'GANTT', sprints: 'SPRINT CENTER',
      teams: 'TEAMS', logistics: 'LOGISTICS', capacity: 'CAPACITY', 'work-logs': 'WORK LOGS',
      admin: 'ADMIN', audit: 'AUDIT', analytics: 'ANALYTICS', settings: 'SETTINGS',
      automations: 'AUTOMATIONS', connections: 'CONNECTIONS',
      notifications: 'NOTIFICATIONS', modes: 'MODES',
    };
    const section = sectionLabels[p[0]];
    const page = p[1] ? pageLabels[p[1]] : null;
    if (!section) return null;
    return { section, page };
  }, []);

  const tourSteps = useMemo(() => {
    const role = profile?.role || 'viewer';

    if (role === 'super_admin') {
      return [
        {
          title: "Welcome, Commander!",
          description: "Step into your high-fidelity Resolve PM workspace. This guide will brief you on all administrative and scheduling tools at your disposal.",
          actionBefore: () => navigateTo('/overview')
        },
        {
          title: "Tactical Navigation Console",
          description: "Use the Sidebar to access different operational layers. 'Operations' contains Logistics and Team Roster, while 'System' houses your global Settings.",
          actionBefore: () => navigateTo('/overview')
        },
        {
          title: "AI-Powered Strategy Analytics",
          description: "Monitor 'Decision Center' for strategic recommendations or 'Analytics' for a deep dive into delivery velocity and team bandwidth.",
          actionBefore: () => navigateTo('/workspace/decisions')
        },
        {
          title: "Project Workspace Grid",
          description: "Your primary project workspace. Click the 'New Project' button in the Top Bar to add initiatives. Click 'Details' on any card to view PERT estimates.",
          actionBefore: () => navigateTo('/workspace')
        },
        {
          title: "Logistics & Payroll Controls",
          description: "Use the 'Logistics' page in the Operations group to mark daily attendance, calculate deductions, and export payroll reports.",
          actionBefore: () => navigateTo('/control/logistics')
        },
        {
          title: "Task Board & Execution",
          description: "Explore the premium, tactical Board. Shift lenses, track task lanes, and observe live clock-synced ETAs.",
          actionBefore: () => navigateTo('/execution')
        },
        {
          title: "Calibrated & Ready!",
          description: "Your console is fully synced to the operational database. Use the Sun/Moon button in the Top Bar to switch themes anytime.",
          actionBefore: () => navigateTo('/overview')
        }
      ];
    } else if (role === 'pm') {
      return [
        {
          title: "Welcome, Project Manager!",
          description: "Step into your allocation workspace. This guide will brief you on how to coordinate teams and track client deadlines.",
          actionBefore: () => navigateTo('/workspace')
        },
        {
          title: "Tactical Control",
          description: "Monitor team bandwidth and delivery confidence from the 'Decision Center'. Use 'Logistics' in the Sidebar to manage attendance.",
          actionBefore: () => navigateTo('/workspace/decisions')
        },
        {
          title: "Project Management Grid",
          description: "Click 'New Project' in the Top Bar to set deadlines. Click 'Details' on any card to edit its proposed start and write change logs.",
          actionBefore: () => navigateTo('/workspace')
        },
        {
          title: "Execution Board",
          description: "Track task progression, visualize Kanban/Scrum lanes, and inspect live clock-synced ETAs.",
          actionBefore: () => navigateTo('/execution')
        },
        {
          title: "Calibrated & Ready!",
          description: "Keep timelines on target! Use the Top Bar utilities to switch themes or search across the platform.",
          actionBefore: () => navigateTo('/overview')
        }
      ];
    } else {
      // Viewer or general engineer
      return [
        {
          title: "Welcome to Resolve PM!",
          description: "This workspace displays live engineering allocations, delivery schedules, and historical project logs in Read-Only mode.",
          actionBefore: () => navigateTo('/overview')
        },
        {
          title: "Strategy & Intelligence",
          description: "Monitor project health and AI Strategy briefings right from the 'Decision Center'.",
          actionBefore: () => navigateTo('/workspace/decisions')
        },
        {
          title: "Project Grid",
          description: "View active initiatives and their current status. Click 'Details' on cards to view PERT estimates and past audit logs.",
          actionBefore: () => navigateTo('/workspace')
        },
        {
          title: "Execution Board",
          description: "View real-time task progression lanes and live clock-synced ETAs in premium Read-Only mode.",
          actionBefore: () => navigateTo('/execution')
        },
        {
          title: "All Calibrated!",
          description: "You are fully up to date with live team activities. Keep track of project updates as developers coordinate tasks!",
          actionBefore: () => navigateTo('/overview')
        }
      ];
    }
  }, [profile?.role]);

  // Expose tour launcher globally
  useEffect(() => {
    (window as any).startOnboardingTour = () => {
      setGuideStep(0);
      setShowGuide(true);
      navigateTo('/workspace');
    };
  }, [tourSteps]);

  // Listen for project setup guide trigger — redirect to execution initialization
  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      const mode = (detail.executionMode || 'KANBAN').toUpperCase();
      const projectId = detail.projectId;

      if (mode === 'SCRUM' || mode === 'HYBRID') {
        window.history.pushState(null, '', `/projects/${projectId}/setup/execution`);
      } else if (mode === 'KANBAN') {
        window.history.pushState(null, '', `/projects/${projectId}/board`);
      } else if (mode === 'SDLC' || mode === 'CUSTOM') {
        window.history.pushState(null, '', `/projects/${projectId}/setup/execution`);
      } else {
        window.history.pushState(null, '', `/projects/${projectId}/backlog`);
      }
      window.dispatchEvent(new CustomEvent('popstate'));
    };
    window.addEventListener('start-project-setup', handler);
    return () => window.removeEventListener('start-project-setup', handler);
  }, []);
  const [workingTimeFrom, setWorkingTimeFrom] = useState("09:00");
  const [workingTimeTo, setWorkingTimeTo] = useState("17:00");

  const workingHoursPerDay = useMemo(() => {
    return calculateHoursFromRange(workingTimeFrom, workingTimeTo);
  }, [workingTimeFrom, workingTimeTo]);
  const [tilesPerRow, setTilesPerRow] = useState(3);
  const [theme, setTheme] = useState<'dark' | 'light'>(() => {
    return (localStorage.getItem('resolve-theme') as 'dark' | 'light') || 'dark';
  });

  useEffect(() => {
    localStorage.setItem('resolve-theme', theme);
  }, [theme]);



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
    confirmText: 'Confirm',
    onConfirm: () => { }
  });

  const notify = (message: string, type: Notification['type'] = 'info') => {
    const id = Math.random().toString(36).substring(7);
    setNotifications(prev => [...prev, { id, message, type }]);
  };

  const removeNotification = (id: string) => {
    setNotifications(prev => prev.filter(n => n.id !== id));
  };

  const askConfirmation = (title: string, message: string, onConfirm: () => void, confirmText = 'Confirm') => {
    setConfirmState({
      isOpen: true,
      title,
      message,
      confirmText,
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
  const [proposedStartDate, setProposedStartDate] = useState<string>(getLocalDateString());
  const [newClientDeadline, setNewClientDeadline] = useState<string>('');
  const [newPriority, setNewPriority] = useState<string>('medium');
  const [newTeamId, setNewTeamId] = useState<string>('');
  const [newExecutionMode, setNewExecutionMode] = useState<string>('KANBAN');

  useEffect(() => {
    let isMounted = true;
    const loadAllData = async () => {
      if (user && profile && workspace?.id) {
        await Promise.all([
          fetchProjects(),
          fetchTeams(),
          fetchProfiles(),
          fetchAttendance(),
          fetchSalaries()
        ]);
      } else if (!user) {
        setProjects([]);
        setTeams([]);
        setProfiles([]);
      }
      if (isMounted) setLoading(false);
    };

    loadAllData();
    
    if (window.location.hash && window.location.hash.includes('access_token')) {
      window.history.replaceState(null, '', window.location.pathname);
    }

    return () => { isMounted = false; };
  }, [user, profile, workspace?.id]);


  // Automated database migration to dedicated tables
  useEffect(() => {
    if (!isSupabaseConfigured || loading) return;

    const migrateData = async () => {
      // Migrate Attendance
      const oldAttendance = rawSystemData.attendance;
      if (oldAttendance && Object.keys(oldAttendance).length > 0 && attendanceRows.length === 0) {
        console.log("Migrating attendance records to dedicated table...");
        const toInsert: any[] = [];
        Object.keys(oldAttendance).forEach(dateStr => {
          const dayData = oldAttendance[dateStr];
          Object.keys(dayData).forEach(userId => {
            const record = dayData[userId];
            // Verify if record matches UUID or format
            toInsert.push({
              workspace_id: workspace.id,
              user_id: userId,
              date: dateStr,
              status: record.status,
              leave_type: record.leaveType || null,
              availability_factor: record.status === 'present' ? 1.0 : record.status === 'half_day' ? 0.5 : 0.0
            });
          });
        });

        if (toInsert.length > 0) {
          try {
            const { error } = await supabase.from('attendance').insert(toInsert);
            if (!error) {
              console.log(`Successfully migrated ${toInsert.length} attendance records.`);
              await fetchAttendance();
            }
          } catch (e) {
            console.error("Attendance migration failed:", e);
          }
        }
      }

      // Migrate Salaries
      const oldSalaries = rawSystemData.salaries;
      if (oldSalaries && Object.keys(oldSalaries).length > 0 && salariesRows.length === 0) {
        console.log("Migrating salaries records to dedicated table...");
        const toInsert = Object.keys(oldSalaries).map(userId => ({
          workspace_id: workspace.id,
          user_id: userId,
          base_salary: Number(oldSalaries[userId]) || 3000
        }));

        if (toInsert.length > 0) {
          try {
            const { error } = await supabase.from('salaries').insert(toInsert);
            if (!error) {
              console.log(`Successfully migrated ${toInsert.length} salary records.`);
              await fetchSalaries();
            }
          } catch (e) {
            console.error("Salary migration failed:", e);
          }
        }
      }
    };

    // Run migration after data has been loaded
    const delay = setTimeout(migrateData, 5000);
    return () => clearTimeout(delay);
  }, [loading, rawSystemData, attendanceRows.length, salariesRows.length]);

  const activeTeams = useMemo(() => teams.filter(t => t.name !== 'SYSTEM_SETTINGS'), [teams]);

  const calculateDynamicStats = (projList: Project[]) => {
    const activeProjects = projList.filter(p => p.status !== 'deployed');
    const activeWorkflows = activeProjects.filter(p => p.execution_mode !== 'SCRUM');
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

    return {
      totalProjects: activeWorkflows.length,
      deliveryConfidence: Number(deliveryConfidence.toFixed(1)),
      teamBandwidth: Number(teamBandwidth.toFixed(1)),
      dailyFatigue: Number(totalDecayHours.toFixed(1))
    };
  };

  const stats: Stats = useMemo(() => calculateDynamicStats(projectsWithAggregatedPERT), [projectsWithAggregatedPERT, activeTeams]);

  if (loading) {
    return (
      <div className="min-h-screen bg-bg flex flex-col items-center justify-center gap-4">
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
          className="w-12 h-12 border-2 border-border border-t-white rounded-full"
        />
        <p className="font-mono text-sm uppercase tracking-wide text-text-secondary">Initializing Core Engine...</p>
      </div>
    );
  }

  if (!user) {
    return <Login />;
  }

  return (
    <DashboardProvider value={{ 
      projects: projectsWithAggregatedPERT, 
      tasks: visibleTasks,
      dependencies,
      profiles, 
      teams, 
      sprints: [],
      epics: [],
      milestones: [],
      approvals: [],
      meetings: [],
      userCustomRoles, 
      customRoles, 
      systemData,
      stats, 
      searchTerm, 
      setSearchTerm, 
      dashboardTab, 
      setDashboardTab, 
      isAdding, 
      setIsAdding, 
      handleCreateTeam, 
      handleUpdateTeam, 
      handleDeleteTeam, 
      handleUpdateRole, 
      handleSaveLogisticsData, 
      handleUpdateProjectMetadata, 
      handlePromoteTaskToAsset, 
      askConfirmation, 
      notify, 
      fetchProjects,
      invalidateAll,
      addDependency,
      removeDependency,
      updateTaskDates,
      updateTask,
      notifications: dbNotifications,
      markAsRead: handleMarkAsRead,
      workingHoursPerDay,
      tilesPerRow,
      setIsRosterOpen,
      setSelectedProject,
      updateExecutionMode
    }}>
      <div className={`min-h-screen bg-bg font-sans text-text-primary selection:bg-accent-primary selection:text-text-primary transition-colors duration-200 ${theme === 'light' ? 'light' : ''}`}>
        
        {/* Left Sidebar (Fixed on Desktop, Slide-out on Mobile) */}
        <aside className="hidden lg:flex lg:flex-col lg:fixed lg:inset-y-0 lg:left-0 lg:w-[15.5rem] bg-[#0b0c12] border-r border-border-subtle z-30">
          {/* Sidebar Brand Logo */}
          <div className="flex items-center gap-3 h-16 px-5 border-b border-border-subtle shrink-0">
            <div className="w-7 h-7 rounded-md flex items-center justify-center shrink-0 bg-primary-gradient">
              <Layers className="w-3.5 h-3.5 text-text-primary" />
            </div>
            <div>
              <h1 className="font-semibold tracking-tight text-[13px] text-text-secondary">Resolve PM</h1>
              <p className="text-[9px] font-mono text-text-quaternary uppercase tracking-wide">Enterprise Platform</p>
            </div>
          </div>

          {/* Sidebar Menu Groups — Enterprise Navigation Architecture */}
          <div className="flex-1 overflow-y-auto px-3 py-5 space-y-6" style={{scrollbarWidth: 'none'}}>

            {/* ── CORE group ── */}
            <div className="space-y-0.5">
              <p className="text-[9px] font-mono text-text-quaternary uppercase tracking-[0.15em] px-3 mb-2">Core</p>
              <button
                onClick={() => navigateTo('/overview')}
                className={`w-full flex items-center gap-3 px-3 py-2 rounded-md text-[12px] font-medium transition-all duration-150 ${
                  window.location.pathname === '/overview' || window.location.pathname === '/'
                    ? 'bg-indigo-600/20 text-indigo-300 border border-indigo-500/20'
                    : 'text-text-tertiary hover:text-text-secondary hover:bg-surface-3'
                }`}
              >
                <LayoutDashboard className="w-[15px] h-[15px] shrink-0" />
                Overview
              </button>
              <button
                onClick={() => navigateTo('/workspace')}
                className={`w-full flex items-center gap-3 px-3 py-2 rounded-md text-[12px] font-medium transition-all duration-150 ${
                  window.location.pathname === '/workspace'
                    ? 'bg-indigo-600/20 text-indigo-300 border border-indigo-500/20'
                    : 'text-text-tertiary hover:text-text-secondary hover:bg-surface-3'
                }`}
              >
                <Briefcase className="w-[15px] h-[15px] shrink-0" />
                Projects
              </button>
              <button
                onClick={() => navigateTo('/execution')}
                className={`w-full flex items-center gap-3 px-3 py-2 rounded-md text-[12px] font-medium transition-all duration-150 ${
                  window.location.pathname.startsWith('/execution') && !window.location.pathname.includes('timeline') && !window.location.pathname.includes('sprints') && !window.location.pathname.includes('gantt')
                    ? 'bg-indigo-600/20 text-indigo-300 border border-indigo-500/20'
                    : 'text-text-tertiary hover:text-text-secondary hover:bg-surface-3'
                }`}
              >
                <ListTodo className="w-[15px] h-[15px] shrink-0" />
                Task Board
              </button>
              <button
                onClick={() => navigateTo('/execution/timeline')}
                className={`w-full flex items-center gap-3 px-3 py-2 rounded-md text-[12px] font-medium transition-all duration-150 ${
                  window.location.pathname.includes('timeline')
                    ? 'bg-indigo-600/20 text-indigo-300 border border-indigo-500/20'
                    : 'text-text-tertiary hover:text-text-secondary hover:bg-surface-3'
                }`}
              >
                <Route className="w-[15px] h-[15px] shrink-0" />
                Scheduling
              </button>
            </div>

            {/* ── INTELLIGENCE group ── */}
            <div className="space-y-0.5">
              <p className="text-[9px] font-mono text-text-quaternary uppercase tracking-[0.15em] px-3 mb-2">Intelligence</p>
              <button
                onClick={() => navigateTo('/control/analytics')}
                className={`w-full flex items-center gap-3 px-3 py-2 rounded-md text-[12px] font-medium transition-all duration-150 ${
                  window.location.pathname.includes('analytics')
                    ? 'bg-indigo-600/20 text-indigo-300 border border-indigo-500/20'
                    : 'text-text-tertiary hover:text-text-secondary hover:bg-surface-3'
                }`}
              >
                <BarChart3 className="w-[15px] h-[15px] shrink-0" />
                Analytics
              </button>
              <button
                onClick={() => navigateTo('/workspace/decisions')}
                className={`w-full flex items-center gap-3 px-3 py-2 rounded-md text-[12px] font-medium transition-all duration-150 ${
                  window.location.pathname === '/workspace/decisions'
                    ? 'bg-violet-600/20 text-violet-300 border border-violet-500/20'
                    : 'text-text-tertiary hover:text-text-secondary hover:bg-surface-3'
                }`}
              >
                <BrainCircuit className="w-[15px] h-[15px] shrink-0" />
                Decision Center
              </button>
              <button
                onClick={() => navigateTo('/resources/work-logs')}
                className={`w-full flex items-center gap-3 px-3 py-2 rounded-md text-[12px] font-medium transition-all duration-150 ${
                  window.location.pathname.includes('work-logs')
                    ? 'bg-indigo-600/20 text-indigo-300 border border-indigo-500/20'
                    : 'text-text-tertiary hover:text-text-secondary hover:bg-surface-3'
                }`}
              >
                <FileText className="w-[15px] h-[15px] shrink-0" />
                Reports
              </button>
            </div>

    );
  }

  if (!user) {
    return <Login />;
  }

  return (
    <DashboardProvider value={{ 
      projects: projectsWithAggregatedPERT, 
      tasks: visibleTasks,
      dependencies,
      profiles, 
      teams, 
      sprints: [],
      epics: [],
      milestones: [],
      approvals: [],
      meetings: [],
      userCustomRoles, 
      customRoles, 
      systemData,
      stats, 
      searchTerm, 
      setSearchTerm, 
      dashboardTab, 
      setDashboardTab, 
      isAdding, 
      setIsAdding, 
      handleCreateTeam, 
      handleUpdateTeam, 
      handleDeleteTeam, 
      handleUpdateRole, 
      handleSaveLogisticsData, 
      handleUpdateProjectMetadata, 
      handlePromoteTaskToAsset, 
      askConfirmation, 
      notify, 
      fetchProjects,
      invalidateAll,
      addDependency,
      removeDependency,
      updateTaskDates,
      updateTask,
      notifications: dbNotifications,
      markAsRead: handleMarkAsRead,
      workingHoursPerDay,
      tilesPerRow,
      setIsRosterOpen,
      setSelectedProject,
      updateExecutionMode
    }}>
      <div className={`min-h-screen bg-bg font-sans text-text-primary selection:bg-accent-primary selection:text-text-primary transition-colors duration-200 ${theme === 'light' ? 'light' : ''}`}>
        
        {/* Left Sidebar (Fixed on Desktop, Slide-out on Mobile) */}
        <aside className="hidden lg:flex lg:flex-col lg:fixed lg:inset-y-0 lg:left-0 lg:w-[15.5rem] bg-[#0b0c12] border-r border-border-subtle z-30">
          {/* Sidebar Brand Logo */}
          <div className="flex items-center gap-3 h-16 px-5 border-b border-border-subtle shrink-0">
            <div className="w-7 h-7 rounded-md flex items-center justify-center shrink-0" style={{background: 'linear-gradient(135deg, #6366f1 0%, #7c3aed 100%)'}}>
              <Layers className="w-3.5 h-3.5 text-text-primary" />
            </div>
            <div>
              <h1 className="font-semibold tracking-tight text-[13px] text-text-secondary">Resolve PM</h1>
              <p className="text-[9px] font-mono text-text-quaternary uppercase tracking-wide">Enterprise Platform</p>
            </div>
          </div>

          {/* Sidebar Menu Groups — Enterprise Navigation Architecture */}
          <div className="flex-1 overflow-y-auto px-3 py-5 space-y-6" style={{scrollbarWidth: 'none'}}>

            {/* ── CORE group ── */}
            <div className="space-y-0.5">
              <p className="text-[9px] font-mono text-text-quaternary uppercase tracking-[0.15em] px-3 mb-2">Core</p>
              <button
                onClick={() => navigateTo('/overview')}
                className={`w-full flex items-center gap-3 px-3 py-2 rounded-md text-[12px] font-medium transition-all duration-150 ${
                  window.location.pathname === '/overview' || window.location.pathname === '/'
                    ? 'bg-indigo-600/20 text-indigo-300 border border-indigo-500/20'
                    : 'text-text-tertiary hover:text-text-secondary hover:bg-surface-3'
                }`}
              >
                <LayoutDashboard className="w-[15px] h-[15px] shrink-0" />
                Overview
              </button>
              <button
                onClick={() => navigateTo('/workspace')}
                className={`w-full flex items-center gap-3 px-3 py-2 rounded-md text-[12px] font-medium transition-all duration-150 ${
                  window.location.pathname === '/workspace'
                    ? 'bg-indigo-600/20 text-indigo-300 border border-indigo-500/20'
                    : 'text-text-tertiary hover:text-text-secondary hover:bg-surface-3'
                }`}
              >
                <Briefcase className="w-[15px] h-[15px] shrink-0" />
                Projects
              </button>
              <button
                onClick={() => navigateTo('/execution')}
                className={`w-full flex items-center gap-3 px-3 py-2 rounded-md text-[12px] font-medium transition-all duration-150 ${
                  window.location.pathname.startsWith('/execution') && !window.location.pathname.includes('timeline') && !window.location.pathname.includes('sprints') && !window.location.pathname.includes('gantt')
                    ? 'bg-indigo-600/20 text-indigo-300 border border-indigo-500/20'
                    : 'text-text-tertiary hover:text-text-secondary hover:bg-surface-3'
                }`}
              >
                <ListTodo className="w-[15px] h-[15px] shrink-0" />
                Task Board
              </button>
              <button
                onClick={() => navigateTo('/execution/timeline')}
                className={`w-full flex items-center gap-3 px-3 py-2 rounded-md text-[12px] font-medium transition-all duration-150 ${
                  window.location.pathname.includes('timeline')
                    ? 'bg-indigo-600/20 text-indigo-300 border border-indigo-500/20'
                    : 'text-text-tertiary hover:text-text-secondary hover:bg-surface-3'
                }`}
              >
                <Route className="w-[15px] h-[15px] shrink-0" />
                Scheduling
              </button>
            </div>

            {/* ── INTELLIGENCE group ── */}
            <div className="space-y-0.5">
              <p className="text-[9px] font-mono text-text-quaternary uppercase tracking-[0.15em] px-3 mb-2">Intelligence</p>
              <button
                onClick={() => navigateTo('/control/analytics')}
                className={`w-full flex items-center gap-3 px-3 py-2 rounded-md text-[12px] font-medium transition-all duration-150 ${
                  window.location.pathname.includes('analytics')
                    ? 'bg-indigo-600/20 text-indigo-300 border border-indigo-500/20'
                    : 'text-text-tertiary hover:text-text-secondary hover:bg-surface-3'
                }`}
              >
                <BarChart3 className="w-[15px] h-[15px] shrink-0" />
                Analytics
              </button>
              <button
                onClick={() => { setDashboardTab('intelligence'); navigateTo('/workspace'); }}
                className={`w-full flex items-center gap-3 px-3 py-2 rounded-md text-[12px] font-medium transition-all duration-150 ${
                  dashboardTab === 'intelligence' && window.location.pathname === '/workspace'
                    ? 'bg-violet-600/20 text-violet-300 border border-violet-500/20'
                    : 'text-text-tertiary hover:text-text-secondary hover:bg-surface-3'
                }`}
              >
                <BrainCircuit className="w-[15px] h-[15px] shrink-0" />
                Decision Center
              </button>
              <button
                onClick={() => navigateTo('/resources/work-logs')}
                className={`w-full flex items-center gap-3 px-3 py-2 rounded-md text-[12px] font-medium transition-all duration-150 ${
                  window.location.pathname.includes('work-logs')
                    ? 'bg-indigo-600/20 text-indigo-300 border border-indigo-500/20'
                    : 'text-text-tertiary hover:text-text-secondary hover:bg-surface-3'
                }`}
              >
                <FileText className="w-[15px] h-[15px] shrink-0" />
                Reports
              </button>
            </div>

            {/* ── OPERATIONS group ── */}
            <div className="space-y-0.5">
              <p className="text-[9px] font-mono text-text-quaternary uppercase tracking-[0.15em] px-3 mb-2">Operations</p>
              <button
                onClick={() => navigateTo('/control/logistics')}
                className={`w-full flex items-center gap-3 px-3 py-2 rounded-md text-[12px] font-medium transition-all duration-150 ${
                  window.location.pathname.includes('logistics')
                    ? 'bg-indigo-600/20 text-indigo-300 border border-indigo-500/20'
                    : 'text-text-tertiary hover:text-text-secondary hover:bg-surface-3'
                }`}
              >
                <Truck className="w-[15px] h-[15px] shrink-0" />
                Logistics
              </button>
              <button
                onClick={() => navigateTo('/resources/teams')}
                className={`w-full flex items-center gap-3 px-3 py-2 rounded-md text-[12px] font-medium transition-all duration-150 ${
                  window.location.pathname.includes('teams')
                    ? 'bg-indigo-600/20 text-indigo-300 border border-indigo-500/20'
                    : 'text-text-tertiary hover:text-text-secondary hover:bg-surface-3'
                }`}
              >
                <Users className="w-[15px] h-[15px] shrink-0" />
                Team Roster
              </button>
              <button
                onClick={() => navigateTo('/workspace/portfolio')}
                className={`w-full flex items-center gap-3 px-3 py-2 rounded-md text-[12px] font-medium transition-all duration-150 ${
                  window.location.pathname.includes('portfolio')
                    ? 'bg-indigo-600/20 text-indigo-300 border border-indigo-500/20'
                    : 'text-text-tertiary hover:text-text-secondary hover:bg-surface-3'
                }`}
              >
                <Building2 className="w-[15px] h-[15px] shrink-0" />
                Stakeholders
              </button>
              <button
                onClick={() => navigateTo('/control/audit')}
                className={`w-full flex items-center gap-3 px-3 py-2 rounded-md text-[12px] font-medium transition-all duration-150 ${
                  window.location.pathname.includes('audit')
                    ? 'bg-indigo-600/20 text-indigo-300 border border-indigo-500/20'
                    : 'text-text-tertiary hover:text-text-secondary hover:bg-surface-3'
                }`}
              >
                <Activity className="w-[15px] h-[15px] shrink-0" />
                Audit Log
              </button>
            </div>

            {/* ── SYSTEM group ── */}
            <div className="space-y-0.5">
              <p className="text-[9px] font-mono text-text-quaternary uppercase tracking-[0.15em] px-3 mb-2">System</p>
              <button
                onClick={() => navigateTo('/control/settings')}
                className={`w-full flex items-center gap-3 px-3 py-2 rounded-md text-[12px] font-medium transition-all duration-150 ${
                  window.location.pathname === '/control/settings' || window.location.pathname.startsWith('/control/settings/')
                    ? 'bg-indigo-600/20 text-indigo-300 border border-indigo-500/20'
                    : 'text-text-tertiary hover:text-text-secondary hover:bg-surface-3'
                }`}
              >
                <Settings className="w-[15px] h-[15px] shrink-0" />
                Settings
              </button>
              <button
                onClick={() => navigateTo('/control/connections')}
                className={`w-full flex items-center gap-3 px-3 py-2 rounded-md text-[12px] font-medium transition-all duration-150 ${
                  window.location.pathname.includes('connections')
                    ? 'bg-indigo-600/20 text-indigo-300 border border-indigo-500/20'
                    : 'text-text-tertiary hover:text-text-secondary hover:bg-surface-3'
                }`}
              >
                <Link2 className="w-[15px] h-[15px] shrink-0" />
                Integrations
              </button>
            </div>

          </div>

          {/* Bottom utility strip — Help + Profile */}
          <div className="shrink-0 border-t border-border-subtle">
            <button
              onClick={() => (window as any).startOnboardingTour?.()}
              className="w-full flex items-center gap-2.5 px-5 py-2.5 text-text-quaternary hover:text-text-quaternary transition-colors text-[11px]"
            >
              <HelpCircle className="w-3.5 h-3.5 shrink-0" />
              Help & Documentation
            </button>

            {/* User identity strip */}
            <div className="flex items-center gap-3 px-4 py-3 border-t border-border-subtle">
              <div
                onClick={() => setIsProfileOpen(true)}
                className="w-8 h-8 rounded-full bg-white/5 border border-border-subtle flex items-center justify-center overflow-hidden shrink-0 cursor-pointer hover:border-indigo-400/40 transition-colors"
              >
                {profile?.avatar_url ? (
                  <img src={profile.avatar_url} alt="Avatar" className="w-full h-full object-cover" />
                ) : profile?.full_name ? (
                  <span className="text-[10px] font-bold text-text-secondary">{profile.full_name.substring(0, 2).toUpperCase()}</span>
                ) : (
                  <Users className="w-3.5 h-3.5 text-text-quaternary" />
                )}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[12px] font-medium text-text-secondary truncate">{profile?.full_name || user.email?.split('@')[0]}</p>
                <p className="text-[9px] text-text-quaternary truncate capitalize font-mono">
                  {(profile && userCustomRoles[profile.id]) || profile?.role?.replace('_', ' ') || 'Viewer'}
                </p>
              </div>
              <button
                onClick={handleLogout}
                className="p-1.5 text-text-quaternary hover:text-rose-400/70 hover:bg-rose-500/10 rounded-md transition-colors cursor-pointer"
                title="Sign Out"
              >
                <LogOut className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </aside>

        {/* Mobile Slide-out Sidebar Drawer */}
        <AnimatePresence>
          {mobileSidebarOpen && (
            <>
              {/* Drawer Backdrop */}
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={() => setMobileSidebarOpen(false)}
                className="lg:hidden fixed inset-0 z-50 bg-bg backdrop-blur-sm"
              />

              {/* Drawer Panel */}
              <motion.div
                initial={{ x: '-100%' }}
                animate={{ x: 0 }}
                exit={{ x: '-100%' }}
                transition={{ type: 'spring', damping: 25, stiffness: 200 }}
                className="lg:hidden fixed inset-y-0 left-0 w-72 bg-surface border-r border-border z-50 flex flex-col shadow-2xl"
              >
                <div className="flex items-center justify-between h-16 px-6 border-b border-border shrink-0">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 bg-primary-gradient rounded-lg flex items-center justify-center">
                      <Layers className="w-4 h-4 text-text-primary" />
                    </div>
                    <div>
                      <h1 className="font-bold tracking-tight text-sm uppercase text-text-primary">Resolve PM</h1>
                      <p className="text-[8px] font-mono text-text-tertiary uppercase">Enterprise Console</p>
                    </div>
                  </div>
                  <button
                    onClick={() => setMobileSidebarOpen(false)}
                    className="p-1.5 hover:bg-white/5 rounded-lg text-text-secondary"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>

                <div className="flex-1 overflow-y-auto px-4 py-6 space-y-7">
                  {/* MAIN group */}
                  <div className="space-y-2">
                    <p className="text-[9px] font-mono font-bold text-text-tertiary uppercase tracking-wide px-3">Main</p>
                    <div className="space-y-1">
                      <button
                        onClick={() => { setDashboardTab('dashboard'); navigateTo('/workspace'); setMobileSidebarOpen(false); }}
                        className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-xs font-medium transition-all ${
                          dashboardTab === 'dashboard' && window.location.pathname === '/workspace'
                            ? 'bg-primary-gradient text-text-primary shadow-md'
                            : 'text-text-secondary hover:bg-white/5 hover:text-text-primary'
                        }`}
                      >
                        <LayoutDashboard className="w-4 h-4" />
                        Dashboard
                      </button>
                      <button
                        onClick={() => { setDashboardTab('active'); navigateTo('/workspace'); setMobileSidebarOpen(false); }}
                        className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-xs font-medium transition-all ${
                          dashboardTab === 'active' && window.location.pathname === '/workspace'
                            ? 'bg-primary-gradient text-text-primary shadow-md'
                            : 'text-text-secondary hover:bg-white/5 hover:text-text-primary'
                        }`}
                      >
                        <Briefcase className="w-4 h-4" />
                        Projects
                      </button>
                      <button
                        onClick={() => { navigateTo('/execution'); setMobileSidebarOpen(false); }}
                        className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-xs font-medium transition-all ${
                          window.location.pathname.startsWith('/execution') && !window.location.pathname.includes('timeline') && !window.location.pathname.includes('sprints') && !window.location.pathname.includes('gantt')
                            ? 'bg-primary-gradient text-text-primary shadow-md'
                            : 'text-text-secondary hover:bg-white/5 hover:text-text-primary'
                        }`}
                      >
                        <ListTodo className="w-4 h-4" />
                        Tasks
                      </button>
                      <button
                        onClick={() => { navigateTo('/execution/timeline'); setMobileSidebarOpen(false); }}
                        className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-xs font-medium transition-all ${
                          window.location.pathname.includes('timeline')
                            ? 'bg-primary-gradient text-text-primary shadow-md'
                            : 'text-text-secondary hover:bg-white/5 hover:text-text-primary'
                        }`}
                      >
                        <Calendar className="w-4 h-4" />
                        Calendar
                      </button>
                    </div>
                  </div>

                  {/* TEAM & SETTINGS on Mobile */}
                  <div className="space-y-2">
                    <p className="text-[9px] font-mono font-bold text-text-tertiary uppercase tracking-wide px-3">Team</p>
                    <div className="space-y-1">
                      <button
                        onClick={() => { navigateTo('/resources/teams'); setMobileSidebarOpen(false); }}
                        className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-xs text-text-secondary hover:bg-white/5 hover:text-text-primary"
                      >
                        <Users className="w-4 h-4" />
                        Team
                      </button>
                    </div>
                  </div>
                </div>

                <div className="p-4 border-t border-border bg-bg shrink-0">
                  <div className="flex items-center gap-3 p-2">
                    <div className="w-9 h-9 rounded-full bg-white/5 border border-border flex items-center justify-center overflow-hidden shrink-0">
                      {profile?.avatar_url ? <img src={profile.avatar_url} alt="Avatar" className="w-full h-full object-cover" /> :
                        <Users className="w-4 h-4 text-text-secondary" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-semibold text-text-primary truncate">{profile?.full_name || user.email?.split('@')[0]}</p>
                      <p className="text-[10px] text-text-tertiary truncate uppercase">{profile?.role || 'Viewer'}</p>
                    </div>
                    <button onClick={() => { handleLogout(); setMobileSidebarOpen(false); }} className="p-1.5 hover:bg-rose-500/10 text-rose-400 rounded-lg">
                      <LogOut className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </motion.div>
            </>
          )}
        </AnimatePresence>

        {/* Main Content Area */}
        <div className="lg:pl-[15.5rem] flex flex-col flex-1 min-h-screen">
          
          {/* Top Bar — utility layer only, no greeting content */}
          <header className="h-12 flex items-center justify-between px-5 border-b border-border-subtle bg-[#0b0c12]/90 sticky top-0 z-40 backdrop-blur-xl transition-colors duration-200">
            {/* Mobile menu toggle */}
            <div className="flex items-center gap-3 lg:hidden">
              <button
                onClick={() => setMobileSidebarOpen(true)}
                className="p-1.5 border border-border-subtle bg-surface-3 rounded-md text-text-tertiary"
              >
                <Menu className="w-4 h-4" />
              </button>
            <div className="w-6 h-6 rounded-md flex items-center justify-center shrink-0 bg-primary-gradient">
              <Layers className="w-3 h-3 text-text-primary" />
            </div>

            </div>

            {/* Top bar center: live breadcrumb / context label */}
            <div className="hidden sm:flex items-center gap-2 text-[11px] font-mono text-text-quaternary">
              <Radar className="w-3 h-3" />
              <span className="uppercase tracking-wide">Resolve PM</span>
              <span className="text-text-quaternary">/</span>
              <span className="text-text-quaternary">{breadcrumb?.section || 'Command Center'}</span>
              {breadcrumb?.page && <><span className="text-text-quaternary">/</span><span className="text-text-tertiary">{breadcrumb.page}</span></>}
            </div>

            {/* Top bar right: compact utilities */}
            <div className="flex items-center gap-2 ml-auto">

              {/* Search */}
              <div
                onClick={() => setCommandPaletteOpen(true)}
                className="hidden md:flex items-center gap-2 bg-surface-3 hover:bg-surface-3 border border-border-subtle h-7 px-3 rounded-md text-text-quaternary cursor-pointer transition-all"
              >
                <Search className="w-3 h-3" />
                <span className="text-[10px] select-none font-mono">Search...</span>
                <span className="ml-2 bg-surface-3 border border-border-subtle px-1 py-0.5 rounded text-[8px] font-mono tracking-tighter text-text-quaternary">⌘K</span>
              </div>

              {/* Theme */}
              <button
                onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
                className="p-1.5 border border-border-subtle bg-surface-3 hover:bg-surface-3 rounded-md text-text-quaternary hover:text-text-tertiary transition-all shrink-0 cursor-pointer"
                title={theme === 'dark' ? 'Light Theme' : 'Dark Theme'}
              >
                {theme === 'dark' ? <Sun className="w-3.5 h-3.5" /> : <Moon className="w-3.5 h-3.5" />}
              </button>

              {/* Notifications */}
              <div className="relative shrink-0">
                <button
                  className="p-1.5 border border-border-subtle bg-surface-3 hover:bg-surface-3 rounded-md text-text-quaternary hover:text-text-tertiary transition-all relative cursor-pointer"
                  title="Notifications"
                >
                  <Bell className="w-3.5 h-3.5" />
                  {dbNotifications.filter(n => !n.read_at).length > 0 && (
                    <span className="absolute -top-0.5 -right-0.5 w-3.5 h-3.5 rounded-full bg-rose-500 text-[7px] font-bold flex items-center justify-center text-text-primary">
                      {dbNotifications.filter(n => !n.read_at).length}
                    </span>
                  )}
                </button>
              </div>

              {/* New Project CTA */}
              {profile && profile.role !== 'viewer' && (
                <button
                  onClick={() => setIsAdding(true)}
                  className="flex items-center gap-1.5 text-[11px] font-medium text-text-primary h-7 px-3 rounded-md transition-all cursor-pointer shrink-0 bg-primary-gradient"
                >
                  <Plus className="w-3 h-3" />
                  <span className="hidden sm:inline">New Project</span>
                </button>
              )}
            </div>
          </header>

          {/* Context Header — Welcome + operational context, sits clearly below topbar */}
          {window.location.pathname === '/workspace' && (
            <div className="px-6 pt-7 pb-5 border-b border-border-subtle">
              <div className="flex items-end justify-between">
                <div>
                  <p className="text-[10px] font-mono text-text-quaternary uppercase tracking-wide mb-1">Command Center</p>
                  <h2 className="text-[22px] font-semibold text-text-secondary tracking-tight leading-none">
                    {profile?.full_name?.split(' ')[0] || user.email?.split('@')[0]}'s Workspace
                  </h2>
                  <p className="text-[12px] text-text-quaternary mt-1.5">
                    {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })} · {dbNotifications.filter(n => !n.read_at).length > 0 ? `${dbNotifications.filter(n => !n.read_at).length} unread notification${dbNotifications.filter(n => !n.read_at).length > 1 ? 's' : ''}` : 'All systems operational'}
                  </p>
                </div>
                <div className="flex items-center gap-1.5 text-[9px] font-mono text-text-quaternary uppercase tracking-wide">
                  <div className="w-1.5 h-1.5 rounded-full bg-emerald-400/50 transition-opacity duration-300" />
                  Live
                </div>
              </div>
            </div>
          )}

          {/* StatsGrid — only show on project/completed tabs */}
          {dashboardTab !== 'dashboard' && dashboardTab !== 'intelligence' && window.location.pathname === '/workspace' && (
            <StatsGrid stats={stats} />
          )}

          {/* Dynamic Page Routing Slot */}
          <main id="main-content" className="flex-1 px-6 py-5 overflow-y-auto pb-20">
            {children}
          </main>

        </div>

        {/* Status Footer */}
        <footer className="fixed bottom-0 left-0 right-0 lg:left-[15.5rem] bg-[#0b0c12]/80 border-t border-border-subtle px-5 py-2 flex justify-between items-center pointer-events-none z-20 backdrop-blur-xl">
          <div className="flex items-center gap-4 text-[9px] font-mono text-text-quaternary uppercase tracking-wide">
            <div className="flex items-center gap-1.5">
              <div className="w-1.5 h-1.5 rounded-full bg-emerald-400/50 transition-opacity duration-300" />
              <span>Connected</span>
            </div>
            <span className="hidden md:inline">AES-256-GCM</span>
            <LiveClock />
          </div>
          <span className="text-[9px] font-mono text-text-quaternary hidden md:block">&copy; {new Date().getFullYear()} JITHIN M & SHAMIL T P</span>
        </footer>

        {/* --- Global Overlay Dialogs --- */}
        
        <AnimatePresence>
          {notifications.map(n => (
            <NotificationToast key={n.id} notification={n} onClose={() => removeNotification(n.id)} />
          ))}
        </AnimatePresence>

        <ConfirmationModal
          isOpen={confirmState.isOpen}
          title={confirmState.title}
          message={confirmState.message}
          confirmText={confirmState.confirmText}
          onConfirm={confirmState.onConfirm}
          onCancel={() => setConfirmState(prev => ({ ...prev, isOpen: false }))}
        />

        <CommandPalette
          isOpen={commandPaletteOpen}
          onClose={() => setCommandPaletteOpen(false)}
          onNavigate={navigateTo}
          profile={profile}
          projects={visibleProjects}
          tasks={visibleTasks}
          setSelectedProject={setSelectedProject}
          notify={notify}
          setIsAdding={setIsAdding}
          workspaceId={workspace?.id}
          onOpenAnalytics={() => { setCommandPaletteOpen(false); setCommandAnalyticsOpen(true); }}
        />

        <CommandAnalytics
          isOpen={commandAnalyticsOpen}
          onClose={() => setCommandAnalyticsOpen(false)}
          role={profile?.role || 'viewer'}
          workspaceId={workspace?.id}
          profileId={profile?.id}
          currentRoute={window.location.pathname}
        />

      {/* --- Overlay Components --- */}

      <AnimatePresence>
        {isAdding && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-bg backdrop-blur-sm z-[100] flex items-center justify-center p-4 sm:p-6 overflow-y-auto"
          >
            {/* ... rest of the isAdding code ... */}
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-surface border border-border w-full max-w-xl p-6 sm:p-8 overflow-y-auto max-h-[90vh] md:max-h-none rounded-sm my-auto"
              onClick={e => e.stopPropagation()}
            >
              <div className="flex items-center gap-3 mb-8">
                <div className="w-8 h-8 bg-white/5 border border-border flex items-center justify-center">
                  <Zap className="w-4 h-4 text-text-secondary" />
                </div>
                <div>
                  <h3 className="text-xl font-medium tracking-tight">Workspace Setup</h3>
                  <p className="text-[10px] font-mono text-text-secondary uppercase">New project creation</p>
                </div>
              </div>

              <form onSubmit={handleCreateProject} className="space-y-6">
                <div>
                  <label className="block text-[10px] uppercase font-mono text-text-secondary mb-2">Project Designation</label>
                  <input
                    autoFocus
                    required
                    type="text"
                    value={newName}
                    onChange={e => setNewName(e.target.value)}
                    className="w-full bg-bg border border-border h-12 px-4 font-mono text-sm focus:border-white/40 outline-none"
                    placeholder="E.g. QUANTUM STORAGE OPTIMIZER"
                  />
                </div>

                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <label className="block text-[10px] uppercase font-mono text-text-secondary tracking-tighter mb-2">PERT: BEST (H) *</label>
                    <input
                      type="number"
                      step="0.1"
                      min="0.1"
                      required
                      value={pertBest}
                      onChange={e => setPertBest(e.target.value)}
                      className="w-full bg-bg border border-border h-12 px-4 font-mono text-sm focus:border-white/40 outline-none"
                      placeholder="0"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] uppercase font-mono text-text-secondary tracking-tighter mb-2">PERT: LIKELY (H) *</label>
                    <input
                      type="number"
                      step="0.1"
                      min="0.1"
                      required
                      value={pertLikely}
                      onChange={e => setPertLikely(e.target.value)}
                      className="w-full bg-bg border border-border h-12 px-4 font-mono text-sm focus:border-white/40 outline-none"
                      placeholder="0"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] uppercase font-mono text-text-secondary tracking-tighter mb-2">PERT: WORST (H) *</label>
                    <input
                      type="number"
                      step="0.1"
                      min="0.1"
                      required
                      value={pertWorst}
                      onChange={e => setPertWorst(e.target.value)}
                      className="w-full bg-bg border border-border h-12 px-4 font-mono text-sm focus:border-white/40 outline-none"
                      placeholder="0"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[10px] uppercase font-mono text-text-secondary mb-2">Execution Mode</label>
                    <select
                      value={newExecutionMode}
                      onChange={e => setNewExecutionMode(e.target.value)}
                      className="w-full bg-bg border border-border h-12 px-4 font-mono text-sm focus:border-white/40 outline-none appearance-none"
                    >
                      <option value="KANBAN">KANBAN</option>
                      <option value="SCRUM">SCRUM</option>
                      <option value="SDLC">SDLC</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-[10px] uppercase font-mono text-text-secondary mb-2">Priority Selection</label>
                    <select
                      value={newPriority}
                      onChange={e => setNewPriority(e.target.value)}
                      className="w-full bg-bg border border-border h-12 px-4 font-mono text-sm focus:border-white/40 outline-none appearance-none"
                    >
                      <option value="low">LOW PRIORITY</option>
                      <option value="medium">MEDIUM PRIORITY</option>
                      <option value="high">CRITICAL PRIORITY</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-[10px] uppercase font-mono text-text-secondary mb-2">Assign Team</label>
                    <select
                      value={newTeamId}
                      onChange={e => setNewTeamId(e.target.value)}
                      className="w-full bg-bg border border-border h-12 px-4 font-mono text-sm focus:border-white/40 outline-none appearance-none"
                    >
                      <option value="">UNALLOCATED</option>
                      {activeTeams.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                    </select>
                  </div>
                </div>

                {getSuggestedTeam() && !newTeamId && (
                  <div className="bg-surface-3 border border-border p-3 flex justify-between items-center">
                    <div>
                      <p className="text-[10px] font-mono text-signal-info uppercase tracking-wide mb-0.5">AI Suggestion</p>
                      <p className="text-xs font-mono text-text-secondary">Team <strong>{getSuggestedTeam()?.name}</strong> has optimal bandwidth availability.</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setNewTeamId(getSuggestedTeam()?.id || '')}
                      className="bg-surface-3 hover:bg-surface-3 text-blue-300 px-3 py-1.5 text-[10px] font-mono uppercase tracking-wide transition-colors border border-border"
                    >
                      Auto-Assign
                    </button>
                  </div>
                )}

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[10px] uppercase font-mono text-text-secondary mb-2">Proposed Start Date *</label>
                    <input
                      type="date"
                      required
                      value={proposedStartDate}
                      onChange={e => setProposedStartDate(e.target.value)}
                      className="w-full bg-bg border border-border h-12 px-4 font-mono text-sm focus:border-white/40 outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] uppercase font-mono text-text-secondary mb-2">Client Deadline *</label>
                    <input
                      type="date"
                      required
                      value={newClientDeadline}
                      onChange={e => setNewClientDeadline(e.target.value)}
                      className="w-full bg-bg border border-border h-12 px-4 font-mono text-sm focus:border-white/40 outline-none"
                    />
                  </div>
                </div>

                <div className="bg-white/5 border border-border p-4">
                  <div className="flex justify-between items-center text-[10px] uppercase font-mono mb-2">
                    <span className="text-text-secondary">Statistical Estimate</span>
                    <span className="text-text-secondary">
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
                  <p className="text-[11px] font-mono text-text-secondary mt-2 italic">
                    Confidence interval adjusted for ±{Math.sqrt(calculateVariance(Number(pertBest), Number(pertWorst))).toFixed(2)}σ.
                  </p>
                </div>

                <div className="flex gap-4 pt-4">
                  <button
                    type="submit"
                    className="flex-1 bg-white text-black h-12 font-medium hover:bg-neutral-200 transition-colors uppercase text-xs tracking-wide"
                  >
                    Commit Project
                  </button>
                  <button
                    type="button"
                    onClick={() => setIsAdding(false)}
                    className="flex-1 border border-border h-12 font-medium hover:bg-white/5 transition-colors uppercase text-xs tracking-wide"
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
            project={projectsWithAggregatedPERT.find(p => p.id === selectedProject.id) || selectedProject}
            teams={activeTeams}
            onClose={() => setSelectedProject(null)}
            onUpdate={handleUpdateProjectMetadata}
            onDelete={handleDeleteProject}
            workingHoursPerDay={workingHoursPerDay}
            workingTimeFrom={workingTimeFrom}
            workingTimeTo={workingTimeTo}
            currentUserProfile={profile}
            userCustomRoles={userCustomRoles}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {isRosterOpen && (
          <TeamRosterModal
            teams={activeTeams}
            profiles={profiles}
            projects={projects}
            workingHoursPerDay={workingHoursPerDay}
            attendanceRecords={systemData.attendance || {}}
            systemData={systemData}
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
      <footer className="fixed bottom-0 left-0 right-0 bg-bg border-t border-border-subtle px-4 sm:px-6 py-3 flex justify-between items-center pointer-events-none z-40">
        <div className="flex items-center gap-3 sm:gap-4 text-[9px] sm:text-[11px] font-mono text-text-secondary uppercase tracking-wide">
          <div className="flex items-center gap-1.5">
            <div className="w-1.5 h-1.5 rounded-full bg-signal-safe-bg transition-opacity duration-300"></div>
            <span className="hidden sm:inline">SESSION_HEARTBEAT</span>
            <span className="inline sm:hidden">LIVE</span>
          </div>
          <div className="hidden sm:block">ENCRYPTION: AES-256-GCM</div>
          <LiveClock />
          {/* --- Added Copyright Notice --- */}
          <div className="text-text-quaternary border-l border-border pl-3 sm:pl-4 hidden md:block">
            &copy; {new Date().getFullYear()} JITHIN M & SHAMIL T P
          </div>
        </div>
        <div className="flex items-center gap-4 sm:gap-6">
          <Settings className="w-3 h-3 text-text-secondary pointer-events-auto cursor-pointer hover:text-text-primary transition-colors" />
          <Cpu className="w-3 h-3 text-text-secondary" />
        </div>
      </footer>

      {/* Onboarding Tour Overlay - Floating Panel in Bottom-Right Corner */}
      <AnimatePresence>
        {showGuide && (
          <div className="fixed bottom-6 right-6 z-[9999] p-4 max-w-sm w-[90vw] pointer-events-auto">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              transition={{ type: "spring", duration: 0.5 }}
              className="w-full bg-[#0e0e0e]/95 border border-border rounded-lg p-5 shadow-[0_10px_50px_rgba(59,130,246,0.35)] relative overflow-hidden backdrop-blur-md"
            >
              {/* Core accent gradient bar */}
              <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-blue-500 via-indigo-500 to-purple-500" />

              {/* Header */}
              <div className="flex justify-between items-start mb-4">
                <div>
                  <span className="text-[9px] font-mono uppercase tracking-wide text-signal-info bg-surface-3 px-2 py-0.5 rounded-sm">
                    Interactive briefing â€¢ Step {guideStep + 1} of {tourSteps.length}
                  </span>
                  <h3 className="text-base font-bold tracking-tight text-text-primary mt-1.5">
                    {tourSteps[guideStep]?.title}
                  </h3>
                </div>
                <button
                  onClick={() => {
                    dismissGuide();
                    setShowFeedbackGate(true);
                  }}
                  className="text-text-quaternary hover:text-text-primary transition-colors cursor-pointer text-[10px] font-mono uppercase tracking-wider bg-white/5 hover:bg-white/10 px-1.5 py-0.5 rounded"
                >
                  Skip
                </button>
              </div>

              {/* Body Description */}
              <p className="text-xs text-neutral-300 leading-relaxed font-sans mb-5">
                {tourSteps[guideStep]?.description}
              </p>

              {/* Navigation Controls */}
              <div className="flex justify-between items-center pt-3 border-t border-border">
                <button
                  disabled={guideStep === 0}
                  onClick={() => {
                    const prevStep = guideStep - 1;
                    setGuideStep(prevStep);
                    tourSteps[prevStep]?.actionBefore?.();
                  }}
                  className={`px-3 py-1.5 border border-border text-[10px] font-mono uppercase tracking-wider hover:bg-white/5 transition-all rounded-sm flex items-center gap-1 cursor-pointer ${guideStep === 0 ? 'opacity-40 cursor-not-allowed' : ''}`}
                >
                  <ChevronLeft className="w-3 h-3" />
                  Back
                </button>

                <button
                  onClick={() => {
                    if (guideStep < tourSteps.length - 1) {
                      const nextStep = guideStep + 1;
                      setGuideStep(nextStep);
                      tourSteps[nextStep]?.actionBefore?.();
                    } else {
                      dismissGuide();
                      setShowFeedbackGate(true);
                    }
                  }}
                  className="px-3.5 py-1.5 bg-blue-600 hover:bg-blue-500 text-text-primary text-[10px] font-mono uppercase tracking-wider transition-all rounded-sm flex items-center gap-1 shadow-sm cursor-pointer"
                >
                  {guideStep === tourSteps.length - 1 ? 'Finish' : 'Next'}
                  <ChevronRight className="w-3 h-3 transition-opacity duration-300" />
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Project Setup Guide */}
      <AnimatePresence>
        {projectSetupGuide && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center bg-bg backdrop-blur-sm">
            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }} className="bg-bg border border-border w-full max-w-lg mx-4 rounded-xl p-6">
              <div className="flex items-center justify-between mb-6 pb-4 border-b border-border">
                <h3 className="text-sm font-sans tracking-tight uppercase tracking-wide">
                  {projectSetupGuide.executionMode === 'scrum' ? 'Sprint' : 'Kanban'} Setup
                </h3>
                <button onClick={() => setProjectSetupGuide(null)} className="text-text-quaternary hover:text-text-primary"><X className="w-4 h-4" /></button>
              </div>

              {projectSetupGuide.executionMode.toLowerCase() === 'kanban' && (
                <div className="space-y-4">
                  {projectSetupGuide.step === 0 && (
                    <div className="text-center py-8 space-y-4">
                      <Kanban className="w-12 h-12 text-cyan-400 mx-auto" />
                      <h4 className="text-base font-semibold">Kanban Board Ready</h4>
                      <p className="text-xs text-text-tertiary">Project created. Add work items to your board to start tracking progress.</p>
                      <div className="flex justify-center gap-3 pt-4">
                        <button onClick={() => setProjectSetupGuide({ ...projectSetupGuide, step: 0 })} className="px-4 py-2 bg-white/10 text-text-primary text-[10px] font-mono uppercase tracking-wider">Add Work Items</button>
                        <button onClick={() => setProjectSetupGuide(null)} className="px-4 py-2 bg-cyan-600 text-text-primary text-[10px] font-mono uppercase tracking-wider">Launch Board</button>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {projectSetupGuide.executionMode.toLowerCase() === 'scrum' && (
                <div className="space-y-6">
                  <div className="flex items-center gap-2 text-[10px] font-mono text-text-quaternary">
                    {['Epics', 'Stories', 'Sprint', 'Launch'].map((s, i) => (
                      <React.Fragment key={s}>
                        <span className={`flex items-center gap-1 ${i <= projectSetupGuide.step ? 'text-cyan-400' : ''}`}>
                          <span className={`w-4 h-4 rounded-full flex items-center justify-center text-[8px] font-bold ${i <= projectSetupGuide.step ? 'bg-cyan-500/20 border border-cyan-500' : 'bg-white/5 border border-border'}`}>{i < projectSetupGuide.step ? <Check className="w-2.5 h-2.5" /> : i + 1}</span>
                          {s}
                        </span>
                        {i < 3 && <span className="text-text-quaternary">→</span>}
                      </React.Fragment>
                    ))}
                  </div>

                  {projectSetupGuide.step === 0 && (
                    <div className="text-center py-6 space-y-4">
                      <Layers className="w-10 h-10 text-pink-400 mx-auto" />
                      <h4 className="text-sm font-semibold">Create Epics</h4>
                      <p className="text-[11px] text-text-tertiary">Epics are large bodies of work that contain multiple stories.</p>
                      <button onClick={() => setProjectSetupGuide({ ...projectSetupGuide, step: 1 })} className="px-4 py-2 bg-white/10 text-text-primary text-[10px] font-mono uppercase tracking-wider hover:bg-white/20 transition-colors">Skip — Next</button>
                    </div>
                  )}

                  {projectSetupGuide.step === 1 && (
                    <div className="text-center py-6 space-y-4">
                      <ListOrdered className="w-10 h-10 text-signal-warning mx-auto" />
                      <h4 className="text-sm font-semibold">Create Stories</h4>
                      <p className="text-[11px] text-text-tertiary">Break epics into user stories with acceptance criteria.</p>
                      <button onClick={() => setProjectSetupGuide({ ...projectSetupGuide, step: 2 })} className="px-4 py-2 bg-white/10 text-text-primary text-[10px] font-mono uppercase tracking-wider hover:bg-white/20 transition-colors">Skip — Next</button>
                    </div>
                  )}

                  {projectSetupGuide.step === 2 && (
                    <div className="text-center py-6 space-y-4">
                      <Play className="w-10 h-10 text-signal-info mx-auto" />
                      <h4 className="text-sm font-semibold">Create Sprint</h4>
                      <p className="text-[11px] text-text-tertiary">Define sprint duration and assign stories to the backlog.</p>
                      <button onClick={() => setProjectSetupGuide({ ...projectSetupGuide, step: 3 })} className="px-4 py-2 bg-white/10 text-text-primary text-[10px] font-mono uppercase tracking-wider hover:bg-white/20 transition-colors">Skip — Next</button>
                    </div>
                  )}

                  {projectSetupGuide.step === 3 && (
                    <div className="text-center py-6 space-y-4">
                      <Play className="w-12 h-12 text-signal-safe mx-auto" />
                      <h4 className="text-base font-semibold">Ready to Launch</h4>
                      <p className="text-xs text-text-tertiary">Your sprint is configured. Launch to begin tracking velocity.</p>
                      <button onClick={() => { setProjectSetupGuide(null); window.history.replaceState(null, '', '/execution'); window.dispatchEvent(new CustomEvent('popstate')); }} className="px-6 py-2 bg-green-600 text-text-primary text-[10px] font-mono uppercase tracking-wider hover:bg-green-500 transition-colors">Launch Sprint</button>
                    </div>
                  )}
                </div>
              )}

              <div className="flex justify-between mt-6 pt-4 border-t border-border">
                <button onClick={() => setProjectSetupGuide(null)} className="text-[10px] font-mono text-text-quaternary hover:text-text-primary transition-colors uppercase tracking-wider">Dismiss</button>
                {projectSetupGuide.executionMode.toLowerCase() === 'scrum' && projectSetupGuide.step < 3 && (
                  <button onClick={() => setProjectSetupGuide({ ...projectSetupGuide, step: projectSetupGuide.step + 1 })} className="flex items-center gap-1 text-[10px] font-mono uppercase tracking-wider text-cyan-400 hover:text-cyan-300 transition-colors">
                    Next <ChevronRight className="w-3 h-3" />
                  </button>
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Grid Overlay for aesthetic */}
      <div className="fixed inset-0 pointer-events-none z-[-1] opacity-20"
        style={{ backgroundImage: 'radial-gradient(circle at 2px 2px, rgba(255,255,255,0.05) 1px, transparent 0)', backgroundSize: '40px 40px' }}>
      </div>
    </div>
    </DashboardProvider>

  );
}

