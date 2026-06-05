import React, { useEffect, useState, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Clock, AlertTriangle, Play, Pause, Users } from 'lucide-react';
import type { Workspace, Member } from '../../core/types';
import type { WorkSession } from '../../core/types/execution';
import { workSessionService } from '../../services/workSessionService';
import { TaskTimerUI } from '../task/TaskTimerUI';
import { supabase } from '../../lib/supabase';

interface WorkSessionManagerProps {
  workspace: any;
  currentUser: any;
  notify: (msg: string, type: 'success' | 'error' | 'warning' | 'info') => void;
}

export function WorkSessionManager({ workspace, currentUser, notify }: WorkSessionManagerProps) {
  const [activeSession, setActiveSession] = useState<WorkSession | null>(null);
  
  const [showEndPrompt, setShowEndPrompt] = useState(false);
  const [showHeartbeatPrompt, setShowHeartbeatPrompt] = useState(false);
  const [showMeetingPrompt, setShowMeetingPrompt] = useState(false);
  const [activeMeetingTitle, setActiveMeetingTitle] = useState('');

  const intervalRef = useRef<number | null>(null);
  const autoPauseTimeoutRef = useRef<number | null>(null);

  const fetchSession = async () => {
    const session = await workSessionService.getActiveSession(currentUser.id);
    setActiveSession(session);
  };

  useEffect(() => {
    fetchSession();
    const id = window.setInterval(fetchSession, 60000); // Check every minute
    return () => window.clearInterval(id);
  }, [currentUser.id]);

  useEffect(() => {
    if (!activeSession || activeSession.status !== 'active') return;

    const checkStatus = async () => {
      const now = new Date();
      
      // 1. Check if end of day reached
      const currentMin = now.getHours() * 60 + now.getMinutes();
      const [endH, endM] = workspace.work_end.split(':').map(Number);
      const endMin = endH * 60 + endM;

      if (currentMin === endMin && !showEndPrompt) {
        setShowEndPrompt(true);
        notify('Your working hours have ended.', 'warning');

        autoPauseTimeoutRef.current = window.setTimeout(async () => {
          if (activeSession.id) {
            await workSessionService.pauseSession(activeSession.id, 'Auto-paused at end of day', workspace.id, currentUser.id);
            setShowEndPrompt(false);
            fetchSession();
            notify('Session auto-paused.', 'info');
          }
        }, 5 * 60 * 1000);
      }

      // 2. Check Session Heartbeat ( > 2 hours active )
      const started = new Date(activeSession.started_at).getTime();
      const durationMins = (now.getTime() - started) / 60000;
      if (durationMins > 120 && !showHeartbeatPrompt && !showEndPrompt) {
        setShowHeartbeatPrompt(true);
        notify('You have been working on this task for over 2 hours.', 'info');

        autoPauseTimeoutRef.current = window.setTimeout(async () => {
          if (activeSession.id) {
            await workSessionService.pauseSession(activeSession.id, 'auto_pause_timeout', workspace.id, currentUser.id);
            setShowHeartbeatPrompt(false);
            fetchSession();
            notify('Session auto-paused due to inactivity.', 'info');
          }
        }, 10 * 60 * 1000);
      }

      // 3. Meeting Awareness
      if (!showMeetingPrompt && !showHeartbeatPrompt && !showEndPrompt) {
        const todayStr = now.toISOString().split('T')[0];
        const currentTimeStr = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}:00`;
        
        // Find if user is in a meeting right now
        const { data: meetings } = await supabase
          .from('meetings')
          .select('title, meeting_attendees(user_id)')
          .eq('date', todayStr)
          .lte('time', currentTimeStr); // Assuming standard 1 hr meetings for simple overlapping check or if 'status' = 'in_progress'
        
        if (meetings) {
          // Find a meeting that is roughly active (e.g. within last 60 mins)
          const { data: activeMeetings } = await supabase
            .from('meetings')
            .select('id, title')
            .eq('date', todayStr)
            .eq('status', 'in_progress');

          if (activeMeetings && activeMeetings.length > 0) {
             const meetingId = activeMeetings[0].id;
             const { data: attendees } = await supabase.from('meeting_attendees').select('user_id').eq('meeting_id', meetingId);
             if (attendees && attendees.some(a => a.user_id === currentUser.id)) {
                setActiveMeetingTitle(activeMeetings[0].title);
                setShowMeetingPrompt(true);
             }
          }
        }
      }
    };

    intervalRef.current = window.setInterval(checkStatus, 60000);
    return () => {
      if (intervalRef.current) window.clearInterval(intervalRef.current);
    };
  }, [activeSession, workspace, showEndPrompt, showHeartbeatPrompt, showMeetingPrompt]);

  const handleContinue = () => {
    setShowEndPrompt(false);
    setShowHeartbeatPrompt(false);
    setShowMeetingPrompt(false);
    if (autoPauseTimeoutRef.current) window.clearTimeout(autoPauseTimeoutRef.current);
  };

  const handlePause = async (reason: string) => {
    if (activeSession) {
      await workSessionService.pauseSession(activeSession.id, reason, workspace.id, currentUser.id);
      setShowEndPrompt(false);
      setShowHeartbeatPrompt(false);
      setShowMeetingPrompt(false);
      if (autoPauseTimeoutRef.current) window.clearTimeout(autoPauseTimeoutRef.current);
      fetchSession();
    }
  };

  return (
    <AnimatePresence>
      {(showEndPrompt || showHeartbeatPrompt || showMeetingPrompt) && (
        <div className="fixed bottom-4 right-4 z-[9999]">
          <motion.div 
            initial={{ opacity: 0, y: 50 }} 
            animate={{ opacity: 1, y: 0 }} 
            exit={{ opacity: 0, y: 50 }}
            className={`bg-surface border border-l-4 p-4 rounded shadow-xl flex flex-col gap-3 max-w-sm ${showMeetingPrompt ? 'border-purple-500 border-l-purple-500' : 'border-signal-warning border-l-signal-warning'}`}
          >
            <div className={`flex items-center gap-2 font-semibold text-sm ${showMeetingPrompt ? 'text-purple-400' : 'text-signal-warning'}`}>
              {showMeetingPrompt ? <Users className="w-4 h-4" /> : <AlertTriangle className="w-4 h-4" />}
              {showEndPrompt && 'End of Working Hours'}
              {showHeartbeatPrompt && 'Still working on this task?'}
              {showMeetingPrompt && 'Meeting In Progress'}
            </div>
            <p className="text-xs text-text-secondary">
              {showEndPrompt && 'Your official working hours have ended. Would you like to pause your active task timer, or continue working?'}
              {showHeartbeatPrompt && 'Your timer has been running continuously for over 2 hours. If you are away, it will auto-pause in 10 minutes.'}
              {showMeetingPrompt && `You have an active meeting (${activeMeetingTitle}). Consider pausing your task timer.`}
            </p>
            <div className="flex gap-2 justify-end mt-2">
              <button 
                onClick={() => handlePause(showEndPrompt ? 'End of working day' : showMeetingPrompt ? 'Attending meeting' : 'auto_pause_timeout')} 
                className="px-3 py-1.5 bg-surface-2 hover:bg-surface-3 border border-border text-xs font-medium rounded flex items-center gap-1"
              >
                <Pause className="w-3 h-3" /> Pause Timer
              </button>
              <button onClick={handleContinue} className="px-3 py-1.5 bg-purple-600 hover:bg-purple-500 text-white text-xs font-medium rounded flex items-center gap-1">
                <Play className="w-3 h-3" /> Continue Working
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
