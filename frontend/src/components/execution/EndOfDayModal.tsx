import React, { useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, CheckCircle2, AlertTriangle, ArrowRight, Sunset } from 'lucide-react';
import { useOperationalData } from '../../context/OperationalDataContext';
import { activityLogService } from '../../services/activityLogService';

interface EndOfDayModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUser: any;
  workspaceId: string;
  notify: (msg: string, type: 'success'|'error'|'info') => void;
}

export function EndOfDayModal({ isOpen, onClose, currentUser, workspaceId, notify }: EndOfDayModalProps) {
  const { raw: { tasks = [], workSessions = [], blockers = [], projects = [] } } = useOperationalData();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const summary = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const myTasks = tasks.filter((t: any) => t.assignee_id === currentUser.id);

    // Completed Today: status is 'done' and updated_at is today
    const completedToday = myTasks.filter((t: any) => {
      if (t.status !== 'done') return false;
      const updated = new Date(t.updated_at);
      return updated >= today && updated < tomorrow;
    });

    // Still in progress: not done, not blocked
    const inProgress = myTasks.filter((t: any) => t.status === 'in_progress');

    // Blocked work
    const blockedWork = myTasks.filter((t: any) => t.status === 'blocked');

    // Blockers created today by user
    const blockersCreatedToday = blockers.filter((b: any) => {
      if (b.reported_by !== currentUser.id) return false;
      const created = new Date(b.created_at);
      return created >= today && created < tomorrow;
    });

    // Suggested tomorrow priority: highest priority project task or due soon
    const notDone = myTasks.filter((t: any) => t.status !== 'done' && t.status !== 'blocked');
    
    // Simple sort for tomorrow priority
    const sortedForTomorrow = notDone.sort((a: any, b: any) => {
      const projA = projects.find((p: any) => p.id === a.project_id);
      const projB = projects.find((p: any) => p.id === b.project_id);
      const prioA = projA?.priority === 'high' ? 1 : 0;
      const prioB = projB?.priority === 'high' ? 1 : 0;
      if (prioA !== prioB) return prioB - prioA;
      
      const dueA = a.end_date ? new Date(a.end_date).getTime() : Infinity;
      const dueB = b.end_date ? new Date(b.end_date).getTime() : Infinity;
      return dueA - dueB;
    });

    const tomorrowPriority = sortedForTomorrow.slice(0, 3);

    return {
      completedToday,
      inProgress,
      blockedWork,
      blockersCreatedToday,
      tomorrowPriority
    };
  }, [tasks, workSessions, blockers, projects, currentUser.id]);

  const handleFinishDay = async () => {
    setIsSubmitting(true);
    try {
      await activityLogService.appendLog({
        workspace_id: workspaceId,
        actor_id: currentUser.id,
        action: 'end_of_day_summary',
        metadata: {
          completed_count: summary.completedToday.length,
          in_progress_count: summary.inProgress.length,
          blocked_count: summary.blockedWork.length,
          completed_tasks: summary.completedToday.map((t: any) => ({ id: t.id, name: t.name })),
          tomorrow_priorities: summary.tomorrowPriority.map((t: any) => ({ id: t.id, name: t.name }))
        }
      });
      notify("Day closed successfully. Great work!", "success");
      onClose();
    } catch (err: any) {
      notify("Failed to close day: " + err.message, "error");
    } finally {
      setIsSubmitting(false);
    }
  };

  // Early return must be after ALL hooks are defined (Rules of Hooks)
  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[200] flex items-center justify-center bg-bg backdrop-blur-sm p-4">
        <motion.div 
          initial={{ opacity: 0, scale: 0.95 }} 
          animate={{ opacity: 1, scale: 1 }} 
          exit={{ opacity: 0, scale: 0.95 }} 
          className="bg-surface-2 border border-border w-full max-w-2xl rounded-xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
        >
          {/* Header */}
          <div className="flex justify-between items-center px-6 py-4 border-b border-border bg-surface-highest">
            <div className="flex items-center gap-3 text-indigo-400">
              <Sunset className="w-5 h-5" />
              <h2 className="text-lg font-semibold text-text-primary tracking-tight">End of Day Summary</h2>
            </div>
            <button onClick={onClose} className="p-1.5 rounded hover:bg-surface-3 text-text-secondary transition-colors">
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Body */}
          <div className="p-6 overflow-y-auto space-y-6 flex-1 font-geist">
            <p className="text-sm text-text-secondary leading-relaxed">
              Before you sign off, review what you achieved today and what's waiting for you tomorrow. 
              This summary is saved to your activity log for personal reflection and team transparency.
            </p>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              
              {/* Completed Today */}
              <div className="bg-surface-3 rounded-lg border border-emerald-500/20 p-4">
                <h3 className="text-sm font-semibold flex items-center gap-2 mb-3 text-emerald-500">
                  <CheckCircle2 className="w-4 h-4" /> Completed Today
                </h3>
                {summary.completedToday.length === 0 ? (
                  <p className="text-xs text-text-tertiary italic">No tasks marked done today.</p>
                ) : (
                  <ul className="space-y-2">
                    {summary.completedToday.map((t: any) => (
                      <li key={t.id} className="text-xs text-text-secondary truncate bg-surface-highest p-2 rounded border border-border">
                        {t.name}
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              {/* Blocked / Issues */}
              <div className="bg-surface-3 rounded-lg border border-rose-500/20 p-4">
                <h3 className="text-sm font-semibold flex items-center gap-2 mb-3 text-rose-500">
                  <AlertTriangle className="w-4 h-4" /> Blocked Work
                </h3>
                {summary.blockedWork.length === 0 ? (
                  <p className="text-xs text-text-tertiary italic">No blocked tasks assigned to you.</p>
                ) : (
                  <ul className="space-y-2">
                    {summary.blockedWork.map((t: any) => (
                      <li key={t.id} className="text-xs text-text-secondary truncate bg-surface-highest p-2 rounded border border-border">
                        {t.name}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
              
              {/* Still in progress */}
              <div className="bg-surface-3 rounded-lg border border-border p-4 md:col-span-2">
                <h3 className="text-sm font-semibold flex items-center gap-2 mb-3 text-text-primary">
                  <ArrowRight className="w-4 h-4 text-indigo-400" /> Tomorrow's Top Priorities
                </h3>
                {summary.tomorrowPriority.length === 0 ? (
                  <p className="text-xs text-text-tertiary italic">No pending tasks for tomorrow. Take a break!</p>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    {summary.tomorrowPriority.map((t: any) => (
                      <div key={t.id} className="text-xs text-text-secondary bg-surface-highest p-3 rounded border border-border flex flex-col justify-between gap-2 h-full">
                        <span className="font-medium line-clamp-2">{t.name}</span>
                        <span className="text-[10px] uppercase font-mono tracking-widest text-text-tertiary">Up Next</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

            </div>
          </div>

          {/* Footer */}
          <div className="flex justify-end gap-3 px-6 py-4 border-t border-border bg-surface-highest">
            <button
              onClick={onClose}
              disabled={isSubmitting}
              className="px-4 py-2 text-sm font-medium text-text-secondary hover:text-text-primary transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleFinishDay}
              disabled={isSubmitting}
              className="px-6 py-2 text-sm font-semibold rounded bg-indigo-500 text-white hover:bg-indigo-600 transition-all flex items-center gap-2 disabled:opacity-50"
            >
              {isSubmitting ? (
                <span className="animate-pulse">Closing Day...</span>
              ) : (
                <>Finish My Day <Sunset className="w-4 h-4" /></>
              )}
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
