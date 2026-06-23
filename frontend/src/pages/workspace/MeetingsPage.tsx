import React, { useState, useEffect } from 'react';
import { Calendar, Users, Clock, PlusCircle, Video } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useWorkspace } from '../../context/WorkspaceContext';
import { useAuth } from '../../context/AuthContext';
import { hasCapability } from '../../core/auth/permissions';
import { Icon } from '../../components/ui/Icon';
import { MeetingCreationModal } from './MeetingCreationModal';
import { MeetingDetailsModal } from './MeetingDetailsModal';
import { PremiumEmptyState } from '../../components/common/PremiumEmptyState';
import { PremiumLoader } from '../../components/common/PremiumLoader';

export default function MeetingsPage() {
  const { workspace } = useWorkspace();
  const { profile } = useAuth();
  const [meetings, setMeetings] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'upcoming' | 'completed' | 'my'>('upcoming');
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [selectedMeeting, setSelectedMeeting] = useState<any | null>(null);

  const fetchMeetings = async () => {
    if (!workspace?.id) {
      setLoading(false);
      return;
    }
    setLoading(true);
    
    let query = supabase.from('meetings').select('*, meeting_attendees(user_id, attended)').eq('workspace_id', workspace.id);
    
    if (filter === 'upcoming') {
      query = query.in('status', ['scheduled', 'in_progress']);
    } else if (filter === 'completed') {
      query = query.eq('status', 'completed');
    }
    
    try {
      const { data, error } = await query.order('date', { ascending: filter === 'upcoming' });
      
      if (!error && data) {
        if (filter === 'my') {
          const myData = data.filter(m => m.organizer_id === profile?.id || m.meeting_attendees?.some((a: any) => a.user_id === profile?.id));
          setMeetings(myData);
        } else {
          setMeetings(data);
        }
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMeetings();
  }, [workspace?.id, filter, profile?.id]);

  const canCreateMeetings = hasCapability(profile?.role, 'project.update') || hasCapability(profile?.role, 'people.manage') || hasCapability(profile?.role, 'finance.manage');

  return (
    <div className="flex-1 flex flex-col h-full bg-transparent text-white overflow-hidden premium-fade-in-up">
      <div className="flex-none p-6 border-b border-[var(--border-soft)]">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 sm:gap-0">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-white">Meetings Hub</h1>
            <p className="text-xs text-[var(--text-secondary)] mt-1">Coordinate, track, and execute structured discussions.</p>
          </div>
          {canCreateMeetings && (
            <button 
              onClick={() => setIsCreateModalOpen(true)}
              className="btn-premium-primary px-4 py-2.5 rounded-xl text-xs font-bold uppercase tracking-wider flex items-center gap-2"
            >
              <PlusCircle className="w-4 h-4" />
              Schedule Meeting
            </button>
          )}
        </div>
        
        <div className="mt-6 flex premium-segmented-control max-w-sm">
          {['upcoming', 'completed', 'my'].map(f => (
            <button
              key={f}
              onClick={() => setFilter(f as any)}
              className={`flex-1 py-2 text-xs font-mono uppercase tracking-wider premium-segmented-control-btn ${filter === f ? 'active' : ''}`}
            >
              {f === 'my' ? 'My Meetings' : f}
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 p-6 overflow-y-auto scrollbar-premium">
        {loading ? (
          <PremiumLoader type="card" count={3} label="Loading scheduled discussions..." />
        ) : meetings.length === 0 ? (
          <div className="max-w-md mx-auto mt-12">
            <PremiumEmptyState
              icon={Calendar}
              title={`No ${filter} meetings`}
              description={`There are currently no ${filter} meetings registered in this workspace.`}
              actionLabel={canCreateMeetings ? "Schedule Meeting" : undefined}
              onAction={canCreateMeetings ? () => setIsCreateModalOpen(true) : undefined}
              accentColor="#818cf8"
            />
          </div>
        ) : filter === 'upcoming' ? (
          /* Premium Vertical Timeline Style */
          <div className="relative border-l border-[var(--border-soft)] pl-8 ml-4 mr-4 space-y-6 max-w-4xl">
            {meetings.map((meeting) => (
              <div key={meeting.id} className="relative group">
                {/* Timeline node/point */}
                <div className="absolute -left-[41px] top-1.5 w-5 h-5 rounded-full bg-[#050712] border border-indigo-500/40 flex items-center justify-center shadow-[0_0_12px_rgba(129,140,248,0.2)] group-hover:border-indigo-400 group-hover:scale-110 transition-all duration-200">
                  <span className="w-1.5 h-1.5 rounded-full bg-indigo-400 animate-pulse" />
                </div>
                
                {/* Timeline Card */}
                <div 
                  onClick={() => setSelectedMeeting(meeting)}
                  className="premium-panel premium-hover-lift rounded-2xl p-5 cursor-pointer transition-all duration-200 border border-[var(--border-soft)]"
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-3">
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] uppercase tracking-widest font-mono px-2 py-0.5 bg-indigo-500/10 text-indigo-300 rounded border border-indigo-500/15">
                        {meeting.meeting_type}
                      </span>
                      <span className="text-[10px] uppercase tracking-widest px-2 py-0.5 bg-cyan-500/10 text-cyan-400 rounded border border-cyan-500/15">
                        {meeting.status}
                      </span>
                    </div>
                    <div className="text-[11px] font-mono text-[var(--text-secondary)] flex items-center gap-1.5">
                      <Clock className="w-3.5 h-3.5 text-indigo-400/50" />
                      {new Date(meeting.date).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })} at {meeting.time}
                    </div>
                  </div>
                  
                  <h3 className="font-semibold text-lg text-white group-hover:text-indigo-400 transition-colors mb-2">{meeting.title}</h3>
                  {meeting.agenda && (
                    <p className="text-xs text-[var(--text-secondary)] mb-4 line-clamp-2 leading-relaxed">{meeting.agenda}</p>
                  )}
                  
                  <div className="flex items-center justify-between text-[11px] font-mono text-[var(--text-secondary)] pt-3 border-t border-[var(--border-soft)]">
                    <div className="flex items-center gap-1.5">
                      <Video className="w-3.5 h-3.5 text-indigo-400/50" />
                      <span>Remote Space</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <Users className="w-3.5 h-3.5 text-indigo-400/50" />
                      <span>{meeting.meeting_attendees?.length || 0} participants</span>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          /* Standard Cards Grid for Completed/My meetings */
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 max-w-6xl">
            {meetings.map(meeting => (
              <div 
                key={meeting.id} 
                onClick={() => setSelectedMeeting(meeting)}
                className="premium-panel premium-hover-lift rounded-2xl p-5 border border-[var(--border-soft)] cursor-pointer transition-all duration-200"
              >
                <div className="flex items-start justify-between mb-4">
                  <span className="text-[10px] uppercase tracking-widest font-mono px-2 py-0.5 bg-indigo-500/10 text-indigo-300 rounded border border-indigo-500/15">
                    {meeting.meeting_type}
                  </span>
                  <span className={`text-[10px] uppercase tracking-widest px-2 py-0.5 rounded border ${
                    meeting.status === 'completed' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/15' : 'bg-indigo-500/10 text-indigo-400 border-indigo-500/15'
                  }`}>
                    {meeting.status}
                  </span>
                </div>
                <h3 className="font-semibold text-base text-white group-hover:text-indigo-400 transition-colors mb-3">{meeting.title}</h3>
                <div className="space-y-2 text-[11px] font-mono text-[var(--text-secondary)]">
                  <div className="flex items-center gap-2">
                    <Calendar className="w-3.5 h-3.5 text-indigo-400/50" />
                    {new Date(meeting.date).toLocaleDateString()} at {meeting.time}
                  </div>
                  <div className="flex items-center gap-2">
                    <Users className="w-3.5 h-3.5 text-indigo-400/50" />
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




