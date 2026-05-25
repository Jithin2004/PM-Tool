import { Users, AlertCircle, Timer, Moon } from 'lucide-react';
import { WidgetCard } from '../widgets/WidgetCard';
import { WorkloadBar } from '../widgets/WorkloadBar';
import { PresenceAvatar } from '../widgets/PresenceAvatar';

interface TeamMember {
  id: string;
  name: string;
  workload: number;
  blocked?: boolean;
  online?: boolean;
  sprintParticipation?: number;
}

interface TeamRadarProps {
  members?: TeamMember[];
  loading?: boolean;
  error?: string | null;
  blockedCount?: number;
  onMemberClick?: (id: string) => void;
  emptyAction?: { label: string; onClick: () => void };
}

export function TeamRadar({ members, loading, error, blockedCount, onMemberClick, emptyAction }: TeamRadarProps) {
  const hasData = members && members.length > 0;

  const overloaded = members?.filter((m) => m.workload > 85).length ?? 0;
  const idle = members?.filter((m) => m.workload < 15).length ?? 0;

  return (
    <WidgetCard
      title="Team Radar"
      loading={loading}
      error={error}
      empty={!loading && !error && !hasData}
      emptyMessage="No team members to display"
      emptyAction={emptyAction}
      action={
        blockedCount && blockedCount > 0 ? (
          <span className="flex items-center gap-1 text-[10px] font-mono text-signal-critical/70">
            <AlertCircle className="w-3 h-3" />
            {blockedCount} blocked
          </span>
        ) : overloaded > 0 ? (
          <span className="flex items-center gap-1 text-[10px] font-mono text-signal-warning/70">
            <Timer className="w-3 h-3" />
            {overloaded} overloaded
          </span>
        ) : undefined
      }
    >
      {hasData && (
        <div className="space-y-1">
          {members.map((member) => (
            <div
              key={member.id}
              className="flex items-center gap-3 py-1.5 cursor-pointer hover:bg-surface-3 rounded transition-colors"
              onClick={() => onMemberClick?.(member.id)}
            >
              <PresenceAvatar name={member.name} online={member.online} typing={false} size="sm" />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-0.5">
                  <span className="text-[11px] font-mono text-text-secondary truncate">{member.name}</span>
                  {member.blocked && <AlertCircle className="w-2.5 h-2.5 text-signal-critical shrink-0" />}
                  {member.workload < 15 && <Moon className="w-2.5 h-2.5 text-text-quaternary shrink-0" />}
                  {member.sprintParticipation != null && (
                    <span className="ml-auto text-[9px] font-mono text-text-quaternary">
                      {member.sprintParticipation} pts
                    </span>
                  )}
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
