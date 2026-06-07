import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { useWorkspace } from '../../context/WorkspaceContext';
import { useDashboard } from '../../context/DashboardContext';
import { Icon } from '../../components/ui/Icon';
import { activityLogService } from '../../services/activityLogService';
import { TaskCreateModal } from '../../components/task/TaskCreateModal';
import { createTask } from '../../services/taskService';
import { sendNotification } from '../../services/notificationService';
import { ConfirmationModal } from '../../components/ui/ConfirmationModal';
import { useAuth } from '../../context/AuthContext';
import { useEscapeKey } from '../../hooks/useEscapeKey';

export function MeetingDetailsModal({ meeting, onClose, onUpdate }: { meeting: any, onClose: () => void, onUpdate: () => void }) {
  const { workspace } = useWorkspace();
  const { profile } = useAuth();
  const { profiles, projects, notify } = useDashboard();
  const [loading, setLoading] = useState(false);
  
  useEscapeKey(true, onClose);

  const [discussionNotes, setDiscussionNotes] = useState(meeting.discussion_notes || '');
  const [decisions, setDecisions] = useState(meeting.decisions || '');
  const [actionItems, setActionItems] = useState<{id: string, text: string, converted_to_task_id?: string}[]>(meeting.action_items || []);
  
  const [newItemText, setNewItemText] = useState('');
  const [convertingItem, setConvertingItem] = useState<string | null>(null);
  const [isCancelModalOpen, setIsCancelModalOpen] = useState(false);

  const handleSave = async () => {
    setLoading(true);
    try {
      const { error } = await supabase.from('meetings').update({
        discussion_notes: discussionNotes,
        decisions: decisions,
        action_items: actionItems,
        updated_at: new Date().toISOString()
      }).eq('id', meeting.id);

      if (error) throw error;
      
      await activityLogService.appendLog({
        workspace_id: workspace!.id,
        action: 'meeting_updated',
        metadata: { meeting_id: meeting.id, title: meeting.title }
      });

      if (meeting.meeting_attendees) {
        for (const attendee of meeting.meeting_attendees) {
          if (attendee.user_id !== profile?.id) {
             await sendNotification(
               workspace!.id,
               'system',
               `Meeting Updated: ${meeting.title}`,
               `Meeting notes or action items were updated.`,
               attendee.user_id,
               { type: 'meeting_update', entity_id: meeting.id }
             );
          }
        }
      }

      notify("Meeting notes saved.", "success");
      onUpdate();
    } catch (err) {
      console.error(err);
      notify("Failed to save meeting notes.", "error");
    } finally {
      setLoading(false);
    }
  };

  const handleCancelMeeting = async () => {
    try {
      const { error } = await supabase.from('meetings').update({ status: 'cancelled' }).eq('id', meeting.id);
      if (!error) {
        if (meeting.meeting_attendees) {
          for (const attendee of meeting.meeting_attendees) {
             await sendNotification(
               workspace!.id,
               'system',
               `Meeting Cancelled: ${meeting.title}`,
               `The meeting has been cancelled.`,
               attendee.user_id,
               { type: 'meeting_cancelled', entity_id: meeting.id }
             );
          }
        }
        onUpdate();
        onClose();
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleAddActionItem = () => {
    if (!newItemText.trim()) return;
    const newItem = {
      id: crypto.randomUUID(),
      text: newItemText
    };
    setActionItems([...actionItems, newItem]);
    setNewItemText('');
  };

  const handleConvertTaskSubmit = async (task: any) => {
    try {
      const createdTask = await createTask({ ...task, workspace_id: workspace!.id });
      if (convertingItem && createdTask) {
        setActionItems(actionItems.map(item => item.id === convertingItem ? { ...item, converted_to_task_id: createdTask.id } : item));
        setConvertingItem(null);
        handleSave();
      }
    } catch (err) {
      console.error("Error converting task", err);
      throw err;
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 modal-overlay-premium">
      <div onClick={onClose} className="absolute inset-0 z-0 cursor-pointer" />
      <div className="relative modal-premium p-6 rounded-2xl max-w-4xl w-full text-white max-h-[90vh] flex flex-col scrollbar-premium z-10 animate-in fade-in zoom-in-95 duration-200">
        <div className="flex justify-between items-center mb-4 flex-none">
          <div>
            <h2 className="text-xl font-semibold tracking-tight text-text-primary">{meeting.title}</h2>
            <p className="text-xs text-text-tertiary mt-1">{new Date(meeting.date).toLocaleDateString()} at {meeting.time} • {meeting.meeting_type}</p>
          </div>
          <button onClick={onClose} aria-label="Close modal" className="p-2 rounded-lg hover:bg-[var(--surface-hover)] transition-colors text-[var(--text-secondary)] hover:text-white">
            <Icon name="close" size={20} />
          </button>
        </div>
        
        <div className="flex-1 overflow-y-auto pr-2 space-y-6 scrollbar-premium">
          <div className="bg-black/20 p-4 rounded-lg border border-[var(--border-soft)] text-sm">
            <h4 className="font-semibold mb-2 text-text-secondary">Agenda</h4>
            <p className="whitespace-pre-wrap text-text-primary">{meeting.agenda || "No agenda provided."}</p>
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase tracking-widest text-indigo-400 mb-2 flex items-center gap-2">
              <Icon name="edit_note" size={16} /> Discussion Notes
            </label>
            <textarea 
              value={discussionNotes} 
              onChange={e => setDiscussionNotes(e.target.value)} 
              placeholder="Record main discussion points..." 
              className="w-full input-premium px-4 py-3 text-sm outline-none min-h-[120px]" 
            />
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase tracking-widest text-emerald-400 mb-2 flex items-center gap-2">
              <Icon name="gavel" size={16} /> Decisions
            </label>
            <textarea 
              value={decisions} 
              onChange={e => setDecisions(e.target.value)} 
              placeholder="Record finalized decisions..." 
              className="w-full input-premium px-4 py-3 text-sm outline-none min-h-[100px]" 
            />
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase tracking-widest text-amber-400 mb-2 flex items-center gap-2">
              <Icon name="checklist" size={16} /> Action Items
            </label>
            
            <div className="space-y-2 mb-3">
              {actionItems.map((item, idx) => (
                <div key={item.id} className="flex items-center justify-between p-3 bg-black/20 border border-[var(--border-soft)] rounded-lg">
                  <span className="text-sm">{idx + 1}. {item.text}</span>
                  {item.converted_to_task_id ? (
                    <span className="text-xs px-2 py-1 bg-emerald-500/20 text-emerald-400 rounded-md flex items-center gap-1">
                      <Icon name="check_circle" size={12} /> Converted to Task
                    </span>
                  ) : (
                    <button 
                      onClick={() => setConvertingItem(item.id)}
                      className="text-xs px-2 py-1 bg-indigo-500/20 hover:bg-indigo-500/30 text-indigo-300 rounded-md flex items-center gap-1 transition-colors"
                    >
                      <Icon name="call_split" size={12} /> Convert to Task
                    </button>
                  )}
                </div>
              ))}
              {actionItems.length === 0 && (
                <p className="text-xs text-text-tertiary italic">No action items recorded.</p>
              )}
            </div>

            <div className="flex gap-2">
              <input 
                type="text" 
                value={newItemText} 
                onChange={e => setNewItemText(e.target.value)} 
                onKeyDown={e => e.key === 'Enter' && handleAddActionItem()}
                placeholder="New action item..." 
                className="flex-1 input-premium px-3 py-2 text-sm outline-none" 
              />
              <button 
                onClick={handleAddActionItem}
                className="px-4 py-2 bg-[var(--surface-glass)] hover:bg-[var(--surface-hover)] text-white rounded-lg text-sm font-medium transition-colors"
              >
                Add Item
              </button>
            </div>
          </div>
        </div>
        
        <div className="pt-4 border-t border-[var(--border-soft)] flex justify-between items-center flex-none mt-4">
          <div className="flex gap-2">
            <button 
              onClick={async () => {
                const { error } = await supabase.from('meetings').update({ status: 'completed' }).eq('id', meeting.id);
                if (!error) {
                  onUpdate();
                  onClose();
                }
              }}
              className="px-4 py-2 btn-premium-success rounded-lg text-sm font-medium flex items-center gap-2"
            >
              <Icon name="done_all" size={16} /> Mark Completed
            </button>
            <button 
              onClick={() => setIsCancelModalOpen(true)}
              className="px-4 py-2 btn-premium-danger rounded-lg text-sm font-medium flex items-center gap-2"
            >
              <Icon name="close" size={16} /> Cancel Meeting
            </button>
          </div>
          <div className="flex gap-3">
            <button type="button" onClick={onClose} className="px-4 py-2 text-sm font-medium text-text-secondary hover:text-text-primary btn-premium-secondary rounded-lg">Close</button>
            <button onClick={handleSave} disabled={loading} className="px-5 py-2 text-sm font-medium btn-premium-primary rounded-lg disabled:opacity-50 text-white flex items-center gap-2">
              <Icon name="save" size={16} />
              {loading ? 'Saving...' : 'Save Notes'}
            </button>
          </div>
        </div>
      </div>

      {convertingItem && (
        <TaskCreateModal 
          isOpen={true} 
          onClose={() => setConvertingItem(null)}
          projects={projects}
          users={profiles}
          defaultStatus="backlog"
          defaultSourceMeetingId={meeting.id}
          onSubmit={handleConvertTaskSubmit}
          notify={notify}
        />
      )}

      <ConfirmationModal
        isOpen={isCancelModalOpen}
        title="Cancel Meeting"
        message={`Are you sure you want to cancel "${meeting.title}"? This will notify all participants.`}
        confirmText="Cancel Meeting"
        onConfirm={handleCancelMeeting}
        onCancel={() => setIsCancelModalOpen(false)}
      />
    </div>
  );
}
