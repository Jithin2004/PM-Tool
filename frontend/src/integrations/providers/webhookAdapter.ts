import { BaseIntegrationAdapter, IntegrationSyncParams, WebhookPayload } from './BaseIntegrationAdapter';
import { sha256 } from '../../utils/cryptoUtils';

export class WebhookAdapter extends BaseIntegrationAdapter {
  readonly provider = 'custom_webhook';

  async connect(workspaceId: string, credentials: any) {
    if (!credentials || !credentials.url) {
      return { success: false, error: 'Missing Webhook URL' };
    }
    return { success: true, data: { status: 'connected' } };
  }

  async disconnect(workspaceId: string, integrationId: string) {
    return true;
  }

  async sync(params: IntegrationSyncParams) {
    const { payload } = params;
    return { success: true, itemsSynced: 1 };
  }

  async handleWebhook(workspaceId: string, integrationId: string, payload: WebhookPayload) {
    return { 
      success: true, 
      eventType: `webhook.${payload.method}`, 
      normalizedPayload: this.transformInbound(payload.body || {}) 
    };
  }

  transformInbound(payload: any) {
    return {
      source: this.provider,
      action: payload.event || 'custom_event',
      raw: payload
    };
  }

  transformOutbound(payload: any) {
    return payload; // Webhooks usually pass the raw JSON
  }
}

export const webhookAdapter = new WebhookAdapter();
