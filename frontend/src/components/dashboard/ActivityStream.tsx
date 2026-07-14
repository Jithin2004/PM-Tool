import { useRef, useCallback, useEffect, useState } from 'react';
import { OperationalTimeline } from '../widgets/OperationalTimeline';
import { useActivityFeed } from '../../hooks/useActivityFeed';

interface ActivityStreamProps {
  wsId?: string;
  onItemClick?: (entry: any) => void;
  maxVirtualWindow?: number;
}

export function ActivityStream({ wsId, onItemClick, maxVirtualWindow = 50 }: ActivityStreamProps) {
  const { 
    entries, 
    loading, 
    loadingMore, 
    hasMore, 
    error, 
    loadMore, 
    searchQuery, 
    setSearchQuery, 
    filterModule, 
    setFilterModule 
  } = useActivityFeed(wsId, maxVirtualWindow);

  return (
    <OperationalTimeline
      entries={entries}
      loading={loading}
      loadingMore={loadingMore}
      hasMore={hasMore}
      error={error}
      onLoadMore={loadMore}
      searchQuery={searchQuery}
      setSearchQuery={setSearchQuery}
      filterModule={filterModule}
      setFilterModule={setFilterModule}
      onItemClick={onItemClick}
    />
  );
}
