import { motion } from 'motion/react';

interface LiveBadgeProps {
  connected?: boolean;
  reconnecting?: boolean;
}

export function LiveBadge({ connected, reconnecting }: LiveBadgeProps) {
  const isLive = connected && !reconnecting;

  return (
    <span className="inline-flex items-center gap-1.5 px-2 py-0.5 text-[9px] font-mono uppercase tracking-wider bg-white/5">
      <motion.span
        animate={
          reconnecting
            ? { rotate: 360, transition: { duration: 1.2, repeat: Infinity, ease: 'linear' } }
            : isLive
              ? { opacity: [1, 0.3, 1], transition: { duration: 2, repeat: Infinity } }
              : {}
        }
        className={`w-1.5 h-1.5 rounded-full ${
          reconnecting ? 'bg-amber-400' : isLive ? 'bg-emerald-400' : 'bg-red-400'
        }`}
      />
      {reconnecting ? 'Reconnecting' : isLive ? 'Live' : 'Offline'}
    </span>
  );
}
