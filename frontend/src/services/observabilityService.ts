import { supabase } from '../lib/supabase';

type Severity = 'info' | 'warning' | 'error' | 'critical';
type Source = 'frontend' | 'database' | 'rpc' | 'auth' | 'edge_function' | 'integration';

interface EventPayload {
  workspace_id?: string;
  severity: Severity;
  source: Source;
  event_type: string;
  message: string;
  metadata?: any;
}

export const observabilityService = {
  async logEvent(payload: EventPayload): Promise<void> {
    try {
      // Strip credentials from metadata if any
      const safeMetadata = JSON.parse(JSON.stringify(payload.metadata || {}));
      const redactKeys = ['password', 'token', 'secret', 'key'];
      const redactObj = (obj: any) => {
        if (!obj || typeof obj !== 'object') return;
        for (const k of Object.keys(obj)) {
          if (redactKeys.some(r => k.toLowerCase().includes(r))) {
            obj[k] = '[REDACTED]';
          } else if (typeof obj[k] === 'object') {
            redactObj(obj[k]);
          }
        }
      };
      redactObj(safeMetadata);

      await supabase.from('system_events').insert({
        workspace_id: payload.workspace_id || null,
        severity: payload.severity,
        source: payload.source,
        event_type: payload.event_type,
        message: payload.message,
        metadata: safeMetadata
      });
    } catch (e) {
      console.error('Observability failure:', e);
    }
  },

  captureReactError(error: Error, errorInfo: React.ErrorInfo) {
    // Attempt to extract workspace_id from localStorage if available
    let workspace_id;
    try {
      const activeWs = localStorage.getItem('active_workspace_id');
      if (activeWs) workspace_id = activeWs;
    } catch (e) {}

    this.logEvent({
      workspace_id,
      severity: 'critical',
      source: 'frontend',
      event_type: 'REACT_CRASH',
      message: error.message,
      metadata: {
        stack: error.stack,
        componentStack: errorInfo.componentStack
      }
    });
  },

  captureSupabaseError(context: string, error: any, workspace_id?: string) {
    this.logEvent({
      workspace_id,
      severity: 'error',
      source: 'database',
      event_type: 'SUPABASE_ERROR',
      message: error?.message || 'Unknown database error',
      metadata: {
        context,
        code: error?.code,
        details: error?.details,
        hint: error?.hint
      }
    });
  }
};
