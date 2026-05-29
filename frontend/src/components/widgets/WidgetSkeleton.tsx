import { motion } from 'motion/react';
import { skeleton } from '../../lib/animation';

interface WidgetSkeletonProps {
  lines?: number;
}

export function WidgetSkeleton({ lines = 3 }: WidgetSkeletonProps) {
  return (
    <div className="bg-surface-3/50 backdrop-blur-md border border-border/50 rounded-2xl p-5 shadow-sm">
      <div className="space-y-3">
        {Array.from({ length: lines }).map((_, i) => (
          <motion.div
            key={i}
            variants={skeleton}
            initial="hidden"
            animate="visible"
            className="h-3 bg-surface-3 rounded-full"
            style={{ width: `${[80, 60, 45, 70, 55][i] || 60}%` }}
          />
        ))}
      </div>
    </div>
  );
}
