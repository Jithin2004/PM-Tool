import React from 'react';
import { GanttView as GanttChart } from '../gantt/GanttView';
import type { Milestone, Meeting, Project, Epic, CalendarEvent } from '../../types';

interface GanttViewProps {
  milestones: Milestone[];
  meetings: Meeting[];
  projects: Project[];
  epics: Epic[];
  calendarEvents: CalendarEvent[];
}

const ExecutionGanttView = React.memo(function ExecutionGanttView({
  milestones, meetings, projects, epics, calendarEvents
}: GanttViewProps) {
  return (
    <GanttChart
      milestones={milestones}
      meetings={meetings}
      projects={projects}
      epics={epics}
      calendarEvents={calendarEvents}
    />
  );
});

export default ExecutionGanttView;
