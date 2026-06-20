import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { X, Terminal } from 'lucide-react';
import { Project, TaskStatus } from '../../types';
import { AssigneePicker } from './AssigneePicker';
import { supabase } from '../../lib/supabase';
import { uidService } from '../../services/uidService';

interface TaskCreateModalProps {
  isOpen: boolean;
  onClose: () => void;
  projects: Project[];
  users: any[];
  defaultStatus: TaskStatus;
  defaultProjectId?: string;
  defaultSourceMeetingId?: string;
  defaultSourceRequirementId?: string;
  mode?: 'task' | 'epic' | 'story';
  onSubmit: (task: {
    project_id: string;
    name: string;
    description: string;
    estimated_hours: number;
    assignee_id?: string;
    status: TaskStatus;
    priority: 'medium';
    recurrence_type?: string;
    source_meeting_id?: string;
    source_requirement_id?: string;
    epic_id?: string;
    story_id?: string;
    module_id?: string;
    uid?: string;
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
  defaultSourceMeetingId,
  defaultSourceRequirementId,
  mode = 'task',
  onSubmit,
  notify
}: TaskCreateModalProps) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [projectId, setProjectId] = useState(defaultProjectId || '');
  const [estimatedHours, setEstimatedHours] = useState(5);
  const [assigneeId, setAssigneeId] = useState('');
  const [recurrenceType, setRecurrenceType] = useState('none');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [epics, setEpics] = useState<any[]>([]);
  const [stories, setStories] = useState<any[]>([]);
  const [modules, setModules] = useState<any[]>([]);
  
  const [epicId, setEpicId] = useState('');
  const [storyId, setStoryId] = useState('');
  const [moduleId, setModuleId] = useState('');

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  useEffect(() => {
    if (isOpen && projectId) {
      loadProjectData(projectId);
    }
  }, [isOpen, projectId]);

