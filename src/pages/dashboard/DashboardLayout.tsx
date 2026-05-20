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
  ChevronLeft,
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
  Lock,
  Calculator,
  TrendingDown,
  Banknote,
  Download,
  Menu,
  X,
  Sun,
  Moon
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { supabase, isSupabaseConfigured } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';
import { useWorkspace } from '../../context/WorkspaceContext';
import { DashboardProvider } from '../../context/DashboardContext';
import { sha256 } from '../../utils/cryptoUtils';
import { useTasks } from '../../hooks/useTasks';
import { fetchNotifications, markAsRead as markNotifAsRead, sendNotification } from '../../services/notificationService';
import { CheckCircle2, XCircle, Info, AlertCircle } from 'lucide-react';
import { Login } from '../../components/auth/Login';
import { Header } from '../../components/ui/Header';
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
      
      let totalExpected = 0;
      let totalVariance = 0;
      
      projectTasks.forEach(task => {
        const best = Number(task.pert_best) || Number(task.estimated_hours) || 0;
        const likely = Number(task.pert_likely) || Number(task.estimated_hours) || 0;
        const worst = Number(task.pert_worst) || Number(task.estimated_hours) || 0;
        
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
      const notifChannel = supabase.channel(`notifications-changes-${workspace.id}`)
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
  const [isAdminView, setIsAdminView] = useState(() => window.location.pathname === '/admin');
  const [isLogisticsView, setIsLogisticsView] = useState(() => window.location.pathname === '/logistics');
  const [isPipelineView, setIsPipelineView] = useState(() => window.location.pathname === '/pipeline');
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);
  const [isRosterOpen, setIsRosterOpen] = useState(false);
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [dashboardTab, setDashboardTab] = useState<'active' | 'completed' | 'intelligence'>('active');
  const [showFeedbackGate, setShowFeedbackGate] = useState(false);
  const [feedbackRating, setFeedbackRating] = useState<number | null>(null);
  const [feedbackTags, setFeedbackTags] = useState<string[]>([]);
  const [feedbackComment, setFeedbackComment] = useState('');

  const tourSteps = useMemo(() => {
    const role = profile?.role || 'viewer';

    if (role === 'super_admin') {
      return [
        {
          title: "Welcome, Commander!",
          description: "Step into your high-fidelity Resolve PM workspace. This guide will brief you on all administrative and scheduling tools at your disposal.",
          actionBefore: () => {
            setIsAdminView(false);
            setIsLogisticsView(false);
          }
        },
        {
          title: "Tactical Navigation Console",
          description: "In the Header, use the 'Admin Console' button to manage team structure, the 'Logistics Console' button to access payroll, and the 'Brain' button to restart this tour.",
          actionBefore: () => {
            setIsAdminView(false);
            setIsLogisticsView(false);
          }
        },
        {
          title: "AI-Powered Strategy Analytics",
          description: "Click 'Analytics' or monitor stats at the top: Delivery Confidence (calculated from team load), daily Fatigue, and live AI Strategy Briefings.",
          actionBefore: () => {
            setIsAdminView(false);
            setIsLogisticsView(false);
          }
        },
        {
          title: "Project Workspace Grid",
          description: "Your primary project workspace. Click the '+' button to add new projects. Switch between 'Active' and 'Completed' tabs. Click 'Details' on any card to view PERT estimates and enter audit logs.",
          actionBefore: () => {
            setIsAdminView(false);
            setIsLogisticsView(false);
          }
        },
        {
          title: "Admin Console (Teams & Roles)",
          description: "Here, click 'Configure Roles' to manage team titles. Click 'Create Team' to create a team, set their load limit, and assign developers.",
          actionBefore: () => {
            setIsAdminView(true);
            setIsLogisticsView(false);
          }
        },
        {
          title: "Logistics & Payroll Controls",
          description: "Use the calendar to mark daily attendance. Change pay slabs under settings, calculate automated deductions, and click 'Export CSV' to download detailed payroll reports.",
          actionBefore: () => {
            setIsLogisticsView(true);
            setIsAdminView(false);
          }
        },
        {
          title: "Task Board",
          description: "Explore the brand new premium, tactical Task Board. Shift lenses, track task lanes, and observe live clock-synced ETAs.",
          actionBefore: () => {
            setIsPipelineView(true);
            setIsAdminView(false);
            setIsLogisticsView(false);
          }
        },
        {
          title: "Visual Lenses & Task Lanes",
          description: "Switch between 'Kanban' (Triage, In Flight, Validation) and 'Scrum' (Sprint Backlog, In Progress, Code Review, Merged) lenses instantly.",
          actionBefore: () => {
            setIsPipelineView(true);
            setIsAdminView(false);
            setIsLogisticsView(false);
          }
        },
        {
          title: "Developer Activity Logs",
          description: "Click on any task card to reveal the slide-out developer activity log drawer and inspect live historical records.",
          actionBefore: () => {
            setIsPipelineView(true);
            setIsAdminView(false);
            setIsLogisticsView(false);
          }
        },
        {
          title: "Calibrated & Ready!",
          description: "Use the Sun/Moon button next to the Help Tour button to switch themes. Your console is fully synced to Supabase. Enjoy allocation!",
          actionBefore: () => {
            setIsAdminView(false);
            setIsLogisticsView(false);
            setIsPipelineView(false);
          }
        }
      ];
    } else if (role === 'pm') {
      return [
        {
          title: "Welcome, Project Manager!",
          description: "Step into your allocation workspace. This guide will brief you on how to coordinate teams and track client deadlines.",
          actionBefore: () => {
            setIsAdminView(false);
            setIsLogisticsView(false);
            setIsPipelineView(false);
          }
        },
        {
          title: "PM Header Controls",
          description: "Use the 'Logistics Console' button in the Header to access developers' attendance, and the glowing 'Brain' button to trigger this guide anytime.",
          actionBefore: () => {
            setIsAdminView(false);
            setIsLogisticsView(false);
            setIsPipelineView(false);
          }
        },
        {
          title: "Strategy Analytics",
          description: "Track project counts, daily fatigue levels, and dynamic AI briefings to report overall delivery confidence to supervisors.",
          actionBefore: () => {
            setIsAdminView(false);
            setIsLogisticsView(false);
            setIsPipelineView(false);
          }
        },
        {
          title: "Project Management Grid",
          description: "Click the '+' button to setup new project deadlines. Click 'Details' on any card to edit its proposed start, set priorities, and write change reason logs.",
          actionBefore: () => {
            setIsAdminView(false);
            setIsLogisticsView(false);
            setIsPipelineView(false);
          }
        },
        {
          title: "PM Logistics & Analytics",
          description: "Click on the calendar dates to mark daily attendance. View net payout totals and click 'Export CSV' to generate reports for the ownership.",
          actionBefore: () => {
            setIsLogisticsView(true);
            setIsAdminView(false);
            setIsPipelineView(false);
          }
        },
        {
          title: "Task Board",
          description: "Track project task progression, visualize Kanban/Scrum lanes, and inspect live clock-synced ETAs.",
          actionBefore: () => {
            setIsPipelineView(true);
            setIsAdminView(false);
            setIsLogisticsView(false);
          }
        },
        {
          title: "Visual Lenses & Task Lanes",
          description: "Switch visual layouts between Kanban and Scrum on the fly to match your team's tactical coordination model.",
          actionBefore: () => {
            setIsPipelineView(true);
            setIsAdminView(false);
            setIsLogisticsView(false);
          }
        },
        {
          title: "Developer Activity Logs",
          description: "Open cards to monitor detailed, immutable logs showing developer status transitions and audits.",
          actionBefore: () => {
            setIsPipelineView(true);
            setIsAdminView(false);
            setIsLogisticsView(false);
          }
        },
        {
          title: "Calibrated & Ready!",
          description: "Toggle themes with the Sun/Moon header button, coordinate with your assigned engineers, and keep timelines on target!",
          actionBefore: () => {
            setIsAdminView(false);
            setIsLogisticsView(false);
            setIsPipelineView(false);
          }
        }
      ];
    } else {
      // Viewer or general engineer
      return [
        {
          title: "Welcome to Resolve PM!",
          description: "This workspace displays live engineering allocations, delivery schedules, and historical project logs in Read-Only mode.",
          actionBefore: () => {
            setIsAdminView(false);
            setIsLogisticsView(false);
            setIsPipelineView(false);
          }
        },
        {
          title: "Viewing Header & Themes",
          description: "Your session role is set to 'Viewer'. You can read stats, switch themes using the Sun/Moon button, or restart this guide using the 'Brain' button.",
          actionBefore: () => {
            setIsAdminView(false);
            setIsLogisticsView(false);
            setIsPipelineView(false);
          }
        },
        {
          title: "AI Analytics & Delivery Confidence",
          description: "Monitor overall project stats, daily fatigue limits, and AI Strategy briefings right from the top dashboard analytics panel.",
          actionBefore: () => {
            setIsAdminView(false);
            setIsLogisticsView(false);
            setIsPipelineView(false);
          }
        },
        {
          title: "Project Grid & Search",
          description: "Use the top Search bar to find projects. Toggle 'Active' or 'Completed' tabs to view archives. Click 'Details' on cards to view PERT estimates and past audit logs.",
          actionBefore: () => {
            setIsAdminView(false);
            setIsLogisticsView(false);
            setIsPipelineView(false);
          }
        },
        {
          title: "Task Board",
          description: "View real-time task progression lanes and live clock-synced ETAs in premium Read-Only mode.",
          actionBefore: () => {
            setIsPipelineView(true);
            setIsAdminView(false);
            setIsLogisticsView(false);
          }
        },
        {
          title: "Visual Lenses & Task Lanes",
          description: "Switch visual layouts between Kanban and Scrum lanes to inspect matching task distributions.",
          actionBefore: () => {
            setIsPipelineView(true);
            setIsAdminView(false);
            setIsLogisticsView(false);
          }
        },
        {
          title: "Developer Activity Logs",
          description: "Click on task cards to read historical compliance logs showing past status transitions.",
          actionBefore: () => {
            setIsPipelineView(true);
            setIsAdminView(false);
            setIsLogisticsView(false);
          }
        },
        {
          title: "All Calibrated!",
          description: "You are fully up to date with live team activities. Keep track of project updates as developers coordinate tasks!",
          actionBefore: () => {
            setIsAdminView(false);
            setIsLogisticsView(false);
            setIsPipelineView(false);
          }
        }
      ];
    }
  }, [profile?.role]);

  // Expose tour launcher globally
  useEffect(() => {
    (window as any).startOnboardingTour = () => {
      setGuideStep(0);
      setShowGuide(true);
      setIsAdminView(false);
      setIsLogisticsView(false);
      setIsPipelineView(false);
    };
  }, [tourSteps]);


  // URL Sync Effect â€” keeps pathname in sync with view state
  // State initializers already read the pathname on mount, so this only
  // fires on actual user-driven view changes (not on initial load if paths match).
  useEffect(() => {
    let targetPath = '/';
    if (isAdminView) targetPath = '/admin';
    else if (isLogisticsView) targetPath = '/logistics';
    else if (isPipelineView) targetPath = '/pipeline';

    if (window.location.pathname !== targetPath) {
      window.history.pushState({}, '', targetPath);
    }
  }, [isAdminView, isLogisticsView, isPipelineView]);

  // Browser Back/Forward Sync Effect
  useEffect(() => {
    const handlePopState = () => {
      const path = window.location.pathname;
      setIsAdminView(path === '/admin');
      setIsLogisticsView(path === '/logistics');
      setIsPipelineView(path === '/pipeline');
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
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

  useEffect(() => {
    const fetchWorkspaceSettings = async () => {
      if (workspace?.id && isSupabaseConfigured) {
        const { data, error } = await supabase
          .from('workspace_settings')
          .select('*')
          .eq('workspace_id', workspace.id)
          .maybeSingle();

        if (!error && data) {
          setWorkingTimeFrom(data.working_time_from);
          setWorkingTimeTo(data.working_time_to);
          setWorkspaceSettingsBlob(data.settings_blob || {});
          return;
        }
      }
      
      // Fallback to legacy team.data
      const settingsTeam = teams.find(t => t.name === 'SYSTEM_SETTINGS');
      if (settingsTeam && settingsTeam.data) {
        const settingsData = settingsTeam.data as any;
        if (settingsData.workingTimeFrom) {
          setWorkingTimeFrom(settingsData.workingTimeFrom);
        } else if (typeof settingsData.workingHours === 'number') {
          const hrs = settingsData.workingHours;
          const endHour = Math.min(23, 9 + Math.floor(hrs));
          const endMin = Math.round((hrs - Math.floor(hrs)) * 60);
          setWorkingTimeFrom("09:00");
          setWorkingTimeTo(`${String(endHour).padStart(2, '0')}:${String(endMin).padStart(2, '0')}`);
        }
        if (settingsData.workingTimeTo) {
          setWorkingTimeTo(settingsData.workingTimeTo);
        }
      }
    };
    
    fetchWorkspaceSettings();
  }, [teams, workspace?.id]);

  const handleWorkingTimeChange = async (from: string, to: string) => {
    setWorkingTimeFrom(from);
    setWorkingTimeTo(to);
    
    if (workspace?.id && isSupabaseConfigured) {
      const { data: existing, error: findError } = await supabase
        .from('workspace_settings')
        .select('*')
        .eq('workspace_id', workspace.id)
        .maybeSingle();

      if (!findError && existing) {
        await supabase.from('workspace_settings').update({
          working_time_from: from,
          working_time_to: to,
          working_hours: calculateHoursFromRange(from, to)
        }).eq('workspace_id', workspace.id);
      } else {
        await supabase.from('workspace_settings').insert({
          workspace_id: workspace.id,
          working_time_from: from,
          working_time_to: to,
          working_hours: calculateHoursFromRange(from, to)
        });
      }
    }
  };

  const handleSaveLogisticsData = async (updatedData: any) => {
    // 1. Intercept attendance updates
    if (updatedData.attendance) {
      if (isSupabaseConfigured) {
        try {
          const oldAttendance = systemData.attendance || {};
          const newAttendance = updatedData.attendance;

          const promises: Promise<any>[] = [];
          Object.keys(newAttendance).forEach(dateStr => {
            const dayRecords = newAttendance[dateStr];
            Object.keys(dayRecords).forEach(userId => {
              const record = dayRecords[userId];
              const oldRecord = oldAttendance[dateStr]?.[userId];
              if (
                !oldRecord ||
                oldRecord.status !== record.status ||
                oldRecord.leaveType !== record.leaveType ||
                oldRecord.isPaidHalfDay !== record.isPaidHalfDay
              ) {
                // Changed record: upsert it!
                promises.push((async () => {
                  const { data: existing } = await supabase
                    .from('attendance')
                    .select('id')
                    .eq('workspace_id', workspace.id)
                    .eq('user_id', userId)
                    .eq('date', dateStr)
                    .maybeSingle();

                  if (existing) {
                    return supabase
                      .from('attendance')
                      .update({
                        status: record.status,
                        leave_type: record.leaveType || null,
                        availability_factor: record.status === 'present' ? 1.0 : record.status === 'half_day' ? 0.5 : 0.0
                      })
                      .eq('id', existing.id);
                  } else {
                    return supabase
                      .from('attendance')
                      .insert({
                        workspace_id: workspace.id,
                        user_id: userId,
                        date: dateStr,
                        status: record.status,
                        leave_type: record.leaveType || null,
                        availability_factor: record.status === 'present' ? 1.0 : record.status === 'half_day' ? 0.5 : 0.0
                      });
                  }
                })());
              }
            });
          });

          if (promises.length > 0) {
            await Promise.all(promises);
            await fetchAttendance();
          }
        } catch (e) {
          console.error("Error saving attendance to dedicated table:", e);
        }
      }

      // Save to local state immediately
      const records: any[] = [];
      Object.keys(updatedData.attendance).forEach(dateStr => {
        const dayData = updatedData.attendance[dateStr];
        Object.keys(dayData).forEach(userId => {
          const record = dayData[userId];
          records.push({
            workspace_id: workspace.id,
            user_id: userId,
            date: dateStr,
            status: record.status,
            leave_type: record.leaveType || null,
            is_paid_half_day: !!record.isPaidHalfDay,
            availability_factor: record.status === 'present' ? 1.0 : record.status === 'half_day' ? 0.5 : 0.0
          });
        });
      });
      setAttendanceRows(records);
      delete updatedData.attendance;
    }

    // 2. Intercept salaries updates
    if (updatedData.salaries) {
      if (isSupabaseConfigured) {
        try {
          const oldSalaries = systemData.salaries || {};
          const newSalaries = updatedData.salaries;

          const promises: Promise<any>[] = [];
          Object.keys(newSalaries).forEach(userId => {
            const salary = newSalaries[userId];
            const oldSalary = oldSalaries[userId];
            if (oldSalary !== salary) {
              promises.push((async () => {
                const { data: existing } = await supabase
                  .from('salaries')
                  .select('id')
                  .eq('user_id', userId)
                  .maybeSingle();

                if (existing) {
                  return supabase
                    .from('salaries')
                    .update({ base_salary: salary })
                    .eq('id', existing.id);
                } else {
                  return supabase
                    .from('salaries')
                    .insert({ workspace_id: workspace.id, user_id: userId, base_salary: salary });
                }
              })());
            }
          });

          if (promises.length > 0) {
            await Promise.all(promises);
            await fetchSalaries();
          }
        } catch (e) {
          console.error("Error saving salaries to dedicated table:", e);
        }
      }

      // Save to local state immediately
      const records = Object.keys(updatedData.salaries).map(userId => ({
        user_id: userId,
        base_salary: Number(updatedData.salaries[userId]) || 3000
      }));
      setSalariesRows(records);
      delete updatedData.salaries;
    }

    // Save remainder to localStorage immediately as a fast fallback
    localStorage.setItem('SYSTEM_SETTINGS', JSON.stringify(updatedData));

    // Update in-memory state immediately so responsiveness is instantaneous
    setWorkspaceSettingsBlob((prev: any) => ({ ...prev, ...updatedData }));
    
    // Also update legacy fallback in memory
    setTeams(prevTeams => {
      const settingsTeam = prevTeams.find(t => t.name === 'SYSTEM_SETTINGS');
      if (settingsTeam) {
        return prevTeams.map(t => t.name === 'SYSTEM_SETTINGS' ? { ...t, data: { ...t.data, ...updatedData } } : t);
      } else {
        return [...prevTeams, { id: 'SYSTEM_SETTINGS', workspace_id: workspace?.id || '', name: 'SYSTEM_SETTINGS', data: updatedData, created_at: new Date().toISOString(), updated_at: new Date().toISOString() }];
      }
    });

    if (workspace?.id && isSupabaseConfigured) {
      // Sync to workspace_settings
      const { data: existingWorkspaceSettings, error: findWorkspaceError } = await supabase
        .from('workspace_settings')
        .select('*')
        .eq('workspace_id', workspace.id)
        .maybeSingle();

      if (!findWorkspaceError && existingWorkspaceSettings) {
        const mergedWorkspaceData = {
          ...existingWorkspaceSettings.settings_blob,
          ...updatedData
        };
        const { error } = await supabase
          .from('workspace_settings')
          .update({ settings_blob: mergedWorkspaceData })
          .eq('workspace_id', workspace.id);
        if (!error) {
          notify("Logistics analytics synchronized.", "success");
        } else {
          console.warn("Supabase logistics sync failed on workspace_settings:", error);
        }
      } else {
        const { error } = await supabase
          .from('workspace_settings')
          .insert({ workspace_id: workspace.id, settings_blob: updatedData });
        if (!error) {
          notify("Logistics analytics initialized.", "success");
        } else {
          console.warn("Supabase logistics init failed on workspace_settings:", error);
        }
      }
    }
  };


  // fetchProfiles is now called globally on init to support ProjectCard lookups

  const fetchProjects = async () => {
    if (!workspace?.id) return;
    const { data, error } = await supabase
      .from('projects')
      .select('*')
      .eq('workspace_id', workspace.id)
      .order('created_at', { ascending: false });

    if (!error && data) setProjects(data);
  };

  const fetchProfiles = async () => {
    if (!workspace?.id) return;
    const { data, error } = await supabase
      .from('users')
      .select('*')
      .eq('workspace_id', workspace.id)
      .order('created_at', { ascending: true });

    if (!error && data) setProfiles(data);
  };

  const fetchAttendance = async () => {
    if (!isSupabaseConfigured || !workspace?.id) return;
    try {
      const { data, error } = await supabase
        .from('attendance')
        .select('*')
        .eq('workspace_id', workspace.id);
      if (!error && data) {
        setAttendanceRows(data);
      }
    } catch (err) {
      console.warn("Could not fetch from attendance table:", err);
    }
  };

  const fetchSalaries = async () => {
    if (!isSupabaseConfigured || !workspace?.id) return;
    try {
      const { data, error } = await supabase
        .from('salaries')
        .select('*')
        .eq('workspace_id', workspace.id);
      if (!error && data) {
        setSalariesRows(data);
      }
    } catch (err) {
      console.warn("Could not fetch from salaries table:", err);
    }
  };


  const fetchTeams = async () => {
    if (!workspace?.id) return;
    const { data: teamsData, error: teamsError } = await supabase
      .from('teams')
      .select('*')
      .eq('workspace_id', workspace.id)
      .order('created_at', { ascending: false });

    if (!teamsError && teamsData) {
      // Fetch canonical team_members table
      const { data: membersData, error: membersError } = await supabase
        .from('team_members')
        .select('*')
        .eq('workspace_id', workspace.id);

      const membersList = (!membersError && membersData) ? membersData : [];

      // Reconstruct or auto-migrate team.data for UI components
      const enrichedTeams = await Promise.all(teamsData.map(async (team) => {
        if (team.name === 'SYSTEM_SETTINGS') {
          if (team.data) {
            localStorage.setItem('SYSTEM_SETTINGS', JSON.stringify(team.data));
          }
          return team;
        }

        const teamMembers = membersList.filter(m => m.team_id === team.id);
        let pmId = teamMembers.find(m => m.member_role === 'pm')?.user_id;
        let devIds = teamMembers.filter(m => m.member_role === 'developer').map(m => m.user_id);

        // Auto-migration compatibility layer:
        const parsedLegacyData = typeof team.data === 'string' ? JSON.parse(team.data) : team.data;
        if (teamMembers.length === 0 && parsedLegacyData && (parsedLegacyData.pm_id || parsedLegacyData.developer_ids)) {
          console.log(`Auto-migrating legacy team.data for team ${team.name} into canonical team_members table...`);
          const inserts: any[] = [];
          if (parsedLegacyData.pm_id) {
            inserts.push({
              workspace_id: workspace.id,
              team_id: team.id,
              user_id: parsedLegacyData.pm_id,
              member_role: 'pm'
            });
            pmId = parsedLegacyData.pm_id;
          }
          if (parsedLegacyData.developer_ids && Array.isArray(parsedLegacyData.developer_ids)) {
            parsedLegacyData.developer_ids.forEach((dId: string) => {
              inserts.push({
                workspace_id: workspace.id,
                team_id: team.id,
                user_id: dId,
                member_role: 'developer'
              });
            });
            devIds = parsedLegacyData.developer_ids;
          }
          if (inserts.length > 0) {
            await supabase.from('team_members').insert(inserts);
          }
        }

        return {
          ...team,
          data: {
            pm_id: pmId || '',
            developer_ids: devIds || []
          }
        };
      }));

      setTeams(enrichedTeams);
    } else {
      // Fallback: check localStorage for SYSTEM_SETTINGS
      const localSettings = localStorage.getItem('SYSTEM_SETTINGS');
      if (localSettings) {
        const parsedSettings = JSON.parse(localSettings);
        setTeams([{ id: 'SYSTEM_SETTINGS', workspace_id: workspace?.id || '', name: 'SYSTEM_SETTINGS', data: parsedSettings, created_at: new Date().toISOString(), updated_at: new Date().toISOString() }]);
      }
    }
  };

  const handleLogout = async () => {
    await logout();
    setProjects([]);
    setTeams([]);
    setProfiles([]);
  };

  const handleUpdateRole = async (id: string, role: UserRole) => {
    if (profile?.role !== 'super_admin') return;

    const targetUser = profiles.find(p => p.id === id);
    const targetName = targetUser?.full_name || targetUser?.email || "this user";

    askConfirmation(
      "Confirm Role Change",
      `Are you sure you want to change the role of ${targetName} to ${role.replace('_', ' ').toUpperCase()}?`,
      async () => {
        const success = await updateRole(id, role as any);

        if (success) {
          notify(`Role updated to ${role.replace('_', ' ').toUpperCase()} for ${targetName}`, "success");
          fetchProfiles();
        } else {
          notify("Failed to update role.", "error");
        }
      }
    );
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
      fetchProjects();
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

  const handleCreateTeam = async (name: string, pmId: string, devIds: string[]) => {
    if (profile?.role !== 'super_admin' || !workspace?.id) {
      notify("Unauthorized: Only super admins can create teams.", "error");
      return;
    }

    const newTeam = {
      workspace_id: workspace.id,
      name,
      capacity_hours_per_week: 40 * devIds.length
    };

    const { data, error } = await supabase
      .from('teams')
      .insert(newTeam)
      .select()
      .single();

    if (!error && data) {
      const memberInserts: any[] = [];
      if (pmId) {
        memberInserts.push({
          workspace_id: workspace.id,
          team_id: data.id,
          user_id: pmId,
          member_role: 'pm'
        });
      }
      devIds.forEach(devId => {
        memberInserts.push({
          workspace_id: workspace.id,
          team_id: data.id,
          user_id: devId,
          member_role: 'developer'
        });
      });

      if (memberInserts.length > 0) {
        await supabase.from('team_members').insert(memberInserts);
      }

      notify("Team successfully initialized!", "success");
      fetchTeams();
      fetchProfiles();
    } else {
      console.error("Team creation failed:", error);
      notify(`Team creation failed: ${error?.message || "Unknown error"}`, "error");
    }
  };

  const handleUpdateTeam = async (id: string, name: string, pmId: string, devIds: string[]) => {
    if (profile?.role !== 'super_admin' || !workspace?.id) return;

    const { data, error } = await supabase
      .from('teams')
      .update({
        name,
        capacity_hours_per_week: 40 * devIds.length
      })
      .eq('id', id)
      .select()
      .single();

    if (!error && data) {
      await supabase.from('team_members').delete().eq('team_id', id);

      const memberInserts: any[] = [];
      if (pmId) {
        memberInserts.push({
          workspace_id: workspace.id,
          team_id: id,
          user_id: pmId,
          member_role: 'pm'
        });
      }
      devIds.forEach(devId => {
        memberInserts.push({
          workspace_id: workspace.id,
          team_id: id,
          user_id: devId,
          member_role: 'developer'
        });
      });

      if (memberInserts.length > 0) {
        await supabase.from('team_members').insert(memberInserts);
      }

      notify("Team configuration updated.", "success");
      fetchTeams();
    } else {
      console.error("Team update failed:", error);
      notify(`Team update failed: ${error?.message || "Unknown error"}`, "error");
    }
  };

  const handleDeleteTeam = async (id: string) => {
    if (profile?.role !== 'super_admin') return;

    askConfirmation(
      "Archive Team",
      "Are you sure you want to archive this team? All project associations will be lost.",
      async () => {
        const { error } = await supabase
          .from('teams')
          .delete()
          .eq('id', id);

        if (!error) {
          notify("Team archived successfully.", "success");
          fetchTeams();
        } else {
          console.error("Team deletion failed:", error);
          notify(`Team deletion failed: ${error.message}`, "error");
        }
      }
    );
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
          fetchProjects();
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
    if (profile?.role === 'viewer') {
      notify("Unauthorized: Viewers cannot create projects.", "error");
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

    if (!pertBest || !pertLikely || !pertWorst) {
      notify("PERT estimates (Best, Likely, and Worst) are mandatory.", "error");
      return;
    }

    const bestNum = Number(pertBest);
    const likelyNum = Number(pertLikely);
    const worstNum = Number(pertWorst);

    if (isNaN(bestNum) || bestNum <= 0 || isNaN(likelyNum) || likelyNum <= 0 || isNaN(worstNum) || worstNum <= 0) {
      notify("PERT estimates must be positive numbers.", "error");
      return;
    }

    if (bestNum > likelyNum || likelyNum > worstNum) {
      notify("PERT bounds violation: Best Case ≤ Likely Case ≤ Worst Case.", "error");
      return;
    }

    const newProject = {
      workspace_id: workspace.id,
      name: newName,
      status: 'planning',
      priority: newPriority,
      efficiency: 0.8,
      pert_best: bestNum,
      pert_likely: likelyNum,
      pert_worst: worstNum,
      proposed_start_date: proposedStartDate,
      client_deadline: newClientDeadline,
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
      notify("Project created successfully.", "success");
      fetchProjects();

      // Auto-sync new project to Task Board as a triage task
      if (isSupabaseConfigured && workspace?.id) {
        try {
          await supabase.from('tasks').insert({
            workspace_id: workspace.id,
            project_id: data.id,
            name: data.name,
            description: `Project auto-synced from workspace. Priority: ${newPriority}.`,
            status: 'backlog',
            estimated_hours: 5,
            priority: 'medium',
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          });
        } catch (syncErr) {
          console.warn('Could not auto-sync project to Task Board:', syncErr);
        }
      } else if (workspace?.id) {
        // Offline: append to localStorage task cache
        try {
          const localTasks = JSON.parse(localStorage.getItem(`tasks_${workspace.id}`) || '[]');
          localTasks.unshift({
            id: `local-task-${Date.now()}`,
            workspace_id: workspace.id,
            project_id: data.id || `local-${Date.now()}`,
            name: data.name,
            description: `Project auto-synced. Priority: ${newPriority}.`,
            status: 'backlog',
            estimated_hours: 5,
            priority: 'medium',
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          });
          localStorage.setItem(`tasks_${workspace.id}`, JSON.stringify(localTasks));
        } catch (err) {
          console.warn("Dashboard Layout Error:", {
            source: "DashboardLayout",
            operation: "offline_task_sync_cache",
            workspace_id: workspace.id,
            timestamp: new Date().toISOString(),
            error: err
          });
          notify("Warning: Offline project task failed to sync to local cache.", "warning");
        }
      }
    } else {
      console.error("Project creation failed:", error);
      notify(`System Error: ${error?.message || "Failed to create project"}`, "error");
    }
  };

  // Promote a task from Task Board into the Project creation form
  const handlePromoteTaskToAsset = (taskData: { title: string; description: string; projectId: string }) => {
    setNewName(taskData.title);
    setIsPipelineView(false);
    setIsAdminView(false);
    setIsLogisticsView(false);
    setIsAdding(true);
    notify(`Task "${taskData.title}" elevated â€” fill in PERT estimates to register as a project.`, 'info');
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

  const calculateDynamicStats = (projList: Project[]) => {
    const activeProjects = projList.filter(p => p.status !== 'deployed');
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
      dailyFatigue: Number(totalDecayHours.toFixed(1))
    };
  };

  const stats: Stats = useMemo(() => calculateDynamicStats(projectsWithAggregatedPERT), [projectsWithAggregatedPERT, activeTeams]);

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
    <DashboardProvider value={{ 
      projects: projectsWithAggregatedPERT, 
      tasks,
      dependencies,
      profiles, 
      teams, 
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
      addDependency,
      removeDependency,
      updateTaskDates,
      updateTask,
      notifications: dbNotifications,
      markAsRead: handleMarkAsRead,
      workingHoursPerDay,
      tilesPerRow,
      setIsRosterOpen,
      setSelectedProject
    }}>
      <div className={`min-h-screen bg-[#0a0a0a] font-sans text-white/90 selection:bg-white selection:text-black ${theme === 'light' ? 'light' : ''}`}>
        <Header
          user={user}
          profile={profile}
          userCustomRoles={userCustomRoles}
          onLogout={handleLogout}
          notifications={dbNotifications}
          onMarkAsRead={handleMarkAsRead}
        onToggleAdmin={() => {
          setIsAdminView(!isAdminView);
          setIsLogisticsView(false);
          setIsPipelineView(false);
        }}
        showAdmin={isAdminView}
        onToggleLogistics={() => {
          setIsLogisticsView(!isLogisticsView);
          setIsAdminView(false);
          setIsPipelineView(false);
        }}
        showLogistics={isLogisticsView}
        onTogglePipeline={() => {
          setIsPipelineView(!isPipelineView);
          setIsAdminView(false);
          setIsLogisticsView(false);
        }}
        showPipeline={isPipelineView}
        onGoHome={() => {
          setIsAdminView(false);
          setIsLogisticsView(false);
          setIsPipelineView(false);
        }}
        workingTimeFrom={workingTimeFrom}
        workingTimeTo={workingTimeTo}
        onWorkingTimeChange={handleWorkingTimeChange}
        tilesPerRow={tilesPerRow}
        setTilesPerRow={setTilesPerRow}
        theme={theme}
        setTheme={setTheme}
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
        confirmText={confirmState.confirmText}
        onConfirm={confirmState.onConfirm}
        onCancel={() => setConfirmState(prev => ({ ...prev, isOpen: false }))}
      />

      {children}

      {/* --- Overlay Components --- */}

      <AnimatePresence>
        {isAdding && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-[#0a0a0a]/90 backdrop-blur-sm z-[100] flex items-center justify-center p-4 sm:p-6 overflow-y-auto"
          >
            {/* ... rest of the isAdding code ... */}
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-[#0c0c0c] border border-white/10 w-full max-w-xl p-6 sm:p-8 overflow-y-auto max-h-[90vh] md:max-h-none rounded-sm my-auto"
              onClick={e => e.stopPropagation()}
            >
              <div className="flex items-center gap-3 mb-8">
                <div className="w-8 h-8 bg-white/5 border border-white/10 flex items-center justify-center">
                  <Zap className="w-4 h-4 text-white/90" />
                </div>
                <div>
                  <h3 className="text-xl font-medium tracking-tight">Workspace Setup</h3>
                  <p className="text-[10px] font-mono text-white/80 uppercase">New project creation</p>
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
                    <label className="block text-[10px] uppercase font-mono text-white/70 tracking-tighter mb-2">PERT: BEST (H) *</label>
                    <input
                      type="number"
                      step="0.1"
                      min="0.1"
                      required
                      value={pertBest}
                      onChange={e => setPertBest(e.target.value)}
                      className="w-full bg-black border border-white/10 h-12 px-4 font-mono text-sm focus:border-white/40 outline-none"
                      placeholder="0"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] uppercase font-mono text-white/70 tracking-tighter mb-2">PERT: LIKELY (H) *</label>
                    <input
                      type="number"
                      step="0.1"
                      min="0.1"
                      required
                      value={pertLikely}
                      onChange={e => setPertLikely(e.target.value)}
                      className="w-full bg-black border border-white/10 h-12 px-4 font-mono text-sm focus:border-white/40 outline-none"
                      placeholder="0"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] uppercase font-mono text-white/70 tracking-tighter mb-2">PERT: WORST (H) *</label>
                    <input
                      type="number"
                      step="0.1"
                      min="0.1"
                      required
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
                    <label className="block text-[10px] uppercase font-mono text-white/85 mb-2">Assign Team</label>
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

                {getSuggestedTeam() && !newTeamId && (
                  <div className="bg-blue-500/10 border border-blue-500/20 p-3 flex justify-between items-center">
                    <div>
                      <p className="text-[10px] font-mono text-blue-400 uppercase tracking-widest mb-0.5">AI Suggestion</p>
                      <p className="text-xs font-mono text-white/80">Team <strong>{getSuggestedTeam()?.name}</strong> has optimal bandwidth availability.</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setNewTeamId(getSuggestedTeam()?.id || '')}
                      className="bg-blue-500/20 hover:bg-blue-500/40 text-blue-300 px-3 py-1.5 text-[10px] font-mono uppercase tracking-widest transition-colors border border-blue-500/30"
                    >
                      Auto-Assign
                    </button>
                  </div>
                )}

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[10px] uppercase font-mono text-white/85 mb-2">Proposed Start Date *</label>
                    <input
                      type="date"
                      required
                      value={proposedStartDate}
                      onChange={e => setProposedStartDate(e.target.value)}
                      className="w-full bg-black border border-white/10 h-12 px-4 font-mono text-sm focus:border-white/40 outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] uppercase font-mono text-white/85 mb-2">Client Deadline *</label>
                    <input
                      type="date"
                      required
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
                    Confidence interval adjusted for Â±{Math.sqrt(calculateVariance(Number(pertBest), Number(pertWorst))).toFixed(2)}Ïƒ.
                  </p>
                </div>

                <div className="flex gap-4 pt-4">
                  <button
                    type="submit"
                    className="flex-1 bg-white text-black h-12 font-medium hover:bg-neutral-200 transition-colors uppercase text-xs tracking-widest"
                  >
                    Commit Project
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
      <footer className="fixed bottom-0 left-0 right-0 bg-[#0a0a0a]/80 border-t border-white/5 px-4 sm:px-6 py-3 flex justify-between items-center pointer-events-none z-40">
        <div className="flex items-center gap-3 sm:gap-4 text-[9px] sm:text-[11px] font-mono text-white/75 uppercase tracking-widest">
          <div className="flex items-center gap-1.5">
            <div className="w-1.5 h-1.5 rounded-full bg-green-500/50 animate-pulse"></div>
            <span className="hidden sm:inline">SESSION_HEARTBEAT</span>
            <span className="inline sm:hidden">LIVE</span>
          </div>
          <div className="hidden sm:block">ENCRYPTION: AES-256-GCM</div>
          <LiveClock />
          {/* --- Added Copyright Notice --- */}
          <div className="text-white/40 border-l border-white/10 pl-3 sm:pl-4 hidden md:block">
            &copy; {new Date().getFullYear()} JITHIN M & SHAMIL T P
          </div>
        </div>
        <div className="flex items-center gap-4 sm:gap-6">
          <Settings className="w-3 h-3 text-white/70 pointer-events-auto cursor-pointer hover:text-white transition-colors" />
          <Cpu className="w-3 h-3 text-white/70" />
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
              className="w-full bg-[#0e0e0e]/95 border border-blue-500/40 rounded-lg p-5 shadow-[0_10px_50px_rgba(59,130,246,0.35)] relative overflow-hidden backdrop-blur-md"
            >
              {/* Core accent gradient bar */}
              <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-blue-500 via-indigo-500 to-purple-500" />

              {/* Header */}
              <div className="flex justify-between items-start mb-4">
                <div>
                  <span className="text-[9px] font-mono uppercase tracking-widest text-blue-400 bg-blue-500/10 px-2 py-0.5 rounded-sm">
                    Interactive briefing â€¢ Step {guideStep + 1} of {tourSteps.length}
                  </span>
                  <h3 className="text-base font-bold tracking-tight text-white mt-1.5">
                    {tourSteps[guideStep]?.title}
                  </h3>
                </div>
                <button
                  onClick={() => {
                    dismissGuide();
                    setShowFeedbackGate(true);
                  }}
                  className="text-white/40 hover:text-white transition-colors cursor-pointer text-[10px] font-mono uppercase tracking-wider bg-white/5 hover:bg-white/10 px-1.5 py-0.5 rounded"
                >
                  Skip
                </button>
              </div>

              {/* Body Description */}
              <p className="text-xs text-neutral-300 leading-relaxed font-sans mb-5">
                {tourSteps[guideStep]?.description}
              </p>

              {/* Navigation Controls */}
              <div className="flex justify-between items-center pt-3 border-t border-white/10">
                <button
                  disabled={guideStep === 0}
                  onClick={() => {
                    const prevStep = guideStep - 1;
                    setGuideStep(prevStep);
                    tourSteps[prevStep]?.actionBefore?.();
                  }}
                  className={`px-3 py-1.5 border border-white/10 text-[10px] font-mono uppercase tracking-wider hover:bg-white/5 transition-all rounded-sm flex items-center gap-1 cursor-pointer ${guideStep === 0 ? 'opacity-40 cursor-not-allowed' : ''}`}
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
                  className="px-3.5 py-1.5 bg-blue-600 hover:bg-blue-500 text-white text-[10px] font-mono uppercase tracking-wider transition-all rounded-sm flex items-center gap-1 shadow-[0_0_12px_rgba(59,130,246,0.3)] cursor-pointer"
                >
                  {guideStep === tourSteps.length - 1 ? 'Finish' : 'Next'}
                  <ChevronRight className="w-3 h-3 animate-pulse" />
                </button>
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

