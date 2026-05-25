import { motion } from 'motion/react';
import { fadeIn } from '../../lib/animation';

interface TypingIndicatorProps {
  users: Array<{ username: string }>;
}

export function TypingIndicator({ users }: TypingIndicatorProps) {
  if (users.length === 0) return null;

  const label = users.length === 1
    ? `${users[0].username} is typing...`
    : `${users.length} people are typing...`;

  return (
    <motion.div variants={fadeIn} initial="hidden" animate="visible" className="flex items-center gap-1.5 px-3 py-1">
      <div className="flex gap-0.5">
        <span className="w-1 h-1 bg-white/30 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
        <span className="w-1 h-1 bg-white/30 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
        <span className="w-1 h-1 bg-white/30 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
      </div>
      <span className="text-[10px] font-mono text-text-quaternary italic">{label}</span>
    </motion.div>
  );
}
