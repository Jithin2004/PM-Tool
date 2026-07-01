import React from 'react';
import { TeamRosterView } from '../../components/resources/TeamRosterView';

export default function CapacityPage() {
  return (
    <div className="flex flex-col h-[calc(100vh-80px)] overflow-hidden bg-surface">
      <div className="flex-shrink-0 p-6 md:p-8 border-b border-border bg-surface-2/30">
        <h1 className="text-3xl font-extrabold tracking-tight text-white mb-2">
          Organization Capacity
        </h1>
        <p className="text-[var(--text-secondary)] text-sm max-w-2xl leading-relaxed">
          Monitor team workload, active projects, and capacity metrics across all operational teams.
        </p>
      </div>
      <div className="flex-1 overflow-y-auto p-6 md:p-8">
        <TeamRosterView />
      </div>
    </div>
  );
}
