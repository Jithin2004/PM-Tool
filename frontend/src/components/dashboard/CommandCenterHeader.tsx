import { useRef, useEffect, useState, useCallback } from 'react';
import { motion } from 'motion/react';
import { Search, Command, Bell } from 'lucide-react';
import { fadeIn } from '../../lib/animation';
import { LiveBadge } from '../realtime/LiveBadge';
import { PresenceAvatar } from '../widgets/PresenceAvatar';

interface PresenceUser {
  id: string;
  name: string;
  online?: boolean;
  typing?: boolean;
}

interface CommandCenterHeaderProps {
  workspaceName?: string;
  presenceUsers?: PresenceUser[];
  connectionStatus?: 'connected' | 'disconnected' | 'reconnecting';
  notificationCount?: number;
  onSearch?: () => void;
  onOpenPalette?: () => void;
  onOpenNotifications?: () => void;
  onSwitchWorkspace?: () => void;
}

const IS_SSR = typeof window === 'undefined';

export function CommandCenterHeader({
  workspaceName = 'Workspace',
  presenceUsers = [],
  connectionStatus = 'connected',
  notificationCount = 0,
  onSearch,
  onOpenPalette,
  onOpenNotifications,
  onSwitchWorkspace,
}: CommandCenterHeaderProps) {
  const [scrolled, setScrolled] = useState(false);
  const headerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (IS_SSR) return;
    const el = headerRef.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => setScrolled(entry.boundingClientRect.top < 0),
      { threshold: [0], rootMargin: '-1px 0px 0px 0px' }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const maxPresence = 4;
  const visiblePresence = presenceUsers.slice(0, maxPresence);
  const overflow = presenceUsers.length - maxPresence;

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
      e.preventDefault();
      onOpenPalette?.();
    }
  }, [onOpenPalette]);

  if (IS_SSR) return null;

  return (
    <motion.div
      ref={headerRef}
      variants={fadeIn}
      initial="hidden"
      animate="visible"
      onKeyDown={handleKeyDown}
      className={`sticky top-0 z-40 px-4 md:px-6 py-2.5 transition-shadow duration-200 ${
        scrolled
          ? 'shadow-[0_1px_0_rgba(255,255,255,0.08)] bg-bg backdrop-blur-xl'
          : 'bg-transparent'
      }`}
    >
      <div className="flex items-center justify-between gap-3 max-w-[1440px] mx-auto">
        <div className="flex items-center gap-3">
          <button
            onClick={onSwitchWorkspace}
            className="flex items-center gap-2 text-[13px] font-medium text-text-secondary hover:text-text-primary transition-colors"
          >
            <span className="w-5 h-5 rounded bg-white/10 flex items-center justify-center text-[11px] font-mono text-text-tertiary">W</span>
            <span className="truncate max-w-[160px]">{workspaceName}</span>
          </button>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={onSearch}
            className="flex items-center gap-2 px-3 py-1.5 text-[11px] font-medium text-text-quaternary bg-surface-3 border border-border-subtle hover:border-border hover:text-text-tertiary transition-all rounded"
          >
            <Search className="w-3 h-3" />
            <span className="hidden sm:inline">Search</span>
            <span className="hidden md:inline text-text-quaternary">⌘F</span>
          </button>

          <LiveBadge connected={connectionStatus === 'connected'} />

          <button
            onClick={onOpenNotifications}
            className="relative p-1.5 text-text-quaternary hover:text-text-secondary transition-colors"
          >
            <Bell className="w-4 h-4" />
            {notificationCount > 0 && (
              <span className="absolute -top-0.5 -right-0.5 w-4 h-4 rounded-full bg-red-500 text-[9px] font-mono flex items-center justify-center text-text-primary">
                {notificationCount > 9 ? '9+' : notificationCount}
              </span>
            )}
          </button>

          {visiblePresence.length > 0 && (
            <div className="hidden md:flex items-center -space-x-1.5 mr-1">
              {visiblePresence.map((user) => (
                <PresenceAvatar
                  key={user.id}
                  name={user.name}
                  online={user.online}
                  typing={user.typing}
                  size="sm"
                />
              ))}
              {overflow > 0 && (
                <span className="w-6 h-6 rounded-full bg-surface-3 border border-border-subtle flex items-center justify-center text-[10px] font-mono text-text-quaternary">
                  +{overflow}
                </span>
              )}
            </div>
          )}

          <button
            onClick={onOpenPalette}
            className="flex items-center gap-1.5 px-2 py-1.5 text-[11px] font-medium text-text-tertiary bg-surface-3 border border-border-subtle hover:bg-surface-3 hover:text-text-secondary transition-all rounded"
          >
            <Command className="w-3 h-3" />
            <span className="hidden sm:inline text-text-quaternary">K</span>
          </button>
        </div>
      </div>
    </motion.div>
  );
}
