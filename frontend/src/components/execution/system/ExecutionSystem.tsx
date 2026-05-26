import React, { useState, useMemo } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { 
  Plus, 
  Filter, 
  Search, 
  ChevronDown, 
  LayoutGrid, 
  List as ListIcon, 
  GanttChart, 
  Calendar as CalendarIcon, 
  Layers,
  Settings2,
  AlertTriangle,
  MoreHorizontal,
  ChevronRight,
  User as UserIcon,
  Clock,
  Link2,
  CheckCircle2,
  ArrowRight,
  ArrowLeft,
  Activity,
  Zap,
  Shield,
  TrendingUp,
  Users,
  BarChart2
} from 'lucide-react';
import { useTasks } from '../../../hooks/useTasks';
import { useWorkspace } from '../../../context/WorkspaceContext';
import { useCalendarEvents } from '../../../hooks/useCalendarEvents';
import { TaskCard } from '../../task/TaskCard';
import { TaskCreateModal } from '../../task/TaskCreateModal';
import { CompletionFeedbackModal } from '../../task/CompletionFeedbackModal';
import { KANBAN_COLUMNS, SCRUM_COLUMNS } from '../../../constants/product';
import { Task, Project, TaskStatus, CalendarEvent } from '../../../types';
import { ExecutionHeader, ExecutionViewType } from './ExecutionHeader';

interface ExecutionSystemProps {
  projects: Project[];
  users: any[];
  currentUserProfile: any;
  notify: (msg: string, type: 'success' | 'error' | 'warning' | 'info') => void;
  onRecalibrateAnalytics: () => void;
  initialView?: ExecutionViewType;
}

