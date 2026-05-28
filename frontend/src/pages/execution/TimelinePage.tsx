import React from 'react';
import { CalendarView } from '../../components/calendar/CalendarView';

export default function TimelinePage() {
  return (
    <main className="max-w-[1600px] mx-auto h-screen flex flex-col p-4 sm:p-8">
      <div className="flex-1 rounded-2xl overflow-hidden border border-outline-variant shadow-lg bg-surface">
        <CalendarView />
      </div>
    </main>
  );
}
