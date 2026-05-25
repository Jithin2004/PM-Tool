import React from 'react';
import { useDashboard } from '../../context/DashboardContext';
import { useCalendarEvents } from '../../hooks/useCalendarEvents';
import { useWorkspace } from '../../context/WorkspaceContext';
import ExecutionGanttView from '../../components/execution/GanttView';
import type { Milestone, Meeting, Epic } from '../../types';

export default function GanttPage() {
  const { projects, milestones, meetings, epics } = useDashboard();
  const { workspace } = useWorkspace();
  const { events: calendarEvents } = useCalendarEvents(workspace?.id);

  return (
    <main className="max-w-[1600px] mx-auto px-3 sm:px-6 py-6 sm:py-12">
      <div className="flex justify-between items-center mb-8 bg-[#090a0f]/40 border border-border p-4 rounded-lg backdrop-blur-md">
        <div>
          <h2 className="text-sm font-bold uppercase tracking-wider text-text-primary">Gantt Workspace</h2>
          <p className="text-[10px] font-mono text-text-tertiary uppercase">Critical path + delivery planning</p>
        </div>
      </div>
      <ExecutionGanttView
        milestones={milestones || []}
        meetings={meetings || []}
        projects={projects}
        epics={epics || []}
        calendarEvents={calendarEvents}
      />
    </main>
  );
}