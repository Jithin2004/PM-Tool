import React from 'react';
import { motion } from 'motion/react';
import { CheckSquare, LayoutDashboard, KanbanSquare, ListTodo, AlertTriangle, MessageSquare, Users, Clock, DollarSign, FileText, ShieldCheck, TrendingUp, Activity, Bell, Target, Play } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { hasCapability } from '../../core/auth/permissions';
import { navigate } from '../../lib/navigation';


interface RoleSection {
  icon: React.ElementType;
  label: string;
  description: string;
  path: string;
  color: string;
  bgColor: string;
}



function RoleCard({ section }: { section: RoleSection }) {
  const Icon = section.icon;
  return (
    <motion.button
      whileHover={{ scale: 1.02, y: -2 }}
      whileTap={{ scale: 0.98 }}
      onClick={() => navigate(section.path)}
      className="flex flex-col items-start p-4 rounded-xl border border-[var(--border-soft)] bg-[var(--surface-glass)] hover:bg-[var(--surface-hover)] hover:border-indigo-500/30 transition-all text-left w-full group"
    >
      <div className={`w-9 h-9 rounded-lg ${section.bgColor} flex items-center justify-center mb-3`}>
        <Icon className={`w-4.5 h-4.5 ${section.color}`} strokeWidth={1.5} />
      </div>
      <span className="text-xs font-semibold text-[var(--text-primary)] mb-0.5 group-hover:text-white transition-colors">{section.label}</span>
      <span className="text-[10px] text-[var(--text-muted)] leading-relaxed">{section.description}</span>
    </motion.button>
  );
}

/** Developer / Employee role widgets */
function DeveloperDashboard() {
  const sections: RoleSection[] = [
    { icon: CheckSquare, label: 'My Tasks', description: 'View and update your assigned work', path: '/execution/board', color: 'text-blue-400', bgColor: 'bg-blue-500/10' },
    { icon: KanbanSquare, label: 'Sprint Board', description: 'Current sprint progress and blockers', path: '/execution/board', color: 'text-indigo-400', bgColor: 'bg-indigo-500/10' },
    { icon: AlertTriangle, label: 'Blockers', description: 'Items waiting on you or blocked by others', path: '/execution/board', color: 'text-amber-400', bgColor: 'bg-amber-500/10' },
    { icon: MessageSquare, label: 'Mentions & Updates', description: 'Notifications and team activity', path: '/workspace/notifications', color: 'text-emerald-400', bgColor: 'bg-emerald-500/10' },
  ];
  return (
    <div>
      <div className="flex items-center gap-2 mb-4">
        <Play className="w-3.5 h-3.5 text-blue-400" />
        <span className="text-[10px] font-mono uppercase tracking-widest text-[var(--text-muted)]">Your Execution Zone</span>
      </div>
      <div className="grid grid-cols-2 gap-3">
        {sections.map(s => <RoleCard key={s.path + s.label} section={s} />)}
      </div>
    </div>
  );
}

/** PM role widgets */
function PMDashboard() {
  const sections: RoleSection[] = [
    { icon: Activity, label: 'Team Health', description: 'Delivery status and risk indicators', path: '/overview', color: 'text-emerald-400', bgColor: 'bg-emerald-500/10' },
    { icon: TrendingUp, label: 'Timeline', description: 'Gantt, milestones, and critical path', path: '/execution/gantt', color: 'text-indigo-400', bgColor: 'bg-indigo-500/10' },
    { icon: AlertTriangle, label: 'Risks', description: 'Escalations and delivery risks', path: '/workspace/decisions', color: 'text-rose-400', bgColor: 'bg-rose-500/10' },
    { icon: ShieldCheck, label: 'Approvals', description: 'Pending approvals and sign-offs', path: '/workspace/approvals', color: 'text-amber-400', bgColor: 'bg-amber-500/10' },
  ];
  return (
    <div>
      <div className="flex items-center gap-2 mb-4">
        <Target className="w-3.5 h-3.5 text-indigo-400" />
        <span className="text-[10px] font-mono uppercase tracking-widest text-[var(--text-muted)]">Project Command</span>
      </div>
      <div className="grid grid-cols-2 gap-3">
        {sections.map(s => <RoleCard key={s.path + s.label} section={s} />)}
      </div>
    </div>
  );
}

