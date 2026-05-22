import { motion } from 'motion/react';

interface PresenceAvatarProps {
  name: string;
  online?: boolean;
  typing?: boolean;
  idle?: boolean;
  editing?: string;
  size?: 'sm' | 'md';
}

const sizeMap = { sm: 'w-6 h-6 text-[9px]', md: 'w-8 h-8 text-[10px]' };

export function PresenceAvatar({ name, online, typing, idle, editing, size = 'sm' }: PresenceAvatarProps) {
  const initials = name.slice(0, 2).toUpperCase();

  let dotColor = 'bg-white/10';
  let dotAnim = {};
  if (typing) {
    dotColor = 'bg-amber-400';
    dotAnim = { scale: [1, 1.4, 1], transition: { duration: 0.6, repeat: Infinity } };
  } else if (online && !idle) {
    dotColor = 'bg-emerald-400';
    dotAnim = { opacity: [1, 0.4, 1], transition: { duration: 2, repeat: Infinity } };
  } else if (online && idle) {
    dotColor = 'bg-white/20';
  }

  return (
    <motion.div
      className="relative inline-flex shrink-0 group"
      whileHover={{ scale: 1.05 }}
      transition={{ duration: 0.12 }}
    >
      <div className={`${sizeMap[size]} rounded-full bg-white/5 flex items-center justify-center font-mono text-white/70`}>
        {initials}
      </div>
      {(online || typing) && (
        <motion.span
          animate={dotAnim}
          className={`absolute -top-px -right-px w-2 h-2 rounded-full ring-1 ring-[#0a0a0a] ${dotColor}`}
        />
      )}
      {(editing || idle) && (
        <div className="absolute -bottom-6 left-1/2 -translate-x-1/2 whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
          <span className="text-[9px] font-mono text-white/40">
            {editing ? `Editing...` : idle ? 'Idle' : ''}
          </span>
        </div>
      )}
    </motion.div>
  );
}
