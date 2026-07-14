import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Search, 
  Filter, 
  Clock, 
  User, 
  LogIn, 
  LogOut, 
  Play, 
  Pause, 
  Briefcase, 
  CheckSquare, 
  AlertTriangle, 
  Info,
  ChevronDown
} from 'lucide-react';
import { slideUp } from '../../lib/animation';
import { WidgetCard } from './WidgetCard';
import { ActivityEventEntry } from '../../hooks/useActivityFeed';

interface OperationalTimelineProps {
  entries: ActivityEventEntry[];
  loading?: boolean;
  loadingMore?: boolean;
  hasMore?: boolean;
  error?: string | null;
  onLoadMore?: () => void;
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  filterModule: string;
  setFilterModule: (mod: string) => void;
  onItemClick?: (entry: ActivityEventEntry) => void;
}

const ICON_MAP: Record<string, React.ComponentType<any>> = {
  login: LogIn,
  logout: LogOut,
  clock: Clock,
  play: Play,
  pause: Pause,
  project: Briefcase,
  task: CheckSquare,
  warning: AlertTriangle,
};

function getIcon(key: string) {
  const IconComponent = ICON_MAP[key] || Info;
  return <IconComponent className="w-3.5 h-3.5" />;
}

function getImportanceColor(importance: string): { bg: string; text: string; border: string; glow: string } {
  switch (importance) {
    case 'critical':
      return { 
        bg: 'bg-red-500/10', 
        text: 'text-red-400', 
        border: 'border-red-500/30',
        glow: 'shadow-[0_0_12px_rgba(239,68,68,0.15)]'
      };
    case 'important':
      return { 
        bg: 'bg-amber-500/10', 
        text: 'text-amber-400', 
        border: 'border-amber-500/30',
        glow: 'shadow-[0_0_12px_rgba(245,158,11,0.1)]'
      };
    case 'normal':
      return { 
        bg: 'bg-indigo-500/10', 
        text: 'text-indigo-400', 
        border: 'border-indigo-500/20',
        glow: 'shadow-none'
      };
    default:
      return { 
        bg: 'bg-slate-500/10', 
        text: 'text-slate-400', 
        border: 'border-slate-500/20',
        glow: 'shadow-none'
      };
  }
}

function getInitials(name: string): string {
  if (!name) return 'U';
  return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
}

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

