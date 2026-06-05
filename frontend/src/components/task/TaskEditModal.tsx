import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { X, Terminal, AlertTriangle, MessageSquare, ShieldAlert } from 'lucide-react';
import { Project, Task, TaskStatus } from '../../types';
import { hasCapability } from '../../core/auth/permissions';
import { AssigneePicker } from './AssigneePicker';
import { TaskDiscussionTab } from './TaskDiscussionTab';
import { TaskActivityTab } from './TaskActivityTab';
import { FilePanel } from '../common/FilePanel';
import { useWorkspace } from '../../context/WorkspaceContext';
import { useAuth } from '../../context/AuthContext';
import { TaskTimerUI } from './TaskTimerUI';
import { useOperationalData } from '../../context/OperationalDataContext';
import { showPrompt } from '../common/Dialogs';
import { supabase } from '../../lib/supabase';

interface TaskEditModalProps {
  isOpen: boolean;
  onClose: () => void;
  task: Task;
  projects: Project[];
  users: any[];
  onSubmit: (taskId: string, updates: Partial<Task>) => Promise<void>;
  notify: (msg: string, type: 'success' | 'error' | 'warning' | 'info') => void;
  currentUserProfile?: any;
}

export function TaskEditModal({
  isOpen,
  onClose,
  task,
  projects,
  users,
  onSubmit,
  notify,
  currentUserProfile
}: TaskEditModalProps) {
  const [name, setName] = useState(task.name);
  const [description, setDescription] = useState(task.description || '');
  const [projectId, setProjectId] = useState(task.project_id || '');
  const [originalEstimate, setOriginalEstimate] = useState(task.original_estimate || task.estimated_hours || 5);
  const [currentEstimate, setCurrentEstimate] = useState(task.current_estimate || task.estimated_hours || 5);
  const [estimateReason, setEstimateReason] = useState('');
  const [assigneeId, setAssigneeId] = useState(task.assignee_id || '');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [activeTab, setActiveTab] = useState<'details' | 'discussion' | 'activity' | 'files'>('details');

  // Task Handover states
  const [showTransferOverlay, setShowTransferOverlay] = useState(false);
  const [transferReason, setTransferReason] = useState('');
  const [handoverNotes, setHandoverNotes] = useState('');
  const [addOldAsCollab, setAddOldAsCollab] = useState(true);

  // Suggestions states
  const [suggestions, setSuggestions] = useState<any[]>([]);
  const [showSuggestionForm, setShowSuggestionForm] = useState(false);
  const [suggestionType, setSuggestionType] = useState<'estimate_change' | 'scope_note' | 'technical_risk'>('estimate_change');
  const [suggestedValue, setSuggestedValue] = useState('');
  const [suggestionReason, setSuggestionReason] = useState('');
  const [isSubmittingSuggestion, setIsSubmittingSuggestion] = useState(false);

  const { workspace } = useWorkspace();
  const { profile } = useAuth();

  const { raw: { collaborators = [] }, taskActions } = useOperationalData();
  const { addCollaborator, removeCollaborator } = taskActions;
  const taskCollaborators = collaborators.filter(c => c.task_id === task.id);

  useEffect(() => {
    if (isOpen) {
      setName(task.name);
      setDescription(task.description || '');
      setProjectId(task.project_id || '');
      setOriginalEstimate(task.original_estimate || task.estimated_hours || 5);
      setCurrentEstimate(task.current_estimate || task.estimated_hours || 5);
      setEstimateReason('');
      setAssigneeId(task.assignee_id || '');
      setShowTransferOverlay(false);
      setTransferReason('');
      setHandoverNotes('');
      
      // Fetch suggestions
      supabase
        .from('task_suggestions')
        .select('*')
        .eq('task_id', task.id)
        .order('created_at', { ascending: false })
        .then(({ data }) => {
          if (data) setSuggestions(data);
        });
    }
  }, [isOpen, task]);

  if (!isOpen) return null;

  const isDeveloper = !hasCapability(currentUserProfile?.role, 'manage_projects');
  const isPrimaryAssignee = task.assignee_id === currentUserProfile?.id;
  const isTaskCollaborator = taskCollaborators.some(c => c.user_id === currentUserProfile?.id);
  const isCollaboratorOnly = isTaskCollaborator && !isPrimaryAssignee;
  
  const canSave = !isDeveloper || isPrimaryAssignee;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !projectId) {
      notify("Workspace error: Title and targeted Project are mandatory.", "error");
      return;
    }

    if (assigneeId !== (task.assignee_id || '')) {
      setShowTransferOverlay(true);
      return;
    }

    await saveTaskData();
  };

  const saveTaskData = async () => {
    try {
      setIsSubmitting(true);
      await onSubmit(task.id, {
        project_id: projectId,
        name,
        description,
        estimated_hours: Number(currentEstimate),
        original_estimate: Number(originalEstimate),
        current_estimate: Number(currentEstimate),
        estimate_reason: estimateReason,
      } as Partial<Task>);
      
      notify(`Task "${name}" updated successfully.`, "success");
      onClose();
    } catch (err: any) {
      notify(`Failed to update task: ${err.message}`, "error");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleConfirmTransfer = async () => {
    if (!transferReason.trim() || !handoverNotes.trim()) {
      notify("Reason and Handover Notes are mandatory for task transfer.", "error");
      return;
    }

    try {
      setIsSubmitting(true);
      await taskActions.transferTaskOwnership(task.id, assigneeId, transferReason, handoverNotes, addOldAsCollab);
      notify("Task ownership transferred successfully.", "success");
      setShowTransferOverlay(false);
      await saveTaskData();
    } catch (err: any) {
      notify(`Failed to transfer task ownership: ${err.message}`, "error");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSubmitSuggestion = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!suggestionReason.trim()) {
      notify("Reason is mandatory for submitting suggestions.", "error");
      return;
    }

    try {
      setIsSubmittingSuggestion(true);
      let val: any = suggestedValue;
      if (suggestionType === 'estimate_change') {
        val = Number(suggestedValue);
        if (isNaN(val) || val <= 0) {
          notify("Please enter a valid estimate hours.", "error");
          return;
        }
      }

      await taskActions.createTaskSuggestion(task.id, suggestionType, val, currentEstimate, suggestionReason);
      notify("Suggestion submitted to PM/Owner successfully.", "success");
      setSuggestionReason('');
      setSuggestedValue('');
      setShowSuggestionForm(false);
      
      // Refresh suggestions list
      const { data } = await supabase
        .from('task_suggestions')
        .select('*')
        .eq('task_id', task.id)
        .order('created_at', { ascending: false });
      if (data) setSuggestions(data);
    } catch (err: any) {
      notify(`Failed to submit suggestion: ${err.message}`, "error");
    } finally {
      setIsSubmittingSuggestion(false);
    }
  };

  const handleReviewSuggestion = async (suggestionId: string, status: 'accepted' | 'rejected') => {
    try {
      await taskActions.reviewTaskSuggestion(suggestionId, status);
      notify(`Suggestion ${status}.`, "success");
      
      if (status === 'accepted') {
        const acceptedSug = suggestions.find(s => s.id === suggestionId);
        if (acceptedSug && acceptedSug.suggestion_type === 'estimate_change') {
          setCurrentEstimate(Number(acceptedSug.suggested_value));
        }
      }

      const { data } = await supabase
        .from('task_suggestions')
        .select('*')
        .eq('id', suggestionId); // wait, query all for this task
      const { data: all } = await supabase
        .from('task_suggestions')
        .select('*')
        .eq('task_id', task.id)
        .order('created_at', { ascending: false });
      if (all) setSuggestions(all);
    } catch (err: any) {
      notify(`Failed to review suggestion: ${err.message}`, "error");
    }
  };

  return (
    <div className="fixed inset-0 bg-bg backdrop-blur-sm z-[99999] flex items-center justify-center p-4">
      <motion.div
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.95, opacity: 0 }}
        className="bg-bg border border-border p-6 rounded-sm w-full max-w-md relative overflow-hidden"
      >
        <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-accent-primary to-accent-secondary" />
        
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-xs font-sans tracking-tight uppercase tracking-wide text-text-primary flex items-center gap-1.5">
            <Terminal className="w-4 h-4 text-signal-info" />
            Edit Task
          </h3>
          <div className="flex items-center gap-4">
            {workspace && profile && (
              <TaskTimerUI 
                task={task as any} 
                workspace={workspace} 
                currentUser={profile} 
                isCompact={false} 
              />
            )}
            <button
              onClick={onClose}
              className="text-text-quaternary hover:text-text-primary cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        <div className="flex gap-4 border-b border-border-subtle mb-4">
          <button
            onClick={() => setActiveTab('details')}
            className={`pb-2 text-[10px] font-mono tracking-wide uppercase transition-colors ${activeTab === 'details' ? 'text-accent-primary border-b-2 border-accent-primary' : 'text-text-quaternary hover:text-text-secondary'}`}
          >
            Details
          </button>
          <button
            onClick={() => setActiveTab('discussion')}
            className={`pb-2 text-[10px] font-mono tracking-wide uppercase transition-colors ${activeTab === 'discussion' ? 'text-accent-primary border-b-2 border-accent-primary' : 'text-text-quaternary hover:text-text-secondary'}`}
          >
            Discussion
          </button>
          <button
            onClick={() => setActiveTab('activity')}
            className={`pb-2 text-[10px] font-mono tracking-wide uppercase transition-colors ${activeTab === 'activity' ? 'text-accent-primary border-b-2 border-accent-primary' : 'text-text-quaternary hover:text-text-secondary'}`}
          >
            Activity
          </button>
          <button
            onClick={() => setActiveTab('files')}
            className={`pb-2 text-[10px] font-mono tracking-wide uppercase transition-colors ${activeTab === 'files' ? 'text-accent-primary border-b-2 border-accent-primary' : 'text-text-quaternary hover:text-text-secondary'}`}
          >
            Files
          </button>
        </div>

        {activeTab === 'details' && (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
            <label className="block text-[8px] font-mono uppercase tracking-wider text-text-quaternary mb-1">Task Title *</label>
            <input
              type="text"
              required
              disabled={isDeveloper}
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Implement Authentication"
              className={`w-full bg-bg border border-border p-2 text-xs font-mono text-text-primary placeholder-white/20 focus:border-border focus:outline-none transition-colors ${isDeveloper ? 'opacity-50 cursor-not-allowed' : ''}`}
            />
          </div>

          <div>
            <label className="block text-[8px] font-mono uppercase tracking-wider text-text-quaternary mb-1">Target Project *</label>
            <select
              required
              disabled={isDeveloper}
              value={projectId}
              onChange={(e) => setProjectId(e.target.value)}
              className={`w-full bg-bg border border-border p-2 text-xs font-mono text-text-primary focus:border-border focus:outline-none transition-colors ${isDeveloper ? 'opacity-50 cursor-not-allowed' : ''}`}
            >
              <option value="">-- SELECT PROJECT --</option>
              {projects.map(p => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-[8px] font-mono uppercase tracking-wider text-text-quaternary mb-1">Description</label>
            <textarea
              value={description}
              disabled={isDeveloper}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Technical specs, links, etc."
              rows={3}
              className={`w-full bg-bg border border-border p-2 text-xs font-mono text-text-primary placeholder-white/20 focus:border-border focus:outline-none transition-colors resize-none ${isDeveloper ? 'opacity-50 cursor-not-allowed' : ''}`}
            />
          </div>

          <div className="flex gap-4">
            <div className="flex-1 space-y-2">
              <label className="block text-[8px] font-mono uppercase tracking-wider text-text-quaternary mb-1">Original Estimate (hrs)</label>
              <input
                type="number"
                min="0.5"
                step="0.5"
                disabled={isDeveloper}
                value={originalEstimate}
                onChange={(e) => setOriginalEstimate(Number(e.target.value))}
                className={`w-full bg-bg border border-border p-2 text-xs font-mono text-text-primary focus:border-border focus:outline-none transition-colors ${isDeveloper ? 'opacity-50 cursor-not-allowed' : ''}`}
              />
            </div>
            <div className="flex-1 space-y-2">
              <label className="block text-[8px] font-mono uppercase tracking-wider text-text-quaternary mb-1">Current Estimate (hrs)</label>
              <input
                type="number"
                min="0.5"
                step="0.5"
                disabled={isCollaboratorOnly && isDeveloper}
                value={currentEstimate}
                onChange={(e) => setCurrentEstimate(Number(e.target.value))}
                className={`w-full bg-bg border border-border p-2 text-xs font-mono text-text-primary focus:border-border focus:outline-none transition-colors ${(isCollaboratorOnly && isDeveloper) ? 'opacity-50 cursor-not-allowed' : ''}`}
              />
            </div>
            <div className="flex-1">
              <label className="block text-[8px] font-mono uppercase tracking-wider text-text-quaternary mb-1">Assignee</label>
              <AssigneePicker
                users={users}
                value={assigneeId}
                onChange={setAssigneeId}
                disabled={isDeveloper}
                contextText={`${name} ${description}`}
              />
            </div>
          </div>
          
          {currentEstimate !== (task.current_estimate || task.estimated_hours || 5) && (
            <div>
              <label className="block text-[8px] font-mono uppercase tracking-wider text-text-quaternary mb-1">Reason for Estimate Change *</label>
              <input
                type="text"
                required
                value={estimateReason}
                onChange={(e) => setEstimateReason(e.target.value)}
                placeholder="Why did the estimate change?"
                className="w-full bg-bg border border-border p-2 text-xs font-mono text-text-primary placeholder-white/20 focus:border-border focus:outline-none transition-colors"
              />
            </div>
          )}

          {/* Collaborator Management System */}
          <div className="border border-border p-3 rounded-sm space-y-2 bg-surface-1">
            <label className="block text-[8px] font-mono uppercase tracking-wider text-text-quaternary">Task Collaborators</label>
            
            {/* List current collaborators */}
            {taskCollaborators.length === 0 ? (
              <p className="text-[10px] text-text-quaternary font-mono">No collaborators assigned.</p>
            ) : (
              <div className="space-y-1.5 max-h-24 overflow-y-auto pr-1">
                {taskCollaborators.map(c => {
                  const u = users.find(user => user.id === c.user_id);
                  return (
                    <div key={c.id} className="flex justify-between items-center bg-bg border border-border-subtle p-1.5 text-xs font-mono text-text-secondary rounded-sm">
                      <div className="truncate pr-2">
                        <span className="font-semibold text-text-primary">{u?.full_name || u?.email || 'Unknown User'}</span>
                        {c.reason && <span className="text-[10px] text-text-quaternary block truncate">Reason: {c.reason}</span>}
                      </div>
                      {!isDeveloper && (
                        <button
                          type="button"
                          onClick={async () => {
                            try {
                              await removeCollaborator(task.id, c.user_id);
                              notify("Collaborator removed successfully.", "success");
                            } catch (err: any) {
                              notify(`Failed to remove collaborator: ${err.message}`, "error");
                            }
                          }}
                          className="text-text-quaternary hover:text-signal-critical text-[10px] uppercase font-bold px-1 transition-colors"
                        >
                          Remove
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            )}

            {/* Add new collaborator UI (PM/Admin only) */}
            {!isDeveloper && (
              <div className="pt-2 border-t border-border-subtle flex gap-2 items-end">
                <div className="flex-1">
                  <label className="block text-[7px] font-mono uppercase tracking-wider text-text-quaternary mb-1">Add Collaborator</label>
                  <select
                    id="new-collaborator-select"
                    className="w-full bg-bg border border-border p-1 text-[11px] font-mono text-text-primary focus:border-border focus:outline-none transition-colors"
                    defaultValue=""
                    onChange={async (e) => {
                      const userId = e.target.value;
                      if (!userId) return;
                      // Prompt for reason
                      const reason = await showPrompt("Why are you adding this collaborator?", { title: "Collaborator Addition Reason" });
                      if (reason && reason.trim()) {
                        try {
                          await addCollaborator(task.id, userId, reason);
                          notify("Collaborator added successfully.", "success");
                        } catch (err: any) {
                          notify(`Failed to add collaborator: ${err.message}`, "error");
                        }
                      } else if (reason !== null) {
                        notify("Reason is mandatory to add a collaborator.", "error");
                      }
                      e.target.value = ""; // Reset
                    }}
                  >
                    <option value="">-- SELECT USER --</option>
                    {users
                      .filter(u => u.id !== assigneeId && !taskCollaborators.some(c => c.user_id === u.id))
                      .map(u => (
                        <option key={u.id} value={u.id}>{u.full_name || u.email}</option>
                      ))}
                  </select>
                </div>
              </div>
            )}
          </div>

          {/* Suggestions System */}
          <div className="border border-border p-3 rounded-sm space-y-3 bg-surface-1">
            <div className="flex justify-between items-center">
              <label className="block text-[8px] font-mono uppercase tracking-wider text-text-quaternary">Collaborator Suggestions</label>
              {isCollaboratorOnly && !showSuggestionForm && (
                <button
                  type="button"
                  onClick={() => setShowSuggestionForm(true)}
                  className="px-2 py-1 bg-accent-primary/20 hover:bg-accent-primary/30 text-accent-primary text-[8px] uppercase font-bold tracking-wider rounded-sm transition-colors cursor-pointer"
                >
                  Propose Modification
                </button>
              )}
            </div>

            {/* List Suggestions */}
            {suggestions.length > 0 && (
              <div className="space-y-2 max-h-36 overflow-y-auto pr-1">
                {suggestions.map(s => {
                  const suggester = users.find(u => u.id === s.suggested_by);
                  const reviewer = users.find(u => u.id === s.reviewed_by);
                  return (
                    <div key={s.id} className="border border-border-subtle p-2 text-[10px] font-mono text-text-secondary bg-bg rounded-sm space-y-1.5">
                      <div className="flex justify-between items-center">
                        <span className="text-text-primary font-bold">Type: {s.suggestion_type.replace('_', ' ').toUpperCase()}</span>
                        <span className={`px-1 rounded-[2px] text-[8px] uppercase ${
                          s.status === 'accepted' ? 'bg-signal-success/20 text-signal-success' :
                          s.status === 'rejected' ? 'bg-signal-critical/20 text-signal-critical' :
                          'bg-signal-warning/20 text-signal-warning'
                        }`}>
                          {s.status}
                        </span>
                      </div>
                      <div>
                        <span className="text-text-quaternary">By: </span>{suggester?.full_name || suggester?.email || 'Unknown'}
                      </div>
                      <div>
                        <span className="text-text-quaternary">Value: </span>{JSON.stringify(s.suggested_value)} (Old: {JSON.stringify(s.old_value)})
                      </div>
                      <div>
                        <span className="text-text-quaternary">Reason: </span>{s.reason}
                      </div>
                      {s.reviewed_at && (
                        <div className="text-[9px] text-text-quaternary pt-1 border-t border-border-subtle/50">
                          Reviewed by {reviewer?.full_name || 'Admin'} at {new Date(s.reviewed_at).toLocaleDateString()}
                        </div>
                      )}
                      {s.status === 'pending' && (!isDeveloper || isPrimaryAssignee) && (
                        <div className="flex gap-2 justify-end pt-1">
                          <button
                            type="button"
                            onClick={() => handleReviewSuggestion(s.id, 'rejected')}
                            className="text-signal-critical hover:text-signal-critical/80 text-[9px] uppercase font-bold"
                          >
                            Reject
                          </button>
                          <button
                            type="button"
                            onClick={() => handleReviewSuggestion(s.id, 'accepted')}
                            className="text-signal-success hover:text-signal-success/80 text-[9px] uppercase font-bold"
                          >
                            Accept
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}

            {/* Propose Suggestion Form */}
            {showSuggestionForm && (
              <div className="pt-2 border-t border-border-subtle space-y-2.5">
                <div className="flex justify-between items-center">
                  <span className="text-[8px] font-mono uppercase tracking-wider text-text-primary">Propose Change</span>
                  <button
                    type="button"
                    onClick={() => setShowSuggestionForm(false)}
                    className="text-text-quaternary hover:text-text-primary text-[8px] uppercase"
                  >
                    Cancel
                  </button>
                </div>
                <div>
                  <label className="block text-[7px] font-mono uppercase text-text-quaternary mb-0.5">Suggestion Type</label>
                  <select
                    value={suggestionType}
                    onChange={(e) => setSuggestionType(e.target.value as any)}
                    className="w-full bg-bg border border-border p-1 text-[10px] font-mono text-text-primary focus:outline-none"
                  >
                    <option value="estimate_change">Estimate Change</option>
                    <option value="scope_note">Scope Note</option>
                    <option value="technical_risk">Technical Risk</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[7px] font-mono uppercase text-text-quaternary mb-0.5">Suggested Value / Note</label>
                  <input
                    type={suggestionType === 'estimate_change' ? 'number' : 'text'}
                    required
                    value={suggestedValue}
                    onChange={(e) => setSuggestedValue(e.target.value)}
                    placeholder={suggestionType === 'estimate_change' ? 'e.g. 16' : 'e.g. Requires PHP package upgrade'}
                    className="w-full bg-bg border border-border p-1 text-[10px] font-mono text-text-primary focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-[7px] font-mono uppercase text-text-quaternary mb-0.5">Justification / Reason *</label>
                  <textarea
                    required
                    rows={2}
                    value={suggestionReason}
                    onChange={(e) => setSuggestionReason(e.target.value)}
                    placeholder="This is needed because..."
                    className="w-full bg-bg border border-border p-1 text-[10px] font-mono text-text-primary focus:outline-none resize-none"
                  />
                </div>
                <div className="flex justify-end">
                  <button
                    type="button"
                    disabled={isSubmittingSuggestion}
                    onClick={handleSubmitSuggestion}
                    className="px-2.5 py-1 bg-accent-primary text-[var(--pm-text)] dark:text-white text-[8px] font-bold uppercase tracking-wider rounded-sm hover:bg-accent-primary/95 transition-colors"
                  >
                    {isSubmittingSuggestion ? 'Submitting...' : 'Submit Suggestion'}
                  </button>
                </div>
              </div>
            )}
          </div>

          <div className="pt-4 border-t border-border-subtle flex justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-[9px] font-medium uppercase tracking-wide text-text-tertiary hover:text-text-primary transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting || !canSave}
              className="px-4 py-2 bg-accent-primary hover:bg-accent-primary/90 text-[var(--pm-text)] dark:text-white text-[9px] font-medium uppercase tracking-wide transition-colors shadow-sm disabled:opacity-50"
            >
              {isSubmitting ? 'Processing...' : 'Save Changes'}
            </button>
          </div>
        </form>
        )}

        {activeTab === 'discussion' && (
          <TaskDiscussionTab 
            taskId={task.id} 
            users={users} 
            currentUserProfile={currentUserProfile} 
            notify={notify} 
          />
        )}

        {activeTab === 'activity' && (
          <TaskActivityTab taskId={task.id} />
        )}

        {activeTab === 'files' && (
          <div className="h-[400px] overflow-y-auto">
            <FilePanel 
              entityType="task" 
              entityId={task.id} 
              currentUserId={currentUserProfile?.id} 
              canEdit={!isDeveloper} 
            />
          </div>
        )}

        {/* Task Handover Overlay */}
        {showTransferOverlay && (
          <div className="absolute inset-0 bg-bg/95 backdrop-blur-sm z-[100000] flex flex-col justify-center p-6 space-y-4">
            <div className="flex items-center gap-2 border-b border-border pb-2">
              <ShieldAlert className="w-5 h-5 text-signal-warning" />
              <h4 className="text-xs font-mono uppercase text-text-primary tracking-wide">Task Handover Protocol</h4>
            </div>
            
            <div className="bg-signal-warning/10 border border-signal-warning/30 p-2.5 rounded-sm flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 text-signal-warning shrink-0 mt-0.5" />
              <p className="text-[10px] font-mono text-text-secondary">
                Ownership transfers cannot be done silently. Please justify this assignee change and document the handover state.
              </p>
            </div>

            <div className="space-y-3">
              <div>
                <label className="block text-[8px] font-mono uppercase text-text-quaternary mb-1">Transfer Reason *</label>
                <select
                  required
                  value={transferReason}
                  onChange={(e) => setTransferReason(e.target.value)}
                  className="w-full bg-bg border border-border p-2 text-xs font-mono text-text-primary focus:outline-none"
                >
                  <option value="">-- SELECT REASON --</option>
                  <option value="Employee moved to another priority project">Employee moved to another priority project</option>
                  <option value="Developer unavailable / sick leave">Developer unavailable / sick leave</option>
                  <option value="Wrong assignment / delegation error">Wrong assignment / delegation error</option>
                  <option value="Task reassignment / priority change">Task reassignment / priority change</option>
                  <option value="Employee resignation / handover">Employee resignation / handover</option>
                </select>
              </div>

              <div>
                <label className="block text-[8px] font-mono uppercase text-text-quaternary mb-1">Handover & Discovery Notes *</label>
                <textarea
                  required
                  rows={4}
                  value={handoverNotes}
                  onChange={(e) => setHandoverNotes(e.target.value)}
                  placeholder="Describe remaining tasks, current code state, and test configurations..."
                  className="w-full bg-bg border border-border p-2 text-xs font-mono text-text-primary focus:outline-none resize-none"
                />
              </div>

              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="add-old-collab-chk"
                  checked={addOldAsCollab}
                  onChange={(e) => setAddOldAsCollab(e.target.checked)}
                  className="bg-bg border border-border rounded-sm"
                />
                <label htmlFor="add-old-collab-chk" className="text-[10px] font-mono text-text-secondary select-none">
                  Retain previous owner as collaborator
                </label>
              </div>
            </div>

            <div className="pt-2 flex justify-end gap-3 border-t border-border-subtle">
              <button
                type="button"
                onClick={() => setShowTransferOverlay(false)}
                className="px-3 py-1.5 text-[10px] font-mono uppercase text-text-tertiary hover:text-text-primary cursor-pointer"
              >
                Go Back
              </button>
              <button
                type="button"
                onClick={handleConfirmTransfer}
                disabled={isSubmitting}
                className="px-4 py-1.5 bg-accent-primary text-[var(--pm-text)] dark:text-white text-[10px] font-mono uppercase tracking-wide rounded-sm cursor-pointer"
              >
                Confirm Transfer
              </button>
            </div>
          </div>
        )}
      </motion.div>
    </div>
  );
}

