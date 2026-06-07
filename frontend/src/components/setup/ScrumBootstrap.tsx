import React, { useState } from 'react';
import { Layers, ListOrdered, ClipboardList, Target, Plus, ChevronDown, ChevronRight, X } from 'lucide-react';
import { supabase, isSupabaseConfigured } from '../../lib/supabase';

interface ScrumBootstrapProps {
  projectId: string;
  workspaceId: string;
  onComplete: () => void;
  onSkip: () => void;
}

interface EpicDraft {
  name: string;
  description: string;
}

interface StoryDraft {
  title: string;
  description: string;
  epic_id?: string;
  story_points: number;
}

interface TaskDraft {
  name: string;
  description: string;
  priority: string;
}

interface SprintDraft {
  name: string;
  goal: string;
  durationWeeks: number;
}

export function ScrumBootstrap({ projectId, workspaceId, onComplete, onSkip }: ScrumBootstrapProps) {
  const [expandedSection, setExpandedSection] = useState<string | null>('epics');
  const [epics, setEpics] = useState<EpicDraft[]>([]);
  const [stories, setStories] = useState<StoryDraft[]>([]);
  const [tasks, setTasks] = useState<TaskDraft[]>([]);
  const [sprint, setSprint] = useState<SprintDraft>({ name: 'Sprint 1', goal: '', durationWeeks: 2 });
  const [saving, setSaving] = useState(false);

  const [newEpic, setNewEpic] = useState<EpicDraft>({ name: '', description: '' });
  const [newStory, setNewStory] = useState<StoryDraft>({ title: '', description: '', story_points: 1 });
  const [newTask, setNewTask] = useState<TaskDraft>({ name: '', description: '', priority: 'medium' });

  const toggleSection = (id: string) => {
    setExpandedSection(prev => prev === id ? null : id);
  };

  const addEpic = () => {
    if (!newEpic.name.trim()) return;
    setEpics(prev => [...prev, { ...newEpic }]);
    setNewEpic({ name: '', description: '' });
  };

  const addStory = () => {
    if (!newStory.title.trim()) return;
    setStories(prev => [...prev, { ...newStory }]);
    setNewStory({ title: '', description: '', epic_id: newStory.epic_id, story_points: 1 });
  };

  const addTask = () => {
    if (!newTask.name.trim()) return;
    setTasks(prev => [...prev, { ...newTask }]);
    setNewTask({ name: '', description: '', priority: 'medium' });
  };

  const removeItem = (type: 'epics' | 'stories' | 'tasks', index: number) => {
    if (type === 'epics') setEpics(prev => prev.filter((_, i) => i !== index));
    if (type === 'stories') setStories(prev => prev.filter((_, i) => i !== index));
    if (type === 'tasks') setTasks(prev => prev.filter((_, i) => i !== index));
  };

  const handleSave = async () => {
    if (!isSupabaseConfigured || !workspaceId) return;
    setSaving(true);

    const now = new Date().toISOString();

    for (const epic of epics) {
      await supabase.from('epics').insert({
        workspace_id: workspaceId,
        project_id: projectId,
        name: epic.name,
        description: epic.description || null,
        status: 'backlog',
        priority: 'medium',
        created_at: now,
        updated_at: now,
      });
    }

    for (const story of stories) {
      await supabase.from('user_stories').insert({
        workspace_id: workspaceId,
        project_id: projectId,
        title: story.title,
        description: story.description || null,
        story_points: story.story_points,
        priority: 'medium',
        status: 'backlog',
        epic_id: story.epic_id || null,
        created_at: now,
        updated_at: now,
      });
    }

    for (const task of tasks) {
      await supabase.from('tasks').insert({
        workspace_id: workspaceId,
        project_id: projectId,
        name: task.name,
        description: task.description || null,
        status: 'backlog',
        priority: task.priority,
        estimated_hours: 0,
        delay_drift_days: 0,
        created_at: now,
        updated_at: now,
      });
    }

    if (sprint.name.trim()) {
      const startDate = new Date();
      const endDate = new Date(startDate);
      endDate.setDate(endDate.getDate() + sprint.durationWeeks * 7);

      await supabase.from('sprints').insert({
        workspace_id: workspaceId,
        project_id: projectId,
        name: sprint.name,
        goal: sprint.goal || null,
        start_date: startDate.toISOString().split('T')[0],
        end_date: endDate.toISOString().split('T')[0],
        status: 'planned',
        velocity_committed: 0,
        velocity_completed: 0,
        created_at: now,
        updated_at: now,
      });
    }

    setSaving(false);
    onComplete();
  };

  const hasAnyContent = epics.length > 0 || stories.length > 0 || tasks.length > 0 || sprint.name.trim();

  const sectionHeader = (id: string, icon: React.ReactNode, label: string, count: number) => (
    <button
      onClick={() => toggleSection(id)}
      className="flex items-center justify-between w-full p-3 border border-border rounded-sm bg-surface-3 hover:bg-surface-3 transition-colors"
    >
      <div className="flex items-center gap-2">
        {expandedSection === id ? <ChevronDown className="w-3.5 h-3.5 text-text-quaternary" /> : <ChevronRight className="w-3.5 h-3.5 text-text-quaternary" />}
        {icon}
        <span className="text-xs font-mono uppercase tracking-wider text-text-tertiary">{label}</span>
        {count > 0 && <span className="text-[9px] font-mono text-text-quaternary bg-[var(--pm-surface)]/5 px-1.5 py-0.5 rounded-sm">{count}</span>}
      </div>
    </button>
  );

  const inputClass = "w-full bg-[var(--pm-surface)]/5 border border-border rounded-sm px-3 py-1.5 text-xs font-mono text-text-secondary placeholder-white/20 outline-none focus:border-border focus:text-text-primary transition-colors";
  const labelClass = "text-[9px] font-mono uppercase tracking-wider text-text-quaternary";

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-3 pb-4 border-b border-border">
        <Target className="w-5 h-5 text-accent-secondary" />
        <div>
          <h3 className="text-sm font-sans tracking-tight uppercase tracking-wide text-text-secondary">Scrum Setup</h3>
          <p className="text-[10px] text-text-quaternary mt-0.5">Create epics, stories, tasks, and your first sprint</p>
        </div>
      </div>

      {/* Epics */}
      <div className="space-y-1">
        {sectionHeader('epics', <Layers className="w-4 h-4 text-pink-400" />, 'Epics', epics.length)}
        {expandedSection === 'epics' && (
          <div className="p-3 border border-border-subtle rounded-sm space-y-3">
            {epics.map((epic, i) => (
              <div key={i} className="flex items-center justify-between p-2 bg-surface-3 border border-border-subtle rounded-sm">
                <div>
                  <span className="text-xs text-text-secondary">{epic.name}</span>
                  {epic.description && <p className="text-[9px] text-text-quaternary mt-0.5">{epic.description}</p>}
                </div>
                <button onClick={() => removeItem('epics', i)} className="text-text-quaternary hover:text-text-tertiary"><X className="w-3 h-3" /></button>
              </div>
            ))}
            <div className="grid grid-cols-[1fr_auto] gap-2">
              <input
                value={newEpic.name}
                onChange={e => setNewEpic(prev => ({ ...prev, name: e.target.value }))}
                placeholder="Epic name"
                className={inputClass}
                onKeyDown={e => e.key === 'Enter' && addEpic()}
              />
              <button onClick={addEpic} className="px-3 py-1.5 bg-[var(--pm-surface)]/10 text-text-primary text-[10px] font-medium uppercase tracking-wider hover:bg-[var(--pm-surface)]/20 transition-all rounded-sm flex items-center gap-1">
                <Plus className="w-3 h-3" /> Add
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Stories */}
      <div className="space-y-1">
        {sectionHeader('stories', <ListOrdered className="w-4 h-4 text-signal-warning" />, 'Stories', stories.length)}
        {expandedSection === 'stories' && (
          <div className="p-3 border border-border-subtle rounded-sm space-y-3">
            {stories.map((story, i) => (
              <div key={i} className="flex items-center justify-between p-2 bg-surface-3 border border-border-subtle rounded-sm">
                <div>
                  <span className="text-xs text-text-secondary">{story.title}</span>
                  <div className="flex gap-2 mt-0.5">
                    {story.story_points > 0 && <span className="text-[9px] text-text-quaternary">{story.story_points}pt</span>}
                  </div>
                </div>
                <button onClick={() => removeItem('stories', i)} className="text-text-quaternary hover:text-text-tertiary"><X className="w-3 h-3" /></button>
              </div>
            ))}
            <div className="grid grid-cols-[1fr_80px_auto] gap-2">
              <input
                value={newStory.title}
                onChange={e => setNewStory(prev => ({ ...prev, title: e.target.value }))}
                placeholder="Story title"
                className={inputClass}
                onKeyDown={e => e.key === 'Enter' && addStory()}
              />
              <input
                type="number"
                min={1}
                value={newStory.story_points}
                onChange={e => setNewStory(prev => ({ ...prev, story_points: parseInt(e.target.value) || 1 }))}
                className={inputClass}
                placeholder="Pts"
              />
              <button onClick={addStory} className="px-3 py-1.5 bg-[var(--pm-surface)]/10 text-text-primary text-[10px] font-medium uppercase tracking-wider hover:bg-[var(--pm-surface)]/20 transition-all rounded-sm flex items-center gap-1">
                <Plus className="w-3 h-3" /> Add
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Tasks */}
      <div className="space-y-1">
        {sectionHeader('tasks', <ClipboardList className="w-4 h-4 text-signal-info" />, 'Tasks', tasks.length)}
        {expandedSection === 'tasks' && (
          <div className="p-3 border border-border-subtle rounded-sm space-y-3">
            {tasks.map((task, i) => (
              <div key={i} className="flex items-center justify-between p-2 bg-surface-3 border border-border-subtle rounded-sm">
                <div className="flex items-center gap-2">
                  <span className="text-xs text-text-secondary">{task.name}</span>
                  <span className="text-[9px] text-text-quaternary uppercase">{task.priority}</span>
                </div>
                <button onClick={() => removeItem('tasks', i)} className="text-text-quaternary hover:text-text-tertiary"><X className="w-3 h-3" /></button>
              </div>
            ))}
            <div className="grid grid-cols-[1fr_auto] gap-2">
              <input
                value={newTask.name}
                onChange={e => setNewTask(prev => ({ ...prev, name: e.target.value }))}
                placeholder="Task name"
                className={inputClass}
                onKeyDown={e => e.key === 'Enter' && addTask()}
              />
              <button onClick={addTask} className="px-3 py-1.5 bg-[var(--pm-surface)]/10 text-text-primary text-[10px] font-medium uppercase tracking-wider hover:bg-[var(--pm-surface)]/20 transition-all rounded-sm flex items-center gap-1">
                <Plus className="w-3 h-3" /> Add
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Sprint */}
      <div className="space-y-1">
        {sectionHeader('sprint', <Target className="w-4 h-4 text-signal-safe" />, 'First Sprint', sprint.name.trim() ? 1 : 0)}
        {expandedSection === 'sprint' && (
          <div className="p-3 border border-border-subtle rounded-sm space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className={labelClass}>Sprint Name</label>
                <input
                  value={sprint.name}
                  onChange={e => setSprint(prev => ({ ...prev, name: e.target.value }))}
                  className={inputClass}
                  placeholder="Sprint 1"
                />
              </div>
              <div className="space-y-1">
                <label className={labelClass}>Duration</label>
                <select
                  value={sprint.durationWeeks}
                  onChange={e => setSprint(prev => ({ ...prev, durationWeeks: parseInt(e.target.value) }))}
                  className={inputClass}
                >
                  <option value={1}>1 Week</option>
                  <option value={2}>2 Weeks</option>
                  <option value={3}>3 Weeks</option>
                  <option value={4}>4 Weeks</option>
                </select>
              </div>
            </div>
            <div className="space-y-1">
              <label className={labelClass}>Sprint Goal</label>
              <input
                value={sprint.goal}
                onChange={e => setSprint(prev => ({ ...prev, goal: e.target.value }))}
                className={inputClass}
                placeholder="What should this sprint achieve?"
              />
            </div>
          </div>
        )}
      </div>

      <div className="flex items-center gap-3 pt-4 border-t border-border">
        <button
          onClick={handleSave}
          disabled={saving}
          className="px-4 py-2 bg-accent-primary text-[var(--pm-text)] text-[var(--text-primary)] text-[10px] font-medium uppercase tracking-wider hover:bg-accent-primary/90 transition-all rounded-sm disabled:opacity-50 shadow-sm cursor-pointer"
        >
          {saving ? 'Saving...' : hasAnyContent ? 'Save & Continue' : 'Skip — Go to Backlog'}
        </button>
        <button
          onClick={onSkip}
          className="px-4 py-2 text-text-quaternary text-[10px] font-medium uppercase tracking-wider hover:text-text-tertiary transition-all"
        >
          Skip Setup
        </button>
      </div>
    </div>
  );
}
