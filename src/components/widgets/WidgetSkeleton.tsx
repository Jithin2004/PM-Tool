import { motion } from 'motion/react';
import { skeleton } from '../../lib/animation';

interface WidgetSkeletonProps {
  lines?: number;
}

export function WidgetSkeleton({ lines = 3 }: WidgetSkeletonProps) {
  return (
    <div className="bg-[#0c0c0c] border border-white/10 p-4">
      <div className="space-y-2">
        {Array.from({ length: lines }).map((_, i) => (
          <motion.div
            key={i}
            variants={skeleton}
            initial="hidden"
            animate="visible"
            className="h-3 bg-white/5 rounded"
            style={{ width: `${[80, 60, 45, 70, 55][i] || 60}%` }}
          />
        ))}
      </div>
    </div>
  );
}
