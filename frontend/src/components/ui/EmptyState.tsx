import React from 'react';
import { motion } from 'motion/react';
import { LucideIcon } from 'lucide-react';

interface EmptyStateProps {
  icon: LucideIcon;
  title: string;
  description: string;
  action?: React.ReactNode;
  /** Secondary action link/button */
  secondaryAction?: React.ReactNode;
  /** Compact = smaller padding, used inside panels */
  compact?: boolean;
  /** Full height = fills available vertical space */
  fullHeight?: boolean;
}

/**
 * EmptyState — the canonical empty-state component for Resolve PM.
 *
 * Rules:
 * - Never shows "No data found"
 * - Always provides actionable guidance
 * - Consistent across all modules
 */
export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  secondaryAction,
  compact = false,
  fullHeight = false,
}: EmptyStateProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, ease: 'easeOut' }}
      className={`
        flex flex-col items-center justify-center text-center w-full
        ${fullHeight ? 'min-h-[60vh]' : ''}
        ${compact ? 'py-10 px-4' : 'py-20 px-6'}
      `}
    >
      {/* Icon container */}
      <div className="relative mb-5">
        <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-[var(--surface-hover)] to-[var(--surface-glass)] border border-[var(--border-soft)] flex items-center justify-center shadow-lg">
          <Icon className="w-7 h-7 text-[var(--text-muted)]" strokeWidth={1.5} />
        </div>
        {/* Subtle glow */}
        <div className="absolute inset-0 rounded-2xl bg-indigo-500/5 blur-xl -z-10 scale-150" />
      </div>

      {/* Text */}
      <h3 className="text-sm font-semibold tracking-tight text-[var(--text-primary)] mb-2 font-geist">
        {title}
      </h3>
      <p className="text-xs text-[var(--text-muted)] max-w-[280px] mx-auto leading-relaxed font-geist mb-6">
        {description}
      </p>

      {/* Primary action */}
      {action && (
        <div className="flex flex-col items-center gap-2">
          {action}
          {secondaryAction && (
            <div className="text-xs text-[var(--text-muted)] mt-1">{secondaryAction}</div>
          )}
        </div>
      )}
    </motion.div>
  );
}

// ── Convenience: standard CTA button style for empty state actions ──
interface EmptyStateActionProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  label: string;
  icon?: LucideIcon;
  variant?: 'primary' | 'secondary';
}

export function EmptyStateAction({
  label,
  icon: Icon,
  variant = 'primary',
  ...rest
}: EmptyStateActionProps) {
  const base = 'inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-medium transition-all cursor-pointer focus:outline-none';
  const styles =
    variant === 'primary'
      ? `${base} bg-indigo-500 hover:bg-indigo-600 text-white shadow-sm`
      : `${base} border border-[var(--border-soft)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--surface-hover)]`;

  return (
    <button className={styles} {...rest}>
      {Icon && <Icon className="w-3.5 h-3.5" />}
      {label}
    </button>
  );
}

// ── Pre-wired empty states for common modules ──

export const EMPTY_STATES = {
  SPRINTS: {
    title: 'No sprints yet',
    description: 'Plan your first sprint by selecting stories from the backlog and setting a time period.',
  },
  BACKLOG: {
    title: 'Backlog is empty',
    description: 'Start building your backlog by creating Epics, then break them into Stories and Tasks.',
  },
  TASKS: {
    title: 'No tasks assigned',
    description: 'Tasks assigned to you will appear here. Ask your project manager to assign work.',
  },
  FINANCE_LEDGER: {
    title: 'No transactions yet',
    description: 'Financial transactions appear here once invoices are marked as paid or expenses are recorded.',
  },
  INVOICES: {
    title: 'No invoices created',
    description: 'Create your first invoice to start tracking client billing and payment status.',
  },
  HR_ATTENDANCE: {
    title: 'No attendance records',
    description: 'Attendance records appear here once employees start clocking in. Set up attendance policies to begin tracking.',
  },
  HR_LEAVE: {
    title: 'No leave requests',
    description: 'Leave requests submitted by employees will appear here for review and approval.',
  },
  PROJECTS: {
    title: 'No projects yet',
    description: 'Create your first project to start tracking milestones, tasks, and team delivery.',
  },
  DECISIONS: {
    title: 'No decisions recorded',
    description: 'Important project decisions, approvals, and escalations are tracked here.',
  },
  REPORTS: {
    title: 'No reports generated',
    description: 'Generate your first report to get insight into project health, team performance, and delivery trends.',
  },
  ACTIVITY: {
    title: 'No recent activity',
    description: 'Activity from your team — task updates, comments, approvals — will stream here.',
  },
  TEAM: {
    title: 'No team members yet',
    description: 'Invite your team members to start assigning work and tracking capacity.',
  },
  NOTIFICATIONS: {
    title: 'You\'re all caught up',
    description: 'New notifications from tasks, approvals, risks, and mentions will appear here.',
  },
} as const;
