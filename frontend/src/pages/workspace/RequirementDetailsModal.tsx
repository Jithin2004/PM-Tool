import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { useWorkspace } from '../../context/WorkspaceContext';
import { useDashboard } from '../../context/DashboardContext';
import { Icon } from '../../components/ui/Icon';
import { activityLogService } from '../../services/activityLogService';
import { TaskCreateModal } from '../../components/task/TaskCreateModal';
import { sendNotification } from '../../services/notificationService';
import { ConfirmationModal } from '../../components/ui/ConfirmationModal';
import { useEscapeKey } from '../../hooks/useEscapeKey';

export function RequirementDetailsModal({ requirement, onClose, onUpdate }: { requirement: any, onClose: () => void, onUpdate: () => void }) {
  const { workspace } = useWorkspace();
  const { profiles, projects, notify } = useDashboard();
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState(requirement.status);
  const [isAddingTask, setIsAddingTask] = useState(false);
  const [tasks, setTasks] = useState<any[]>([]);
  const [isConvertModalOpen, setIsConvertModalOpen] = useState(false);

  useEscapeKey(true, onClose);

  useEffect(() => {
    fetchLinkedTasks();
  }, [requirement.id]);

  const fetchLinkedTasks = async () => {
    const { data } = await supabase.from('tasks').select('*').eq('source_requirement_id', requirement.id);
    if (data) setTasks(data);
  };

  const handleStatusChange = async (newStatus: string) => {
    setLoading(true);
    try {
      const { error } = await supabase.from('requirements').update({ status: newStatus, updated_at: new Date().toISOString() }).eq('id', requirement.id);
      if (error) throw error;
      
      await activityLogService.appendLog({
        workspace_id: workspace!.id,
        action: 'requirement_status_changed',
        metadata: { requirement_id: requirement.id, old_status: status, new_status: newStatus }
      });
      
      // Notify about requirement status change
      await sendNotification(
        workspace!.id,
        'system',
        `Requirement ${newStatus}: ${requirement.title}`,
        `The requirement has been moved to ${newStatus}.`,
        undefined, // Notify workspace/PMs generally
        { type: 'requirement_status', entity_id: requirement.id }
      );
      
      setStatus(newStatus);
      notify(`Status updated to ${newStatus}`, "success");
      onUpdate();
    } catch (err) {
      console.error(err);
      notify("Failed to update status", "error");
    } finally {
      setLoading(false);
    }
  };

  const handleCreateProject = () => {
    window.location.href = `/projects/new?source_requirement_id=${requirement.id}`;
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 modal-overlay-premium">
      <div onClick={onClose} className="absolute inset-0 z-0 cursor-pointer" />
      <div className="relative modal-premium p-6 rounded-2xl max-w-4xl w-full text-white max-h-[90vh] flex flex-col scrollbar-premium z-10 animate-in fade-in zoom-in-95 duration-200">
        <div className="flex justify-between items-start mb-4 flex-none">
          <div>
            <div className="flex items-center gap-3 mb-1">
              <h2 className="text-xl font-semibold tracking-tight text-text-primary">{requirement.title}</h2>
              <span className={`text-[10px] uppercase tracking-wider font-mono px-2 py-1 rounded
                    ${status === 'Approved' ? 'bg-emerald-500/20 text-emerald-400' :
                      status === 'Under Review' ? 'bg-amber-500/20 text-amber-400' :
                      status === 'Converted' ? 'bg-indigo-500/20 text-indigo-400' : 'bg-[var(--surface-glass)] text-[var(--text-muted)]'}`}>
                {status}
              </span>
            </div>
            <p className="text-xs text-text-tertiary mt-1">Priority: <span className="uppercase text-text-secondary">{requirement.priority}</span></p>
          </div>
          <button onClick={onClose} aria-label="Close modal" className="p-2 rounded-lg hover:bg-[var(--surface-hover)] transition-colors text-[var(--text-secondary)] hover:text-white">
            <Icon name="close" size={20} />
          </button>
        </div>
        
        <div className="flex-1 overflow-y-auto pr-2 space-y-6 scrollbar-premium">
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div className="bg-black/20 p-4 rounded-lg border border-[var(--border-soft)]">
              <h4 className="font-semibold mb-2 text-text-secondary">Description</h4>
              <p className="whitespace-pre-wrap text-text-primary">{requirement.description}</p>
            </div>
            <div className="bg-black/20 p-4 rounded-lg border border-[var(--border-soft)]">
              <h4 className="font-semibold mb-2 text-text-secondary">Acceptance Criteria</h4>
              <p className="whitespace-pre-wrap text-text-primary">{requirement.acceptance_criteria || "None provided."}</p>
            </div>
          </div>

          <div className="bg-black/20 p-4 rounded-lg border border-[var(--border-soft)]">
            <div className="flex justify-between items-center mb-4">
              <h4 className="font-semibold text-text-secondary text-sm">Linked Tasks</h4>
              {status === 'Approved' && (
                <button 
                  onClick={() => setIsAddingTask(true)}
                  className="px-3 py-1 bg-indigo-500/20 hover:bg-indigo-500/30 text-indigo-300 rounded text-xs font-medium transition-colors"
                >
                  + Add Task
                </button>
              )}
            </div>
            <div className="space-y-2">
              {tasks.length === 0 ? (
                <p className="text-xs text-text-tertiary italic"><span className="text-[11px] text-[var(--text-muted)] font-mono">No linked tasks.</span></p>
              ) : (
                tasks.map(t => (
                  <div key={t.id} className="flex justify-between items-center p-2 border border-[var(--border-soft)] rounded text-sm text-text-primary">
                    <span>{t.name}</span>
                    <span className="text-xs px-2 py-1 bg-[var(--surface-glass)] rounded text-text-secondary">{t.status}</span>
                  </div>
                ))
              )}
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <h4 className="text-xs font-semibold uppercase tracking-widest text-text-tertiary">Lifecycle Actions</h4>
            <div className="flex gap-2">
              {status === 'Draft' && <button onClick={() => handleStatusChange('Under Review')} className="px-4 py-2 bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 border border-amber-500/20 rounded text-sm font-medium transition-colors">Submit for Review</button>}
              {status === 'Under Review' && <button onClick={() => handleStatusChange('Approved')} className="px-4 py-2 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/20 rounded text-sm font-medium transition-colors">Approve Requirement</button>}
              {status === 'Approved' && (
                <>
                  <button onClick={handleCreateProject} className="px-4 py-2 btn-premium-primary rounded-lg text-sm font-medium transition-colors">Create Project</button>
                  <button onClick={() => setIsConvertModalOpen(true)} className="px-4 py-2 btn-premium-secondary rounded-lg text-sm font-medium transition-colors">Mark Converted</button>
                </>
              )}
            </div>
          </div>
        </div>

        <div className="pt-4 border-t border-[var(--border-soft)] flex justify-end gap-3 flex-none mt-4">
          <button type="button" onClick={onClose} className="px-4 py-2 text-sm font-medium text-text-secondary hover:text-text-primary btn-premium-secondary rounded-lg">Close</button>
        </div>
      </div>

      {isAddingTask && (
        <TaskCreateModal 
          isOpen={true} 
          onClose={() => setIsAddingTask(false)}
          projects={projects}
          users={profiles}
          defaultStatus="backlog"
          defaultSourceRequirementId={requirement.id}
          defaultProjectId={requirement.project_id || undefined}
          onSubmit={async (task) => {
            const { createTask } = await import('../../services/taskService');
            await createTask({ ...task, workspace_id: workspace!.id });
            fetchLinkedTasks();
            setIsAddingTask(false);
          }}
          notify={notify}
        />
      )}

      <ConfirmationModal
        isOpen={isConvertModalOpen}
        title="Convert Requirement"
        message={`Are you sure you want to mark "${requirement.title}" as Converted?`}
        confirmText="Convert"
        onConfirm={() => {
          handleStatusChange('Converted');
          setIsConvertModalOpen(false);
        }}
        onCancel={() => setIsConvertModalOpen(false)}
      />
    </div>
  );
}
