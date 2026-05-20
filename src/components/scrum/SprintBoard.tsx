import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Shield, TrendingUp, TrendingDown, Target, Zap, Users, ChevronDown, Plus, X, Terminal } from 'lucide-react';
import type { Sprint, Task, User, Epic } from '../../types';
import { TaskCard } from '../task/TaskCard';
import { TaskCreateModal } from '../task/TaskCreateModal';
import { SCRUM_COLUMNS } from '../../constants/product';

interface SprintBoardProps {
  projectId: string;
  workspaceId: string;
  sprints: Sprint[];
  tasks: Task[];
  users: User[];
  epics: Epic[];
  currentUserProfile: User | null;
  notify: (msg: string, type: 'success' | 'error' | 'warning' | 'info') => void;
  onUpdateTaskStatus: (taskId: string, status: Task['status']) => Promise<void>;
  onCreateTask: (taskData: any) => Promise<void>;
  onCreateSprint: (sprint: Omit<Sprint, 'id' | 'created_at' | 'updated_at'>) => Promise<void>;
}

export function SprintBoard({ projectId, workspaceId, sprints, tasks, users, epics, currentUserProfile, notify, onUpdateTaskStatus, onCreateTask, onCreateSprint }: SprintBoardProps) {
  const [activeSprintId, setActiveSprintId] = useState<string | null>(sprints.find(s => s.status === 'active')?.id || null);
  const [isAddingTask, setIsAddingTask] = useState(false);
  const [isCreatingSprint, setIsCreatingSprint] = useState(false);
  const [sprintName, setSprintName] = useState('');
  const [sprintGoal, setSprintGoal] = useState('');
  const [sprintStart, setSprintStart] = useState('');
  const [sprintEnd, setSprintEnd] = useState('');
  const [sprintVelocity, setSprintVelocity] = useState(0);
  const [selectedEpic, setSelectedEpic] = useState<string | null>(null);

  const hasWriteAccess = currentUserProfile?.role === 'super_admin' || currentUserProfile?.role === 'pm';

  const sprintTasks = useMemo(() => {
    if (!activeSprintId) return tasks.filter(t => t.project_id === projectId);
    return tasks.filter(t => t.sprint_id === activeSprintId);
  }, [tasks, activeSprintId, projectId]);

  const activeSprint = useMemo(() => sprints.find(s => s.id === activeSprintId) || null, [sprints, activeSprintId]);

  const velocityData = useMemo(() => {
    if (!activeSprint) return { committed: 0, completed: 0, remaining: 0 };
    const committed = sprintTasks.reduce((sum, t) => sum + (t.story_points || 0), 0);
    const completed = sprintTasks.filter(t => t.status === 'done').reduce((sum, t) => sum + (t.story_points || 0), 0);
    return { committed, completed, remaining: committed - completed };
  }, [sprintTasks, activeSprint]);

  const burndownPoints = useMemo(() => {
    if (!activeSprint) return { totalDays: 0, daysElapsed: 0, ideal: 0, actual: 0, progress: 0 };
    const start = new Date(activeSprint.start_date);
    const end = new Date(activeSprint.end_date);
    const totalDays = Math.max(1, Math.ceil((end.getTime() - start.getTime()) / 86400000));
    const totalSP = velocityData.committed;
    const dailyRate = totalSP / totalDays;
    const now = new Date();
    const daysElapsed = Math.min(totalDays, Math.max(0, Math.ceil((now.getTime() - start.getTime()) / 86400000)));
    const ideal = Math.max(0, totalSP - dailyRate * daysElapsed);
    return { totalDays, daysElapsed, ideal, actual: velocityData.remaining, progress: totalSP > 0 ? Math.round((velocityData.completed / totalSP) * 100) : 0 };
  }, [activeSprint, velocityData]);

  const handleCreateSprint = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!sprintName || !sprintStart || !sprintEnd) { notify('Name, start, and end date required.', 'error'); return; }
    if (new Date(sprintEnd) <= new Date(sprintStart)) { notify('End must be after start.', 'error'); return; }
    await onCreateSprint({
      workspace_id: workspaceId, project_id: projectId, name: sprintName, goal: sprintGoal || null,
      start_date: sprintStart, end_date: sprintEnd, status: 'planned',
      velocity_committed: sprintVelocity, velocity_completed: 0
    });
    notify('Sprint created.', 'success');
    setSprintName(''); setSprintGoal(''); setSprintStart(''); setSprintEnd(''); setSprintVelocity(0);
    setIsCreatingSprint(false);
  };

  const handleStartSprint = async (sprintId: string) => {
    await fetch('/api/sprints/' + sprintId, { method: 'PATCH', body: JSON.stringify({ status: 'active' }) });
    setActiveSprintId(sprintId);
    notify('Sprint started.', 'success');
  };

  return (
    <div className="w-full bg-black/40 border border-white/5 rounded-sm p-4 sm:p-6 backdrop-blur-md relative overflow-hidden">
      <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-purple-500/80 via-pink-500/80 to-orange-500/80" />

      {/* Sprint selector header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6 border-b border-white/5 pb-4">
        <div className="flex items-center gap-4 flex-wrap">
          <div className="flex items-center gap-2">
            <Shield className="w-4 h-4 text-purple-400" />
            <h2 className="text-sm font-mono uppercase tracking-widest text-white">Sprint Board</h2>
          </div>
          <select value={activeSprintId || ''} onChange={e => setActiveSprintId(e.target.value || null)} className="bg-black border border-white/10 h-8 px-3 text-[10px] font-mono focus:border-white/30 outline-none">
            <option value="">All Tasks (No Sprint)</option>
            {sprints.map(s => <option key={s.id} value={s.id}>{s.name} ({s.status})</option>)}
          </select>
          {hasWriteAccess && (
            <button onClick={() => setIsCreatingSprint(true)} className="px-3 py-1.5 bg-purple-600 hover:bg-purple-500 text-white text-[9px] font-mono uppercase tracking-widest rounded-sm transition-all cursor-pointer">
              <Plus className="w-3 h-3 inline mr-1" /> New Sprint
            </button>
          )}
        </div>
        <div className="flex items-center gap-3">
          {hasWriteAccess && (
            <button onClick={() => setIsAddingTask(true)} className="px-3.5 py-1.5 bg-blue-600 hover:bg-blue-500 text-white text-[9px] font-mono uppercase tracking-widest rounded-sm cursor-pointer">
              <Plus className="w-3.5 h-3.5" /> Queue Story
            </button>
          )}
        </div>
      </div>

      {/* Sprint metadata banner */}
      {activeSprint && (
        <div className="mb-6 bg-purple-950/20 border border-purple-500/10 px-4 py-3 rounded-sm flex flex-wrap justify-between items-center gap-3">
          <div className="flex items-center gap-2">
            <Target className="w-4 h-4 text-purple-400" />
            <span className="text-[10px] font-mono uppercase tracking-widest text-purple-200">{activeSprint.name}</span>
            {activeSprint.goal && <span className="text-[9px] font-mono text-purple-300/60">— {activeSprint.goal}</span>}
          </div>
          <div className="flex items-center gap-6 text-[9px] font-mono text-purple-300 uppercase tracking-widest">
            <div className="flex items-center gap-1">
              {velocityData.remaining > 0 ? <TrendingDown className="w-3 h-3 text-amber-400" /> : <TrendingUp className="w-3 h-3 text-emerald-400" />}
              <span>Remaining: <span className="text-white font-bold">{velocityData.remaining} SP</span></span>
            </div>
            <div>Velocity: <span className="text-white font-bold">{velocityData.completed}/{velocityData.committed}</span></div>
            <div>Progress: <span className="text-emerald-400 font-bold">{burndownPoints.progress}%</span></div>
          </div>
        </div>
      )}

      {/* Burndown mini-chart */}
      {activeSprint && burndownPoints.totalDays > 0 && (
        <div className="mb-6 bg-black/30 border border-white/5 rounded-sm p-4">
          <div className="flex items-center gap-2 mb-3">
            <Zap className="w-3.5 h-3.5 text-cyan-400" />
            <span className="text-[9px] font-mono uppercase tracking-widest text-white/60">Burndown Trajectory</span>
          </div>
          <div className="flex items-end gap-[2px] h-16">
            {Array.from({ length: burndownPoints.totalDays + 1 }).map((_, i) => {
              const maxSP = Math.max(1, burndownPoints.totalDays > 0 ? (velocityData.committed / burndownPoints.totalDays) * (burndownPoints.totalDays - i) : 0);
              const idealH = velocityData.committed > 0 ? (maxSP / velocityData.committed) * 100 : 0;
              const isPast = i <= burndownPoints.daysElapsed;
              return (
                <div key={i} className="flex-1 flex flex-col justify-end h-full">
                  <div className="w-full bg-white/5 rounded-t-sm relative" style={{ height: `${Math.max(2, idealH)}%` }}>
                    {isPast && <div className="absolute bottom-0 left-0 right-0 bg-purple-500/40 rounded-t-sm" style={{ height: `${Math.max(2, (velocityData.remaining / Math.max(1, velocityData.committed)) * 100)}%` }} />}
                  </div>
                </div>
              );
            })}
          </div>
          <div className="flex justify-between text-[8px] font-mono text-white/30 mt-1">
            <span>Day 0</span><span>Day {burndownPoints.daysElapsed}</span><span>Day {burndownPoints.totalDays}</span>
          </div>
        </div>
      )}

      {/* Epic filter */}
      {epics.length > 0 && (
        <div className="mb-4 flex items-center gap-2">
          <span className="text-[9px] font-mono uppercase text-white/40">Epic:</span>
          <button onClick={() => setSelectedEpic(null)} className={`px-2 py-0.5 text-[8px] font-mono uppercase rounded-sm cursor-pointer ${!selectedEpic ? 'bg-purple-600 text-white' : 'bg-white/5 text-white/40 hover:text-white'}`}>All</button>
          {epics.map(ep => (
            <button key={ep.id} onClick={() => setSelectedEpic(ep.id)} className={`px-2 py-0.5 text-[8px] font-mono uppercase rounded-sm cursor-pointer ${selectedEpic === ep.id ? 'bg-purple-600 text-white' : 'bg-white/5 text-white/40 hover:text-white'}`}>{ep.name}</button>
          ))}
        </div>
      )}

      {/* SCRUM columns */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {SCRUM_COLUMNS.map(col => {
          const colTasks = sprintTasks.filter(t => {
            if (t.status !== col.id) return false;
            if (selectedEpic && t.epic_id !== selectedEpic) return false;
            return true;
          });
          return (
            <div key={col.id} className="bg-white/[0.02] border border-white/5 rounded-sm p-3 flex flex-col min-h-[350px]">
              <div className="flex justify-between items-center mb-3 pb-2 border-b border-white/5">
                <span className="text-[10px] font-mono uppercase tracking-widest text-white/80 font-semibold flex items-center gap-1.5">
                  <span className={`w-1.5 h-1.5 rounded-full ${col.color.replace('border', 'bg').replace('/20', '')}`} />
                  {col.title}
                </span>
                <span className="px-2 py-0.5 bg-white/5 text-[9px] font-mono text-white/60 rounded-sm">{colTasks.length}</span>
              </div>
              <div className="flex-1 flex flex-col gap-3 overflow-y-auto pr-1 max-h-[450px]">
                {colTasks.length === 0 ? (
                  <div className="flex-1 flex flex-col items-center justify-center border border-dashed border-white/5 rounded-sm p-6 text-center text-white/20 font-mono text-[9px] uppercase">Empty</div>
                ) : (
                  colTasks.map(task => (
                    <TaskCard key={task.id} task={task} project={null as any} hasWriteAccess={hasWriteAccess} columns={SCRUM_COLUMNS as any} onTransitionTask={onUpdateTaskStatus} onClick={() => {}} />
                  ))
                )}
              </div>
            </div>
          );
        })}
      </div>

      <AnimatePresence>
        <TaskCreateModal isOpen={isAddingTask} onClose={() => setIsAddingTask(false)} projects={[]} users={users} defaultStatus="backlog" onSubmit={onCreateTask} notify={notify} />

        {isCreatingSprint && (
          <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setIsCreatingSprint(false)} className="absolute inset-0 bg-black/80 backdrop-blur-sm" />
            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }} className="relative bg-[#0c0c0c] border border-white/10 w-full max-w-md p-6 rounded-sm">
              <div className="flex justify-between items-center mb-6">
                <h3 className="text-sm font-mono uppercase tracking-widest text-white">Create Sprint</h3>
                <button onClick={() => setIsCreatingSprint(false)} className="p-1.5 border border-white/10 hover:bg-white/5 cursor-pointer"><X className="w-3.5 h-3.5 text-white/60" /></button>
              </div>
              <form onSubmit={handleCreateSprint} className="space-y-4">
                <div>
                  <label className="block text-[10px] font-mono uppercase text-white/60 mb-1.5">Name</label>
                  <input value={sprintName} onChange={e => setSprintName(e.target.value)} className="w-full bg-black border border-white/10 h-10 px-3 text-sm font-mono focus:border-white/30 outline-none" placeholder="Sprint 1..." />
                </div>
                <div>
                  <label className="block text-[10px] font-mono uppercase text-white/60 mb-1.5">Goal</label>
                  <input value={sprintGoal} onChange={e => setSprintGoal(e.target.value)} className="w-full bg-black border border-white/10 h-10 px-3 text-sm font-mono focus:border-white/30 outline-none" placeholder="Sprint goal..." />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[10px] font-mono uppercase text-white/60 mb-1.5">Start</label>
                    <input type="date" value={sprintStart} onChange={e => setSprintStart(e.target.value)} className="w-full bg-black border border-white/10 h-10 px-3 text-xs font-mono focus:border-white/30 outline-none" />
                  </div>
                  <div>
                    <label className="block text-[10px] font-mono uppercase text-white/60 mb-1.5">End</label>
                    <input type="date" value={sprintEnd} onChange={e => setSprintEnd(e.target.value)} className="w-full bg-black border border-white/10 h-10 px-3 text-xs font-mono focus:border-white/30 outline-none" />
                  </div>
                </div>
                <div>
                  <label className="block text-[10px] font-mono uppercase text-white/60 mb-1.5">Committed Velocity (SP)</label>
                  <input type="number" value={sprintVelocity} onChange={e => setSprintVelocity(Number(e.target.value))} className="w-full bg-black border border-white/10 h-10 px-3 text-sm font-mono focus:border-white/30 outline-none" />
                </div>
                <button type="submit" className="w-full bg-white text-black h-10 font-semibold uppercase tracking-widest text-[10px] hover:bg-neutral-200 transition-all cursor-pointer">Create Sprint</button>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
