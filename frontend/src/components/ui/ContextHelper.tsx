import React, { useEffect, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { BookOpen, X, ChevronDown, ChevronUp } from 'lucide-react';
import { learningStateService } from '../../services/learningStateService';
import { useAuth } from '../../context/AuthContext';
import { useWorkspace } from '../../context/WorkspaceContext';

export interface ContextHelperProps {
  /** Unique stable ID — used to persist dismissal in user_learning_state */
  id: string;
  /** Short label shown in the collapsed trigger */
  title: string;
  /** Full explanation shown when expanded */
  content: string;
  /** Optional: where to position the tooltip. Default: 'inline' */
  variant?: 'inline' | 'tooltip' | 'banner';
  /** Optional: use a compact micro icon trigger */
  compact?: boolean;
}

/**
 * ContextHelper — persisted per-user contextual learning component.
 *
 * Rules:
 * - Short, collapsible, dismissible.
 * - Dismissed state stored in user_learning_state via learningStateService.
 * - Once dismissed, will NOT render again for this user in this workspace.
 */
export function ContextHelper({
  id,
  title,
  content,
  variant = 'inline',
  compact = false,
}: ContextHelperProps) {
  const { user } = useAuth();
  const { workspace } = useWorkspace();

  const [dismissed, setDismissed] = useState<boolean | null>(null); // null = loading
  const [expanded, setExpanded] = useState(false);

  // Check persistence on mount
  useEffect(() => {
    if (!user?.id || !workspace?.id) {
      setDismissed(false);
      return;
    }

    let active = true;
    learningStateService.isGuideDismissed(workspace.id, user.id, id).then(isDismissed => {
      if (active) setDismissed(isDismissed);
    });

    return () => { active = false; };
  }, [id, user?.id, workspace?.id]);

  const handleDismiss = useCallback(async (e: React.MouseEvent) => {
    e.stopPropagation();
    setDismissed(true);
    if (user?.id && workspace?.id) {
      await learningStateService.dismissGuide(workspace.id, user.id, id);
    }
  }, [id, user?.id, workspace?.id]);

  // Still loading persistence — render nothing to avoid flicker
  if (dismissed === null || dismissed === true) return null;

  // ── Tooltip variant: small ? icon with hover popover ──
  if (variant === 'tooltip') {
    return (
      <div className="relative inline-flex items-center ml-1 group">
        <button
          onClick={() => setExpanded(v => !v)}
          className="flex items-center justify-center w-4 h-4 rounded-full bg-indigo-500/20 text-indigo-400 hover:bg-indigo-500/30 transition-colors text-[9px] font-bold leading-none"
          aria-label={`Help: ${title}`}
        >
          ?
        </button>
        <AnimatePresence>
          {expanded && (
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 4 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 4 }}
              className="absolute bottom-full left-0 mb-2 z-50 w-56 p-3 bg-[#14151a] border border-indigo-500/30 rounded-lg shadow-xl"
            >
              <div className="flex items-start justify-between gap-2 mb-1.5">
                <span className="text-[10px] font-mono uppercase tracking-wider text-indigo-400">{title}</span>
                <button
                  onClick={handleDismiss}
                  className="text-[var(--text-muted)] hover:text-white transition-colors flex-shrink-0"
                >
                  <X className="w-3 h-3" />
                </button>
              </div>
              <p className="text-[11px] text-[var(--text-secondary)] leading-relaxed">{content}</p>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    );
  }

  // ── Banner variant: full-width info strip ──
  if (variant === 'banner') {
    return (
      <motion.div
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -8 }}
        className="flex items-start gap-3 px-4 py-3 bg-indigo-500/5 border border-indigo-500/20 rounded-lg mb-4"
      >
        <BookOpen className="w-4 h-4 text-indigo-400 flex-shrink-0 mt-0.5" />
        <div className="flex-1 min-w-0">
          <span className="text-[10px] font-mono uppercase tracking-wider text-indigo-400 block mb-0.5">{title}</span>
          <p className="text-xs text-[var(--text-secondary)] leading-relaxed">{content}</p>
        </div>
        <button
          onClick={handleDismiss}
          className="text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors flex-shrink-0 mt-0.5"
          aria-label="Dismiss"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </motion.div>
    );
  }

  // ── Inline variant (default): collapsible inline card ──
  return (
    <motion.div
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      className={`rounded-lg border border-indigo-500/20 bg-indigo-500/5 overflow-hidden ${compact ? 'mb-2' : 'mb-3'}`}
    >
      <button
        onClick={() => setExpanded(v => !v)}
        className="w-full flex items-center gap-2.5 px-3 py-2 hover:bg-indigo-500/5 transition-colors group"
        aria-expanded={expanded}
      >
        <BookOpen className="w-3.5 h-3.5 text-indigo-400 flex-shrink-0" />
        <span className="text-[10px] font-mono uppercase tracking-wider text-indigo-400 flex-1 text-left">{title}</span>
        {expanded
          ? <ChevronUp className="w-3 h-3 text-[var(--text-muted)]" />
          : <ChevronDown className="w-3 h-3 text-[var(--text-muted)]" />}
        <button
          onClick={handleDismiss}
          className="opacity-0 group-hover:opacity-100 text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-all ml-1"
          aria-label="Dismiss permanently"
        >
          <X className="w-3 h-3" />
        </button>
      </button>

      <AnimatePresence>
        {expanded && (
          <motion.div
            key="content"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.18 }}
            className="overflow-hidden"
          >
            <p className="px-3 pb-3 text-xs text-[var(--text-secondary)] leading-relaxed">
              {content}
            </p>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

/**
 * Pre-defined context helpers for the most common Resolve PM concepts.
 * Import and place these near the relevant UI element.
 */
export const CONTEXT_HELPERS = {
  EPIC: {
    id: 'concept_epic',
    title: 'What is an Epic?',
    content: 'An Epic is a large goal that groups related user stories together. Epics represent major features or outcomes that take multiple sprints to deliver.',
  },
  STORY: {
    id: 'concept_story',
    title: 'What is a Story?',
    content: 'A Story captures a user need or requirement, delivered through one or more tasks. Stories belong to Epics and represent shippable pieces of work.',
  },
  SPRINT: {
    id: 'concept_sprint',
    title: 'What is a Sprint?',
    content: 'A Sprint is a planned time period (usually 1–2 weeks) in which your team commits to completing a selected set of stories and tasks from the backlog.',
  },
  BACKLOG: {
    id: 'concept_backlog',
    title: 'What is the Backlog?',
    content: 'The Backlog is your prioritized list of all planned work. Items in the backlog are groomed, estimated, and pulled into sprints when ready.',
  },
  KANBAN: {
    id: 'concept_kanban',
    title: 'What is Kanban?',
    content: 'Kanban is a continuous flow workflow. Tasks move through columns (lanes) representing their current state. There are no fixed sprints — work flows at a steady pace.',
  },
  LEAVE_BALANCE: {
    id: 'concept_leave_balance',
    title: 'Leave Balance',
    content: 'Leave balance tracks the number of approved leave days used vs. allocated for each employee. Changes after manager approval.',
  },
  LEDGER: {
    id: 'concept_ledger',
    title: 'What is the Ledger?',
    content: 'The Financial Ledger records all money movements — income from invoices, expenses, and payroll. It is the source of truth for your company\'s financial health.',
  },
  CAPACITY: {
    id: 'concept_capacity',
    title: 'What is Capacity?',
    content: 'Capacity is the total available work hours for your team in a given period, adjusted for leaves, holidays, and attendance. The prediction engine uses this to forecast delivery timelines.',
  },
} as const;
