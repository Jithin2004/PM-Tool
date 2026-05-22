import { motion } from 'motion/react';
import { stagger } from '../../lib/animation';

interface WidgetGridProps {
  children: React.ReactNode;
  columns?: 1 | 2 | 3 | 4;
  className?: string;
}

const gridCols = { 1: 'grid-cols-1', 2: 'grid-cols-1 md:grid-cols-2', 3: 'grid-cols-1 md:grid-cols-2 lg:grid-cols-3', 4: 'grid-cols-1 md:grid-cols-2 lg:grid-cols-4' };

export function WidgetGrid({ children, columns = 2, className = '' }: WidgetGridProps) {
  return (
    <motion.div variants={stagger(0.04)} initial="hidden" animate="visible" className={`grid ${gridCols[columns]} gap-3 ${className}`}>
      {children}
    </motion.div>
  );
}
