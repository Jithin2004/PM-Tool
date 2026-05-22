import { motion } from 'motion/react';
import { fadeIn } from '../../lib/animation';
import { isFeatureEnabled } from '../../features/flags';
import { CommandCenterHeader } from './CommandCenterHeader';
import { WorkspaceHealth } from './WorkspaceHealth';
import { ActivityStream } from './ActivityStream';
import { TeamRadar } from './TeamRadar';
import { QuickActionsRail } from './QuickActionsRail';
import { AIInsights } from './AIInsights';

interface PresenceUser {
  id: string;
  name: string;
  online?: boolean;
  typing?: boolean;
}

interface CommandCenterProps {
  wsId?: string;
  workspaceName?: string;
  onOpenPalette: () => void;
  healthData?: {
    riskScore: number;
    overdueTasks: number;
    sprintVelocity: number;
    velocityTrend?: number;
    activeAutomations?: number;
    integrationHealth?: number;
  };
  healthLoading?: boolean;
  healthError?: string | null;
  healthTileLoading?: { risk?: boolean; overdue?: boolean; velocity?: boolean; automations?: boolean; integrations?: boolean };
  teamMembers?: Array<{ id: string; name: string; workload: number; blocked?: boolean; online?: boolean; sprintParticipation?: number }>;
  teamLoading?: boolean;
  teamError?: string | null;
  blockedCount?: number;
  connectionStatus?: 'connected' | 'disconnected' | 'reconnecting';
  presenceUsers?: PresenceUser[];
  notificationCount?: number;
  insights?: Array<{
    id: string;
    type: 'blocked-sprint' | 'overdue-cluster' | 'workload-imbalance' | 'stalled-project';
    message: string;
    confidence: 'low' | 'medium' | 'high';
    actionLabel?: string;
    onAction?: () => void;
  }>;
  insightsLoading?: boolean;
  insightsError?: string | null;
  onDismissInsight?: (id: string) => void;
  onViewOverdue?: () => void;
  onViewSprints?: () => void;
  onViewRisks?: () => void;
  onViewAutomations?: () => void;
  onViewIntegrations?: () => void;
  onCreateTask?: () => void;
  onCreateProject?: () => void;
  onTriggerAutomation?: () => void;
  onAISummary?: () => void;
  onSearch?: () => void;
  onOpenNotifications?: () => void;
  onSwitchWorkspace?: () => void;
}

export function CommandCenter({
  wsId, workspaceName, onOpenPalette,
  healthData, healthLoading, healthError, healthTileLoading,
  teamMembers, teamLoading, teamError, blockedCount,
  connectionStatus, presenceUsers, notificationCount,
  insights, insightsLoading, insightsError, onDismissInsight,
  onViewOverdue, onViewSprints, onViewRisks, onViewAutomations, onViewIntegrations,
  onCreateTask, onCreateProject, onTriggerAutomation, onAISummary,
  onSearch, onOpenNotifications, onSwitchWorkspace,
}: CommandCenterProps) {
  if (!isFeatureEnabled('command-center')) return null;

  return (
    <motion.div variants={fadeIn} initial="hidden" animate="visible">
      <CommandCenterHeader
        workspaceName={workspaceName}
        presenceUsers={presenceUsers}
        connectionStatus={connectionStatus}
        notificationCount={notificationCount}
        onSearch={onSearch}
        onOpenPalette={onOpenPalette}
        onOpenNotifications={onOpenNotifications}
        onSwitchWorkspace={onSwitchWorkspace}
      />

      <div className="px-4 md:px-6 pb-6 space-y-4 max-w-[1440px] mx-auto">
        <WorkspaceHealth
          data={healthData}
          loading={healthLoading}
          error={healthError}
          tileLoading={healthTileLoading}
          onViewOverdue={onViewOverdue}
          onViewSprints={onViewSprints}
          onViewRisks={onViewRisks}
          onViewAutomations={onViewAutomations}
          onViewIntegrations={onViewIntegrations}
        />

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
          <div className="lg:col-span-7">
            <ActivityStream wsId={wsId} />
          </div>
          <div className="lg:col-span-5 space-y-4">
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
        </div>

        <QuickActionsRail
          onOpenPalette={onOpenPalette}
          onCreateTask={onCreateTask}
          onCreateProject={onCreateProject}
          onTriggerAutomation={onTriggerAutomation}
          onAISummary={onAISummary}
        />
      </div>
    </motion.div>
  );
}
