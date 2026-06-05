import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { useWorkspace } from '../../context/WorkspaceContext';
import { useDashboard } from '../../context/DashboardContext';
import { Icon } from '../../components/ui/Icon';
import { activityLogService } from '../../services/activityLogService';
import { sendNotification } from '../../services/notificationService';
import { hasCapability } from '../../core/auth/permissions';
import { useAuth } from '../../context/AuthContext';

export function MeetingCreationModal({ onClose, onSuccess }: { onClose: () => void, onSuccess: () => void }) {
  const { workspace } = useWorkspace();
  const { profiles } = useDashboard();
  const { profile } = useAuth();
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    title: '',
    meeting_type: 'Standup',
    date: new Date().toISOString().split('T')[0],
    time: '10:00',
    external_link: '',
    agenda: '',
    participants: [] as string[]
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!workspace?.id) return;
    setLoading(true);
    
    try {
      const { data: userResp } = await supabase.auth.getUser();
      const organizer_id = userResp.user?.id;

      const { data: meeting, error } = await supabase.from('meetings').insert({
        workspace_id: workspace.id,
        title: formData.title,
        meeting_type: formData.meeting_type,
        date: formData.date,
        time: formData.time,
        external_link: formData.external_link,
        agenda: formData.agenda,
        organizer_id
      }).select().single();

      if (error) throw error;

      if (formData.participants.length > 0) {
        const attendees = formData.participants.map(pid => ({
          meeting_id: meeting.id,
          user_id: pid
        }));
        await supabase.from('meeting_attendees').insert(attendees);
      }

      await activityLogService.appendLog({
        workspace_id: workspace.id,
        action: 'meeting_created',
        metadata: { meeting_id: meeting.id, title: meeting.title }
      });

      // Notify attendees
      for (const pid of formData.participants) {
        await sendNotification(
          workspace.id,
          'system',
          `New Meeting: ${meeting.title}`,
          `You have been invited to a meeting on ${meeting.date} at ${meeting.time}`,
          pid,
          { type: 'meeting_invite', entity_id: meeting.id, deep_link: '/workspace/meetings' }
        );
      }

      onSuccess();
    } catch (err) {
      console.error("Error creating meeting", err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="bg-[#1c1d1f] p-6 rounded-xl shadow-2xl max-w-lg w-full border border-white/10 text-white max-h-[90vh] flex flex-col">
        <div className="flex justify-between items-center mb-4 flex-none">
          <h2 className="text-xl font-semibold tracking-tight">Schedule Meeting</h2>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-white/5 transition-colors text-white/50 hover:text-white">
            <Icon name="close" size={20} />
          </button>
        </div>
        
        <form onSubmit={handleSubmit} className="overflow-y-auto flex-1 pr-2 space-y-4">
          <div>
            <label className="block text-[11px] font-mono uppercase tracking-widest text-gray-400 mb-1">Title</label>
            <input required type="text" value={formData.title} onChange={e => setFormData({...formData, title: e.target.value})} className="w-full bg-black/20 border border-white/10 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-indigo-500" />
          </div>
          <div>
            <label className="block text-[11px] font-mono uppercase tracking-widest text-gray-400 mb-1">Type</label>
            <select value={formData.meeting_type} onChange={e => setFormData({...formData, meeting_type: e.target.value})} className="w-full bg-black/20 border border-white/10 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-indigo-500">
              <option value="Client Meeting">Client Meeting</option>
              <option value="Standup">Standup</option>
              <option value="Sprint Review">Sprint Review</option>
              {(hasCapability(profile?.role, 'manage_employees') || profile?.role === 'super_admin') && (
                <option value="HR Review">HR Review</option>
              )}
              {(hasCapability(profile?.role, 'manage_finance') || profile?.role === 'super_admin') && (
                <option value="Finance Review">Finance Review</option>
              )}
            </select>
          </div>
          <div className="flex gap-4">
            <div className="flex-1">
              <label className="block text-[11px] font-mono uppercase tracking-widest text-gray-400 mb-1">Date</label>
              <input required type="date" value={formData.date} onChange={e => setFormData({...formData, date: e.target.value})} className="w-full bg-black/20 border border-white/10 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-indigo-500" />
            </div>
            <div className="flex-1">
              <label className="block text-[11px] font-mono uppercase tracking-widest text-gray-400 mb-1">Time</label>
              <input required type="time" value={formData.time} onChange={e => setFormData({...formData, time: e.target.value})} className="w-full bg-black/20 border border-white/10 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-indigo-500" />
            </div>
          </div>
          <div>
            <label className="block text-[11px] font-mono uppercase tracking-widest text-gray-400 mb-1">Meeting Link (Optional)</label>
            <input type="url" value={formData.external_link} onChange={e => setFormData({...formData, external_link: e.target.value})} placeholder="https://meet.google.com/..." className="w-full bg-black/20 border border-white/10 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-indigo-500" />
          </div>
          <div>
            <label className="block text-[11px] font-mono uppercase tracking-widest text-gray-400 mb-1">Agenda</label>
            <textarea value={formData.agenda} onChange={e => setFormData({...formData, agenda: e.target.value})} className="w-full bg-black/20 border border-white/10 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-indigo-500 min-h-[80px]" />
          </div>
          <div>
            <label className="block text-[11px] font-mono uppercase tracking-widest text-gray-400 mb-1">Participants</label>
            <div className="bg-black/20 border border-white/10 rounded-lg p-2 max-h-32 overflow-y-auto space-y-1">
              {profiles.map(p => (
                <label key={p.id} className="flex items-center gap-2 p-1 hover:bg-white/5 rounded cursor-pointer">
                  <input 
                    type="checkbox" 
                    checked={formData.participants.includes(p.id)}
                    onChange={(e) => {
                      if (e.target.checked) setFormData(f => ({...f, participants: [...f.participants, p.id]}));
                      else setFormData(f => ({...f, participants: f.participants.filter(id => id !== p.id)}));
                    }}
                    className="accent-indigo-500"
                  />
                  <span className="text-sm">{p.full_name || p.email}</span>
                </label>
              ))}
            </div>
          </div>
          
          <div className="pt-4 border-t border-white/10 flex justify-end gap-3 mt-4">
            <button type="button" onClick={onClose} className="px-4 py-2 rounded-lg text-sm font-medium text-gray-400 hover:text-white">Cancel</button>
            <button type="submit" disabled={loading} className="px-5 py-2 rounded-lg text-sm font-medium bg-indigo-500 hover:bg-indigo-600 disabled:opacity-50 text-white">
              {loading ? 'Scheduling...' : 'Schedule'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