export function ExecutionSystem({
  projects,
  users,
  currentUserProfile,
  notify,
  onRecalibrateAnalytics,
  initialView = 'board'
}: ExecutionSystemProps) {
  const { workspace } = useWorkspace();
  const { tasks, dependencies, loading, addTask, updateTaskStatus } = useTasks(workspace?.id);
  const { events: calendarEvents } = useCalendarEvents(workspace?.id);
  
  const [activeView, setActiveView] = useState<ExecutionViewType>(initialView);
  const [density, setDensity] = useState<'comfortable' | 'compact' | 'executive'>('comfortable');
  const [filterByProject, setFilterByProject] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [groupBy, setGroupBy] = useState<'status' | 'assignee' | 'priority' | 'risk'>('status');
  
  const [isAddingTask, setIsAddingTask] = useState(false);
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [pendingCompletionTask, setPendingCompletionTask] = useState<Task | null>(null);

  const role = currentUserProfile?.role || 'viewer';
  const hasWriteAccess = role === 'super_admin' || role === 'pm';

  const userMap = useMemo(() => {
    const map = new Map<string, any>();
    users.forEach(u => map.set(u.id, u));
    return map;
  }, [users]);

  const projectMap = useMemo(() => {
    const map = new Map<string, Project>();
    projects.forEach(p => map.set(p.id, p));
    return map;
  }, [projects]);

  const filteredTasks = useMemo(() => {
    return tasks.filter(t => {
      if (filterByProject && t.project_id !== filterByProject) return false;
      if (searchQuery && !t.name.toLowerCase().includes(searchQuery.toLowerCase())) return false;
      return true;
    });
  }, [tasks, filterByProject, searchQuery]);

  // Execution Intelligence logic
  const executionIntel = useMemo(() => {
    const insights: any[] = [];
    
    // Check for overloaded users
    users.forEach(user => {
      const userTasks = filteredTasks.filter(t => t.assignee_id === user.id && t.status !== 'done');
      const totalEstimated = userTasks.reduce((sum, t) => sum + (t.estimated_hours || 0), 0);
      const capacity = 40 * (user.availability_factor || 1);
      
      if (totalEstimated > capacity) {
        insights.push({
          type: 'overload',
          severity: 'high',
          message: `${user.full_name || user.email} is overloaded (${totalEstimated}h / ${capacity}h capacity)`,
          user_id: user.id
        });
      }
    });

    // Check for critical path blockages
    const blockedTasks = filteredTasks.filter(t => {
      const deps = dependencies.filter(d => d.task_id === t.id);
      return deps.some(d => {
        const depTask = tasks.find(pt => pt.id === d.depends_on_task_id);
        return depTask && depTask.status !== 'done';
      });
    });

    if (blockedTasks.length > 0) {
      insights.push({
        type: 'dependency',
        severity: 'medium',
        message: `${blockedTasks.length} tasks blocked by incomplete dependencies`
      });
    }

    // Holiday collisions
    const upcomingHolidays = calendarEvents.filter(e => {
      const start = new Date(e.start_date);
      const now = new Date();
      return e.event_type === 'holiday' && start > now && start.getTime() < now.getTime() + 14 * 86400000;
    });

    if (upcomingHolidays.length > 0) {
      insights.push({
        type: 'holiday',
        severity: 'info',
        message: `${upcomingHolidays.length} upcoming holidays affecting capacity in the next 2 weeks`
      });
    }

    return insights;
  }, [filteredTasks, users, dependencies, calendarEvents, tasks]);

  const tasksByGroup = useMemo(() => {
    const map = new Map<string, Task[]>();
    for (const t of filteredTasks) {
      let key = t.status;
      if (groupBy === 'assignee') key = t.assignee_id || 'unassigned';
      if (groupBy === 'priority') key = t.priority || 'medium';
      if (groupBy === 'risk') key = t.risk || 'low';
      
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(t);
    }
    return map;
  }, [filteredTasks, groupBy]);

  const blockedByMap = useMemo(() => {
    const map = new Map<string, string[]>();
    dependencies.forEach(d => {
      if (!map.has(d.task_id)) map.set(d.task_id, []);
      map.get(d.task_id)!.push(d.depends_on_task_id);
    });
    return map;
  }, [dependencies]);

  const handleTransitionTask = async (taskId: string, targetStatus: TaskStatus) => {
    if (!hasWriteAccess) {
      notify("Access Denied: Only release managers can move task lanes.", "error");
      return;
    }
    if (targetStatus === 'done') {
      const task = tasks.find(t => t.id === taskId);
      if (task) {
        setPendingCompletionTask(task);
        return;
      }
    }
    try {
      await updateTaskStatus(taskId, targetStatus);
      notify(`Status updated to ${targetStatus}`, "success");
      onRecalibrateAnalytics();
    } catch (error) {
      notify("Database error: Could not update task.", "error");
    }
  };

  const handleAddTask = async (taskData: any) => {
    const result = await addTask(taskData);
    if (result) {
      notify("Task created successfully", "success");
      onRecalibrateAnalytics();
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-2 border-accent-primary border-t-transparent rounded-full animate-spin" />
          <span className="text-sm text-text-tertiary font-medium">Syncing Execution Engine...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      <ExecutionHeader
        activeView={activeView}
        onViewChange={setActiveView}
        onAddTask={() => setIsAddingTask(true)}
        onOpenSettings={() => {}}
        taskCount={filteredTasks.length}
        projectName={filterByProject ? projectMap.get(filterByProject)?.name : 'All Projects'}
        onSearchChange={setSearchQuery}
        groupBy={groupBy}
        onGroupByChange={setGroupBy}
      />

      {/* Intelligence Banner */}
      {executionIntel.length > 0 && (
        <div className="flex items-center gap-4 mb-6 p-3 bg-surface-2 border border-border rounded-lg overflow-x-auto scrollbar-none">
          <div className="flex items-center gap-2 shrink-0 pr-4 border-r border-border">
            <Zap className="w-4 h-4 text-accent-primary" />
            <span className="text-[11px] font-bold text-text-primary uppercase tracking-wider whitespace-nowrap">Execution Intel</span>
          </div>
          <div className="flex items-center gap-3">
            {executionIntel.map((intel, i) => (
              <div key={i} className={`flex items-center gap-2 px-2.5 py-1 rounded-md text-[11px] font-medium whitespace-nowrap border ${
                intel.severity === 'high' ? 'bg-signal-critical-bg border-signal-critical/20 text-signal-critical' :
                intel.severity === 'medium' ? 'bg-signal-warning-bg border-signal-warning/20 text-signal-warning' :
                'bg-signal-info-bg border-signal-info/20 text-signal-info'
              }`}>
                <AlertTriangle className="w-3.5 h-3.5" />
                {intel.message}
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="flex-1 overflow-hidden">
        {activeView === 'board' && (
          <BoardView
            tasksByGroup={tasksByGroup}
            groupBy={groupBy}
            projectMap={projectMap}
            userMap={userMap}
            hasWriteAccess={hasWriteAccess}
            blockedByMap={blockedByMap}
            onTransitionTask={handleTransitionTask}
            onTaskClick={setSelectedTask}
            density={density}
          />
        )}

        {activeView === 'list' && (
          <ListView
            tasks={filteredTasks}
            projectMap={projectMap}
            userMap={userMap}
            hasWriteAccess={hasWriteAccess}
            onTransitionTask={handleTransitionTask}
            onTaskClick={setSelectedTask}
          />
        )}

        {activeView === 'sprint' && (
          <SprintView
            tasks={filteredTasks}
            projects={projects}
            userMap={userMap}
            hasWriteAccess={hasWriteAccess}
            onTransitionTask={handleTransitionTask}
            onTaskClick={setSelectedTask}
            notify={notify}
          />
        )}

        {activeView === 'timeline' && (
          <TimelineView
            tasks={filteredTasks}
            projects={projects}
            dependencies={dependencies}
          />
        )}

        {activeView === 'roadmap' && (
          <RoadmapView
            projects={projects}
            tasks={filteredTasks}
          />
        )}
        
        {activeView === 'calendar' && (
          <CalendarView
            tasks={filteredTasks}
            events={calendarEvents}
          />
        )}

        {activeView === 'allocation' && (
          <AllocationView
            users={users}
            tasks={filteredTasks}
          />
        )}
      </div>

      <AnimatePresence>
        {isAddingTask && (
          <TaskCreateModal
            isOpen={isAddingTask}
            onClose={() => setIsAddingTask(false)}
            projects={projects}
            users={users}
            defaultProjectId={filterByProject || undefined}
            onSubmit={handleAddTask}
            notify={notify}
          />
        )}
        {pendingCompletionTask && (
          <CompletionFeedbackModal
            task={pendingCompletionTask}
            onSubmit={async (feedback) => {
              await updateTaskStatus(pendingCompletionTask.id, 'done');
              setPendingCompletionTask(null);
              onRecalibrateAnalytics();
              notify("Task completed", "success");
            }}
            onSkip={async () => {
              await updateTaskStatus(pendingCompletionTask.id, 'done');
              setPendingCompletionTask(null);
              onRecalibrateAnalytics();
              notify("Task completed", "success");
            }}
            onClose={() => setPendingCompletionTask(null)}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

function BoardView({ 
  tasksByGroup, 
  groupBy,
  projectMap, 
  userMap, 
  hasWriteAccess, 
  blockedByMap, 
  onTransitionTask, 
  onTaskClick,
  density
}: any) {
  // Determine columns based on groupBy
  let columns: any[] = [];
  if (groupBy === 'status') {
    columns = KANBAN_COLUMNS;
  } else if (groupBy === 'priority') {
    columns = [
      { id: 'high', title: 'High Priority', color: 'bg-signal-critical' },
      { id: 'medium', title: 'Medium Priority', color: 'bg-signal-warning' },
      { id: 'low', title: 'Low Priority', color: 'bg-signal-safe' }
    ];
  } else if (groupBy === 'risk') {
    columns = [
      { id: 'high', title: 'High Risk', color: 'bg-signal-critical' },
      { id: 'medium', title: 'Medium Risk', color: 'bg-signal-warning' },
      { id: 'low', title: 'Low Risk', color: 'bg-signal-safe' }
    ];
  } else if (groupBy === 'assignee') {
    const assignees = Array.from(new Set(Array.from(tasksByGroup.keys())));
    columns = assignees.map(id => {
      const user = userMap.get(id);
      return {
        id,
        title: user?.full_name || user?.email || 'Unassigned',
        color: 'bg-accent-primary'
      };
    });
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-4 h-full overflow-x-auto pb-4 scrollbar-thin">
      {columns.map(col => {
        const colTasks = tasksByGroup.get(col.id) || [];
        return (
          <div key={col.id} className="flex flex-col min-w-[300px] h-full">
            <div className="flex items-center justify-between mb-3 px-1">
              <div className="flex items-center gap-2">
                <div className={`w-2 h-2 rounded-full ${col.color}`} />
                <h3 className="text-[12px] font-semibold text-text-secondary uppercase tracking-wider truncate max-w-[200px]">{col.title}</h3>
                <span className="text-[11px] font-medium text-text-tertiary bg-surface-2 px-1.5 py-0.5 rounded border border-border">
                  {colTasks.length}
                </span>
              </div>
            </div>
            
            <div className="flex-1 overflow-y-auto pr-1 space-y-3 scrollbar-thin">
              {colTasks.length === 0 ? (
                <div className="h-24 border border-dashed border-border rounded-lg flex items-center justify-center text-[11px] text-text-quaternary font-medium uppercase tracking-widest">
                  No Tasks
                </div>
              ) : (
                colTasks.map((task: Task) => (
                  <TaskCard
                    key={task.id}
                    task={task}
                    project={projectMap.get(task.project_id)}
                    hasWriteAccess={hasWriteAccess}
                    columns={KANBAN_COLUMNS}
                    onTransitionTask={onTransitionTask}
                    onClick={onTaskClick}
                    assigneeProfile={task.assignee_id ? userMap.get(task.assignee_id) : null}
                    blockedByTasks={blockedByMap.get(task.id)}
                    density={density}
                  />
                ))
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function SprintView({ tasks, projects, userMap, hasWriteAccess, onTransitionTask, onTaskClick, notify }: any) {
  // Simple Sprint view implementation
  const sprintTasks = tasks.filter((t: any) => t.sprint_id || t.status !== 'done');
  
  return (
    <div className="flex flex-col gap-6 h-full overflow-y-auto pr-2 scrollbar-thin">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-surface-2 border border-border rounded-xl p-5 shadow-sm">
          <div className="flex items-center gap-2 mb-4">
            <Layers className="w-5 h-5 text-accent-primary" />
            <h3 className="text-sm font-semibold text-text-primary uppercase tracking-wider">Active Sprint</h3>
          </div>
          <div className="space-y-4">
            <div className="flex justify-between items-end">
              <div>
                <p className="text-[10px] font-medium text-text-tertiary uppercase mb-1">Velocity</p>
                <p className="text-2xl font-bold text-text-primary">24 / 32 <span className="text-sm font-medium text-text-tertiary">SP</span></p>
              </div>
              <div className="text-right">
                <p className="text-[10px] font-medium text-text-tertiary uppercase mb-1">Days Left</p>
                <p className="text-lg font-bold text-accent-primary">4d</p>
              </div>
            </div>
            <div className="w-full h-2 bg-surface-3 rounded-full overflow-hidden">
              <div className="h-full bg-accent-primary rounded-full transition-all" style={{ width: '75%' }} />
            </div>
          </div>
        </div>

        <div className="bg-surface-2 border border-border rounded-xl p-5 shadow-sm">
          <div className="flex items-center gap-2 mb-4">
            <AlertTriangle className="w-5 h-5 text-signal-warning" />
            <h3 className="text-sm font-semibold text-text-primary uppercase tracking-wider">Execution Risks</h3>
          </div>
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-[12px] text-text-secondary">
              <div className="w-1.5 h-1.5 rounded-full bg-signal-critical" />
              <span>3 Blocked items in critical path</span>
            </div>
            <div className="flex items-center gap-2 text-[12px] text-text-secondary">
              <div className="w-1.5 h-1.5 rounded-full bg-signal-warning" />
              <span>Developer workload imbalance detected</span>
            </div>
          </div>
        </div>

        <div className="bg-surface-2 border border-border rounded-xl p-5 shadow-sm">
          <div className="flex items-center gap-2 mb-4">
            <TrendingUp className="w-5 h-5 text-accent-secondary" />
            <h3 className="text-sm font-semibold text-text-primary uppercase tracking-wider">Velocity Trajectory</h3>
          </div>
          <div className="flex items-end gap-1 h-12">
            {[40, 65, 35, 80, 55, 90, 70].map((h, i) => (
              <div key={i} className="flex-1 bg-accent-secondary/20 rounded-t-sm relative group">
                <div className="absolute bottom-0 left-0 right-0 bg-accent-secondary rounded-t-sm transition-all" style={{ height: `${h}%` }} />
                <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1 hidden group-hover:block bg-surface border border-border px-1.5 py-0.5 rounded text-[8px] font-bold text-text-primary z-10 whitespace-nowrap">
                  Sprint {i+1}: {h} SP
                </div>
              </div>
            ))}
          </div>
          <div className="flex justify-between mt-2 text-[9px] font-bold text-text-quaternary uppercase tracking-widest">
            <span>Past 7 Sprints</span>
            <span>Avg: 62 SP</span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 pb-10">
        {SCRUM_COLUMNS.map(col => {
          const colTasks = sprintTasks.filter((t: any) => t.status === col.id);
          return (
            <div key={col.id} className="flex flex-col gap-3">
              <div className="flex items-center justify-between px-1">
                <h4 className="text-[11px] font-bold text-text-tertiary uppercase tracking-widest">{col.title}</h4>
                <span className="text-[10px] font-bold text-text-quaternary">{colTasks.length}</span>
              </div>
              <div className="space-y-3">
                {colTasks.map((task: any) => (
                  <TaskCard
                    key={task.id}
                    task={task}
                    project={projects.find((p: any) => p.id === task.project_id)}
                    hasWriteAccess={hasWriteAccess}
                    columns={SCRUM_COLUMNS}
                    onTransitionTask={onTransitionTask}
                    onClick={onTaskClick}
                    assigneeProfile={task.assignee_id ? userMap.get(task.assignee_id) : null}
                  />
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function TimelineView({ tasks, projects, dependencies }: any) {
  const [zoom, setZoom] = useState<'days' | 'weeks'>('days');
  const scrollRef = React.useRef<HTMLDivElement>(null);

  const { timelineItems, start, end } = useMemo(() => {
    const dates = tasks.filter((t: any) => t.due_date).map((t: any) => new Date(t.due_date));
    if (dates.length === 0) {
      const now = new Date();
      return { timelineItems: [], start: now, end: new Date(now.getTime() + 14 * 86400000) };
    }
    
    const min = new Date(Math.min(...dates.map(d => d.getTime())));
    const max = new Date(Math.max(...dates.map(d => d.getTime())));
    
    // Add buffer
    const timelineStart = new Date(min);
    timelineStart.setDate(timelineStart.getDate() - 2);
    const timelineEnd = new Date(max);
    timelineEnd.setDate(timelineEnd.getDate() + 7);
    
    return { timelineItems: tasks.filter((t: any) => t.due_date), start: timelineStart, end: timelineEnd };
  }, [tasks]);

  const daysCount = Math.ceil((end.getTime() - start.getTime()) / 86400000);
  
  return (
    <div className="bg-surface-2 border border-border rounded-xl flex flex-col h-full overflow-hidden shadow-sm">
      <div className="p-4 bg-surface border-b border-border flex items-center justify-between">
        <div className="flex items-center gap-4">
          <h3 className="text-sm font-bold text-text-primary uppercase tracking-wider">Execution Timeline</h3>
          <div className="flex items-center bg-surface-3 rounded-lg p-1 border border-border shadow-sm">
            <button 
              onClick={() => setZoom('days')}
              className={`px-3 py-1 text-[10px] font-bold rounded-md transition-all ${zoom === 'days' ? 'bg-surface text-text-primary shadow-sm' : 'text-text-tertiary hover:text-text-secondary'}`}
            >
              Days
            </button>
            <button 
              onClick={() => setZoom('weeks')}
              className={`px-3 py-1 text-[10px] font-bold rounded-md transition-all ${zoom === 'weeks' ? 'bg-surface text-text-primary shadow-sm' : 'text-text-tertiary hover:text-text-secondary'}`}
            >
              Weeks
            </button>
          </div>
        </div>
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-4 text-[11px] font-medium text-text-tertiary uppercase tracking-tight">
            <div className="flex items-center gap-1.5"><div className="w-2 h-2 rounded bg-accent-primary" /> Active</div>
            <div className="flex items-center gap-1.5"><div className="w-2 h-2 rounded bg-signal-safe" /> Complete</div>
            <div className="flex items-center gap-1.5"><div className="w-2 h-2 rounded bg-signal-critical" /> Blocked</div>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-auto scrollbar-thin" ref={scrollRef}>
        <div className="min-w-max relative pb-10">
          {/* Timeline Header (Ruler) */}
          <div className="sticky top-0 z-20 flex bg-surface/90 backdrop-blur-md border-b border-border">
            <div className="w-64 shrink-0 p-3 border-r border-border text-[10px] font-bold text-text-tertiary uppercase tracking-widest bg-surface/50">Execution Entity</div>
            <div className="flex">
              {Array.from({ length: daysCount }).map((_, i) => {
                const date = new Date(start);
                date.setDate(date.getDate() + i);
                const isWeekend = date.getDay() === 0 || date.getDay() === 6;
                const isToday = date.toDateString() === new Date().toDateString();
                
                return (
                  <div 
                    key={i} 
                    className={`w-12 shrink-0 p-3 border-r border-border-subtle text-[10px] text-center font-bold transition-colors ${
                      isToday ? 'bg-accent-primary/10 text-accent-primary' : isWeekend ? 'bg-bg/30 text-text-quaternary' : 'text-text-tertiary'
                    }`}
                  >
                    {date.getDate()}
                    <div className="text-[8px] font-medium mt-0.5 opacity-60">{date.toLocaleString('default', { weekday: 'short' })}</div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Timeline Content */}
          <div className="relative">
            {projects.map((project: any) => {
              const projectTasks = timelineItems.filter((t: any) => t.project_id === project.id);
              if (projectTasks.length === 0) return null;

              return (
                <div key={project.id} className="border-b border-border-subtle group">
                  <div className="flex items-center bg-surface-3/10 hover:bg-surface-3/20 transition-colors">
                    <div className="w-64 shrink-0 p-3 border-r border-border flex items-center gap-2">
                      <div className="w-5 h-5 rounded bg-accent-primary/10 flex items-center justify-center">
                        <Shield className="w-3 h-3 text-accent-primary" />
                      </div>
                      <span className="text-[12px] font-bold text-text-secondary truncate">{project.name}</span>
                    </div>
                    <div className="flex-1 relative h-12">
                      {/* Project range bar would go here if project had start/end */}
                    </div>
                  </div>

                  {projectTasks.map((task: any) => {
                    const taskDate = new Date(task.due_date);
                    const offsetDays = Math.ceil((taskDate.getTime() - start.getTime()) / 86400000);
                    const isBlocked = dependencies.some((d: any) => d.task_id === task.id);
                    
                    return (
                      <div key={task.id} className="flex hover:bg-white/[0.02] transition-colors border-b border-border-subtle/30">
                        <div className="w-64 shrink-0 p-3 pl-10 border-r border-border text-[11px] text-text-tertiary truncate">
                          {task.name}
                        </div>
                        <div className="flex-1 relative h-10 flex items-center">
                          {/* Task Bar */}
                          <motion.div 
                            initial={{ scaleX: 0 }}
                            animate={{ scaleX: 1 }}
                            className={`absolute h-6 rounded-md shadow-premium border flex items-center px-2 cursor-pointer group/bar ${
                              task.status === 'done' ? 'bg-signal-safe/10 border-signal-safe/20 text-signal-safe' :
                              isBlocked ? 'bg-signal-critical/10 border-signal-critical/20 text-signal-critical' :
                              'bg-accent-primary/10 border-accent-primary/20 text-accent-primary'
                            }`}
                            style={{ 
                              left: `${(offsetDays - 2) * 48}px`, 
                              width: '144px',
                              transformOrigin: 'left'
                            }}
                          >
                            <div className={`w-1.5 h-1.5 rounded-full mr-2 ${
                              task.status === 'done' ? 'bg-signal-safe' : isBlocked ? 'bg-signal-critical' : 'bg-accent-primary'
                            }`} />
                            <span className="text-[10px] font-bold truncate">{task.status}</span>
                            
                            {/* Hover Intel */}
                            <div className="absolute bottom-full left-0 mb-2 hidden group-hover/bar:block z-30 w-48 bg-surface border border-border p-2 rounded-lg shadow-xl">
                              <p className="text-[11px] font-bold text-text-primary mb-1">{task.name}</p>
                              <p className="text-[9px] text-text-tertiary mb-2">Deadline: {taskDate.toLocaleDateString()}</p>
                              <div className="flex items-center gap-1.5 pt-1.5 border-t border-border-subtle">
                                <Clock className="w-3 h-3 text-text-quaternary" />
                                <span className="text-[9px] font-bold uppercase text-text-quaternary">Critical Path Item</span>
                              </div>
                            </div>
                          </motion.div>

                          {/* Dependency Lines (Visual only for now) */}
                          {isBlocked && (
                            <div 
                              className="absolute h-[1px] bg-signal-critical/30 dashed" 
                              style={{ 
                                left: `${(offsetDays - 5) * 48}px`, 
                                width: '144px',
                                top: '50%'
                              }} 
                            />
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

function RoadmapView({ projects, tasks }: any) {
  const roadmapData = useMemo(() => {
    return projects.map((p: any) => {
      const pTasks = tasks.filter((t: any) => t.project_id === p.id);
      const doneTasks = pTasks.filter((t: any) => t.status === 'done');
      const progress = pTasks.length > 0 ? (doneTasks.length / pTasks.length) * 100 : 0;
      
      return {
        ...p,
        taskCount: pTasks.length,
        progress,
        status: p.status || 'Active'
      };
    });
  }, [projects, tasks]);

  return (
    <div className="flex flex-col gap-6 h-full overflow-y-auto pr-2 scrollbar-thin">
      <div className="bg-surface-2 border border-border rounded-xl overflow-hidden">
        <div className="p-4 border-b border-border bg-surface flex items-center justify-between">
          <h3 className="text-sm font-semibold text-text-primary">Operational Roadmap</h3>
          <div className="flex items-center gap-2">
            <span className="text-[11px] font-medium text-text-tertiary uppercase">Q2 2026</span>
          </div>
        </div>
        <div className="divide-y divide-border-subtle">
          {roadmapData.map((project: any) => (
            <div key={project.id} className="p-5 hover:bg-surface-3/30 transition-colors group">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-accent-primary/10 border border-accent-primary/20 flex items-center justify-center">
                    <Shield className="w-5 h-5 text-accent-primary" />
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-text-primary group-hover:text-accent-primary transition-colors">{project.name}</h4>
                    <p className="text-[11px] text-text-tertiary uppercase font-medium tracking-tight">{project.execution_mode} · {project.taskCount} Tasks</p>
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <div className="text-right">
                    <p className="text-[10px] font-bold text-text-tertiary uppercase mb-1">Progress</p>
                    <p className="text-sm font-bold text-text-primary">{Math.round(project.progress)}%</p>
                  </div>
                  <div className="w-32 h-1.5 bg-surface-3 rounded-full overflow-hidden">
                    <div className="h-full bg-accent-primary transition-all" style={{ width: `${project.progress}%` }} />
                  </div>
                </div>
              </div>
              
              <div className="flex items-center gap-8 pl-13">
                <div className="flex items-center gap-2">
                  <Clock className="w-3.5 h-3.5 text-text-tertiary" />
                  <span className="text-[11px] text-text-secondary font-medium">May 12 — Jun 28</span>
                </div>
                <div className="flex items-center gap-2">
                  <Users className="w-3.5 h-3.5 text-text-tertiary" />
                  <span className="text-[11px] text-text-secondary font-medium">4 Contributors</span>
                </div>
                <div className="flex items-center gap-2">
                  <Activity className="w-3.5 h-3.5 text-signal-safe" />
                  <span className="text-[11px] text-signal-safe font-bold uppercase tracking-tight">On Track</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function CalendarView({ tasks, events }: any) {
  const [currentDate, setCurrentDate] = useState(new Date());
  
  const daysInMonth = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0).getDate();
  const firstDayOfMonth = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1).getDay();
  
  const monthName = currentDate.toLocaleString('default', { month: 'long' });
  const year = currentDate.getFullYear();

  const calendarDays = useMemo(() => {
    const days = [];
    // Pad for previous month
    for (let i = 0; i < firstDayOfMonth; i++) {
      days.push({ type: 'pad', key: `pad-${i}` });
    }
    // Days of current month
    for (let i = 1; i <= daysInMonth; i++) {
      const dateStr = `${year}-${String(currentDate.getMonth() + 1).padStart(2, '0')}-${String(i).padStart(2, '0')}`;
      const dayTasks = tasks.filter((t: any) => t.due_date?.startsWith(dateStr));
      const dayEvents = events.filter((e: any) => e.start_date?.startsWith(dateStr));
      
      days.push({
        type: 'day',
        day: i,
        date: dateStr,
        tasks: dayTasks,
        events: dayEvents,
        key: `day-${i}`
      });
    }
    return days;
  }, [currentDate, tasks, events]);

  const nextMonth = () => setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1));
  const prevMonth = () => setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1));

  return (
    <div className="bg-surface-2 border border-border rounded-xl flex flex-col h-full overflow-hidden shadow-sm">
      <div className="p-4 bg-surface border-b border-border flex items-center justify-between">
        <div className="flex items-center gap-4">
          <h3 className="text-sm font-bold text-text-primary uppercase tracking-wider">{monthName} {year}</h3>
          <div className="flex items-center bg-surface-3 rounded-lg p-1 border border-border">
            <button onClick={prevMonth} className="p-1 hover:bg-surface-2 rounded transition-colors text-text-tertiary"><ArrowLeft className="w-4 h-4" /></button>
            <button onClick={() => setCurrentDate(new Date())} className="px-2 text-[10px] font-bold text-text-secondary uppercase">Today</button>
            <button onClick={nextMonth} className="p-1 hover:bg-surface-2 rounded transition-colors text-text-tertiary"><ArrowRight className="w-4 h-4" /></button>
          </div>
        </div>
        <div className="flex items-center gap-4 text-[11px] font-medium text-text-tertiary uppercase">
          <div className="flex items-center gap-1.5"><div className="w-2 h-2 rounded bg-accent-primary" /> Tasks</div>
          <div className="flex items-center gap-1.5"><div className="w-2 h-2 rounded bg-signal-warning" /> Events</div>
          <div className="flex items-center gap-1.5"><div className="w-2 h-2 rounded bg-signal-critical" /> Holidays</div>
        </div>
      </div>

      <div className="grid grid-cols-7 border-b border-border bg-surface/50">
        {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
          <div key={day} className="p-2 text-center text-[10px] font-bold text-text-tertiary uppercase tracking-widest">{day}</div>
        ))}
      </div>

      <div className="flex-1 grid grid-cols-7 auto-rows-fr overflow-y-auto scrollbar-thin">
        {calendarDays.map((d: any) => (
          <div 
            key={d.key} 
            className={`min-h-[120px] p-2 border-r border-b border-border-subtle group hover:bg-surface-3/30 transition-colors ${
              d.type === 'pad' ? 'bg-bg/50' : 'bg-surface'
            }`}
          >
            {d.type === 'day' && (
              <>
                <span className="text-[11px] font-bold text-text-tertiary group-hover:text-text-primary transition-colors">{d.day}</span>
                <div className="mt-2 space-y-1">
                  {d.events.map((e: any) => (
                    <div key={e.id} className={`text-[9px] p-1 rounded border px-1.5 font-bold truncate ${
                      e.event_type === 'holiday' ? 'bg-signal-critical-bg border-signal-critical/20 text-signal-critical' : 'bg-signal-warning-bg border-signal-warning/20 text-signal-warning'
                    }`}>
                      {e.title}
                    </div>
                  ))}
                  {d.tasks.map((t: any) => (
                    <div key={t.id} className="text-[9px] p-1 bg-accent-primary/10 text-accent-primary border border-accent-primary/20 rounded px-1.5 font-bold truncate">
                      {t.name}
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

function AllocationView({ users, tasks }: any) {
  const allocationData = useMemo(() => {
    return users.map((u: any) => {
      const uTasks = tasks.filter((t: any) => t.assignee_id === u.id && t.status !== 'done');
      const totalHrs = uTasks.reduce((sum: number, t: any) => sum + (t.estimated_hours || 0), 0);
      const capacity = 40 * (u.availability_factor || 1);
      const load = (totalHrs / capacity) * 100;
      
      return {
        ...u,
        totalHrs,
        capacity,
        load,
        taskCount: uTasks.length
      };
    });
  }, [users, tasks]);

  return (
    <div className="flex flex-col gap-6 h-full overflow-y-auto pr-2 scrollbar-thin pb-10">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {allocationData.map((user: any) => (
          <div key={user.id} className="bg-surface-2 border border-border rounded-xl p-5 shadow-sm hover:border-accent-primary/30 transition-all">
            <div className="flex items-center gap-3 mb-5">
              <div className="w-10 h-10 rounded-full bg-surface-3 border border-border overflow-hidden">
                {user.avatar_url ? (
                  <img src={user.avatar_url} alt="" className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-text-tertiary font-bold">{user.full_name?.[0] || 'U'}</div>
                )}
              </div>
              <div>
                <h4 className="text-sm font-bold text-text-primary">{user.full_name || user.email}</h4>
                <p className="text-[10px] text-text-tertiary uppercase font-bold tracking-widest">{user.role?.replace('_', ' ') || 'Member'}</p>
              </div>
            </div>

            <div className="space-y-4">
              <div className="flex justify-between items-end">
                <div>
                  <p className="text-[10px] font-bold text-text-tertiary uppercase mb-1">Workload</p>
                  <p className={`text-xl font-bold ${user.load > 100 ? 'text-signal-critical' : user.load > 80 ? 'text-signal-warning' : 'text-text-primary'}`}>
                    {user.totalHrs}h <span className="text-xs font-medium text-text-tertiary">/ {user.capacity}h</span>
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-[10px] font-bold text-text-tertiary uppercase mb-1">Load Factor</p>
                  <p className={`text-sm font-bold ${user.load > 100 ? 'text-signal-critical' : 'text-text-primary'}`}>{Math.round(user.load)}%</p>
                </div>
              </div>

              <div className="w-full h-2 bg-surface-3 rounded-full overflow-hidden">
                <div 
                  className={`h-full transition-all ${user.load > 100 ? 'bg-signal-critical' : user.load > 80 ? 'bg-signal-warning' : 'bg-accent-primary'}`} 
                  style={{ width: `${Math.min(100, user.load)}%` }} 
                />
              </div>

              <div className="pt-2 flex items-center justify-between border-t border-border-subtle">
                <span className="text-[11px] text-text-tertiary font-medium uppercase tracking-tight">{user.taskCount} Active Tasks</span>
                <button className="text-[11px] text-accent-primary font-bold hover:underline">View Load</button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function ListView({ tasks, projectMap, userMap, hasWriteAccess, onTransitionTask, onTaskClick }: any) {
  return (
    <div className="flex flex-col gap-2 h-full overflow-y-auto pr-2 scrollbar-thin">
      <div className="grid grid-cols-12 gap-4 px-4 py-2 border-b border-border bg-surface-2 text-[10px] font-bold text-text-tertiary uppercase tracking-widest sticky top-0 z-10">
        <div className="col-span-5">Task Name</div>
        <div className="col-span-3">Project</div>
        <div className="col-span-2">Assignee</div>
        <div className="col-span-2">Status</div>
      </div>
      {tasks.length === 0 ? (
        <div className="p-8 text-center text-text-quaternary text-xs font-mono uppercase">No tasks found</div>
      ) : (
        tasks.map((task: any) => {
          const project = projectMap.get(task.project_id);
          const assignee = task.assignee_id ? userMap.get(task.assignee_id) : null;
          return (
            <div 
              key={task.id} 
              onClick={() => onTaskClick(task)}
              className="grid grid-cols-12 gap-4 px-4 py-3 border border-border-subtle bg-surface hover:bg-surface-3 transition-colors rounded-md cursor-pointer items-center"
            >
              <div className="col-span-5 text-[12px] font-medium text-text-primary truncate">{task.name}</div>
              <div className="col-span-3 text-[11px] text-text-secondary truncate">{project?.name || 'No Project'}</div>
              <div className="col-span-2 text-[11px] text-text-tertiary truncate">{assignee?.full_name || assignee?.email || 'Unassigned'}</div>
              <div className="col-span-2">
                <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${task.status === 'done' ? 'bg-signal-safe/10 text-signal-safe' : 'bg-surface-3 text-text-secondary'}`}>
                  {task.status}
                </span>
              </div>
            </div>
          );
        })
      )}
    </div>
  );
}
