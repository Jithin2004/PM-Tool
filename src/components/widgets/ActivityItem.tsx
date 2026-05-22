import { Clock, User } from 'lucide-react';

interface ActivityEntry {
  id: string;
  actor_id?: string;
  action: string;
  target_type?: string;
  target_id?: string;
  metadata?: Record<string, any>;
  created_at: string;
}

interface ActivityItemProps {
  entry: ActivityEntry;
  onClick?: () => void;
}

function timeAgo(date: string): string {
  const diff = Date.now() - new Date(date).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'now';
  if (mins < 60) return `${mins}m`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.floor(hours / 24);
  return `${days}d`;
}

export function ActivityItem({ entry, onClick }: ActivityItemProps) {
  return (
    <div
      className={`flex items-start gap-2 px-3 py-2 rounded group ${onClick ? 'cursor-pointer hover:bg-white/[0.02] transition-colors' : ''}`}
      onClick={onClick}
    >
      <div className="w-5 h-5 rounded-full bg-white/5 flex items-center justify-center shrink-0 mt-0.5">
        <User className="w-3 h-3 text-white/40" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-[11px] font-mono text-white/70 truncate">{entry.action}</div>
        {entry.target_type && <div className="text-[10px] font-mono text-white/30 truncate">{entry.target_type}</div>}
      </div>
      <div className="flex items-center gap-1 text-[10px] font-mono text-white/20 shrink-0">
        <Clock className="w-2.5 h-2.5" />
        <span>{timeAgo(entry.created_at)}</span>
      </div>
    </div>
  );
}
