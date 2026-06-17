import { useRef, useCallback, useEffect, useState } from 'react';
import { ActivityFeed } from '../widgets/ActivityFeed';
import { useActivityFeed } from '../../hooks/useActivityFeed';

interface ActivityStreamProps {
  wsId?: string;
  onItemClick?: (entry: any) => void;
  maxVirtualWindow?: number;
}

const IS_SSR = typeof window === 'undefined';

export function ActivityStream({ wsId, onItemClick, maxVirtualWindow = 50 }: ActivityStreamProps) {
  const { entries, loading, error } = useActivityFeed(wsId);

  const windowed = maxVirtualWindow && entries.length > maxVirtualWindow
    ? entries.slice(entries.length - maxVirtualWindow)
    : entries;

  return (
    <ActivityFeed
      entries={windowed}
      loading={loading}
      error={error}
      emptyMessage="Activity appears here when team members complete tasks, update milestones, or escalate risks."
      emptyAction={{
        label: "View Projects",
        onClick: () => {
          window.history.pushState(null, '', '/workspace');
          window.dispatchEvent(new Event('popstate'));
        }
      }}
      onItemClick={onItemClick}
      maxItems={maxVirtualWindow}
    />
  );
}
