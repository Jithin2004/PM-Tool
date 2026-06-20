import { BaseIntegrationAdapter, IntegrationSyncParams, WebhookPayload } from './BaseIntegrationAdapter';

export class CalendarAdapter extends BaseIntegrationAdapter {
  readonly provider = 'google_calendar';

  async connect(workspaceId: string, credentials: any) {
    if (!credentials || !credentials.token) {
      return { success: false, error: 'Missing Calendar token' };
    }
    return { success: true, data: { status: 'connected' } };
  }

  async disconnect(workspaceId: string, integrationId: string) {
    return true;
  }

  async sync(params: IntegrationSyncParams) {
    const { payload } = params;
    if (payload?.action === 'sync_event') {
      return { success: true, itemsSynced: 1 };
    }
    return { success: true, itemsSynced: 0 };
  }

  async handleWebhook(workspaceId: string, integrationId: string, payload: WebhookPayload) {
    const channelId = payload.headers['x-goog-channel-id'];
    if (!channelId) {
      return { success: false, error: 'Missing Calendar channel ID' };
    }

    const resourceState = payload.headers['x-goog-resource-state'];
    return { 
      success: true, 
      eventType: `calendar.${resourceState}`, 
      normalizedPayload: this.transformInbound(payload.body || {}) 
    };
  }

  transformInbound(payload: any) {
    return {
      source: this.provider,
      action_type: 'calendar_updated',
      raw: payload
    };
  }

  transformOutbound(payload: any) {
    return {
      summary: payload.title,
      description: payload.description,
      start: { dateTime: payload.start_time },
      end: { dateTime: payload.end_time }
    };
  }
}

export const calendarAdapter = new CalendarAdapter();
