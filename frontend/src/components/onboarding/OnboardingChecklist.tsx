import React, { useMemo, useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { CheckCircle2, Circle, Trophy } from 'lucide-react';
import { useOperationalRaw } from '../../context/OperationalDataContext';
import { useAuth } from '../../context/AuthContext';
import { useWorkspace } from '../../context/WorkspaceContext';
import { useNavigate } from '../../hooks/useNavigate';

export function OnboardingChecklist() {
  const { user } = useAuth();
  const { workspace } = useWorkspace();
  const raw = useOperationalRaw();
  const [isVisible, setIsVisible] = useState(false);

  const metrics = useMemo(() => {
    if (!user || !workspace) return { checks: [], total: 0, completed: 0, score: 0 };
    
    // Check 1: Create workspace
    // Check 2: Setup profile
    // Check 3: Create first project
    const hasProject = raw.projects && raw.projects.length > 0;
    // Check 4: Add first milestone
    const hasMilestone = raw.tasks && raw.tasks.some(t => t.milestone_id);
    // Check 5: Invite team member
    const hasTeamMember = raw.profiles && raw.profiles.length > 1;
    // Check 6: Create first task
    const hasTask = raw.tasks && raw.tasks.length > 0;
    // Check 7: Assign ownership
    const hasAssignment = raw.tasks && raw.tasks.some(t => t.assignee_id || t.owner_id);

    const allChecks = [
      { id: 'workspace', label: 'Create workspace', done: true },
      { id: 'profile', label: 'Setup profile', done: true },
      { id: 'project', label: 'Create first project', done: hasProject },
      { id: 'milestone', label: 'Add first milestone', done: hasMilestone },
      { id: 'invite', label: 'Invite team member', done: hasTeamMember },
      { id: 'task', label: 'Create first task', done: hasTask },
      { id: 'assign', label: 'Assign ownership', done: hasAssignment },
    ];
    
    const completed = allChecks.filter(c => c.done).length;
    const total = allChecks.length;
    
    return { checks: allChecks, completed, total, score: Math.round((completed / total) * 100) };
  }, [user, workspace, raw.projects, raw.tasks, raw.profiles]);

  useEffect(() => {
    if (user && metrics.total > 0) {
      // Hide if 100% complete
      if (metrics.score === 100) {
        setIsVisible(false);
      } else {
        setIsVisible(true);
      }
    }
  }, [metrics.score, user, metrics.total]);

  if (!isVisible) {
    return null;
  }
  
  const pendingChecks = metrics.checks.filter(c => !c.done);

  return (
    <div className="bg-[var(--pm-surface)] rounded-2xl border border-[var(--pm-border)] shadow-sm overflow-hidden mb-8">
      <div className="p-6 md:p-8 bg-gradient-to-r from-blue-500/10 to-transparent border-b border-[var(--pm-border)]">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <div className="p-2 bg-blue-500/20 rounded-lg text-blue-400">
                <Trophy className="w-6 h-6" />
              </div>
              <h2 className="text-2xl font-bold text-[var(--pm-text)]">Workspace Setup</h2>
            </div>
            <p className="text-[var(--pm-text-secondary)]">
              Complete these essential steps to get your workspace fully operational.
            </p>
          </div>
          <div className="flex flex-col items-end">
            <div className="text-sm font-medium text-[var(--pm-text)] mb-2 font-mono uppercase tracking-wider">
              Progress: {metrics.completed} / {metrics.total} Complete
            </div>
            <div className="w-48 h-2 bg-[var(--pm-surface-high)] rounded-full overflow-hidden">
              <div 
                className="h-full bg-blue-500 transition-all duration-1000 ease-out"
                style={{ width: `${metrics.score}%` }}
              />
            </div>
          </div>
        </div>
      </div>

      <div className="p-6 md:p-8 bg-[var(--pm-surface)]">
        <div className="space-y-3">
          <AnimatePresence>
            {pendingChecks.map(check => (
              <motion.div 
                key={check.id}
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="flex items-center gap-4 py-2"
              >
                <div className="text-[var(--pm-text-tertiary)]">
                  <Circle className="w-5 h-5" />
                </div>
                <div className="text-sm font-medium text-[var(--pm-text)]">
                  {check.label}
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}