  const loadProjectData = async (pid: string) => {
    const [
      { data: epicsData },
      { data: storiesData },
      { data: modulesData }
    ] = await Promise.all([
      supabase.from('epics').select('id, name, uid_code').eq('project_id', pid).is('deleted_at', null),
      supabase.from('stories').select('id, title, epic_id').eq('project_id', pid),
      supabase.from('project_modules').select('id, name').eq('project_id', pid)
    ]);
    if (epicsData) setEpics(epicsData);
    if (storiesData) setStories(storiesData);
    if (modulesData) setModules(modulesData);
  };

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !projectId) {
      notify("Workspace error: Title and targeted Project are mandatory.", "error");
      return;
    }

    try {
      setIsSubmitting(true);

      const project = projects.find(p => p.id === projectId);
      const workspaceId = project?.workspace_id || '';

      // Determine UID Scope
      let uidScopeCode = 'PRJ';
      let scopeType: 'project' | 'epic' = 'project';
      
      if (epicId) {
        const epic = epics.find(ep => ep.id === epicId);
        if (epic?.uid_code) {
          uidScopeCode = epic.uid_code;
          scopeType = 'epic';
        }
      } else if (project?.project_code) {
        uidScopeCode = project.project_code;
      }

      let generatedUid = undefined;
      if (workspaceId) {
        generatedUid = await uidService.generateNextUID(workspaceId, scopeType, uidScopeCode);
      }

      await onSubmit({
        project_id: projectId,
        name,
        description,
        estimated_hours: Number(estimatedHours),
        assignee_id: assigneeId || undefined,
        status: defaultStatus,
        priority: 'medium',
        recurrence_type: recurrenceType,
        source_meeting_id: defaultSourceMeetingId,
        source_requirement_id: defaultSourceRequirementId,
        epic_id: epicId || undefined,
        story_id: storyId || undefined,
        module_id: moduleId || undefined,
        uid: generatedUid || undefined
      });
      
      notify(`Task "${name}" queued successfully.`, "success");
      onClose();
      setName('');
      setDescription('');
      setEstimatedHours(5);
      setAssigneeId('');
      setRecurrenceType('none');
      setEpicId('');
      setStoryId('');
      setModuleId('');
    } catch (err: any) {
      notify(`Failed to queue task: ${err.message}`, "error");
    } finally {
      setIsSubmitting(false);
    }
  };

  const filteredStories = epicId ? stories.filter(s => s.epic_id === epicId) : stories;

  return (
    <div className="fixed inset-0 modal-overlay-premium z-[99999] flex items-center justify-center p-4 overflow-y-auto">
      <motion.div
        initial={{ scale: 0.97, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.97, opacity: 0 }}
        transition={{ duration: 0.2, ease: "easeOut" }}
        className="modal-premium p-8 rounded-2xl w-full max-w-md relative overflow-hidden shadow-2xl my-auto max-h-[90vh] overflow-y-auto"
      >
        <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-accent-primary via-accent-secondary to-accent-primary" />
        
        <div className="flex justify-between items-center mb-6">
          <h3 className="text-sm font-semibold tracking-wide uppercase text-text-primary flex items-center gap-2">
            <Terminal className="w-5 h-5 text-accent-primary" />
            {mode === 'epic' ? 'Add Epic' : mode === 'story' ? 'Add Story' : 'Add Task'}
          </h3>
          <button onClick={onClose} className="p-1.5 rounded-md hover:bg-[var(--pm-surface)]/5 text-text-quaternary hover:text-text-primary transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <label className="block text-[10px] font-medium uppercase tracking-widest text-text-tertiary">
              {mode === 'epic' ? 'Epic Name' : mode === 'story' ? 'Story Title' : 'Task Title'} <span className="text-signal-error">*</span>
            </label>
            <input type="text" required value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Implement Authentication" className="input-premium w-full h-11 px-4 text-sm outline-none transition-all placeholder:text-text-quaternary" />
          </div>

          <div className="space-y-1.5">
            <label className="block text-[10px] font-medium uppercase tracking-widest text-text-tertiary">Target Project <span className="text-signal-error">*</span></label>
            {defaultProjectId ? (
              <div className="w-full bg-surface-2/50 border border-border/30 p-2.5 text-sm text-text-secondary rounded-lg">
                {projects.find(p => p.id === defaultProjectId)?.name || projects[0]?.name}
              </div>
            ) : (
              <select required value={projectId} onChange={e => setProjectId(e.target.value)} className="input-premium w-full h-11 px-4 text-sm outline-none transition-all cursor-pointer">
                <option value="">-- SELECT PROJECT --</option>
                {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            )}
          </div>

          {mode === 'task' && projectId && (
            <div className="grid grid-cols-2 gap-4 border border-border/30 rounded-xl p-4 bg-surface-2/30">
              <div className="space-y-1.5">
                <label className="block text-[10px] font-medium uppercase tracking-widest text-text-tertiary">Epic (Optional)</label>
                <select value={epicId} onChange={e => { setEpicId(e.target.value); setStoryId(''); }} className="input-premium w-full h-9 px-3 text-sm outline-none transition-all cursor-pointer">
                  <option value="">None</option>
                  {epics.map(ep => <option key={ep.id} value={ep.id}>{ep.uid_code} - {ep.name}</option>)}
                </select>
              </div>
              <div className="space-y-1.5">
                <label className="block text-[10px] font-medium uppercase tracking-widest text-text-tertiary">Story (Optional)</label>
                <select value={storyId} onChange={e => {
                  setStoryId(e.target.value);
                  if (e.target.value && !epicId) {
                    const linkedEpic = stories.find(s => s.id === e.target.value)?.epic_id;
                    if (linkedEpic) setEpicId(linkedEpic);
                  }
                }} className="input-premium w-full h-9 px-3 text-sm outline-none transition-all cursor-pointer">
                  <option value="">None</option>
                  {filteredStories.map(st => <option key={st.id} value={st.id}>{st.title}</option>)}
                </select>
              </div>
              <div className="col-span-2 space-y-1.5">
                <label className="block text-[10px] font-medium uppercase tracking-widest text-text-tertiary">Module (Optional)</label>
                <select value={moduleId} onChange={e => setModuleId(e.target.value)} className="input-premium w-full h-9 px-3 text-sm outline-none transition-all cursor-pointer">
                  <option value="">None</option>
                  {modules.map(md => <option key={md.id} value={md.id}>{md.name}</option>)}
                </select>
              </div>
            </div>
          )}

          <div className="space-y-1.5">
            <label className="block text-[10px] font-medium uppercase tracking-widest text-text-tertiary">Description</label>
            <textarea value={description} onChange={e => setDescription(e.target.value)} placeholder="Technical specs, links, etc." rows={2} className="input-premium w-full p-4 text-sm outline-none transition-all resize-none" />
          </div>

          <div className="flex flex-col sm:flex-row gap-4">
            <div className="flex-1 space-y-1.5">
              <label className="block text-[10px] font-medium uppercase tracking-widest text-text-tertiary">Hours</label>
              <input type="number" min="0.5" step="0.5" value={estimatedHours} onChange={e => setEstimatedHours(Number(e.target.value))} className="input-premium w-full h-11 px-4 text-sm outline-none transition-all" />
            </div>
            <div className="flex-1 space-y-1.5">
              <label className="block text-[10px] font-medium uppercase tracking-widest text-text-tertiary">Assignee</label>
              <AssigneePicker users={users} value={assigneeId} onChange={setAssigneeId} contextText={name} />
            </div>
          </div>

          <div className="pt-4 mt-2 flex justify-end gap-3 border-t border-[var(--pm-border)] dark:border-[var(--border-soft)]">
            <button type="button" onClick={onClose} className="btn-premium-secondary px-5 py-2 text-[11px] font-bold uppercase tracking-widest rounded-lg transition-all">Cancel</button>
            <button type="submit" disabled={isSubmitting} className="btn-premium-primary px-6 py-2 text-[11px] font-bold uppercase tracking-widest rounded-lg transition-all disabled:opacity-50">
              {isSubmitting ? 'Processing...' : 'Create'}
            </button>
          </div>
        </form>
      </motion.div>
    </div>
  );
}
