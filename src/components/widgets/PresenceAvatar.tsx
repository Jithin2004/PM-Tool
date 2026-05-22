import { motion } from 'motion/react';

interface PresenceAvatarProps {
  name: string;
  online?: boolean;
  typing?: boolean;
  size?: 'sm' | 'md';
}

const sizeMap = { sm: 'w-6 h-6 text-[9px]', md: 'w-8 h-8 text-[10px]' };
const dotPos = { sm: '-top-0.5 -right-0.5', md: '-top-0.5 -right-0.5' };

export function PresenceAvatar({ name, online, typing, size = 'sm' }: PresenceAvatarProps) {
  const initials = name.slice(0, 2).toUpperCase();
  return (
    <div className="relative inline-flex shrink-0">
      <div className={`${sizeMap[size]} rounded-full bg-white/5 flex items-center justify-center font-mono text-white/70`}>
        {initials}
      </div>
      {online && (
        <motion.span
          animate={typing ? { scale: [1, 1.3, 1], transition: { duration: 0.8, repeat: Infinity } } : {}}
          className={`absolute ${dotPos[size]} w-2 h-2 rounded-full ${typing ? 'bg-amber-400' : 'bg-emerald-400'}`}
        />
      )}
    </div>
  );
}
