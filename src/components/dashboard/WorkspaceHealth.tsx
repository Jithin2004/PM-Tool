import { AlertTriangle, Clock, TrendingUp } from 'lucide-react';
import { WidgetCard } from '../widgets/WidgetCard';
import { MetricTile } from '../widgets/MetricTile';

interface HealthData {
  riskScore: number;
  overdueTasks: number;
  sprintVelocity: number;
  velocityTrend?: number;
}

interface WorkspaceHealthProps {
  data?: HealthData;
  loading?: boolean;
  error?: string | null;
  onViewOverdue?: () => void;
  onViewSprints?: () => void;
  onViewRisks?: () => void;
}

export function WorkspaceHealth({ data, loading, error, onViewOverdue, onViewSprints, onViewRisks }: WorkspaceHealthProps) {
  const riskColor = !data ? 'text-white' : data.riskScore > 60 ? 'text-red-400' : data.riskScore > 30 ? 'text-amber-400' : 'text-emerald-400';

  return (
    <WidgetCard title="Workspace Health" loading={loading} error={error}>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <MetricTile
          label="Risk Score"
          value={data?.riskScore ?? '--'}
          icon={AlertTriangle}
          color={riskColor}
          onClick={onViewRisks}
        />
        <MetricTile
          label="Overdue Tasks"
          value={data?.overdueTasks ?? '--'}
          icon={Clock}
          color={data?.overdueTasks && data.overdueTasks > 0 ? 'text-amber-400' : 'text-white'}
          onClick={onViewOverdue}
        />
        <MetricTile
          label="Sprint Velocity"
          value={data?.sprintVelocity ?? '--'}
          icon={TrendingUp}
          trend={data?.velocityTrend ? { value: Math.abs(data.velocityTrend), positive: data.velocityTrend > 0 } : undefined}
          onClick={onViewSprints}
        />
      </div>
    </WidgetCard>
  );
}