export function OperationalTimeline({
  entries,
  loading,
  loadingMore,
  hasMore,
  error,
  onLoadMore,
  searchQuery,
  setSearchQuery,
  filterModule,
  setFilterModule,
  onItemClick
}: OperationalTimelineProps) {

  // Distinct modules for filtering dropdown
  const modules = [
    { value: '', label: 'All Modules' },
    { value: 'authentication', label: 'Auth' },
    { value: 'workspace', label: 'Workspace' },
    { value: 'projects', label: 'Projects' },
    { value: 'attendance', label: 'Attendance' },
    { value: 'leave', label: 'Leave' },
    { value: 'finance', label: 'Finance' },
    { value: 'administration', label: 'Admin' },
    { value: 'ai', label: 'AI' },
    { value: 'system', label: 'System' }
  ];

  return (
    <WidgetCard
      title="Operational Timeline"
      loading={loading && entries.length === 0}
      error={error}
      empty={!loading && entries.length === 0}
      emptyMessage="No matching operational events found."
    >
      <div className="flex flex-col gap-3 font-geist mb-3">
        {/* Filters and Search Rail */}
        <div className="flex items-center gap-2">
          {/* Search bar */}
          <div className="relative flex-1">
            <span className="absolute inset-y-0 left-3 flex items-center pointer-events-none text-slate-400">
              <Search className="w-3.5 h-3.5" />
            </span>
            <input
              type="text"
              placeholder="Search feed (e.g. names, verbs, task #)..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-1.5 rounded-lg text-xs font-medium border border-[var(--pm-border)] bg-[var(--pm-surface)] text-[var(--pm-text)] placeholder-slate-400 focus:outline-none focus:border-indigo-500 transition-colors"
            />
          </div>

          {/* Module Selector */}
          <div className="relative">
            <select
              value={filterModule}
              onChange={(e) => setFilterModule(e.target.value)}
              className="appearance-none pl-3 pr-8 py-1.5 rounded-lg text-xs font-medium border border-[var(--pm-border)] bg-[var(--pm-surface)] text-[var(--pm-text)] focus:outline-none focus:border-indigo-500 transition-colors cursor-pointer"
            >
              {modules.map((m) => (
                <option key={m.value} value={m.value}>
                  {m.label}
                </option>
              ))}
            </select>
            <span className="absolute inset-y-0 right-2.5 flex items-center pointer-events-none text-slate-400">
              <ChevronDown className="w-3 h-3" />
            </span>
          </div>
        </div>
      </div>

      {/* Events Stream */}
      <div className="space-y-2.5 max-h-[460px] overflow-y-auto pr-1.5 scrollbar-thin">
        <AnimatePresence initial={false}>
          {entries.map((entry) => {
            const colors = getImportanceColor(entry.importance);
            return (
              <motion.div
                key={entry.id}
                variants={slideUp}
                initial="hidden"
                animate="visible"
                exit={{ opacity: 0, scale: 0.95, height: 0 }}
                transition={{ duration: 0.2 }}
                className={`relative flex items-start gap-3 p-3 rounded-xl border border-[var(--pm-border)] bg-[var(--pm-surface-high)]/40 hover:bg-[var(--pm-surface-high)]/80 transition-all cursor-pointer ${colors.border} ${colors.glow}`}
                onClick={() => onItemClick?.(entry)}
              >
                {/* Left Side: Avatar / Initial */}
                <div className="relative shrink-0">
                  {entry.actor_avatar ? (
                    <img
                      src={entry.actor_avatar}
                      alt={entry.actor_name}
                      className="w-8 h-8 rounded-full border border-[var(--pm-border)] object-cover"
                    />
                  ) : (
                    <div className="w-8 h-8 rounded-full border border-[var(--pm-border)] bg-gradient-to-br from-indigo-500/20 to-purple-500/20 flex items-center justify-center text-xs font-bold text-indigo-300">
                      {getInitials(entry.actor_name || '')}
                    </div>
                  )}

                  {/* Micro-badge for icon_key */}
                  <span className={`absolute -bottom-1.5 -right-1.5 w-5 h-5 rounded-full flex items-center justify-center border border-[var(--pm-border)] ${colors.bg} ${colors.text}`}>
                    {getIcon(entry.icon_key)}
                  </span>
                </div>

                {/* Right Side: Details */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-semibold text-[var(--pm-text)] truncate">
                      {entry.actor_name || 'System'}
                    </span>
                    <span className="text-[10px] text-slate-400 whitespace-nowrap shrink-0 flex items-center gap-1">
                      <Clock className="w-2.5 h-2.5" />
                      {timeAgo(entry.created_at)}
                    </span>
                  </div>

                  <div className="text-xs font-medium text-[var(--pm-text)]/90 mt-0.5">
                    {entry.title}
                  </div>

                  {entry.description && (
                    <p className="text-[11px] text-slate-300 leading-normal mt-1">
                      {entry.description}
                    </p>
                  )}

                  {/* Tags / Metadata indicators */}
                  <div className="flex items-center gap-1.5 mt-2">
                    <span className="text-[9px] font-mono px-1.5 py-0.5 rounded border border-slate-700 bg-slate-800/40 text-slate-400 uppercase">
                      {entry.module}
                    </span>
                    <span className={`text-[9px] font-mono px-1.5 py-0.5 rounded border ${colors.border} ${colors.bg} ${colors.text} uppercase`}>
                      {entry.importance}
                    </span>
                    {entry.severity && entry.severity !== 'low' && (
                      <span className="text-[9px] font-mono px-1.5 py-0.5 rounded border border-red-500/20 bg-red-500/10 text-red-400 uppercase">
                        {entry.severity}
                      </span>
                    )}
                  </div>
                </div>
              </motion.div>
            );
          })}
        </AnimatePresence>

        {/* Load More Button */}
        {hasMore && (
          <div className="pt-2 flex justify-center">
            <button
              onClick={onLoadMore}
              disabled={loadingMore}
              className="flex items-center gap-2 px-4 py-2 text-xs font-semibold rounded-lg border border-[var(--pm-border)] bg-[var(--pm-surface)] hover:bg-[var(--pm-surface-high)] text-[var(--pm-text)] transition-colors disabled:opacity-50 cursor-pointer"
            >
              {loadingMore ? (
                <>
                  <svg className="animate-spin h-3 w-3 text-[var(--pm-text)]" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  <span>Loading older events...</span>
                </>
              ) : (
                <span>Load More Activity</span>
              )}
            </button>
          </div>
        )}
      </div>
    </WidgetCard>
  );
}
