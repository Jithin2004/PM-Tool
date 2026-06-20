import React, { useState, useEffect } from 'react';
import { sprintService, Sprint, SprintHealth } from '../../../services/sprintService';
import { Task } from '../../../types';
import { DroppableSprintZone } from '../../../components/execution/dragDrop/DroppableSprintZone';
import { useAuth } from '../../../context/AuthContext';
import { Calendar, AlertCircle, CheckCircle, Package } from 'lucide-react';

interface SprintPlanningPanelProps {
  projectId: string;
  workspaceId: string;
  onTaskDropped: (taskId: string, sprintId: string) => void;
  onTaskRemoved: (taskId: string, sprintId: string) => void;
  sprintTasks: Record<string, Task[]>; // Key is sprint ID
  triggerReload: () => void;
}

export const SprintPlanningPanel: React.FC<SprintPlanningPanelProps> = ({
  projectId,
  workspaceId,
  onTaskDropped,
  onTaskRemoved,
  sprintTasks,
  triggerReload
}) => {
  const { user } = useAuth();
  const [sprints, setSprints] = useState<Sprint[]>([]);
  const [loading, setLoading] = useState(true);
  const [healthMap, setHealthMap] = useState<Record<string, SprintHealth>>({});

  useEffect(() => {
    loadSprints();
  }, [projectId]);

  const loadSprints = async () => {
    setLoading(true);
    const data = await sprintService.getSprints(workspaceId, projectId);
    const planningSprints = data.filter(s => s.status === 'planning' || s.status === 'active');
    setSprints(planningSprints);
    
    // Calculate Health for each sprint
    const hMap: Record<string, SprintHealth> = {};
    for (const sprint of planningSprints) {
      const tasks = sprintTasks[sprint.id] || [];
      // Mock capacity hours for now, should ideally fetch from calendar
      const mockCapacity = 320; 
      hMap[sprint.id] = await sprintService.getSprintHealth(tasks, mockCapacity);
    }
    setHealthMap(hMap);
    
    setLoading(false);
  };

  const handleDrop = async (item: { id: string; type: string; data: any }, sprint: Sprint) => {
    if (item.type === 'task') {
      const task = item.data as Task;
      if (task.status === 'completed' || task.status === 'done') {
        alert("Completed work cannot be planned into a new sprint.");
        return;
      }
      onTaskDropped(task.id, sprint.id);
    }
  };

  const handleStartSprint = async (sprintId: string) => {
    await sprintService.startSprint(sprintId, workspaceId, user?.id);
    loadSprints();
    triggerReload();
  };

  if (loading) return <div className="p-4 text-slate-400">Loading Sprints...</div>;

  return (
    <div className="flex flex-col gap-4 h-full overflow-y-auto pr-2">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-medium text-slate-200">Sprint Planning</h2>
        <button className="text-xs bg-indigo-600 hover:bg-indigo-500 text-white px-3 py-1.5 rounded transition">
          + New Sprint
        </button>
      </div>

      {sprints.map(sprint => {
        const tasks = sprintTasks[sprint.id] || [];
        const health = healthMap[sprint.id];
        
        return (
          <DroppableSprintZone
            key={sprint.id}
            id={sprint.id}
            accepts={['task']}
            onDrop={(item) => handleDrop(item, sprint)}
            className="bg-slate-800/40 border border-slate-700/50 rounded-xl overflow-hidden flex flex-col"
            activeClassName="bg-indigo-500/10 border-indigo-500/50 border-dashed"
          >
            <div className="p-4 border-b border-slate-700/50 flex flex-col gap-2">
              <div className="flex justify-between items-start">
                <div>
                  <h3 className="font-medium text-slate-200 flex items-center gap-2">
                    <Calendar size={16} className="text-indigo-400" />
                    {sprint.name}
                  </h3>
                  {sprint.goal && <p className="text-xs text-slate-400 mt-1">Goal: {sprint.goal}</p>}
                </div>
                <span className={`text-xs px-2 py-1 rounded uppercase tracking-wider ${sprint.status === 'active' ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/20' : 'bg-slate-700 text-slate-300'}`}>
                  {sprint.status}
                </span>
              </div>
              
              {health && (
                <div className={`mt-2 p-2 rounded text-xs border ${health.status === 'healthy' ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400' : health.status === 'warning' ? 'bg-amber-500/10 border-amber-500/20 text-amber-400' : 'bg-rose-500/10 border-rose-500/20 text-rose-400'}`}>
                  <div className="flex items-center gap-1 font-medium mb-1">
                    {health.status === 'healthy' ? <CheckCircle size={14} /> : <AlertCircle size={14} />}
                    Capacity: {health.committed_hours}h / {health.available_hours}h
                  </div>
                  {health.reasons[0]}
                </div>
              )}
            </div>

            <div className="p-2 flex-1 min-h-[100px] max-h-[300px] overflow-y-auto space-y-2">
              {tasks.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-slate-500 py-6">
                  <Package size={24} className="mb-2 opacity-50" />
                  <p className="text-xs">Drag tasks here</p>
                </div>
              ) : (
                tasks.map(task => (
                  <div key={task.id} className="p-2 border border-slate-700/50 bg-slate-900/50 rounded-lg flex justify-between items-center group">
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-mono bg-slate-800 text-slate-400 px-1.5 py-0.5 rounded">{task.uid}</span>
                      <span className="text-xs text-slate-300 truncate max-w-[120px]" title={task.name}>{task.name}</span>
                    </div>
                    <button 
                      onClick={() => onTaskRemoved(task.id, sprint.id)}
                      className="text-slate-500 hover:text-rose-400 opacity-0 group-hover:opacity-100 transition"
                    >
                      ×
                    </button>
                  </div>
                ))
              )}
            </div>
            
            {sprint.status === 'planning' && (
              <div className="p-3 bg-slate-900/30 border-t border-slate-700/50">
                <button 
                  onClick={() => handleStartSprint(sprint.id)}
                  className="w-full py-1.5 bg-indigo-600/20 hover:bg-indigo-600/30 text-indigo-400 text-xs font-medium rounded border border-indigo-500/30 transition"
                >
                  Start Sprint
                </button>
              </div>
            )}
          </DroppableSprintZone>
        );
      })}
    </div>
  );
};
