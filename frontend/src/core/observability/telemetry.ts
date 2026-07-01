import { supabase } from "../../lib/supabase";
import { ObservabilityEngine } from "./ObservabilityEngine";
import { LifecycleAwareService, AppContext } from "../lifecycle/types";

let globalTelemetryContext = {
  userId: null as string | null,
  workspaceId: null as string | null
};

let _telemetryStatus: 'idle' | 'running' | 'paused' | 'error' = 'idle';

export const TelemetryService: LifecycleAwareService = {
  initialize: (context: AppContext) => {
    globalTelemetryContext.userId = context.user?.id || null;
    globalTelemetryContext.workspaceId = context.workspace?.id || null;
    _telemetryStatus = 'running';
  },
  pause: () => { _telemetryStatus = 'paused'; },
  resume: () => { _telemetryStatus = 'running'; },
  dispose: () => {
    globalTelemetryContext = { userId: null, workspaceId: null };
    _telemetryStatus = 'idle';
  },
  getStatus: () => _telemetryStatus
};

export async function persistSystemEvent(
  eventType: string,
  severity: "info" | "warning" | "error" | "critical",
  source: "frontend" | "database" | "edge_function" | "integration",
  message: string,
  metadata: Record<string, any> = {},
  stackTrace?: string,
) {
  try {
    let userId = globalTelemetryContext.userId;
    let workspaceId = globalTelemetryContext.workspaceId;

    const browserInfo = {
      userAgent: navigator.userAgent,
      url: window.location.href,
      language: navigator.language,
      platform: navigator.platform,
    };

    // Fire and forget
    supabase
      .from("system_events")
      .insert([
        {
          workspace_id: workspaceId || null,
          user_id: userId || null,
          event_type: eventType,
          severity,
          source,
          message,
          metadata: { ...metadata, browser_info: browserInfo },
          stack_trace: stackTrace || null,
        },
      ])
      .then(({ error }) => {
        if (error) {
          console.error("Failed to persist system event:", error);
        }
      });
  } catch (err) {
    // Must never crash the app
    console.error("Telemetry persistence failure:", err);
  }
}

import { formatDatabaseError } from "../../utils/errorHandler";

/**
 * Reusable wrapper to execute a Supabase operation and automatically
 * record failures to the system_events table.
 */
export async function trackSupabaseOperation<T = any>(
  operationName: string,
  operation: () =>
    | PromiseLike<{ data: T | null; error: any }>
    | Promise<{ data: T | null; error: any }>,
): Promise<{ data: T | null; error: any }> {
  try {
    const result = await operation();
    if (result.error) {
      persistSystemEvent(
        "database_failure",
        "error",
        "database",
        `Operation failed: ${operationName}`,
        { error: result.error, operation: operationName },
      );
      ObservabilityEngine.reportIncident(
        "database",
        "warning",
        `Database operation failed: ${operationName}`,
        result.error.message || "Unknown error",
        { operationName, error: result.error },
      );

      // Mutate the error for the frontend
      result.error = formatDatabaseError(result.error);
    }
    return result;
  } catch (err: any) {
    persistSystemEvent(
      "database_exception",
      "error",
      "database",
      `Operation exception: ${operationName}`,
      { operation: operationName },
      err?.stack || err?.message || String(err),
    );
    ObservabilityEngine.reportIncident(
      "database",
      "critical",
      `Database operation exception: ${operationName}`,
      err?.message || "Unknown exception",
      { operationName },
    );
    return { data: null, error: formatDatabaseError(err) };
  }
}
