import React from 'react';
import { CalendarView } from '../../components/calendar/CalendarView';

export default function TimelinePage() {
  return (
    <div className="h-[calc(100vh-80px)] w-full flex flex-col overflow-hidden rounded-xl border border-outline-variant bg-surface">
      <CalendarView />
    </div>
  );
}
