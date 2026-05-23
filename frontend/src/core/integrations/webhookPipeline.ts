export type DeliveryStatus = 'pending' | 'delivered' | 'retrying' | 'failed' | 'ignored';

export interface WebhookDelivery {
  id: string;
  channel: string;
  event: string;
  status: DeliveryStatus;
  attempt: number;
  receivedAt: string;
  deliveredAt: string | null;
  error: string | null;
}

export interface IngestionEvent {
  id: string;
  channel: string;
  type: string;
  payload: Record<string, unknown>;
  receivedAt: string;
  processed: boolean;
}

export function createIngestionEvent(
  channel: string,
  type: string,
  payload: Record<string, unknown>,
): IngestionEvent {
  return {
    id: `${channel}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    channel,
    type,
    payload,
    receivedAt: new Date().toISOString(),
    processed: false,
  };
}

export function describeDeliveryStatus(status: DeliveryStatus): { label: string; color: string } {
  switch (status) {
    case 'pending': return { label: 'pending', color: 'text-amber-400' };
    case 'delivered': return { label: 'delivered', color: 'text-emerald-400' };
    case 'retrying': return { label: 'retrying', color: 'text-cyan-400' };
    case 'failed': return { label: 'failed', color: 'text-red-400' };
    case 'ignored': return { label: 'ignored', color: 'text-gray-500' };
  }
}
