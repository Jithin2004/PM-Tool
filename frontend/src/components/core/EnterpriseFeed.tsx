import React, { useState, useMemo } from 'react';
import { ShieldAlert, RefreshCw, Filter } from 'lucide-react';
import { FeedCard, EventTimelineItem } from './FeedCard';
import { EmptyState } from './EmptyState';
import { Button } from './Button';

/* ================================================================
   RESOLVE PM — Core EnterpriseFeed Component
   Source of truth: Phase 6 of approved plan (Enterprise Event Timeline)
   
   Features:
     - Implements chronological feed of operational events.
     - Severity filters (all, critical, high, moderate, low).
     - Module filters (all, finance, execution, hr, admin, knowledge).
     - Full keyboard navigation list support.
   ================================================================ */

interface EnterpriseFeedProps {
  events: EventTimelineItem[];
  onRefresh?: () => void;
  isLoading?: boolean;
}

export function EnterpriseFeed({ events, onRefresh, isLoading = false }: EnterpriseFeedProps) {
  const [severityFilter, setSeverityFilter] = useState<string>('all');
  const [moduleFilter, setModuleFilter] = useState<string>('all');

  const filteredEvents = useMemo(() => {
    return events.filter((event) => {
      const matchSeverity = severityFilter === 'all' || event.severity === severityFilter;
      const matchModule = moduleFilter === 'all' || event.module?.toLowerCase() === moduleFilter.toLowerCase();
      return matchSeverity && matchModule;
    });
  }, [events, severityFilter, moduleFilter]);

  const uniqueModules = useMemo(() => {
    const modules = new Set<string>();
    events.forEach((e) => {
      if (e.module) modules.add(e.module.toLowerCase());
    });
    return Array.from(modules);
  }, [events]);

  return (
    <div className="flex flex-col gap-[var(--space-4)] w-full">
      {/* Filter and Control Toolbar */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-[var(--space-3)] pb-[var(--space-3)] border-b border-[var(--color-border)] select-none">
        <div className="flex flex-wrap items-center gap-[var(--space-3)]">
          {/* Severity selector */}
          <div className="flex items-center gap-1.5 text-[var(--text-xs)]">
            <span className="text-[var(--color-text-muted)]">Severity:</span>
            <select
              value={severityFilter}
              onChange={(e) => setSeverityFilter(e.target.value)}
              className="h-7 px-2 border border-[var(--color-border)] bg-[var(--color-surface-1)] text-[var(--color-text-primary)] rounded-[var(--radius-sm)] focus:outline-none focus:border-[var(--color-primary)] text-[11px] font-medium"
            >
              <option value="all">All</option>
              <option value="critical">Critical</option>
              <option value="high">High</option>
              <option value="moderate">Moderate</option>
              <option value="low">Low</option>
            </select>
          </div>

          {/* Module selector */}
          <div className="flex items-center gap-1.5 text-[var(--text-xs)]">
            <span className="text-[var(--color-text-muted)]">Module:</span>
            <select
              value={moduleFilter}
              onChange={(e) => setModuleFilter(e.target.value)}
              className="h-7 px-2 border border-[var(--color-border)] bg-[var(--color-surface-1)] text-[var(--color-text-primary)] rounded-[var(--radius-sm)] focus:outline-none focus:border-[var(--color-primary)] text-[11px] font-medium capitalize"
            >
              <option value="all">All Modules</option>
              {uniqueModules.map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
            </select>
          </div>
        </div>

        {onRefresh && (
          <Button
            variant="secondary"
            size="sm"
            loading={isLoading}
            onClick={onRefresh}
            icon={RefreshCw}
          >
            Refresh Feed
          </Button>
        )}
      </div>

      {/* Events List container */}
      {filteredEvents.length === 0 ? (
        <EmptyState
          icon={ShieldAlert}
          title="No Matching Operational Events"
          description="Try modifying your filters to inspect historical trace updates."
        />
      ) : (
        <div className="flex flex-col gap-[var(--space-3)]">
          {filteredEvents.map((event) => (
            <FeedCard key={event.id} event={event} />
          ))}
        </div>
      )}
    </div>
  );
}