/** HR role widgets */
function HRDashboard() {
  const sections: RoleSection[] = [
    { icon: Clock, label: 'Attendance', description: 'Daily clock-ins and attendance logs', path: '/resources', color: 'text-blue-400', bgColor: 'bg-blue-500/10' },
    { icon: ListTodo, label: 'Leave Requests', description: 'Review and approve leave applications', path: '/resources', color: 'text-indigo-400', bgColor: 'bg-indigo-500/10' },
    { icon: Users, label: 'People', description: 'Employee profiles and department view', path: '/resources/teams', color: 'text-emerald-400', bgColor: 'bg-emerald-500/10' },
    { icon: Bell, label: 'HR Alerts', description: 'Policy violations and pending actions', path: '/workspace/notifications', color: 'text-amber-400', bgColor: 'bg-amber-500/10' },
  ];
  return (
    <div>
      <div className="flex items-center gap-2 mb-4">
        <Users className="w-3.5 h-3.5 text-emerald-400" />
        <span className="text-[10px] font-mono uppercase tracking-widest text-[var(--text-muted)]">People Operations</span>
      </div>
      <div className="grid grid-cols-2 gap-3">
        {sections.map(s => <RoleCard key={s.path + s.label} section={s} />)}
      </div>
    </div>
  );
}

/** Finance role widgets */
function FinanceDashboard() {
  const sections: RoleSection[] = [
    { icon: DollarSign, label: 'Cash Position', description: 'Current balances and liquidity', path: '/resources/finance', color: 'text-emerald-400', bgColor: 'bg-emerald-500/10' },
    { icon: FileText, label: 'Invoices', description: 'Outstanding and paid invoices', path: '/resources/finance?tab=invoices', color: 'text-blue-400', bgColor: 'bg-blue-500/10' },
    { icon: ShieldCheck, label: 'Expense Approvals', description: 'Pending expense reimbursements', path: '/workspace/approvals', color: 'text-amber-400', bgColor: 'bg-amber-500/10' },
    { icon: TrendingUp, label: 'Financial Reports', description: 'P&L, cash flow, and forecasts', path: '/workspace/reports', color: 'text-indigo-400', bgColor: 'bg-indigo-500/10' },
  ];
  return (
    <div>
      <div className="flex items-center gap-2 mb-4">
        <DollarSign className="w-3.5 h-3.5 text-emerald-400" />
        <span className="text-[10px] font-mono uppercase tracking-widest text-[var(--text-muted)]">Finance Command</span>
      </div>
      <div className="grid grid-cols-2 gap-3">
        {sections.map(s => <RoleCard key={s.path + s.label} section={s} />)}
      </div>
    </div>
  );
}

/** Owner / Admin widgets */
function OwnerDashboard() {
  const sections: RoleSection[] = [
    { icon: Activity, label: 'Company Health', description: 'Overall operational status', path: '/overview', color: 'text-emerald-400', bgColor: 'bg-emerald-500/10' },
    { icon: AlertTriangle, label: 'Risks', description: 'Critical escalations and blockers', path: '/workspace/decisions', color: 'text-rose-400', bgColor: 'bg-rose-500/10' },
    { icon: ShieldCheck, label: 'Decisions', description: 'Pending approvals and authorizations', path: '/workspace/approvals', color: 'text-amber-400', bgColor: 'bg-amber-500/10' },
    { icon: LayoutDashboard, label: 'Mission Control', description: 'Full operational overview', path: '/overview', color: 'text-indigo-400', bgColor: 'bg-indigo-500/10' },
  ];
  return (
    <div>
      <div className="flex items-center gap-2 mb-4">
        <LayoutDashboard className="w-3.5 h-3.5 text-indigo-400" />
        <span className="text-[10px] font-mono uppercase tracking-widest text-[var(--text-muted)]">Command Center</span>
      </div>
      <div className="grid grid-cols-2 gap-3">
        {sections.map(s => <RoleCard key={s.path + s.label} section={s} />)}
      </div>
    </div>
  );
}

/**
 * RoleAwareQuickAccess — role-specific quick-access widget for the overview page.
 * Renders different navigation sections based on the user's role.
 */
export function RoleAwareQuickAccess() {
  const { profile } = useAuth();
  const role = profile?.role;

  if (!profile) return null;

  const isOwnerOrAdmin = hasCapability(profile, 'settings.manage');
  const isHR = hasCapability(profile, 'people.manage');
  const isFinance = hasCapability(profile, 'finance.manage');
  const isPM = hasCapability(profile, 'project.update') && !isOwnerOrAdmin;

  let content: React.ReactNode;
  if (isOwnerOrAdmin) {
    content = <OwnerDashboard />;
  } else if (isPM) {
    content = <PMDashboard />;
  } else if (isHR) {
    content = <HRDashboard />;
  } else if (isFinance) {
    content = <FinanceDashboard />;
  } else {
    content = <DeveloperDashboard />;
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: 'easeOut' }}
      className="rounded-xl border border-[var(--border-soft)] bg-[var(--surface-glass)] p-5"
    >
      {content}
    </motion.div>
  );
}
