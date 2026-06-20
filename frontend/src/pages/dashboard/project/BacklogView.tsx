import React, { useState, useEffect } from 'react';
import { ExecutionGuide } from '../../../components/execution/ExecutionGuide';
import { backlogService, BacklogData } from '../../../services/backlogService';
import { sprintService } from '../../../services/sprintService';
import { Search, Filter, Plus, Package, BookOpen, Layers, Columns } from 'lucide-react';
import { DraggableWorkItem } from '../../../components/execution/dragDrop/DraggableWorkItem';
import { SprintPlanningPanel } from './SprintPlanningPanel';
import { useAuth } from '../../../context/AuthContext';
import { Task } from '../../../types';
import { PremiumEmptyState } from '../../../components/ui/PremiumEmptyState';

function getProjectIdFromPath(): string | null {
  const segments = window.location.pathname.split('/');
  if (segments[1] === 'projects' && segments[2]) return segments[2];
  return null;
}

export const BacklogView: React.FC = () => {
  const projectId = getProjectIdFromPath();
  const { currentWorkspace } = useAuth();
  const [data, setData] = useState<BacklogData | null>(null);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [isPlanningMode, setIsPlanningMode] = useState(false);
  const [sprintTasks, setSprintTasks] = useState<Record<string, Task[]>>({});

  useEffect(() => {
    if (projectId) {
      loadBacklog();
      loadSprintTasks();
    }
  }, [projectId]);

  const loadBacklog = async () => {
    setLoading(true);
    const result = await backlogService.getProjectBacklog(projectId!);
    setData(result);
    setLoading(false);
  };

  const loadSprintTasks = async () => {
    // In a real app we would have an endpoint to get tasks by sprint array,
    // here we just fetch all tasks for the project and group them.
    const { supabase } = await import('../../../lib/supabase');
    const { data: allTasks } = await supabase.from('tasks').select('*').eq('project_id', projectId!).not('sprint_id', 'is', null);
    
    if (allTasks) {
      const grouped: Record<string, Task[]> = {};
      allTasks.forEach(t => {
        if (!grouped[t.sprint_id]) grouped[t.sprint_id] = [];
        grouped[t.sprint_id].push(t);
      });
      setSprintTasks(grouped);
    }
  };

  const handleTaskDroppedToSprint = async (taskId: string, sprintId: string) => {
    if (!currentWorkspace?.id) return;
    await sprintService.addTaskToSprint(taskId, sprintId, currentWorkspace.id);
    loadBacklog();
    loadSprintTasks();
  };

  const handleTaskRemovedFromSprint = async (taskId: string, sprintId: string) => {
    if (!currentWorkspace?.id) return;
    await sprintService.removeTaskFromSprint(taskId, sprintId, currentWorkspace.id);
    loadBacklog();
    loadSprintTasks();
  };

  if (loading && !data) {
    return <div className="p-8 text-slate-400">Loading Backlog...</div>;
  }

  const renderTask = (task: any) => (
    <DraggableWorkItem key={task.id} id={task.id} type="task" data={task} isDisabled={!isPlanningMode}>
      <div className={`p-3 ${isPlanningMode ? 'cursor-grab active:cursor-grabbing hover:bg-slate-700/50' : 'hover:bg-slate-800/50'} transition-colors flex items-center justify-between border border-slate-700/30 bg-slate-900/20 rounded-lg`}>
        <div className="flex items-center gap-3">
          <span className="text-xs font-mono bg-slate-800 text-slate-400 px-2 py-1 rounded">{task.uid || 'PRJ-N/A'}</span>
          <span className="text-sm text-slate-300">{task.name}</span>
        </div>
        <span className="text-xs text-slate-500">{task.status}</span>
      </div>
    </DraggableWorkItem>
  );

  return (
    <div className={`p-6 max-w-[1600px] mx-auto h-full flex flex-col`}>
      <div className="flex items-center justify-between mb-6 shrink-0">
        <div>
          <h1 className="text-2xl font-semibold text-slate-100 tracking-tight">Project Backlog</h1>
          <p className="text-slate-400 mt-1">Organize epics, stories, and tasks for execution</p>
        </div>
        <div className="flex gap-3">
          <button 
            onClick={() => setIsPlanningMode(!isPlanningMode)}
            className={`px-4 py-2 rounded-lg transition flex items-center gap-2 ${isPlanningMode ? 'bg-indigo-600/20 text-indigo-400 border border-indigo-500/50' : 'bg-slate-800 text-slate-300 border border-slate-700 hover:bg-slate-700'}`}
          >
            <Columns size={16} /> {isPlanningMode ? 'Exit Planning Mode' : 'Sprint Planning'}
          </button>
          <button className="px-4 py-2 bg-slate-800 text-slate-200 rounded-lg hover:bg-slate-700 transition flex items-center gap-2">
            <Package size={16} /> New Epic
          </button>
          <button className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-500 transition shadow-lg shadow-indigo-900/20 flex items-center gap-2">
            <Plus size={16} /> Create Item
          </button>
        </div>
      </div>

      {!isPlanningMode && <ExecutionGuide />}

      <div className="mb-6 flex gap-4 shrink-0">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" size={18} />
          <input
            type="text"
            placeholder="Search UID, title, or keyword..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-slate-900/50 border border-slate-700/50 rounded-lg py-2 pl-10 pr-4 text-slate-200 placeholder-slate-500 focus:outline-none focus:border-indigo-500 transition-colors"
          />
        </div>
        <button className="px-4 py-2 bg-slate-800 border border-slate-700/50 text-slate-300 rounded-lg hover:bg-slate-700 transition flex items-center gap-2">
          <Filter size={16} /> Filters
        </button>
      </div>

      <div className={`flex flex-1 gap-6 overflow-hidden ${isPlanningMode ? 'flex-row' : 'flex-col'}`}>
        
        {/* Backlog Column */}
        <div className={`space-y-6 overflow-y-auto pr-2 ${isPlanningMode ? 'w-2/3' : 'w-full'}`}>
          {/* Inbox Section */}
          {data?.inbox && data.inbox.length > 0 && (
            <section>
              <h2 className="text-lg font-medium text-slate-300 mb-4 flex items-center gap-2">
                <Layers size={18} className="text-slate-500" /> Standalone Tasks (Inbox)
              </h2>
              <div className="space-y-2">
                {data.inbox.map(renderTask)}
              </div>
            </section>
          )}

          {/* Epics Section */}
          {data?.epics?.map(({ epic, stories, standalone_tasks }) => (
            <section key={epic.id} className="bg-slate-800/20 border border-slate-700/30 rounded-xl overflow-hidden">
              <div className="p-4 bg-slate-800/50 border-b border-slate-700/50 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-1.5 bg-indigo-500/20 text-indigo-400 rounded-lg"><Package size={18} /></div>
                  <h3 className="font-medium text-slate-200">{epic.uid_code} — {epic.name}</h3>
                </div>
                <button className="text-xs bg-slate-700/50 text-slate-300 hover:text-white px-3 py-1.5 rounded transition">
                  + Add Story
                </button>
              </div>
              
              <div className="p-2 space-y-4">
                {/* Stories under this Epic */}
                {stories.map(({ story, tasks }) => (
                  <div key={story.id} className="border border-slate-700/50 rounded-lg overflow-hidden bg-slate-900/30 ml-4">
                    <div className="p-3 bg-slate-800/40 border-b border-slate-700/50 flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <BookOpen size={16} className="text-emerald-500" />
                        <span className="text-xs font-mono text-emerald-400/80">{story.uid}</span>
                        <span className="text-sm font-medium text-slate-200">{story.title}</span>
                      </div>
                    </div>
                    <div className="p-2 space-y-2">
                      {tasks.map(renderTask)}
                      {tasks.length === 0 && (
                        <div className="p-4 text-xs text-slate-500 ml-6 italic">No tasks in this story yet.</div>
                      )}
                    </div>
                  </div>
                ))}

                {/* Standalone Epic Tasks */}
                <div className="space-y-2 ml-4">
                  {standalone_tasks.map(renderTask)}
                </div>
              </div>
            </section>
          ))}

          {data?.epics.length === 0 && data?.inbox.length === 0 && (
            <div className="max-w-md mx-auto mt-12">
              <PremiumEmptyState
                icon={Package}
                title="Backlog is empty"
                description="Start by creating an Epic to organize your high-level goals, or add tasks directly to the inbox."
                action={
                  <button className="btn-premium-primary px-6 py-2.5 rounded-lg text-sm font-semibold flex items-center gap-2 mx-auto">
                    <Plus className="w-4 h-4" /> Create First Item
                  </button>
                }
              />
            </div>
          )}
        </div>

        {/* Sprint Planning Column */}
        {isPlanningMode && (
          <div className="w-1/3 border-l border-slate-700/50 pl-6 shrink-0 h-full">
            <SprintPlanningPanel 
              projectId={projectId!} 
              workspaceId={currentWorkspace!.id} 
              onTaskDropped={handleTaskDroppedToSprint}
              onTaskRemoved={handleTaskRemovedFromSprint}
              sprintTasks={sprintTasks}
              triggerReload={loadSprintTasks}
            />
          </div>
        )}
      </div>
    </div>
  );
};
