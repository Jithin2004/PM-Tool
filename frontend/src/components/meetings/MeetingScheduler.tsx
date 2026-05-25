import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Calendar, Clock, Users, X, Plus, Check, Video } from 'lucide-react';
import type { Meeting, MeetingType, User } from '../../types';
import { MEETING_TYPES } from '../../constants/product';

interface MeetingSchedulerProps {
  workspaceId: string;
  projectId?: string;
  users: User[];
  onCreateMeeting: (meeting: Omit<Meeting, 'id' | 'created_at' | 'updated_at'>) => Promise<void>;
  notify: (msg: string, type: 'success' | 'error' | 'warning' | 'info') => void;
}

export function MeetingScheduler({ workspaceId, projectId, users, onCreateMeeting, notify }: MeetingSchedulerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [meetingType, setMeetingType] = useState<MeetingType>('sync');
  const [startTime, setStartTime] = useState('');
  const [endTime, setEndTime] = useState('');
  const [selectedAttendees, setSelectedAttendees] = useState<string[]>([]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !startTime || !endTime) {
      notify('Title, start time, and end time are required.', 'error');
      return;
    }
    if (new Date(endTime) <= new Date(startTime)) {
      notify('End time must be after start time.', 'error');
      return;
    }
    try {
      await onCreateMeeting({
        workspace_id: workspaceId,
        project_id: projectId || null,
        title: title.trim(),
        description: description.trim() || null,
        meeting_type: meetingType,
        start_time: startTime,
        end_time: endTime,
        organizer_id: null
      });
      notify('Meeting scheduled.', 'success');
      setTitle(''); setDescription(''); setStartTime(''); setEndTime(''); setSelectedAttendees([]);
      setIsOpen(false);
    } catch (err) {
      notify('Failed to schedule meeting.', 'error');
    }
  };

  const toggleAttendee = (userId: string) => {
    setSelectedAttendees(prev => prev.includes(userId) ? prev.filter(id => id !== userId) : [...prev, userId]);
  };

  const typeIcon = useMemo(() => {
    switch (meetingType) {
      case 'standup': return <Clock className="w-3.5 h-3.5" />;
      case 'planning': return <Calendar className="w-3.5 h-3.5" />;
      case 'review': return <Check className="w-3.5 h-3.5" />;
      case 'retrospective': return <Video className="w-3.5 h-3.5" />;
      default: return <Users className="w-3.5 h-3.5" />;
    }
  }, [meetingType]);

  return (
    <>
      <button
        onClick={() => setIsOpen(true)}
        className="flex items-center gap-2 px-3 py-1.5 bg-white/5 border border-border text-text-secondary text-[10px] font-mono uppercase tracking-wider rounded-sm hover:bg-white/10 hover:text-text-primary transition-all cursor-pointer"
      >
        <Plus className="w-3 h-3" /> Schedule Meeting
      </button>

      <AnimatePresence>
        {isOpen && (
          <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setIsOpen(false)} className="absolute inset-0 bg-bg backdrop-blur-sm" />
            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }} className="relative bg-surface border border-border w-full max-w-lg p-6 rounded-sm">
              <div className="flex justify-between items-center mb-6">
                <h3 className="text-sm font-sans tracking-tight uppercase tracking-wide text-text-primary">Schedule Meeting</h3>
                <button onClick={() => setIsOpen(false)} className="p-1.5 border border-border hover:bg-white/5 transition-colors cursor-pointer"><X className="w-3.5 h-3.5 text-text-tertiary" /></button>
              </div>

              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="block text-[10px] font-mono uppercase text-text-tertiary mb-1.5">Title</label>
                  <input value={title} onChange={e => setTitle(e.target.value)} className="w-full bg-bg border border-border h-10 px-3 text-sm font-mono focus:border-white/30 outline-none" placeholder="Meeting title..." />
                </div>

                <div>
                  <label className="block text-[10px] font-mono uppercase text-text-tertiary mb-1.5">Description</label>
                  <textarea value={description} onChange={e => setDescription(e.target.value)} rows={2} className="w-full bg-bg border border-border px-3 py-2 text-sm font-mono focus:border-white/30 outline-none" placeholder="Agenda..." />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[10px] font-mono uppercase text-text-tertiary mb-1.5">Type</label>
                    <select value={meetingType} onChange={e => setMeetingType(e.target.value as MeetingType)} className="w-full bg-bg border border-border h-10 px-3 text-xs font-mono focus:border-white/30 outline-none">
                      {MEETING_TYPES.map(t => <option key={t} value={t}>{t.toUpperCase()}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-[10px] font-mono uppercase text-text-tertiary mb-1.5 flex items-center gap-1">{typeIcon} Type</label>
                    <div className="h-10 flex items-center px-3 text-xs font-mono text-text-tertiary capitalize">{meetingType}</div>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[10px] font-mono uppercase text-text-tertiary mb-1.5">Start Time</label>
                    <input type="datetime-local" value={startTime} onChange={e => setStartTime(e.target.value)} className="w-full bg-bg border border-border h-10 px-3 text-xs font-mono focus:border-white/30 outline-none" />
                  </div>
                  <div>
                    <label className="block text-[10px] font-mono uppercase text-text-tertiary mb-1.5">End Time</label>
                    <input type="datetime-local" value={endTime} onChange={e => setEndTime(e.target.value)} className="w-full bg-bg border border-border h-10 px-3 text-xs font-mono focus:border-white/30 outline-none" />
                  </div>
                </div>

                <div>
                  <label className="block text-[10px] font-mono uppercase text-text-tertiary mb-1.5">Attendees</label>
                  <div className="max-h-32 overflow-y-auto bg-bg border border-border p-2 space-y-1">
                    {users.map(u => (
                      <label key={u.id} className="flex items-center gap-2 text-xs font-mono text-text-secondary cursor-pointer hover:text-text-primary">
                        <input type="checkbox" checked={selectedAttendees.includes(u.id)} onChange={() => toggleAttendee(u.id)} className="accent-cyan-500" />
                        {u.full_name || u.email}
                      </label>
                    ))}
                  </div>
                </div>

                <button type="submit" className="w-full bg-white text-black h-10 font-semibold uppercase tracking-wide text-[10px] hover:bg-neutral-200 transition-all cursor-pointer">
                  Schedule
                </button>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </>
  );
}
