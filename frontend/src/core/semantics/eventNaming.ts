export type OperationalEventType =
  | 'execution.cycle.started'
  | 'execution.cycle.completed'
  | 'execution.unit.created'
  | 'execution.unit.updated'
  | 'execution.unit.deleted'
  | 'execution.unit.assigned'
  | 'execution.unit.blocked'
  | 'execution.unit.unblocked'
  | 'coordination.signal.received'
  | 'coordination.channel.connected'
  | 'coordination.channel.disconnected'
  | 'coordination.channel.degraded'
  | 'delivery.bottleneck.detected'
  | 'delivery.risk.escalated'
  | 'delivery.vitality.changed'
  | 'audit.chain.initialized'
  | 'audit.chain.reindex'
  | 'audit.chain.verified'
  | 'presence.state.changed'
  | 'presence.intent.changed'
  | 'presence.context.changed';

const EVENT_LABELS: Record<OperationalEventType, string> = {
  'execution.cycle.started': 'Sprint started',
  'execution.cycle.completed': 'Sprint completed',
  'execution.unit.created': 'Task created',
  'execution.unit.updated': 'Task updated',
  'execution.unit.deleted': 'Task removed',
  'execution.unit.assigned': 'Task assigned',
  'execution.unit.blocked': 'Task blocked',
  'execution.unit.unblocked': 'Task unblocked',
  'coordination.signal.received': 'Coordination signal received',
  'coordination.channel.connected': 'External channel connected',
  'coordination.channel.disconnected': 'External channel disconnected',
  'coordination.channel.degraded': 'External channel degraded',
  'delivery.bottleneck.detected': 'Coordination pressure detected',
  'delivery.risk.escalated': 'Delivery risk escalated',
  'delivery.vitality.changed': 'Execution vitality changed',
  'audit.chain.initialized': 'Audit chain initialized',
  'audit.chain.reindex': 'Audit chain reindexed',
  'audit.chain.verified': 'Audit chain verified',
  'presence.state.changed': 'Operational state changed',
  'presence.intent.changed': 'Operational intent changed',
  'presence.context.changed': 'Operational context changed',
};

export function describeEvent(event: OperationalEventType): string {
  return EVENT_LABELS[event] || event;
}

export const LEGACY_EVENT_MAP: Record<string, OperationalEventType> = {
  'GENESIS_RESET': 'audit.chain.reindex',
  'task_created': 'execution.unit.created',
  'task_updated': 'execution.unit.updated',
  'task_deleted': 'execution.unit.deleted',
  'task_assigned': 'execution.unit.assigned',
  'sprint_started': 'execution.cycle.started',
  'sprint_completed': 'execution.cycle.completed',
  'blocker_raised': 'execution.unit.blocked',
  'blocker_resolved': 'execution.unit.unblocked',
};

export function mapLegacyEvent(legacyEvent: string): OperationalEventType {
  return LEGACY_EVENT_MAP[legacyEvent] || legacyEvent as OperationalEventType;
}
