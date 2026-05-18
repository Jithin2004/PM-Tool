import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  ChevronRight, Plus, Clock, User, CheckCircle, MessageSquare, 
  AlertTriangle, X, LayoutGrid, Layers, Send, Terminal, Lock, Shield, ArrowRight 
} from 'lucide-react';

interface Task {
  id: string;
  project_id: string;
  title: string;
  description: string;
  status: 'triage' | 'in_flight' | 'validation' | 'sprint_backlog' | 'in_progress' | 'code_review' | 'merged';
  assigned_to?: string;
  assigned_name?: string;
  weight: number;
  due_date?: string;
  created_at?: string;
}

interface AuditLog {
  id: string;
  task_id: string;
  timestamp: string;
  author_name: string;
  author_role: string;
  field_name: string;
  old_value: string;
  new_value: string;
}

interface ExecutionBoardProps {
  projects: any[];
  users: any[];
  currentUserProfile: any;
  isSupabaseConfigured: boolean;
  supabase: any;
  notify: (msg: string, type: 'success' | 'error' | 'warning' | 'info') => void;
  // Trigger system confidence recalculation
  onRecalibrateTelemetry: () => void;
}

export default function ExecutionBoard({
  projects,
  users,
  currentUserProfile,
  isSupabaseConfigured,
  supabase,
  notify,
  onRecalibrateTelemetry
}: ExecutionBoardProps) {
  const [viewMode, setViewMode] = useState<'kanban' | 'scrum'>('kanban');
  const [tasks, setTasks] = useState<Task[]>([]);
  const [historyLogs, setHistoryLogs] = useState<AuditLog[]>([]);
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [newComment, setNewComment] = useState('');
  const [isAddingTask, setIsAddingTask] = useState(false);
  const [newTaskTitle, setNewTaskTitle] = useState('');
  const [newTaskDesc, setNewTaskDesc] = useState('');
  const [newTaskProject, setNewTaskProject] = useState('');
  const [newTaskWeight, setNewTaskWeight] = useState(5);
  const [newTaskAssigned, setNewTaskAssigned] = useState('');
  
  // Real-time ticker to force dynamic countdown update every second
  const [timeTicker, setTimeTicker] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => {
      setTimeTicker(prev => prev + 1);
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // Fetch tasks and logs from database
  const fetchTasksData = async () => {
    if (!isSupabaseConfigured) {
      // Offline fallback state
      const localTasks = localStorage.getItem('tactical_tasks');
      if (localTasks) {
        setTasks(JSON.parse(localTasks));
      } else {
        const dummyTasks: Task[] = [
          {
            id: 'task-1',
            project_id: projects[0]?.id || '1',
            title: 'Refactor Auth Route Security',
            description: 'Implement backend validation tokens to shield role triggers from client intercept.',
            status: 'in_flight',
            assigned_to: currentUserProfile?.id,
            assigned_name: currentUserProfile?.email?.split('@')[0] || 'admin',
            weight: 8,
            created_at: new Date().toISOString()
          },
          {
            id: 'task-2',
            project_id: projects[0]?.id || '1',
            title: 'Map CSV Attendance Exporter',
            description: 'Develop date-range filtering mechanics for offline logistics roster parsing.',
            status: 'triage',
            weight: 5,
            created_at: new Date().toISOString()
          }
        ];
        setTasks(dummyTasks);
        localStorage.setItem('tactical_tasks', JSON.stringify(dummyTasks));
      }

      const localLogs = localStorage.getItem('task_history_logs');
      if (localLogs) {
        setHistoryLogs(JSON.parse(localLogs));
      }
      return;
    }

    try {
      const { data: ttData, error: ttError } = await supabase
        .from('tactical_tasks')
        .select('*')
        .order('created_at', { ascending: false });

      if (!ttError && ttData) {
        setTasks(ttData);
      }

      const { data: logData, error: logError } = await supabase
        .from('task_history_logs')
        .select('*')
        .order('timestamp', { ascending: false });

      if (!logError && logData) {
        setHistoryLogs(logData);
      }
    } catch (err) {
      console.error("Failed to load tactical board telemetry:", err);
    }
  };

  useEffect(() => {
    fetchTasksData();
  }, [projects, isSupabaseConfigured]);

  // Role verification helper
  const role = currentUserProfile?.role || 'viewer';
  const hasWriteAccess = role === 'super_admin' || role === 'pm';

  // Columns definition based on Toggle mode
  const columns = useMemo(() => {
    if (viewMode === 'kanban') {
      return [
        { id: 'triage', title: 'Triage / Backlog', color: 'border-blue-500/20' },
        { id: 'in_flight', title: 'In Flight', color: 'border-yellow-500/20' },
        { id: 'validation', title: 'Validation Roster', color: 'border-green-500/20' }
      ];
    } else {
      return [
        { id: 'sprint_backlog', title: 'Sprint Backlog', color: 'border-purple-500/20' },
        { id: 'in_progress', title: 'In Progress', color: 'border-yellow-500/20' },
        { id: 'code_review', title: 'Code Review', color: 'border-orange-500/20' },
        { id: 'merged', title: 'Merged Releases', color: 'border-emerald-500/20' }
      ];
    }
  }, [viewMode]);

  // Compute countdown for each card dynamically
  const getCardCountdownText = (task: Task) => {
    if (task.status === 'validation' || task.status === 'merged') {
      return { text: 'DEPLOYED', color: 'text-emerald-500', pulse: 'bg-emerald-500' };
    }

    // Weight affects decay rate
    const weightHours = task.weight || 5;
    const now = new Date().getTime();
    
    // Simulate target time: Created Time + weightHours (translated to real elapsed scale for live display)
    const createdTime = new Date(task.created_at || new Date()).getTime();
    const totalDurationMs = weightHours * 60 * 60 * 1000;
    const targetTime = createdTime + totalDurationMs;
    const remainingMs = targetTime - now;

    if (remainingMs <= 0) {
      return { text: 'OVERDUE (DECAY)', color: 'text-rose-500 font-bold', pulse: 'bg-rose-500 animate-ping' };
    }

    const hours = Math.floor(remainingMs / (3600 * 1000));
    const mins = Math.floor((remainingMs % (3600 * 1000)) / (60 * 1000));
    const secs = Math.floor((remainingMs % (60 * 1000)) / 1000);

    const countdownStr = `T-MINUS ${String(hours).padStart(2, '0')}:${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
    
    if (hours < 2) {
      return { text: countdownStr, color: 'text-amber-500 font-mono font-medium', pulse: 'bg-amber-500 animate-pulse' };
    }
    return { text: countdownStr, color: 'text-cyan-400 font-mono', pulse: 'bg-cyan-500 animate-pulse' };
  };

  // Add Task handler (Admins & PMs only)
  const handleCreateTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!hasWriteAccess) {
      notify("Authentication error: Only Super Admins & PMs can register release tasks.", "error");
      return;
    }
    if (!newTaskTitle || !newTaskProject) {
      notify("Workspace error: Title and targeted Project asset are mandatory.", "error");
      return;
    }

    const assignedUser = users.find(u => u.id === newTaskAssigned);

    const freshTask: Partial<Task> = {
      project_id: newTaskProject,
      title: newTaskTitle,
      description: newTaskDesc,
      status: viewMode === 'kanban' ? 'triage' : 'sprint_backlog',
      weight: Number(newTaskWeight),
      assigned_to: newTaskAssigned || null,
      created_at: new Date().toISOString()
    };

    if (isSupabaseConfigured) {
      try {
        const { data, error } = await supabase
          .from('tactical_tasks')
          .insert(freshTask)
          .select()
          .single();

        if (error) throw error;
        
        // Log transaction
        await supabase.from('task_history_logs').insert({
          task_id: data.id,
          author_id: currentUserProfile?.id,
          author_name: currentUserProfile?.email?.split('@')[0] || 'Admin',
          author_role: role,
          field_name: 'creation',
          old_value: null,
          new_value: `Created task "${newTaskTitle}"`,
          telemetry_snapshot: {
            deliveryConfidence: 95,
            teamBandwidth: 80,
            dailyFatigue: 12
          }
        });

        notify(`Tactical task "${newTaskTitle}" queued into release pipeline.`, "success");
      } catch (err) {
        notify("Database sync issue: Could not queue task.", "error");
      }
    } else {
      // Offline fallback state update
      const offlineTask: Task = {
        id: `task-${Date.now()}`,
        project_id: newTaskProject,
        title: newTaskTitle,
        description: newTaskDesc,
        status: viewMode === 'kanban' ? 'triage' : 'sprint_backlog',
        weight: Number(newTaskWeight),
        assigned_to: newTaskAssigned || null,
        assigned_name: assignedUser?.email?.split('@')[0] || 'Unassigned',
        created_at: new Date().toISOString()
      };
      const updated = [offlineTask, ...tasks];
      setTasks(updated);
      localStorage.setItem('tactical_tasks', JSON.stringify(updated));

      // Append log
      const offlineLog: AuditLog = {
        id: `log-${Date.now()}`,
        task_id: offlineTask.id,
        timestamp: new Date().toISOString(),
        author_name: currentUserProfile?.email?.split('@')[0] || 'Developer',
        author_role: role,
        field_name: 'creation',
        old_value: '',
        new_value: `Created task "${newTaskTitle}"`
      };
      const updatedLogs = [offlineLog, ...historyLogs];
      setHistoryLogs(updatedLogs);
      localStorage.setItem('task_history_logs', JSON.stringify(updatedLogs));

      notify(`Offline Mode: Task "${newTaskTitle}" logged locally.`, "success");
    }

    setIsAddingTask(false);
    setNewTaskTitle('');
    setNewTaskDesc('');
    setNewTaskWeight(5);
    setNewTaskAssigned('');
    fetchTasksData();
    onRecalibrateTelemetry();
  };

  // Move Task Lane (Drag and Drop / Click helper)
  const handleTransitionTask = async (taskId: string, targetStatus: Task['status']) => {
    if (!hasWriteAccess) {
      notify("Access Denied: Only release managers (Super Admins/PMs) can move task lanes.", "error");
      return;
    }

    const taskToMove = tasks.find(t => t.id === taskId);
    if (!taskToMove) return;
    const oldStatus = taskToMove.status;

    if (isSupabaseConfigured) {
      try {
        const { error } = await supabase
          .from('tactical_tasks')
          .update({ status: targetStatus, updated_at: new Date().toISOString() })
          .eq('id', taskId);

        if (error) throw error;

        // Log transaction to immutable log table
        await supabase.from('task_history_logs').insert({
          task_id: taskId,
          author_id: currentUserProfile?.id,
          author_name: currentUserProfile?.email?.split('@')[0] || 'Admin',
          author_role: role,
          field_name: 'status',
          old_value: oldStatus,
          new_value: targetStatus,
          telemetry_snapshot: {
            deliveryConfidence: targetStatus === 'validation' || targetStatus === 'merged' ? 98 : 92,
            teamBandwidth: 78,
            dailyFatigue: targetStatus === 'validation' || targetStatus === 'merged' ? 8 : 15
          }
        });

        notify(`Lane transition synced: ${oldStatus} -> ${targetStatus}`, "success");
      } catch (err) {
        notify("Database error: Could not sync lane movement.", "error");
      }
    } else {
      const updated = tasks.map(t => t.id === taskId ? { ...t, status: targetStatus } : t);
      setTasks(updated);
      localStorage.setItem('tactical_tasks', JSON.stringify(updated));

      const offlineLog: AuditLog = {
        id: `log-${Date.now()}`,
        task_id: taskId,
        timestamp: new Date().toISOString(),
        author_name: currentUserProfile?.email?.split('@')[0] || 'Developer',
        author_role: role,
        field_name: 'status',
        old_value: oldStatus,
        new_value: targetStatus
      };
      const updatedLogs = [offlineLog, ...historyLogs];
      setHistoryLogs(updatedLogs);
      localStorage.setItem('task_history_logs', JSON.stringify(updatedLogs));

      notify(`Offline Mode: Saved lane transition locally.`, "success");
    }

    fetchTasksData();
    onRecalibrateTelemetry();
  };

  // Developer comments submit handler
  const handleAddComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTask || !newComment) return;

    if (role === 'viewer') {
      notify("Security warning: Read-only access permissions.", "error");
      return;
    }

    if (isSupabaseConfigured) {
      try {
        await supabase.from('task_history_logs').insert({
          task_id: selectedTask.id,
          author_id: currentUserProfile?.id,
          author_name: currentUserProfile?.email?.split('@')[0] || 'Developer',
          author_role: role,
          field_name: 'comment',
          old_value: null,
          new_value: newComment,
          telemetry_snapshot: {
            deliveryConfidence: 94,
            teamBandwidth: 80,
            dailyFatigue: 11
          }
        });
        notify("Monospace console log appended.", "success");
      } catch (err) {
        notify("Failed to append comment log.", "error");
      }
    } else {
      const offlineLog: AuditLog = {
        id: `log-${Date.now()}`,
        task_id: selectedTask.id,
        timestamp: new Date().toISOString(),
        author_name: currentUserProfile?.email?.split('@')[0] || 'Developer',
        author_role: role,
        field_name: 'comment',
        old_value: '',
        new_value: newComment
      };
      const updatedLogs = [offlineLog, ...historyLogs];
      setHistoryLogs(updatedLogs);
      localStorage.setItem('task_history_logs', JSON.stringify(updatedLogs));

      notify("Offline Mode: Log comment appended locally.", "success");
    }

    setNewComment('');
    fetchTasksData();
  };

  // Filter logs for selected task
  const activeTaskLogs = useMemo(() => {
    if (!selectedTask) return [];
    return historyLogs.filter(log => log.task_id === selectedTask.id);
  }, [historyLogs, selectedTask]);

  return (
    <div className="w-full bg-black/40 border border-white/5 rounded-sm p-4 sm:p-6 backdrop-blur-md relative overflow-hidden">
      
      {/* Visual Accent top gradient line */}
      <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-blue-500/80 via-purple-500/80 to-pink-500/80" />

      {/* Header controls & toggles */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6 border-b border-white/5 pb-4">
        <div>
          <h2 className="text-sm font-mono uppercase tracking-widest text-white flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-cyan-500 animate-ping" />
            Tactical Execution Pipeline
          </h2>
          <p className="text-[10px] font-mono text-white/40 mt-1 uppercase tracking-wider">
            Real-time clock-synced dev team workflows
          </p>
        </div>

        {/* Dynamic perspective selectors */}
        <div className="flex items-center gap-3">
          <div className="bg-white/5 p-1 rounded-sm border border-white/5 flex gap-1">
            <button
              onClick={() => {
                setViewMode('kanban');
                notify("Layout shifted to Kanban delivery board.", "info");
              }}
              className={`px-3 py-1 text-[9px] font-mono uppercase tracking-wider rounded-sm transition-all flex items-center gap-1.5 cursor-pointer ${viewMode === 'kanban' ? 'bg-cyan-600 text-white shadow-[0_0_8px_rgba(8,145,178,0.4)]' : 'text-white/40 hover:text-white'}`}
            >
              <LayoutGrid className="w-3 h-3" />
              Kanban
            </button>
            <button
              onClick={() => {
                setViewMode('scrum');
                notify("Layout shifted to Sprint release iteration.", "info");
              }}
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

      {/* active scrum release metadata banner */}
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

      {/* Lane Columns */}
      <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-4">
        {columns.map(col => {
          const colTasks = tasks.filter(t => t.status === col.id);
          return (
            <div 
              key={col.id}
              className={`bg-white/[0.02] border border-white/5 rounded-sm p-3 flex flex-col min-h-[350px] transition-all`}
            >
              {/* Column Header */}
              <div className="flex justify-between items-center mb-3 pb-2 border-b border-white/5">
                <span className="text-[10px] font-mono uppercase tracking-widest text-white/80 font-semibold flex items-center gap-1.5">
                  <span className={`w-1.5 h-1.5 rounded-full ${col.color.replace('border', 'bg').replace('/20', '')}`} />
                  {col.title}
                </span>
                <span className="px-2 py-0.5 bg-white/5 text-[9px] font-mono text-white/60 rounded-sm">
                  {colTasks.length}
                </span>
              </div>

              {/* Task list container */}
              <div className="flex-1 flex flex-col gap-3 overflow-y-auto max-h-[450px] scrollbar-thin">
                {colTasks.length === 0 ? (
                  <div className="flex-1 flex flex-col items-center justify-center border border-dashed border-white/5 rounded-sm p-6 text-center text-white/20 font-mono text-[9px] uppercase">
                    Queue is empty
                  </div>
                ) : (
                  colTasks.map(task => {
                    const countdown = getCardCountdownText(task);
                    const associatedProject = projects.find(p => p.id === task.project_id);
                    
                    return (
                      <motion.div
                        key={task.id}
                        layoutId={`task-card-${task.id}`}
                        onClick={() => {
                          setSelectedTask(task);
                          setIsDrawerOpen(true);
                        }}
                        className="bg-[#0b0c10] border border-white/10 hover:border-white/20 transition-all rounded-sm p-3.5 relative overflow-hidden cursor-pointer group"
                      >
                        {/* Dynamic warning indicator ring glows */}
                        <div className={`absolute top-0 bottom-0 left-0 w-1 ${countdown.pulse}`} />

                        {/* Title & Info */}
                        <div className="flex justify-between items-start gap-2 mb-2">
                          <h4 className="text-[11px] font-semibold text-white tracking-wide group-hover:text-blue-400 transition-colors uppercase">
                            {task.title}
                          </h4>
                          {task.weight && (
                            <span className="text-[9px] font-mono text-cyan-400 bg-cyan-950/20 border border-cyan-800/20 px-1.5 rounded-sm">
                              {task.weight}h
                            </span>
                          )}
                        </div>

                        <p className="text-[9px] text-white/50 leading-relaxed mb-3 line-clamp-2">
                          {task.description}
                        </p>

                        {/* Project mapping tag */}
                        <div className="flex items-center gap-1.5 text-[8px] font-mono text-white/30 uppercase tracking-widest mb-3">
                          <span className="w-1.5 h-1.5 rounded-full bg-white/10" />
                          Project: {associatedProject?.name || 'Asset Canvas'}
                        </div>

                        {/* Dynamic ETA Countdown Banner */}
                        <div className="bg-white/[0.02] border border-white/5 px-2 py-1 rounded-sm flex justify-between items-center text-[8px] font-mono uppercase tracking-wider">
                          <span className="text-white/40">Time-to-Impact:</span>
                          <span className={countdown.color}>{countdown.text}</span>
                        </div>

                        {/* Footer details */}
                        <div className="flex justify-between items-center mt-3 pt-2 border-t border-white/5">
                          <div className="flex items-center gap-1.5 text-[8px] font-mono text-white/50">
                            <User className="w-2.5 h-2.5" />
                            {task.assigned_name || 'Unassigned'}
                          </div>
                          
                          {/* Quick lane transition buttons (For Admins/PMs) */}
                          {hasWriteAccess && (
                            <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                              {columns.map(c => c.id !== task.status && (
                                <button
                                  key={c.id}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleTransitionTask(task.id, c.id as any);
                                  }}
                                  title={`Move to ${c.title}`}
                                  className="w-4 h-4 bg-white/5 hover:bg-white/20 border border-white/10 hover:border-white/30 text-white rounded-sm flex items-center justify-center transition-all cursor-pointer"
                                >
                                  <ArrowRight className="w-2 h-2" />
                                </button>
                              ))}
                            </div>
                          )}
                        </div>
                      </motion.div>
                    );
                  })
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Task Creation Modal overlay */}
      <AnimatePresence>
        {isAddingTask && (
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
                  Queue Release Task
                </h3>
                <button
                  onClick={() => setIsAddingTask(false)}
                  className="text-white/40 hover:text-white cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <form onSubmit={handleCreateTask} className="space-y-4">
                <div>
                  <label className="block text-[8px] font-mono uppercase tracking-wider text-white/40 mb-1">Task Title *</label>
                  <input
                    type="text"
                    required
                    value={newTaskTitle}
                    onChange={(e) => setNewTaskTitle(e.target.value)}
                    className="w-full bg-white/5 border border-white/10 rounded-sm px-3 py-2 text-[11px] font-mono text-white focus:outline-none focus:border-blue-500/80"
                    placeholder="e.g. Implement Webhook Handlers"
                  />
                </div>

                <div>
                  <label className="block text-[8px] font-mono uppercase tracking-wider text-white/40 mb-1">Task Description</label>
                  <textarea
                    value={newTaskDesc}
                    onChange={(e) => setNewTaskDesc(e.target.value)}
                    rows={3}
                    className="w-full bg-white/5 border border-white/10 rounded-sm px-3 py-2 text-[11px] font-mono text-white focus:outline-none focus:border-blue-500/80 resize-none"
                    placeholder="Detailed core mechanics documentation..."
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[8px] font-mono uppercase tracking-wider text-white/40 mb-1">Target Project *</label>
                    <select
                      required
                      value={newTaskProject}
                      onChange={(e) => setNewTaskProject(e.target.value)}
                      className="w-full bg-[#0a0a0a] border border-white/10 rounded-sm px-2 py-2 text-[10px] font-mono text-white focus:outline-none"
                    >
                      <option value="">-- Choose project --</option>
                      {projects.map(p => (
                        <option key={p.id} value={p.id}>{p.name}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-[8px] font-mono uppercase tracking-wider text-white/40 mb-1">Weight Hours (1-20)</label>
                    <input
                      type="number"
                      min={1}
                      max={20}
                      value={newTaskWeight}
                      onChange={(e) => setNewTaskWeight(Number(e.target.value))}
                      className="w-full bg-white/5 border border-white/10 rounded-sm px-3 py-2 text-[11px] font-mono text-white focus:outline-none"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-[8px] font-mono uppercase tracking-wider text-white/40 mb-1">Assign Operator</label>
                  <select
                    value={newTaskAssigned}
                    onChange={(e) => setNewTaskAssigned(e.target.value)}
                    className="w-full bg-[#0a0a0a] border border-white/10 rounded-sm px-2 py-2 text-[10px] font-mono text-white focus:outline-none"
                  >
                    <option value="">-- Unassigned --</option>
                    {users.map(u => (
                      <option key={u.id} value={u.id}>{u.email}</option>
                    ))}
                  </select>
                </div>

                <div className="flex justify-end gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setIsAddingTask(false)}
                    className="px-3.5 py-1.5 border border-white/10 text-white/60 hover:text-white text-[9px] font-mono uppercase tracking-wider rounded-sm cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-1.5 bg-blue-600 hover:bg-blue-500 text-white text-[9px] font-mono uppercase tracking-wider rounded-sm cursor-pointer"
                  >
                    Queue Task
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Developer activity log console sliding drawer */}
      <AnimatePresence>
        {isDrawerOpen && selectedTask && (
          <div className="fixed inset-0 z-[9999] flex justify-end">
            {/* Backdrop overlay click close */}
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
              {/* visual sidebar glow */}
              <div className="absolute top-0 bottom-0 left-0 w-[1px] bg-gradient-to-b from-blue-500/25 via-purple-500/25 to-pink-500/25" />

              {/* Drawer Header */}
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

              {/* Drawer Body scrollable content */}
              <div className="flex-1 overflow-y-auto p-5 space-y-6 scrollbar-thin">
                
                {/* Task Details Card info */}
                <div className="bg-black/40 border border-white/5 rounded-sm p-4 space-y-3">
                  <div className="flex justify-between items-center">
                    <span className="text-[8px] font-mono uppercase text-white/30 tracking-widest">
                      Task ID: {selectedTask.id.slice(0, 8)}...
                    </span>
                    <span className="text-[9px] font-mono text-cyan-400 bg-cyan-950/20 border border-cyan-800/10 px-2 py-0.5 rounded-sm">
                      Weight: {selectedTask.weight} hours
                    </span>
                  </div>

                  <h3 className="text-xs font-mono uppercase tracking-wider text-white">
                    {selectedTask.title}
                  </h3>

                  <p className="text-[9px] font-mono text-white/60 leading-relaxed">
                    {selectedTask.description || 'No supplementary operational logs available.'}
                  </p>

                  <div className="bg-white/[0.02] border border-white/5 p-2 rounded-sm flex justify-between items-center text-[9px] font-mono uppercase">
                    <span className="text-white/40">Status lane:</span>
                    <span className="text-cyan-400">{selectedTask.status}</span>
                  </div>
                </div>

                {/* Audit and Roadblock Monospace logs console */}
                <div className="space-y-3">
                  <h4 className="text-[9px] font-mono uppercase text-white/40 tracking-widest">
                    Monospace Activity & Console logs:
                  </h4>

                  <div className="bg-black/60 border border-white/10 rounded-sm p-4 h-[250px] overflow-y-auto font-mono text-[9px] leading-relaxed space-y-3 scrollbar-thin">
                    {activeTaskLogs.length === 0 ? (
                      <div className="text-white/20 italic uppercase tracking-wider text-center pt-8">
                        No activity logged. System operating nominally.
                      </div>
                    ) : (
                      activeTaskLogs.map((log) => (
                        <div key={log.id} className="border-b border-white/5 pb-2 last:border-none">
                          <div className="flex justify-between text-white/40 text-[8px] mb-1">
                            <span>[{new Date(log.timestamp).toLocaleTimeString()}] BY: {log.author_name} ({log.author_role})</span>
                            <span className="text-cyan-500/60 uppercase">{log.field_name}</span>
                          </div>
                          <div className="text-white/80 whitespace-pre-wrap">
                            {log.field_name === 'status' ? (
                              <span>Lane mutation verified: <strong className="text-yellow-500">{log.old_value}</strong> &gt;&gt; <strong className="text-green-400">{log.new_value}</strong></span>
                            ) : log.field_name === 'comment' ? (
                              <span>Console out: &quot;{log.new_value}&quot;</span>
                            ) : (
                              <span>{log.new_value}</span>
                            )}
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </div>

              {/* Drawer comment input footer */}
              {role !== 'viewer' ? (
                <div className="p-4 border-t border-white/5 bg-black/20">
                  <form onSubmit={handleAddComment} className="flex gap-2">
                    <input
                      type="text"
                      value={newComment}
                      onChange={(e) => setNewComment(e.target.value)}
                      placeholder="Type console comment or report roadblocks..."
                      className="flex-1 bg-white/5 border border-white/10 rounded-sm px-3 py-2 text-[10px] font-mono text-white placeholder-white/20 focus:outline-none focus:border-cyan-500/60"
                    />
                    <button
                      type="submit"
                      className="px-3.5 bg-cyan-600 hover:bg-cyan-500 border border-cyan-500/20 hover:border-cyan-400/40 text-white rounded-sm flex items-center justify-center transition-all cursor-pointer"
                    >
                      <Send className="w-3.5 h-3.5" />
                    </button>
                  </form>
                </div>
              ) : (
                <div className="p-4 border-t border-white/5 bg-black/20 text-center text-white/30 text-[9px] font-mono uppercase tracking-widest flex items-center justify-center gap-1.5">
                  <Lock className="w-3 h-3 text-red-500/60" />
                  Console Read-Only Mode
                </div>
              )}
            </motion.div>
          </div>
        )}
      </AnimatePresence>

    </div>
  );
}
