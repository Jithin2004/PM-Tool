import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { useWorkspace } from '../../context/WorkspaceContext';
import { useAuth } from '../../context/AuthContext';
import { hasCapability } from '../../core/auth/permissions';
import { Icon } from '../../components/ui/Icon';
import { MeetingCreationModal } from './MeetingCreationModal';
import { MeetingDetailsModal } from './MeetingDetailsModal';

export default function MeetingsPage() {
  const { workspace } = useWorkspace();
  const { profile } = useAuth();
  const [meetings, setMeetings] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'upcoming' | 'completed' | 'my'>('upcoming');
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [selectedMeeting, setSelectedMeeting] = useState<any | null>(null);

  const fetchMeetings = async () => {
    if (!workspace?.id) return;
    setLoading(true);
    
    // In a real query, we'd filter by user access, but for Sprint 2 scaffolding, we'll fetch all workspace meetings
    // and filter them down based on capability in the UI or a strict RLS policy.
    let query = supabase.from('meetings').select('*, meeting_attendees(user_id, attended)').eq('workspace_id', workspace.id);
    
    if (filter === 'upcoming') {
      query = query.in('status', ['scheduled', 'in_progress']);
    } else if (filter === 'completed') {
      query = query.eq('status', 'completed');
    } else if (filter === 'my') {
      // Need to filter where I am organizer OR I am in attendees. Supabase complex query or local filter.
      // We will do local filter for simplicity in this sprint setup.
    }
    
    const { data, error } = await query.order('date', { ascending: filter === 'upcoming' });
    
    if (!error && data) {
      if (filter === 'my') {
        const myData = data.filter(m => m.organizer_id === profile?.id || m.meeting_attendees?.some((a: any) => a.user_id === profile?.id));
        setMeetings(myData);
      } else {
        setMeetings(data);
      }
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchMeetings();
  }, [workspace?.id, filter, profile?.id]);

  const canCreateMeetings = hasCapability(profile?.role, 'manage_projects') || hasCapability(profile?.role, 'manage_employees') || hasCapability(profile?.role, 'manage_finance');

  return (
    <div className="flex-1 flex flex-col h-full bg-[#111827] text-white overflow-hidden">
      <div className="flex-none p-6 border-b border-white/10">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 sm:gap-0">
          <div>
            <h1 className="text-2xl font-bold">Meetings Hub</h1>
            <p className="text-sm text-gray-400 mt-1">Coordinate, track, and execute structured discussions.</p>
          </div>
          {canCreateMeetings && (
            <button 
              onClick={() => setIsCreateModalOpen(true)}
              className="bg-indigo-500 hover:bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-2"
            >
              <Icon name="add" size={18} />
              Schedule Meeting
            </button>
          )}
        </div>
        
        <div className="mt-6 flex gap-2">
          {['upcoming', 'completed', 'my'].map(f => (
            <button
              key={f}
              onClick={() => setFilter(f as any)}
              className={`px-4 py-2 rounded-lg text-sm font-medium capitalize transition-colors ${filter === f ? 'bg-white/10 text-white' : 'text-gray-400 hover:text-white hover:bg-white/5'}`}
            >
              {f === 'my' ? 'My Meetings' : f}
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 p-6 overflow-y-auto">
        {loading ? (
          <div className="flex items-center justify-center h-full">
            <div className="animate-spin w-8 h-8 border-2 border-indigo-500 border-t-transparent rounded-full" />
          </div>
        ) : meetings.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-gray-400">
            <Icon name="event" size={48} className="mb-4 opacity-50" />
            <p>Schedule your first meeting to begin tracking discussions.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {meetings.map(meeting => (
              <div 
                key={meeting.id} 
                onClick={() => setSelectedMeeting(meeting)}
                className="bg-white/5 border border-white/10 rounded-xl p-5 hover:bg-white/10 transition-colors cursor-pointer"
              >
                <div className="flex items-start justify-between mb-3">
                  <span className="text-[10px] uppercase tracking-wider font-mono px-2 py-1 bg-indigo-500/20 text-indigo-300 rounded">
                    {meeting.meeting_type}
                  </span>
                  <span className={`text-[10px] uppercase tracking-wider px-2 py-1 rounded ${meeting.status === 'completed' ? 'bg-green-500/20 text-green-400' : 'bg-blue-500/20 text-blue-400'}`}>
                    {meeting.status}
                  </span>
                </div>
                <h3 className="font-semibold text-lg mb-2">{meeting.title}</h3>
                <div className="space-y-2 text-sm text-gray-400">
                  <div className="flex items-center gap-2">
                    <Icon name="calendar_today" size={14} />
                    {new Date(meeting.date).toLocaleDateString()} at {meeting.time}
                  </div>
                  <div className="flex items-center gap-2">
                    <Icon name="group" size={14} />
                    {meeting.meeting_attendees?.length || 0} participants
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
      
      {isCreateModalOpen && (
        <MeetingCreationModal 
          onClose={() => setIsCreateModalOpen(false)} 
          onSuccess={() => { setIsCreateModalOpen(false); fetchMeetings(); }} 
        />
      )}

      {selectedMeeting && (
        <MeetingDetailsModal 
          meeting={selectedMeeting} 
          onClose={() => setSelectedMeeting(null)}
          onUpdate={fetchMeetings}
        />
      )}
    </div>
  );
}
