import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '../../lib/supabase';
import { useWorkspace } from '../../context/WorkspaceContext';
import { useDashboard } from '../../context/DashboardContext';
import { Icon } from '../../components/ui/Icon';
import { activityLogService } from '../../services/activityLogService';
import { activityEventService } from '../../services/activityEventService';
import { hasCapability, hasAuthority } from '../../core/auth/permissions';
import { useAuth } from '../../context/AuthContext';
import { useEscapeKey } from '../../hooks/useEscapeKey';
import { useOperationalData } from '../../context/OperationalDataContext';
import { AsyncUpdateEngine } from '../../core/system/AsyncUpdateEngine';
import { AlertCircle, CheckCircle, Info, Calendar } from 'lucide-react';

export function MeetingCreationModal({ onClose, onSuccess }: { onClose: () => void, onSuccess: () => void }) {
  const { workspace } = useWorkspace();
  const { profiles } = useDashboard();
  const { profile } = useAuth();
  const [loading, setLoading] = useState(false);
  
  useEscapeKey(true, onClose);

  const { raw: { tasks = [], projects = [], workspaceSettingsBlob } } = useOperationalData();
  const decisions = (workspaceSettingsBlob?.operational_decisions as any[]) || [];

  const [formData, setFormData] = useState({
    title: '',
    meeting_type: 'Standup',
    date: new Date().toISOString().split('T')[0],
    time: '10:00',
    external_link: '',
    agenda: '',
    participants: [] as string[]
  });

  const meetingReport = useMemo(() => {
    return AsyncUpdateEngine.generateMeetingReport(
      formData.participants,
      tasks,
      projects,
      decisions
    );
  }, [formData.participants, tasks, projects, decisions]);

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
        await activityEventService.recordActivity({
          workspace_id: workspace.id,
          actor_id: 'system',
          entity_type: 'system',
          entity_id: 'global',
          action_type: 'notification_event',
          metadata: { 
            title: `New Meeting: ${meeting.title}`, 
            message: `You have been invited to a meeting on ${meeting.date} at ${meeting.time}`, 
            target_user: pid,
            type: 'meeting_invite', 
            entity_id: meeting.id, 
            deep_link: '/workspace/meetings' 
          }
        });
      }

      onSuccess();
    } catch (err) {
      console.error("Error creating meeting", err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 modal-overlay-premium">
      <div className="relative modal-premium p-6 rounded-2xl max-w-lg w-full text-white max-h-[90vh] flex flex-col scrollbar-premium animate-in fade-in zoom-in-95 duration-200">
        <div className="flex justify-between items-center mb-4 flex-none">
          <h2 className="text-xl font-semibold tracking-tight text-text-primary">Schedule Meeting</h2>
          <button onClick={onClose} aria-label="Close modal" className="p-2 rounded-lg hover:bg-[var(--surface-hover)] transition-colors text-[var(--text-secondary)] hover:text-white">
            <Icon name="close" size={20} />
          </button>
        </div>
        
        <form onSubmit={handleSubmit} className="overflow-y-auto flex-1 pr-2 space-y-4 scrollbar-premium">
          {/* Async Update & Meeting Replacement Checker */}
          <div className="bg-surface-2/60 border border-[var(--border-soft)] rounded-xl p-4 mb-4">
            <h3 className="text-xs font-bold uppercase tracking-wider text-indigo-400 font-mono-pm mb-3 flex items-center gap-1.5">
              <Info className="w-4 h-4" /> Before you schedule a meeting...
            </h3>
            
            <div className="space-y-2.5 text-xs">
              <div>
                <span className="font-semibold text-text-secondary">Already Known (Recent Progress):</span>
                {meetingReport.completedTasks.length === 0 ? (
                  <div className="text-[10px] text-text-quaternary italic pl-3 mt-0.5">No tasks completed in the last 7 days.</div>
                ) : (
                  <ul className="list-disc pl-6 text-[10px] text-text-tertiary mt-0.5 space-y-0.5">
                    {meetingReport.completedTasks.slice(0, 3).map(t => (
                      <li key={t.id}>Completed: {t.name}</li>
                    ))}
                    {meetingReport.completedTasks.length > 3 && <li>And {meetingReport.completedTasks.length - 3} more...</li>}
                  </ul>
                )}
              </div>

              <div className="grid grid-cols-1 gap-2 pt-2 border-t border-[var(--border-soft)]">
                <div>
                  <span className="font-semibold text-text-secondary">Blocked Items:</span>
                  {meetingReport.blockedTasks.length === 0 ? (
                    <div className="text-[10px] text-text-quaternary italic pl-3 mt-0.5">0 blocked tasks.</div>
                  ) : (
                    <ul className="list-disc pl-6 text-[10px] text-rose-400/80 mt-0.5 space-y-0.5">
                      {meetingReport.blockedTasks.map(t => (
                        <li key={t.id}>Blocked: {t.name}</li>
                      ))}
                    </ul>
                  )}
                </div>

                <div className="mt-1">
                  <span className="font-semibold text-text-secondary">Waiting Items:</span>
                  {meetingReport.waitingTasks.length === 0 ? (
                    <div className="text-[10px] text-text-quaternary italic pl-3 mt-0.5">0 waiting tasks.</div>
                  ) : (
                    <ul className="list-disc pl-6 text-[10px] text-amber-400/80 mt-0.5 space-y-0.5">
                      {meetingReport.waitingTasks.map(t => (
                        <li key={t.id}>Waiting: {t.name}</li>
                      ))}
                    </ul>
                  )}
                </div>

                <div className="mt-1">
                  <span className="font-semibold text-text-secondary">Decisions Needed:</span>
                  {meetingReport.pendingDecisions.length === 0 ? (
                    <div className="text-[10px] text-text-quaternary italic pl-3 mt-0.5">0 pending decisions.</div>
                  ) : (
                    <ul className="list-disc pl-6 text-[10px] text-cyan-400/80 mt-0.5 space-y-0.5">
                      {meetingReport.pendingDecisions.map(d => (
                        <li key={d.id}>Pending decision: {d.title || d.metadata?.decision_title}</li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>

              {/* Action Recommendation */}
              <div className={`mt-3 p-3 rounded-lg border flex gap-2 items-start ${
                meetingReport.shouldBlockMeeting 
                  ? 'bg-rose-950/20 border-rose-500/30 text-rose-200' 
                  : 'bg-emerald-950/20 border-emerald-500/30 text-emerald-200'
              }`}>
                {meetingReport.shouldBlockMeeting ? (
                  <AlertCircle className="w-4 h-4 shrink-0 text-rose-400 mt-0.5" />
                ) : (
                  <CheckCircle className="w-4 h-4 shrink-0 text-emerald-400 mt-0.5" />
                )}
                <div>
                  <div className="font-bold text-[10px] uppercase tracking-wider">
                    {meetingReport.shouldBlockMeeting ? 'Resolve these first' : 'All Clear'}
                  </div>
                  <div className="text-[10px] mt-0.5 leading-relaxed">{meetingReport.suggestion}</div>
                </div>
              </div>
            </div>
          </div>

          <div>
            <label className="block text-[11px] font-mono uppercase tracking-widest text-text-tertiary mb-1">Title</label>
            <input required type="text" value={formData.title} onChange={e => setFormData({...formData, title: e.target.value})} className="w-full input-premium px-3 py-2 text-sm outline-none" />
          </div>
          <div>
            <label className="block text-[11px] font-mono uppercase tracking-widest text-text-tertiary mb-1">Type</label>
            <select value={formData.meeting_type} onChange={e => setFormData({...formData, meeting_type: e.target.value})} className="w-full input-premium px-3 py-2 text-sm outline-none">
              <option value="Client Meeting">Client Meeting</option>
              <option value="Standup">Standup</option>
              <option value="Sprint Review">Sprint Review</option>
              {(hasCapability(profile, 'manage_employees') || hasAuthority(profile, 'admin')) && (
                <option value="hr">Human Resources</option>
              )}
              {(hasCapability(profile, 'manage_finance') || hasAuthority(profile, 'admin')) && (
                <option value="Finance Review">Finance Review</option>
              )}
            </select>
          </div>
          <div className="flex gap-4">
            <div className="flex-1">
              <label className="block text-[11px] font-mono uppercase tracking-widest text-text-tertiary mb-1">Date</label>
              <input required type="date" value={formData.date} onChange={e => setFormData({...formData, date: e.target.value})} className="w-full input-premium px-3 py-2 text-sm outline-none" />
            </div>
            <div className="flex-1">
              <label className="block text-[11px] font-mono uppercase tracking-widest text-text-tertiary mb-1">Time</label>
              <input required type="time" value={formData.time} onChange={e => setFormData({...formData, time: e.target.value})} className="w-full input-premium px-3 py-2 text-sm outline-none" />
            </div>
          </div>
          <div>
            <label className="block text-[11px] font-mono uppercase tracking-widest text-text-tertiary mb-1">Meeting Link (Optional)</label>
            <input type="url" value={formData.external_link} onChange={e => setFormData({...formData, external_link: e.target.value})} placeholder="https://meet.google.com/..." className="w-full input-premium px-3 py-2 text-sm outline-none" />
          </div>
          <div>
            <label className="block text-[11px] font-mono uppercase tracking-widest text-text-tertiary mb-1">Agenda</label>
            <textarea value={formData.agenda} onChange={e => setFormData({...formData, agenda: e.target.value})} className="w-full input-premium px-3 py-2 text-sm outline-none min-h-[80px]" />
          </div>
          <div>
            <label className="block text-[11px] font-mono uppercase tracking-widest text-text-tertiary mb-1">Participants</label>
            <div className="bg-black/20 border border-[var(--border-soft)] rounded-lg p-2 max-h-32 overflow-y-auto space-y-1 scrollbar-premium">
              {profiles.map(p => (
                <label key={p.id} className="flex items-center gap-2 p-1 hover:bg-[var(--surface-hover)] rounded cursor-pointer">
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
          
          <div className="pt-4 border-t border-[var(--border-soft)] flex justify-end gap-3 mt-4">
            <button type="button" onClick={onClose} className="px-4 py-2 text-sm font-medium text-text-secondary hover:text-text-primary btn-premium-secondary rounded-lg">Cancel</button>
            <button type="submit" disabled={loading} className="px-5 py-2 text-sm font-medium btn-premium-primary rounded-lg disabled:opacity-50 text-white">
              {loading ? 'Scheduling...' : 'Schedule'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
