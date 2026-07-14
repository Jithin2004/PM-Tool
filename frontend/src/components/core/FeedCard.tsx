import React, { useState } from 'react';
import { Terminal, ShieldAlert } from 'lucide-react';
import { Avatar } from './Avatar';
import { Badge } from './Badge';

/* ================================================================
   RESOLVE PM — Core FeedCard Component (Event Timeline Card)
   Source of truth: Phase 6 of approved plan (Enterprise Event Timeline)
   
   Features:
     - Displays event actor with Avatar.
     - Highlights event severity (low, moderate, high, critical).
     - Displays technical trace metadata (correlation ID, execution trace)
       in clean monospace wrappers.
   ================================================================ */

export interface EventTimelineItem {
  id: string | number;
  actorName: string;
  actorAvatar?: string | null;
  message: string;
  timestamp: string;
  module: string;
  severity?: 'low' | 'moderate' | 'high' | 'critical';
  correlationId?: string;
  executionTrace?: string;
}

interface FeedCardProps {
  event: EventTimelineItem;
  className?: string;
}

export function FeedCard({ event, className = '' }: FeedCardProps) {
  const [showTrace, setShowTrace] = useState(false);

  const severityBadgeVariant = {
    low: 'success',
    moderate: 'info',
    high: 'warning',
    critical: 'danger',
  }[event.severity || 'low'] as any;

  return (
    <div
      className={[
        'bg-[var(--color-surface-1)] border border-[var(--color-border)] rounded-[var(--radius-lg)] p-[var(--space-4)]',
        'flex gap-[var(--space-3)] items-start transition-colors duration-[var(--dur-instant)]',
        className,
      ].join(' ')}
    >
      <Avatar src={event.actorAvatar} name={event.actorName} size="md" />

      <div className="flex-1 flex flex-col gap-[var(--space-2)] min-w-0">
        {/* Top line: Actor + Timestamp + Module */}
        <div className="flex items-center justify-between flex-wrap gap-[var(--space-2)] select-none">
          <div className="flex items-center gap-[var(--space-2)]">
            <span className="text-[var(--text-base)] font-semibold text-[var(--color-text-primary)]">
              {event.actorName}
            </span>
            <Badge variant={severityBadgeVariant}>
              {event.severity || 'info'}
            </Badge>
          </div>
          <div className="flex items-center gap-[var(--space-2)] text-[var(--text-xs)] text-[var(--color-text-muted)]">
            <span>{event.timestamp}</span>
            <span>•</span>
            <span className="uppercase tracking-wider font-semibold text-[var(--color-primary)]">
              {event.module}
            </span>
          </div>
        </div>

        {/* Message Body */}
        <p className="text-[var(--text-base)] text-[var(--color-text-secondary)] leading-relaxed">
          {event.message}
        </p>

        {/* Technical Trace metadata strip */}
        {(event.correlationId || event.executionTrace) && (
          <div className="flex flex-col gap-[var(--space-2)] mt-[var(--space-1)]">
            <div className="flex items-center gap-[var(--space-3)]">
              {event.correlationId && (
                <span className="text-[var(--text-xs)] font-mono text-[var(--color-text-muted)] bg-[var(--color-surface-2)] px-[var(--space-2)] py-0.5 rounded-[var(--radius-sm)] border border-[var(--color-border)]">
                  cid: {event.correlationId}
                </span>
              )}
              {event.executionTrace && (
                <button
                  onClick={() => setShowTrace(!showTrace)}
                  className="flex items-center gap-[var(--space-1)] text-[var(--text-xs)] font-mono text-[var(--color-primary)] hover:text-[var(--color-primary-hover)] focus:outline-none"
                >
                  <Terminal size={12} strokeWidth={1.5} />
                  <span>{showTrace ? 'Hide Trace' : 'Show Trace'}</span>
                </button>
              )}
            </div>

            {showTrace && event.executionTrace && (
              <pre className="p-[var(--space-3)] bg-[var(--color-surface-3)] border border-[var(--color-border-strong)] rounded-[var(--radius-sm)] text-[var(--text-sm)] font-mono text-[var(--color-text-secondary)] overflow-x-auto select-text leading-relaxed">
                <code>{event.executionTrace}</code>
              </pre>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
