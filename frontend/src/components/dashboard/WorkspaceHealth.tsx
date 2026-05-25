import { AlertTriangle, Clock, TrendingUp, Bot, Wifi } from 'lucide-react';
import { WidgetCard } from '../widgets/WidgetCard';
import { MetricTile } from '../widgets/MetricTile';

interface HealthData {
  riskScore: number;
  overdueTasks: number;
  sprintVelocity: number;
  activeAutomations?: number;
  integrationHealth?: number;
  velocityTrend?: number;
}

interface WorkspaceHealthProps {
  data?: HealthData;
  loading?: boolean;
  error?: string | null;
  tileLoading?: { risk?: boolean; overdue?: boolean; velocity?: boolean; automations?: boolean; integrations?: boolean };
  onViewOverdue?: () => void;
  onViewSprints?: () => void;
  onViewRisks?: () => void;
  onViewAutomations?: () => void;
  onViewIntegrations?: () => void;
}

function riskColor(score: number): string {
  if (score > 60) return 'text-signal-critical';
  if (score > 30) return 'text-signal-warning';
  return 'text-emerald-400';
}

function healthColor(value: number): string {
  if (value < 60) return 'text-signal-critical';
  if (value < 85) return 'text-signal-warning';
  return 'text-emerald-400';
}

export function WorkspaceHealth({
  data, loading, error, tileLoading,
  onViewOverdue, onViewSprints, onViewRisks, onViewAutomations, onViewIntegrations,
}: WorkspaceHealthProps) {
  return (
    <WidgetCard title="Workspace Health" loading={loading} error={error}>
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-2">
        <MetricTile
          label="Risk Score"
          value={data?.riskScore ?? '--'}
          icon={AlertTriangle}
          color={data ? riskColor(data.riskScore) : 'text-text-primary'}
          loading={tileLoading?.risk}
          onClick={onViewRisks}
        />
        <MetricTile
          label="Overdue Tasks"
          value={data?.overdueTasks ?? '--'}
          icon={Clock}
          color={data?.overdueTasks && data.overdueTasks > 0 ? 'text-signal-warning' : 'text-text-primary'}
          loading={tileLoading?.overdue}
          onClick={onViewOverdue}
        />
        <MetricTile
          label="Sprint Velocity"
          value={data?.sprintVelocity ?? '--'}
          icon={TrendingUp}
          trend={data?.velocityTrend ? { value: Math.abs(data.velocityTrend), positive: data.velocityTrend > 0 } : undefined}
          loading={tileLoading?.velocity}
          onClick={onViewSprints}
        />
        <MetricTile
          label="Active Automations"
          value={data?.activeAutomations ?? '--'}
          icon={Bot}
          color="text-text-primary"
          loading={tileLoading?.automations}
          onClick={onViewAutomations}
        />
        <MetricTile
          label="Integration Health"
          value={data?.integrationHealth != null ? `${data.integrationHealth}%` : '--'}
          icon={Wifi}
          color={data?.integrationHealth != null ? healthColor(data.integrationHealth) : 'text-text-primary'}
          loading={tileLoading?.integrations}
          onClick={onViewIntegrations}
        />
      </div>
    </WidgetCard>
  );
}
