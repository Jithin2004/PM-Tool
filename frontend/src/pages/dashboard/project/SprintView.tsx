import React, { useState, useEffect } from 'react';
import { sprintService, Sprint, SprintHealth } from '../../../services/sprintService';
import { useAuth } from '../../../context/AuthContext';
import { Task } from '../../../types';
import { Calendar, AlertCircle, CheckCircle, Package, Flag, Target, ShieldAlert } from 'lucide-react';
import { supabase } from '../../../lib/supabase';

function getProjectIdFromPath(): string | null {
  const segments = window.location.pathname.split('/');
  if (segments[1] === 'projects' && segments[2]) return segments[2];
  return null;
}

export const SprintView: React.FC = () => {
  const projectId = getProjectIdFromPath();
  const { currentWorkspace, user } = useAuth();
  
  const [sprint, setSprint] = useState<Sprint | null>(null);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [health, setHealth] = useState<SprintHealth | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (projectId && currentWorkspace) {
      loadActiveSprint();
    }
  }, [projectId, currentWorkspace]);

  const loadActiveSprint = async () => {
    setLoading(true);
    const active = await sprintService.getActiveSprint(currentWorkspace!.id, projectId!);
    setSprint(active);
    
    if (active) {
      const { data: sprintTasks } = await supabase
        .from('tasks')
        .select('*')
        .eq('sprint_id', active.id);
        
      setTasks(sprintTasks || []);
      
      const mockCapacity = 320; // In a full prod version, fetched via calendar engine
      const sprintHealth = await sprintService.getSprintHealth(sprintTasks || [], mockCapacity);
      setHealth(sprintHealth);
    }
    setLoading(false);
  };

  const handleCompleteSprint = async () => {
    if (!sprint || !currentWorkspace) return;
    
    const incompleteTasks = tasks.filter(t => t.status !== 'completed' && t.status !== 'done');
    const incompleteIds = incompleteTasks.map(t => t.id);
    
    // Simplistic prompt for carry forward
    const confirm = window.confirm(`There are ${incompleteTasks.length} incomplete tasks. Move them back to the backlog and complete sprint?`);
    if (!confirm) return;

    const snapshotData = {
      total_tasks: tasks.length,
      completed: tasks.length - incompleteTasks.length,
      carried_forward: incompleteTasks.length,
      velocity_hours: tasks.filter(t => t.status === 'completed' || t.status === 'done').reduce((acc, t) => acc + (Number(t.estimated_hours) || 0), 0),
      planned_capacity: health?.available_hours || 0,
      blockers: health?.blockers_count || 0
    };

    await sprintService.completeSprint(
      sprint.id, 
      currentWorkspace.id, 
      snapshotData, 
      incompleteIds, 
      'backlog', 
      undefined, 
      user?.id
    );
    
    loadActiveSprint();
  };

  if (loading) return <div className="p-8 text-slate-400">Loading Active Sprint...</div>;

  if (!sprint) {
    return (
      <div className="p-8 text-center max-w-lg mx-auto mt-12">
        <div className="bg-slate-800/40 border border-slate-700/50 p-8 rounded-2xl">
          <Calendar size={48} className="mx-auto text-slate-500 mb-4" />
          <h2 className="text-xl font-medium text-slate-200 mb-2">No Active Sprint</h2>
          <p className="text-slate-400 mb-6">There is currently no active sprint for this project. Go to the Backlog to plan and start a new sprint.</p>
        </div>
      </div>
    );
  }

  const completedCount = tasks.filter(t => t.status === 'completed' || t.status === 'done').length;
  const progressPercent = tasks.length === 0 ? 0 : Math.round((completedCount / tasks.length) * 100);

  return (
    <div className="p-6 max-w-7xl mx-auto h-full flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <span className="bg-emerald-500/20 text-emerald-400 border border-emerald-500/20 text-xs px-2 py-1 rounded uppercase tracking-wider font-semibold">Active Sprint</span>
            <h1 className="text-2xl font-semibold text-slate-100 tracking-tight">{sprint.name}</h1>
          </div>
          <p className="text-slate-400 flex items-center gap-2">
            <Calendar size={14} />
            {new Date(sprint.start_date).toLocaleDateString()} - {new Date(sprint.end_date).toLocaleDateString()}
          </p>
        </div>
        
        <div>
          <button 
            onClick={handleCompleteSprint}
            className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg shadow-lg shadow-emerald-900/20 transition flex items-center gap-2 font-medium"
          >
            <CheckCircle size={18} /> Complete Sprint
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Goal & Progress Card */}
        <div className="col-span-1 lg:col-span-2 bg-slate-800/40 border border-slate-700/50 rounded-2xl p-6 flex flex-col justify-between">
          <div>
            <h3 className="text-sm font-medium text-slate-400 uppercase tracking-wider mb-2 flex items-center gap-2">
              <Target size={16} /> Sprint Goal
            </h3>
            <p className="text-lg text-slate-200">{sprint.goal || "No specific goal set for this sprint."}</p>
          </div>
          
          <div className="mt-8">
            <div className="flex justify-between items-end mb-2">
              <span className="text-sm font-medium text-slate-300">Overall Progress</span>
              <span className="text-2xl font-bold text-indigo-400">{progressPercent}%</span>
            </div>
            <div className="w-full bg-slate-900/50 rounded-full h-3 border border-slate-700/50 overflow-hidden">
              <div className="bg-indigo-500 h-3 rounded-full transition-all duration-1000" style={{ width: `${progressPercent}%` }}></div>
            </div>
          </div>
        </div>

        {/* Health Card */}
        <div className="col-span-1 bg-slate-800/40 border border-slate-700/50 rounded-2xl p-6">
          <h3 className="text-sm font-medium text-slate-400 uppercase tracking-wider mb-4 flex items-center gap-2">
            <ShieldAlert size={16} /> Sprint Health
          </h3>
          
          {health && (
            <div className={`p-4 rounded-xl border ${health.status === 'healthy' ? 'bg-emerald-500/10 border-emerald-500/20' : health.status === 'warning' ? 'bg-amber-500/10 border-amber-500/20' : 'bg-rose-500/10 border-rose-500/20'}`}>
              <div className="flex items-center gap-2 font-semibold mb-2 text-lg">
                {health.status === 'healthy' ? <CheckCircle className="text-emerald-500" /> : <AlertCircle className={health.status === 'warning' ? 'text-amber-500' : 'text-rose-500'} />}
                <span className={health.status === 'healthy' ? 'text-emerald-400' : health.status === 'warning' ? 'text-amber-400' : 'text-rose-400'}>
                  {health.status.toUpperCase()}
                </span>
              </div>
              <ul className="space-y-1 mt-3">
                {health.reasons.map((r, i) => (
                  <li key={i} className={`text-sm ${health.status === 'healthy' ? 'text-emerald-400/80' : health.status === 'warning' ? 'text-amber-400/80' : 'text-rose-400/80'}`}>• {r}</li>
                ))}
              </ul>
            </div>
          )}

          <div className="mt-6 grid grid-cols-2 gap-4">
            <div className="bg-slate-900/50 rounded-lg p-3 border border-slate-700/30">
              <span className="text-xs text-slate-500 block mb-1">Capacity</span>
              <span className="text-lg font-medium text-slate-200">{health?.committed_hours} <span className="text-sm text-slate-500">/ {health?.available_hours}h</span></span>
            </div>
            <div className="bg-slate-900/50 rounded-lg p-3 border border-slate-700/30">
              <span className="text-xs text-slate-500 block mb-1">Blockers</span>
              <span className="text-lg font-medium text-rose-400">{health?.blockers_count}</span>
            </div>
          </div>
        </div>

      </div>

      {/* Task List */}
      <div className="bg-slate-800/40 border border-slate-700/50 rounded-2xl flex-1 overflow-hidden flex flex-col">
        <div className="p-4 border-b border-slate-700/50 bg-slate-800/80 flex items-center justify-between">
          <h3 className="font-medium text-slate-200">Sprint Backlog ({tasks.length})</h3>
          <div className="flex gap-4 text-sm">
            <span className="text-emerald-400">{completedCount} Done</span>
            <span className="text-indigo-400">{tasks.length - completedCount - (health?.blockers_count || 0)} Active</span>
            <span className="text-rose-400">{health?.blockers_count} Blocked</span>
          </div>
        </div>
        <div className="p-4 overflow-y-auto space-y-2">
          {tasks.map(task => (
            <div key={task.id} className="p-3 bg-slate-900/40 border border-slate-700/30 rounded-lg flex items-center justify-between hover:bg-slate-800/50 transition">
              <div className="flex items-center gap-3">
                <span className="text-xs font-mono bg-slate-800 text-slate-400 px-2 py-1 rounded">{task.uid}</span>
                <span className={`text-sm ${task.status === 'done' || task.status === 'completed' ? 'text-slate-500 line-through' : 'text-slate-200'}`}>
                  {task.name}
                </span>
              </div>
              <div className="flex items-center gap-4">
                {task.estimated_hours && <span className="text-xs text-slate-500">{task.estimated_hours}h</span>}
                <span className={`text-xs px-2 py-1 rounded border ${task.status === 'blocked' ? 'bg-rose-500/10 text-rose-400 border-rose-500/20' : task.status === 'done' || task.status === 'completed' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' : 'bg-indigo-500/10 text-indigo-400 border-indigo-500/20'}`}>
                  {task.status}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>

    </div>
  );
};
