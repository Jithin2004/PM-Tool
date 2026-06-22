import React, { useState } from 'react';
import ExecutionTimelineView from './ExecutionTimelineView';
import { CalendarView } from '../../calendar/CalendarView';

export function ScheduleView({ tasks, projects, dependencies, users }: any) {
  const [mode, setMode] = useState<'timeline' | 'calendar'>('timeline');

  return (
    <div className="flex flex-col h-full bg-surface">
      <div className="flex items-center justify-between p-2 border-b border-border bg-surface-2">
        <div className="flex bg-surface-3 p-1 rounded-lg">
          <button 
            onClick={() => setMode('timeline')} 
            className={`px-4 py-1.5 text-xs font-bold rounded-md transition-all ${mode === 'timeline' ? 'bg-accent-primary text-white shadow-sm' : 'text-text-secondary hover:text-text-primary'}`}
          >
            Timeline / Gantt
          </button>
          <button 
            onClick={() => setMode('calendar')} 
            className={`px-4 py-1.5 text-xs font-bold rounded-md transition-all ${mode === 'calendar' ? 'bg-accent-primary text-white shadow-sm' : 'text-text-secondary hover:text-text-primary'}`}
          >
            Calendar
          </button>
        </div>
      </div>
      <div className="flex-1 overflow-hidden">
        {mode === 'timeline' ? (
          <ExecutionTimelineView 
            tasks={tasks} 
            projects={projects} 
            dependencies={dependencies} 
            users={users} 
          />
        ) : (
          <CalendarView />
        )}
      </div>
    </div>
  );
}
