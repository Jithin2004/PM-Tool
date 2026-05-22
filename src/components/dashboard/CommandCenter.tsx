import { motion } from 'motion/react';
import { fadeIn } from '../../lib/animation';
import { isFeatureEnabled } from '../../features/flags';
import { WidgetGrid } from '../widgets/WidgetGrid';
import { WorkspaceHealth } from './WorkspaceHealth';
import { ActivityStream } from './ActivityStream';
import { TeamRadar } from './TeamRadar';
import { QuickActions } from './QuickActions';
import { AIInsights } from './AIInsights';

interface CommandCenterProps {
  wsId?: string;
  onOpenPalette: () => void;
  healthData?: {
    riskScore: number;
    overdueTasks: number;
    sprintVelocity: number;
    velocityTrend?: number;
  };
  healthLoading?: boolean;
  healthError?: string | null;
  teamMembers?: Array<{ id: string; name: string; workload: number; blocked?: boolean; online?: boolean }>;
  teamLoading?: boolean;
  teamError?: string | null;
  blockedCount?: number;
  insights?: Array<{
    id: string;
    type: 'blocker' | 'risk' | 'overdue' | 'suggestion';
    message: string;
    confidence?: 'low' | 'medium' | 'high';
    actionLabel?: string;
    onAction?: () => void;
  }>;
  insightsLoading?: boolean;
  insightsError?: string | null;
  onDismissInsight?: (id: string) => void;
  onViewOverdue?: () => void;
  onViewSprints?: () => void;
  onViewRisks?: () => void;
  onCreateTask?: () => void;
  onCreateProject?: () => void;
  onTriggerAutomation?: () => void;
  onAISummary?: () => void;
}

export function CommandCenter({
  wsId, onOpenPalette, healthData, healthLoading, healthError,
  teamMembers, teamLoading, teamError, blockedCount,
  insights, insightsLoading, insightsError, onDismissInsight,
  onViewOverdue, onViewSprints, onViewRisks,
  onCreateTask, onCreateProject, onTriggerAutomation, onAISummary,
}: CommandCenterProps) {
  if (!isFeatureEnabled('command-center')) return null;

  return (
    <motion.div variants={fadeIn} initial="hidden" animate="visible" className="space-y-4">
      <WorkspaceHealth
        data={healthData}
        loading={healthLoading}
        error={healthError}
        onViewOverdue={onViewOverdue}
        onViewSprints={onViewSprints}
        onViewRisks={onViewRisks}
      />

      <WidgetGrid columns={2}>
        <ActivityStream wsId={wsId} />
        <div className="space-y-3">
          <AIInsights
            insights={insights}
            loading={insightsLoading}
            error={insightsError}
            onDismiss={onDismissInsight}
          />
          <TeamRadar
            members={teamMembers}
            loading={teamLoading}
            error={teamError}
            blockedCount={blockedCount}
          />
        </div>
      </WidgetGrid>

      <QuickActions
        onOpenPalette={onOpenPalette}
        onCreateTask={onCreateTask}
        onCreateProject={onCreateProject}
        onTriggerAutomation={onTriggerAutomation}
        onAISummary={onAISummary}
      />
    </motion.div>
  );
}
