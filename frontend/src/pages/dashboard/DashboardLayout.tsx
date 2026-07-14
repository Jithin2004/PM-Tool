import React, { useState, useEffect, useMemo } from 'react';
import {
  BarChart3, Activity, Users, Clock, Target, Plus, Search,
  ChevronRight, ChevronLeft, AlertTriangle, BrainCircuit,
  Settings, LogOut, Zap, TrendingUp, Cpu, Edit2, Trash2,
  History, Calendar, DollarSign, Sliders, Check, Lock,
  Calculator, TrendingDown, Banknote, Download, Menu, X,
  Sun, Moon, Layers, ListOrdered, Kanban, Play,
  Briefcase, ListTodo, FileText, Link2, Bell, HelpCircle, LayoutDashboard,
  Truck, Route, GitBranch, Building2, Radar, Shield, BookOpen,
  Sparkles, MessageSquare, Terminal, Globe, Command, Sunset,
  Archive, UserCog, Mail, ChevronDown, WifiOff, RefreshCw,
  Link as LinkIcon
} from 'lucide-react';
import { updateProfile as authUpdateProfile } from '../../services/authProfileService';
import { showConfirm } from '../../components/common/Dialogs';
import { motion, AnimatePresence } from 'motion/react';
import { supabase, isSupabaseConfigured } from '../../lib/supabase';
import { switchWorkspace } from '../../services/authWorkspaceService';
import { ErrorBoundary } from '../../components/ui/ErrorBoundary';
import { useAuth } from '../../context/AuthContext';
import { useWorkspace } from '../../context/WorkspaceContext';
import { useOperationalData } from '../../context/OperationalDataContext';
import { useTheme } from '../../context/ThemeContext';
import { DashboardDataBridge } from '../../components/dashboard/DashboardDataBridge';
import { ProgressiveUnlockHint } from '../../components/dashboard/ProgressiveUnlockHint';
import { useProgressiveDisclosure } from '../../hooks/useProgressiveDisclosure';
import { enableFullDisclosure } from '../../core/dashboard/progressiveDisclosure';
import { sha256 } from '../../utils/cryptoUtils';
import { activityEventService } from '../../services/activityEventService';
import { activityLogService } from '../../services/activityLogService';
import { getLicenseInfo } from '../../lib/productKey';
import { errorMessageService } from '../../services/errorMessageService';

// Lucide imports merged above
import { ActionInbox } from '../../components/inbox/ActionInbox';
import { Login } from '../../components/auth/Login';
import CommandPalette from '../../components/command/CommandPalette';
import CommandAnalytics from '../../components/command/CommandAnalytics';
import { NotificationCenter } from '../../components/common/NotificationCenter';
import { NotificationToast, Notification } from '../../components/ui/NotificationToast';
import { ConfirmationModal } from '../../components/ui/ConfirmationModal';
import { LiveClock } from '../../components/ui/LiveClock';
import { StatsGrid, StatCard } from '../../components/dashboard/StatsGrid';
import { ProjectCard } from '../../components/project/ProjectCard';
import { TeamMember } from '../../components/team/TeamMember';
import { LogisticsDashboard } from '../../components/admin/LogisticsDashboard';
import { ProjectDetailsModal } from '../../components/project/ProjectDetailsModal';
import { ProjectCreationModal } from '../../components/project/ProjectCreationModal';
import { TeamRosterModal } from '../../components/team/TeamRosterModal';
import { UserProfileModal } from '../../components/user/UserProfileModal';
import { WelcomeCenter } from '../../components/onboarding/WelcomeCenter';
import { SupportEscalationModal } from '../../components/support/SupportEscalationModal';
import { calculateExpectedTime, calculateVariance, calculateHoursFromRange, getLocalDateString, getRelativeTime } from '../../utils/timeUtils';
import { hasCapability, hasAuthority, hasFunction, Capability } from '../../core/auth/permissions';
import { Project, Team, Profile, User, UserRole } from '../../types';
import {
  SIDEBAR_NAV,
  normalizePath,
  isRegisteredPath,
  type SidebarGroup,
  renderRouteIcon,
} from '../../app/routeRegistry';
import { GuidedTour, TourStep } from '../../components/onboarding/GuidedTour';
import { WorkSessionManager } from '../../components/execution/WorkSessionManager';
import { cloneWorkspaceToSandbox } from '../../services/workspaceService';
import { getWorkspaceDisplayName } from '../../lib/workspaceDisplayName';
import { EndOfDayModal } from '../../components/execution/EndOfDayModal';
import { IconContainer } from '../../components/ui/IconContainer';
import { CompanyHealthModal } from '../../components/dashboard/CompanyHealthModal';
import { navigate, replace } from '../../lib/navigation';
import { Sidebar, Header } from '../../components/core';

// Sunset imported above

interface ConfirmState {
  isOpen: boolean;
  title: string;
  message: string;
  confirmText?: string;
  onConfirm: () => void;
}

// --- Utilities Extracted to timeUtils.ts ---

// --- Components ---

interface DomainSubsection {
  label: string;
  path: string;
  capability?: Capability;
}

interface ExecutiveDomain {
  id: string;
  label: string;
  iconName: string;
  subsections: DomainSubsection[];
}

