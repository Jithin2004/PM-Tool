import React from 'react';
import { 
  LayoutGrid, 
  List as ListIcon, 
  GanttChart, 
  Calendar as CalendarIcon, 
  Layers, 
  Plus, 
  Settings2,
  ChevronDown,
  Search,
  Filter,
  BarChart2,
  Map
} from 'lucide-react';

export type ExecutionViewType = 'board' | 'list' | 'sprint' | 'timeline' | 'roadmap' | 'calendar' | 'allocation';

interface ExecutionHeaderProps {
  activeView: ExecutionViewType;
  onViewChange: (view: ExecutionViewType) => void;
  onAddTask: () => void;
  onOpenSettings: () => void;
  taskCount: number;
  projectName?: string;
  executionMode?: string;
  onSearchChange: (query: string) => void;
  groupBy: string;
  onGroupByChange: (group: any) => void;
}

export function ExecutionHeader({
  activeView,
  onViewChange,
  onAddTask,
  onOpenSettings,
  taskCount,
  projectName,
  executionMode,
  onSearchChange,
  groupBy,
  onGroupByChange
}: ExecutionHeaderProps) {
  const views: { id: ExecutionViewType; label: string; icon: React.ReactNode }[] = [
    { id: 'board', label: 'Board', icon: <LayoutGrid className="w-4 h-4" /> },
    { id: 'list', label: 'List', icon: <ListIcon className="w-4 h-4" /> },
    { id: 'sprint', label: 'Sprint', icon: <Layers className="w-4 h-4" /> },
    { id: 'timeline', label: 'Timeline', icon: <GanttChart className="w-4 h-4" /> },
    { id: 'roadmap', label: 'Roadmap', icon: <Map className="w-4 h-4" /> },
    { id: 'calendar', label: 'Calendar', icon: <CalendarIcon className="w-4 h-4" /> },
    { id: 'allocation', label: 'Allocation', icon: <BarChart2 className="w-4 h-4" /> },
  ];

  return (
    <div className="flex flex-col gap-4 mb-6">
      <div className="flex justify-between items-center">
        <div className="flex items-center gap-3">
          <h1 className="text-xl font-semibold text-text-primary tracking-tight">
            {projectName || 'Execution Engine'}
          </h1>
          <div className="flex items-center gap-1.5 px-2 py-0.5 bg-surface-3 border border-border rounded text-[10px] font-medium text-text-tertiary uppercase tracking-wider">
            {executionMode || 'Kanban'}
          </div>
          <span className="text-[11px] text-text-tertiary font-medium">
            {taskCount} tasks
          </span>
        </div>

        <div className="flex items-center gap-2">
          <div className="flex items-center bg-surface-2 border border-border rounded-lg p-1 shadow-sm">
            {views.map((view) => (
              <button
                key={view.id}
                onClick={() => onViewChange(view.id)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-[12px] font-medium transition-all ${
                  activeView === view.id
                    ? 'bg-surface-3 text-text-primary shadow-sm'
                    : 'text-text-tertiary hover:text-text-secondary hover:bg-surface-3/50'
                }`}
              >
                {view.icon}
                {view.label}
              </button>
            ))}
          </div>

          <div className="h-6 w-[1px] bg-border mx-1" />

          <button
            onClick={onAddTask}
            className="flex items-center gap-1.5 px-4 py-2 bg-accent-primary hover:bg-accent-primary/90 text-white rounded-lg text-[13px] font-semibold shadow-sm transition-all active:scale-95"
          >
            <Plus className="w-4 h-4" />
            Add Task
          </button>
          
          <button
            onClick={onOpenSettings}
            className="p-2 bg-surface-2 border border-border hover:bg-surface-3 rounded-lg text-text-tertiary hover:text-text-primary transition-all shadow-sm"
          >
            <Settings2 className="w-4 h-4" />
          </button>
        </div>
      </div>

      <div className="flex items-center justify-between py-2 border-y border-border-subtle">
        <div className="flex items-center gap-4">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-text-tertiary" />
            <input
              type="text"
              placeholder="Search tasks..."
              onChange={(e) => onSearchChange(e.target.value)}
              className="bg-surface-2 border border-border rounded-lg pl-8 pr-3 py-1.5 text-[12px] text-text-primary placeholder:text-text-tertiary focus:outline-none focus:border-accent-primary/50 w-64 transition-all"
            />
          </div>
          
          <div className="flex items-center gap-2">
            <button className="flex items-center gap-1.5 px-2.5 py-1.5 bg-surface-2 border border-border rounded-lg text-[12px] text-text-secondary hover:bg-surface-3 transition-all">
              <Filter className="w-3.5 h-3.5" />
              Filters
              <span className="w-4 h-4 flex items-center justify-center bg-surface-3 rounded text-[10px] font-bold text-text-tertiary">0</span>
            </button>
            
            <div className="relative group/menu">
              <button className="flex items-center gap-1.5 px-2.5 py-1.5 bg-surface-2 border border-border rounded-lg text-[12px] text-text-secondary hover:bg-surface-3 transition-all">
                Group by: <span className="capitalize">{groupBy}</span>
                <ChevronDown className="w-3.5 h-3.5" />
              </button>
              <div className="absolute top-full left-0 mt-1 w-40 bg-surface-2 border border-border rounded-lg shadow-lg opacity-0 pointer-events-none group-hover/menu:opacity-100 group-hover/menu:pointer-events-auto transition-all z-20 overflow-hidden">
                {['status', 'assignee', 'priority', 'risk'].map((group) => (
                  <button
                    key={group}
                    onClick={() => onGroupByChange(group)}
                    className="w-full text-left px-3 py-2 text-[12px] text-text-secondary hover:bg-surface-3 hover:text-text-primary transition-colors capitalize"
                  >
                    {group}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex -space-x-2">
            {[1, 2, 3].map((i) => (
              <div key={i} className="w-6 h-6 rounded-full border-2 border-bg bg-surface-3 flex items-center justify-center text-[10px] font-bold text-text-tertiary shadow-sm">
                U{i}
              </div>
            ))}
            <div className="w-6 h-6 rounded-full border-2 border-bg bg-surface-2 flex items-center justify-center text-[10px] font-bold text-text-tertiary shadow-sm">
              +5
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
