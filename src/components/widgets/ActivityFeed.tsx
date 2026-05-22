import { useRef, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { slideUp } from '../../lib/animation';
import { ActivityItem } from './ActivityItem';
import { WidgetCard } from './WidgetCard';

interface ActivityEntry {
  id: string;
  actor_id?: string;
  action: string;
  target_type?: string;
  target_id?: string;
  metadata?: Record<string, any>;
  created_at: string;
}

interface ActivityFeedProps {
  entries: ActivityEntry[];
  loading?: boolean;
  error?: string | null;
  emptyMessage?: string;
  onItemClick?: (entry: ActivityEntry) => void;
}

export function ActivityFeed({ entries, loading, error, emptyMessage, onItemClick }: ActivityFeedProps) {
  const feedRef = useRef<HTMLDivElement>(null);
  const isAtTopRef = useRef(true);

  const handleScroll = useCallback(() => {
    if (!feedRef.current) return;
    isAtTopRef.current = feedRef.current.scrollTop < 30;
  }, []);

  useEffect(() => {
    if (feedRef.current && isAtTopRef.current && entries.length > 0) {
      feedRef.current.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }, [entries.length]);

  return (
    <WidgetCard title="Activity" loading={loading} error={error} empty={!loading && !error && entries.length === 0} emptyMessage={emptyMessage || 'No recent activity'}>
      <div ref={feedRef} onScroll={handleScroll} className="space-y-1 max-h-[400px] overflow-y-auto scrollbar-thin">
        <AnimatePresence initial={false}>
          {entries.map((entry) => (
            <motion.div
              key={entry.id}
              variants={slideUp}
              initial="hidden"
              animate="visible"
              layout
            >
              <ActivityItem entry={entry} onClick={() => onItemClick?.(entry)} />
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </WidgetCard>
  );
}
