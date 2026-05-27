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
import { supabase, isSupabaseConfigured } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';
import { useWorkspace } from '../../context/WorkspaceContext';
import { OperationalDataProvider, useOperationalData } from '../../context/OperationalDataContext';
import { DashboardDataBridge } from '../../components/dashboard/DashboardDataBridge';
import { ProgressiveUnlockHint } from '../../components/dashboard/ProgressiveUnlockHint';
import { useProgressiveDisclosure } from '../../hooks/useProgressiveDisclosure';
import { enableFullDisclosure } from '../../core/dashboard/progressiveDisclosure';
import { sha256 } from '../../utils/cryptoUtils';
import { sendNotification } from '../../services/notificationService';
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
import { hasCapability } from '../../core/auth/permissions';
import { Project, Team, Profile, User, UserRole } from '../../types';
import {
  SIDEBAR_NAV,
  normalizePath,
  isRegisteredPath,
  type SidebarGroup,
} from '../../app/routeRegistry';

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
  return (
    <OperationalDataProvider>
      <DashboardLayoutShell>{children}</DashboardLayoutShell>
    </OperationalDataProvider>
  );
}

function DashboardLayoutShell({ children }: { children?: React.ReactNode }) {
  const { user, profile, logout, updateProfile } = useAuth();
  const { workspace } = useWorkspace();
  const {
    raw,
    derived,
    loading,
    setProjects,
    refreshProjects,
    refreshAll,
    dbNotifications,
    updateWorkspaceSettings,
    refreshAttendance,
    refreshSalaries,
  } = useOperationalData();

  const attendanceRows = raw.attendanceRows;
  const salaryRows = raw.salaryRows;

  const projects = raw.projects;
  const tasks = raw.tasks;
  const teams = raw.teams;
  const profiles = raw.profiles;
  const projectsWithAggregatedPERT = derived.projectsWithPert;
  const visibleTasks = derived.visibleTasks;
  const systemData = derived.systemData;
  const userCustomRoles = derived.userCustomRoles;
  const customRoles = derived.customRoles;
  const activeTeams = derived.activeTeams;
  const stats = derived.stats;

  const disclosure = useProgressiveDisclosure({
    workspaceId: workspace?.id,
    role: profile?.role,
    profileCreatedAt: profile?.created_at,
    projectCount: projects.length,
    taskCount: tasks.length,
  });

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
    const target = normalizePath(path);
    if (import.meta.env.DEV && !isRegisteredPath(target)) {
      console.error(`[navigateTo] Unregistered path: ${path} (canonical: ${target})`);
    }
    window.history.pushState(null, '', target);
    window.dispatchEvent(new CustomEvent('popstate'));
  };

  const SIDEBAR_GROUP_LABELS: Record<SidebarGroup, string> = {
    core: 'Core',
    intelligence: 'Intelligence',
    operations: 'Operations',
    system: 'System',
  };

  const SIDEBAR_ICONS: Record<string, React.ReactNode> = {
    overview: <LayoutDashboard className="w-[15px] h-[15px] shrink-0" />,
    projects: <Briefcase className="w-[15px] h-[15px] shrink-0" />,
    board: <ListTodo className="w-[15px] h-[15px] shrink-0" />,
    scheduling: <Route className="w-[15px] h-[15px] shrink-0" />,
    analytics: <BarChart3 className="w-[15px] h-[15px] shrink-0" />,
    decisions: <BrainCircuit className="w-[15px] h-[15px] shrink-0" />,
    reports: <FileText className="w-[15px] h-[15px] shrink-0" />,
    logistics: <Truck className="w-[15px] h-[15px] shrink-0" />,
    teams: <Users className="w-[15px] h-[15px] shrink-0" />,
    portfolio: <Building2 className="w-[15px] h-[15px] shrink-0" />,
    audit: <Activity className="w-[15px] h-[15px] shrink-0" />,
    settings: <Settings className="w-[15px] h-[15px] shrink-0" />,
    integrations: <Link2 className="w-[15px] h-[15px] shrink-0" />,
  };

  const isSidebarItemActive = (path: string): boolean => {
    const current = window.location.pathname;
    if (path === '/overview') return current === '/overview' || current === '/';
    if (path === '/workspace') return current === '/workspace';
    if (path === '/execution') {
      return current.startsWith('/execution')
        && !current.includes('timeline')
        && !current.includes('sprints')
        && !current.includes('gantt');
    }
    if (path === '/execution/timeline') return current.includes('timeline');
    if (path === '/resources') return current === '/resources' || current.startsWith('/resources/logistics');
    if (path === '/control/settings') {
      return current === '/control/settings' || current.startsWith('/control/settings/');
    }
    return current === path || current.startsWith(`${path}/`);
  };

  const visibleSidebarGroups = useMemo(() => {
    const order: SidebarGroup[] = ['core', 'intelligence', 'operations', 'system'];
    return order
      .map(group => ({
        group,
        items: SIDEBAR_NAV.filter(
          item =>
            item.group === group
            && (!item.capability || hasCapability(profile?.role, item.capability))
            && disclosure.isNavVisible(item),
        ),
      }))
      .filter(g => g.items.length > 0);
  }, [profile?.role, disclosure]);

  const [routePath, setRoutePath] = useState(() => normalizePath(window.location.pathname));

  useEffect(() => {
    const syncRoute = () => setRoutePath(normalizePath(window.location.pathname));
    window.addEventListener('popstate', syncRoute);
    return () => window.removeEventListener('popstate', syncRoute);
  }, []);

  useEffect(() => {
    if (!disclosure.active || loading) return;
    if (routePath === '/overview' || routePath === '/') return;
    if (disclosure.isRouteVisible(routePath)) return;

    window.dispatchEvent(
      new CustomEvent('notify-toast', {
        detail: {
          message: disclosure.nextUnlock?.message
            || 'This area unlocks as you add projects and complete the guided tour.',
          type: 'info',
        },
      }),
    );
    navigateTo('/overview');
  }, [disclosure.active, disclosure.level, loading, routePath]);

  const handleShowAllFeatures = () => {
    if (!workspace?.id) return;
    enableFullDisclosure(workspace.id);
    window.location.reload();
  };

  const rawSystemData = useMemo(
    () => (teams.find(t => t.name === 'SYSTEM_SETTINGS')?.data as Record<string, unknown>) || {},
    [teams],
  );

  const [isAdding, setIsAdding] = useState(false);
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
    const p = routePath.replace(/\/+$/, '').split('/').filter(Boolean);
    if (p.length === 0) return { section: 'OVERVIEW', page: '' };

    let section = p[0];
    let page = p.length > 1 ? p.slice(1).join(' / ') : '';
    
    const sectionLabels: Record<string, string> = {
      workspace: 'WORKSPACE',
      execution: 'EXECUTION',
      resources: 'RESOURCES',
      control: 'SYSTEM CONTROL'
    };
    
    const pageLabels: Record<string, string> = {
      'portfolio': 'PORTFOLIO',
      'knowledge': 'KNOWLEDGE',
      'decisions': 'DECISIONS',
      'board': 'BOARD',
      'timeline': 'TIMELINE',
      'gantt': 'GANTT',
      'sprints': 'SPRINTS',
      'teams': 'TEAMS',
      'capacity': 'CAPACITY',
      'work-logs': 'WORK LOGS',
      'identity': 'IDENTITY',
      'analytics': 'ANALYTICS',
      'audit': 'AUDIT LOG',
      'automations': 'AUTOMATIONS',
      'connections': 'INTEGRATIONS'
    };

    return {
      section: sectionLabels[section] || section.toUpperCase(),
      page: pageLabels[p[p.length - 1]] || page.toUpperCase()
    };
  }, [routePath]);

  const tourSteps = useMemo(() => {
    const role = profile?.role || 'viewer';

    if (hasCapability(role, 'platform_governance')) {
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
          actionBefore: () => navigateTo('/resources')
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
    } else if (hasCapability(role, 'manage_projects')) {
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



  // Expose profile modal trigger for header and listen for global toast notifications
  useEffect(() => {
    (window as any).openProfileModal = () => setIsProfileOpen(true);

    const handleToast = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      if (detail) {
        notify(detail.message, detail.type);
      }
    };
    window.addEventListener('notify-toast', handleToast);
    return () => {
      window.removeEventListener('notify-toast', handleToast);
    };
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

  const notify = (message: any, type: Notification['type'] = 'info') => {
    const id = Math.random().toString(36).substring(7);
    const msgString = typeof message === 'object' && message !== null
      ? (message.message || JSON.stringify(message))
      : String(message);
    setNotifications(prev => [...prev, { id, message: msgString, type }]);
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
  const [proposedStartDate, setProposedStartDate] = useState<string>(getLocalDateString());
  const [newClientDeadline, setNewClientDeadline] = useState<string>('');
  const [newPriority, setNewPriority] = useState<string>('medium');
  const [newTeamId, setNewTeamId] = useState<string>('');
  const [newExecutionMode, setNewExecutionMode] = useState<string>('KANBAN');
  const [frictionInfra, setFrictionInfra] = useState(false);
  const [frictionData, setFrictionData] = useState(false);
  const [frictionSla, setFrictionSla] = useState(false);

  useEffect(() => {
    if (window.location.hash && window.location.hash.includes('access_token')) {
      window.history.replaceState(null, '', window.location.pathname);
    }
  }, []);


  // Automated database migration to dedicated tables
  useEffect(() => {
    if (!isSupabaseConfigured || loading || !workspace?.id) return;

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
              await refreshAttendance();
            }
          } catch (e) {
            console.error("Attendance migration failed:", e);
          }
        }
      }

      // Migrate Salaries
      const oldSalaries = rawSystemData.salaries;
      if (oldSalaries && Object.keys(oldSalaries).length > 0 && salaryRows.length === 0) {
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
              await refreshSalaries();
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
  }, [loading, rawSystemData, attendanceRows.length, salaryRows.length, workspace?.id, refreshAttendance, refreshSalaries]);

  const handleLogout = async () => {
    await logout();
    setProjects([]);
  };

  const handleUpdateProjectMetadata = async (
    id: string,
    updates: Partial<Project>,
    changeLog?: { changes: string; reason: string; authorName: string; authorRole: string }
  ) => {
    // Store change log directly in dedicated database table
    if (changeLog && isSupabaseConfigured) {
      try {
        const { data: latestLog, error: latestError } = await supabase
          .from('change_logs')
          .select('hash')
          .eq('project_id', id)
          .order('timestamp', { ascending: false })
          .limit(1)
          .maybeSingle();

        const previousHash = (!latestError && latestLog?.hash) ? latestLog.hash : 'GENESIS_BLOCK';
        const timestamp = new Date().toISOString();
        const message = `${id}${timestamp}${changeLog.changes}${changeLog.reason}${changeLog.authorName}${changeLog.authorRole}${previousHash}`;
        const newHash = await sha256(message);

        await supabase.from('change_logs').insert({
          project_id: id,
          changes: changeLog.changes,
          reason: changeLog.reason,
          author_name: changeLog.authorName,
          author_role: changeLog.authorRole,
          timestamp: timestamp,
          previous_hash: previousHash,
          hash: newHash
        });
        console.log("Successfully saved change log in dedicated table.");
      } catch (e) {
        console.error("Failed to save change log in dedicated table:", e);
      }
    }

    // Relieve team and snapshot history upon completion
    if (updates.status === 'deployed') {
      const project = projects.find(p => p.id === id);
      const team = teams.find(t => t.id === (updates.team_id || project?.team_id));
      if (team) {
        const historyTag = `TEAM:${team.name}`;
        const currentTags = updates.tags || project?.tags || [];
        updates.tags = [...currentTags.filter(t => !t.startsWith('TEAM:')), historyTag, 'FINALIZED'];
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
      notify("Project details saved.", "success");
    } else {
      console.error("Metadata update failed:", error);
      notify(`Sync failed: ${error?.message || "Unknown error"}`, "error");
    }
  };


  const handleUpdateProfile = async (updates: Partial<Profile>) => {
    if (!user) return;
    const success = await updateProfile(updates);

    if (success) {
      notify("Identity parameters updated.", "success");
    } else {
      notify("Sync failed.", "error");
    }
  };

  const handleDeleteProject = async (id: string, reason: string) => {
    askConfirmation(
      "Archive Project",
      `Are you sure you want to archive this project? Reason: ${reason}`,
      async () => {
        const { error } = await supabase
          .from('projects')
          .delete()
          .eq('id', id);

        if (!error) {
          setProjects(projects.filter(p => p.id !== id));
          notify("Project archived successfully.", "success");
          setSelectedProject(null);
        } else {
          console.error("Project archive failed:", error);
          notify(`Deletion failed: ${error.message}`, "error");
        }
      }
    );
  };


  const handleCreateProject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim()) {
      notify("Project designation is required.", "error");
      return;
    }
    if (!hasCapability(profile?.role, 'manage_projects')) {
      notify("Unauthorized: Insufficient permissions to create projects.", "error");
      return;
    }
    if (!workspace?.id) {
      notify("No active workspace selected.", "error");
      return;
    }

    if (!proposedStartDate) {
      notify("Proposed Start Date is required.", "error");
      return;
    }
    if (!newClientDeadline) {
      notify("Client Deadline is required.", "error");
      return;
    }
    if (new Date(proposedStartDate) > new Date(newClientDeadline)) {
      notify("Client Deadline cannot be before the Proposed Start Date.", "error");
      return;
    }

    const inputString = `${newName}-${proposedStartDate}-${newClientDeadline}-${user.id}`;
    let integrityHash = '';
    try {
      integrityHash = sha256 ? await sha256(inputString) : `hash_${Date.now()}`;
    } catch {
      integrityHash = `hash_${Date.now()}`;
    }

    const newProject = {
      workspace_id: workspace.id,
      name: newName,
      status: 'planning',
      priority: newPriority,
      execution_mode: newExecutionMode,
      efficiency: 0.8,
      proposed_start_date: proposedStartDate,
      client_deadline: newClientDeadline,
      team_id: newTeamId || null,
      owner_id: user.id,
      tags: ['NEW'],
      audit_header: {
        created_by: user.id,
        system_integrity_hash: integrityHash,
        is_locked: true,
        system_signature: "GEN_SIG_V1"
      }
    };

    if (typeof window !== 'undefined') console.debug('[pipeline] createProject:start', { name: newName });

    const { data, error } = await supabase
      .from('projects')
      .insert(newProject)
      .select()
      .single();

    if (!error && data) {
      if (typeof window !== 'undefined') console.debug('[pipeline] createProject:success', { id: data.id });

      const selectedFrictions: string[] = [];
      if (frictionInfra) selectedFrictions.push("Client Infrastructure Access Lag");
      if (frictionData) selectedFrictions.push("External Data Provisioning Delay");
      if (frictionSla) selectedFrictions.push("Third-Party SLA / Compliance Review");

      const projectDurations = { ...(raw.workspaceSettingsBlob?.project_state_durations as Record<string, unknown> || {}) } as Record<string, any>;
      projectDurations[data.id] = {
        currentState: selectedFrictions.length > 0 ? 'passive_wait' : 'active',
        activeDays: 0,
        passiveWaitDays: 0,
        blockedDays: 0,
        lastStateChange: new Date().toISOString(),
        frictions: selectedFrictions,
      };

      await updateWorkspaceSettings({
        project_state_durations: projectDurations,
      });

      setProjects(prev => [data as import('../../types').Project, ...prev]);
      setIsAdding(false);
      setNewName('');
      setProposedStartDate('');
      setNewClientDeadline('');
      setNewPriority('medium');
      setNewTeamId('');
      setFrictionInfra(false);
      setFrictionData(false);
      setFrictionSla(false);
      notify("Project created successfully.", "success");

      if (typeof window !== 'undefined') console.debug('[pipeline] projectVisible:confirmed', { id: data.id, name: data.name });

      // Immutable log (fire-and-forget, never blocks visibility)
      activityLogService.appendLog({
        workspace_id: workspace.id,
        actor_id: user.id,
        action: 'project_created',
        metadata: { project_id: data.id, name: data.name, execution_mode: data.execution_mode }
      }).catch(() => {});

      // Open guided setup for execution mode
      if (data?.execution_mode) {
        window.dispatchEvent(new CustomEvent('start-project-setup', { detail: { projectId: data.id, executionMode: data.execution_mode } }));
      }
    } else {
      console.error("[pipeline] createProject:error", error);
      notify(`System Error: ${error?.message || "Failed to create project"}`, "error");
    }
  };

  const updateExecutionMode = async (projectId: string, mode: import('../../types').ExecutionMode) => {
    if (!workspace?.id || !isSupabaseConfigured) return;
    const { error } = await supabase
      .from('projects')
      .update({ execution_mode: mode, updated_at: new Date().toISOString() })
      .eq('id', projectId);
    if (!error) {
      setProjects(prev => prev.map(p => p.id === projectId ? { ...p, execution_mode: mode } : p));
      notify(`Project execution mode updated to ${mode}`, 'success');
    } else {
      notify(`Failed to update execution mode: ${error.message}`, 'error');
    }
  };

  // Promote a task from Board into the Project creation form
  const handlePromoteTaskToAsset = (taskData: { title: string; description: string; projectId: string }) => {
    setNewName(taskData.title);
    navigateTo('/workspace');
    setIsAdding(true);
    notify(`Task "${taskData.title}" elevated Î“Ã‡Ã¶ fill in PERT estimates to register as a project.`, 'info');
  };

  const getSuggestedTeam = () => {
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

  if (loading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-5 font-geist"
        style={{ background: 'var(--pm-bg)' }}>
        <div className="relative w-12 h-12">
          <div className="absolute inset-0 rounded-full border-2 border-t-transparent animate-spin"
            style={{ borderColor: 'rgba(192,193,255,0.15)', borderTopColor: 'var(--pm-primary)' }} />
        </div>
        <div className="text-center space-y-1">
          <p className="font-mono-pm text-[11px] uppercase tracking-[0.3em]" style={{ color: 'var(--pm-primary)', opacity: 0.7 }}>
            Initializing Core Engine
          </p>
          <p className="font-mono-pm text-[10px]" style={{ color: 'var(--pm-on-surface-variant)', opacity: 0.4 }}>
            Loading workspace data...
          </p>
        </div>
      </div>
    );
  }


  if (!user) {
    return <Login />;
  }

  return (
    <DashboardDataBridge
      ui={{
        searchTerm,
        setSearchTerm,
        dashboardTab,
        setDashboardTab,
        isAdding,
        setIsAdding,
        handleUpdateProjectMetadata,
        handlePromoteTaskToAsset,
        askConfirmation,
        notify,
        workingHoursPerDay,
        tilesPerRow,
        setIsRosterOpen,
        setSelectedProject,
        updateExecutionMode,
      }}
    >
      <div className={`min-h-screen font-geist selection:bg-accent-primary selection:text-text-primary transition-colors duration-200 ${theme === 'light' ? 'light' : ''}`}
        style={{ background: 'var(--pm-bg)', color: 'var(--pm-on-surface)' }}>
        
        {/* Left Sidebar (Fixed on Desktop, Slide-out on Mobile) */}
        <aside className="hidden lg:flex lg:flex-col lg:fixed lg:inset-y-0 lg:left-0 lg:w-[15.5rem] border-r z-30"
          style={{ background: 'var(--pm-surface-lowest)', borderColor: 'rgba(70,69,84,0.3)' }}>
          {/* Sidebar Brand */}
          <div className="flex items-center gap-3 h-16 px-5 border-b shrink-0"
            style={{ borderColor: 'rgba(70,69,84,0.3)' }}>
            <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0 overflow-hidden">
              <img src="/logo.png" alt="Resolve PM" className="w-full h-full object-contain" />
            </div>
            <div>
              <h1 className="font-semibold tracking-tight text-[13px] font-geist" style={{ color: 'var(--pm-primary)' }}>Resolve PM</h1>
              <p className="text-[9px] font-mono-pm uppercase tracking-[0.15em]" style={{ color: 'var(--pm-on-surface-variant)', opacity: 0.5 }}>Enterprise Orchestration</p>
            </div>
          </div>

          {/* Nav — driven by routeRegistry */}
          <div className="flex-1 overflow-y-auto px-3 py-4 space-y-5 pm-scrollbar">
            {visibleSidebarGroups.map(({ group, items }) => (
              <div key={group} className="space-y-0.5">
                <p className="text-[9px] font-mono-pm uppercase tracking-[0.2em] px-3 mb-2"
                  style={{ color: 'var(--pm-on-surface-variant)', opacity: 0.4 }}>
                  {SIDEBAR_GROUP_LABELS[group]}
                </p>
                {items.map(item => {
                  const active = isSidebarItemActive(item.path);
                  const isDecisions = item.id === 'decisions';
                  return (
                    <button
                      key={item.id}
                      onClick={() => {
                        if (isDecisions) setDashboardTab('intelligence');
                        navigateTo(item.path);
                      }}
                      className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-[12px] font-medium transition-all duration-150"
                      style={active ? {
                        background: 'rgba(67,70,83,0.5)',
                        color: 'var(--pm-primary)',
                        borderLeft: '3px solid var(--pm-primary)',
                        paddingLeft: '9px',
                      } : {
                        color: 'var(--pm-on-surface-variant)',
                      }}
                      onMouseEnter={e => { if (!active) { (e.currentTarget as any).style.background = 'rgba(51,53,55,0.4)'; (e.currentTarget as any).style.color = 'var(--pm-on-surface)'; } }}
                      onMouseLeave={e => { if (!active) { (e.currentTarget as any).style.background = ''; (e.currentTarget as any).style.color = 'var(--pm-on-surface-variant)'; } }}
                    >
                      {SIDEBAR_ICONS[item.id]}
                      {item.label}
                    </button>
                  );
                })}
              </div>
            ))}
          </div>

          {disclosure.active && disclosure.nextUnlock && (
            <ProgressiveUnlockHint
              message={disclosure.nextUnlock.message}
              nextLevel={disclosure.nextUnlock.level}
              lockedCount={disclosure.lockedCount}
              onShowAll={hasCapability(profile?.role, 'manage_settings') ? handleShowAllFeatures : undefined}
            />
          )}

          {/* Bottom utility strip */}
          <div className="shrink-0 border-t" style={{ borderColor: 'rgba(70,69,84,0.3)' }}>
            <button
              onClick={() => (window as any).startOnboardingTour?.()}
              className="w-full flex items-center gap-2.5 px-5 py-2.5 transition-colors text-[11px] font-geist"
              style={{ color: 'var(--pm-on-surface-variant)', opacity: 0.5 }}
              onMouseEnter={e => { (e.currentTarget as any).style.opacity = '1'; }}
              onMouseLeave={e => { (e.currentTarget as any).style.opacity = '0.5'; }}
            >
              <HelpCircle className="w-3.5 h-3.5 shrink-0" />
              Help & Documentation
            </button>

            {/* User identity strip */}
            <div className="flex items-center gap-3 px-4 py-3 border-t" style={{ borderColor: 'rgba(70,69,84,0.3)' }}>
              <div
                onClick={() => setIsProfileOpen(true)}
                className="w-8 h-8 rounded-full flex items-center justify-center overflow-hidden shrink-0 cursor-pointer transition-all"
                style={{ background: 'rgba(192,193,255,0.08)', border: '1px solid rgba(192,193,255,0.2)' }}
              >
                {profile?.avatar_url ? (
                  <img src={profile.avatar_url} alt="Avatar" className="w-full h-full object-cover" />
                ) : profile?.full_name ? (
                  <span className="text-[10px] font-bold" style={{ color: 'var(--pm-primary)' }}>{profile.full_name.substring(0, 2).toUpperCase()}</span>
                ) : (
                  <Users className="w-3.5 h-3.5" style={{ color: 'var(--pm-primary)' }} />
                )}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[12px] font-medium truncate font-geist" style={{ color: 'var(--pm-on-surface)' }}>
                  {profile?.full_name || user.email?.split('@')[0]}
                </p>
                <p className="text-[9px] truncate capitalize font-mono-pm" style={{ color: 'var(--pm-primary)', opacity: 0.7 }}>
                  {(profile && userCustomRoles[profile.id]) || profile?.role?.replace('_', ' ') || 'Viewer'}
                </p>
              </div>
              <button
                onClick={handleLogout}
                className="p-1.5 rounded-md transition-colors cursor-pointer"
                style={{ color: 'var(--pm-on-surface-variant)' }}
                onMouseEnter={e => { (e.currentTarget as any).style.color = 'var(--pm-error)'; (e.currentTarget as any).style.background = 'rgba(255,180,171,0.08)'; }}
                onMouseLeave={e => { (e.currentTarget as any).style.color = 'var(--pm-on-surface-variant)'; (e.currentTarget as any).style.background = ''; }}
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
                    <div className="w-8 h-8 rounded-lg flex items-center justify-center">
                      <img src="/logo.png" alt="Resolve PM" className="w-full h-full object-contain" />
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

                <div className="flex-1 overflow-y-auto px-4 py-6 space-y-6">
                  {visibleSidebarGroups.map(({ group, items }) => (
                    <div key={group} className="space-y-2">
                      <p className="text-[9px] font-mono font-bold text-text-tertiary uppercase tracking-wide px-3">
                        {SIDEBAR_GROUP_LABELS[group]}
                      </p>
                      <div className="space-y-1">
                        {items.map(item => {
                          const active = isSidebarItemActive(item.path);
                          return (
                            <button
                              key={item.id}
                              onClick={() => {
                                if (item.id === 'decisions') setDashboardTab('intelligence');
                                navigateTo(item.path);
                                setMobileSidebarOpen(false);
                              }}
                              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-xs font-medium transition-all ${
                                active
                                  ? 'bg-primary-gradient text-text-primary shadow-md'
                                  : 'text-text-secondary hover:bg-white/5 hover:text-text-primary'
                              }`}
                            >
                              {SIDEBAR_ICONS[item.id]}
                              {item.label}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                  {disclosure.active && disclosure.nextUnlock && (
                    <ProgressiveUnlockHint
                      message={disclosure.nextUnlock.message}
                      nextLevel={disclosure.nextUnlock.level}
                      lockedCount={disclosure.lockedCount}
                      onShowAll={hasCapability(profile?.role, 'manage_settings') ? handleShowAllFeatures : undefined}
                    />
                  )}
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
        <div className="lg:pl-[15.5rem] flex flex-col flex-1 min-h-screen" style={{ background: 'var(--pm-bg)' }}>
          
          {/* Top Bar — utility layer, breadcrumb, operational status */}
          <header className="h-12 flex items-center justify-between px-5 border-b sticky top-0 z-40 backdrop-blur-xl transition-colors duration-200"
            style={{ background: 'rgba(12,14,16,0.92)', borderColor: 'rgba(70,69,84,0.3)' }}>
            {/* Mobile menu toggle */}
            <div className="flex items-center gap-3 lg:hidden">
              <button
                onClick={() => setMobileSidebarOpen(true)}
                className="p-1.5 border border-border-subtle bg-surface-3 rounded-md text-text-tertiary"
              >
                <Menu className="w-4 h-4" />
              </button>
              <div className="w-8 h-8 rounded-md flex items-center justify-center shrink-0">
                  <img src="/logo.png" alt="Resolve PM" className="w-full h-full object-contain" />
                </div>
            </div>

            {/* Top bar center: live breadcrumb / context label */}
            <div className="hidden sm:flex items-center gap-2 text-[11px] font-mono-pm">
              <span className="w-1.5 h-1.5 rounded-full operational-pulse" style={{ background: 'var(--pm-primary)' }} />
              <span className="uppercase tracking-[0.15em]" style={{ color: 'var(--pm-primary)', opacity: 0.7 }}>Resolve PM</span>
              <span style={{ color: 'var(--pm-on-surface-variant)', opacity: 0.3 }}>/</span>
              <span className="uppercase" style={{ color: 'var(--pm-on-surface-variant)', opacity: 0.6 }}>{breadcrumb?.section || 'Command Center'}</span>
              {breadcrumb?.page && <><span style={{ color: 'var(--pm-on-surface-variant)', opacity: 0.3 }}>/</span><span style={{ color: 'var(--pm-on-surface)' }}>{breadcrumb.page}</span></>}
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
                <span className="ml-2 bg-surface-3 border border-border-subtle px-1 py-0.5 rounded text-[8px] font-mono tracking-tighter text-text-quaternary">Î“Ã®Ã¿K</span>
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
              {profile && hasCapability(profile.role, 'manage_projects') && (
                <button
                  onClick={() => setIsAdding(true)}
                  className="flex items-center gap-1.5 text-[11px] font-medium h-7 px-3 rounded-md transition-all cursor-pointer shrink-0 active:scale-95"
                  style={{ background: 'var(--pm-primary)', color: 'var(--pm-on-primary)', fontFamily: 'Geist, sans-serif' }}
                >
                  <Plus className="w-3 h-3" />
                  <span className="hidden sm:inline">New Project</span>
                </button>
              )}
            </div>
          </header>

          {/* Context Header — Welcome + operational context */}
          {window.location.pathname === '/workspace' && (
            <div className="px-6 pt-7 pb-5 border-b" style={{ borderColor: 'rgba(70,69,84,0.3)' }}>
              <div className="flex items-end justify-between">
                <div>
                  <p className="font-mono-pm text-[9px] uppercase tracking-[0.2em] mb-1" style={{ color: 'var(--pm-on-surface-variant)', opacity: 0.5 }}>Command Center</p>
                  <h2 className="text-[22px] font-semibold tracking-tight leading-none font-geist" style={{ color: 'var(--pm-on-surface)' }}>
                    {profile?.full_name?.split(' ')[0] || user.email?.split('@')[0]}'s Workspace
                  </h2>
                  <p className="font-mono-pm text-[11px] mt-1.5" style={{ color: 'var(--pm-on-surface-variant)', opacity: 0.5 }}>
                    {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })} · {dbNotifications.filter(n => !n.read_at).length > 0 ? `${dbNotifications.filter(n => !n.read_at).length} unread notification${dbNotifications.filter(n => !n.read_at).length > 1 ? 's' : ''}` : 'All systems operational'}
                  </p>
                </div>
                <div className="flex items-center gap-1.5 font-mono-pm text-[9px] uppercase tracking-[0.2em]"
                  style={{ color: 'var(--pm-primary)', opacity: 0.7 }}>
                  <div className="w-1.5 h-1.5 rounded-full operational-pulse" style={{ background: 'var(--pm-primary)' }} />
                  Live
                </div>
              </div>
            </div>
          )}

          {/* StatsGrid Î“Ã‡Ã¶ only show on project/completed tabs */}
          {dashboardTab !== 'dashboard' && dashboardTab !== 'intelligence' && window.location.pathname === '/workspace' && (
            <StatsGrid stats={stats} />
          )}

          {/* Dynamic Page Routing Slot */}
          <main id="main-content" className="flex-1 px-6 py-5 overflow-y-auto pb-6">
            {children}
          </main>

          {/* Status Footer */}
          <footer className="bg-[#0b0c12] border-t border-border-subtle px-5 py-3 flex justify-between items-center pointer-events-none z-20 shrink-0">
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

        </div>

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
          projects={projectsWithAggregatedPERT}
          tasks={visibleTasks}
          setSelectedProject={setSelectedProject}
          notify={notify}
          setIsAdding={setIsAdding}
          workspaceId={workspace?.id}
          disclosureLevel={disclosure.level}
          disclosureActive={disclosure.active}
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

                {/* Anticipated Operational Friction Section */}
                <div className="space-y-3 p-4 bg-white/5 border border-border rounded-sm">
                  <span className="block text-[10px] uppercase font-mono text-text-secondary tracking-wide">Anticipated Operational Friction</span>
                  <div className="space-y-2">
                    <label className="flex items-center gap-2 text-xs font-mono text-text-secondary cursor-pointer select-none">
                      <input
                        type="checkbox"
                        checked={frictionInfra}
                        onChange={e => setFrictionInfra(e.target.checked)}
                        className="w-3.5 h-3.5 accent-white cursor-pointer"
                      />
                      <span>Client Infrastructure Access Lag</span>
                    </label>
                    <label className="flex items-center gap-2 text-xs font-mono text-text-secondary cursor-pointer select-none">
                      <input
                        type="checkbox"
                        checked={frictionData}
                        onChange={e => setFrictionData(e.target.checked)}
                        className="w-3.5 h-3.5 accent-white cursor-pointer"
                      />
                      <span>External Data Provisioning Delay</span>
                    </label>
                    <label className="flex items-center gap-2 text-xs font-mono text-text-secondary cursor-pointer select-none">
                      <input
                        type="checkbox"
                        checked={frictionSla}
                        onChange={e => setFrictionSla(e.target.checked)}
                        className="w-3.5 h-3.5 accent-white cursor-pointer"
                      />
                      <span>Third-Party SLA / Compliance Review</span>
                    </label>
                  </div>
                </div>

                <div className="bg-white/5 border border-border p-4">
                  <div className="flex justify-between items-center text-[10px] uppercase font-mono mb-2">
                    <span className="text-text-secondary">Statistical Estimate</span>
                    <span className="text-text-secondary">
                      DYNAMIC σ
                    </span>
                  </div>
                  <p className="text-[11px] font-mono text-text-secondary mt-1 leading-relaxed">
                    Project timeline dynamically managed by downstream task intervals and verified external friction metrics.
                  </p>
                  <p className="text-[11px] font-mono text-text-secondary mt-2 italic leading-relaxed">
                    Target deadline (±σ) is contractually bound to downstream task execution blocks and external client liabilities.
                    {(frictionInfra || frictionData || frictionSla) && (
                      <span className="block mt-1 text-signal-warning text-[10px] uppercase font-bold">
                        Warning: Timeline is bound to active external wait-states.
                      </span>
                    )}
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
            attendanceRecords={systemData.attendance as Record<string, Record<string, { status: string; leaveType?: string; isPaidHalfDay?: boolean; }>> || {}}
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
                    Interactive briefing — Step {guideStep + 1} of {tourSteps.length}
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
                        {i < 3 && <span className="text-text-quaternary">Î“Ã¥Ã†</span>}
                      </React.Fragment>
                    ))}
                  </div>

                  {projectSetupGuide.step === 0 && (
                    <div className="text-center py-6 space-y-4">
                      <Layers className="w-10 h-10 text-pink-400 mx-auto" />
                      <h4 className="text-sm font-semibold">Create Epics</h4>
                      <p className="text-[11px] text-text-tertiary">Epics are large bodies of work that contain multiple stories.</p>
                      <button onClick={() => setProjectSetupGuide({ ...projectSetupGuide, step: 1 })} className="px-4 py-2 bg-white/10 text-text-primary text-[10px] font-mono uppercase tracking-wider hover:bg-white/20 transition-colors">Skip Î“Ã‡Ã¶ Next</button>
                    </div>
                  )}

                  {projectSetupGuide.step === 1 && (
                    <div className="text-center py-6 space-y-4">
                      <ListOrdered className="w-10 h-10 text-signal-warning mx-auto" />
                      <h4 className="text-sm font-semibold">Create Stories</h4>
                      <p className="text-[11px] text-text-tertiary">Break epics into user stories with acceptance criteria.</p>
                      <button onClick={() => setProjectSetupGuide({ ...projectSetupGuide, step: 2 })} className="px-4 py-2 bg-white/10 text-text-primary text-[10px] font-mono uppercase tracking-wider hover:bg-white/20 transition-colors">Skip Î“Ã‡Ã¶ Next</button>
                    </div>
                  )}

                  {projectSetupGuide.step === 2 && (
                    <div className="text-center py-6 space-y-4">
                      <Play className="w-10 h-10 text-signal-info mx-auto" />
                      <h4 className="text-sm font-semibold">Create Sprint</h4>
                      <p className="text-[11px] text-text-tertiary">Define sprint duration and assign stories to the backlog.</p>
                      <button onClick={() => setProjectSetupGuide({ ...projectSetupGuide, step: 3 })} className="px-4 py-2 bg-white/10 text-text-primary text-[10px] font-mono uppercase tracking-wider hover:bg-white/20 transition-colors">Skip Î“Ã‡Ã¶ Next</button>
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
    </DashboardDataBridge>

  );
}


