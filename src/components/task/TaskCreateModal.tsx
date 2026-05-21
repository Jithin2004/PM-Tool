import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { X, Terminal } from 'lucide-react';
import { Project, TaskStatus } from '../../types';

interface TaskCreateModalProps {
  isOpen: boolean;
  onClose: () => void;
  projects: Project[];
  users: any[];
  defaultStatus: TaskStatus;
  defaultProjectId?: string;
  mode?: 'task' | 'epic' | 'story';
  onSubmit: (task: {
    project_id: string;
    name: string;
    description: string;
    estimated_hours: number;
    assignee_id?: string;
    status: TaskStatus;
    priority: 'medium';
  }) => Promise<void>;
  notify: (msg: string, type: 'success' | 'error' | 'warning' | 'info') => void;
}

export function TaskCreateModal({
  isOpen,
  onClose,
  projects,
  users,
  defaultStatus,
  defaultProjectId,
  mode = 'task',
  onSubmit,
  notify
}: TaskCreateModalProps) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [projectId, setProjectId] = useState(defaultProjectId || '');
  const [estimatedHours, setEstimatedHours] = useState(5);
  const [assigneeId, setAssigneeId] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !projectId) {
      notify("Workspace error: Title and targeted Project are mandatory.", "error");
      return;
    }

    try {
      setIsSubmitting(true);
      await onSubmit({
        project_id: projectId,
        name,
        description,
        estimated_hours: Number(estimatedHours),
        assignee_id: assigneeId || undefined,
        status: defaultStatus,
        priority: 'medium',
      });
      
      notify(`Task "${name}" queued successfully.`, "success");
      onClose();
      // Reset form
      setName('');
      setDescription('');
      setEstimatedHours(5);
      setAssigneeId('');
    } catch (err: any) {
      notify(`Failed to queue task: ${err.message}`, "error");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[99999] flex items-center justify-center p-4">
      <motion.div
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.95, opacity: 0 }}
        className="bg-[#0a0a0a] border border-white/10 p-6 rounded-sm w-full max-w-md relative overflow-hidden"
      >
        {/* Visual neon light accent */}
        <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-blue-600 to-purple-600" />
        
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-xs font-mono uppercase tracking-widest text-white flex items-center gap-1.5">
            <Terminal className="w-4 h-4 text-blue-500" />
            {mode === 'epic' ? 'Add Epic' : mode === 'story' ? 'Add Story' : 'Add Task'}
          </h3>
          <button
            onClick={onClose}
            className="text-white/40 hover:text-white cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-[8px] font-mono uppercase tracking-wider text-white/40 mb-1">{mode === 'epic' ? 'Epic Name' : mode === 'story' ? 'Story Title' : 'Task Title'} *</label>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Implement Authentication"
              className="w-full bg-black border border-white/10 p-2 text-xs font-mono text-white placeholder-white/20 focus:border-blue-500 focus:outline-none transition-colors"
            />
          </div>

          <div>
            <label className="block text-[8px] font-mono uppercase tracking-wider text-white/40 mb-1">Target Project *</label>
            {defaultProjectId ? (
              <div className="w-full bg-black/50 border border-white/10 p-2 text-xs font-mono text-white/60">{projects.find(p => p.id === defaultProjectId)?.name || projects[0]?.name}</div>
            ) : (
              <select
                required
                value={projectId}
                onChange={(e) => setProjectId(e.target.value)}
                className="w-full bg-black border border-white/10 p-2 text-xs font-mono text-white focus:border-blue-500 focus:outline-none transition-colors"
              >
                <option value="">-- SELECT PROJECT --</option>
                {projects.map(p => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
            )}
          </div>

          <div>
            <label className="block text-[8px] font-mono uppercase tracking-wider text-white/40 mb-1">Description</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Technical specs, links, etc."
              rows={3}
              className="w-full bg-black border border-white/10 p-2 text-xs font-mono text-white placeholder-white/20 focus:border-blue-500 focus:outline-none transition-colors resize-none"
            />
          </div>

          <div className="flex gap-4">
            <div className="flex-1">
              <label className="block text-[8px] font-mono uppercase tracking-wider text-white/40 mb-1">Weight (Hours)</label>
              <input
                type="number"
                min="0.5"
                step="0.5"
                value={estimatedHours}
                onChange={(e) => setEstimatedHours(Number(e.target.value))}
                className="w-full bg-black border border-white/10 p-2 text-xs font-mono text-white focus:border-blue-500 focus:outline-none transition-colors"
              />
            </div>
            <div className="flex-1">
              <label className="block text-[8px] font-mono uppercase tracking-wider text-white/40 mb-1">Assignee</label>
              <select
                value={assigneeId}
                onChange={(e) => setAssigneeId(e.target.value)}
                className="w-full bg-black border border-white/10 p-2 text-xs font-mono text-white focus:border-blue-500 focus:outline-none transition-colors"
              >
                <option value="">Unassigned</option>
                {users.map(u => (
                  <option key={u.id} value={u.id}>{u.email}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="pt-4 border-t border-white/5 flex justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-[9px] font-mono uppercase tracking-widest text-white/50 hover:text-white transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white text-[9px] font-mono uppercase tracking-widest transition-colors shadow-[0_0_12px_rgba(59,130,246,0.3)] disabled:opacity-50"
            >
              {isSubmitting ? 'Processing...' : mode === 'epic' ? 'Create Epic' : mode === 'story' ? 'Create Story' : 'Create Task'}
            </button>
          </div>
        </form>
      </motion.div>
    </div>
  );
}