const PILLAR_DOMAINS: ExecutiveDomain[] = [
  {
    id: 'mission-control',
    label: 'Mission Control',
    iconName: 'Radar',
    subsections: [
      { label: 'Dashboard', path: '/overview', capability: 'project.view' },
      { label: 'Activity Feed', path: '/overview/activity', capability: 'reports.view' },
      { label: 'Approvals', path: '/workspace/approvals', capability: 'approval.view' }
    ]
  },
  {
    id: 'execution',
    label: 'Execution',
    iconName: 'TreeStructure',
    subsections: [
      { label: 'Projects', path: '/workspace', capability: 'project.view' },
      { label: 'Task Board', path: '/execution/board', capability: 'task.view' },
      { label: 'Sprints', path: '/execution/sprints', capability: 'sprint.manage' },
      { label: 'Schedule', path: '/execution/schedule', capability: 'timeline.view' }
    ]
  },
  {
    id: 'knowledge',
    label: 'Knowledge',
    iconName: 'ArchiveBox',
    subsections: [
      { label: 'Documents', path: '/workspace/knowledge', capability: 'document.view' },
      { label: 'Files', path: '/workspace/files', capability: 'file.view' },
      { label: 'Meetings', path: '/workspace/meetings', capability: 'meeting.view' },
      { label: 'Decisions', path: '/workspace/decisions', capability: 'decision.view' }
    ]
  },
  {
    id: 'company',
    label: 'Company',
    iconName: 'Building2',
    subsections: [
      { label: 'People Ops', path: '/company', capability: 'people.view' },
      { label: 'Teams', path: '/company/teams', capability: 'people.view' },
      { label: 'Capacity', path: '/company/capacity', capability: 'reports.view' }
    ]
  },
  {
    id: 'finance',
    label: 'Finance',
    iconName: 'Landmark',
    subsections: [
      { label: 'Finance Hub', path: '/finance', capability: 'finance.view' }
    ]
  },
  {
    id: 'admin',
    label: 'Admin',
    iconName: 'Shield',
    subsections: [
      { label: 'Workspace Settings', path: '/admin/settings', capability: 'settings.manage' },
      { label: 'Access Control', path: '/admin/identity', capability: 'user.manage' },
      // Reserved for future Integrations module: { label: 'Integrations', path: '/admin/connections', capability: 'integration.manage' },
      // Reserved for future Automations module: { label: 'Automations', path: '/admin/automations', capability: 'automation.manage' },
      { label: 'Audit', path: '/admin/audit', capability: 'audit.view' }
    ]
  }
];

const isSubsectionAllowed = (sub: DomainSubsection, profile?: any): boolean => {
  if (sub.capability && !hasCapability(profile, sub.capability)) {
    return false;
  }
  return true;
};

