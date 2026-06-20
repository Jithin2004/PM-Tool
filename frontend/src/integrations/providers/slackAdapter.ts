import { BaseIntegrationAdapter, IntegrationSyncParams, WebhookPayload } from './BaseIntegrationAdapter';

export class SlackAdapter extends BaseIntegrationAdapter {
  readonly provider = 'slack';

  async connect(workspaceId: string, credentials: any) {
    if (!credentials || !credentials.token) {
      return { success: false, error: 'Missing Slack token' };
    }
    return { success: true, data: { status: 'connected' } };
  }

  async disconnect(workspaceId: string, integrationId: string) {
    return true;
  }

  async sync(params: IntegrationSyncParams) {
    const { payload } = params;
    if (payload?.action === 'post_message') {
      return { success: true, itemsSynced: 1 };
    }
    return { success: true, itemsSynced: 0 };
  }

  async handleWebhook(workspaceId: string, integrationId: string, payload: WebhookPayload) {
    const signature = payload.headers['x-slack-signature'];
    if (!signature) {
      return { success: false, error: 'Missing Slack signature' };
    }

    const eventType = payload.body?.type || 'unknown';
    const normalized = this.transformInbound(payload.body);

    return { 
      success: true, 
      eventType: `slack.${eventType}`, 
      normalizedPayload: normalized 
    };
  }

  transformInbound(payload: any) {
    return {
      source: this.provider,
      action: payload.event?.type,
      external_id: payload.event?.ts,
      channel: payload.event?.channel,
      user: payload.event?.user,
      text: payload.event?.text,
      raw: payload
    };
  }

  transformOutbound(payload: any) {
    return {
      channel: payload.channel || '#general',
      text: payload.message || payload.text,
      blocks: payload.blocks
    };
  }
}

export const slackAdapter = new SlackAdapter();
