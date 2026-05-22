type HealthStatus = 'healthy' | 'warning' | 'critical';

interface HealthBadgeProps {
  status: HealthStatus;
  label?: string;
}

const colors: Record<HealthStatus, string> = {
  healthy: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
  warning: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
  critical: 'bg-red-500/10 text-red-400 border-red-500/20',
};

const dots: Record<HealthStatus, string> = {
  healthy: 'bg-emerald-400',
  warning: 'bg-amber-400',
  critical: 'bg-red-400',
};

export function HealthBadge({ status, label }: HealthBadgeProps) {
  return (
    <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 text-[10px] font-mono border ${colors[status]}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${dots[status]}`} />
      {label || status}
    </span>
  );
}
