import { useRef, useCallback, useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { slideUp } from '../../lib/animation';
import { WidgetCard } from '../widgets/WidgetCard';
import { ActivityItem } from '../widgets/ActivityItem';
import { useActivityFeed } from '../../hooks/useActivityFeed';

interface ActivityStreamProps {
  wsId?: string;
  onItemClick?: (entry: any) => void;
  maxVirtualWindow?: number;
}

const IS_SSR = typeof window === 'undefined';

export function ActivityStream({ wsId, onItemClick, maxVirtualWindow = 50 }: ActivityStreamProps) {
  const { entries, loading, error } = useActivityFeed(wsId);
  const scrollRef = useRef<HTMLDivElement>(null);
  const [isNearBottom, setIsNearBottom] = useState(true);
  const isNearBottomRef = useRef(true);
  const prevLengthRef = useRef(entries.length);

  const checkNearBottom = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    const threshold = 80;
    const near = el.scrollTop + el.clientHeight >= el.scrollHeight - threshold;
    isNearBottomRef.current = near;
    setIsNearBottom(near);
  }, []);

  useEffect(() => {
    if (IS_SSR) return;
    const el = scrollRef.current;
    if (!el) return;
    el.addEventListener('scroll', checkNearBottom, { passive: true });
    return () => el.removeEventListener('scroll', checkNearBottom);
  }, [checkNearBottom]);

  useEffect(() => {
    const prev = prevLengthRef.current;
    prevLengthRef.current = entries.length;
    if (!isNearBottomRef.current || entries.length <= prev) return;
    const el = scrollRef.current;
    if (!el) return;
    requestAnimationFrame(() => {
      el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' });
    });
  }, [entries.length]);

  const displayed = maxVirtualWindow && entries.length > maxVirtualWindow
    ? entries.slice(entries.length - maxVirtualWindow)
    : entries;

  return (
    <WidgetCard
      title="Activity"
      loading={loading}
      error={error}
      empty={!loading && !error && entries.length === 0}
      emptyMessage="No recent activity"
      action={
        !isNearBottom && entries.length > 0 ? (
          <button
            onClick={() => {
              const el = scrollRef.current;
              if (el) {
                el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' });
                isNearBottomRef.current = true;
                setIsNearBottom(true);
              }
            }}
            className="text-[10px] font-mono text-white/40 hover:text-white/70 transition-colors"
          >
            ↓ New activity
          </button>
        ) : undefined
      }
    >
      <div
        ref={scrollRef}
        className="space-y-0.5 max-h-[380px] overflow-y-auto scrollbar-thin"
      >
        <AnimatePresence initial={false}>
          {displayed.map((entry) => (
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
        {entries.length > maxVirtualWindow && (
          <div className="text-[10px] font-mono text-white/20 text-center py-2">
            Showing {displayed.length} of {entries.length} entries
          </div>
        )}
      </div>
    </WidgetCard>
  );
}
