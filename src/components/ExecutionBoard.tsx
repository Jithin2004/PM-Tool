import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { LayoutGrid, Layers, Plus, Shield, ChevronDown, X, Terminal, Send, Lock } from 'lucide-react';
import { List } from 'react-window';
import { useTasks } from '../hooks/useTasks';
import { TaskCard } from './task/TaskCard';
import { TaskCreateModal } from './task/TaskCreateModal';
import { useWorkspace } from '../context/WorkspaceContext';
import { KANBAN_COLUMNS, SCRUM_COLUMNS } from '../constants/product';
import { TaskStatus, Task, Project } from '../types';
import { supabase } from '../lib/supabase';

interface ExecutionBoardProps {
  projects: Project[];
  users: any[];
  currentUserProfile: any;
  notify: (msg: string, type: 'success' | 'error' | 'warning' | 'info') => void;
  onRecalibrateAnalytics: () => void;
  onPromoteToAsset?: (task: { title: string; description: string; projectId: string }) => void;
}

export default function ExecutionBoard({
  projects,
  users,
  currentUserProfile,
  notify,
  onRecalibrateAnalytics,
  onPromoteToAsset
}: ExecutionBoardProps) {
  const { workspace } = useWorkspace();
  const { tasks, loading, addTask, updateTaskStatus } = useTasks(workspace?.id);
  
  const [viewMode, setViewMode] = useState<'kanban' | 'scrum'>('kanban');
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [isAddingTask, setIsAddingTask] = useState(false);
  
  const [filterByProject, setFilterByProject] = useState<string | null>(null);
  const [projectsPanelOpen, setProjectsPanelOpen] = useState(true);

  // Role verification helper
  const role = currentUserProfile?.role || 'viewer';
  const hasWriteAccess = role === 'super_admin' || role === 'pm';

  // Columns definition based on Toggle mode
  const columns = useMemo(() => {
    if (viewMode === 'kanban') {
      return KANBAN_COLUMNS;
    } else {
      return SCRUM_COLUMNS;
    }
  }, [viewMode]);

  const handleCreateTask = async (taskData: any) => {
    if (!hasWriteAccess) {
      notify("Authentication error: Only Super Admins & PMs can register release tasks.", "error");
      return;
    }
    await addTask(taskData);
    onRecalibrateAnalytics();
  };

  const handleTransitionTask = async (taskId: string, targetStatus: TaskStatus) => {
    if (!hasWriteAccess) {
      notify("Access Denied: Only release managers (Super Admins/PMs) can move task lanes.", "error");
      return;
    }
    try {
      await updateTaskStatus(taskId, targetStatus);
      notify(`Lane transition synced to ${targetStatus}`, "success");
      onRecalibrateAnalytics();
    } catch (error) {
      notify("Database error: Could not sync lane movement.", "error");
    }
  };

  if (loading) {
    return <div className="text-white text-xs font-mono p-6">SYNCING BOARD...</div>;
  }

  return (
    <div className="w-full bg-black/40 border border-white/5 rounded-sm p-4 sm:p-6 backdrop-blur-md relative overflow-hidden">
      {/* Visual Accent top gradient line */}
      <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-blue-500/80 via-purple-500/80 to-pink-500/80" />

      {/* Header controls & toggles */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6 border-b border-white/5 pb-4">
        <div>
          <h2 className="text-sm font-mono uppercase tracking-widest text-white flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-cyan-500 animate-ping" />
            Task Board
          </h2>
          <p className="text-[10px] font-mono text-white/40 mt-1 uppercase tracking-wider">
            Canonical data source
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div className="bg-white/5 p-1 rounded-sm border border-white/5 flex gap-1">
            <button
              onClick={() => { setViewMode('kanban'); notify("Layout shifted to Kanban delivery board.", "info"); }}
              className={`px-3 py-1 text-[9px] font-mono uppercase tracking-wider rounded-sm transition-all flex items-center gap-1.5 cursor-pointer ${viewMode === 'kanban' ? 'bg-cyan-600 text-white shadow-[0_0_8px_rgba(8,145,178,0.4)]' : 'text-white/40 hover:text-white'}`}
            >
              <LayoutGrid className="w-3 h-3" />
              Kanban
            </button>
            <button
              onClick={() => { setViewMode('scrum'); notify("Layout shifted to Sprint release iteration.", "info"); }}
              className={`px-3 py-1 text-[9px] font-mono uppercase tracking-wider rounded-sm transition-all flex items-center gap-1.5 cursor-pointer ${viewMode === 'scrum' ? 'bg-purple-600 text-white shadow-[0_0_8px_rgba(147,51,234,0.4)]' : 'text-white/40 hover:text-white'}`}
            >
              <Layers className="w-3 h-3" />
              Scrum
            </button>
          </div>

          {hasWriteAccess && (
            <button
              onClick={() => setIsAddingTask(true)}
              className="px-3.5 py-1.5 bg-blue-600 hover:bg-blue-500 text-white text-[9px] font-mono uppercase tracking-widest transition-all rounded-sm flex items-center gap-1 shadow-[0_0_12px_rgba(59,130,246,0.3)] cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              Queue Task
            </button>
          )}
        </div>
      </div>

      {/* Active scrum metadata banner */}
      {viewMode === 'scrum' && (
        <div className="mb-6 bg-purple-950/20 border border-purple-500/10 px-4 py-3 rounded-sm flex flex-wrap justify-between items-center gap-3">
          <div className="flex items-center gap-2">
            <Shield className="w-4 h-4 text-purple-400" />
            <span className="text-[10px] font-mono uppercase tracking-widest text-purple-200">
              Active Sprint: Iteration Alpha
            </span>
          </div>
          <div className="flex items-center gap-6 text-[9px] font-mono text-purple-300 uppercase tracking-widest">
            <div>Velocity Multiplier: <span className="text-white font-bold">1.4x</span></div>
            <div>Time Remaining: <span className="text-white font-bold">4 days</span></div>
            <div>Release Confidence: <span className="text-emerald-400 font-bold">96.8%</span></div>
          </div>
        </div>
      )}

      {/* Projects Overview Panel */}
      <div className="mb-6 bg-black/30 border border-white/5 rounded-sm overflow-hidden">
        <button
          onClick={() => setProjectsPanelOpen(prev => !prev)}
          className="w-full flex items-center justify-between px-4 py-3 border-b border-white/[0.04] hover:bg-white/[0.02] transition-colors cursor-pointer"
        >
          <div className="flex items-center gap-2">
            <span className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse" />
            <span className="text-[10px] font-mono uppercase tracking-widest text-white/60">
              Project Overview
            </span>
            <span className="text-[8px] font-mono text-white/30 bg-white/5 px-1.5 py-0.5 rounded-sm">
              {projects.length} synced
            </span>
          </div>
          <div className="flex items-center gap-2">
            {filterByProject && (
              <button
                onClick={(e) => { e.stopPropagation(); setFilterByProject(null); }}
                className="text-[8px] font-mono uppercase tracking-wider text-cyan-400 bg-cyan-950/30 border border-cyan-500/20 px-2 py-0.5 rounded-sm hover:bg-cyan-950/50 transition-colors cursor-pointer"
              >
                Clear Filter ×
              </button>
            )}
            <ChevronDown className={`w-3.5 h-3.5 text-white/30 transition-transform duration-200 ${projectsPanelOpen ? 'rotate-0' : '-rotate-90'}`} />
          </div>
        </button>

        {projectsPanelOpen && (
          <div className="max-h-[180px] overflow-y-auto scrollbar-thin divide-y divide-white/[0.03]">
            {projects.length === 0 ? (
              <div className="px-4 py-5 text-center text-white/20 text-[9px] font-mono uppercase tracking-wider">
                No projects found. Create one in the Projects workspace.
              </div>
            ) : (
              projects.map(project => {
                const projectTaskCount = tasks.filter(t => t.project_id === project.id).length;
                const isFiltered = filterByProject === project.id;
                
                return (
                  <div key={project.id} className={`flex items-center justify-between px-4 py-2.5 hover:bg-white/[0.02] transition-colors ${isFiltered ? 'bg-blue-950/15 border-l-2 border-blue-500/40' : ''}`}>
                    <div className="flex items-center gap-3 min-w-0 flex-1">
                      <span className="text-[10px] font-mono text-white/75 truncate">{project.name}</span>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0 ml-3">
                      <span className="text-[8px] font-mono text-white/25 bg-white/5 px-1.5 py-0.5 rounded-sm">
                        {projectTaskCount} task{projectTaskCount !== 1 ? 's' : ''}
                      </span>
                      <button
                        onClick={() => setFilterByProject(isFiltered ? null : project.id)}
                        className={`text-[8px] font-mono uppercase tracking-wider px-2 py-0.5 border rounded-sm transition-all cursor-pointer ${isFiltered ? 'bg-blue-600 border-blue-500 text-white' : 'border-white/10 text-white/35 hover:border-white/25'}`}
                      >
                        {isFiltered ? 'Filtered ✓' : 'Filter'}
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        )}
      </div>

      {/* Lane Columns */}
      <div className={`grid gap-4 ${columns.length > 4 ? 'grid-cols-1 md:grid-cols-3 lg:grid-cols-5' : 'grid-cols-1 md:grid-cols-3 lg:grid-cols-4'}`}>
        {columns.map(col => {
          const colTasks = tasks.filter(t => t.status === col.id && (!filterByProject || t.project_id === filterByProject));
          const TaskRow = ({ index, style }: { index: number; style: React.CSSProperties }) => {
            const task = colTasks[index];
            if (!task) return null;
            const innerStyle = {
              ...style,
              height: typeof style.height === 'number' ? style.height - 12 : style.height,
            };
            return (
              <div style={innerStyle}>
                <TaskCard
                  task={task}
                  project={projects.find(p => p.id === task.project_id)}
                  hasWriteAccess={hasWriteAccess}
                  columns={columns}
                  onTransitionTask={handleTransitionTask}
                  onPromoteToAsset={onPromoteToAsset}
                  onClick={(t) => {
                    setSelectedTask(t);
                    setIsDrawerOpen(true);
                  }}
                />
              </div>
            );
          };

          return (
            <div key={col.id} className="bg-white/[0.02] border border-white/5 rounded-sm p-3 flex flex-col min-h-[350px] transition-all">
              <div className="flex justify-between items-center mb-3 pb-2 border-b border-white/5">
                <span className="text-[10px] font-mono uppercase tracking-widest text-white/80 font-semibold flex items-center gap-1.5">
                  <span className={`w-1.5 h-1.5 rounded-full ${col.color.replace('border', 'bg').replace('/20', '')}`} />
                  {col.title}
                </span>
                <span className="px-2 py-0.5 bg-white/5 text-[9px] font-mono text-white/60 rounded-sm">
                  {colTasks.length}
                </span>
              </div>

              <div className="flex-1 flex flex-col overflow-hidden max-h-[450px]">
                {colTasks.length === 0 ? (
                  <div className="flex-1 flex flex-col items-center justify-center border border-dashed border-white/5 rounded-sm p-6 text-center text-white/20 font-mono text-[9px] uppercase min-h-[350px]">
                    Queue is empty
                  </div>
                ) : colTasks.length > 20 ? (
                  <List
                    rowCount={colTasks.length}
                    rowHeight={175}
                    rowComponent={TaskRow as any}
                    rowProps={{}}
                    style={{ height: Math.min(450, colTasks.length * 175), width: '100%' }}
                    className="scrollbar-thin pr-1"
                  />
                ) : (
                  <div className="flex-1 flex flex-col gap-3 overflow-y-auto scrollbar-thin pr-1">
                    {colTasks.map(task => (
                      <TaskCard
                        key={task.id}
                        task={task}
                        project={projects.find(p => p.id === task.project_id)}
                        hasWriteAccess={hasWriteAccess}
                        columns={columns}
                        onTransitionTask={handleTransitionTask}
                        onPromoteToAsset={onPromoteToAsset}
                        onClick={(t) => {
                          setSelectedTask(t);
                          setIsDrawerOpen(true);
                        }}
                      />
                    ))}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Modals & Drawers */}
      <AnimatePresence>
        <TaskCreateModal
          isOpen={isAddingTask}
          onClose={() => setIsAddingTask(false)}
          projects={projects}
          users={users}
          defaultStatus={viewMode === 'kanban' ? 'backlog' : 'backlog'}
          onSubmit={handleCreateTask}
          notify={notify}
        />
        
        {isDrawerOpen && selectedTask && (
          <div className="fixed inset-0 z-[9999] flex justify-end">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 0.6 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsDrawerOpen(false)}
              className="absolute inset-0 bg-black/80 backdrop-blur-xs"
            />
            <motion.div
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 200 }}
              className="w-full max-w-md bg-[#090a0f] border-l border-white/10 h-full relative z-10 flex flex-col text-white"
            >
              <div className="p-4 border-b border-white/5 bg-black/20 flex justify-between items-center">
                <div className="flex items-center gap-2">
                  <Terminal className="w-4 h-4 text-cyan-400" />
                  <span className="text-[10px] font-mono uppercase tracking-widest text-cyan-200">
                    Console Drawer: Operator logs
                  </span>
                </div>
                <button
                  onClick={() => setIsDrawerOpen(false)}
                  className="w-6 h-6 hover:bg-white/5 border border-white/10 rounded-sm flex items-center justify-center text-white/60 hover:text-white cursor-pointer"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>

              <div className="flex-1 p-5 flex items-center justify-center text-[10px] font-mono uppercase tracking-widest text-white/40">
                Log Drawer Migrating to Canonical Architecture...
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
