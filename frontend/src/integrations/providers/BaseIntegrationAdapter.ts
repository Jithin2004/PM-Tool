export interface IntegrationSyncParams {
  workspaceId: string;
  integrationId: string;
  payload?: any;
}

export interface WebhookPayload {
  headers: Record<string, string>;
  body: any;
  method: string;
}

export abstract class BaseIntegrationAdapter {
  abstract readonly provider: string;

  /**
   * Connect to the external service
   */
  abstract connect(workspaceId: string, credentials: any): Promise<{ success: boolean; data?: any; error?: string }>;

  /**
   * Disconnect from the external service
   */
  abstract disconnect(workspaceId: string, integrationId: string): Promise<boolean>;

  /**
   * Run a synchronization process (inbound/outbound)
   */
  abstract sync(params: IntegrationSyncParams): Promise<{ success: boolean; itemsSynced: number; error?: string }>;

  /**
   * Handle an inbound webhook from the external provider
   */
  abstract handleWebhook(workspaceId: string, integrationId: string, payload: WebhookPayload): Promise<{ success: boolean; eventType?: string; normalizedPayload?: any; error?: string }>;

  /**
   * Transform an inbound payload from external provider into Resolve PM native format
   */
  abstract transformInbound(payload: any): any;

  /**
   * Transform an outbound payload from Resolve PM into external provider native format
   */
  abstract transformOutbound(payload: any): any;
}
