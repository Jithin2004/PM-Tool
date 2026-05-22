import { ActivityFeed } from '../widgets/ActivityFeed';
import { useActivityFeed } from '../../hooks/useActivityFeed';

interface ActivityStreamProps {
  wsId?: string;
  onItemClick?: (entry: any) => void;
}

export function ActivityStream({ wsId, onItemClick }: ActivityStreamProps) {
  const { entries, loading, error, feedRef, handleScroll } = useActivityFeed(wsId);

  return (
    <ActivityFeed
      entries={entries}
      loading={loading}
      error={error}
      emptyMessage="No recent activity"
      onItemClick={onItemClick}
    />
  );
}
