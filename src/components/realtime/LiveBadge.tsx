import { motion } from 'motion/react';

interface LiveBadgeProps {
  connected?: boolean;
}

export function LiveBadge({ connected }: LiveBadgeProps) {
  return (
    <span className="inline-flex items-center gap-1.5 px-2 py-0.5 text-[9px] font-mono uppercase tracking-wider bg-white/5">
      <motion.span
        animate={connected ? { opacity: [1, 0.3, 1], transition: { duration: 2, repeat: Infinity } } : {}}
        className={`w-1.5 h-1.5 rounded-full ${connected ? 'bg-emerald-400' : 'bg-red-400'}`}
      />
      {connected ? 'Live' : 'Offline'}
    </span>
  );
}