export default function DashboardLayout({ children }: { children?: React.ReactNode }) {
  const { user, profile, trueProfile, isSimulating, simulatedRole, setSimulatedRole, logout, setProfile } = useAuth();
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
    
  } = useOperationalData();

  const attendanceRows = raw.attendanceRows;
  

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
    tourCompleted: profile?.metadata?.tourCompleted || (user ? localStorage.getItem(`resolve_tour_completed_${user.id}`) === 'true' : false),
  });



  // Onboarding Tour state
  const [showGuide, setShowGuide] = useState(() => {
    if (sessionStorage.getItem('resolve-pm-tour-active') === 'true') {
      return true;
    }
    if (!user) return false;
    if (profile?.preferences?.tourCompleted === true || profile?.metadata?.tourCompleted === true) {
      return false;
    }
    const localFlag = localStorage.getItem(`resolve_tour_completed_${user.id}`);
    if (localFlag === 'true') {
      return false;
    }
    return true; // Not completed, auto start
  });

  const [currentTourStep, setCurrentTourStep] = useState(() => {
    const saved = sessionStorage.getItem('resolve-pm-tour-step');
    return saved ? parseInt(saved, 10) : 0;
  });

  const dismissGuide = async () => {
    if (user) {
      try {
        await authUpdateProfile({
          metadata: {
            ...profile?.metadata,
            tourCompleted: true
          }
        }, profile?.id);
      } catch (err) {
        console.error('Failed to update profile tour status', err);
      }
      localStorage.setItem(`resolve_tour_completed_${user.id}`, 'true');
    }

    sessionStorage.removeItem('resolve-pm-tour-active');
    sessionStorage.removeItem('resolve-pm-tour-step');
    setShowGuide(false);
    
    // Use existing router navigation
    // navigate('/overview'); // Removed to prevent unintended redirects to the initialization phase when dismissing guide
  };

  useEffect(() => {
    if (showGuide) {
      sessionStorage.setItem('resolve-pm-tour-active', 'true');
    }
  }, [showGuide]);

  

  const SIDEBAR_GROUP_LABELS: Record<SidebarGroup, string> = {
    core: 'Core',
    intelligence: 'Intelligence',
    resources: 'Resources',
    system: 'System',
  };



  const isSidebarItemActive = (path: string): boolean => {
    const current = window.location.pathname;
    // Strip query parameters from the path being checked (e.g., '/admin/identity?tab=roles' → '/admin/identity')
    const pathWithoutQuery = path.split('?')[0];
    
    if (pathWithoutQuery === '/overview') return current === '/overview' || current === '/';
    if (pathWithoutQuery === '/workspace') return current === '/workspace' || current.startsWith('/projects/');
    if (pathWithoutQuery === '/execution') {
      return current.startsWith('/execution') && !current.includes('timeline');
    }
    if (pathWithoutQuery === '/execution/timeline') return current.includes('timeline');
    if (pathWithoutQuery === '/company') return current === '/company' || current.startsWith('/company/logistics');
    if (pathWithoutQuery === '/admin/identity') return current === '/admin/identity' || current === '/admin' || current.startsWith('/admin/identity/');
    if (pathWithoutQuery === '/admin/settings') {
      return current === '/admin/settings' || current.startsWith('/admin/settings/');
    }
    // For admin routes (/admin/*), use prefix matching to handle nested paths
    if (current.startsWith('/admin/') && pathWithoutQuery.startsWith('/admin/')) {
      return current === pathWithoutQuery || current.startsWith(`${pathWithoutQuery}/`);
    }
    return current === pathWithoutQuery || current.startsWith(`${pathWithoutQuery}/`);
  };

  const visibleDomains = useMemo(() => {
    return PILLAR_DOMAINS.map(domain => {
      const allowedSubsections = domain.subsections.filter(sub => isSubsectionAllowed(sub, profile));
      return { ...domain, subsections: allowedSubsections };
    }).filter(domain => domain.subsections.length > 0);
  }, [profile]);

  const [routePath, setRoutePath] = useState(() => normalizePath(window.location.pathname));

  useEffect(() => {
    const syncRoute = () => {
      setRoutePath(normalizePath(window.location.pathname));
    };
    window.addEventListener('popstate', syncRoute);
    return () => window.removeEventListener('popstate', syncRoute);
  }, []);

  const { activeDomain, activeSubsection } = useMemo(() => {
    let currentDomain = visibleDomains[0];
    let currentSub = currentDomain?.subsections[0];

    for (const domain of visibleDomains) {
      for (const sub of domain.subsections) {
        const subPathBase = sub.path.split('?')[0]; if (subPathBase === routePath) {
          return { activeDomain: domain, activeSubsection: sub };
        }
      }
    }

    // Fallback matching partial path
    for (const domain of visibleDomains) {
      const sortedSubs = [...domain.subsections].sort((a, b) => b.path.length - a.path.length);
      for (const sub of sortedSubs) {
        const subPathBase = sub.path.split('?')[0]; if (routePath.startsWith(subPathBase) && subPathBase !== '/overview' && sub.path !== '/workspace') {
          return { activeDomain: domain, activeSubsection: sub };
        }
      }
    }
    // Ensure project view falls into execution engine
    if (routePath.startsWith('/projects/')) {
      const executionDomain = visibleDomains.find(d => d.id === 'execution-engine');
      if (executionDomain) {
        return { activeDomain: executionDomain, activeSubsection: executionDomain.subsections[0] };
      }
    }

    return { activeDomain: currentDomain, activeSubsection: currentSub };
  }, [visibleDomains, routePath]);

  const handleDomainClick = (domainId: string) => {
    const domain = visibleDomains.find(d => d.id === domainId);
    if (domain && domain.subsections.length > 0) {
      const firstSub = domain.subsections[0];
      navigate(firstSub.path);
    }
  };

  // Strict route guards for Phase 5 UX role alignment
  useEffect(() => {
    if (loading || !profile) return;

    const isView = hasCapability(profile, 'project.view') && !hasCapability(profile, 'task.update');
    if (isView) {
      const allowed = ['/workspace/portfolio', '/workspace/decisions', '/login'];
      if (!allowed.includes(routePath)) {
        navigate('/workspace/portfolio');
        window.dispatchEvent(
          new CustomEvent('notify-toast', {
            detail: { message: 'Stakeholders have read-only visibility to Portfolio Analytics.', type: 'warning' },
          }),
        );
      }
    }
  }, [profile, loading, routePath]);

  useEffect(() => {
    if (!disclosure.active || loading) return;
    const isDevOrView = (hasCapability(profile, 'task.update') && !hasCapability(profile, 'project.update')) || (hasCapability(profile, 'project.view') && !hasCapability(profile, 'task.update'));
    if (isDevOrView) return; // Bypass progressive unlock for developers & stakeholders
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
    navigate('/overview');
  }, [disclosure.active, disclosure.level, loading, routePath, profile]);

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
  const [isEndOfDayModalOpen, setIsEndOfDayModalOpen] = useState(false);
  const [isHealthModalOpen, setIsHealthModalOpen] = useState(false);
  const [dashboardTab, setDashboardTab] = useState<'dashboard' | 'active' | 'completed' | 'intelligence'>('dashboard');
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [projectSetupGuide, setProjectSetupGuide] = useState<{ projectId: string; executionMode: string; step: number } | null>(null);
  const [showFeedbackGate, setShowFeedbackGate] = useState(false);
  const [feedbackRating, setFeedbackRating] = useState<number | null>(null);
  const [feedbackTags, setFeedbackTags] = useState<string[]>([]);
  const [feedbackComment, setFeedbackComment] = useState('');
  const [commandPaletteOpen, setCommandPaletteOpen] = useState(false);
  const [commandAnalyticsOpen, setCommandAnalyticsOpen] = useState(false);
  const [isSandboxMode, setIsSandboxMode] = useState(() => localStorage.getItem('resolve-sandbox-mode') === 'true');
  const [isSandboxTransitioning, setIsSandboxTransitioning] = useState(false);
  const [supportModalOpen, setSupportModalOpen] = useState(false);

  // --- OFFLINE STATE ---
  const [isOffline, setIsOffline] = useState(!navigator.onLine);
  const [syncing, setSyncing] = useState(false);

  useEffect(() => {
    const handleOffline = () => setIsOffline(true);
    const handleOnline = () => {
      setIsOffline(false);
      setSyncing(true);
      setTimeout(() => setSyncing(false), 2000); // Simulate sync delay
    };
    window.addEventListener('offline', handleOffline);
    window.addEventListener('online', handleOnline);
    return () => {
      window.removeEventListener('offline', handleOffline);
      window.removeEventListener('online', handleOnline);
    };
  }, []);

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

  // Replaced static breadcrumbs with activeDomain logic

  const tourSteps: TourStep[] = useMemo(() => {
    const role = profile?.role || 'viewer';

    if (hasCapability(profile, 'workspace.update')) {
      // OWNER / ADMIN TOUR
      return [
        {
          title: "Your Operational Command Center",
          description: "Start your day here. Monitor company activity, important actions, delivery signals, and areas requiring attention.",
          targetSelector: "#tour-main-content",
          actionBefore: () => navigate('/overview')
        },
        {
          title: "Manage Delivery",
          description: "Create projects, structure milestones, track ownership, and monitor execution progress.",
          targetSelector: "#tour-main-content",
          actionBefore: () => navigate('/workspace')
        },
        {
          title: "Manage Capacity",
          description: "Understand team allocation, responsibilities, availability, and workload distribution.",
          targetSelector: "#tour-main-content",
          actionBefore: () => navigate('/resources/teams')
        },
        {
          title: "Track Operational Decisions",
          description: "Record approvals, escalations, ownership changes, and important coordination decisions.",
          targetSelector: "#tour-main-content",
          actionBefore: () => navigate('/workspace/decisions')
        },
        {
          title: "Configure Workspace",
          description: "Manage users, permissions, workspace settings, and governance. Your next step: Create your first project.",
          targetSelector: "#tour-main-content",
          actionBefore: () => navigate('/control/settings')
        }
      ];
    } else if (hasCapability(profile, 'project.update')) {
      // PM TOUR
      return [
        {
          title: "Mission Control",
          description: "Daily delivery overview.",
          targetSelector: "#tour-main-content",
          actionBefore: () => navigate('/overview')
        },
        {
          title: "Projects",
          description: "Project planning and milestones.",
          targetSelector: "#tour-main-content",
          actionBefore: () => navigate('/workspace')
        },
        {
          title: "Tasks",
          description: "Execution tracking.",
          targetSelector: "#tour-main-content",
          actionBefore: () => navigate('/execution/board')
        },
        {
          title: "Team",
          description: "Capacity visibility. Your next step: Create your first project.",
          targetSelector: "#tour-main-content",
          actionBefore: () => navigate('/resources/teams')
        }
      ];
    } else if (hasCapability(profile, 'finance.manage')) {
      // FINANCE TOUR
      return [
        {
          title: "Mission Control",
          description: "Daily overview.",
          targetSelector: "#tour-main-content",
          actionBefore: () => navigate('/overview')
        },
        {
          title: "Finance",
          description: "Manage budgets, tracking, and financial health.",
          targetSelector: "#tour-main-content",
          actionBefore: () => navigate('/resources/finance')
        },
        {
          title: "Reports/Documents",
          description: "Review financial reports and documentation.",
          targetSelector: "#tour-sidebar",
          actionBefore: () => navigate('/workspace/reports')
        },
        {
          title: "Approvals",
          description: "Review financial approvals and changes. Your next step: Check pending approvals.",
          targetSelector: "#tour-main-content",
          actionBefore: () => navigate('/workspace/approvals')
        }
      ];
    } else if (hasCapability(profile, 'client.project.view')) {
      // CLIENT TOUR
      return [
        {
          title: "Client Dashboard",
          description: "Your daily overview.",
          targetSelector: "#tour-main-content",
          actionBefore: () => navigate('/overview')
        },
        {
          title: "Project Visibility",
          description: "Check progress on your projects.",
          targetSelector: "#tour-main-content",
          actionBefore: () => navigate('/workspace')
        },
        {
          title: "Approvals",
          description: "Approve deliverables or changes.",
          targetSelector: "#tour-main-content",
          actionBefore: () => navigate('/workspace/approvals')
        },
        {
          title: "Communication",
          description: "Connect with the team. Your next step: View your active projects.",
          targetSelector: "#tour-main-content",
          actionBefore: () => navigate('/workspace/meetings')
        }
      ];
    } else {
      // DEVELOPER / EMPLOYEE TOUR
      return [
        {
          title: "Your Daily Workspace",
          description: "See assigned work, updates, priorities, and items requiring your attention.",
          targetSelector: "#tour-main-content",
          actionBefore: () => navigate('/overview')
        },
        {
          title: "Your Execution Queue",
          description: "Track assigned work, progress updates, blockers, and deadlines.",
          targetSelector: "#tour-main-content",
          actionBefore: () => navigate('/execution/board')
        },
        {
          title: "Stay Connected",
          description: "Access project information and collaborate with your team. Your next step: Check your assigned tasks.",
          targetSelector: "#tour-main-content",
          actionBefore: () => navigate('/workspace/documents')
        }
      ];
    }
  }, [profile?.role]);

  // Expose tour launcher globally
  useEffect(() => {
    (window as any).startOnboardingTour = () => {
      sessionStorage.setItem('resolve-pm-tour-active', 'true');
      sessionStorage.setItem('resolve-pm-tour-step', '0');
      setCurrentTourStep(0);
      setShowGuide(true);
      navigate('/workspace');
    };
  }, [tourSteps]);

  // Listen for project setup guide trigger — redirect to execution initialization
  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      const mode = (detail.executionMode || 'KANBAN').toUpperCase();
      const projectId = detail.projectId;

      if (mode === 'SCRUM' || mode === 'HYBRID') {
        navigate(`/projects/${projectId}/setup/execution`);
      } else if (mode === 'KANBAN') {
        navigate(`/projects/${projectId}/board`);
      } else if (mode === 'SDLC' || mode === 'CUSTOM') {
        navigate(`/projects/${projectId}/setup/execution`);
      } else {
        navigate(`/projects/${projectId}/backlog`);
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
  const { theme, setTheme } = useTheme();



  // Expose profile modal trigger for header and listen for global toast notifications
  useEffect(() => {
    (window as any).openProfileModal = () => setIsProfileOpen(true);
    (window as any).openCreateProjectModal = () => setIsAdding(true);
    (window as any).openTeamRosterModal = () => setIsRosterOpen(true);

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
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);
  const [confirmState, setConfirmState] = useState<ConfirmState>({
    isOpen: false,
    title: '',
    message: '',
    confirmText: 'Confirm',
    onConfirm: () => { }
  });

  const notify = (message: any, type: Notification['type'] = 'info') => {
    const id = Math.random().toString(36).substring(7);
    let msgString = typeof message === 'object' && message !== null
      ? (message.message || JSON.stringify(message))
      : String(message);

    if (type === 'error') {
      msgString = errorMessageService.translate(message);
    }

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
      replace(window.location.pathname);
    }
  }, []);




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
    const success = await authUpdateProfile(updates, profile?.id);
    if (success) {
      setProfile({ ...profile, ...updates } as any);
    }

    if (success) {
      notify("Identity parameters updated.", "success");
    } else {
      notify("Sync failed.", "error");
    }
  };

  const handleDeleteProject = async (id: string, reason: string) => {
    if (!hasCapability(profile, 'workspace.update') && !hasCapability(profile, 'project.update')) {
      notify("You don't have permission to delete projects.", "error");
      return;
    }

    if (await showConfirm(`Are you sure you want to archive this project? Reason: ${reason}`)) {
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
  };


  const handleCreateProject = async (e: React.FormEvent) => {
    e.preventDefault();

    // Ensure user is part of a team
    const isUserInAnyTeam = teams.some(t => {
      const d = t.data as any;
      if (!d) return false;
      return d.pm_id === user.id || (Array.isArray(d.developer_ids) && d.developer_ids.includes(user.id));
    });

    if (!isUserInAnyTeam && !hasCapability(profile, 'workspace.update')) {
      notify("Access Denied: You must form or join a team before creating a project.", "error");
      return;
    }

    if (!newName.trim()) {
      notify("Project designation is required.", "error");
      return;
    }
    if (!hasCapability(profile, 'project.update')) {
      notify("You don't have permission to create projects.", 'error');
      return;
    }
    if (!workspace?.id) {
      notify("No active workspace selected.", "error");
      return;
    }

    if (!await showConfirm('Are you sure you want to create this project?')) return;

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


    const { data, error } = await supabase
      .from('projects')
      .insert(newProject)
      .select()
      .single();

    if (!error && data) {

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


      // Immutable log (fire-and-forget, never blocks visibility)
      activityLogService.appendLog({
        workspace_id: workspace.id,
        actor_id: user.id,
        action_type: 'project_created',
        metadata: { project_id: data.id, name: data.name, execution_mode: data.execution_mode }
      }).catch(() => { });

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
    navigate('/workspace');
    setIsAdding(true);
    notify(`Task "${taskData.title}" elevated — fill in PERT estimates to register as a project.`, 'info');
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
      <div className="min-h-screen flex flex-col items-center justify-center gap-5 font-geist ">
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
      <div className={`flex-1 flex flex-col font-geist selection:bg-accent-primary selection:text-text-primary transition-colors duration-200`}
        style={{ color: 'var(--pm-on-surface)' }}>

        {/* Left Sidebar (Fixed on Desktop, Slide-out on Mobile) */}
        <Sidebar
          isSidebarCollapsed={isSidebarCollapsed}
          setIsSidebarCollapsed={setIsSidebarCollapsed}
          visibleDomains={visibleDomains}
          activeDomain={activeDomain}
          handleDomainClick={handleDomainClick}
          profile={profile}
          workspace={workspace}
          disclosure={disclosure}
          setIsProfileOpen={setIsProfileOpen}
          onLogout={handleLogout}
          onStartTour={() => (window as any).startOnboardingTour?.()}
        />

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
                    className="p-1.5 hover:bg-[var(--pm-surface)]/5 rounded-lg text-text-secondary"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>

                <div className="flex-1 overflow-y-auto px-4 py-6 space-y-2">
                  {visibleDomains.map(domain => {
                    const isActive = activeDomain?.id === domain.id;
                    const isIntelligence = domain.id === 'knowledge-hub' || domain.id === 'strategic-oversight';
                    const activeColor = domain.id === 'automation-engine' ? '#f59e0b' : isIntelligence ? '#14b8a6' : 'var(--pm-primary)';

                    return (
                      <button
                        key={domain.id}
                        onClick={() => {
                          handleDomainClick(domain.id);
                          setMobileSidebarOpen(false);
                        }}
                        className={`w-full flex items-center gap-3 2xl:gap-4 px-3 2xl:px-4 py-2.5 2xl:py-3.5 rounded-lg text-xs 2xl:text-sm font-medium transition-all border-l-2 ${
                          isActive 
                            ? 'bg-[var(--color-primary-subtle)] text-[var(--color-text-primary)] border-[var(--color-primary)] pl-2.5' 
                            : 'bg-transparent text-[var(--color-text-secondary)] border-transparent hover:bg-white/[0.02] hover:text-[var(--color-text-primary)] pl-2.5'
                        }`}
                      >
                        <div className="2xl:scale-110 transition-transform duration-200">
                          {renderRouteIcon(domain.iconName)}
                        </div>
                        <div className="flex flex-col text-left">
                          <span>{domain.label}</span>
                          {domain.id === 'mission-control' && (
                            <span className="text-[10px] text-[var(--text-secondary)] font-normal leading-tight mt-0.5 whitespace-normal break-words pr-2">Your daily overview of work, team, and priorities</span>
                          )}
                        </div>
                      </button>
                    );
                  })}
                  {disclosure.active && disclosure.nextUnlock && (
                    <ProgressiveUnlockHint
                      message={disclosure.nextUnlock.message}
                      nextLevel={disclosure.nextUnlock.level}
                      lockedCount={disclosure.lockedCount}
                      onShowAll={hasCapability(profile, 'settings.manage') ? handleShowAllFeatures : undefined}
                    />
                  )}
                </div>

                <div className="p-4 2xl:p-6 border-t border-border bg-bg shrink-0">
                  <div className="flex items-center gap-3 2xl:gap-4 p-2 2xl:p-3">
                    <div className="w-9 h-9 2xl:w-11 2xl:h-11 rounded-full bg-[var(--pm-surface)]/5 border border-border flex items-center justify-center overflow-hidden shrink-0">
                      {profile?.avatar_url ? <img src={profile.avatar_url} alt="Avatar" className="w-full h-full object-cover" /> :
                        <Users className="w-4 h-4 2xl:w-5 2xl:h-5 text-text-secondary" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs 2xl:text-sm font-semibold text-text-primary truncate">{profile?.full_name || user.email?.split('@')[0]}</p>
                      <p className="text-[10px] 2xl:text-xs text-text-tertiary truncate uppercase">{profile?.role || 'Viewer'}</p>
                    </div>
                    <button onClick={() => { handleLogout(); setMobileSidebarOpen(false); }} className="p-1.5 2xl:p-2 hover:bg-rose-500/10 text-rose-400 rounded-lg">
                      <LogOut className="w-3.5 h-3.5 2xl:w-4 2xl:h-4" />
                      <span className="sr-only">Logout</span>
                    </button>
                  </div>
                </div>
              </motion.div>
            </>
          )}
        </AnimatePresence>

        {/* Main Content Area */}
        <div id="tour-main-content" className={`flex flex-col flex-1 min-h-screen transition-[transform,opacity] duration-200 ${isSidebarCollapsed ? 'lg:pl-[4.5rem]' : 'lg:pl-[15.5rem] 2xl:pl-[17.5rem]'}`} style={{ background: 'transparent' }}>
          
          {/* OFFLINE / SYNC BANNER */}
          <AnimatePresence>
            {isOffline && (
              <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="bg-red-500 text-white text-xs font-medium px-4 py-1.5 flex items-center justify-center gap-2 z-50">
                <WifiOff className="w-3.5 h-3.5" /> Connection lost — Changes waiting to sync
              </motion.div>
            )}
            {!isOffline && syncing && (
              <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="bg-emerald-500 text-white text-xs font-medium px-4 py-1.5 flex items-center justify-center gap-2 z-50">
                <RefreshCw className="w-3.5 h-3.5 animate-spin" /> Synced successfully
              </motion.div>
            )}
          </AnimatePresence>

          {isSandboxMode && (
            <div className="bg-blue-500/20 border-b border-blue-500/30 text-blue-400 text-center py-1.5 text-[10px] font-bold tracking-widest uppercase flex justify-center items-center gap-2">
              <Shield className="w-3.5 h-3.5" />
              Sandbox Training Mode Active — Database Writes Isolated
            </div>
          )}
          {/* Top Bar — utility layer, operational status */}
          <Header
            activeDomain={activeDomain}
            activeSubsection={activeSubsection}
            setMobileSidebarOpen={setMobileSidebarOpen}
            setCommandPaletteOpen={setCommandPaletteOpen}
            isSandboxMode={isSandboxMode}
            isSandboxTransitioning={isSandboxTransitioning}
            theme={theme}
            setTheme={setTheme}
            setIsEndOfDayModalOpen={setIsEndOfDayModalOpen}
            setSupportModalOpen={setSupportModalOpen}
            setIsAdding={setIsAdding}
            profile={profile}
            trueProfile={trueProfile}
            simulatedRole={simulatedRole}
            setSimulatedRole={setSimulatedRole}
            isSimulating={isSimulating}
            onNavigate={navigate}
            onToggleSandbox={async () => {
              if (!workspace || !user) return;
              setIsSandboxTransitioning(true);
              notify('Transitioning environment...', 'info');
              try {
                if (!isSandboxMode) {
                  localStorage.setItem('resolve-sandbox-parent-workspace', workspace.id);
                  await cloneWorkspaceToSandbox(workspace.id, user.id);
                  setIsSandboxMode(true);
                  localStorage.setItem('resolve-sandbox-mode', 'true');
                  notify('Sandbox Mode Activated - Data isolated.', 'success');
                  setTimeout(() => window.location.reload(), 1000);
                } else {
                  const parentId = workspace.parent_workspace_id || localStorage.getItem('resolve-sandbox-parent-workspace');
                  if (parentId && user) {
                    await switchWorkspace(user.id, parentId);
                  }
                  setIsSandboxMode(false);
                  localStorage.setItem('resolve-sandbox-mode', 'false');
                  localStorage.removeItem('resolve-sandbox-parent-workspace');
                  notify('Exited Sandbox - Returning to Production.', 'success');
                  setTimeout(() => window.location.reload(), 1000);
                }
              } catch (err: any) {
                notify('Failed to transition sandbox: ' + err.message, 'error');
              } finally {
                setIsSandboxTransitioning(false);
              }
            }}
          />

          {/* Context Header — Welcome + operational context (Simplified to reduce visual noise) */}
          {window.location.pathname === '/workspace' && (
            <div className="px-6 pt-5 pb-3 border-b flex items-center justify-between" style={{ borderColor: 'var(--pm-outline-variant)' }}>
              <h2 className="text-lg font-semibold tracking-tight font-geist" style={{ color: 'var(--pm-on-surface)' }}>
                {workspace?.settings?.companyName ? `${workspace.settings.companyName} Workspace` : `${profile?.full_name?.split(' ')[0] || user.email?.split('@')[0]}'s Workspace`}
              </h2>
              <div className="flex items-center gap-3">
                <span className="text-xs font-medium text-text-tertiary">
                  {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
                </span>
                {dbNotifications.filter(n => !n.read_at).length === 0 && (
                  <button 
                    onClick={() => setIsHealthModalOpen(true)}
                    className="text-xs font-medium text-emerald-400/80 bg-emerald-500/10 px-2 py-0.5 rounded hover:bg-emerald-500/20 transition-colors cursor-pointer flex items-center gap-1"
                  >
                    All systems nominal
                  </button>
                )}
              </div>
            </div>
          )}

          {/* StatsGrid — only show on project/completed tabs */}
          {dashboardTab !== 'dashboard' && dashboardTab !== 'intelligence' && window.location.pathname === '/workspace' && (
            <StatsGrid stats={stats} />
          )}

          {/* Dynamic Page Routing Slot */}
          <main id="main-content" className="flex-1 px-6 py-5 overflow-y-auto pb-6 relative user-content">
            <ErrorBoundary>
              {hasCapability(profile?.role, 'settings.manage') && window.location.pathname === '/workspace' && (
                <WelcomeCenter />
              )}
              <AnimatePresence mode="wait">
                <motion.div
                  key={window.location.pathname}
                  initial={{ opacity: 0, y: 15, scale: 0.98, rotateX: 5 }}
                  animate={{ opacity: 1, y: 0, scale: 1, rotateX: 0 }}
                  exit={{ opacity: 0, y: -15, scale: 0.98, rotateX: -5 }}
                  transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
                  style={{ transformStyle: 'preserve-3d', perspective: '1000px' }}
                >
                  {children}
                </motion.div>
              </AnimatePresence>
            </ErrorBoundary>
          </main>

          {/* Status Footer */}
          <footer className="bg-[#0b0c12] border-t border-border-subtle px-5 py-3 flex justify-between items-center pointer-events-none z-20 shrink-0 user-interface">
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

        {workspace && profile && (
          <WorkSessionManager workspace={workspace} currentUser={profile} notify={notify} />
        )}

        <CommandPalette
          isOpen={commandPaletteOpen}
          onClose={() => setCommandPaletteOpen(false)}
          onNavigate={navigate}
        />

        <CommandAnalytics
          isOpen={commandAnalyticsOpen}
          onClose={() => setCommandAnalyticsOpen(false)}
          role={profile?.role || 'viewer'}
          workspaceId={workspace?.id}
          profileId={profile?.id}
          currentRoute={window.location.pathname}
        />

        <SupportEscalationModal
          isOpen={supportModalOpen}
          onClose={() => setSupportModalOpen(false)}
          notify={notify}
        />

        {/* --- Overlay Components --- */}

        <AnimatePresence>
          <ProjectCreationModal 
            isOpen={isAdding} 
            onClose={() => setIsAdding(false)} 
            onSuccess={() => {
              notify('Project initiated successfully.', 'success');
              setIsAdding(false);
            }} 
          />
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
              onClose={() => setIsProfileOpen(false)}
              onUpdate={handleUpdateProfile}
            />
          )}

          <EndOfDayModal
            isOpen={isEndOfDayModalOpen}
            onClose={() => setIsEndOfDayModalOpen(false)}
            currentUser={profile}
            workspaceId={workspace?.id || ''}
            notify={notify}
          />
        </AnimatePresence>

        <AnimatePresence>
          <CompanyHealthModal 
            isOpen={isHealthModalOpen} 
            onClose={() => setIsHealthModalOpen(false)} 
          />
        </AnimatePresence>


        {/* Onboarding Tour Overlay - Spotlight Modal */}
        <GuidedTour
          steps={tourSteps}
          currentStepIndex={currentTourStep}
          isOpen={showGuide}
          onClose={() => {
            dismissGuide();
            setShowFeedbackGate(true);
          }}
          onNext={() => {
            const nextStep = currentTourStep + 1;
            sessionStorage.setItem('resolve-pm-tour-step', nextStep.toString());
            setCurrentTourStep(nextStep);
            tourSteps[nextStep]?.actionBefore?.();
          }}
          onPrev={() => {
            const prevStep = currentTourStep - 1;
            sessionStorage.setItem('resolve-pm-tour-step', prevStep.toString());
            setCurrentTourStep(prevStep);
            tourSteps[prevStep]?.actionBefore?.();
          }}
        />

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
                          <button onClick={() => setProjectSetupGuide({ ...projectSetupGuide, step: 0 })} className="px-4 py-2 bg-[var(--pm-surface)]/10 text-text-primary text-[10px] font-mono uppercase tracking-wider">Add Work Items</button>
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
                            <span className={`w-4 h-4 rounded-full flex items-center justify-center text-[8px] font-bold ${i <= projectSetupGuide.step ? 'bg-cyan-500/20 border border-cyan-500' : 'bg-[var(--pm-surface)]/5 border border-border'}`}>{i < projectSetupGuide.step ? <Check className="w-2.5 h-2.5" /> : i + 1}</span>
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
                        <button onClick={() => setProjectSetupGuide({ ...projectSetupGuide, step: 1 })} className="px-4 py-2 bg-[var(--pm-surface)]/10 text-text-primary text-[10px] font-mono uppercase tracking-wider hover:bg-[var(--pm-surface)]/20 transition-colors">Skip — Next</button>
                      </div>
                    )}

                    {projectSetupGuide.step === 1 && (
                      <div className="text-center py-6 space-y-4">
                        <ListOrdered className="w-10 h-10 text-signal-warning mx-auto" />
                        <h4 className="text-sm font-semibold">Create Stories</h4>
                        <p className="text-[11px] text-text-tertiary">Break epics into user stories with acceptance criteria.</p>
                        <button onClick={() => setProjectSetupGuide({ ...projectSetupGuide, step: 2 })} className="px-4 py-2 bg-[var(--pm-surface)]/10 text-text-primary text-[10px] font-mono uppercase tracking-wider hover:bg-[var(--pm-surface)]/20 transition-colors">Skip — Next</button>
                      </div>
                    )}

                    {projectSetupGuide.step === 2 && (
                      <div className="text-center py-6 space-y-4">
                        <Play className="w-10 h-10 text-signal-info mx-auto" />
                        <h4 className="text-sm font-semibold">Create Sprint</h4>
                        <p className="text-[11px] text-text-tertiary">Define sprint duration and assign stories to the backlog.</p>
                        <button onClick={() => setProjectSetupGuide({ ...projectSetupGuide, step: 3 })} className="px-4 py-2 bg-[var(--pm-surface)]/10 text-text-primary text-[10px] font-mono uppercase tracking-wider hover:bg-[var(--pm-surface)]/20 transition-colors">Skip — Next</button>
                      </div>
                    )}

                    {projectSetupGuide.step === 3 && (
                      <div className="text-center py-6 space-y-4">
                        <Play className="w-12 h-12 text-signal-safe mx-auto" />
                        <h4 className="text-base font-semibold">Ready to Launch</h4>
                        <p className="text-xs text-text-tertiary">Your sprint is configured. Launch to begin tracking velocity.</p>
                        <button onClick={() => { setProjectSetupGuide(null); replace('/execution'); }} className="px-6 py-2 bg-green-600 text-text-primary text-[10px] font-mono uppercase tracking-wider hover:bg-green-500 transition-colors">Launch Sprint</button>
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








