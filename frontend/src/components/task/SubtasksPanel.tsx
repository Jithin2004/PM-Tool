import React, { useState, useEffect } from 'react';
import { Plus, CheckCircle2, Circle, Clock, Trash2, GitPullRequest } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';
import { Task } from '../../types';
import { showAlert, showConfirm } from '../common/Dialogs';

export function SubtasksPanel({ 
  parentTask, 
  onTaskUpdated 
}: { 
  parentTask: Task;
  onTaskUpdated?: () => void;
}) {
  const [subtasks, setSubtasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [isCreating, setIsCreating] = useState(false);
  const [newTaskName, setNewTaskName] = useState('');
  const [newTaskEstimate, setNewTaskEstimate] = useState('1');
  const { profile } = useAuth();

  const fetchSubtasks = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('tasks')
      .select('*')
      .eq('parent_task_id', parentTask.id)
      .order('created_at', { ascending: true });
      
    if (error) {
      console.error('Error fetching subtasks:', error);
    } else {
      setSubtasks(data || []);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchSubtasks();
  }, [parentTask.id]);

  const handleCreateSubtask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTaskName.trim()) return showAlert('Subtask name is required');

    const estimate = Number(newTaskEstimate);
    if (isNaN(estimate) || estimate <= 0) return showAlert('Valid estimate required');

    const { error } = await supabase.from('tasks').insert({
      workspace_id: parentTask.workspace_id,
      project_id: parentTask.project_id,
      parent_task_id: parentTask.id,
      name: newTaskName,
      status: 'todo',
      priority: parentTask.priority,
      assignee_id: profile?.id, // Default to creator
      estimated_hours: estimate,
      original_estimate: estimate,
      current_estimate: estimate
    });

    if (error) {
      showAlert(`Failed to create subtask: ${error.message}`);
    } else {
      setIsCreating(false);
      setNewTaskName('');
      setNewTaskEstimate('1');
      fetchSubtasks();
      if (onTaskUpdated) onTaskUpdated();
    }
  };

  const handleDeleteSubtask = async (id: string) => {
    if (!await showConfirm('Delete this subtask permanently?')) return;
    
    const { error } = await supabase.from('tasks').delete().eq('id', id);
    if (error) {
      showAlert(`Failed to delete subtask: ${error.message}`);
    } else {
      fetchSubtasks();
      if (onTaskUpdated) onTaskUpdated();
    }
  };

  const handleToggleSubtask = async (task: Task) => {
    const newStatus = task.status === 'completed' || task.status === 'done' ? 'todo' : 'completed';
    const { error } = await supabase.from('tasks').update({ status: newStatus }).eq('id', task.id);
    if (error) {
      showAlert(`Failed to update status: ${error.message}`);
    } else {
      fetchSubtasks();
      if (onTaskUpdated) onTaskUpdated();
    }
  };

  const totalEstimate = subtasks.reduce((acc, t) => acc + (t.current_estimate || 0), 0);
  const completedEstimate = subtasks.filter(t => t.status === 'completed' || t.status === 'done').reduce((acc, t) => acc + (t.current_estimate || 0), 0);
  const progress = totalEstimate > 0 ? (completedEstimate / totalEstimate) * 100 : 0;

  if (loading) {
    return <div className="p-4 text-center text-[10px] font-mono text-text-tertiary">Loading subtasks...</div>;
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <div>
          <h4 className="text-[10px] font-mono uppercase tracking-widest text-text-secondary flex items-center gap-2">
            <GitPullRequest className="w-3 h-3 text-indigo-400" />
            Subtasks
          </h4>
          {subtasks.length > 0 && (
            <div className="mt-1.5 flex items-center gap-2">
              <div className="h-1.5 w-32 bg-surface-3 rounded-full overflow-hidden border border-border-subtle">
                <div className="h-full bg-indigo-500 transition-all duration-500" style={{ width: `${progress}%` }} />
              </div>
              <span className="text-[9px] font-mono text-text-tertiary">{Math.round(progress)}% ({completedEstimate}h / {totalEstimate}h)</span>
            </div>
          )}
        </div>
        {!isCreating && (
          <button 
            type="button"
            onClick={() => setIsCreating(true)}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-sm bg-surface-3 hover:bg-surface-4 text-text-primary text-[9px] font-mono uppercase transition-colors"
          >
            <Plus className="w-3 h-3" /> New Subtask
          </button>
        )}
      </div>

      {isCreating && (
        <form onSubmit={handleCreateSubtask} className="bg-surface-2 p-3 rounded-sm border border-indigo-500/30">
          <div className="space-y-3">
            <div>
              <label className="block text-[8px] font-mono uppercase text-text-quaternary mb-1">Subtask Action</label>
              <input 
                autoFocus
                required
                value={newTaskName} 
                onChange={e => setNewTaskName(e.target.value)} 
                className="input-premium w-full h-8 px-2.5 text-xs outline-none" 
                placeholder="e.g. Write unit tests for auth controller" 
              />
            </div>
            <div>
              <label className="block text-[8px] font-mono uppercase text-text-quaternary mb-1">Estimate (hrs)</label>
              <input 
                type="number" 
                min="0.25" 
                step="0.25" 
                required
                value={newTaskEstimate} 
                onChange={e => setNewTaskEstimate(e.target.value)} 
                className="input-premium w-full h-8 px-2.5 text-xs outline-none" 
              />
            </div>
          </div>
          <div className="flex justify-end gap-2 mt-3">
            <button type="button" onClick={() => setIsCreating(false)} className="px-3 py-1 text-[9px] uppercase font-bold text-text-tertiary hover:text-text-secondary">Cancel</button>
            <button type="submit" className="px-3 py-1 bg-indigo-500/20 text-indigo-400 text-[9px] uppercase font-bold rounded-sm hover:bg-indigo-500/30">Add</button>
          </div>
        </form>
      )}

      {subtasks.length === 0 && !isCreating ? (
        <div className="p-4 border border-dashed border-border-subtle rounded-sm text-center text-[10px] text-text-tertiary">
          Break this task down into smaller actionable items.
        </div>
      ) : (
        <div className="space-y-1.5">
          {subtasks.map(task => {
            const isCompleted = task.status === 'completed' || task.status === 'done';
            return (
              <div key={task.id} className="flex items-center justify-between p-2 rounded-sm border border-border-subtle bg-bg hover:border-border transition-colors group">
                <div className="flex items-center gap-3 overflow-hidden">
                  <button type="button" onClick={() => handleToggleSubtask(task)} className="shrink-0 text-text-quaternary hover:text-indigo-400 transition-colors">
                    {isCompleted ? <CheckCircle2 className="w-4 h-4 text-emerald-500" /> : <Circle className="w-4 h-4" />}
                  </button>
                  <span className={`text-xs truncate ${isCompleted ? 'text-text-quaternary line-through' : 'text-text-secondary'}`}>
                    {task.name}
                  </span>
                </div>
                <div className="flex items-center gap-3 shrink-0 pl-2">
                  <span className="text-[9px] font-mono text-text-tertiary flex items-center gap-1">
                    <Clock className="w-3 h-3" /> {task.current_estimate}h
                  </span>
                  <button type="button" onClick={() => handleDeleteSubtask(task.id)} className="text-text-quaternary hover:text-rose-400 opacity-0 group-hover:opacity-100 transition-all p-1">
                    <Trash2 className="w-3 h-3" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
