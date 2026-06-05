import React, { useState, useEffect, useRef } from 'react';
import { Play, Pause, Square, Clock } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import type { Task, WorkSession } from '../../core/types/execution';
import type { Workspace, Member } from '../../core/types';
import { workSessionService } from '../../services/workSessionService';
import { ManualTimeEntryModal } from './ManualTimeEntryModal';
import { useDashboard } from '../../context/DashboardContext';

interface TaskTimerUIProps {
  task: Task;
  workspace: any;
  currentUser: any;
  onRefreshTasks?: () => void;
  isCompact?: boolean;
}

export function TaskTimerUI({ task, workspace, currentUser, onRefreshTasks, isCompact }: TaskTimerUIProps) {
  const [session, setSession] = useState<WorkSession | null>(null);
  const [elapsedMs, setElapsedMs] = useState(0);
  const [isPauseModalOpen, setIsPauseModalOpen] = useState(false);
  const [pauseReason, setPauseReason] = useState('');
  const [loading, setLoading] = useState(false);
  const [isManualModalOpen, setIsManualModalOpen] = useState(false);
  const timerRef = useRef<number | null>(null);
  const { notify } = useDashboard();

  const fetchSession = async () => {
    const active = await workSessionService.getActiveSession(currentUser.id);
    if (active && active.task_id === task.id) {
      setSession(active);
    } else {
      setSession(null);
    }
  };

  useEffect(() => {
    fetchSession();
  }, [task.id, currentUser.id]);

  useEffect(() => {
    if (session && session.status === 'active') {
      const start = new Date(session.started_at).getTime();
      const updateTimer = () => {
        setElapsedMs(Date.now() - start);
      };
      updateTimer();
      timerRef.current = window.setInterval(updateTimer, 1000);
    } else if (session && session.status === 'paused') {
      // Need to calculate elapsed minus pauses
      // For simplicity in UI ticking, we'll just show the duration in minutes + static seconds
      setElapsedMs(session.duration_minutes * 60000);
      if (timerRef.current) window.clearInterval(timerRef.current);
    } else {
      setElapsedMs(0);
      if (timerRef.current) window.clearInterval(timerRef.current);
    }

    return () => {
      if (timerRef.current) window.clearInterval(timerRef.current);
    };
  }, [session]);

  const handleStart = async () => {
    setLoading(true);
    await workSessionService.startSession(workspace, task.id, currentUser.id);
    await fetchSession();
    if (onRefreshTasks) onRefreshTasks();
    setLoading(false);
  };

  const handlePause = () => {
    setPauseReason('');
    setIsPauseModalOpen(true);
  };

  const confirmPause = async () => {
    if (!pauseReason.trim() || !session) return;
    setLoading(true);
    await workSessionService.pauseSession(session.id, pauseReason, workspace.id, currentUser.id);
    setIsPauseModalOpen(false);
    await fetchSession();
    setLoading(false);
  };

  const handleResume = async () => {
    if (!session) return;
    setLoading(true);
    await workSessionService.resumeSession(session.id, workspace.id, currentUser.id);
    await fetchSession();
    setLoading(false);
  };

  const handleStop = async () => {
    if (!session) return;
    setLoading(true);
    await workSessionService.stopSession(session.id, workspace.id, currentUser.id);
    await fetchSession();
    if (onRefreshTasks) onRefreshTasks();
    setLoading(false);
  };

  const formatTime = (ms: number) => {
    const totalSeconds = Math.floor(ms / 1000);
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;
    
    if (hours > 0) return `${hours}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
    return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  };

  if (!session && isCompact) {
    return (
      <button 
        onClick={(e) => { e.stopPropagation(); handleStart(); }}
        disabled={loading}
        className="p-1 hover:bg-surface-3 rounded border border-transparent hover:border-border transition-colors group/timer"
        title="Start Timer"
      >
        <Play className="w-3 h-3 text-text-quaternary group-hover/timer:text-emerald-400" />
      </button>
    );
  }

  if (!session) {
    return (
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
        <button 
          onClick={handleStart}
          disabled={loading}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white text-[10px] font-mono tracking-wide uppercase rounded-sm border border-emerald-500/50 transition-colors"
        >
          <Play className="w-3 h-3" />
          Start Work
        </button>
        {!isCompact && (
          <button 
            onClick={() => setIsManualModalOpen(true)}
            disabled={loading}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-surface-2 hover:bg-surface-3 text-text-secondary text-[10px] font-mono tracking-wide uppercase rounded-sm border border-border transition-colors"
          >
            Log Manual Time
          </button>
        )}
        <ManualTimeEntryModal
          task={task}
          workspaceId={workspace?.id}
          userId={currentUser?.id}
          isOpen={isManualModalOpen}
          onClose={() => setIsManualModalOpen(false)}
          onSuccess={() => { if (onRefreshTasks) onRefreshTasks(); }}
          notify={notify}
        />
      </div>
    );
  }

  return (
    <div className={`flex flex-wrap items-center gap-2 ${isCompact ? '' : 'bg-surface-2 p-1.5 rounded-sm border border-border'}`} onClick={e => e.stopPropagation()}>
      <div className="flex items-center gap-1.5 px-2 font-mono text-xs text-text-primary">
        <Clock className={`w-3.5 h-3.5 ${session.status === 'active' ? 'text-emerald-400 animate-pulse' : 'text-amber-400'}`} />
        {formatTime(elapsedMs)}
      </div>

      {session.status === 'active' ? (
        <button onClick={handlePause} disabled={loading} className="p-1.5 hover:bg-surface-3 rounded text-amber-400 transition-colors" title="Pause">
          <Pause className="w-3.5 h-3.5" />
        </button>
      ) : (
        <button onClick={handleResume} disabled={loading} className="p-1.5 hover:bg-surface-3 rounded text-emerald-400 transition-colors" title="Resume">
          <Play className="w-3.5 h-3.5" />
        </button>
      )}

      <button onClick={handleStop} disabled={loading} className="p-1.5 hover:bg-surface-3 rounded text-rose-400 transition-colors" title="Stop">
        <Square className="w-3.5 h-3.5" />
      </button>

      {session.session_type !== 'normal' && !isCompact && (
        <span className="ml-2 text-[9px] font-mono uppercase bg-purple-500/20 text-purple-300 px-1.5 py-0.5 rounded-sm">
          {session.session_type}
        </span>
      )}

      <AnimatePresence>
        {isPauseModalOpen && (
          <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setIsPauseModalOpen(false)} className="absolute inset-0 bg-bg backdrop-blur-sm" />
            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }} className="relative bg-surface border border-border w-full max-w-sm p-6 rounded-sm">
              <h3 className="text-sm font-sans tracking-tight uppercase tracking-wide text-text-primary mb-2">Pause Session</h3>
              <p className="text-[10px] text-text-tertiary mb-4">Please provide a reason for pausing your work.</p>
              
              <div className="space-y-2 mb-4">
                {['Lunch / Meal Break', 'Meeting', 'Waiting for clarification', 'Personal break', 'Technical interruption'].map(r => (
                  <label key={r} className="flex items-center gap-2 text-xs text-text-secondary cursor-pointer">
                    <input type="radio" name="pause_reason" checked={pauseReason === r} onChange={() => setPauseReason(r)} className="accent-amber-500" />
                    {r}
                  </label>
                ))}
                <label className="flex items-center gap-2 text-xs text-text-secondary cursor-pointer mt-2">
                  <input type="radio" name="pause_reason" checked={!['Lunch / Meal Break', 'Meeting', 'Waiting for clarification', 'Personal break', 'Technical interruption'].includes(pauseReason) && pauseReason !== ''} onChange={() => setPauseReason('Other')} className="accent-amber-500" />
                  Other
                </label>
                {!['Lunch / Meal Break', 'Meeting', 'Waiting for clarification', 'Personal break', 'Technical interruption'].includes(pauseReason) && pauseReason !== '' && (
                  <input type="text" value={pauseReason === 'Other' ? '' : pauseReason} onChange={e => setPauseReason(e.target.value)} placeholder="Type reason..." className="w-full mt-2 bg-bg border border-border h-8 px-2 text-xs text-text-primary focus:border-amber-500/50 outline-none" autoFocus />
                )}
              </div>

              <div className="flex justify-end gap-2">
                <button onClick={() => setIsPauseModalOpen(false)} className="px-3 py-1.5 border border-border hover:bg-surface-3 text-[10px] font-mono uppercase rounded-sm">Cancel</button>
                <button onClick={confirmPause} disabled={!pauseReason.trim() || loading} className="px-3 py-1.5 bg-amber-600 hover:bg-amber-500 text-white text-[10px] font-mono uppercase rounded-sm disabled:opacity-50">Pause Timer</button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
