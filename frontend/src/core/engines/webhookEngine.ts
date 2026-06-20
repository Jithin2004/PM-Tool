import { supabase } from '../../lib/supabase';
import { integrationEngine } from './integrationEngine';
import { sha256 } from '../../utils/cryptoUtils';
import { WebhookPayload } from '../../integrations/providers/BaseIntegrationAdapter';

export const webhookEngine = {
  /**
   * Process an incoming webhook payload
   */
  async processInbound(endpointId: string, payload: WebhookPayload) {
    const { data: endpoint } = await supabase
      .from('webhook_endpoints')
      .select('*')
      .eq('id', endpointId)
      .single();

    if (!endpoint || !endpoint.enabled) {
      console.warn('Webhook endpoint disabled or not found');
      return false;
    }

    // Timestamp validation / Replay protection placeholder
    const timestampHeader = payload.headers['x-resolve-timestamp'];
    if (timestampHeader) {
      const timeDiff = Math.abs(Date.now() - parseInt(timestampHeader));
      if (timeDiff > 5 * 60 * 1000) {
        console.warn('Webhook payload expired (replay protection)');
        return false;
      }
    }

    // Signature Validation Placeholder
    if (endpoint.secret_hash) {
      const signature = payload.headers['x-resolve-signature'];
      const bodyString = JSON.stringify(payload.body);
      const expectedHash = await sha256(endpoint.secret_hash + bodyString);
      if (signature !== expectedHash) {
        console.error('Webhook signature validation failed');
        // Log failure
        await supabase.from('integration_events').insert({
          workspace_id: endpoint.workspace_id,
          integration_id: endpointId,
          direction: 'incoming',
          event_type: 'webhook.invalid_signature',
          payload: payload.body,
          processing_status: 'failed',
          error_message: 'Invalid signature'
        });
        return false;
      }
    }

    // Route to integration engine
    // For custom webhooks, we don't have an integration connection ID per se, but we can treat the endpoint ID as the source
    await integrationEngine.processIncomingEvent(endpoint.workspace_id, endpointId, 'custom_webhook', payload);

    return true;
  }
};
