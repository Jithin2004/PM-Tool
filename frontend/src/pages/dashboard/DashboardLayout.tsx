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
import { showConfirm } from '../../components/common/Dialogs';
import { motion, AnimatePresence } from 'motion/react';
import { supabase, isSupabaseConfigured } from '../../lib/supabase';
import { ErrorBoundary } from '../../components/ui/ErrorBoundary';
import { useAuth } from '../../context/AuthContext';
import { useWorkspace } from '../../context/WorkspaceContext';
import { OperationalDataProvider, useOperationalData } from '../../context/OperationalDataContext';
import { RealtimeProvider } from '../../context/RealtimeProvider';
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
import { UniversalWorkInbox } from '../../components/inbox/UniversalWorkInbox';
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

const EXECUTIVE_DOMAINS: ExecutiveDomain[] = [
  {
    id: 'mission-control',
    label: 'Mission Control',
    iconName: 'Radar',
    subsections: [
      { label: 'Company Health', path: '/overview', capability: 'view_projects' },
      { label: 'Daily Command', path: '/overview/executive', capability: 'view_analytics' },
      { label: 'Activity Feed', path: '/overview/activity', capability: 'view_reports' },
      { label: 'Workspace Reports', path: '/workspace/reports', capability: 'view_reports' }
    ]
  },
  {
    id: 'projects',
    label: 'Projects',
    iconName: 'TreeStructure',
    subsections: [
      { label: 'Project List', path: '/workspace', capability: 'view_projects' },
      { label: 'Requirements', path: '/workspace/requirements', capability: 'view_projects' },
      { label: 'Approvals', path: '/workspace/approvals', capability: 'view_projects' }
    ]
  },
  {
    id: 'tasks',
    label: 'Tasks',
    iconName: 'Kanban',
    subsections: [
      { label: 'Task Board', path: '/execution/board', capability: 'view_tasks' },
      { label: 'Timeline', path: '/execution/gantt', capability: 'view_scheduling' },
      { label: 'Calendar', path: '/execution/timeline', capability: 'view_tasks' },
      { label: 'Sprints', path: '/execution/sprints', capability: 'view_tasks' }
    ]
  },
  {
    id: 'team',
    label: 'Team',
    iconName: 'Users',
    subsections: [
      { label: 'Employees', path: '/resources/teams', capability: 'view_teams' },
      { label: 'Departments', path: '/resources/teams/departments', capability: 'view_teams' },
      { label: 'Team Workload', path: '/resources/capacity', capability: 'view_reports' },
      { label: 'Skills Matrix', path: '/resources/teams/skills', capability: 'view_teams' },
      { label: 'Meetings', path: '/workspace/meetings', capability: 'view_teams' }
    ]
  },
  {
    id: 'clients',
    label: 'Clients',
    iconName: 'Building2',
    subsections: [
      { label: 'Client Profiles', path: '/workspace/portfolio', capability: 'view_stakeholders' }
    ]
  },
  {
    id: 'finance',
    label: 'Finance',
    iconName: 'Landmark',
    subsections: [
      { label: 'Payroll & Salaries', path: '/resources/finance?tab=payroll', capability: 'manage_finance' },
      { label: 'Expenses & Budgets', path: '/resources/finance?tab=budgets', capability: 'manage_finance' },
      { label: 'Invoices & Billing', path: '/resources/finance?tab=invoices', capability: 'manage_finance' },
      { label: 'Financial Reports', path: '/resources/finance', capability: 'manage_finance' }
    ]
  },
  {
    id: 'people',
    label: 'People Operations',
    iconName: 'Users',
    subsections: [
      { label: 'Attendance & Leave', path: '/resources', capability: 'manage_logistics' }
    ]
  },
  {
    id: 'documents',
    label: 'Documents',
    iconName: 'FileText',
    subsections: [
      { label: 'File Center', path: '/workspace/files', capability: 'view_projects' },
      { label: 'Knowledge Base', path: '/workspace/knowledge', capability: 'view_projects' },
      { label: 'Templates', path: '/control/document-templates', capability: 'manage_settings' }
    ]
  },
  {
    id: 'automation',
    label: 'Automation',
    iconName: 'Cpu',
    subsections: [
      { label: 'Workload Recommendations', path: '/workspace/decisions', capability: 'view_decision_center' },
      { label: 'Automations', path: '/control/automations', capability: 'manage_automations' },
      { label: 'Workspace Automation', path: '/workspace/automation', capability: 'manage_automations' }
    ]
  },
  {
    id: 'admin',
    label: 'Admin',
    iconName: 'Settings',
    subsections: [
      { label: 'Workspace Settings', path: '/control/settings', capability: 'manage_settings' },
      { label: 'Roles & Permissions', path: '/control/identity?tab=roles', capability: 'manage_settings' },
      { label: 'Activity History', path: '/control/audit', capability: 'view_audit_log' },
      { label: 'System Status', path: '/control/system-health', capability: 'platform_governance' }
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
  return (
    <OperationalDataProvider>
      <RealtimeProvider>
        <DashboardLayoutShell>{children}</DashboardLayoutShell>
      </RealtimeProvider>
    </OperationalDataProvider>
  );
}

function DashboardLayoutShell({ children }: { children?: React.ReactNode }) {
  const { user, profile, trueProfile, isSimulating, simulatedRole, setSimulatedRole, logout, updateProfile } = useAuth();
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
        await updateProfile({
          metadata: {
            ...profile?.metadata,
            tourCompleted: true
          }
        });
      } catch (err) {
        console.error('Failed to update profile tour status', err);
      }
      localStorage.setItem(`resolve_tour_completed_${user.id}`, 'true');
    }

    sessionStorage.removeItem('resolve-pm-tour-active');
    sessionStorage.removeItem('resolve-pm-tour-step');
    setShowGuide(false);
    
    // Use existing router navigation
    navigateTo('/overview');
  };

  useEffect(() => {
    if (showGuide) {
      sessionStorage.setItem('resolve-pm-tour-active', 'true');
    }
  }, [showGuide]);

  const navigateTo = (path: string) => {
    const queryIdx = path.indexOf('?');
    const queryPart = queryIdx >= 0 ? path.substring(queryIdx) : '';
    const normalized = normalizePath(path);
    const target = normalized + queryPart;
    if (import.meta.env.DEV && !isRegisteredPath(normalized)) {
      console.error(`[navigateTo] Unregistered path: ${path} (canonical: ${normalized})`);
    }
    window.history.pushState(null, '', target);
    window.dispatchEvent(new CustomEvent('popstate'));
  };

  const SIDEBAR_GROUP_LABELS: Record<SidebarGroup, string> = {
    core: 'Core',
    intelligence: 'Intelligence',
    resources: 'Resources',
    system: 'System',
  };



  const isSidebarItemActive = (path: string): boolean => {
    const current = window.location.pathname;
    // Strip query parameters from the path being checked (e.g., '/control/identity?tab=roles' → '/control/identity')
    const pathWithoutQuery = path.split('?')[0];
    
    if (pathWithoutQuery === '/overview') return current === '/overview' || current === '/';
    if (pathWithoutQuery === '/workspace') return current === '/workspace' || current.startsWith('/projects/');
    if (pathWithoutQuery === '/execution') {
      return current.startsWith('/execution') && !current.includes('timeline');
    }
    if (pathWithoutQuery === '/execution/timeline') return current.includes('timeline');
    if (pathWithoutQuery === '/resources') return current === '/resources' || current.startsWith('/resources/logistics');
    if (pathWithoutQuery === '/control/identity') return current === '/control/identity' || current === '/control' || current.startsWith('/control/identity/');
    if (pathWithoutQuery === '/control/settings') {
      return current === '/control/settings' || current.startsWith('/control/settings/');
    }
    // For admin routes (/control/*), use prefix matching to handle nested paths
    if (current.startsWith('/control/') && pathWithoutQuery.startsWith('/control/')) {
      return current === pathWithoutQuery || current.startsWith(`${pathWithoutQuery}/`);
    }
    return current === pathWithoutQuery || current.startsWith(`${pathWithoutQuery}/`);
  };

  const visibleDomains = useMemo(() => {
    return EXECUTIVE_DOMAINS.map(domain => {
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
      navigateTo(firstSub.path);
    }
  };

  // Strict route guards for Phase 5 UX role alignment
  useEffect(() => {
    if (loading || !profile) return;

    const isDev = hasCapability(profile, 'manage_tasks') && !hasCapability(profile, 'manage_projects');
    const isView = hasCapability(profile, 'view_stakeholders') && !hasCapability(profile, 'manage_tasks');
    if (isDev) {
      const allowed = ['/overview', '/execution', '/execution/board', '/login', '/execution/timeline'];
      if (!allowed.includes(routePath)) {
        navigateTo('/overview');
        window.dispatchEvent(
          new CustomEvent('notify-toast', {
            detail: { message: 'Employee role is restricted to the Execution Workspace, Board, and Scheduling.', type: 'warning' },
          }),
        );
      }
    } else if (isView) {
      const allowed = ['/workspace/portfolio', '/workspace/decisions', '/login'];
      if (!allowed.includes(routePath)) {
        navigateTo('/workspace/portfolio');
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
    const isDevOrView = (hasCapability(profile, 'manage_tasks') && !hasCapability(profile, 'manage_projects')) || (hasCapability(profile, 'view_stakeholders') && !hasCapability(profile, 'manage_tasks'));
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
    navigateTo('/overview');
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

    if (hasAuthority(role, 'admin') || hasAuthority(role, 'owner')) {
      // OWNER / ADMIN TOUR
      return [
        {
          title: "Your Operational Command Center",
          description: "Start your day here. Monitor company activity, important actions, delivery signals, and areas requiring attention.",
          targetSelector: "#tour-main-content",
          actionBefore: () => navigateTo('/overview')
        },
        {
          title: "Manage Delivery",
          description: "Create projects, structure milestones, track ownership, and monitor execution progress.",
          targetSelector: "#tour-main-content",
          actionBefore: () => navigateTo('/workspace')
        },
        {
          title: "Manage Capacity",
          description: "Understand team allocation, responsibilities, availability, and workload distribution.",
          targetSelector: "#tour-main-content",
          actionBefore: () => navigateTo('/resources/teams')
        },
        {
          title: "Track Operational Decisions",
          description: "Record approvals, escalations, ownership changes, and important coordination decisions.",
          targetSelector: "#tour-main-content",
          actionBefore: () => navigateTo('/workspace/decisions')
        },
        {
          title: "Configure Workspace",
          description: "Manage users, permissions, workspace settings, and governance. Your next step: Create your first project.",
          targetSelector: "#tour-main-content",
          actionBefore: () => navigateTo('/control/settings')
        }
      ];
    } else if (hasFunction(role, 'Projects') || hasCapability(role, 'manage_projects')) {
      // PM TOUR
      return [
        {
          title: "Mission Control",
          description: "Daily delivery overview.",
          targetSelector: "#tour-main-content",
          actionBefore: () => navigateTo('/overview')
        },
        {
          title: "Projects",
          description: "Project planning and milestones.",
          targetSelector: "#tour-main-content",
          actionBefore: () => navigateTo('/workspace')
        },
        {
          title: "Tasks",
          description: "Execution tracking.",
          targetSelector: "#tour-main-content",
          actionBefore: () => navigateTo('/execution/board')
        },
        {
          title: "Team",
          description: "Capacity visibility. Your next step: Create your first project.",
          targetSelector: "#tour-main-content",
          actionBefore: () => navigateTo('/resources/teams')
        }
      ];
    } else if (hasFunction(role, 'Finance')) {
      // FINANCE TOUR
      return [
        {
          title: "Mission Control",
          description: "Daily overview.",
          targetSelector: "#tour-main-content",
          actionBefore: () => navigateTo('/overview')
        },
        {
          title: "Finance",
          description: "Manage budgets, tracking, and financial health.",
          targetSelector: "#tour-main-content",
          actionBefore: () => navigateTo('/resources/finance')
        },
        {
          title: "Reports/Documents",
          description: "Review financial reports and documentation.",
          targetSelector: "#tour-sidebar",
          actionBefore: () => navigateTo('/workspace/reports')
        },
        {
          title: "Approvals",
          description: "Review financial approvals and changes. Your next step: Check pending approvals.",
          targetSelector: "#tour-main-content",
          actionBefore: () => navigateTo('/workspace/approvals')
        }
      ];
    } else if (hasAuthority(role, 'external')) {
      // CLIENT TOUR
      return [
        {
          title: "Client Dashboard",
          description: "Your daily overview.",
          targetSelector: "#tour-main-content",
          actionBefore: () => navigateTo('/overview')
        },
        {
          title: "Project Visibility",
          description: "Check progress on your projects.",
          targetSelector: "#tour-main-content",
          actionBefore: () => navigateTo('/workspace')
        },
        {
          title: "Approvals",
          description: "Approve deliverables or changes.",
          targetSelector: "#tour-main-content",
          actionBefore: () => navigateTo('/workspace/approvals')
        },
        {
          title: "Communication",
          description: "Connect with the team. Your next step: View your active projects.",
          targetSelector: "#tour-main-content",
          actionBefore: () => navigateTo('/workspace/meetings')
        }
      ];
    } else {
      // DEVELOPER / EMPLOYEE TOUR
      return [
        {
          title: "Your Daily Workspace",
          description: "See assigned work, updates, priorities, and items requiring your attention.",
          targetSelector: "#tour-main-content",
          actionBefore: () => navigateTo('/overview')
        },
        {
          title: "Your Execution Queue",
          description: "Track assigned work, progress updates, blockers, and deadlines.",
          targetSelector: "#tour-main-content",
          actionBefore: () => navigateTo('/execution/board')
        },
        {
          title: "Stay Connected",
          description: "Access project information and collaborate with your team. Your next step: Check your assigned tasks.",
          targetSelector: "#tour-main-content",
          actionBefore: () => navigateTo('/workspace/documents')
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
      window.history.replaceState(null, '', window.location.pathname);
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
    const success = await updateProfile(updates);

    if (success) {
      notify("Identity parameters updated.", "success");
    } else {
      notify("Sync failed.", "error");
    }
  };

  const handleDeleteProject = async (id: string, reason: string) => {
    if (!hasCapability(profile, 'manage_workspace') && !hasCapability(profile, 'manage_projects')) {
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

    if (!isUserInAnyTeam && profile?.role !== 'super_admin') {
      notify("Access Denied: You must form or join a team before creating a project.", "error");
      return;
    }

    if (!newName.trim()) {
      notify("Project designation is required.", "error");
      return;
    }
    if (!hasCapability(profile, 'manage_projects')) {
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
    navigateTo('/workspace');
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
        <aside id="tour-sidebar" className={`hidden lg:flex lg:flex-col lg:fixed lg:inset-y-0 lg:left-0 ${isSidebarCollapsed ? 'lg:w-[4.5rem] sidebar-collapsed-premium' : 'lg:w-[15.5rem] 2xl:w-[17.5rem]'} border-r z-30 transition-[transform,opacity] duration-200 user-interface`}
          style={{ 
            background: isSidebarCollapsed ? 'rgba(8,12,25,0.85)' : 'rgba(5,7,18,0.7)', 
            borderColor: 'rgba(255,255,255,0.08)',
            backdropFilter: 'blur(16px)'
          }}>
          {/* Sidebar Brand */}
          <div className={`flex items-center ${isSidebarCollapsed ? 'justify-center' : 'justify-between'} h-16 px-4 border-b shrink-0`}
            style={{ borderColor: 'rgba(70,69,84,0.3)' }}>
            <div className="flex items-center gap-3 overflow-hidden">
              <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0 overflow-hidden">
                <img src="/logo.png" alt="Resolve PM" className="w-full h-full object-contain" />
              </div>
              {!isSidebarCollapsed && (
                <div className="flex-1 min-w-0 premium-fade-in">
                  <h1 className="font-semibold tracking-tight text-[13px] font-geist truncate" style={{ color: 'var(--pm-primary)' }}>
                    Resolve PM {workspace?.settings?.companyName ? `| ${getWorkspaceDisplayName(workspace.settings.companyName, false)}` : ''}
                  </h1>
                  <p className="text-[9px] font-mono-pm uppercase tracking-[0.15em] truncate" style={{ color: 'var(--pm-on-surface-variant)', opacity: 0.5 }}>Enterprise Orchestration</p>
                </div>
              )}
            </div>
            {!isSidebarCollapsed && (
              <button onClick={() => setIsSidebarCollapsed(true)} className="p-1 rounded hover:bg-[var(--pm-surface)]/5 text-text-tertiary hover:text-text-primary transition-colors">
                <ChevronLeft className="w-4 h-4" />
              </button>
            )}
          </div>
          {isSidebarCollapsed && (
            <button onClick={() => setIsSidebarCollapsed(false)} className="mx-auto mt-2 p-1 rounded hover:bg-[var(--pm-surface)]/5 text-text-tertiary hover:text-text-primary transition-colors">
              <ChevronRight className="w-4 h-4" />
            </button>
          )}

          {/* Nav — Executive Domains */}
          <div className="flex-1 overflow-y-auto px-3 py-4 space-y-1 pm-scrollbar">
            {visibleDomains.map(domain => {
              const isActive = activeDomain?.id === domain.id;
              const isIntelligence = domain.id === 'knowledge-hub' || domain.id === 'strategic-oversight';
              const activeColor = domain.id === 'automation-engine' ? '#f59e0b' : isIntelligence ? '#14b8a6' : 'var(--pm-primary)';

              return (
                <button
                  key={domain.id}
                  title={isSidebarCollapsed ? domain.label : undefined}
                  onClick={() => handleDomainClick(domain.id)}
                  className={`flex items-center ${isSidebarCollapsed ? 'justify-center px-0 h-10 w-10 mx-auto' : 'w-full gap-3 px-3 py-2.5'} rounded-lg text-[12px] font-medium transition-all duration-200`}
                  style={isActive ? (
                    isSidebarCollapsed ? {
                      background: 'rgba(124, 58, 237, 0.18)',
                      color: '#a78bfa',
                      boxShadow: '0 0 12px rgba(124, 58, 237, 0.35)',
                    } : {
                      background: 'var(--pm-surface-high)',
                      color: activeColor,
                      borderLeft: `3px solid ${activeColor}`,
                      paddingLeft: '9px',
                    }
                  ) : {
                    color: 'rgba(156, 163, 175, 0.7)',
                  }}
                  onMouseEnter={e => {
                    if (!isActive) {
                      (e.currentTarget as any).style.background = 'rgba(255, 255, 255, 0.03)';
                      (e.currentTarget as any).style.color = 'var(--pm-on-surface)';
                    }
                  }}
                  onMouseLeave={e => {
                    if (!isActive) {
                      (e.currentTarget as any).style.background = '';
                      (e.currentTarget as any).style.color = 'rgba(156, 163, 175, 0.7)';
                    }
                  }}
                >
                  <div className={`flex items-center justify-center ${isSidebarCollapsed ? 'w-8 h-8 rounded-lg' : ''}`}>
                    {renderRouteIcon(domain.iconName)}
                  </div>
                  {!isSidebarCollapsed && (
                    <div className="flex flex-col text-left">
                      <span className="whitespace-nowrap premium-fade-in">{domain.label}</span>
                      {domain.id === 'mission-control' && (
                        <span className="text-[9px] text-[var(--text-secondary)] font-normal leading-tight mt-0.5 whitespace-normal break-words pr-2 opacity-70">Your daily overview of work, team, and priorities</span>
                      )}
                    </div>
                  )}
                </button>
              );
            })}
          </div>

          {disclosure.active && disclosure.nextUnlock && (
            <ProgressiveUnlockHint
              message={disclosure.nextUnlock.message}
              nextLevel={disclosure.nextUnlock.level}
              lockedCount={disclosure.lockedCount}
              onShowAll={hasCapability(profile, 'manage_settings') ? handleShowAllFeatures : undefined}
            />
          )}

          {/* Bottom utility strip */}
          <div className="shrink-0 border-t" style={{ borderColor: 'rgba(255,255,255,0.08)' }}>
            <button
              onClick={() => (window as any).startOnboardingTour?.()}
              className={`flex items-center ${isSidebarCollapsed ? 'justify-center px-0 w-10 h-10 mx-auto' : 'w-full gap-2.5 px-5 py-2.5'} transition-colors text-[11px] font-geist`}
              style={{ color: 'var(--pm-on-surface-variant)', opacity: 0.5 }}
              onMouseEnter={e => { (e.currentTarget as any).style.opacity = '1'; }}
              onMouseLeave={e => { (e.currentTarget as any).style.opacity = '0.5'; }}
              title={isSidebarCollapsed ? 'Help & Documentation' : undefined}
            >
              <HelpCircle className="w-3.5 h-3.5 shrink-0" />
              {!isSidebarCollapsed && <span className="premium-fade-in whitespace-nowrap">Help & Documentation</span>}
            </button>

            {/* User identity strip */}
            <div className={`flex items-center ${isSidebarCollapsed ? 'justify-center flex-col gap-2.5 px-2' : 'gap-3 px-4'} py-3 border-t`} style={{ borderColor: 'rgba(255,255,255,0.08)' }}>
              <div
                onClick={() => setIsProfileOpen(true)}
                className="w-8 h-8 rounded-full flex items-center justify-center overflow-hidden shrink-0 cursor-pointer transition-all hover:scale-105"
                style={{ background: 'rgba(192,193,255,0.08)', border: '1px solid rgba(192,193,255,0.2)' }}
                title="View Profile"
              >
                {profile?.avatar_url ? (
                  <img src={profile.avatar_url} alt="Avatar" className="w-full h-full object-cover" />
                ) : profile?.full_name ? (
                  <span className="text-[10px] font-bold text-white">{profile.full_name.substring(0, 2).toUpperCase()}</span>
                ) : (
                  <Users className="w-3.5 h-3.5 text-white" />
                )}
              </div>
              {!isSidebarCollapsed && (
                <div className="flex-1 min-w-0 premium-fade-in">
                  <p className="text-[12px] font-medium truncate font-geist" style={{ color: 'var(--pm-on-surface)' }}>
                    {profile?.full_name || user.email?.split('@')[0]}
                  </p>
                  <p className="text-[9px] truncate capitalize font-mono-pm" style={{ color: 'var(--pm-primary)', opacity: 0.7 }}>
                    {(profile && userCustomRoles[profile.id]) || profile?.role?.replace('_', ' ') || 'Viewer'}
                  </p>
                </div>
              )}
              <div className={`flex ${isSidebarCollapsed ? 'flex-col gap-1' : 'items-center'}`}>
                <button
                  onClick={handleLogout}
                  className="p-1.5 rounded-md transition-colors cursor-pointer"
                  style={{ color: 'var(--pm-on-surface-variant)' }}
                  onMouseEnter={e => { (e.currentTarget as any).style.color = 'var(--pm-color-error, #f87171)'; (e.currentTarget as any).style.background = 'rgba(255,180,171,0.08)'; }}
                  onMouseLeave={e => { (e.currentTarget as any).style.color = 'var(--pm-on-surface-variant)'; (e.currentTarget as any).style.background = ''; }}
                  title="Sign Out"
                >
                  <LogOut className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={() => navigateTo('/control/settings')}
                  className={`p-1.5 rounded-md transition-colors cursor-pointer ${isSidebarCollapsed ? '' : 'ml-1'}`}
                  style={{ color: 'var(--pm-on-surface-variant)' }}
                  onMouseEnter={e => { (e.currentTarget as any).style.color = 'var(--pm-on-surface)'; (e.currentTarget as any).style.background = 'var(--pm-surface-high)'; }}
                  onMouseLeave={e => { (e.currentTarget as any).style.color = 'var(--pm-on-surface-variant)'; (e.currentTarget as any).style.background = ''; }}
                  title="Settings"
                >
                  <Settings className="w-3.5 h-3.5" />
                </button>
              </div>
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
                        className={`w-full flex items-center gap-3 2xl:gap-4 px-3 2xl:px-4 py-2.5 2xl:py-3.5 rounded-lg text-xs 2xl:text-sm font-medium transition-all ${isActive ? 'shadow-sm' : 'hover:bg-surface-high hover:text-text-primary'
                          }`}
                        style={isActive ? {
                          background: 'var(--pm-surface-high)',
                          color: activeColor,
                          borderLeft: `3px solid ${activeColor}`,
                          paddingLeft: '9px',
                        } : {
                          color: 'var(--pm-on-surface-variant)',
                        }}
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
                      onShowAll={hasCapability(profile, 'manage_settings') ? handleShowAllFeatures : undefined}
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
          <header id="tour-topbar" className="h-12 flex items-center justify-between px-5 border-b sticky top-0 z-40 backdrop-blur-2xl transition-colors duration-200 shadow-sm user-interface"
            style={{ background: 'color-mix(in srgb, var(--pm-surface) 95%, transparent)', borderColor: 'var(--pm-border-subtle)' }}>
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

            {/* Top bar center: Dynamic Subsections Pill Tabs */}
            <div className="flex items-center gap-1 font-geist mx-auto flex-1 justify-start sm:justify-center px-4 overflow-x-auto scrollbar-hide" style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}>
              {activeDomain?.subsections.map(sub => {
                const isSubActive = activeSubsection === sub;
                return (
                  <button
                    key={sub.path}
                    onClick={() => navigateTo(sub.path)}
                    className={`px-3 py-1.5 rounded-full text-[11px] font-medium transition-all whitespace-nowrap`}
                    style={isSubActive ? {
                      background: 'var(--pm-primary)',
                      color: 'var(--pm-on-primary)',
                      boxShadow: '0 1px 3px rgba(0,0,0,0.1)'
                    } : {
                      color: 'var(--pm-on-surface-variant)',
                      background: 'transparent'
                    }}
                    onMouseEnter={e => { if (!isSubActive) { (e.currentTarget as any).style.background = 'var(--pm-surface-high)'; } }}
                    onMouseLeave={e => { if (!isSubActive) { (e.currentTarget as any).style.background = 'transparent'; } }}
                  >
                    {sub.label}
                  </button>
                );
              })}
            </div>

            {/* Top bar right: compact utilities */}
            <div className="flex items-center gap-2 ml-auto">

              {/* Search */}
              <div
                onClick={() => setCommandPaletteOpen(true)}
                className="hidden md:flex items-center gap-2 bg-surface-highest hover:bg-surface-3 border border-border h-8 px-3 rounded-md text-text-secondary cursor-pointer transition-all shadow-sm focus-within:border-accent-primary focus-within:ring-1 focus-within:ring-accent-primary"
              >
                <Search className="w-3.5 h-3.5 text-text-tertiary" />
                <span className="text-[11px] select-none font-mono flex-1 text-left">Search...</span>
                <span className="ml-2 bg-surface border border-border-subtle px-1.5 py-0.5 rounded text-[9px] font-mono tracking-tighter text-text-quaternary shadow-inner">Cmd/Ctrl + K</span>
              </div>

              {/* View As Role Tool */}
              {hasAuthority(trueProfile, 'admin') && (
                <div className="relative group flex items-center">
                  <select
                    value={simulatedRole || ''}
                    onChange={(e) => setSimulatedRole(e.target.value ? (e.target.value as UserRole) : null)}
                    className={`h-8 pl-3 pr-8 rounded-md text-[11px] font-medium border appearance-none cursor-pointer transition-all ${
                      isSimulating 
                        ? 'bg-amber-500/20 border-amber-500/50 text-amber-500 shadow-[0_0_10px_rgba(245,158,11,0.2)]' 
                        : 'bg-surface-highest border-border text-text-secondary hover:bg-surface-3'
                    }`}
                    title="View As Role Tool"
                  >
                    <option value="">View As: Super Admin</option>
                    <option value="pm">Simulate: PM</option>
                    <option value="developer">Simulate: Developer</option>
                    <option value="external_client">Simulate: Client</option>
                  </select>
                  <div className={`absolute right-2 pointer-events-none ${isSimulating ? 'text-amber-500' : 'text-text-tertiary'}`}>
                    <ChevronDown className="w-3 h-3" />
                  </div>
                </div>
              )}

              {/* Sandbox Toggle */}
              {hasAuthority(profile, 'admin') && (
                <button
                  onClick={async () => {
                    if (!workspace || !user) return;
                    setIsSandboxTransitioning(true);
                    notify('Transitioning environment...', 'info');
                    try {
                      if (!isSandboxMode) {
                        // Enter Sandbox — save the current (parent) workspace ID so we can reliably exit
                        localStorage.setItem('resolve-sandbox-parent-workspace', workspace.id);
                        await cloneWorkspaceToSandbox(workspace.id, user.id);
                        setIsSandboxMode(true);
                        localStorage.setItem('resolve-sandbox-mode', 'true');
                        notify('Sandbox Mode Activated - Data isolated.', 'success');
                        setTimeout(() => window.location.reload(), 1000);
                      } else {
                        // Exit Sandbox — use stored parent workspace ID (DB may not set parent_workspace_id)
                        const parentId = workspace.parent_workspace_id || localStorage.getItem('resolve-sandbox-parent-workspace');
                        if (parentId) {
                          await supabase.from('users').update({ workspace_id: parentId }).eq('id', user.id);
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
                  disabled={isSandboxTransitioning}
                  className={`p-1.5 border rounded-md transition-all shrink-0 cursor-pointer shadow-sm flex items-center gap-1 px-2 ${
                    isSandboxMode 
                      ? 'bg-blue-500/20 border-blue-500/50 text-blue-400 shadow-[0_0_10px_rgba(59,130,246,0.2)]' 
                      : 'border-border bg-surface-highest hover:bg-surface-3 text-text-secondary hover:text-text-primary'
                  } ${isSandboxTransitioning ? 'opacity-50 cursor-not-allowed' : ''}`}
                  title="Toggle Sandbox Training Mode"
                >
                  <Shield className={`w-3.5 h-3.5 ${isSandboxTransitioning ? 'animate-spin' : ''}`} />
                  <span className="text-[10px] font-bold tracking-wider uppercase hidden sm:inline">Sandbox</span>
                </button>
              )}

              {/* Theme */}
              <button
                onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
                className="p-1.5 border border-border bg-surface-highest hover:bg-surface-3 rounded-md text-text-secondary hover:text-text-primary transition-all shrink-0 cursor-pointer shadow-sm"
                title={theme === 'dark' ? 'Light Theme' : 'Dark Theme'}
              >
                {theme === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
              </button>

              {/* End Day */}
              <button
                onClick={() => setIsEndOfDayModalOpen(true)}
                className="p-1.5 border border-border bg-surface-highest hover:bg-surface-3 rounded-md text-indigo-400 hover:text-indigo-300 transition-all shrink-0 cursor-pointer shadow-sm"
                title="Finish My Day"
              >
                <Sunset className="w-4 h-4" />
              </button>

              {/* Help Escalation */}
              <button
                onClick={() => setSupportModalOpen(true)}
                className="p-1.5 border border-border bg-surface-highest hover:bg-surface-3 rounded-md text-indigo-400 hover:text-indigo-300 transition-all shrink-0 cursor-pointer shadow-sm"
                title="Support Escalation"
              >
                <HelpCircle className="w-4 h-4" />
              </button>

              <UniversalWorkInbox />

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
                  <span className="text-xs font-medium text-emerald-400/80 bg-emerald-500/10 px-2 py-0.5 rounded">All systems nominal</span>
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
              {hasAuthority(profile, 'admin') && window.location.pathname === '/workspace' && (
                <WelcomeCenter />
              )}
              {children}
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
          onNavigate={navigateTo}
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
            workspaceId={workspace.id}
            notify={notify}
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



