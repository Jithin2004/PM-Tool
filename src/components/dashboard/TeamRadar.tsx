import { Users, AlertCircle } from 'lucide-react';
import { WidgetCard } from '../widgets/WidgetCard';
import { WorkloadBar } from '../widgets/WorkloadBar';
import { PresenceAvatar } from '../widgets/PresenceAvatar';

interface TeamMember {
  id: string;
  name: string;
  workload: number;
  blocked?: boolean;
  online?: boolean;
}

interface TeamRadarProps {
  members?: TeamMember[];
  loading?: boolean;
  error?: string | null;
  blockedCount?: number;
  onMemberClick?: (id: string) => void;
}

export function TeamRadar({ members, loading, error, blockedCount, onMemberClick }: TeamRadarProps) {
  const hasData = members && members.length > 0;

  return (
    <WidgetCard
      title="Team Radar"
      loading={loading}
      error={error}
      empty={!loading && !error && !hasData}
      emptyMessage="No team members to display"
      action={
        blockedCount && blockedCount > 0 ? (
          <span className="flex items-center gap-1 text-[10px] font-mono text-red-400/70">
            <AlertCircle className="w-3 h-3" />
            {blockedCount} blocked
          </span>
        ) : undefined
      }
    >
      {hasData && (
        <div className="space-y-1">
          {members.map((member) => (
            <div key={member.id} className="flex items-center gap-3 py-1.5" onClick={() => onMemberClick?.(member.id)}>
              <PresenceAvatar name={member.name} online={member.online} typing={false} />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-[11px] font-mono text-white/80 truncate">{member.name}</span>
                  {member.blocked && <AlertCircle className="w-3 h-3 text-red-400 shrink-0" />}
                </div>
                <WorkloadBar
                  label=""
                  value={member.workload}
                  status={member.workload > 85 ? 'critical' : member.workload > 65 ? 'warning' : 'healthy'}
                />
              </div>
            </div>
          ))}
        </div>
      )}
    </WidgetCard>
  );
}
